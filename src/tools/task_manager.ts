import type { ToolDefinition, ToolContext } from './types.ts';

export const addTaskTool: ToolDefinition = {
  name: 'add_task',
  description: 'Add a new task or to-do item to the task list with priority and optional deadline.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title: {
        type: 'STRING',
        description: 'Clear, actionable title of the task.',
      },
      description: {
        type: 'STRING',
        description: 'Optional additional details or context for the task.',
      },
      priority: {
        type: 'STRING',
        description: 'Priority level: low, medium, high, or urgent.',
      },
      dueDate: {
        type: 'STRING',
        description: 'Optional ISO timestamp or date string (e.g. 2026-09-20T17:00:00Z).',
      },
    },
    required: ['title'],
  },
  async execute(args: { title: string; description?: string; priority?: string; dueDate?: string }, ctx: ToolContext) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'] as const;
    const priority = validPriorities.includes(args.priority as any)
      ? (args.priority as (typeof validPriorities)[number])
      : 'medium';

    const task = await ctx.store.addTask({
      title: args.title,
      description: args.description,
      priority,
      dueDate: args.dueDate,
      platform: ctx.platform,
      userId: ctx.userId,
    });

    return {
      success: true,
      message: `Task created: "${task.title}" [Priority: ${task.priority}]`,
      task,
    };
  },
};

export const listTasksTool: ToolDefinition = {
  name: 'list_tasks',
  description: 'List current tasks, optionally filtering by status (pending, in_progress, completed, cancelled) or priority.',
  parameters: {
    type: 'OBJECT',
    properties: {
      status: {
        type: 'STRING',
        description: 'Filter by status: pending, in_progress, completed, cancelled, or all.',
      },
      priority: {
        type: 'STRING',
        description: 'Filter by priority: low, medium, high, urgent.',
      },
    },
  },
  async execute(args: { status?: string; priority?: string }, ctx: ToolContext) {
    const statusFilter = args.status && args.status !== 'all' ? (args.status as any) : undefined;
    const priorityFilter = args.priority as any;

    const tasks = await ctx.store.listTasks({
      status: statusFilter,
      priority: priorityFilter,
      userId: ctx.userId,
    });

    return {
      success: true,
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate || 'none',
        created: t.createdAt,
      })),
    };
  },
};

export const updateTaskTool: ToolDefinition = {
  name: 'update_task',
  description: 'Update a task status (pending, in_progress, completed, cancelled), priority, or title.',
  parameters: {
    type: 'OBJECT',
    properties: {
      taskId: {
        type: 'STRING',
        description: 'The ID of the task to update.',
      },
      status: {
        type: 'STRING',
        description: 'New status: pending, in_progress, completed, cancelled.',
      },
      priority: {
        type: 'STRING',
        description: 'New priority: low, medium, high, urgent.',
      },
      title: {
        type: 'STRING',
        description: 'Updated title of the task.',
      },
    },
    required: ['taskId'],
  },
  async execute(args: { taskId: string; status?: string; priority?: string; title?: string }, ctx: ToolContext) {
    const updates: Record<string, any> = {};
    if (args.status) updates.status = args.status;
    if (args.priority) updates.priority = args.priority;
    if (args.title) updates.title = args.title;

    const updated = await ctx.store.updateTask(args.taskId, updates);
    if (!updated) {
      return { success: false, error: `Task with ID ${args.taskId} not found.` };
    }

    return {
      success: true,
      message: `Task "${updated.title}" updated. Status: ${updated.status}`,
      task: updated,
    };
  },
};
