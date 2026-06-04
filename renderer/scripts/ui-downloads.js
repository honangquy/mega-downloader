/**
 * ui-downloads.js — Download queue panel with progress bars
 */

(function() {
  const activeDownloads = document.getElementById('activeDownloads');
  const emptyDownloads = document.getElementById('emptyDownloads');
  const completedSection = document.getElementById('completedSection');
  const completedDownloads = document.getElementById('completedDownloads');
  const completedCount = document.getElementById('completedCount');
  const completedToggle = document.getElementById('completedToggle');
  const completedArrow = document.getElementById('completedArrow');

  const overallPercent = document.getElementById('overallPercent');
  const overallProgressBar = document.getElementById('overallProgressBar');
  const overallDownloaded = document.getElementById('overallDownloaded');
  const overallSpeed = document.getElementById('overallSpeed');

  const concurrencySlider = document.getElementById('concurrencySlider');
  const concurrencyValue = document.getElementById('concurrencyValue');

  const downloadItems = new Map(); // id → DOM element
  let completedItems = 0;
  let totalItems = 0;
  let completedCollapsed = false;
  let historyItems = [];

  async function loadHistory() {
    try {
      const data = await window.electronAPI.getHistory();
      if (data && data.length > 0) {
        historyItems = data;
        completedItems = data.length;
        totalItems = data.length;
        
        completedSection.style.display = 'block';
        completedCount.textContent = completedItems;
        
        data.forEach(item => {
          appendCompletedToDOM(item);
        });
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }

  function appendCompletedToDOM(item) {
    const completedEl = document.createElement('div');
    completedEl.className = 'download-item';
    completedEl.style.opacity = '0.8';

    const isSuccess = item.status === 'completed';
    const isExists = item.status === 'exists';
    const isCancelled = item.status === 'cancelled';
    
    let statusIcon, statusText, statusClass;
    if (isSuccess) {
      statusIcon = '<i data-lucide="check-circle-2" style="width:14px;height:14px"></i>';
      statusText = 'Thành công';
      statusClass = 'text-success';
    } else if (isExists) {
      statusIcon = '<i data-lucide="info" style="width:14px;height:14px"></i>';
      statusText = 'Đã tồn tại';
      statusClass = 'text-info';
    } else if (isCancelled) {
      statusIcon = '<i data-lucide="skip-forward" style="width:14px;height:14px"></i>';
      statusText = 'Đã hủy';
      statusClass = 'text-warning';
    } else {
      statusIcon = '<i data-lucide="x-circle" style="width:14px;height:14px"></i>';
      statusText = `Lỗi: ${item.error}`;
      statusClass = 'text-error';
    }

    completedEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:var(--space-2)">
          <span class="${statusClass}">${statusIcon}</span>
          <span class="text-sm truncate" style="max-width:250px" title="${item.name}">${item.name}</span>
          <span class="text-xs text-muted">${item.sizeFormatted || ''}</span>
        </div>
        <span class="text-xs ${statusClass}">${statusText}</span>
      </div>
    `;

    completedDownloads.prepend(completedEl);
    if (window.lucide) window.lucide.createIcons({ root: completedEl });
  }

  // ─── Concurrency slider ───────────────────────────────────────
  concurrencySlider.addEventListener('input', (e) => {
    const val = e.target.value;
    concurrencyValue.textContent = val;
    AppState.concurrency = parseInt(val);
    window.electronAPI.setConcurrency(parseInt(val));
  });

  // ─── Pause All ────────────────────────────────────────────────
  document.getElementById('btnPauseAll').addEventListener('click', async () => {
    const result = await window.electronAPI.pauseDownload();
    const btn = document.getElementById('btnPauseAll');
    if (result.paused) {
      btn.innerHTML = '<i data-lucide="play" style="width:16px;height:16px"></i> Tiếp tục';
      updateStatusBar('Đã tạm dừng', 'idle');
    } else {
      btn.innerHTML = '<i data-lucide="pause" style="width:16px;height:16px"></i> Tạm dừng';
      updateStatusBar('Đang tải xuống...', 'active');
    }
    if (window.lucide) window.lucide.createIcons();
  });

  // ─── Cancel All ───────────────────────────────────────────────
  document.getElementById('btnCancelAll').addEventListener('click', async () => {
    await window.electronAPI.cancelAll();
    updateStatusBar('Đã hủy tất cả', 'error');
  });

  // ─── Completed toggle ─────────────────────────────────────────
  completedToggle.addEventListener('click', () => {
    completedCollapsed = !completedCollapsed;
    completedArrow.innerHTML = completedCollapsed ? '<i data-lucide="chevron-right" style="width:16px;height:16px"></i>' : '<i data-lucide="chevron-down" style="width:16px;height:16px"></i>';
    if (window.lucide) window.lucide.createIcons();
    completedDownloads.style.display = completedCollapsed ? 'none' : 'block';
  });

  // ─── Create download item DOM ─────────────────────────────────
  function createDownloadItemDOM(item) {
    const el = document.createElement('div');
    el.className = 'download-item';
    el.id = `dl-${item.id}`;
    el.innerHTML = `
      <div class="download-header">
        <div class="download-name">
          <span>${getFileTypeIcon(item.type)}</span>
          <span class="truncate" style="max-width:300px" title="${item.name}">${item.name}</span>
          <span class="text-xs text-muted">${item.sizeFormatted || formatBytes(item.size)}</span>
        </div>
        <div class="download-controls">
          <button class="btn btn-icon-sm btn-ghost" title="Hủy" onclick="window._cancelDownload('${item.id}')"><i data-lucide="x" style="width:16px;height:16px"></i></button>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill animated" id="progress-${item.id}" style="width:0%"></div>
      </div>
      <div class="download-footer">
        <span id="status-${item.id}">Đang chờ...</span>
        <span id="speed-${item.id}"></span>
      </div>
    `;
    return el;
  }

  // ─── Cancel single download ───────────────────────────────────
  window._cancelDownload = function(id) {
    window.electronAPI.cancelDownload(id);
  };

  // ─── IPC: Queued ──────────────────────────────────────────────
  window.electronAPI.onQueued((item) => {
    emptyDownloads.style.display = 'none';
    totalItems++;

    const el = createDownloadItemDOM(item);
    activeDownloads.appendChild(el);
    downloadItems.set(item.id, el);
    
    if (window.lucide) window.lucide.createIcons({ root: el });

    updateDownloadBadge(totalItems - completedItems);
    updateStatusBar(`Đang tải xuống... (${totalItems} file)`, 'active');
    document.getElementById('statusFiles').textContent = `${completedItems}/${totalItems} file`;
  });

  // ─── IPC: Progress ────────────────────────────────────────────
  window.electronAPI.onProgress((item) => {
    const progressEl = document.getElementById(`progress-${item.id}`);
    const statusEl = document.getElementById(`status-${item.id}`);
    const speedEl = document.getElementById(`speed-${item.id}`);

    if (progressEl) {
      progressEl.style.width = item.progress + '%';
    }

    if (statusEl) {
      statusEl.textContent = `${item.downloadedFormatted} / ${item.sizeFormatted} (${item.progress}%)`;
      if (item.eta > 0) {
        statusEl.textContent += ` • ~${formatDuration(item.eta)}`;
      }
    }

    if (speedEl) {
      speedEl.textContent = item.speedFormatted;
    }

    // Update status bar
    document.getElementById('statusSpeed').textContent = `↓ ${item.speedFormatted}`;
  });

  // ─── IPC: Completed ──────────────────────────────────────────
  window.electronAPI.onCompleted((item) => {
    completedItems++;

    // Remove from active
    const el = downloadItems.get(item.id);
    if (el) el.remove();
    downloadItems.delete(item.id);

    // Add to completed section
    completedSection.style.display = 'block';
    completedCount.textContent = completedItems;

    appendCompletedToDOM(item);

    // Save history
    historyItems.push(item);
    window.electronAPI.saveHistory(historyItems);

    // Update badges & status
    updateDownloadBadge(totalItems - completedItems);
    document.getElementById('statusFiles').textContent = `${completedItems}/${totalItems} file`;

    if (completedItems >= totalItems) {
      updateStatusBar('Tải xuống hoàn thành!', 'idle');
      document.getElementById('statusSpeed').textContent = '';
    }
  });

  // ─── IPC: Error ───────────────────────────────────────────────
  window.electronAPI.onError((item) => {
    const progressEl = document.getElementById(`progress-${item.id}`);
    const statusEl = document.getElementById(`status-${item.id}`);

    if (progressEl) {
      progressEl.classList.add('error');
    }
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-error">${item.error}</span>`;
    }
  });

  // ─── IPC: Retry ───────────────────────────────────────────────
  window.electronAPI.onRetry((item) => {
    const statusEl = document.getElementById(`status-${item.id}`);
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-warning"><i data-lucide="refresh-cw" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i> Thử lại ${item.retries}/${AppState.maxRetries}...</span>`;
      if (window.lucide) window.lucide.createIcons({ root: statusEl });
    }
  });

  // ─── IPC: Stats (for overall progress) ────────────────────────
  window.electronAPI.onStats((stats) => {
    overallPercent.textContent = stats.percentComplete + '%';
    overallProgressBar.style.width = stats.percentComplete + '%';
    overallDownloaded.textContent = `${stats.downloadedFormatted} / ${stats.totalFormatted}`;
    overallSpeed.textContent = stats.avgSpeedFormatted;
    document.getElementById('statusSize').textContent = `${stats.downloadedFormatted} / ${stats.totalFormatted}`;
  });

  // Load history on startup
  loadHistory();
})();
