import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string;
  createdAt: string;
  platform: 'cli' | 'telegram' | 'discord' | 'web';
  userId: string;
}

export interface Reminder {
  id: string;
  text: string;
  triggerAt: string;
  platform: 'cli' | 'telegram' | 'discord' | 'web';
  userId: string;
  triggered: boolean;
}

export interface ChatMessage {
  id: string;
  platform: 'cli' | 'telegram' | 'discord' | 'web';
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  preferences: Record<string, any>;
  notes: string[];
}

export class SqliteDatabase {
  private db: DatabaseSync | null = null;
  private dbPath: string;
  private initialized = false;

  constructor(dbPath: string = './data/jarvis.db') {
    // If path was given as .json, convert to .db
    if (dbPath.endsWith('.json')) {
      this.dbPath = path.resolve(dbPath.replace(/\.json$/, '.db'));
    } else {
      this.dbPath = path.resolve(dbPath);
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    this.db = new DatabaseSync(this.dbPath);

    // Run schema
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
          status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
          due_date TEXT,
          created_at TEXT NOT NULL,
          platform TEXT NOT NULL,
          user_id TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority);

      CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          trigger_at TEXT NOT NULL,
          platform TEXT NOT NULL,
          user_id TEXT NOT NULL,
          triggered INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_trigger ON reminders (triggered, trigger_at);

      CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_user_time ON messages (user_id, timestamp);

      CREATE TABLE IF NOT EXISTS profiles (
          user_id TEXT PRIMARY KEY,
          name TEXT NOT NULL DEFAULT 'User',
          preferences TEXT NOT NULL DEFAULT '{}',
          notes TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS discord_configs (
          guild_id TEXT PRIMARY KEY,
          auto_role_name TEXT,
          welcome_channel_name TEXT,
          welcome_message TEXT,
          updated_at TEXT NOT NULL
      );
    `;

    this.db.exec(schemaSql);

    // Auto-migrate from JSON if present and SQLite is empty
    await this.checkAndMigrateFromJson();

    this.initialized = true;
  }

  private async checkAndMigrateFromJson(): Promise<void> {
    const jsonPath = this.dbPath.replace(/\.db$/, '_store.json');
    if (!fsSync.existsSync(jsonPath)) return;

    try {
      const taskCount = (this.db!.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
      if (taskCount > 0) return; // Already populated

      const content = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data.tasks)) {
        const stmt = this.db!.prepare(`
          INSERT OR IGNORE INTO tasks (id, title, description, priority, status, due_date, created_at, platform, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of data.tasks) {
          stmt.run(t.id, t.title, t.description || null, t.priority || 'medium', t.status || 'pending', t.dueDate || null, t.createdAt, t.platform || 'cli', t.userId || 'primary_user');
        }
      }

      if (Array.isArray(data.reminders)) {
        const stmt = this.db!.prepare(`
          INSERT OR IGNORE INTO reminders (id, text, trigger_at, platform, user_id, triggered)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const r of data.reminders) {
          stmt.run(r.id, r.text, r.triggerAt, r.platform || 'cli', r.userId || 'primary_user', r.triggered ? 1 : 0);
        }
      }

      if (Array.isArray(data.messages)) {
        const stmt = this.db!.prepare(`
          INSERT OR IGNORE INTO messages (id, platform, user_id, role, content, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const m of data.messages) {
          stmt.run(m.id, m.platform, m.userId, m.role, m.content, m.timestamp);
        }
      }

      if (data.profiles && typeof data.profiles === 'object') {
        const stmt = this.db!.prepare(`
          INSERT OR REPLACE INTO profiles (user_id, name, preferences, notes)
          VALUES (?, ?, ?, ?)
        `);
        for (const [userId, p] of Object.entries<any>(data.profiles)) {
          stmt.run(userId, p.name || 'User', JSON.stringify(p.preferences || {}), JSON.stringify(p.notes || []));
        }
      }
    } catch {
      // Non-fatal if migration cannot complete
    }
  }

  // --- Task Methods ---
  async addTask(task: Omit<Task, 'id' | 'createdAt' | 'status'> & { status?: Task['status'] }): Promise<Task> {
    await this.init();
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: task.status || 'pending',
      createdAt: new Date().toISOString(),
    };

    const stmt = this.db!.prepare(`
      INSERT INTO tasks (id, title, description, priority, status, due_date, created_at, platform, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newTask.id,
      newTask.title,
      newTask.description || null,
      newTask.priority,
      newTask.status,
      newTask.dueDate || null,
      newTask.createdAt,
      newTask.platform,
      newTask.userId
    );

    return newTask;
  }

  async listTasks(filter?: { status?: Task['status']; priority?: Task['priority']; userId?: string }): Promise<Task[]> {
    await this.init();
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.priority) {
      query += ' AND priority = ?';
      params.push(filter.priority);
    }
    if (filter?.userId) {
      query += ' AND user_id = ?';
      params.push(filter.userId);
    }

    query += ' ORDER BY created_at DESC';
    const rows = this.db!.prepare(query).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description || undefined,
      priority: r.priority,
      status: r.status,
      dueDate: r.due_date || undefined,
      createdAt: r.created_at,
      platform: r.platform,
      userId: r.user_id,
    }));
  }

  async updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | null> {
    await this.init();
    const current = this.db!.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!current) return null;

    const updatedTitle = updates.title !== undefined ? updates.title : current.title;
    const updatedDesc = updates.description !== undefined ? updates.description : current.description;
    const updatedPriority = updates.priority !== undefined ? updates.priority : current.priority;
    const updatedStatus = updates.status !== undefined ? updates.status : current.status;
    const updatedDueDate = updates.dueDate !== undefined ? updates.dueDate : current.due_date;

    this.db!.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, priority = ?, status = ?, due_date = ?
      WHERE id = ?
    `).run(updatedTitle, updatedDesc, updatedPriority, updatedStatus, updatedDueDate, id);

    return {
      id: current.id,
      title: updatedTitle,
      description: updatedDesc || undefined,
      priority: updatedPriority,
      status: updatedStatus,
      dueDate: updatedDueDate || undefined,
      createdAt: current.created_at,
      platform: current.platform,
      userId: current.user_id,
    };
  }

  async deleteTask(id: string): Promise<boolean> {
    await this.init();
    const res = this.db!.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Reminders ---
  async addReminder(reminder: Omit<Reminder, 'id' | 'triggered'>): Promise<Reminder> {
    await this.init();
    const newReminder: Reminder = {
      ...reminder,
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      triggered: false,
    };

    this.db!.prepare(`
      INSERT INTO reminders (id, text, trigger_at, platform, user_id, triggered)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(newReminder.id, newReminder.text, newReminder.triggerAt, newReminder.platform, newReminder.userId);

    return newReminder;
  }

  async listPendingReminders(): Promise<Reminder[]> {
    await this.init();
    const rows = this.db!.prepare('SELECT * FROM reminders WHERE triggered = 0 ORDER BY trigger_at ASC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      triggerAt: r.trigger_at,
      platform: r.platform,
      userId: r.user_id,
      triggered: Boolean(r.triggered),
    }));
  }

  async markReminderTriggered(id: string): Promise<void> {
    await this.init();
    this.db!.prepare('UPDATE reminders SET triggered = 1 WHERE id = ?').run(id);
  }

  // --- Chat Messages ---
  async recordMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    await this.init();
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    this.db!.prepare(`
      INSERT INTO messages (id, platform, user_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newMsg.id, newMsg.platform, newMsg.userId, newMsg.role, newMsg.content, newMsg.timestamp);

    return newMsg;
  }

  async getRecentMessages(limit = 15, userId?: string): Promise<ChatMessage[]> {
    await this.init();
    let query = 'SELECT * FROM messages';
    const params: any[] = [];

    if (userId) {
      query += ' WHERE user_id = ? OR user_id = ?';
      params.push(userId, 'all');
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db!.prepare(query).all(...params) as any[];
    return rows.reverse().map((r) => ({
      id: r.id,
      platform: r.platform,
      userId: r.user_id,
      role: r.role,
      content: r.content,
      timestamp: r.timestamp,
    }));
  }

  // --- Profiles ---
  async getUserProfile(userId: string): Promise<UserProfile> {
    await this.init();
    const row = this.db!.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as any;
    if (!row) {
      const defaultProfile: UserProfile = {
        userId,
        name: 'User',
        preferences: {},
        notes: [],
      };
      this.db!.prepare(`
        INSERT INTO profiles (user_id, name, preferences, notes)
        VALUES (?, ?, ?, ?)
      `).run(userId, 'User', '{}', '[]');
      return defaultProfile;
    }

    return {
      userId: row.user_id,
      name: row.name,
      preferences: JSON.parse(row.preferences || '{}'),
      notes: JSON.parse(row.notes || '[]'),
    };
  }

  async addProfileNote(userId: string, note: string): Promise<void> {
    const profile = await this.getUserProfile(userId);
    profile.notes.push(note);
    this.db!.prepare(`
      UPDATE profiles
      SET notes = ?, preferences = ?
      WHERE user_id = ?
    `).run(JSON.stringify(profile.notes), JSON.stringify(profile.preferences), userId);
  }
}

// MemoryStore alias for seamless backward compatibility
export const MemoryStore = SqliteDatabase;
