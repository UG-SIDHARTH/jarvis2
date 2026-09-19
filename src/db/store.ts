import fs from 'fs/promises';
import path from 'path';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string; // ISO string
  createdAt: string;
  platform: 'cli' | 'telegram' | 'discord' | 'web';
  userId: string;
}

export interface Reminder {
  id: string;
  text: string;
  triggerAt: string; // ISO string
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

export interface StorageData {
  tasks: Task[];
  reminders: Reminder[];
  messages: ChatMessage[];
  profiles: Record<string, UserProfile>;
}

export class MemoryStore {
  private filePath: string;
  private data: StorageData = {
    tasks: [],
    reminders: [],
    messages: [],
    profiles: {},
  };
  private initialized = false;

  constructor(filePath: string = './data/jarvis_store.json') {
    this.filePath = path.resolve(filePath);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      // File doesn't exist yet, save default data
      await this.save();
    }
    this.initialized = true;
  }

  private async save(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
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
    this.data.tasks.push(newTask);
    await this.save();
    return newTask;
  }

  async listTasks(filter?: { status?: Task['status']; priority?: Task['priority']; userId?: string }): Promise<Task[]> {
    await this.init();
    return this.data.tasks.filter((t) => {
      if (filter?.status && t.status !== filter.status) return false;
      if (filter?.priority && t.priority !== filter.priority) return false;
      if (filter?.userId && t.userId !== filter.userId) return false;
      return true;
    });
  }

  async updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | null> {
    await this.init();
    const index = this.data.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;
    this.data.tasks[index] = { ...this.data.tasks[index], ...updates };
    await this.save();
    return this.data.tasks[index];
  }

  async deleteTask(id: string): Promise<boolean> {
    await this.init();
    const initialLen = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    if (this.data.tasks.length !== initialLen) {
      await this.save();
      return true;
    }
    return false;
  }

  // --- Reminder / Scheduling Methods ---
  async addReminder(reminder: Omit<Reminder, 'id' | 'triggered'>): Promise<Reminder> {
    await this.init();
    const newReminder: Reminder = {
      ...reminder,
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      triggered: false,
    };
    this.data.reminders.push(newReminder);
    await this.save();
    return newReminder;
  }

  async listPendingReminders(): Promise<Reminder[]> {
    await this.init();
    return this.data.reminders.filter((r) => !r.triggered);
  }

  async markReminderTriggered(id: string): Promise<void> {
    await this.init();
    const item = this.data.reminders.find((r) => r.id === id);
    if (item) {
      item.triggered = true;
      await this.save();
    }
  }

  // --- Chat Message Memory ---
  async recordMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    await this.init();
    const message: ChatMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.messages.push(message);

    // Keep history bounded to last 200 messages for memory efficiency
    if (this.data.messages.length > 200) {
      this.data.messages = this.data.messages.slice(-200);
    }

    await this.save();
    return message;
  }

  async getRecentMessages(limit = 15, userId?: string): Promise<ChatMessage[]> {
    await this.init();
    let msgs = this.data.messages;
    if (userId) {
      msgs = msgs.filter((m) => m.userId === userId || m.userId === 'all');
    }
    return msgs.slice(-limit);
  }

  // --- User Profile / Cross-Platform Context ---
  async getUserProfile(userId: string): Promise<UserProfile> {
    await this.init();
    if (!this.data.profiles[userId]) {
      this.data.profiles[userId] = {
        userId,
        name: 'User',
        preferences: {},
        notes: [],
      };
      await this.save();
    }
    return this.data.profiles[userId];
  }

  async addProfileNote(userId: string, note: string): Promise<void> {
    const profile = await this.getUserProfile(userId);
    profile.notes.push(note);
    await this.save();
  }
}
