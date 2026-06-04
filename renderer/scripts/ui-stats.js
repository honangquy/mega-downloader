/**
 * ui-stats.js — Statistics dashboard with Chart.js charts
 */

(function() {
  let fileTypeChart = null;
  let fileSizeChart = null;
  let speedChart = null;

  const chartColors = {
    image: '#f472b6',
    video: '#60a5fa',
    audio: '#a78bfa',
    document: '#34d399',
    archive: '#fbbf24',
    code: '#f97316',
    executable: '#ef4444',
    other: '#94a3b8'
  };

  const chartLabels = {
    image: 'Hình ảnh',
    video: 'Video',
    audio: 'Âm thanh',
    document: 'Tài liệu',
    archive: 'Nén',
    code: 'Mã nguồn',
    executable: 'Thực thi',
    other: 'Khác'
  };

  // ─── Refresh stats ────────────────────────────────────────────
  window.refreshStats = async function() {
    try {
      const stats = await window.electronAPI.getStats();
      updateStatCards(stats);
      updateCharts(stats);
      updateTable(stats);
    } catch (err) {
      console.error('Failed to refresh stats:', err);
    }
  };

  // ─── Update stat cards ────────────────────────────────────────
  function updateStatCards(stats) {
    animateNumber('statTotal', stats.total || 0);
    animateNumber('statCompleted', stats.completed || 0);
    animateNumber('statFailed', stats.failed || 0);
    animateNumber('statSkipped', stats.skipped || 0);
    document.getElementById('statTotalSize').textContent = stats.totalFormatted || '0 B';
    document.getElementById('statAvgSpeed').textContent = stats.avgSpeedFormatted || '0 B/s';
  }

  function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 500;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(current + (target - current) * eased);
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  // ─── Update charts ────────────────────────────────────────────
  function updateCharts(stats) {
    // Wait for Chart.js to load
    if (typeof Chart === 'undefined') return;

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
            font: { family: 'Inter', size: 11 },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        }
      }
    };

    // ── File Type Distribution (Doughnut) ──
    const typeData = stats.typeDistribution || {};
    const typeLabels = Object.keys(typeData);
    const typeValues = Object.values(typeData);
    const typeColors = typeLabels.map(t => chartColors[t] || chartColors.other);

    if (fileTypeChart) {
      fileTypeChart.data.labels = typeLabels.map(t => chartLabels[t] || t);
      fileTypeChart.data.datasets[0].data = typeValues;
      fileTypeChart.data.datasets[0].backgroundColor = typeColors;
      fileTypeChart.update('none');
    } else if (typeLabels.length > 0) {
      const ctx = document.getElementById('chartFileTypes')?.getContext('2d');
      if (ctx) {
        fileTypeChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: typeLabels.map(t => chartLabels[t] || t),
            datasets: [{
              data: typeValues,
              backgroundColor: typeColors,
              borderWidth: 0,
              hoverOffset: 8
            }]
          },
          options: {
            ...chartDefaults,
            cutout: '65%',
            plugins: {
              ...chartDefaults.plugins,
              legend: {
                ...chartDefaults.plugins.legend,
                position: 'right'
              }
            }
          }
        });
      }
    }

    // ── File Size by Type (Bar) ──
    const sizeData = stats.typeSizeDistribution || {};
    const sizeLabels = Object.keys(sizeData);
    const sizeValues = Object.values(sizeData).map(v => v / (1024 * 1024)); // Convert to MB
    const sizeColors = sizeLabels.map(t => chartColors[t] || chartColors.other);

    if (fileSizeChart) {
      fileSizeChart.data.labels = sizeLabels.map(t => chartLabels[t] || t);
      fileSizeChart.data.datasets[0].data = sizeValues;
      fileSizeChart.data.datasets[0].backgroundColor = sizeColors;
      fileSizeChart.update('none');
    } else if (sizeLabels.length > 0) {
      const ctx = document.getElementById('chartFileSizes')?.getContext('2d');
      if (ctx) {
        fileSizeChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: sizeLabels.map(t => chartLabels[t] || t),
            datasets: [{
              data: sizeValues,
              backgroundColor: sizeColors,
              borderRadius: 6,
              borderSkipped: false
            }]
          },
          options: {
            ...chartDefaults,
            plugins: {
              ...chartDefaults.plugins,
              legend: { display: false }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(),
                  font: { family: 'Inter', size: 10 }
                }
              },
              y: {
                grid: { color: 'rgba(139, 148, 158, 0.06)' },
                ticks: {
                  color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(),
                  font: { family: 'Inter', size: 10 },
                  callback: v => v.toFixed(1) + ' MB'
                }
              }
            }
          }
        });
      }
    }

    // ── Speed Over Time (Line) ──
    const speedHistory = stats.speedHistory || [];
    if (speedHistory.length > 0) {
      const speedLabels = speedHistory.map((_, i) => i);
      const speedValues = speedHistory.map(s => (s.speed || 0) / (1024 * 1024)); // MB/s

      if (speedChart) {
        speedChart.data.labels = speedLabels;
        speedChart.data.datasets[0].data = speedValues;
        speedChart.update('none');
      } else {
        const ctx = document.getElementById('chartSpeed')?.getContext('2d');
        if (ctx) {
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

          speedChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: speedLabels,
              datasets: [{
                data: speedValues,
                borderColor: '#6366f1',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4
              }]
            },
            options: {
              ...chartDefaults,
              plugins: {
                ...chartDefaults.plugins,
                legend: { display: false }
              },
              scales: {
                x: {
                  display: false
                },
                y: {
                  grid: { color: 'rgba(139, 148, 158, 0.06)' },
                  ticks: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(),
                    font: { family: 'Inter', size: 10 },
                    callback: v => v.toFixed(1) + ' MB/s'
                  }
                }
              },
              interaction: {
                intersect: false,
                mode: 'index'
              }
            }
          });
        }
      }
    }
  }

  // ─── Update details table ─────────────────────────────────────
  function updateTable(stats) {
    const tbody = document.getElementById('statsTableBody');
    const files = stats.fileDetails || [];

    if (files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:var(--space-6)">Chưa có dữ liệu</td></tr>';
      return;
    }

    tbody.innerHTML = files.map(f => {
      const statusIcon = f.status === 'completed' ? '<i data-lucide="check-circle-2" style="width:14px;height:14px;color:var(--success)"></i>' : (f.status === 'failed' ? '<i data-lucide="x-circle" style="width:14px;height:14px;color:var(--error)"></i>' : (f.status === 'downloading' ? '<i data-lucide="loader-2" class="spin" style="width:14px;height:14px"></i>' : '<i data-lucide="pause" style="width:14px;height:14px"></i>'));
      
      const statusText = {
        completed: 'Thành công',
        failed: f.error || 'Thất bại',
        downloading: `${f.progress}%`,
        queued: 'Đang chờ',
        cancelled: 'Đã hủy',
        paused: 'Tạm dừng'
      }[f.status] || f.status;

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:var(--space-2)">
              <span>${getFileTypeIcon(f.type)}</span>
              <span class="truncate" style="max-width:220px" title="${f.name}">${f.name}</span>
            </div>
          </td>
          <td class="font-mono text-xs">${f.sizeFormatted}</td>
          <td><span class="badge badge-info">${f.type}</span></td>
          <td>${statusIcon} ${statusText}</td>
        </tr>
      `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
  }

  // ─── Export CSV ───────────────────────────────────────────────
  document.getElementById('btnExportStats').addEventListener('click', async () => {
    try {
      const stats = await window.electronAPI.getStats();
      const files = stats.fileDetails || [];

      const csv = [
        'Tên file,Dung lượng (bytes),Loại,Trạng thái',
        ...files.map(f => `"${f.name}",${f.size},"${f.type}","${f.status}"`)
      ].join('\n');

      const bom = '\ufeff'; // UTF-8 BOM for Excel
      const result = await window.electronAPI.exportStats(bom + csv);

      if (result.success) {
        const btn = document.getElementById('btnExportStats');
        btn.innerHTML = '<i data-lucide="check"></i> Đã xuất!';
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = '<i data-lucide="file-spreadsheet"></i> Xuất báo cáo .csv';
          if (window.lucide) window.lucide.createIcons();
        }, 2000);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  });

  // ─── Auto-refresh when on stats tab ───────────────────────────
  setInterval(() => {
    if (AppState.currentTab === 'stats') {
      refreshStats();
    }
  }, 3000);

})();
