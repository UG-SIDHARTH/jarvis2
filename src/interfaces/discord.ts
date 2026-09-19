import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { JarvisOrchestrator } from '../core/orchestrator.ts';
import { settings } from '../config/settings.ts';

export async function runDiscordBot(orchestrator: JarvisOrchestrator): Promise<Client | null> {
  if (!settings.discordBotToken) {
    console.warn('[Discord] DISCORD_BOT_TOKEN not provided in .env. Skipping Discord bot.');
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
  });

  // Provide client instance to orchestrator so tools can execute Discord actions
  orchestrator.setDiscordClient(client);

  client.once('clientReady', (c) => {
    console.log(`[Discord] Logged in as ${c.user.tag}. Ready.`);
  });

  // Member Join Automation (Welcome greeting & Auto-Role)
  client.on('guildMemberAdd', async (member) => {
    try {
      const configProfile = await orchestrator.getStore().getUserProfile('discord_config');
      const prefs = configProfile.preferences || {};

      // Auto-assign default role if configured
      if (prefs.autoRoleName) {
        const role = member.guild.roles.cache.find(
          (r) => r.name.toLowerCase() === prefs.autoRoleName.toLowerCase()
        );
        if (role) {
          await member.roles.add(role);
          console.log(`[Discord] Auto-assigned role "${role.name}" to new member ${member.user.tag}`);
        }
      }

      // Send welcome message if configured
      if (prefs.welcomeChannelName) {
        const welcomeChannel = member.guild.channels.cache.find(
          (c: any) => c.isTextBased() && c.name.toLowerCase() === prefs.welcomeChannelName.toLowerCase().replace(/^#/, '')
        );

        if (welcomeChannel && welcomeChannel.isTextBased()) {
          const rawMsg = prefs.welcomeMessage || 'Welcome {user} to **{server}**! Read the rules and enjoy your stay.';
          const formatted = rawMsg
            .replace('{user}', `<@${member.id}>`)
            .replace('{server}', member.guild.name);
          await welcomeChannel.send(formatted);
        }
      }
    } catch (err: any) {
      console.error('[Discord] Error in guildMemberAdd automation:', err);
    }
  });

  client.on('messageCreate', async (message) => {
    // Ignore bot's own messages
    if (message.author.bot) return;

    // Check if the message is a DM or mentions the bot
    const isDM = !message.guild;
    const isMentioned = client.user ? message.mentions.has(client.user) : false;

    if (!isDM && !isMentioned) return;

    // Strip mention from text
    let cleanContent = message.content;
    if (client.user) {
      cleanContent = cleanContent.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    }

    if (!cleanContent) return;

    const userId = `dc_${message.author.id}`;

    try {
      // Show typing indicator
      await message.channel.sendTyping();

      const result = await orchestrator.dispatch({
        platform: 'discord',
        userId,
        userMessage: cleanContent,
        guildId: message.guild?.id,
      });

      // Split into chunks if exceeds Discord 2000 character limit
      if (result.reply.length > 1950) {
        const chunks = result.reply.match(/[\s\S]{1,1950}/g) || [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(result.reply);
      }
    } catch (err: any) {
      console.error('[Discord] Error processing message:', err);
      await message.reply("Encountered an internal error processing your request.");
    }
  });

  await client.login(settings.discordBotToken);
  return client;
}
