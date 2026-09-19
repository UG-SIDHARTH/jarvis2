import { JarvisHud } from './hud.js';

document.addEventListener('DOMContentLoaded', () => {
  // Holographic HUD Canvas
  const hudCanvas = document.getElementById('jarvis-hud-canvas');
  const hudWrapper = document.getElementById('hud-canvas-wrapper');
  const toggleHudBtn = document.getElementById('toggle-hud-btn');
  const hudVocalStatus = document.getElementById('hud-vocal-status');
  let hud = null;
  if (hudCanvas) {
    hud = new JarvisHud(hudCanvas);
  }

  if (toggleHudBtn && hudWrapper) {
    toggleHudBtn.addEventListener('click', () => {
      hudWrapper.classList.toggle('compact');
      toggleHudBtn.textContent = hudWrapper.classList.contains('compact') ? '⛶ Expand HUD' : '⛶ Compact HUD';
      setTimeout(() => hud?.resize(), 350);
    });
  }

  // Elements
  const chatViewport = document.getElementById('chat-viewport');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const taskList = document.getElementById('task-list');
  const newTaskForm = document.getElementById('new-task-form');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskPrioritySelect = document.getElementById('task-priority-select');
  const taskCountBadge = document.getElementById('task-count-badge');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const promptChips = document.querySelectorAll('.prompt-chip');

  // Website Auditor
  const webtestForm = document.getElementById('website-test-form');
  const webtestInput = document.getElementById('website-url-input');
  const auditResultBox = document.getElementById('website-test-result');
  const auditStatusBadge = document.getElementById('audit-status-badge');
  const auditLatencyMetric = document.getElementById('audit-latency-metric');
  const auditSslBadge = document.getElementById('audit-ssl-badge');
  const auditTitle = document.getElementById('audit-title');
  const auditDesc = document.getElementById('audit-desc');
  const auditContentType = document.getElementById('audit-content-type');

  // Discord Operations
  const deployTemplateBtn = document.getElementById('deploy-template-btn');
  const templateSelect = document.getElementById('template-select');
  const discordFeedback = document.getElementById('discord-feedback');
  const discordBotState = document.getElementById('discord-bot-state');
  const telegramBotState = document.getElementById('telegram-bot-state');

  // Voice & Speech
  const voiceToggleBtn = document.getElementById('voice-toggle-btn');
  const voiceIcon = document.getElementById('voice-icon');
  const voiceStatusText = document.getElementById('voice-status-text');
  const audioWave = document.getElementById('audio-wave');

  // Settings Modal
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsForm = document.getElementById('settings-form');
  const groqApiKeyInput = document.getElementById('groq-api-key');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const nvidiaApiKeyInput = document.getElementById('nvidia-api-key');
  const activeProviderSelect = document.getElementById('active-provider-select');
  const discordTokenInput = document.getElementById('discord-token');
  const telegramTokenInput = document.getElementById('telegram-token');
  const groqHint = document.getElementById('groq-hint');
  const geminiHint = document.getElementById('gemini-hint');
  const nvidiaHint = document.getElementById('nvidia-hint');
  const discordHint = document.getElementById('discord-hint');
  const telegramHint = document.getElementById('telegram-hint');
  const saveFeedback = document.getElementById('save-feedback');
  const activeProviderLabel = document.getElementById('active-provider-label');

  let currentFilter = 'all';
  let tasks = [];
  let voiceEnabled = true;

  // --- Voice / Speech Synthesis ---
  function speak(text) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Cancel any ongoing speech

    // Clean markdown formatting before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 0.92;

    // Pick a natural sounding English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => (v.name.includes('David') || v.name.includes('George') || v.name.includes('UK English Male') || v.name.includes('Natural')) && v.lang.startsWith('en')
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      audioWave.classList.remove('hidden');
      hud?.setSpeaking(true);
      if (hudVocalStatus) {
        hudVocalStatus.textContent = 'AUDIO TRANSMITTING';
        hudVocalStatus.classList.add('active');
      }
    };

    utterance.onend = () => {
      audioWave.classList.add('hidden');
      hud?.setSpeaking(false);
      if (hudVocalStatus) {
        hudVocalStatus.textContent = 'AUDIO STANDBY';
        hudVocalStatus.classList.remove('active');
      }
    };

    utterance.onerror = () => {
      audioWave.classList.add('hidden');
      hud?.setSpeaking(false);
      if (hudVocalStatus) {
        hudVocalStatus.textContent = 'AUDIO STANDBY';
        hudVocalStatus.classList.remove('active');
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  // Pre-load voices
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  voiceToggleBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
      voiceIcon.textContent = '🔊';
      voiceStatusText.textContent = 'Voice ON';
      voiceToggleBtn.classList.remove('active');
    } else {
      window.speechSynthesis.cancel();
      audioWave.classList.add('hidden');
      voiceIcon.textContent = '🔇';
      voiceStatusText.textContent = 'Voice OFF';
      voiceToggleBtn.classList.add('active');
    }
  });

  // --- Configuration & Settings Modal ---
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success) {
        groqHint.textContent = data.hasGroq ? `Configured (${data.groqKeyMasked})` : 'Not configured';
        geminiHint.textContent = data.hasGemini ? `Configured (${data.geminiKeyMasked})` : 'Not configured';
        nvidiaHint.textContent = data.hasNvidia ? `Configured (${data.nvidiaKeyMasked})` : 'Not configured';
        discordHint.textContent = data.hasDiscord ? `Configured (${data.discordTokenMasked})` : 'Not configured';
        telegramHint.textContent = data.hasTelegram ? `Configured (${data.telegramTokenMasked})` : 'Not configured';

        activeProviderSelect.value = data.activeProvider || 'auto';
        activeProviderLabel.textContent = (data.activeProvider || 'AUTO').toUpperCase();
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function loadBotStatus() {
    try {
      const res = await fetch('/api/bots/status');
      const data = await res.json();
      if (data.success) {
        if (data.discord.connected) {
          discordBotState.textContent = `Online (${data.discord.tag || 'Ready'})`;
          discordBotState.className = 'bot-state connected';
          document.getElementById('chip-discord').classList.add('active');
        } else if (data.discord.configured) {
          discordBotState.textContent = 'Connecting...';
          discordBotState.className = 'bot-state';
        } else {
          discordBotState.textContent = 'Token Missing';
          discordBotState.className = 'bot-state missing';
          document.getElementById('chip-discord').classList.remove('active');
        }

        if (data.telegram.connected) {
          telegramBotState.textContent = 'Online';
          telegramBotState.className = 'bot-state connected';
          document.getElementById('chip-telegram').classList.add('active');
        } else {
          telegramBotState.textContent = 'Token Missing';
          telegramBotState.className = 'bot-state missing';
          document.getElementById('chip-telegram').classList.remove('active');
        }
      }
    } catch (err) {
      console.error('Failed to check bot status:', err);
    }
  }

  openSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    saveFeedback.textContent = '';
    loadConfig();
    loadBotStatus();
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveFeedback.textContent = 'Saving configuration...';
    saveFeedback.style.color = 'var(--accent-cyan)';

    const payload = {
      activeProvider: activeProviderSelect.value,
    };

    if (groqApiKeyInput.value.trim()) payload.groqApiKey = groqApiKeyInput.value.trim();
    if (geminiApiKeyInput.value.trim()) payload.geminiApiKey = geminiApiKeyInput.value.trim();
    if (nvidiaApiKeyInput.value.trim()) payload.nvidiaApiKey = nvidiaApiKeyInput.value.trim();
    if (discordTokenInput.value.trim()) payload.discordBotToken = discordTokenInput.value.trim();
    if (telegramTokenInput.value.trim()) payload.telegramBotToken = telegramTokenInput.value.trim();

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        saveFeedback.textContent = '✔ Settings saved and applied successfully.';
        saveFeedback.style.color = 'var(--accent-emerald)';
        groqApiKeyInput.value = '';
        geminiApiKeyInput.value = '';
        nvidiaApiKeyInput.value = '';
        discordTokenInput.value = '';
        telegramTokenInput.value = '';
        await loadConfig();
        await loadBotStatus();
      } else {
        saveFeedback.textContent = `✖ Error: ${data.error}`;
        saveFeedback.style.color = 'var(--accent-crimson)';
      }
    } catch (err) {
      saveFeedback.textContent = `✖ Network error: ${err.message}`;
      saveFeedback.style.color = 'var(--accent-crimson)';
    }
  });

  // --- Task Operations ---
  async function loadTasks() {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        tasks = data.tasks;
        renderTasks();
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  }

  function renderTasks() {
    const filtered = tasks.filter((t) => {
      if (currentFilter === 'pending') return t.status !== 'completed';
      if (currentFilter === 'completed') return t.status === 'completed';
      return true;
    });

    const activeCount = tasks.filter((t) => t.status !== 'completed').length;
    taskCountBadge.textContent = `${activeCount} Active`;

    if (filtered.length === 0) {
      taskList.innerHTML = `<div class="empty-state">No ${currentFilter} tasks registered.</div>`;
      return;
    }

    taskList.innerHTML = filtered
      .map(
        (t) => `
        <div class="task-item" data-id="${t.id}">
          <div class="task-left">
            <input type="checkbox" class="task-checkbox" ${t.status === 'completed' ? 'checked' : ''}>
            <span class="task-title ${t.status === 'completed' ? 'completed' : ''}">${escapeHtml(t.title)}</span>
          </div>
          <span class="task-priority-badge priority-${t.priority}">${t.priority}</span>
        </div>
      `
      )
      .join('');

    taskList.querySelectorAll('.task-checkbox').forEach((cb) => {
      cb.addEventListener('change', async (e) => {
        const item = e.target.closest('.task-item');
        const id = item.dataset.id;
        try {
          const res = await fetch(`/api/tasks/${id}/toggle`, { method: 'POST' });
          const resData = await res.json();
          if (resData.success) {
            await loadTasks();
          }
        } catch (err) {
          console.error('Failed to toggle task:', err);
        }
      });
    });
  }

  newTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    const priority = taskPrioritySelect.value;
    if (!title) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority }),
      });
      const data = await res.json();
      if (data.success) {
        taskTitleInput.value = '';
        await loadTasks();
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // --- Chat Console Operations ---
  function appendMessage(role, text, meta) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-message`;

    if (meta) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'message-meta';
      metaDiv.textContent = meta;
      msgDiv.appendChild(metaDiv);
    }

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'message-body';
    bodyDiv.textContent = text;
    msgDiv.appendChild(bodyDiv);

    chatViewport.appendChild(msgDiv);
    chatViewport.scrollTop = chatViewport.scrollHeight;
    return msgDiv;
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    appendMessage('user', text, 'YOU // CLI-WEB');

    const thinkingMsg = appendMessage('assistant', 'Calibrating neural response...', 'JARVIS // PROCESSING');
    hud?.setThinking(true);
    if (hudVocalStatus) hudVocalStatus.textContent = 'NEURAL PROCESSING...';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      thinkingMsg.remove();
      hud?.setThinking(false);
      if (data.success) {
        const meta = data.toolsUsed?.length
          ? `JARVIS // TOOLS: [${data.toolsUsed.join(', ')}]`
          : 'JARVIS // RESPONSE';
        appendMessage('assistant', data.reply, meta);

        // Vocal synthesis!
        speak(data.reply);

        // Refresh tasks in case tools mutated them
        await loadTasks();
      } else {
        appendMessage('assistant', `Processing anomaly: ${data.error}`, 'JARVIS // ALERT');
        speak(`Processing anomaly: ${data.error}`);
      }
    } catch (err) {
      thinkingMsg.remove();
      hud?.setThinking(false);
      appendMessage('assistant', 'Network failure contacting core engine.', 'JARVIS // ERROR');
      speak('Network failure contacting core engine.');
    }
  });

  promptChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.dataset.prompt;
      chatForm.dispatchEvent(new Event('submit'));
    });
  });

  // --- Website Auditor Operations ---
  webtestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = webtestInput.value.trim();
    if (!url) return;

    const testBtn = document.getElementById('test-website-btn');
    testBtn.disabled = true;
    testBtn.textContent = 'Auditing...';
    auditResultBox.classList.remove('hidden');
    auditStatusBadge.textContent = 'CONNECTING...';
    auditLatencyMetric.textContent = '...';

    try {
      const res = await fetch('/api/test-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        const d = data.data;
        auditStatusBadge.textContent = `HTTP ${d.status} ${d.statusText}`;
        auditStatusBadge.style.background = d.ok ? 'rgba(0, 223, 143, 0.2)' : 'rgba(255, 51, 102, 0.2)';
        auditStatusBadge.style.color = d.ok ? 'var(--accent-emerald)' : 'var(--accent-crimson)';

        auditLatencyMetric.textContent = `${d.responseTimeMs} ms`;
        auditSslBadge.textContent = d.sslSecure ? 'SSL Secured' : 'Unencrypted';
        auditSslBadge.style.color = d.sslSecure ? 'var(--accent-cyan)' : 'var(--accent-amber)';

        auditTitle.textContent = d.title || 'None declared';
        auditDesc.textContent = d.metaDescription || 'None declared';
        auditContentType.textContent = d.contentType || 'N/A';

        speak(`Website audit complete for ${d.url}. Status ${d.status}, latency ${d.responseTimeMs} milliseconds.`);
      } else {
        auditStatusBadge.textContent = 'FAILED';
        auditStatusBadge.style.background = 'rgba(255, 51, 102, 0.2)';
        auditStatusBadge.style.color = 'var(--accent-crimson)';
        auditLatencyMetric.textContent = `${data.responseTimeMs || 0} ms`;
        auditTitle.textContent = data.error || 'Connection failed';
        auditDesc.textContent = 'Ensure host is reachable and protocol is correct.';

        speak(`Website audit failed for ${url}. ${data.error || 'Connection failed.'}`);
      }
    } catch (err) {
      auditStatusBadge.textContent = 'NETWORK ERROR';
      auditTitle.textContent = err.message;
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Audit';
    }
  });

  // --- Discord Template Deployment ---
  deployTemplateBtn.addEventListener('click', async () => {
    const template = templateSelect.value;
    deployTemplateBtn.disabled = true;
    deployTemplateBtn.textContent = 'Deploying Architecture...';
    discordFeedback.textContent = 'Transmitting template payload to Discord gateway...';

    try {
      const res = await fetch('/api/discord/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();

      if (data.success) {
        discordFeedback.textContent = `✔ ${data.message}`;
        discordFeedback.style.color = 'var(--accent-emerald)';
        speak(`Server template ${template} successfully deployed to Discord.`);
      } else {
        discordFeedback.textContent = `✖ ${data.error || 'Deployment failed.'}`;
        discordFeedback.style.color = 'var(--accent-crimson)';
        speak(`Discord deployment encountered an issue: ${data.error || 'Deployment failed.'}`);
      }
    } catch (err) {
      discordFeedback.textContent = `Error: ${err.message}`;
      discordFeedback.style.color = 'var(--accent-crimson)';
    } finally {
      deployTemplateBtn.disabled = false;
      deployTemplateBtn.textContent = 'Deploy Template to Server';
    }
  });

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  // Initial load
  loadTasks();
  loadConfig();
  loadBotStatus();
});
