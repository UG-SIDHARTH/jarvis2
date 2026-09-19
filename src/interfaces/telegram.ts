import { Bot } from 'grammy';
import { JarvisOrchestrator } from '../core/orchestrator.ts';
import { settings } from '../config/settings.ts';

export async function runTelegramBot(orchestrator: JarvisOrchestrator): Promise<Bot | null> {
  if (!settings.telegramBotToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not provided in .env. Skipping Telegram bot.');
    return null;
  }

  const bot = new Bot(settings.telegramBotToken);

  bot.command('start', async (ctx) => {
    await ctx.reply("JARVIS online. Standing by for instructions.");
  });

  bot.command('tasks', async (ctx) => {
    const userId = ctx.from?.id ? `tg_${ctx.from.id}` : settings.defaultUserId;
    const tasks = await orchestrator.getStore().listTasks({ userId });
    if (tasks.length === 0) {
      await ctx.reply("No pending tasks on file.");
      return;
    }
    const lines = tasks.map((t) => `• [${t.priority.toUpperCase()}] ${t.title} (${t.status})`);
    await ctx.reply(`Active tasks:\n${lines.join('\n')}`);
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from?.id ? `tg_${ctx.from.id}` : settings.defaultUserId;

    try {
      await ctx.replyWithChatAction('typing');
      const result = await orchestrator.dispatch({
        platform: 'telegram',
        userId,
        userMessage: text,
      });

      await ctx.reply(result.reply);
    } catch (error: any) {
      console.error('[Telegram] Error handling message:', error);
      await ctx.reply("Encountered a processing anomaly. Please retry.");
    }
  });

  console.log('[Telegram] Starting polling...');
  bot.start();
  return bot;
}
