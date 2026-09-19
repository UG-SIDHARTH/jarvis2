import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { JarvisOrchestrator } from '../core/orchestrator.ts';
import { testWebsiteTool } from '../tools/web_tester.ts';
import { setupServerTemplateTool } from '../tools/discord_manager.ts';
import { settings, saveSettingsToEnv } from '../config/settings.ts';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export async function runWebServer(orchestrator: JarvisOrchestrator, port = 3001): Promise<http.Server> {
  const publicDir = path.resolve('./public');

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Helper to send JSON
    const sendJson = (statusCode: number, data: any) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // Helper to parse JSON body
    const parseBody = async (): Promise<any> => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', reject);
      });
    };

    try {
      // --- API ENDPOINTS ---
      if (pathname === '/api/tasks' && req.method === 'GET') {
        const tasks = await orchestrator.getStore().listTasks();
        sendJson(200, { success: true, tasks });
        return;
      }

      if (pathname === '/api/tasks' && req.method === 'POST') {
        const body = await parseBody();
        const task = await orchestrator.getStore().addTask({
          title: body.title || 'Untitled Task',
          description: body.description,
          priority: body.priority || 'medium',
          dueDate: body.dueDate,
          platform: 'web',
          userId: 'web_user',
        });
        sendJson(201, { success: true, task });
        return;
      }

      if (pathname.startsWith('/api/tasks/') && pathname.endsWith('/toggle') && req.method === 'POST') {
        const taskId = pathname.split('/')[3];
        const tasks = await orchestrator.getStore().listTasks();
        const current = tasks.find((t) => t.id === taskId);
        if (!current) {
          sendJson(404, { success: false, error: 'Task not found' });
          return;
        }
        const newStatus = current.status === 'completed' ? 'pending' : 'completed';
        const updated = await orchestrator.getStore().updateTask(taskId, { status: newStatus });
        sendJson(200, { success: true, task: updated });
        return;
      }

      if (pathname === '/api/reminders' && req.method === 'GET') {
        const reminders = await orchestrator.getStore().listPendingReminders();
        sendJson(200, { success: true, reminders });
        return;
      }

      if (pathname === '/api/mood' && req.method === 'GET') {
        sendJson(200, { success: true, mood: orchestrator.getMood() });
        return;
      }

      if (pathname === '/api/mood' && req.method === 'POST') {
        const body = await parseBody();
        if (body.mood) {
          orchestrator.setMood(body.mood);
        }
        sendJson(200, { success: true, mood: orchestrator.getMood() });
        return;
      }

      if (pathname === '/api/chat' && req.method === 'POST') {
        const body = await parseBody();
        const prompt = body.message || '';
        if (!prompt) {
          sendJson(400, { success: false, error: 'Message cannot be empty.' });
          return;
        }
        const result = await orchestrator.dispatch({
          platform: 'web',
          userId: 'web_user',
          userMessage: prompt,
          mood: body.mood,
        });
        sendJson(200, { success: true, reply: result.reply, toolsUsed: result.toolsUsed, mood: result.mood });
        return;
      }

      if (pathname === '/api/test-website' && req.method === 'POST') {
        const body = await parseBody();
        const targetUrl = body.url;
        if (!targetUrl) {
          sendJson(400, { success: false, error: 'URL is required.' });
          return;
        }
        const toolCtx = {
          platform: 'web' as const,
          userId: 'web_user',
          store: orchestrator.getStore(),
        };
        const result = await testWebsiteTool.execute({ url: targetUrl }, toolCtx);
        sendJson(200, result);
        return;
      }

      if (pathname === '/api/discord/template' && req.method === 'POST') {
        const body = await parseBody();
        const template = body.template || 'developer';
        const toolCtx = {
          platform: 'web' as const,
          userId: 'web_user',
          store: orchestrator.getStore(),
          discordClient: orchestrator.getDiscordClient(),
        };
        const result = await setupServerTemplateTool.execute({ template }, toolCtx);
        sendJson(200, result);
        return;
      }

      if (pathname === '/api/config' && req.method === 'GET') {
        const maskKey = (k?: string) => (k && k.length > 8 ? `${k.substring(0, 4)}...${k.substring(k.length - 4)}` : (k ? '••••••••' : ''));
        sendJson(200, {
          success: true,
          activeProvider: settings.activeProvider,
          hasGroq: Boolean(settings.groqApiKey),
          hasGemini: Boolean(settings.geminiApiKey),
          hasNvidia: Boolean(settings.nvidiaApiKey),
          hasDiscord: Boolean(settings.discordBotToken),
          hasTelegram: Boolean(settings.telegramBotToken),
          groqKeyMasked: maskKey(settings.groqApiKey),
          geminiKeyMasked: maskKey(settings.geminiApiKey),
          nvidiaKeyMasked: maskKey(settings.nvidiaApiKey),
          discordTokenMasked: maskKey(settings.discordBotToken),
          telegramTokenMasked: maskKey(settings.telegramBotToken),
        });
        return;
      }

      if (pathname === '/api/config' && req.method === 'POST') {
        const body = await parseBody();
        const updates: any = {};
        if (body.groqApiKey !== undefined && body.groqApiKey !== '') updates.groqApiKey = body.groqApiKey;
        if (body.geminiApiKey !== undefined && body.geminiApiKey !== '') updates.geminiApiKey = body.geminiApiKey;
        if (body.nvidiaApiKey !== undefined && body.nvidiaApiKey !== '') updates.nvidiaApiKey = body.nvidiaApiKey;
        if (body.activeProvider !== undefined) updates.activeProvider = body.activeProvider;
        if (body.discordBotToken !== undefined && body.discordBotToken !== '') updates.discordBotToken = body.discordBotToken;
        if (body.telegramBotToken !== undefined && body.telegramBotToken !== '') updates.telegramBotToken = body.telegramBotToken;

        await saveSettingsToEnv(updates);
        sendJson(200, { success: true, message: 'Settings successfully updated and saved.' });
        return;
      }

      if (pathname === '/api/bots/status' && req.method === 'GET') {
        const discordClient = orchestrator.getDiscordClient();
        sendJson(200, {
          success: true,
          discord: {
            configured: Boolean(settings.discordBotToken),
            connected: Boolean(discordClient?.isReady?.()),
            tag: discordClient?.user?.tag || null,
          },
          telegram: {
            configured: Boolean(settings.telegramBotToken),
            connected: Boolean(settings.telegramBotToken),
          },
        });
        return;
      }

      // --- STATIC FILE SERVING ---
      let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

      // Prevent directory traversal
      if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = await fs.readFile(filePath);

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      }
    } catch (err: any) {
      sendJson(500, { success: false, error: err.message });
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[Web Dashboard] JARVIS Web Interface active at http://localhost:${port}`);
      resolve(server);
    });
  });
}
