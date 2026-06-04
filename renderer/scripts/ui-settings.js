/**
 * ui-settings.js — Settings panel logic
 */

(function() {
  // ─── Save folder ──────────────────────────────────────────────
  document.getElementById('btnSettingsSelectFolder').addEventListener('click', async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      AppState.savePath = folder;
      localStorage.setItem('savePath', folder);
      document.getElementById('settingsSavePath').textContent = folder;
      document.getElementById('saveFolderDisplay').textContent = folder.split(/[/\\]/).pop() || folder;
      document.getElementById('saveFolderDisplay').title = folder;
    }
  });

  // Init display
  if (AppState.savePath) {
    document.getElementById('settingsSavePath').textContent = AppState.savePath;
  }

  // ─── Concurrency slider ───────────────────────────────────────
  const settingsConcurrency = document.getElementById('settingsConcurrency');
  const settingsConcurrencyValue = document.getElementById('settingsConcurrencyValue');

  settingsConcurrency.value = AppState.concurrency;
  settingsConcurrencyValue.textContent = AppState.concurrency;

  settingsConcurrency.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    settingsConcurrencyValue.textContent = val;
    AppState.concurrency = val;
    localStorage.setItem('concurrency', val);

    // Sync with downloads panel slider
    document.getElementById('concurrencySlider').value = val;
    document.getElementById('concurrencyValue').textContent = val;

    window.electronAPI.setConcurrency(val);
  });

  // ─── Max retries slider ───────────────────────────────────────
  const settingsMaxRetries = document.getElementById('settingsMaxRetries');
  const settingsRetriesValue = document.getElementById('settingsRetriesValue');

  settingsMaxRetries.value = AppState.maxRetries;
  settingsRetriesValue.textContent = AppState.maxRetries;

  settingsMaxRetries.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    settingsRetriesValue.textContent = val;
    AppState.maxRetries = val;
    localStorage.setItem('maxRetries', val);
  });

  // ─── Theme toggle ─────────────────────────────────────────────
  document.getElementById('btnSettingsTheme').addEventListener('click', () => {
    toggleTheme();
  });

})();
