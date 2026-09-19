import { JarvisOrchestrator } from './core/orchestrator.ts';
import { runCli } from './interfaces/cli.ts';
import { runTelegramBot } from './interfaces/telegram.ts';
import { runDiscordBot } from './interfaces/discord.ts';
import { runWebServer } from './interfaces/web.ts';
import { settings } from './config/settings.ts';

async function main() {
  const args = process.argv.slice(2);
  const isWeb = args.includes('--web') || args.includes('--all');
  const isCli = args.includes('--cli') || (args.length === 0 && !args.includes('--web'));
  const isTelegram = args.includes('--telegram') || args.includes('--all');
  const isDiscord = args.includes('--discord') || args.includes('--all');

  const orchestrator = new JarvisOrchestrator(settings.dataPath);
  await orchestrator.init();

  if (isWeb) {
    await runWebServer(orchestrator, settings.port);
  }

  if (isTelegram) {
    await runTelegramBot(orchestrator);
  }

  if (isDiscord) {
    await runDiscordBot(orchestrator);
  }

  if (isCli) {
    await runCli(orchestrator);
  }
}

main().catch((err) => {
  console.error('[JARVIS] Fatal initialization failure:', err);
  process.exit(1);
});
