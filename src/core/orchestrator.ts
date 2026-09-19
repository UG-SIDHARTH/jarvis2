import { MemoryStore, type ChatMessage } from '../db/store.ts';
import { JarvisLLM } from './llm.ts';
import type { ToolContext } from '../tools/types.ts';
import type { JarvisMood } from '../config/prompts.ts';

export interface DispatchOptions {
  platform: 'cli' | 'telegram' | 'discord' | 'web';
  userId: string;
  userMessage: string;
  guildId?: string;
  mood?: JarvisMood;
}

export interface DispatchResult {
  reply: string;
  toolsUsed: string[];
  mood: JarvisMood;
}

export class JarvisOrchestrator {
  private store: MemoryStore;
  private llm: JarvisLLM;
  private discordClient?: any;
  private currentMood: JarvisMood = 'calm';

  constructor(storePath?: string) {
    this.store = new MemoryStore(storePath);
    this.llm = new JarvisLLM();
  }

  async init(): Promise<void> {
    await this.store.init();
  }

  getStore(): MemoryStore {
    return this.store;
  }

  setDiscordClient(client: any): void {
    this.discordClient = client;
  }

  getDiscordClient(): any {
    return this.discordClient;
  }

  getMood(): JarvisMood {
    return this.currentMood;
  }

  setMood(mood: JarvisMood): void {
    this.currentMood = mood;
  }

  async dispatch(options: DispatchOptions): Promise<DispatchResult> {
    const { platform, userId, userMessage, mood } = options;

    if (mood) {
      this.currentMood = mood;
    }

    // 1. Record incoming user message into cross-platform memory
    await this.store.recordMessage({
      platform,
      userId,
      role: 'user',
      content: userMessage,
    });

    // 2. Fetch recent conversation context across platforms for this user
    const recentMessages = await this.store.getRecentMessages(10, userId);
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = recentMessages
      .slice(0, -1) // Exclude the message we just added
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    // 3. Prepare execution context for tools
    const toolContext: ToolContext = {
      platform,
      userId,
      store: this.store,
      discordClient: this.discordClient,
      guildId: options.guildId,
    };

    // 4. Process turn with LLM and tool calling
    const result = await this.llm.processTurn(
      userPromptWithPlatformHint(userMessage, platform),
      history,
      toolContext,
      this.currentMood
    );

    // 5. Record assistant response in memory
    await this.store.recordMessage({
      platform,
      userId,
      role: 'assistant',
      content: result.text,
    });

    return {
      reply: result.text,
      toolsUsed: result.toolCallsExecuted.map((t) => t.name),
      mood: result.mood,
    };
  }
}

function userPromptWithPlatformHint(message: string, platform: string): string {
  // Inject platform hint so the LLM respects platform constraints
  return `[Platform: ${platform.toUpperCase()}]\n${message}`;
}
