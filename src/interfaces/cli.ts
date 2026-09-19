import readline from 'readline/promises';
import chalk from 'chalk';
import { JarvisOrchestrator } from '../core/orchestrator.ts';
import { settings } from '../config/settings.ts';

export async function runCli(orchestrator: JarvisOrchestrator) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.cyan.bold(`
=====================================================
                 J.A.R.V.I.S. v2.0
        Personal AI Orchestrator Online
=====================================================
`));

  console.log(chalk.gray(`Platform: CLI | User ID: ${settings.defaultUserId}`));
  console.log(chalk.gray(`Memory Store: ${settings.dataPath}`));
  console.log(chalk.gray(`Neural Engine: ${settings.geminiApiKey ? 'Gemini 2.5 Flash' : 'Offline / Mock'}`));
  console.log(chalk.yellow(`Commands: /tasks, /reminders, /clear, /exit\n`));

  try {
    while (true) {
      const input = await rl.question(chalk.green.bold('You > '));
      const trimmed = input.trim();

      if (!trimmed) continue;

      if (trimmed === '/exit' || trimmed === 'exit') {
        console.log(chalk.cyan('JARVIS: Powering down. Standing by.'));
        break;
      }

      if (trimmed === '/tasks') {
        const tasks = await orchestrator.getStore().listTasks();
        if (tasks.length === 0) {
          console.log(chalk.cyan('JARVIS: No pending tasks registered. Clean slate.'));
        } else {
          console.log(chalk.cyan(`JARVIS: Current task registry (${tasks.length} items):`));
          for (const t of tasks) {
            const statusColor = t.status === 'completed' ? chalk.green : chalk.yellow;
            console.log(`  • [${t.id}] ${chalk.bold(t.title)} - ${statusColor(t.status)} [Priority: ${t.priority}]`);
          }
        }
        continue;
      }

      if (trimmed === '/reminders') {
        const reminders = await orchestrator.getStore().listPendingReminders();
        if (reminders.length === 0) {
          console.log(chalk.cyan('JARVIS: No pending reminders scheduled.'));
        } else {
          console.log(chalk.cyan(`JARVIS: Scheduled reminders (${reminders.length} items):`));
          for (const r of reminders) {
            console.log(`  • [${r.triggerAt}] ${r.text}`);
          }
        }
        continue;
      }

      if (trimmed === '/clear') {
        console.clear();
        continue;
      }

      // Dispatch to orchestrator
      process.stdout.write(chalk.gray('JARVIS is thinking... '));
      try {
        const result = await orchestrator.dispatch({
          platform: 'cli',
          userId: settings.defaultUserId,
          userMessage: trimmed,
        });

        // Clear the thinking line
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);

        if (result.toolsUsed.length > 0) {
          console.log(chalk.dim(`[Actions executed: ${result.toolsUsed.join(', ')}]`));
        }

        console.log(chalk.cyan.bold('JARVIS > ') + result.reply + '\n');
      } catch (err: any) {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        console.log(chalk.red(`Error: ${err.message}\n`));
      }
    }
  } finally {
    rl.close();
  }
}
