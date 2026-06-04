/**
 * TransferIT Link Resolver
 * Resolves transfer.it links to MEGA file metadata using the MEGA API
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { default: PQueue } = require('p-queue');
const { extractTransferHash, getFileExtension, classifyFileType, formatBytes, generateId } = require('./utils');

class TransferResolver {
  constructor(logger) {
    this.logger = logger;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
  }

  /**
   * Resolve a single transfer.it link
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async resolve(url) {
    const hash = extractTransferHash(url);
    if (!hash) {
      return { url, status: 'invalid', error: 'URL không hợp lệ', files: [] };
    }

    try {
      // Step 1: Call MEGA API with "xi" action to get transfer node info
      const nodeInfo = await this.getTransferNodeInfo(hash);

      if (nodeInfo.error) {
        this.logger.error(`${hash}: ${nodeInfo.error}`);
        return { url, hash, status: 'die', error: nodeInfo.error, files: [] };
      }

      // Step 2: Get the file listing using the transfer node
      const files = await this.getFileList(nodeInfo, hash);

      if (files.length === 0) {
        this.logger.error(`${hash}: Link rỗng hoặc file đã bị xóa`);
        return { url, hash, status: 'die', error: 'Link rỗng hoặc file đã bị xóa', files: [] };
      }

      this.logger.success(`${hash}: ${files.length} file(s) (${formatBytes(files.reduce((s, f) => s + (f.size || 0), 0))})`);

      return {
        url,
        hash,
        status: 'live',
        files,
        totalSize: files.reduce((s, f) => s + (f.size || 0), 0),
        fileCount: files.length
      };
    } catch (err) {
      this.logger.error(`${hash}: ${err.message}`);
      return { url, hash, status: 'die', error: err.message, files: [] };
    }
  }

  /**
   * Get transfer node info from MEGA API via "xi" action
   */
  async getTransferNodeInfo(hash) {
    try {
      const apiHost = 'https://g.api.mega.co.nz/cs';
      const xiResult = await this.megaApiCall(apiHost, [{ a: 'xi', xh: hash }], hash);

      if (typeof xiResult[0] === 'number' && xiResult[0] < 0) {
        // MEGA error codes
        const errorMap = {
          '-2': 'Đối số không hợp lệ',
          '-6': 'Quá nhiều request',
          '-9': 'Link không tồn tại hoặc đã hết hạn',
          '-11': 'Truy cập bị từ chối',
          '-14': 'Tài nguyên tạm thời không khả dụng',
          '-16': 'Link đã bị xóa do vi phạm ToS',
          '-17': 'Link đã hết hạn',
          '-18': 'Link đã hết hạn',
        };
        const errorCode = xiResult[0].toString();
        return { error: errorMap[errorCode] || `MEGA error: ${errorCode}` };
      }

      return { nodeInfo: xiResult[0], apiHost };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Get file list from the transfer node
   */
  async getFileList(nodeData, hash) {
    try {
      const { apiHost } = nodeData;

      // Call "f" action to get folder listing
      const fileResult = await this.megaApiCall(apiHost, [
        { a: 'f', c: 1, r: 1, xnc: 1 }
      ], hash);

      if (!fileResult || !fileResult[0] || !fileResult[0].f) {
        return [];
      }

      const nodes = fileResult[0].f;
      let transferTitle = '';
      if (nodeData.nodeInfo && nodeData.nodeInfo.t) {
        try {
          transferTitle = Buffer.from(nodeData.nodeInfo.t, 'base64').toString('utf8');
        } catch (e) {}
      }

      const files = [];
      const fileNodes = nodes.filter(n => n.t === 0);

      for (const node of fileNodes) {
        const attrs = this.decryptNodeAttributes(node);
        let name = attrs.name || '';
        
        if (!name && transferTitle) {
          name = fileNodes.length === 1 ? transferTitle : `${transferTitle}_${node.h}`;
        }
        
        if (!name) {
          name = `file_${node.h}`;
        }

        const ext = getFileExtension(name);
        files.push({
          id: generateId(),
          nodeHandle: node.h,
          name: name,
          size: node.s || 0,
          sizeFormatted: formatBytes(node.s || 0),
          extension: ext,
          type: classifyFileType(ext),
          transferHash: hash,
          megaNode: node,
          selected: true
        });
      }

      return files;
    } catch (err) {
      this.logger.warn(`Lỗi khi lấy danh sách file: ${err.message}`);
      return [];
    }
  }

  /**
   * Try to decrypt MEGA node attributes (best effort)
   */
  decryptNodeAttributes(node) {
    try {
      // MEGA encrypts file attributes — for transfer links, 
      // the attributes may be available in the "a" field as base64url
      if (node.a) {
        // Try to decode base64url attribute string
        // In transfer context, attributes may already be decrypted
        const decoded = Buffer.from(node.a.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        const str = decoded.toString('utf8');

        // MEGA attributes format: MEGA{"n":"filename.ext"}
        const match = str.match(/MEGA\{(.*)\}/s);
        if (match) {
          const parsed = JSON.parse(`{${match[1]}}`);
          return { name: parsed.n || '' };
        }
      }

      // Fallback: check if name is directly available
      if (node.name) return { name: node.name };

      return { name: '' };
    } catch {
      return { name: '' };
    }
  }

  /**
   * Make a call to MEGA API
   */
  megaApiCall(baseUrl, data, transferHash) {
    return new Promise((resolve, reject) => {
      const queryId = Math.floor(Math.random() * 1000000000);
      let urlStr = `${baseUrl}?id=${queryId}&v=3&lang=vi&domain=transferit&bc=1`;
      if (transferHash) {
        urlStr += `&x=${transferHash}`;
      }

      const urlObj = new URL(urlStr);
      const postData = JSON.stringify(data);

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'https://transfer.it',
          'Referer': 'https://transfer.it/',
          'User-Agent': this.userAgent,
          'Accept': '*/*',
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch {
            reject(new Error(`Phản hồi không hợp lệ từ MEGA API`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Lỗi kết nối: ${err.message}`)));
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Timeout kết nối MEGA API'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Resolve multiple links with progress callback
   * @param {string[]} urls
   * @param {Function} onProgress
   * @returns {Promise<Object[]>}
   */
  async resolveAll(urls, onProgress) {
    const results = [];
    const total = urls.length;
    let completed = 0;

    // Use p-queue for concurrent processing (3-5 links at a time)
    const queue = new PQueue({ concurrency: 4 });

    const promises = urls.map(url => queue.add(async () => {
      let result;
      let retries = 0;
      const maxRetries = 3;

      while (retries <= maxRetries) {
        result = await this.resolve(url);
        
        // Handle MEGA rate limiting (-6) with exponential backoff
        if (result.error && result.error.includes('Quá nhiều request')) {
          retries++;
          if (retries <= maxRetries) {
            this.logger.warn(`Bị chặn Rate Limit (lỗi -6) cho ${result.hash || url}. Thử lại lần ${retries}...`);
            await new Promise(r => setTimeout(r, 2000 * retries)); // 2s, 4s, 6s...
            continue;
          }
        }
        break;
      }

      completed++;
      results.push(result);

      if (onProgress) {
        onProgress({
          current: completed,
          total,
          percent: Math.round((completed / total) * 100),
          lastResult: result
        });
      }
    }));

    await Promise.all(promises);
    return results;
  }
}

module.exports = { TransferResolver };
