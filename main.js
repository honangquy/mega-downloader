const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { TransferResolver } = require('./src/resolver');
const { DownloadEngine } = require('./src/downloader');
const { Logger } = require('./src/logger');

let mainWindow;
let resolver;
let downloader;
let logger;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0e17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Dev tools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

const historyPath = path.join(app.getPath('userData'), 'history.json');
const logPath = path.join(app.getPath('userData'), 'logs.json');

function initServices() {
  logger = new Logger();
  resolver = new TransferResolver(logger);
  downloader = new DownloadEngine({ logger });

  const fs = require('fs');
  // Restore history
  try {
    if (fs.existsSync(historyPath)) {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      downloader.loadHistory(history);
    }
  } catch (err) {}

  // Restore logs
  try {
    if (fs.existsSync(logPath)) {
      logger.entries = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
  } catch (err) {}

  // Save logs automatically
  logger.on('log', (entry) => {
    try {
      fs.writeFileSync(logPath, JSON.stringify(logger.entries), 'utf8');
    } catch(e) {}
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer:onLog', entry);
    }
  });

  // Forward download events to renderer
  downloader.on('progress', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer:onProgress', data);
    }
  });

  downloader.on('completed', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer:onCompleted', data);
    }
  });

  downloader.on('error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer:onError', data);
    }
  });

  downloader.on('queued', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer:onQueued', data);
    }
  });

  downloader.on('retry', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer:onRetry', data);
    }
  });

  downloader.on('stats', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer:onStats', data);
    }
  });
}

// ─── IPC Handlers ───────────────────────────────────────────────

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// Resolve links
ipcMain.handle('transfer:resolveLinks', async (event, urls) => {
  logger.info(`Bắt đầu phân tích ${urls.length} link...`);
  const results = await resolver.resolveAll(urls, (progress) => {
    mainWindow.webContents.send('transfer:onResolveProgress', progress);
  });
  const liveCount = results.filter(r => r.status === 'live').length;
  const deadCount = results.filter(r => r.status === 'die').length;
  logger.info(`Kết quả: ${liveCount} live, ${deadCount} expired`);
  return results;
});

// Start download
ipcMain.handle('transfer:startDownload', async (event, { files, savePath, concurrency, maxRetries }) => {
  downloader.setSavePath(savePath);
  downloader.setConcurrency(concurrency || 3);
  downloader.setMaxRetries(maxRetries || 3);
  logger.info(`Bắt đầu tải ${files.length} file vào ${savePath} (${concurrency} song song)`);
  await downloader.addFiles(files);
  return { success: true };
});

// Pause/Resume
ipcMain.handle('transfer:pauseDownload', () => {
  downloader.togglePause();
  return { paused: downloader.isPaused };
});

// Cancel specific download
ipcMain.handle('transfer:cancelDownload', (event, id) => {
  downloader.cancel(id);
  return { success: true };
});

// Cancel all
ipcMain.handle('transfer:cancelAll', () => {
  downloader.cancelAll();
  return { success: true };
});

// Update concurrency
ipcMain.handle('transfer:setConcurrency', (event, n) => {
  downloader.setConcurrency(n);
  return { success: true };
});

// Select folder dialog
ipcMain.handle('transfer:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Chọn thư mục lưu file'
  });
  return result.canceled ? null : result.filePaths[0];
});

// Open folder in file explorer
ipcMain.handle('transfer:openFolder', async (event, folderPath) => {
  shell.openPath(folderPath);
});

// Get log entries
ipcMain.handle('transfer:getLogs', () => {
  return logger.getEntries();
});

// Clear logs
ipcMain.handle('transfer:clearLogs', () => {
  logger.clear();
  return { success: true };
});

// Export logs
ipcMain.handle('transfer:exportLogs', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Xuất nhật ký',
    defaultPath: `transferit-log-${new Date().toISOString().slice(0, 10)}.txt`,
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (!result.canceled) {
    const content = logger.export();
    require('fs').writeFileSync(result.filePath, content, 'utf8');
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// Export stats CSV
ipcMain.handle('transfer:exportStats', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Xuất báo cáo',
    defaultPath: `transferit-report-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (!result.canceled) {
    require('fs').writeFileSync(result.filePath, data, 'utf8');
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// Get download stats
ipcMain.handle('transfer:getStats', () => {
  return downloader.getStats();
});

// History Persistence
ipcMain.handle('transfer:getHistory', () => {
  try {
    if (require('fs').existsSync(historyPath)) {
      const data = require('fs').readFileSync(historyPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger?.error('Failed to read history: ' + err.message);
  }
  return [];
});

ipcMain.handle('transfer:saveHistory', (event, history) => {
  try {
    require('fs').writeFileSync(historyPath, JSON.stringify(history), 'utf8');
    return { success: true };
  } catch (err) {
    logger?.error('Failed to save history: ' + err.message);
    return { success: false };
  }
});

// ─── App Lifecycle ──────────────────────────────────────────────

app.whenReady().then(() => {
  initServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  downloader?.cancelAll();
});
