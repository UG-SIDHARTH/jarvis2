import type { ToolDefinition, ToolContext } from './types.ts';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export const runCommandTool: ToolDefinition = {
  name: 'run_system_command',
  description: 'Execute a shell command or script locally and return its stdout/stderr.',
  parameters: {
    type: 'OBJECT',
    properties: {
      command: {
        type: 'STRING',
        description: 'The command line to run.',
      },
      workingDirectory: {
        type: 'STRING',
        description: 'Optional working directory (defaults to current project root).',
      },
    },
    required: ['command'],
  },
  async execute(args: { command: string; workingDirectory?: string }, _ctx: ToolContext) {
    try {
      const cwd = args.workingDirectory ? path.resolve(args.workingDirectory) : process.cwd();
      const { stdout, stderr } = await execAsync(args.command, {
        cwd,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout?.trim(),
        stderr: error.stderr?.trim(),
      };
    }
  },
};

export const readFileTool: ToolDefinition = {
  name: 'read_local_file',
  description: 'Read the text content of a file on the local filesystem.',
  parameters: {
    type: 'OBJECT',
    properties: {
      filePath: {
        type: 'STRING',
        description: 'Relative or absolute path to the file.',
      },
    },
    required: ['filePath'],
  },
  async execute(args: { filePath: string }, _ctx: ToolContext) {
    try {
      const resolved = path.resolve(args.filePath);
      const content = await fs.readFile(resolved, 'utf-8');
      return {
        success: true,
        path: resolved,
        content,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

export const writeFileTool: ToolDefinition = {
  name: 'write_local_file',
  description: 'Create or overwrite a file with specific content on the local filesystem.',
  parameters: {
    type: 'OBJECT',
    properties: {
      filePath: {
        type: 'STRING',
        description: 'Path of the file to create or overwrite.',
      },
      content: {
        type: 'STRING',
        description: 'Full text content to write.',
      },
    },
    required: ['filePath', 'content'],
  },
  async execute(args: { filePath: string; content: string }, _ctx: ToolContext) {
    try {
      const resolved = path.resolve(args.filePath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, args.content, 'utf-8');
      return {
        success: true,
        path: resolved,
        message: `File successfully written to ${resolved}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

export const listDirectoryTool: ToolDefinition = {
  name: 'list_directory_contents',
  description: 'List files and directories in a given path.',
  parameters: {
    type: 'OBJECT',
    properties: {
      directoryPath: {
        type: 'STRING',
        description: 'Directory path to list (defaults to current working directory).',
      },
    },
  },
  async execute(args: { directoryPath?: string }, _ctx: ToolContext) {
    try {
      const target = args.directoryPath ? path.resolve(args.directoryPath) : process.cwd();
      const entries = await fs.readdir(target, { withFileTypes: true });
      return {
        success: true,
        path: target,
        entries: entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          isFile: e.isFile(),
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};
