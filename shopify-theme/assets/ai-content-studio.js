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
  const sendBtn = root.querySelector('.ai-content-studio__send-btn');
  const contentTypeInput = root.querySelector('[data-content-type-input]');
  const typeButtons = root.querySelectorAll('.ai-content-studio__type-btn');
  const textarea = root.querySelector('#aiPrompt');

  let used = 0;
  let latestGenerationId = null;
  const dateKey = `lts-ai-chat-used-${new Date().toISOString().slice(0, 10)}`;

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'x-shopify-customer-id': customerId,
    'x-lts-entitled': isMember ? 'true' : 'false'
  });

  try { used = Number(localStorage.getItem(dateKey) || 0); } catch (_) {}

  // Content type pill selectors
  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      typeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (contentTypeInput) contentTypeInput.value = btn.dataset.typeValue;
    });
  });

  // Auto-resize textarea
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
    });
  }

  const renderQuota = () => {
    const remaining = Math.max(dailyLimit - used, 0);
    if (quotaBadge) quotaBadge.textContent = `Chats remaining today: ${remaining}`;
  };

  const appendMessage = (kind, text) => {
    if (!messages) return;
    // Remove typing indicator if present
    const typing = messages.querySelector('.message--typing');
    if (typing) typing.remove();
    const node = document.createElement('div');
    node.className = `message message--${kind}`;
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  };

  const showTyping = () => {
    if (!messages || messages.querySelector('.message--typing')) return;
    const node = document.createElement('div');
    node.className = 'message message--typing';
    node.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  };

  const removeTyping = () => {
    if (!messages) return;
    const typing = messages.querySelector('.message--typing');
    if (typing) typing.remove();
  };

  const setGenerating = (state) => {
    fileButtons.forEach((btn) => {
      // TODO: Re-enable member check for production
      // if (!isMember) { btn.disabled = true; } else { btn.disabled = state; }
      btn.disabled = state;
    });
  };

  const setSending = (state) => {
    if (sendBtn) {
      sendBtn.disabled = state;
      sendBtn.classList.toggle('is-loading', state);
    }
    if (textarea) textarea.disabled = state;
  };

  // Simple markdown to HTML: headings, bold, italic, lists, paragraphs
  const renderMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      .replace(/^(?!<[hul])(.*\S.*)$/gm, '<p>$1</p>')
      .replace(/\n{2,}/g, '');
  };

  // Fetch file as blob and trigger browser save dialog (works cross-origin)
  const downloadBlob = async (url, fileName) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const triggerDownload = async (fileId, fileName) => {
    try {
      const res = await fetch(`${apiBase}/files/${fileId}/download`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.url) await downloadBlob(data.url, fileName || 'document');
      await loadFiles();
    } catch (err) {
      appendMessage('system', err.message || 'Download failed or limit reached.');
    }
  };

  // Show PDF in preview pane via iframe
  const previewPdf = async (url) => {
    if (!preview) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Preview failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      preview.innerHTML = `<iframe src="${blobUrl}" style="width:100%;height:500px;border:none;border-radius:8px;" title="PDF preview"></iframe>`;
    } catch {
      // Fall back to text preview if PDF embed fails
    }
  };

  const loadFiles = async () => {
    if (!isLoggedIn || !filesList) return;
    try {
      const res = await fetch(`${apiBase}/files`, { credentials: 'include', headers: authHeaders() });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.files) || !data.files.length) {
        filesList.textContent = 'No files yet. Generate content above to get started.';
        return;
      }
      filesList.innerHTML = data.files.map((f) => {
        const remaining = Math.max((f.maxDownloads || 3) - (f.downloadCount || 0), 0);
        const icon = f.format === 'pdf' ? '&#128462;' : '&#128196;';
        return `<div class="file-row">
          <strong>${icon} ${f.name}</strong>
          <span class="file-meta">${f.format.toUpperCase()} &middot; ${remaining} downloads left</span>
          <button data-download-id="${f.id}" data-download-name="${f.name}" ${remaining <= 0 ? 'disabled' : ''}>Download</button>
        </div>`;
      }).join('');

      filesList.querySelectorAll('[data-download-id]').forEach((btn) => {
        btn.addEventListener('click', () => triggerDownload(btn.dataset.downloadId, btn.dataset.downloadName));
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
      if (textarea) { textarea.value = ''; textarea.style.height = 'auto'; }
      setSending(true);
      showTyping();

      try {
        const res = await fetch(`${apiBase}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: JSON.stringify({ prompt, contentType })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        removeTyping();
        appendMessage('assistant', data.message || 'Preview generated.');
        if (preview) preview.innerHTML = renderMarkdown(data.previewText || data.message || '');
        latestGenerationId = data.generationId || null;

        used += 1;
        try { localStorage.setItem(dateKey, String(used)); } catch (_) {}
        renderQuota();
      } catch (err) {
        removeTyping();
        appendMessage('system', err.message || 'Sorry, there was a generation error.');
      } finally {
        setSending(false);
      }
    });
  }

  // Allow Enter to submit (Shift+Enter for newline)
  if (textarea && form) {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true }));
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

        // Auto-preview PDF in the preview pane
        if (format === 'pdf' && data.fileId) {
          const dlRes = await fetch(`${apiBase}/files/${data.fileId}/download`, {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders()
          });
          const dlData = await dlRes.json();
          if (dlData.url) await previewPdf(dlData.url);
        }

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
