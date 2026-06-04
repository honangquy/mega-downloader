/**
 * Utility functions for TransferIT Downloader
 */

/**
 * Format bytes into human readable string
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Get file extension from filename
 * @param {string} filename 
 * @returns {string} lowercase extension without dot
 */
function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Classify file type by extension
 * @param {string} ext 
 * @returns {string}
 */
function classifyFileType(ext) {
  const map = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif'],
    video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp'],
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'],
    document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'csv'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'],
    code: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'html', 'css', 'json', 'xml', 'sql'],
    executable: ['exe', 'msi', 'dmg', 'app', 'deb', 'rpm', 'apk'],
  };

  for (const [type, extensions] of Object.entries(map)) {
    if (extensions.includes(ext)) return type;
  }
  return 'other';
}

/**
 * Generate a short unique ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/**
 * Format duration in seconds to human readable
 * @param {number} seconds 
 * @returns {string}
 */
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

/**
 * Format speed (bytes per second) to human readable
 * @param {number} bytesPerSec 
 * @returns {string}
 */
function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return formatBytes(bytesPerSec) + '/s';
}

/**
 * Extract transfer.it hash from various URL formats
 * @param {string} input 
 * @returns {string|null}
 */
function extractTransferHash(input) {
  const trimmed = input.trim();
  // Match: https://transfer.it/t/HASH or transfer.it/t/HASH
  const match = trimmed.match(/(?:https?:\/\/)?transfer\.it\/t\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  // Maybe it's just the hash itself (alphanumeric, 8-16 chars)
  if (/^[A-Za-z0-9_-]{8,16}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Get file type icon emoji
 * @param {string} type 
 * @returns {string}
 */
function getFileTypeIcon(type) {
  const icons = {
    image: '<i data-lucide="image" style="width:16px;height:16px"></i>',
    video: '<i data-lucide="film" style="width:16px;height:16px"></i>',
    audio: '<i data-lucide="music" style="width:16px;height:16px"></i>',
    document: '<i data-lucide="file-text" style="width:16px;height:16px"></i>',
    archive: '<i data-lucide="package" style="width:16px;height:16px"></i>',
    code: '<i data-lucide="code" style="width:16px;height:16px"></i>',
    executable: '<i data-lucide="monitor-play" style="width:16px;height:16px"></i>',
    other: '<i data-lucide="file" style="width:16px;height:16px"></i>'
  };
  return icons[type] || icons.other;
}

module.exports = {
  formatBytes,
  getFileExtension,
  classifyFileType,
  generateId,
  formatDuration,
  formatSpeed,
  extractTransferHash,
  getFileTypeIcon
};
