import type { ToolDefinition, ToolContext } from './types.ts';
import { addTaskTool, listTasksTool, updateTaskTool } from './task_manager.ts';
import { createReminderTool, listRemindersTool } from './scheduler.ts';
import { runCommandTool, readFileTool, writeFileTool, listDirectoryTool } from './system_ops.ts';
import {
  createDiscordChannelTool,
  createDiscordRoleTool,
  postDiscordEmbedTool,
  setupServerTemplateTool,
  configureAutoRoleTool,
} from './discord_manager.ts';
import { testWebsiteTool } from './web_tester.ts';

export const allTools: ToolDefinition[] = [
  addTaskTool,
  listTasksTool,
  updateTaskTool,
  createReminderTool,
  listRemindersTool,
  runCommandTool,
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  createDiscordChannelTool,
  createDiscordRoleTool,
  postDiscordEmbedTool,
  setupServerTemplateTool,
  configureAutoRoleTool,
  testWebsiteTool,
];

export function getGeminiToolDeclarations() {
  return [
    {
      functionDeclarations: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

export async function executeToolCall(
  name: string,
  args: any,
  context: ToolContext
): Promise<any> {
  const tool = allTools.find((t) => t.name === name);
  if (!tool) {
    return {
      success: false,
      error: `Tool "${name}" is not recognized by JARVIS.`,
    };
  }

  try {
    return await tool.execute(args, context);
  } catch (err: any) {
    return {
      success: false,
      error: `Execution error in "${name}": ${err.message}`,
    };
  }
}
