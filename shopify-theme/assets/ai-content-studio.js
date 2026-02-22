(() => {
  const root = document.querySelector('[data-ai-content-studio]');
  if (!root) return;

  const apiBase = root.dataset.apiBase || '/apps/lts-ai';
  const dailyLimit = Number(root.dataset.dailyLimit || 3);
  const isLoggedIn = root.dataset.isLoggedIn === 'true';
  const isMember = root.dataset.isMember === 'true';
  const customerId = root.dataset.customerId || '';

  const form = root.querySelector('[data-chat-form]');
  const messages = root.querySelector('[data-chat-messages]');
  const preview = root.querySelector('[data-preview]');
  const filesList = root.querySelector('[data-files-list]');
  const quotaBadge = root.querySelector('[data-quota-badge]');
  const fileButtons = root.querySelectorAll('[data-generate-file]');

  let used = 0;
  let latestGenerationId = null;
  const dateKey = `lts-ai-chat-used-${new Date().toISOString().slice(0, 10)}`;

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'x-shopify-customer-id': customerId,
    'x-lts-entitled': isMember ? 'true' : 'false'
  });

  try { used = Number(localStorage.getItem(dateKey) || 0); } catch (_) {}

  const renderQuota = () => {
    const remaining = Math.max(dailyLimit - used, 0);
    if (quotaBadge) quotaBadge.textContent = `Chats remaining today: ${remaining}`;
  };

  const appendMessage = (kind, text) => {
    if (!messages) return;
    const node = document.createElement('div');
    node.className = `message message--${kind}`;
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  };

  const setGenerating = (state) => {
    fileButtons.forEach((btn) => {
      // TODO: Re-enable member check for production
      // if (!isMember) { btn.disabled = true; } else { btn.disabled = state; }
      btn.disabled = state;
    });
  };

  const triggerDownload = async (fileId) => {
    try {
      const res = await fetch(`${apiBase}/files/${fileId}/download`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.url) window.open(data.url, '_blank');
      await loadFiles();
    } catch (err) {
      appendMessage('system', err.message || 'Download failed or limit reached.');
    }
  };

  const loadFiles = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch(`${apiBase}/files`, { credentials: 'include', headers: authHeaders() });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.files) || !data.files.length) {
        filesList.textContent = 'No files yet.';
        return;
      }
      filesList.innerHTML = data.files.map((f) => {
        const remaining = Math.max((f.maxDownloads || 3) - (f.downloadCount || 0), 0);
        return `<div class="file-row"><strong>${f.name}</strong> (${f.format.toUpperCase()}) - downloads left: ${remaining} <button data-download-id="${f.id}" ${remaining <= 0 ? 'disabled' : ''}>Download</button></div>`;
      }).join('');

      filesList.querySelectorAll('[data-download-id]').forEach((btn) => {
        btn.addEventListener('click', () => triggerDownload(btn.dataset.downloadId));
      });
    } catch (err) {
      filesList.textContent = 'Unable to load files right now.';
    }
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!isLoggedIn) return;
      if (used >= dailyLimit) {
        appendMessage('system', 'Daily chat limit reached. Please come back tomorrow.');
        return;
      }

      const formData = new FormData(form);
      const prompt = String(formData.get('prompt') || '').trim();
      const contentType = String(formData.get('contentType') || 'lesson_plan');
      if (!prompt) return;

      appendMessage('user', prompt);

      try {
        const res = await fetch(`${apiBase}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: JSON.stringify({ prompt, contentType })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        appendMessage('assistant', data.message || 'Generated preview.');
        if (preview) preview.textContent = data.previewText || data.message || '';
        latestGenerationId = data.generationId || null;

        used += 1;
        try { localStorage.setItem(dateKey, String(used)); } catch (_) {}
        renderQuota();
      } catch (err) {
        appendMessage('system', err.message || 'Sorry, there was a generation error.');
      }
    });
  }

  fileButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      // TODO: Re-enable member check for production
      // if (!isMember) { appendMessage('system', 'Membership required before document generation.'); return; }
      if (!latestGenerationId) {
        appendMessage('system', 'Generate a preview first.');
        return;
      }
      const format = btn.dataset.generateFile;
      setGenerating(true);
      try {
        const res = await fetch(`${apiBase}/generate`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: JSON.stringify({ generationId: latestGenerationId, format })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        appendMessage('system', `${format.toUpperCase()} ready: ${data.fileName || 'saved to My Files'}`);
        await loadFiles();
      } catch (_) {
        appendMessage('system', `Failed to generate ${format.toUpperCase()}.`);
      } finally {
        setGenerating(false);
      }
    });
  });

  renderQuota();
  loadFiles();
})();
