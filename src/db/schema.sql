-- ===============================================
-- JARVIS v2.5 Database Schema (SQLite)
-- ===============================================

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
