# JARVIS v2.0 — Personal AI Orchestrator

An autonomous personal AI orchestrator operating across **Terminal (CLI)**, **Telegram**, and **Discord**, with unified cross-platform memory, task automation, coding, research, scheduling, and system operations.

---

## ⚡ Key Capabilities

1. **Unified Cross-Platform Memory**:
   - Interactions across CLI, Telegram, and Discord share the same persistent state, task registry, and user context.
2. **Autonomous Tool Calling**:
   - **Tasks**: Proactively captures to-dos, assigns priorities (`low`, `medium`, `high`, `urgent`), tracks status (`pending`, `in_progress`, `completed`), and flags overdue items.
   - **Scheduling & Reminders**: Converts vague time references into concrete slots and manages reminders.
   - **System Operations**: Runs local shell commands, inspects project directories, and reads/writes files on the disk.
   - **Discord Server Architecture & Automations**:
     - Autonomous channel & category provisioning (`create_discord_channel`).
     - Role creation & hierarchy management (`create_discord_role`).
     - Styled rules and announcement embeds with markdown formatting (`post_discord_embed`).
     - One-shot full server scaffolding templates (`setup_server_template` e.g. `developer`, `community`, `gaming`).
     - Member join automations: auto-assign default role & welcome greeting (`configure_discord_automations` + `guildMemberAdd`).
3. **Multi-Interface Support**:
   - **Interactive CLI**: Rich terminal REPL with built-in commands (`/tasks`, `/reminders`, `/clear`, `/exit`).
   - **Telegram Bot**: Powered by `grammy`, with quick actions, commands, and typing indicators.
   - **Discord Bot**: Powered by `discord.js`, supporting mentions, direct messages, and auto-chunking for long responses.
4. **Platform-Adaptive Voice**:
   - Concise, scannable replies for Telegram and Discord; full-length formatted outputs in CLI.
   - Calm, competent tone with dry wit and zero fluff.

---

## 📁 Architecture & Structure

```
jarvis2/
├── src/
│   ├── config/
│   │   ├── settings.ts        # Environment & config loader
│   │   └── prompts.ts         # JARVIS persona & behavioral rules
│   ├── core/
│   │   ├── llm.ts             # Google Gen AI client with function-calling loop
│   │   └── orchestrator.ts    # Central dispatcher & cross-platform context
│   ├── db/
│   │   └── store.ts           # Persistent storage (tasks, reminders, memory)
│   ├── interfaces/
│   │   ├── cli.ts             # Terminal REPL gateway
│   │   ├── telegram.ts        # Telegram bot connector (grammy)
│   │   └── discord.ts         # Discord bot connector (discord.js)
│   ├── tools/
│   │   ├── base.ts / types.ts # Tool interfaces & schemas
│   │   ├── task_manager.ts    # To-do & deadline tools
│   │   ├── scheduler.ts       # Reminder & scheduling tools
│   │   ├── system_ops.ts      # Shell & file automation tools
│   │   └── index.ts           # Tool registry & dispatch
│   └── index.ts               # Application entrypoint
├── tests/
│   └── test_system.ts         # End-to-end verification suite
├── .env.example               # Configuration template
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Requirements
- Node.js **22.x** or higher (with native TypeScript support).

### 2. Setup Configuration
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

Configuration variables:
```env
# Google Gemini API Key (Required for AI responses)
GEMINI_API_KEY=your_gemini_api_key_here

# Telegram Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Discord Bot Token (from Discord Developer Portal)
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Storage Path (defaults to ./data/jarvis_store.json)
DATA_PATH=./data/jarvis_store.json
```

---

## 💻 Running JARVIS

### Interactive CLI Mode
```bash
npm run start:cli
```
Inside the CLI, you can chat with JARVIS or use shortcuts:
- `/tasks` — Display current task registry and priorities.
- `/reminders` — Display pending reminders.
- `/clear` — Clear the screen.
- `/exit` — Power down.

### Telegram Bot Mode
```bash
npm run start:telegram
```
Talk to your bot on Telegram. Use `/start` or `/tasks` for instant summaries.

### Discord Bot Mode
```bash
npm run start:discord
```
Mention the bot in your server or send direct messages (DMs).

### Run All Gateways Concurrently
```bash
npm run start:all
```
Brings up CLI, Telegram, and Discord simultaneously sharing unified memory.

---

## 🧪 Verification & Tests

Run the comprehensive test suite verifying store operations, tool executions, and orchestrator dispatch:
```bash
node --experimental-strip-types tests/test_system.ts
node --experimental-strip-types tests/test_discord_tools.ts
```

---

## 🐳 Docker Deployment

Run JARVIS headlessly with automatic persistence and restarts:

### 1. Build & Run with Docker Compose
```bash
docker compose up -d --build
```

### 2. View Logs
```bash
docker compose logs -f
```

### 3. Stop Container
```bash
docker compose down
```
Persistent memory is automatically preserved in the `jarvis_data` volume.
