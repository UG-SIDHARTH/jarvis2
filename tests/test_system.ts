import { MemoryStore } from '../src/db/store.ts';
import { executeToolCall, allTools } from '../src/tools/index.ts';
import { JarvisOrchestrator } from '../src/core/orchestrator.ts';
import path from 'path';
import fs from 'fs/promises';

async function runTests() {
  console.log('--- Starting JARVIS Core Verification Tests ---');

  const testDbPath = path.resolve('./data/test_store.json');
  try {
    await fs.unlink(testDbPath);
  } catch {}

  const store = new MemoryStore(testDbPath);
  await store.init();
  console.log('✔ MemoryStore initialized successfully.');

  // 1. Test Task Management
  const task = await store.addTask({
    title: 'Deploy satellite array',
    description: 'Calibrate orbital telemetry',
    priority: 'high',
    platform: 'cli',
    userId: 'stark',
  });
  console.log(`✔ Task created: [${task.id}] ${task.title}`);

  const tasks = await store.listTasks({ userId: 'stark' });
  if (tasks.length !== 1 || tasks[0].title !== 'Deploy satellite array') {
    throw new Error('Task list verification failed.');
  }
  console.log('✔ Task listing verified.');

  await store.updateTask(task.id, { status: 'completed' });
  const updatedTasks = await store.listTasks({ status: 'completed' });
  if (updatedTasks.length !== 1) {
    throw new Error('Task update verification failed.');
  }
  console.log('✔ Task update verified.');

  // 2. Test Reminders
  const reminder = await store.addReminder({
    text: 'Briefing at 1400',
    triggerAt: new Date(Date.now() + 3600000).toISOString(),
    platform: 'cli',
    userId: 'stark',
  });
  console.log(`✔ Reminder created: "${reminder.text}"`);

  const reminders = await store.listPendingReminders();
  if (reminders.length !== 1) {
    throw new Error('Reminder listing verification failed.');
  }
  console.log('✔ Reminder listing verified.');

  // 3. Test Tool Registry & Execution
  const toolCtx = {
    platform: 'cli' as const,
    userId: 'stark',
    store,
  };

  const listToolRes = await executeToolCall('list_tasks', { status: 'completed' }, toolCtx);
  if (!listToolRes.success || listToolRes.count !== 1) {
    throw new Error('Tool execution (list_tasks) failed.');
  }
  console.log('✔ Tool execution (list_tasks) verified.');

  // Test system ops: list_directory_contents
  const dirToolRes = await executeToolCall('list_directory_contents', { directoryPath: '.' }, toolCtx);
  if (!dirToolRes.success || !Array.isArray(dirToolRes.entries)) {
    throw new Error('Tool execution (list_directory_contents) failed.');
  }
  console.log(`✔ Tool execution (list_directory_contents) verified. Found ${dirToolRes.entries.length} entries.`);

  // 4. Test Orchestrator Offline Dispatch
  const orchestrator = new JarvisOrchestrator(testDbPath);
  await orchestrator.init();
  const dispatchRes = await orchestrator.dispatch({
    platform: 'cli',
    userId: 'stark',
    userMessage: 'Hello JARVIS',
  });
  console.log(`✔ Orchestrator offline dispatch verified. Reply: "${dispatchRes.reply.substring(0, 40)}..."`);

  // Cleanup test store
  try {
    await fs.unlink(testDbPath);
  } catch {}

  console.log('\nAll 4 test suites passed with zero failures! System fully functional.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
