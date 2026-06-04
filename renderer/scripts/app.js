/**
 * app.js — Main renderer logic: tab navigation, theme toggle, global state
 */

// ═══ Global State ═══════════════════════════════════════════════
const AppState = {
  currentTab: 'links',
  theme: localStorage.getItem('theme') || 'dark',
  savePath: localStorage.getItem('savePath') || '',
  concurrency: parseInt(localStorage.getItem('concurrency') || '3'),
  maxRetries: parseInt(localStorage.getItem('maxRetries') || '3'),
  resolvedLinks: [],  // results from resolver
  allFiles: [],       // flattened file list
  selectedFiles: [],  // files selected for download
};

// ═══ Tab Navigation ═════════════════════════════════════════════
document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  AppState.currentTab = tab;

  // Update nav
  document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panelId = 'panel' + tab.charAt(0).toUpperCase() + tab.slice(1);
  document.getElementById(panelId)?.classList.add('active');

  // Refresh stats if switching to stats tab
  if (tab === 'stats' && typeof refreshStats === 'function') {
    refreshStats();
  }
}

// ═══ Theme Toggle ═══════════════════════════════════════════════
function initTheme() {
  document.documentElement.setAttribute('data-theme', AppState.theme);
  updateThemeUI();
}

function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', AppState.theme);
  localStorage.setItem('theme', AppState.theme);
  updateThemeUI();
}

function updateThemeUI() {
  const btn = document.getElementById('themeToggle');
  const settingsBtn = document.getElementById('btnSettingsTheme');
  if (AppState.theme === 'dark') {
    btn.innerHTML = '<i data-lucide="moon" style="width:16px;height:16px"></i>';
    btn.title = 'Chuyển sang Light Mode';
    if (settingsBtn) settingsBtn.innerHTML = '<i data-lucide="moon" style="width:16px;height:16px"></i> Dark Mode';
  } else {
    btn.innerHTML = '<i data-lucide="sun" style="width:16px;height:16px"></i>';
    btn.title = 'Chuyển sang Dark Mode';
    if (settingsBtn) settingsBtn.innerHTML = '<i data-lucide="sun" style="width:16px;height:16px"></i> Light Mode';
  }
  if (window.lucide) window.lucide.createIcons();
}

document.getElementById('themeToggle').addEventListener('click', toggleTheme);

// ═══ Window Controls ════════════════════════════════════════════
document.getElementById('btnMinimize').addEventListener('click', () => window.electronAPI.minimize());
document.getElementById('btnMaximize').addEventListener('click', () => window.electronAPI.maximize());
document.getElementById('btnClose').addEventListener('click', () => window.electronAPI.close());

// ═══ Helper Functions ═══════════════════════════════════════════
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function getFileTypeIcon(type) {
  const icons = {
    image: '<i data-lucide="image" style="width:14px;height:14px"></i>',
    video: '<i data-lucide="film" style="width:14px;height:14px"></i>',
    audio: '<i data-lucide="music" style="width:14px;height:14px"></i>',
    document: '<i data-lucide="file-text" style="width:14px;height:14px"></i>',
    archive: '<i data-lucide="package" style="width:14px;height:14px"></i>',
    code: '<i data-lucide="code" style="width:14px;height:14px"></i>',
    executable: '<i data-lucide="monitor-play" style="width:14px;height:14px"></i>',
    other: '<i data-lucide="file" style="width:14px;height:14px"></i>'
  };
  return icons[type] || icons.other;
}

function updateStatusBar(text, dotClass) {
  document.getElementById('statusText').textContent = text;
  document.getElementById('statusDot').className = `status-dot ${dotClass || 'idle'}`;
}

function updateDownloadBadge(count) {
  const badge = document.getElementById('downloadBadge');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ═══ Init ═══════════════════════════════════════════════════════
initTheme();

// Apply saved settings
if (AppState.savePath) {
  document.getElementById('saveFolderDisplay').textContent = AppState.savePath.split(/[/\\]/).pop() || AppState.savePath;
}
