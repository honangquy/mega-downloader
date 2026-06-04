/**
 * Logger — Event-based logging system
 */

const { EventEmitter } = require('events');

class Logger extends EventEmitter {
  constructor() {
    super();
    this.entries = [];
    this.maxEntries = 10000;
  }

  /**
   * Add a log entry
   * @param {'info'|'success'|'warning'|'error'|'debug'} level
   * @param {string} message
   * @param {Object} data
   */
  log(level, message, data = {}) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      level,
      message,
      data
    };

    this.entries.push(entry);

    // Trim old entries if too many
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.emit('log', entry);
    return entry;
  }

  info(msg, data) { return this.log('info', msg, data); }
  success(msg, data) { return this.log('success', msg, data); }
  warn(msg, data) { return this.log('warning', msg, data); }
  error(msg, data) { return this.log('error', msg, data); }
  debug(msg, data) { return this.log('debug', msg, data); }

  /**
   * Get log entries with optional filter
   */
  getEntries(filter = {}) {
    let result = [...this.entries];

    if (filter.level) {
      result = result.filter(e => e.level === filter.level);
    }

    if (filter.search) {
      const search = filter.search.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(search));
    }

    if (filter.since) {
      result = result.filter(e => e.timestamp >= filter.since);
    }

    return result;
  }

  /**
   * Clear all entries
   */
  clear() {
    this.entries = [];
    this.emit('log', {
      id: 'clear',
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      level: 'info',
      message: 'Đã xóa nhật ký',
      data: {}
    });
  }

  /**
   * Export entries as plain text
   * @returns {string}
   */
  export() {
    const levelIcons = {
      info: '[INFO]',
      success: '[OK]',
      warning: '[WARN]',
      error: '[ERROR]',
      debug: '[DEBUG]'
    };

    const lines = this.entries.map(e => {
      const icon = levelIcons[e.level] || '[-]';
      return `[${e.timeStr}] ${icon} ${e.message}`;
    });

    return `TransferIT Downloader — Nhật ký\nXuất lúc: ${new Date().toLocaleString('vi-VN')}\n${'─'.repeat(60)}\n${lines.join('\n')}`;
  }
}

module.exports = { Logger };
