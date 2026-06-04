/**
 * ui-links.js — Link input, validation, file tree, filters
 */

(function() {
  const linkInput = document.getElementById('linkInput');
  const btnAnalyze = document.getElementById('btnAnalyze');
  const analyzeSpinner = document.getElementById('analyzeSpinner');
  const linkCount = document.getElementById('linkCount');
  const resolveProgress = document.getElementById('resolveProgress');
  const resolveProgressText = document.getElementById('resolveProgressText');
  const resolveProgressCount = document.getElementById('resolveProgressCount');
  const resolveProgressBar = document.getElementById('resolveProgressBar');
  const resolveResults = document.getElementById('resolveResults');
  const fileTree = document.getElementById('fileTree');
  const filterBar = document.getElementById('filterBar');
  const filterChips = document.getElementById('filterChips');
  const filterMinSize = document.getElementById('filterMinSize');
  const filterMaxSize = document.getElementById('filterMaxSize');
  const selectedCount = document.getElementById('selectedCount');
  const selectedSize = document.getElementById('selectedSize');
  const resultSummaryBadge = document.getElementById('resultSummaryBadge');
  const btnStartDownload = document.getElementById('btnStartDownload');
  const btnSelectFolder = document.getElementById('btnSelectFolder');
  const saveFolderDisplay = document.getElementById('saveFolderDisplay');

  // ─── Link counting ───────────────────────────────────────────
  linkInput.addEventListener('input', () => {
    const lines = linkInput.value.split('\n').filter(l => l.trim().length > 0);
    linkCount.textContent = `Đã nhập: ${lines.length} link`;
  });

  // ─── Analyze button ──────────────────────────────────────────
  btnAnalyze.addEventListener('click', async () => {
    const lines = [...new Set(linkInput.value.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0))];

    if (lines.length === 0) return;

    // Reset UI for new analysis
    btnAnalyze.disabled = true;
    analyzeSpinner.style.display = 'inline-block';
    resolveProgress.style.display = 'block';
    resolveResults.style.display = 'block';
    fileTree.innerHTML = '';
    resultSummaryBadge.textContent = '0 live / 0 expired';
    
    AppState.resolvedLinks = [];
    AppState.allFiles = [];
    let liveCount = 0;
    let deadCount = 0;

    updateStatusBar('Đang phân tích link...', 'active');

    // Listen for progress
    window.electronAPI.onResolveProgress((progress) => {
      resolveProgressBar.style.width = progress.percent + '%';
      resolveProgressCount.textContent = `${progress.current}/${progress.total}`;
      resolveProgressText.textContent = `Đang phân tích... ${progress.current}/${progress.total}`;
      
      if (progress.lastResult) {
        const result = progress.lastResult;
        AppState.resolvedLinks.push(result);
        
        if (result.status === 'live') {
          liveCount++;
          if (result.files) {
            result.files.forEach(f => {
              f.linkUrl = result.url;
              f.linkHash = result.hash;
              AppState.allFiles.push(f);
            });
          }
        } else {
          deadCount++;
        }
        
        resultSummaryBadge.textContent = `${liveCount} live / ${deadCount} expired`;
        renderSingleResult(result, progress.current - 1);
        
        buildFilters();
        updateSelection();
      }
    });

    try {
      await window.electronAPI.resolveLinks(lines);
      updateStatusBar('Phân tích hoàn thành', 'idle');
    } catch (err) {
      updateStatusBar('Lỗi phân tích: ' + err.message, 'error');
    } finally {
      btnAnalyze.disabled = false;
      analyzeSpinner.style.display = 'none';
      resolveProgress.style.display = 'none';
    }
  });

  // ─── Render single result ──────────────────────────────────────
  function renderSingleResult(result, index = 0) {
    const group = document.createElement('div');
    group.className = 'file-tree-group';
    group.style.animationDelay = `${(index % 10) * 50}ms`;

    const isLive = result.status === 'live';
    const statusBadge = isLive
      ? '<span class="badge badge-live"><i data-lucide="check-circle-2" style="width:14px;height:14px"></i> Live</span>'
      : `<span class="badge badge-die"><i data-lucide="x-circle" style="width:14px;height:14px"></i> ${result.error || 'Expired'}</span>`;

    const fileCount = result.files ? result.files.length : 0;
    const totalSize = result.files ? result.files.reduce((s, f) => s + (f.size || 0), 0) : 0;

    group.innerHTML = `
      <div class="file-tree-header" onclick="this.parentElement.querySelector('.file-tree-children')?.classList.toggle('collapsed')">
        <div class="file-tree-info">
          <span style="font-size:var(--text-lg); display:flex; align-items:center;">${isLive ? '<i data-lucide="folder-open"></i>' : '<i data-lucide="alert-triangle"></i>'}</span>
          <span class="text-sm font-semibold truncate" style="max-width:280px">${result.hash || result.url}</span>
          ${isLive ? `<span class="text-xs text-muted">${fileCount} file(s) • ${formatBytes(totalSize)}</span>` : ''}
        </div>
        <div class="file-tree-status">${statusBadge}</div>
      </div>
      ${isLive && fileCount > 0 ? `
        <div class="file-tree-children">
          ${result.files.map(file => `
            <div class="file-tree-item">
              <div class="file-info">
                <label class="checkbox-wrapper">
                  <input type="checkbox" data-file-id="${file.id}" ${file.selected ? 'checked' : ''} onchange="window._toggleFile('${file.id}', this.checked)">
                </label>
                <span class="file-icon">${getFileTypeIcon(file.type)}</span>
                <span class="text-sm truncate" style="max-width:250px" title="${file.name}">${file.name}</span>
              </div>
              <div class="file-details">
                <span class="badge badge-info">.${file.extension}</span>
                <span>${file.sizeFormatted || formatBytes(file.size)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    fileTree.appendChild(group);

    if (window.lucide) {
      window.lucide.createIcons({ root: group });
    }
  }

  // ─── Toggle file selection ────────────────────────────────────
  window._toggleFile = function(fileId, checked) {
    const file = AppState.allFiles.find(f => f.id === fileId);
    if (file) {
      file.selected = checked;
      updateSelection();
    }
  };

  // ─── Select / Deselect All ────────────────────────────────────
  document.getElementById('btnSelectAll').addEventListener('click', () => {
    AppState.allFiles.forEach(f => f.selected = true);
    document.querySelectorAll('.file-tree-item input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateSelection();
  });

  document.getElementById('btnDeselectAll').addEventListener('click', () => {
    AppState.allFiles.forEach(f => f.selected = false);
    document.querySelectorAll('.file-tree-item input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateSelection();
  });

  // ─── Build filter chips ───────────────────────────────────────
  function buildFilters() {
    const extensions = [...new Set(AppState.allFiles.map(f => f.extension).filter(Boolean))];

    if (extensions.length <= 1) {
      filterBar.style.display = 'none';
      return;
    }

    filterBar.style.display = 'flex';
    filterChips.innerHTML = `
      <button class="filter-chip active" data-ext="all" onclick="window._filterByExt('all', this)">Tất cả</button>
      ${extensions.map(ext => `
        <button class="filter-chip" data-ext="${ext}" onclick="window._filterByExt('${ext}', this)">.${ext}</button>
      `).join('')}
    `;
  }

  window._filterByExt = function(ext, el) {
    if (ext === 'all') {
      AppState.allFiles.forEach(f => f.selected = true);
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    } else {
      // Toggle
      el.classList.toggle('active');
      document.querySelector('.filter-chip[data-ext="all"]')?.classList.remove('active');

      const activeExts = [...document.querySelectorAll('.filter-chip.active')]
        .map(c => c.dataset.ext)
        .filter(e => e !== 'all');

      if (activeExts.length === 0) {
        document.querySelector('.filter-chip[data-ext="all"]')?.classList.add('active');
        AppState.allFiles.forEach(f => f.selected = true);
      } else {
        AppState.allFiles.forEach(f => {
          f.selected = activeExts.includes(f.extension);
        });
      }
    }

    // Update checkboxes
    AppState.allFiles.forEach(f => {
      const cb = document.querySelector(`input[data-file-id="${f.id}"]`);
      if (cb) cb.checked = f.selected;
    });

    updateSelection();
  };

  // ─── Size filters ─────────────────────────────────────────────
  filterMinSize.addEventListener('input', applyFilters);
  filterMaxSize.addEventListener('input', applyFilters);

  function applyFilters() {
    const minMB = parseFloat(filterMinSize.value) || 0;
    const maxMB = parseFloat(filterMaxSize.value) || Infinity;

    AppState.allFiles.forEach(f => {
      const sizeMB = f.size / (1024 * 1024);
      const inRange = sizeMB >= minMB && sizeMB <= maxMB;
      f.selected = inRange;

      const cb = document.querySelector(`input[data-file-id="${f.id}"]`);
      if (cb) cb.checked = f.selected;
    });

    updateSelection();
  }

  // ─── Update selection summary ─────────────────────────────────
  function updateSelection() {
    AppState.selectedFiles = AppState.allFiles.filter(f => f.selected);
    const count = AppState.selectedFiles.length;
    const totalSize = AppState.selectedFiles.reduce((s, f) => s + (f.size || 0), 0);

    selectedCount.textContent = `Đã chọn: ${count} file`;
    selectedSize.textContent = formatBytes(totalSize);
    btnStartDownload.textContent = `📥 Bắt đầu tải (${count} file)`;
    btnStartDownload.disabled = count === 0 || !AppState.savePath;
  }

  // ─── Select save folder ───────────────────────────────────────
  btnSelectFolder.addEventListener('click', async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      AppState.savePath = folder;
      localStorage.setItem('savePath', folder);
      saveFolderDisplay.textContent = folder.split(/[/\\]/).pop() || folder;
      saveFolderDisplay.title = folder;

      // Update settings display
      const settingsPath = document.getElementById('settingsSavePath');
      if (settingsPath) settingsPath.textContent = folder;

      updateSelection();
    }
  });

  // ─── Start download ───────────────────────────────────────────
  btnStartDownload.addEventListener('click', async () => {
    if (AppState.selectedFiles.length === 0 || !AppState.savePath) return;

    const files = AppState.selectedFiles.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      extension: f.extension,
      transferHash: f.transferHash || f.linkHash,
      megaNode: f.megaNode
    }));

    try {
      await window.electronAPI.startDownload({
        files,
        savePath: AppState.savePath,
        concurrency: AppState.concurrency,
        maxRetries: AppState.maxRetries
      });

      updateDownloadBadge(files.length);
      switchTab('downloads');
    } catch (err) {
      console.error('Start download failed:', err);
    }
  });

})();
