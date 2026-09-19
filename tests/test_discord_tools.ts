import { MemoryStore } from '../src/db/store.ts';
import { executeToolCall, allTools } from '../src/tools/index.ts';
import type { ToolContext } from '../src/tools/types.ts';
import path from 'path';
import fs from 'fs/promises';

async function runDiscordToolTests() {
  console.log('--- Starting JARVIS Discord Management Tools Verification ---');

  // 1. Verify Registration
  const expectedTools = [
    'create_discord_channel',
    'create_discord_role',
    'post_discord_embed',
    'setup_server_template',
    'configure_discord_automations',
  ];

  for (const name of expectedTools) {
    const found = allTools.find((t) => t.name === name);
    if (!found) {
      throw new Error(`Expected tool "${name}" not found in allTools!`);
    }
    console.log(`✔ Tool registered: ${name}`);
  }

  const testDbPath = path.resolve('./data/test_discord_store.json');
  try {
    await fs.unlink(testDbPath);
  } catch {}

  const store = new MemoryStore(testDbPath);
  await store.init();

  // 2. Test Execution without Client (Should return clear error)
  const emptyContext: ToolContext = {
    platform: 'cli',
    userId: 'test_user',
    store,
  };

  const offlineRes = await executeToolCall('create_discord_channel', { name: 'test-chan' }, emptyContext);
  if (offlineRes.success || !offlineRes.error?.includes('Discord client is not currently connected')) {
    throw new Error(`Expected offline error, got: ${JSON.stringify(offlineRes)}`);
  }
  console.log('✔ Clean offline detection verified when Discord client is disconnected.');

  // 3. Mock Discord Client & Guild
  const createdChannels: any[] = [];
  const createdRoles: any[] = [];
  const postedMessages: any[] = [];

  const mockChannel = {
    id: 'chan_rules_123',
    name: 'rules',
    isTextBased: () => true,
    send: async (payload: any) => {
      postedMessages.push(payload);
      return { id: 'msg_123' };
    },
  };

  const mockGuild = {
    id: 'guild_456',
    name: 'Stark Industries Dev Hub',
    channels: {
      cache: {
        get: (id: string) => (id === 'chan_rules_123' ? mockChannel : null),
        find: (predicate: any) => {
          if (predicate(mockChannel)) return mockChannel;
          return createdChannels.find(predicate);
        },
      },
      create: async (opts: any) => {
        const chan = {
          id: `chan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: opts.name,
          type: opts.type,
          parent: opts.parent,
          topic: opts.topic,
          isTextBased: () => opts.type !== 2 && opts.type !== 4, // not voice or category
          send: async (p: any) => {
            postedMessages.push(p);
            return { id: 'msg_456' };
          },
        };
        createdChannels.push(chan);
        return chan;
      },
    },
    roles: {
      create: async (opts: any) => {
        const role = {
          id: `role_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: opts.name,
          color: opts.color,
          hoist: opts.hoist,
        };
        createdRoles.push(role);
        return role;
      },
    },
  };

  const mockClient = {
    guilds: {
      cache: {
        get: (id: string) => (id === 'guild_456' ? mockGuild : null),
        first: () => mockGuild,
      },
    },
  };

  const mockContext: ToolContext = {
    platform: 'discord',
    userId: 'dc_owner',
    store,
    discordClient: mockClient,
    guildId: 'guild_456',
  };

  // 4. Test Single Channel Creation
  const createChanRes = await executeToolCall('create_discord_channel', {
    name: 'announcements',
    type: 'announcement',
    categoryName: '📢 INFORMATION',
  }, mockContext);

  if (!createChanRes.success) {
    throw new Error(`create_discord_channel failed: ${createChanRes.error}`);
  }
  console.log(`✔ Channel created on mock guild: ${createChanRes.message}`);

  // 5. Test Embed Posting (Rules)
  const embedRes = await executeToolCall('post_discord_embed', {
    channelName: 'rules',
    title: 'Server Rules',
    description: '1. Be respectful\n2. No spam',
    color: '#00FFCC',
  }, mockContext);

  if (!embedRes.success || postedMessages.length === 0) {
    throw new Error(`post_discord_embed failed: ${embedRes.error}`);
  }
  console.log(`✔ Embed successfully posted to #rules on mock guild.`);

  // 6. Test Full Server Template Scaffolding
  const templateRes = await executeToolCall('setup_server_template', {
    template: 'developer',
  }, mockContext);

  if (!templateRes.success || createdChannels.length < 5 || createdRoles.length < 4) {
    throw new Error(`setup_server_template failed: ${JSON.stringify(templateRes)}`);
  }
  console.log(`✔ Full server template scaffolded: ${templateRes.details.length} components created.`);

  // 7. Test Automation Configuration
  const autoRes = await executeToolCall('configure_discord_automations', {
    autoRoleName: 'Developer',
    welcomeChannelName: 'general',
    welcomeMessage: 'Welcome to Stark Industries {user}!',
  }, mockContext);

  if (!autoRes.success || autoRes.config.autoRoleName !== 'Developer') {
    throw new Error(`configure_discord_automations failed: ${JSON.stringify(autoRes)}`);
  }
  console.log(`✔ Auto-role & welcome automations configured and persisted.`);

  // Cleanup test DB
  try {
    await fs.unlink(testDbPath);
  } catch {}

  console.log('\nAll 7 Discord server customization test suites passed successfully!');
}

runDiscordToolTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
