import type { ToolDefinition, ToolContext } from './types.ts';

export const createReminderTool: ToolDefinition = {
  name: 'create_reminder',
  description: 'Create a scheduled reminder for a specific ISO time or future timestamp.',
  parameters: {
    type: 'OBJECT',
    properties: {
      text: {
        type: 'STRING',
        description: 'What to remind the user about.',
      },
      triggerAt: {
        type: 'STRING',
        description: 'ISO 8601 timestamp when the reminder should fire (e.g. 2026-09-19T20:30:00.000Z).',
      },
    },
    required: ['text', 'triggerAt'],
  },
  async execute(args: { text: string; triggerAt: string }, ctx: ToolContext) {
    const reminder = await ctx.store.addReminder({
      text: args.text,
      triggerAt: args.triggerAt,
      platform: ctx.platform,
      userId: ctx.userId,
    });

    return {
      success: true,
      message: `Reminder scheduled for ${reminder.triggerAt}: "${reminder.text}"`,
      reminder,
    };
  },
};

export const listRemindersTool: ToolDefinition = {
  name: 'list_reminders',
  description: 'List all pending reminders for the user.',
  parameters: {
    type: 'OBJECT',
    properties: {},
  },
  async execute(_args: any, ctx: ToolContext) {
    const reminders = await ctx.store.listPendingReminders();
    return {
      success: true,
      count: reminders.length,
      reminders,
    };
  },
};
