import type { MemoryStore } from '../db/store.ts';

export interface ToolContext {
  platform: 'cli' | 'telegram' | 'discord' | 'web';
  userId: string;
  store: MemoryStore;
  discordClient?: any;
  guildId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any, context: ToolContext) => Promise<any>;
}
