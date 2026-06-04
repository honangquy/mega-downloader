const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Window Controls ─────────────────────────────────────
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // ─── Link Resolution ─────────────────────────────────────
  resolveLinks: (urls) => ipcRenderer.invoke('transfer:resolveLinks', urls),
  onResolveProgress: (callback) => {
    ipcRenderer.on('transfer:onResolveProgress', (_, data) => callback(data));
  },

  // ─── Downloads ────────────────────────────────────────────
  startDownload: (options) => ipcRenderer.invoke('transfer:startDownload', options),
  pauseDownload: () => ipcRenderer.invoke('transfer:pauseDownload'),
  cancelDownload: (id) => ipcRenderer.invoke('transfer:cancelDownload', id),
  cancelAll: () => ipcRenderer.invoke('transfer:cancelAll'),
  setConcurrency: (n) => ipcRenderer.invoke('transfer:setConcurrency', n),

  // ─── Download Events ─────────────────────────────────────
  onProgress: (callback) => {
    ipcRenderer.on('transfer:onProgress', (_, data) => callback(data));
  },
  onCompleted: (callback) => {
    ipcRenderer.on('transfer:onCompleted', (_, data) => callback(data));
  },
  onError: (callback) => {
    ipcRenderer.on('transfer:onError', (_, data) => callback(data));
  },
  onQueued: (callback) => {
    ipcRenderer.on('transfer:onQueued', (_, data) => callback(data));
  },
  onRetry: (callback) => {
    ipcRenderer.on('transfer:onRetry', (_, data) => callback(data));
  },
  onStats: (callback) => {
    ipcRenderer.on('transfer:onStats', (_, data) => callback(data));
  },

  // ─── Logs ─────────────────────────────────────────────────
  onLog: (callback) => {
    ipcRenderer.on('transfer:onLog', (_, entry) => callback(entry));
  },
  getLogs: () => ipcRenderer.invoke('transfer:getLogs'),
  clearLogs: () => ipcRenderer.invoke('transfer:clearLogs'),
  exportLogs: () => ipcRenderer.invoke('transfer:exportLogs'),

  // ─── File System ──────────────────────────────────────────
  selectFolder: () => ipcRenderer.invoke('transfer:selectFolder'),
  openFolder: (path) => ipcRenderer.invoke('transfer:openFolder', path),

  // ─── Stats ────────────────────────────────────────────────
  getStats: () => ipcRenderer.invoke('transfer:getStats'),
  exportStats: (csvData) => ipcRenderer.invoke('transfer:exportStats', csvData),

  // ─── History ──────────────────────────────────────────────
  getHistory: () => ipcRenderer.invoke('transfer:getHistory'),
  saveHistory: (history) => ipcRenderer.invoke('transfer:saveHistory', history),
});
