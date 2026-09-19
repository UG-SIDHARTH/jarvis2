import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load .env if present
dotenv.config();

export interface Settings {
  geminiApiKey: string;
  groqApiKey: string;
  nvidiaApiKey: string;
  activeProvider: 'groq' | 'gemini' | 'nvidia' | 'auto';
  telegramBotToken?: string;
  discordBotToken?: string;
  discordClientId?: string;
  dataPath: string;
  defaultUserId: string;
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const settings: Settings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  activeProvider: (process.env.ACTIVE_PROVIDER as Settings['activeProvider']) || 'auto',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
  dataPath: process.env.DATA_PATH || path.resolve('./data/jarvis_store.json'),
  defaultUserId: process.env.DEFAULT_USER_ID || 'primary_user',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  logLevel: (process.env.LOG_LEVEL as Settings['logLevel']) || 'info',
};

export async function saveSettingsToEnv(newSettings: Partial<Settings>): Promise<void> {
  Object.assign(settings, newSettings);

  const envPath = path.resolve('.env');
  let currentEnv = '';
  try {
    currentEnv = await fs.readFile(envPath, 'utf-8');
  } catch {
    // If .env doesn't exist, start fresh
  }

  const lines = currentEnv.split('\n');
  const updates: Record<string, string> = {
    GEMINI_API_KEY: settings.geminiApiKey,
    GROQ_API_KEY: settings.groqApiKey,
    NVIDIA_API_KEY: settings.nvidiaApiKey,
    ACTIVE_PROVIDER: settings.activeProvider,
    TELEGRAM_BOT_TOKEN: settings.telegramBotToken || '',
    DISCORD_BOT_TOKEN: settings.discordBotToken || '',
    DISCORD_CLIENT_ID: settings.discordClientId || '',
    DATA_PATH: settings.dataPath,
    DEFAULT_USER_ID: settings.defaultUserId,
  };

  const processedKeys = new Set<string>();
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      if (updates[key] !== undefined) {
        processedKeys.add(key);
        return `${key}=${updates[key]}`;
      }
    }
    return line;
  });

  // Append any keys that weren't in the original .env
  for (const [k, v] of Object.entries(updates)) {
    if (!processedKeys.has(k) && v) {
      newLines.push(`${k}=${v}`);
    }
  }

  await fs.writeFile(envPath, newLines.join('\n'), 'utf-8');
}
