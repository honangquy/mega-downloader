/**
 * ui-log.js — Realtime log panel with filtering and export
 */

(function() {
  const logEntries = document.getElementById('logEntries');
  const logSearch = document.getElementById('logSearch');
  const logLevelFilter = document.getElementById('logLevelFilter');
  const logAutoScroll = document.getElementById('logAutoScroll');

  let allLogs = [];
  let isFirstLog = true;

  const levelIcons = {
    info: '<i data-lucide="info" style="width:14px;height:14px"></i>',
    success: '<i data-lucide="check-circle-2" style="width:14px;height:14px;color:var(--success)"></i>',
    warning: '<i data-lucide="alert-triangle" style="width:14px;height:14px;color:var(--warning)"></i>',
    error: '<i data-lucide="x-circle" style="width:14px;height:14px;color:var(--error)"></i>',
    debug: '<i data-lucide="wrench" style="width:14px;height:14px"></i>'
  };

  const textLevelIcons = {
    info: '[INFO]',
    success: '[OK]',
    warning: '[WARN]',
    error: '[ERROR]',
    debug: '[DEBUG]'
  };

  // ─── Load initial logs ────────────────────────────────────────
  async function loadInitialLogs() {
    try {
      const logs = await window.electronAPI.getLogs();
      if (logs && logs.length > 0) {
        allLogs = logs;
        isFirstLog = false;
        rerenderLogs();
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }

  // Load on start
  loadInitialLogs();

  // ─── IPC: Receive log entries ─────────────────────────────────
  window.electronAPI.onLog((entry) => {
    allLogs.push(entry);

    // Clear empty state on first log
    if (isFirstLog) {
      logEntries.innerHTML = '';
      isFirstLog = false;
    }

    // Check if entry passes current filter
    if (shouldShowEntry(entry)) {
      appendLogEntry(entry);
    }

    // Auto-scroll
    if (logAutoScroll.checked) {
      logEntries.scrollTop = logEntries.scrollHeight;
    }
  });

  // ─── Render a log entry ───────────────────────────────────────
  function appendLogEntry(entry) {
    const el = document.createElement('div');
    el.className = `log-entry ${entry.level}`;
    el.innerHTML = `
      <span class="log-time">${entry.timeStr || new Date(entry.timestamp).toLocaleTimeString('vi-VN', { hour12: false })}</span>
      <span class="log-icon">${levelIcons[entry.level] || '<i data-lucide="circle"></i>'}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
    `;
    logEntries.appendChild(el);
    
    if (window.lucide) window.lucide.createIcons({ root: el });

    // Trim old DOM entries (keep max 500 in DOM for performance)
    while (logEntries.children.length > 500) {
      logEntries.removeChild(logEntries.firstChild);
    }
  }

  // ─── Filter logic ─────────────────────────────────────────────
  function shouldShowEntry(entry) {
    const levelFilter = logLevelFilter.value;
    const searchFilter = logSearch.value.toLowerCase();

    if (levelFilter && entry.level !== levelFilter) return false;
    if (searchFilter && !entry.message.toLowerCase().includes(searchFilter)) return false;

    return true;
  }

  // ─── Re-render all logs when filter changes ───────────────────
  function rerenderLogs() {
    logEntries.innerHTML = '';
    const filtered = allLogs.filter(shouldShowEntry);

    filtered.forEach(appendLogEntry);

    if (filtered.length === 0 && allLogs.length > 0) {
      logEntries.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6)">
          <div class="empty-state-icon"><i data-lucide="search" style="width:24px;height:24px"></i></div>
          <div class="empty-state-title" style="font-size:var(--text-sm)">Không tìm thấy kết quả</div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }

    if (logAutoScroll.checked) {
      logEntries.scrollTop = logEntries.scrollHeight;
    }
  }

  logSearch.addEventListener('input', rerenderLogs);
  logLevelFilter.addEventListener('change', rerenderLogs);

  document.getElementById('btnClearLogs').addEventListener('click', async () => {
    await window.electronAPI.clearLogs();
    allLogs = [];
    isFirstLog = true;
    logEntries.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8)">
        <div class="empty-state-icon"><i data-lucide="terminal" style="width:48px;height:48px;stroke-width:1.5"></i></div>
        <div class="empty-state-title" style="font-size:var(--text-sm)">Chưa có nhật ký</div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  });

  // ─── Copy logs ────────────────────────────────────────────────
  document.getElementById('btnCopyLogs').addEventListener('click', () => {
    const text = allLogs.map(e => {
      const time = e.timeStr || new Date(e.timestamp).toLocaleTimeString('vi-VN', { hour12: false });
      return `[${time}] ${textLevelIcons[e.level] || '[-]'} ${e.message}`;
    }).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btnCopyLogs');
      btn.innerHTML = '<i data-lucide="check"></i> Đã copy!';
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy"></i> Copy';
        if (window.lucide) window.lucide.createIcons();
      }, 2000);
    });
  });

  // ─── Export logs ──────────────────────────────────────────────
  document.getElementById('btnExportLogs').addEventListener('click', async () => {
    const result = await window.electronAPI.exportLogs();
    if (result.success) {
      const btn = document.getElementById('btnExportLogs');
      btn.innerHTML = '<i data-lucide="check"></i> Đã xuất!';
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="save"></i> Xuất .txt';
        if (window.lucide) window.lucide.createIcons();
      }, 2000);
    }
  });

  // ─── Escape HTML ──────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
