/**
 * Download Engine — manages concurrent file downloads from MEGA
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { formatBytes, formatSpeed, generateId } = require('./utils');

class DownloadEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 3;
    this.maxRetries = options.maxRetries || 3;
    this.savePath = options.savePath || '';
    this.logger = options.logger;

    // Download state
    this.downloads = new Map();       // id → download state
    this.activeDownloads = new Map(); // id → { stream, abortController }
    this.queue = [];                  // pending file items
    this.activeCount = 0;
    this.isPaused = false;
    this.startTime = null;

    // Stats tracking
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      downloading: 0,
      queued: 0,
      totalBytes: 0,
      downloadedBytes: 0,
      speeds: [],
      speedHistory: []
    };
  }

  setSavePath(p) { this.savePath = p; }
  setConcurrency(n) {
    this.concurrency = Math.max(1, Math.min(10, n));
    this._processQueue();
  }
  setMaxRetries(n) { this.maxRetries = Math.max(0, Math.min(10, n)); }

  /**
   * Load history from disk to restore stats
   */
  loadHistory(history) {
    if (!Array.isArray(history)) return;
    for (const item of history) {
      if (!this.downloads.has(item.id)) {
        this.downloads.set(item.id, item);
        this.stats.total++;
        if (item.status === 'completed' || item.status === 'exists') this.stats.completed++;
        else if (item.status === 'failed') this.stats.failed++;
        else if (item.status === 'cancelled') this.stats.skipped++;
        this.stats.totalBytes += item.size || 0;
        if (item.status === 'completed' || item.status === 'exists') {
          this.stats.downloadedBytes += item.size || 0;
        }
      }
    }
  }

  /**
   * Add files to the download queue
   */
  async addFiles(files) {
    this.startTime = this.startTime || Date.now();

    for (const file of files) {
      const downloadItem = {
        id: file.id || generateId(),
        name: file.name,
        size: file.size || 0,
        type: file.type,
        extension: file.extension,
        transferHash: file.transferHash,
        megaNode: file.megaNode,
        status: 'queued',       // queued | downloading | completed | failed | paused | cancelled
        progress: 0,
        downloadedBytes: 0,
        speed: 0,
        eta: 0,
        retries: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        filePath: ''
      };

      this.downloads.set(downloadItem.id, downloadItem);
      this.queue.push(downloadItem);
      this.stats.total++;
      this.stats.queued++;
      this.stats.totalBytes += file.size || 0;

      this.emit('queued', { ...downloadItem });
    }

    this._processQueue();
  }

  /**
   * Process queued downloads respecting concurrency limit
   */
  _processQueue() {
    if (this.isPaused) return;

    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (item && item.status === 'queued') {
        this.stats.queued--;
        this._downloadFile(item);
      }
    }
  }

  /**
   * Download a single file
   */
  async _downloadFile(item) {
    this.activeCount++;
    this.stats.downloading++;
    item.status = 'downloading';
    item.startedAt = Date.now();

    this.emit('progress', this._serializeItem(item));
    this.logger?.info(`Đang tải: ${item.name} (${formatBytes(item.size)})`);

    try {
      // Ensure save directory exists
      if (!fs.existsSync(this.savePath)) {
        fs.mkdirSync(this.savePath, { recursive: true });
      }

      // Check if file already exists in savePath
      item.filePath = path.join(this.savePath, item.name);
      if (fs.existsSync(item.filePath)) {
        item.status = 'exists';
        item.progress = 100;
        item.completedAt = Date.now();
        this.stats.skipped++;
        this.logger?.info(`Đã tồn tại, bỏ qua: ${item.name}`);
        this.emit('completed', this._serializeItem(item));
        
        // Finalize state properly
        this.activeCount--;
        this.stats.downloading--;
        this.activeDownloads.delete(item.id);
        this._emitStats();
        this._processQueue();
        return;
      }

      // Get the download URL from MEGA node
      const downloadUrl = await this._getMegaDownloadUrl(item);

      if (!downloadUrl) {
        throw new Error('Không thể lấy URL tải xuống');
      }

      // Download with progress tracking
      await this._executeDownload(item, downloadUrl);

      // Success
      item.status = 'completed';
      item.progress = 100;
      item.completedAt = Date.now();
      this.stats.completed++;
      this.stats.downloadedBytes += item.size;

      this.logger?.success(`Hoàn thành: ${item.name} (${formatBytes(item.size)})`);
      this.emit('completed', this._serializeItem(item));

    } catch (err) {
      if (item.status === 'cancelled') {
        return; // Don't retry if manually cancelled
      }

      item.retries++;
      if (item.retries <= this.maxRetries) {
        // Retry
        this.logger?.warn(`${item.name}: Thử lại lần ${item.retries}/${this.maxRetries} (${err.message})`);
        item.status = 'queued';
        item.progress = 0;
        item.downloadedBytes = 0;
        this.stats.queued++;
        this.queue.unshift(item); // Priority re-queue

        this.emit('retry', { ...this._serializeItem(item), error: err.message });
      } else {
        // Final failure
        item.status = 'failed';
        item.error = err.message;
        item.completedAt = Date.now();
        this.stats.failed++;

        this.logger?.error(`Thất bại: ${item.name} sau ${this.maxRetries} lần thử (${err.message})`);
        this.emit('error', { ...this._serializeItem(item), error: err.message });

        // Clean up partial file
        if (item.filePath && fs.existsSync(item.filePath)) {
          try { fs.unlinkSync(item.filePath); } catch { }
        }
      }
    } finally {
      this.activeCount--;
      this.stats.downloading--;
      this.activeDownloads.delete(item.id);
      this._emitStats();
      this._processQueue();
    }
  }

  /**
   * Get download URL from MEGA
   */
  async _getMegaDownloadUrl(item) {
    const node = item.megaNode;
    if (!node || !node.h) return null;

    // Call MEGA API to get the download link
    const queryId = Math.floor(Math.random() * 1000000000);
    const apiUrl = `https://g.api.mega.co.nz/cs?id=${queryId}&v=3&domain=transferit&x=${item.transferHash}`;

    const data = JSON.stringify([{ a: 'g', g: 1, n: node.h }]);

    return new Promise((resolve, reject) => {
      const urlObj = new URL(apiUrl);

      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Content-Length': Buffer.byteLength(data),
          'Origin': 'https://transfer.it',
          'Referer': 'https://transfer.it/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result[0] && result[0].g) {
              resolve(result[0].g);
            } else if (typeof result[0] === 'number' && result[0] === -18) {
              reject(new Error('Link đã hết hạn'));
            } else if (typeof result[0] === 'number' && result[0] === -509) {
              reject(new Error('Vượt quá giới hạn bandwidth MEGA'));
            } else {
              reject(new Error(`MEGA API error: ${JSON.stringify(result[0])}`));
            }
          } catch {
            reject(new Error('Phản hồi không hợp lệ'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Execute the actual file download with progress tracking
   */
  _executeDownload(item, downloadUrl) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(item.filePath);
      let downloadedBytes = 0;
      let lastProgressUpdate = Date.now();
      let lastBytes = 0;

      const urlObj = new URL(downloadUrl);

      const req = https.get({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        if (res.statusCode === 509) {
          fileStream.close();
          reject(new Error('Vượt quá giới hạn bandwidth MEGA'));
          return;
        }

        if (res.statusCode !== 200) {
          fileStream.close();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const totalSize = parseInt(res.headers['content-length'] || item.size || 0);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;

          // Update progress every 200ms to avoid UI flooding
          const now = Date.now();
          if (now - lastProgressUpdate >= 200) {
            const elapsed = (now - lastProgressUpdate) / 1000;
            const speed = (downloadedBytes - lastBytes) / elapsed;

            item.downloadedBytes = downloadedBytes;
            item.progress = totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0;
            item.speed = speed;
            item.eta = speed > 0 ? (totalSize - downloadedBytes) / speed : 0;

            this.emit('progress', this._serializeItem(item));

            // Track speed history
            this.stats.speedHistory.push({ time: now, speed });
            if (this.stats.speedHistory.length > 300) {
              this.stats.speedHistory = this.stats.speedHistory.slice(-300);
            }

            lastProgressUpdate = now;
            lastBytes = downloadedBytes;
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        res.on('error', (err) => {
          fileStream.close();
          reject(err);
        });
      });

      req.on('error', (err) => {
        fileStream.close();
        reject(err);
      });

      req.setTimeout(60000, () => {
        req.destroy();
        fileStream.close();
        reject(new Error('Timeout tải xuống'));
      });

      // Store for cancellation
      this.activeDownloads.set(item.id, { request: req, fileStream });
    });
  }

  /**
   * Get a unique file path (avoid overwriting existing files)
   */
  _getUniqueFilePath(filename) {
    let filePath = path.join(this.savePath, filename);

    if (!fs.existsSync(filePath)) return filePath;

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let counter = 1;

    while (fs.existsSync(filePath)) {
      filePath = path.join(this.savePath, `${base} (${counter})${ext}`);
      counter++;
    }

    return filePath;
  }

  /**
   * Serialize download item for IPC transfer
   */
  _serializeItem(item) {
    return {
      id: item.id,
      name: item.name,
      size: item.size,
      sizeFormatted: formatBytes(item.size),
      type: item.type,
      extension: item.extension,
      status: item.status,
      progress: item.progress,
      downloadedBytes: item.downloadedBytes,
      downloadedFormatted: formatBytes(item.downloadedBytes),
      speed: item.speed,
      speedFormatted: formatSpeed(item.speed),
      eta: item.eta,
      retries: item.retries,
      error: item.error,
      filePath: item.filePath
    };
  }

  /**
   * Emit aggregated stats
   */
  _emitStats() {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const avgSpeed = elapsed > 0 ? this.stats.downloadedBytes / elapsed : 0;

    this.emit('stats', {
      total: this.stats.total,
      completed: this.stats.completed,
      failed: this.stats.failed,
      downloading: this.stats.downloading,
      queued: this.stats.queued,
      totalBytes: this.stats.totalBytes,
      totalFormatted: formatBytes(this.stats.totalBytes),
      downloadedBytes: this.stats.downloadedBytes,
      downloadedFormatted: formatBytes(this.stats.downloadedBytes),
      percentComplete: this.stats.totalBytes > 0 ? Math.round((this.stats.downloadedBytes / this.stats.totalBytes) * 100) : 0,
      avgSpeed,
      avgSpeedFormatted: formatSpeed(avgSpeed),
      elapsed,
      speedHistory: this.stats.speedHistory.slice(-60)
    });
  }

  // ─── Public Controls ────────────────────────────────────────

  togglePause() {
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.logger?.info('Tiếp tục tải xuống');
      this._processQueue();
    } else {
      this.logger?.info('Tạm dừng tải xuống');
    }
    return this.isPaused;
  }

  cancel(id) {
    const item = this.downloads.get(id);
    if (!item) return;

    // Remove from queue
    const queueIndex = this.queue.findIndex(q => q.id === id);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
      this.stats.queued--;
    }

    // Abort active download
    const active = this.activeDownloads.get(id);
    if (active) {
      active.request?.destroy();
      active.fileStream?.close();
      this.activeDownloads.delete(id);
    }

    item.status = 'cancelled';
    this.stats.skipped++;
    this.logger?.warn(`Đã hủy: ${item.name}`);
    this.emit('completed', this._serializeItem(item));

    // Clean up partial file
    if (item.filePath && fs.existsSync(item.filePath)) {
      try { fs.unlinkSync(item.filePath); } catch { }
    }
  }

  cancelAll() {
    this.queue = [];
    this.stats.queued = 0;

    for (const [id, active] of this.activeDownloads) {
      active.request?.destroy();
      active.fileStream?.close();
      const item = this.downloads.get(id);
      if (item) {
        item.status = 'cancelled';
        if (item.filePath && fs.existsSync(item.filePath)) {
          try { fs.unlinkSync(item.filePath); } catch { }
        }
      }
    }

    this.activeDownloads.clear();
    this.activeCount = 0;
    this.stats.downloading = 0;
    this.logger?.warn('Đã hủy tất cả tải xuống');
  }

  /**
   * Retry a failed download
   */
  retry(id) {
    const item = this.downloads.get(id);
    if (!item || item.status !== 'failed') return;

    item.status = 'queued';
    item.progress = 0;
    item.downloadedBytes = 0;
    item.error = null;
    item.retries = 0;
    this.stats.failed--;
    this.stats.queued++;

    this.queue.push(item);
    this._processQueue();
  }

  /**
   * Get current stats
   */
  getStats() {
    this._emitStats();
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const avgSpeed = elapsed > 0 ? this.stats.downloadedBytes / elapsed : 0;

    // File type distribution
    const typeDistribution = {};
    const typeSizeDistribution = {};
    const fileDetails = [];

    for (const [, item] of this.downloads) {
      const type = item.type || 'other';
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
      typeSizeDistribution[type] = (typeSizeDistribution[type] || 0) + (item.size || 0);

      fileDetails.push(this._serializeItem(item));
    }

    return {
      ...this.stats,
      totalFormatted: formatBytes(this.stats.totalBytes),
      downloadedFormatted: formatBytes(this.stats.downloadedBytes),
      percentComplete: this.stats.totalBytes > 0 ? Math.round((this.stats.downloadedBytes / this.stats.totalBytes) * 100) : 0,
      avgSpeed,
      avgSpeedFormatted: formatSpeed(avgSpeed),
      elapsed,
      typeDistribution,
      typeSizeDistribution,
      speedHistory: this.stats.speedHistory,
      fileDetails
    };
  }
}

module.exports = { DownloadEngine };
