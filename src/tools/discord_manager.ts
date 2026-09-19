import type { ToolDefinition, ToolContext } from './types.ts';
import { ChannelType, EmbedBuilder, PermissionsBitField } from 'discord.js';

// Helper to resolve guild from context or client
function resolveGuild(ctx: ToolContext, guildId?: string) {
  if (!ctx.discordClient) {
    throw new Error("Discord client is not currently connected or running. Run with --discord or --all.");
  }

  if (guildId) {
    const g = ctx.discordClient.guilds.cache.get(guildId);
    if (!g) throw new Error(`Guild with ID ${guildId} not found.`);
    return g;
  }

  if (ctx.guildId) {
    const g = ctx.discordClient.guilds.cache.get(ctx.guildId);
    if (g) return g;
  }

  // Fallback to first available guild
  const firstGuild = ctx.discordClient.guilds.cache.first();
  if (!firstGuild) {
    throw new Error("Bot is not currently present in any Discord server. Please invite the bot with proper permissions.");
  }
  return firstGuild;
}

export const createDiscordChannelTool: ToolDefinition = {
  name: 'create_discord_channel',
  description: 'Create a channel or category in the connected Discord server.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name: {
        type: 'STRING',
        description: 'Name of the channel or category.',
      },
      type: {
        type: 'STRING',
        description: 'Type of channel: text, voice, category, or announcement.',
      },
      categoryName: {
        type: 'STRING',
        description: 'Optional parent category name to place this channel under.',
      },
      topic: {
        type: 'STRING',
        description: 'Optional topic/description for the channel.',
      },
      guildId: {
        type: 'STRING',
        description: 'Optional target Discord Guild ID.',
      },
    },
    required: ['name'],
  },
  async execute(args: { name: string; type?: string; categoryName?: string; topic?: string; guildId?: string }, ctx: ToolContext) {
    const guild = resolveGuild(ctx, args.guildId);

    let channelType = ChannelType.GuildText;
    if (args.type === 'voice') channelType = ChannelType.GuildVoice;
    else if (args.type === 'category') channelType = ChannelType.GuildCategory;
    else if (args.type === 'announcement') channelType = ChannelType.GuildAnnouncement;

    // Find parent category if specified
    let parentId: string | undefined;
    if (args.categoryName && channelType !== ChannelType.GuildCategory) {
      let category = guild.channels.cache.find(
        (c: any) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === args.categoryName!.toLowerCase()
      );
      if (!category) {
        // Create category if it doesn't exist
        category = await guild.channels.create({
          name: args.categoryName,
          type: ChannelType.GuildCategory,
        });
      }
      parentId = category.id;
    }

    const channel = await guild.channels.create({
      name: args.name,
      type: channelType,
      parent: parentId,
      topic: args.topic,
    });

    return {
      success: true,
      message: `Channel "${channel.name}" created in server "${guild.name}".`,
      channelId: channel.id,
      guildId: guild.id,
    };
  },
};

export const createDiscordRoleTool: ToolDefinition = {
  name: 'create_discord_role',
  description: 'Create a new role in the Discord server with custom name, color, and permissions.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name: {
        type: 'STRING',
        description: 'Name of the role (e.g. "Developer", "Admin", "Member").',
      },
      color: {
        type: 'STRING',
        description: 'Hex color string (e.g. "#5865F2", "#E74C3C", "#2ECC71").',
      },
      hoist: {
        type: 'BOOLEAN',
        description: 'Whether to display this role separately in the member list.',
      },
      guildId: {
        type: 'STRING',
        description: 'Optional Discord Guild ID.',
      },
    },
    required: ['name'],
  },
  async execute(args: { name: string; color?: string; hoist?: boolean; guildId?: string }, ctx: ToolContext) {
    const guild = resolveGuild(ctx, args.guildId);

    const role = await guild.roles.create({
      name: args.name,
      color: (args.color as any) || undefined,
      hoist: args.hoist ?? true,
      reason: 'Created by JARVIS server automation',
    });

    return {
      success: true,
      message: `Role "${role.name}" created in server "${guild.name}".`,
      roleId: role.id,
    };
  },
};

export const postDiscordEmbedTool: ToolDefinition = {
  name: 'post_discord_embed',
  description: 'Post a formatted rich embed message into a specific Discord channel (e.g. for server rules, onboarding, announcements).',
  parameters: {
    type: 'OBJECT',
    properties: {
      channelName: {
        type: 'STRING',
        description: 'The name of the channel to post in (e.g. "rules", "announcements").',
      },
      title: {
        type: 'STRING',
        description: 'Embed title (e.g. "📜 SERVER RULES & GUIDELINES").',
      },
      description: {
        type: 'STRING',
        description: 'Main body of the embed in Markdown.',
      },
      color: {
        type: 'STRING',
        description: 'Hex color code (e.g. "#00FFCC", "#5865F2"). Defaults to #00FFCC.',
      },
      guildId: {
        type: 'STRING',
        description: 'Optional Discord Guild ID.',
      },
    },
    required: ['channelName', 'title', 'description'],
  },
  async execute(args: { channelName: string; title: string; description: string; color?: string; guildId?: string }, ctx: ToolContext) {
    const guild = resolveGuild(ctx, args.guildId);

    const channel = guild.channels.cache.find(
      (c: any) => c.isTextBased() && c.name.toLowerCase() === args.channelName.toLowerCase().replace(/^#/, '')
    );

    if (!channel || !channel.isTextBased()) {
      throw new Error(`Text channel "#${args.channelName}" not found in server "${guild.name}".`);
    }

    const embed = new EmbedBuilder()
      .setTitle(args.title)
      .setDescription(args.description)
      .setColor((args.color as any) || '#00FFCC')
      .setTimestamp(new Date())
      .setFooter({ text: 'JARVIS Server Automation' });

    await channel.send({ embeds: [embed] });

    return {
      success: true,
      message: `Embed posted to #${channel.name} in "${guild.name}".`,
    };
  },
};

export const setupServerTemplateTool: ToolDefinition = {
  name: 'setup_server_template',
  description: 'Scaffold a complete server layout (categories, channels, roles, and formatted rules) based on a preset template: developer, community, or gaming.',
  parameters: {
    type: 'OBJECT',
    properties: {
      template: {
        type: 'STRING',
        description: 'The preset template to apply: "developer", "community", or "gaming".',
      },
      guildId: {
        type: 'STRING',
        description: 'Optional Discord Guild ID.',
      },
    },
    required: ['template'],
  },
  async execute(args: { template: string; guildId?: string }, ctx: ToolContext) {
    const guild = resolveGuild(ctx, args.guildId);
    const preset = args.template.toLowerCase();

    const createdSummary: string[] = [];

    if (preset === 'developer') {
      // 1. Create Roles
      const rolesToCreate = [
        { name: 'Lead Dev', color: '#E74C3C' },
        { name: 'Developer', color: '#3498DB' },
        { name: 'Contributor', color: '#2ECC71' },
        { name: 'Member', color: '#95A5A6' },
      ];
      for (const r of rolesToCreate) {
        await guild.roles.create({ name: r.name, color: r.color as any, hoist: true });
        createdSummary.push(`Role: ${r.name}`);
      }

      // 2. Information Category
      const infoCat = await guild.channels.create({ name: '📢 INFORMATION', type: ChannelType.GuildCategory });
      const rulesChan = await guild.channels.create({
        name: 'rules',
        type: ChannelType.GuildText,
        parent: infoCat.id,
        topic: 'Server rules, conduct guidelines, and security policies',
      });
      await guild.channels.create({ name: 'announcements', type: ChannelType.GuildAnnouncement, parent: infoCat.id });
      await guild.channels.create({ name: 'resources', type: ChannelType.GuildText, parent: infoCat.id });

      // Post Rules Embed
      const rulesEmbed = new EmbedBuilder()
        .setTitle('🛡️ DEVELOPER HUB — SERVER RULES')
        .setDescription(`
**1. Respect & Collaboration**
Treat all developers and contributors with dignity. Constructive code reviews only; toxic criticism is prohibited.

**2. No Spam or Self-Promotion**
Keep discussions relevant. Do not spam projects, unsolicited DMs, or affiliate links.

**3. Code & Secret Safety**
Never post production secrets, API keys, credentials, or proprietary source code in any channel.

**4. Use Appropriate Channels**
Post code snippets in \`#code-reviews\`, project discussions in \`#dev-chat\`, and casual banter in \`#general\`.

**5. Follow Discord TOS**
All activities must comply strictly with Discord's Terms of Service and Community Guidelines.
        `.trim())
        .setColor('#5865F2')
        .setFooter({ text: 'Automated by JARVIS' });

      await rulesChan.send({ embeds: [rulesEmbed] });
      createdSummary.push('Category: 📢 INFORMATION (#rules, #announcements, #resources + Rules Embed)');

      // 3. Discussion Category
      const discCat = await guild.channels.create({ name: '💬 COMMUNITY', type: ChannelType.GuildCategory });
      await guild.channels.create({ name: 'general', type: ChannelType.GuildText, parent: discCat.id });
      await guild.channels.create({ name: 'bot-commands', type: ChannelType.GuildText, parent: discCat.id });
      createdSummary.push('Category: 💬 COMMUNITY (#general, #bot-commands)');

      // 4. Development Category
      const devCat = await guild.channels.create({ name: '💻 ENGINEERING', type: ChannelType.GuildCategory });
      await guild.channels.create({ name: 'dev-chat', type: ChannelType.GuildText, parent: devCat.id });
      await guild.channels.create({ name: 'code-reviews', type: ChannelType.GuildText, parent: devCat.id });
      await guild.channels.create({ name: 'bug-reports', type: ChannelType.GuildText, parent: devCat.id });
      await guild.channels.create({ name: 'showcase', type: ChannelType.GuildText, parent: devCat.id });
      createdSummary.push('Category: 💻 ENGINEERING (#dev-chat, #code-reviews, #bug-reports, #showcase)');

      // 5. Voice Category
      const voiceCat = await guild.channels.create({ name: '🔊 VOICE', type: ChannelType.GuildCategory });
      await guild.channels.create({ name: 'Dev Huddle', type: ChannelType.GuildVoice, parent: voiceCat.id });
      await guild.channels.create({ name: 'General Voice', type: ChannelType.GuildVoice, parent: voiceCat.id });
      createdSummary.push('Category: 🔊 VOICE (Dev Huddle, General Voice)');

    } else {
      // General Community / Default Template
      const infoCat = await guild.channels.create({ name: '📌 WELCOME & RULES', type: ChannelType.GuildCategory });
      const rulesChan = await guild.channels.create({ name: 'rules', type: ChannelType.GuildText, parent: infoCat.id });
      await guild.channels.create({ name: 'announcements', type: ChannelType.GuildText, parent: infoCat.id });

      const commCat = await guild.channels.create({ name: '💬 CHAT', type: ChannelType.GuildCategory });
      await guild.channels.create({ name: 'general', type: ChannelType.GuildText, parent: commCat.id });
      await guild.channels.create({ name: 'media', type: ChannelType.GuildText, parent: commCat.id });

      const voiceCat = await guild.channels.create({ name: '🔊 VOICE LOUNGE', type: ChannelType.GuildCategory });
      await guild.channels.create({ name: 'Lobby', type: ChannelType.GuildVoice, parent: voiceCat.id });

      createdSummary.push(`Applied template "${preset}" with standard community categories and channels.`);
    }

    return {
      success: true,
      message: `Server "${guild.name}" scaffolded with "${preset}" template.`,
      details: createdSummary,
    };
  },
};

export const configureAutoRoleTool: ToolDefinition = {
  name: 'configure_discord_automations',
  description: 'Configure automated welcome messages and auto-role assignment for new members joining the server.',
  parameters: {
    type: 'OBJECT',
    properties: {
      autoRoleName: {
        type: 'STRING',
        description: 'Role name to automatically assign to new members (e.g. "Member").',
      },
      welcomeChannelName: {
        type: 'STRING',
        description: 'Channel to send welcome greetings into (e.g. "general" or "welcome").',
      },
      welcomeMessage: {
        type: 'STRING',
        description: 'Custom welcome greeting template (use {user} and {server} placeholders).',
      },
    },
  },
  async execute(args: { autoRoleName?: string; welcomeChannelName?: string; welcomeMessage?: string }, ctx: ToolContext) {
    const profile = await ctx.store.getUserProfile('discord_config');
    profile.preferences.autoRoleName = args.autoRoleName || profile.preferences.autoRoleName || 'Member';
    profile.preferences.welcomeChannelName = args.welcomeChannelName || profile.preferences.welcomeChannelName || 'general';
    profile.preferences.welcomeMessage = args.welcomeMessage || profile.preferences.welcomeMessage || 'Welcome {user} to {server}! Check out the rules to get started.';

    await ctx.store.addProfileNote('discord_config', `Updated Discord automations: autoRole=${profile.preferences.autoRoleName}, welcomeChannel=${profile.preferences.welcomeChannelName}`);

    return {
      success: true,
      message: `Discord automations configured: auto-role "${profile.preferences.autoRoleName}", welcome channel #${profile.preferences.welcomeChannelName}.`,
      config: profile.preferences,
    };
  },
};
