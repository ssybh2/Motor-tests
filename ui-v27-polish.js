(() => {
  'use strict';

  function uiScale() {
    const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v27-ui-scale'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function fitFormula(node) {
    if (!(node instanceof HTMLElement)) return;
    const s = uiScale();
    const max = 18 * s;
    const min = 9.5 * s;
    let size = max;
    node.style.fontSize = `${size}px`;
    node.style.overflowX = 'hidden';
    const fits = () => node.scrollWidth <= node.clientWidth + 2;
    while (!fits() && size > min) {
      size -= Math.max(.5, .5 * s);
      node.style.fontSize = `${size}px`;
    }
  }

  function fitAllResultFormulas(root = document) {
    root.querySelectorAll?.('.job-result-pane-v27 .result-formula').forEach(fitFormula);
  }

  function text(node, fallback = '') {
    const value = node?.textContent?.trim();
    return value || fallback;
  }

  function safeFilename(value) {
    return String(value || 'UAV-Propulsion-Fit-Report')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'UAV-Propulsion-Fit-Report';
  }

  function collectResultCards() {
    const nodes = [
      ...document.querySelectorAll('.job-result-pane-v27 .result-card'),
      ...document.querySelectorAll('#results > .result-card')
    ];
    return Array.from(new Set(nodes));
  }

  function cloneLayout(value) {
    try {
      if (typeof structuredClone === 'function') return structuredClone(value || {});
    } catch (_) {}
    try { return JSON.parse(JSON.stringify(value || {})); } catch (_) { return {}; }
  }

  function normalizeAxisTitle(title, size) {
    if (!title) return { font: { size } };
    if (typeof title === 'string') return { text: title, font: { size } };
    return { ...title, font: { ...(title.font || {}), size } };
  }

  async function fixedPlotImage(plot, width = 540, height = 285) {
    if (!(plot instanceof HTMLElement) || !window.Plotly?.newPlot || !window.Plotly?.toImage) return '';
    const holder = document.createElement('div');
    holder.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;background:#fff;`;
    document.body.appendChild(holder);

    const layout = cloneLayout(plot.layout || {});
    layout.width = width;
    layout.height = height;
    layout.autosize = false;
    layout.paper_bgcolor = '#ffffff';
    layout.plot_bgcolor = '#ffffff';
    layout.font = { ...(layout.font || {}), family: 'Arial, sans-serif', size: 12, color: '#344054' };
    layout.margin = { l: 66, r: 20, t: 44, b: 58 };
    if (layout.title) layout.title = typeof layout.title === 'string'
      ? { text: layout.title, font: { size: 14 } }
      : { ...layout.title, font: { ...(layout.title.font || {}), size: 14 } };
    layout.legend = { ...(layout.legend || {}), font: { ...(layout.legend?.font || {}), size: 10 }, orientation: 'h', y: 1.05, x: .5, xanchor: 'center' };
    layout.xaxis = { ...(layout.xaxis || {}), automargin: true, tickfont: { ...(layout.xaxis?.tickfont || {}), size: 10 }, title: normalizeAxisTitle(layout.xaxis?.title, 12) };
    layout.yaxis = { ...(layout.yaxis || {}), automargin: true, tickfont: { ...(layout.yaxis?.tickfont || {}), size: 10 }, title: normalizeAxisTitle(layout.yaxis?.title, 12) };

    try {
      await window.Plotly.newPlot(holder, plot.data || [], layout, { staticPlot: true, displayModeBar: false, responsive: false });
      return await window.Plotly.toImage(holder, { format: 'png', width, height, scale: 2 });
    } catch (err) {
      console.warn('PDF plot render failed', err);
      return '';
    } finally {
      try { window.Plotly.purge(holder); } catch (_) {}
      holder.remove();
    }
  }

  function reportMeta() {
    const input = document.getElementById('fileInput');
    const source = input?.files?.[0]?.name || text(document.getElementById('previewDatasetSelect')?.selectedOptions?.[0], 'Loaded dataset');
    return {
      title: document.getElementById('reportTitle')?.value?.trim() || 'UAV Propulsion Fit Report',
      notes: document.getElementById('reportNotes')?.value?.trim() || '—',
      source,
      generated: new Date().toLocaleString(),
      count: collectResultCards().filter(card => !card.querySelector('.result-error')).length
    };
  }

  function addReportHeader(sheet, meta) {
    const header = document.createElement('div');
    header.className = 'pdf-report-header-v27';

    const left = document.createElement('div');
    left.innerHTML = '<div class="pdf-report-kicker-v27">MOTOR TESTS / PROPULSION IDENTIFICATION</div>';
    const title = document.createElement('h1');
    title.className = 'pdf-report-title-v27';
    title.textContent = meta.title;
    const sub = document.createElement('p');
    sub.className = 'pdf-report-sub-v27';
    sub.textContent = 'UAV propulsion fitting report · compact engineering layout';
    left.append(title, sub);

    const right = document.createElement('div');
    right.className = 'pdf-report-meta-v27';
    const rows = [
      ['Source', meta.source],
      ['Generated', meta.generated],
      ['Successful fits', String(meta.count)],
      ['Notes', meta.notes]
    ];
    rows.forEach(([k, v]) => {
      const key = document.createElement('span'); key.textContent = k;
      const value = document.createElement('strong'); value.textContent = v;
      right.append(key, value);
    });
    header.append(left, right);
    sheet.appendChild(header);
  }

  function metricData(card) {
    return Array.from(card.querySelectorAll('.metric')).map(node => ({
      label: text(node.querySelector('span'), 'Metric'),
      value: text(node.querySelector('strong'), '—')
    }));
  }

  async function buildResultSheet(card, index, meta) {
    const sheet = document.createElement('section');
    sheet.className = 'pdf-sheet-v27';
    addReportHeader(sheet, meta);

    const heading = document.createElement('div');
    heading.className = 'pdf-job-heading-v27';
    const headingCopy = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = text(card.querySelector('.result-head h3'), `Fit ${index + 1}`);
    const p = document.createElement('p');
    p.textContent = text(card.querySelector('.result-sub'), 'Fitted result');
    headingCopy.append(h2, p);
    const badge = document.createElement('span');
    badge.className = 'pdf-job-index-v27';
    badge.textContent = `FIT ${String(index + 1).padStart(2, '0')}`;
    heading.append(headingCopy, badge);
    sheet.appendChild(heading);

    if (card.querySelector('.result-error')) {
      const error = document.createElement('div');
      error.className = 'pdf-error-v27';
      error.textContent = text(card.querySelector('.result-error'), 'Fit failed');
      sheet.appendChild(error);
      return sheet;
    }

    const sourceFormula = card.querySelector('.result-formula');
    const formula = document.createElement('div');
    formula.className = 'pdf-equation-v27';
    if (sourceFormula) formula.innerHTML = sourceFormula.innerHTML;
    else formula.textContent = 'Equation unavailable';
    sheet.appendChild(formula);

    const metrics = document.createElement('div');
    metrics.className = 'pdf-metrics-v27';
    metricData(card).forEach(({ label, value }) => {
      const item = document.createElement('div');
      item.className = 'pdf-metric-v27';
      const l = document.createElement('span'); l.textContent = label;
      const v = document.createElement('strong'); v.textContent = value;
      item.append(l, v);
      metrics.appendChild(item);
    });
    sheet.appendChild(metrics);

    const table = card.querySelector('.coeff-table');
    if (table) {
      const box = document.createElement('div');
      box.className = 'pdf-coeff-box-v27';
      const boxTitle = document.createElement('div');
      boxTitle.className = 'pdf-box-title-v27';
      boxTitle.textContent = 'Estimated coefficients / 系数';
      box.append(boxTitle, table.cloneNode(true));
      sheet.appendChild(box);
    }

    const plots = Array.from(card.querySelectorAll('.plot'));
    if (plots.length) {
      const charts = document.createElement('div');
      charts.className = 'pdf-charts-v27';
      const images = await Promise.all(plots.slice(0, 2).map(plot => fixedPlotImage(plot)));
      images.forEach((src, i) => {
        if (!src) return;
        const box = document.createElement('div');
        box.className = 'pdf-chart-box-v27';
        const boxTitle = document.createElement('div');
        boxTitle.className = 'pdf-box-title-v27';
        boxTitle.textContent = i === 0 ? 'Fit curve / 拟合曲线' : 'Residuals / 残差';
        const img = document.createElement('img');
        img.src = src;
        box.append(boxTitle, img);
        charts.appendChild(box);
      });
      if (charts.children.length) sheet.appendChild(charts);
    }
    return sheet;
  }

  function fitPdfEquation(node) {
    let size = 30;
    node.style.fontSize = `${size}px`;
    while (node.scrollWidth > node.clientWidth + 2 && size > 15) {
      size -= 1;
      node.style.fontSize = `${size}px`;
    }
  }

  async function canvasForSheet(sheet) {
    const stage = document.createElement('div');
    stage.className = 'pdf-export-stage-v27';
    stage.appendChild(sheet);
    document.body.appendChild(stage);
    await document.fonts?.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const equation = sheet.querySelector('.pdf-equation-v27');
    if (equation) fitPdfEquation(equation);
    const canvas = await window.html2canvas(sheet, {
      backgroundColor: '#ffffff',
      scale: 1.5,
      useCORS: true,
      logging: false,
      windowWidth: 1200,
      width: 1200,
      height: Math.max(820, sheet.scrollHeight)
    });
    stage.remove();
    return canvas;
  }

  function addCanvasToPdf(pdf, canvas, addPage) {
    if (addPage) pdf.addPage('a4', 'landscape');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, 'FAST');
  }

  async function exportReadablePdf() {
    const cards = collectResultCards();
    if (!cards.length) {
      window.alert('请先运行至少一个拟合任务，再导出 PDF。');
      return;
    }
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      window.alert('PDF 组件尚未加载完成，请刷新页面后重试。');
      return;
    }

    const button = document.getElementById('exportPdfBtn');
    const oldText = button?.textContent || '导出 PDF';
    if (button) { button.disabled = true; button.textContent = '生成 PDF…'; }

    try {
      const meta = reportMeta();
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
      for (let i = 0; i < cards.length; i += 1) {
        const sheet = await buildResultSheet(cards[i], i, meta);
        const canvas = await canvasForSheet(sheet);
        addCanvasToPdf(pdf, canvas, i > 0);
      }
      pdf.save(`${safeFilename(meta.title)}.pdf`);
    } catch (err) {
      console.error(err);
      window.alert(`PDF 导出失败：${err?.message || err}`);
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText; }
    }
  }

  function bindPdfExport() {
    const button = document.getElementById('exportPdfBtn');
    if (!button || button.dataset.polishPdfBound === '1') return;
    button.dataset.polishPdfBound = '1';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportReadablePdf();
    }, true);
  }

  function init() {
    bindPdfExport();
    fitAllResultFormulas();
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('.result-formula')) fitFormula(node);
          fitAllResultFormulas(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => window.setTimeout(() => fitAllResultFormulas(), 50), { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
