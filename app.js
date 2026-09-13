(() => {
  'use strict';

  const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
  const MAX_TABLE_FILES = 50;
  const MAX_TEXT_CHARS_PER_FILE = 25 * 1024 * 1024;
  const MAX_BASIS_TERMS = 12;

  const PRESETS = [
    { id: 'custom', label: '自定义', powers: '0,1,2', x: [], y: [] },
    { id: 'rpm_thrust', label: 'RPM → 推力', powers: '2', x: [/^rpm$/i, /motor.*rpm/i, /speed.*rpm/i, /rpm/i], y: [/thrust/i, /force.*z/i, /^fz$/i] },
    { id: 'rpm_torque', label: 'RPM → 扭矩', powers: '2', x: [/^rpm$/i, /motor.*rpm/i, /rpm/i], y: [/torque/i, /moment/i] },
    { id: 'rpm_power', label: 'RPM → 功率', powers: '3', x: [/^rpm$/i, /motor.*rpm/i, /rpm/i], y: [/power/i, /watt/i] },
    { id: 'pwm_rpm', label: 'PWM / 油门 → RPM', powers: '0,1,2', x: [/pwm/i, /throttle/i, /command/i, /cmd/i], y: [/^rpm$/i, /motor.*rpm/i, /rpm/i] },
    { id: 'pwm_thrust', label: 'PWM / 油门 → 推力', powers: '0,1,2', x: [/pwm/i, /throttle/i, /command/i, /cmd/i], y: [/thrust/i, /force.*z/i, /^fz$/i] },
    { id: 'current_torque', label: '电流 → 扭矩', powers: '0,1', x: [/current/i, /amp/i, /^i(_|$)/i], y: [/torque/i, /moment/i] },
    { id: 'rpm_current', label: 'RPM → 电流', powers: '0,2', x: [/^rpm$/i, /motor.*rpm/i, /rpm/i], y: [/current/i, /amp/i] },
    { id: 'voltage_rpm', label: '电压 → RPM', powers: '0,1', x: [/voltage/i, /volt/i, /^v(_|$)/i], y: [/^rpm$/i, /motor.*rpm/i, /rpm/i] },
    { id: 'j_ct', label: '前进比 J → Cₜ', powers: '0,1,2', x: [/^j$/i, /advance.*ratio/i], y: [/^c[_ ]?t$/i, /thrust.*coeff/i] },
    { id: 'j_cp', label: '前进比 J → Cₚ', powers: '0,1,2,3', x: [/^j$/i, /advance.*ratio/i], y: [/^c[_ ]?p$/i, /power.*coeff/i] }
  ];

  const state = {
    datasets: [],
    jobs: [],
    results: new Map(),
    sourceLabel: '',
    jobCounter: 0
  };

  const el = {
    fileInput: document.getElementById('fileInput'),
    dropzone: document.getElementById('dropzone'),
    loadStatus: document.getElementById('loadStatus'),
    datasetArea: document.getElementById('datasetArea'),
    previewDatasetSelect: document.getElementById('previewDatasetSelect'),
    datasetSummary: document.getElementById('datasetSummary'),
    previewTable: document.getElementById('previewTable'),
    jobs: document.getElementById('jobs'),
    jobTemplate: document.getElementById('jobTemplate'),
    addJobBtn: document.getElementById('addJobBtn'),
    runAllBtn: document.getElementById('runAllBtn'),
    reportTitle: document.getElementById('reportTitle'),
    reportNotes: document.getElementById('reportNotes'),
    resultStatus: document.getElementById('resultStatus'),
    results: document.getElementById('results'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    exportPdfBtn: document.getElementById('exportPdfBtn')
  };

  function uid(prefix = 'id') {
    state.jobCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${state.jobCounter}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setStatus(node, message, type = 'muted') {
    node.className = `status ${type}`;
    node.textContent = message;
  }

  function cleanHeader(header, index) {
    const cleaned = String(header ?? '').replace(/^\uFEFF/, '').trim();
    return cleaned || `Column_${index + 1}`;
  }

  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (value === null || value === undefined) return NaN;
    const text = String(value).trim();
    if (!text) return NaN;
    const normalized = text.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }

  function looksNumericHeader(header) {
    return Number.isFinite(toNumber(header));
  }

  function parseTabular(name, text) {
    let parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: cleanHeader
    });

    let headers = (parsed.meta.fields || []).map(cleanHeader);
    const numericHeaderRatio = headers.length ? headers.filter(looksNumericHeader).length / headers.length : 0;

    if (headers.length < 2 || numericHeaderRatio > 0.6) {
      const fallback = Papa.parse(text, { header: false, skipEmptyLines: 'greedy' });
      const width = Math.max(0, ...fallback.data.map(row => Array.isArray(row) ? row.length : 0));
      headers = Array.from({ length: width }, (_, i) => `Column_${i + 1}`);
      parsed = {
        data: fallback.data.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))),
        errors: fallback.errors,
        meta: fallback.meta
      };
    }

    const seen = new Map();
    headers = headers.map((h, index) => {
      const base = cleanHeader(h, index);
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count ? `${base}_${count + 1}` : base;
    });

    const rows = parsed.data
      .filter(row => row && typeof row === 'object')
      .map(raw => {
        const values = Object.values(raw);
        const out = {};
        headers.forEach((header, i) => {
          const v = values[i] ?? raw[header] ?? '';
          out[header] = typeof v === 'string' ? v.trim() : v;
        });
        return out;
      })
      .filter(row => headers.some(h => String(row[h] ?? '').trim() !== ''));

    if (headers.length < 2 || rows.length === 0) {
      throw new Error(`${name}: 未识别到至少两列有效表格数据。`);
    }

    return {
      id: uid('dataset'),
      name,
      headers,
      rows,
      parseErrors: (parsed.errors || []).slice(0, 10)
    };
  }

  function mergeDatasets(datasets) {
    const headerSet = new Set(['__source_file']);
    datasets.forEach(ds => ds.headers.forEach(h => headerSet.add(h)));
    const headers = Array.from(headerSet);
    const rows = [];
    datasets.forEach(ds => {
      ds.rows.forEach(row => rows.push({ __source_file: ds.name, ...row }));
    });
    return {
      id: '__merged__',
      name: `全部表格（合并，共 ${datasets.length} 个文件）`,
      headers,
      rows,
      merged: true
    };
  }

  async function handleUpload(file) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus(el.loadStatus, '文件超过 100 MB 的浏览器安全限制。建议拆分测试包。', 'error');
      return;
    }

    setStatus(el.loadStatus, `正在读取 ${file.name} ...`);
    state.sourceLabel = file.name;

    try {
      const lower = file.name.toLowerCase();
      const discovered = [];
      const warnings = [];

      if (lower.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files)
          .filter(entry => !entry.dir && /\.(csv|tsv|txt)$/i.test(entry.name))
          .slice(0, MAX_TABLE_FILES);

        if (!entries.length) throw new Error('ZIP 中没有找到 CSV / TSV / TXT 表格文件。');

        for (const entry of entries) {
          const text = await entry.async('text');
          if (text.length > MAX_TEXT_CHARS_PER_FILE) {
            warnings.push(`${entry.name} 太大，已跳过`);
            continue;
          }
          try {
            discovered.push(parseTabular(entry.name, text));
          } catch (err) {
            warnings.push(err.message);
          }
        }
      } else if (/\.(csv|tsv|txt)$/i.test(lower)) {
        const text = await file.text();
        discovered.push(parseTabular(file.name, text));
      } else {
        throw new Error('目前支持 ZIP、CSV、TSV、TXT。');
      }

      if (!discovered.length) throw new Error(warnings[0] || '没有可用的数据表。');

      state.datasets = discovered.length > 1 ? [mergeDatasets(discovered), ...discovered] : discovered;
      state.jobs = [];
      state.results.clear();

      renderDatasetControls();
      renderJobs();
      renderResults();
      addJob({ presetId: guessInitialPreset(state.datasets[0]) });

      const base = `已载入 ${discovered.length} 个表格，共 ${discovered.reduce((s, d) => s + d.rows.length, 0)} 行。`;
      setStatus(el.loadStatus, warnings.length ? `${base} 另有 ${warnings.length} 个警告。` : base, warnings.length ? 'warning' : 'success');
      el.addJobBtn.disabled = false;
      updateRunButtons();
    } catch (err) {
      console.error(err);
      setStatus(el.loadStatus, err.message || '读取数据失败。', 'error');
    }
  }

  function guessInitialPreset(dataset) {
    const h = dataset.headers.join(' ').toLowerCase();
    if (h.includes('rpm') && (h.includes('thrust') || h.includes('force'))) return 'rpm_thrust';
    if (h.includes('rpm') && h.includes('torque')) return 'rpm_torque';
    if ((h.includes('pwm') || h.includes('throttle')) && h.includes('rpm')) return 'pwm_rpm';
    return 'custom';
  }

  function renderDatasetControls() {
    el.datasetArea.classList.remove('hidden');
    el.previewDatasetSelect.innerHTML = state.datasets
      .map(ds => `<option value="${escapeHtml(ds.id)}">${escapeHtml(ds.name)}</option>`)
      .join('');
    renderPreview();
  }

  function renderPreview() {
    const ds = state.datasets.find(d => d.id === el.previewDatasetSelect.value) || state.datasets[0];
    if (!ds) return;
    const visibleHeaders = ds.headers.slice(0, 16);
    el.datasetSummary.textContent = `${ds.rows.length} 行 · ${ds.headers.length} 列${ds.headers.length > 16 ? ' · 预览前16列' : ''}`;
    const head = `<thead><tr>${visibleHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
    const body = `<tbody>${ds.rows.slice(0, 10).map(row => `<tr>${visibleHeaders.map(h => `<td>${escapeHtml(row[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;
    el.previewTable.innerHTML = head + body;
  }

  function findColumn(headers, patterns) {
    for (const pattern of patterns) {
      const found = headers.find(h => pattern.test(h));
      if (found) return found;
    }
    return '';
  }

  function addJob(overrides = {}) {
    if (!state.datasets.length) return;
    const dataset = state.datasets.find(d => d.id === overrides.datasetId) || state.datasets[0];
    const presetId = overrides.presetId || 'custom';
    const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];
    const xCol = overrides.xCol || findColumn(dataset.headers, preset.x) || dataset.headers.find(h => h !== '__source_file') || '';
    const yCol = overrides.yCol || findColumn(dataset.headers, preset.y) || dataset.headers.find(h => h !== xCol && h !== '__source_file') || '';

    state.jobs.push({
      id: uid('job'),
      name: overrides.name || preset.label,
      datasetId: dataset.id,
      presetId,
      xCol,
      yCol,
      powers: overrides.powers || preset.powers,
      xLabel: overrides.xLabel || '',
      yLabel: overrides.yLabel || '',
      minX: overrides.minX ?? '',
      maxX: overrides.maxX ?? ''
    });
    renderJobs();
    updateRunButtons();
  }

  function renderJobs() {
    if (!state.datasets.length) {
      el.jobs.className = 'jobs empty-state';
      el.jobs.innerHTML = '<div>载入数据后即可创建拟合任务。</div>';
      return;
    }
    if (!state.jobs.length) {
      el.jobs.className = 'jobs empty-state';
      el.jobs.innerHTML = '<div>点击“添加拟合任务”开始配置。</div>';
      return;
    }

    el.jobs.className = 'jobs';
    el.jobs.innerHTML = '';
    state.jobs.forEach(job => {
      const fragment = el.jobTemplate.content.cloneNode(true);
      const card = fragment.querySelector('.job-card');
      card.dataset.jobId = job.id;

      card.querySelector('.job-name').value = job.name;
      const datasetSelect = card.querySelector('.job-dataset');
      datasetSelect.innerHTML = state.datasets.map(ds => `<option value="${escapeHtml(ds.id)}">${escapeHtml(ds.name)}</option>`).join('');
      datasetSelect.value = job.datasetId;

      const presetSelect = card.querySelector('.job-preset');
      presetSelect.innerHTML = PRESETS.map(p => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('');
      presetSelect.value = job.presetId;

      populateColumnSelects(card, job.xCol, job.yCol);
      card.querySelector('.job-powers').value = job.powers;
      card.querySelector('.job-x-label').value = job.xLabel;
      card.querySelector('.job-y-label').value = job.yLabel;
      card.querySelector('.job-min-x').value = job.minX;
      card.querySelector('.job-max-x').value = job.maxX;

      wireJobCard(card);
      el.jobs.appendChild(fragment);
      updateJobValidity(el.jobs.querySelector(`[data-job-id="${CSS.escape(job.id)}"]`));
    });
  }

  function populateColumnSelects(card, preferredX = '', preferredY = '') {
    const datasetId = card.querySelector('.job-dataset').value;
    const ds = state.datasets.find(d => d.id === datasetId) || state.datasets[0];
    const options = ds.headers.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
    const x = card.querySelector('.job-x');
    const y = card.querySelector('.job-y');
    x.innerHTML = options;
    y.innerHTML = options;
    if (ds.headers.includes(preferredX)) x.value = preferredX;
    if (ds.headers.includes(preferredY)) y.value = preferredY;
    if (!x.value) x.selectedIndex = 0;
    if (!y.value || y.value === x.value) y.selectedIndex = Math.min(1, y.options.length - 1);
  }

  function wireJobCard(card) {
    card.querySelector('.job-dataset').addEventListener('change', () => {
      populateColumnSelects(card);
      applyPresetToCard(card, card.querySelector('.job-preset').value, false);
      syncJobFromCard(card);
    });

    card.querySelector('.job-preset').addEventListener('change', event => {
      applyPresetToCard(card, event.target.value, true);
      syncJobFromCard(card);
    });

    card.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('input', () => syncJobFromCard(card));
      input.addEventListener('change', () => syncJobFromCard(card));
    });

    card.querySelector('.remove-job').addEventListener('click', () => {
      const id = card.dataset.jobId;
      state.jobs = state.jobs.filter(j => j.id !== id);
      state.results.delete(id);
      renderJobs();
      renderResults();
      updateRunButtons();
    });

    card.querySelector('.duplicate-job').addEventListener('click', () => {
      syncJobFromCard(card);
      const original = state.jobs.find(j => j.id === card.dataset.jobId);
      if (!original) return;
      addJob({ ...original, id: undefined, name: `${original.name} Copy` });
    });

    card.querySelector('.run-one').addEventListener('click', () => runOne(card.dataset.jobId));
  }

  function applyPresetToCard(card, presetId, overwriteName) {
    const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];
    const ds = state.datasets.find(d => d.id === card.querySelector('.job-dataset').value);
    if (!ds) return;
    const xMatch = findColumn(ds.headers, preset.x);
    const yMatch = findColumn(ds.headers, preset.y);
    if (xMatch) card.querySelector('.job-x').value = xMatch;
    if (yMatch) card.querySelector('.job-y').value = yMatch;
    card.querySelector('.job-powers').value = preset.powers;
    if (overwriteName && presetId !== 'custom') card.querySelector('.job-name').value = preset.label;
  }

  function syncJobFromCard(card) {
    const job = state.jobs.find(j => j.id === card.dataset.jobId);
    if (!job) return;
    job.name = card.querySelector('.job-name').value.trim() || 'Unnamed fit';
    job.datasetId = card.querySelector('.job-dataset').value;
    job.presetId = card.querySelector('.job-preset').value;
    job.xCol = card.querySelector('.job-x').value;
    job.yCol = card.querySelector('.job-y').value;
    job.powers = card.querySelector('.job-powers').value.trim();
    job.xLabel = card.querySelector('.job-x-label').value.trim();
    job.yLabel = card.querySelector('.job-y-label').value.trim();
    job.minX = card.querySelector('.job-min-x').value;
    job.maxX = card.querySelector('.job-max-x').value;
    updateJobValidity(card);
  }

  function parsePowers(text) {
    const pieces = String(text).split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!pieces.length) throw new Error('至少需要一个幂次。');
    const values = pieces.map(Number);
    if (values.some(v => !Number.isFinite(v))) throw new Error('幂次必须是有效数字。');
    const unique = [...new Set(values)];
    if (unique.length > MAX_BASIS_TERMS) throw new Error(`最多允许 ${MAX_BASIS_TERMS} 个幂次项。`);
    return unique.sort((a, b) => a - b);
  }

  function validateJob(job) {
    const ds = state.datasets.find(d => d.id === job.datasetId);
    if (!ds) throw new Error('找不到数据集。');
    if (!job.xCol || !job.yCol) throw new Error('请选择 X 和 Y 列。');
    if (job.xCol === job.yCol) throw new Error('X 和 Y 不能是同一列。');
    const powers = parsePowers(job.powers);
    const minX = job.minX === '' ? -Infinity : Number(job.minX);
    const maxX = job.maxX === '' ? Infinity : Number(job.maxX);
    if (!Number.isFinite(minX) && job.minX !== '') throw new Error('X 最小值无效。');
    if (!Number.isFinite(maxX) && job.maxX !== '') throw new Error('X 最大值无效。');
    if (minX > maxX) throw new Error('X 最小值不能大于最大值。');

    let valid = 0;
    for (const row of ds.rows) {
      const x = toNumber(row[job.xCol]);
      const y = toNumber(row[job.yCol]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < minX || x > maxX) continue;
      if (powers.every(p => Number.isFinite(Math.pow(x, p)))) valid += 1;
    }
    if (valid <= powers.length) throw new Error(`有效数据点只有 ${valid} 个，必须多于参数项数 ${powers.length}。`);
    return { ds, powers, minX, maxX, valid };
  }

  function updateJobValidity(card) {
    if (!card) return;
    const label = card.querySelector('.job-validity');
    const job = state.jobs.find(j => j.id === card.dataset.jobId);
    try {
      const v = validateJob(job);
      label.className = 'job-validity good';
      label.textContent = `可拟合 · ${v.valid} 个有效点 · ${v.powers.length} 个参数`;
    } catch (err) {
      label.className = 'job-validity bad';
      label.textContent = err.message;
    }
  }

  function extractPoints(job, validation) {
    const xs = [];
    const ys = [];
    let skipped = 0;
    for (const row of validation.ds.rows) {
      const x = toNumber(row[job.xCol]);
      const y = toNumber(row[job.yCol]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < validation.minX || x > validation.maxX) {
        skipped += 1;
        continue;
      }
      if (!validation.powers.every(p => Number.isFinite(Math.pow(x, p)))) {
        skipped += 1;
        continue;
      }
      xs.push(x);
      ys.push(y);
    }
    return { xs, ys, skipped };
  }

  function dot(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
    return sum;
  }

  function norm(v) {
    return Math.sqrt(dot(v, v));
  }

  function solveLeastSquares(xs, ys, powers) {
    const n = xs.length;
    const m = powers.length;
    const columns = powers.map(p => xs.map(x => Math.pow(x, p)));
    const scales = columns.map(col => norm(col));
    if (scales.some(s => !Number.isFinite(s) || s === 0)) throw new Error('模型矩阵存在零列或数值溢出，请调整幂次或数据范围。');

    const bcols = columns.map((col, j) => col.map(v => v / scales[j]));
    const qcols = [];
    const R = Array.from({ length: m }, () => Array(m).fill(0));

    for (let j = 0; j < m; j += 1) {
      const v = bcols[j].slice();
      for (let i = 0; i < j; i += 1) {
        const rij = dot(qcols[i], v);
        R[i][j] = rij;
        for (let k = 0; k < n; k += 1) v[k] -= rij * qcols[i][k];
      }
      for (let i = 0; i < j; i += 1) {
        const correction = dot(qcols[i], v);
        R[i][j] += correction;
        for (let k = 0; k < n; k += 1) v[k] -= correction * qcols[i][k];
      }
      const rjj = norm(v);
      if (!Number.isFinite(rjj) || rjj < 1e-11) throw new Error('模型项线性相关或条件过差，请减少幂次、缩小数据量级，或使用更简单模型。');
      R[j][j] = rjj;
      qcols[j] = v.map(value => value / rjj);
    }

    const qty = qcols.map(q => dot(q, ys));
    const betaScaled = Array(m).fill(0);
    for (let i = m - 1; i >= 0; i -= 1) {
      let rhs = qty[i];
      for (let j = i + 1; j < m; j += 1) rhs -= R[i][j] * betaScaled[j];
      betaScaled[i] = rhs / R[i][i];
    }
    return betaScaled.map((b, j) => b / scales[j]);
  }

  function predictValue(x, powers, coefficients) {
    let y = 0;
    for (let i = 0; i < powers.length; i += 1) y += coefficients[i] * Math.pow(x, powers[i]);
    return y;
  }

  function fitJob(job) {
    const validation = validateJob(job);
    const { xs, ys, skipped } = extractPoints(job, validation);
    const coefficients = solveLeastSquares(xs, ys, validation.powers);
    const predictions = xs.map(x => predictValue(x, validation.powers, coefficients));
    const residuals = ys.map((y, i) => y - predictions[i]);
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const ssRes = residuals.reduce((s, r) => s + r * r, 0);
    const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : (ssRes < 1e-20 ? 1 : NaN);
    const adjR2 = Number.isFinite(r2) && xs.length > validation.powers.length + 1
      ? 1 - (1 - r2) * (xs.length - 1) / (xs.length - validation.powers.length - 1)
      : NaN;
    const rmse = Math.sqrt(ssRes / xs.length);
    const mae = residuals.reduce((s, r) => s + Math.abs(r), 0) / xs.length;
    const maxAbsError = Math.max(...residuals.map(Math.abs));
    const aic = ssRes > 0 ? xs.length * Math.log(ssRes / xs.length) + 2 * validation.powers.length : -Infinity;

    return {
      ok: true,
      jobId: job.id,
      name: job.name,
      datasetName: validation.ds.name,
      xCol: job.xCol,
      yCol: job.yCol,
      xLabel: job.xLabel || job.xCol,
      yLabel: job.yLabel || job.yCol,
      powers: validation.powers,
      coefficients,
      xs,
      ys,
      predictions,
      residuals,
      skipped,
      metrics: { n: xs.length, r2, adjR2, rmse, mae, maxAbsError, aic }
    };
  }

  async function runOne(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;
    const card = el.jobs.querySelector(`[data-job-id="${CSS.escape(jobId)}"]`);
    if (card) syncJobFromCard(card);
    setStatus(el.resultStatus, `正在拟合：${job.name} ...`);
    await new Promise(resolve => requestAnimationFrame(resolve));
    try {
      state.results.set(jobId, fitJob(job));
      setStatus(el.resultStatus, `已完成：${job.name}`, 'success');
    } catch (err) {
      state.results.set(jobId, { ok: false, jobId, name: job.name, error: err.message });
      setStatus(el.resultStatus, `${job.name} 拟合失败：${err.message}`, 'error');
    }
    renderResults();
    updateRunButtons();
  }

  async function runAll() {
    state.jobs.forEach(job => {
      const card = el.jobs.querySelector(`[data-job-id="${CSS.escape(job.id)}"]`);
      if (card) syncJobFromCard(card);
    });
    setStatus(el.resultStatus, `正在运行 ${state.jobs.length} 个拟合任务...`);
    await new Promise(resolve => requestAnimationFrame(resolve));

    state.results.clear();
    let success = 0;
    for (const job of state.jobs) {
      try {
        state.results.set(job.id, fitJob(job));
        success += 1;
      } catch (err) {
        state.results.set(job.id, { ok: false, jobId: job.id, name: job.name, error: err.message });
      }
    }
    renderResults();
    updateRunButtons();
    setStatus(el.resultStatus, `完成 ${state.jobs.length} 个任务：${success} 成功，${state.jobs.length - success} 失败。`, success === state.jobs.length ? 'success' : 'warning');
  }

  function formatNumber(value, precision = 6) {
    if (!Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1e5 || abs < 1e-4) return value.toExponential(Math.min(precision, 8));
    return Number(value.toPrecision(precision)).toString();
  }

  function formatPower(power) {
    if (power === 1) return '';
    return `^${formatNumber(power, 5)}`;
  }

  function equationText(result) {
    const terms = result.powers.map((p, i) => ({ p, c: result.coefficients[i] })).sort((a, b) => b.p - a.p);
    let equation = `${result.yLabel} = `;
    terms.forEach((term, index) => {
      const sign = term.c < 0 ? '-' : '+';
      const magnitude = formatNumber(Math.abs(term.c), 8);
      const body = term.p === 0 ? magnitude : `${magnitude}·${result.xLabel}${formatPower(term.p)}`;
      if (index === 0) equation += term.c < 0 ? `-${body}` : body;
      else equation += ` ${sign} ${body}`;
    });
    return equation;
  }

  function resultCardHtml(result) {
    if (!result.ok) {
      return `<article class="result-card"><div class="result-card__head"><h3>${escapeHtml(result.name)}</h3></div><div class="result-error">${escapeHtml(result.error)}</div></article>`;
    }
    const m = result.metrics;
    const metrics = [
      ['N', m.n], ['R²', formatNumber(m.r2, 7)], ['Adj. R²', formatNumber(m.adjR2, 7)],
      ['RMSE', formatNumber(m.rmse, 7)], ['MAE', formatNumber(m.mae, 7)], ['Max |e|', formatNumber(m.maxAbsError, 7)]
    ];
    const coeffRows = result.powers.map((p, i) => `<div class="coeff-row"><span>x^${escapeHtml(formatNumber(p, 5))}</span><span>${escapeHtml(formatNumber(result.coefficients[i], 10))}</span></div>`).join('');
    return `
      <article class="result-card" data-result-id="${escapeHtml(result.jobId)}">
        <div class="result-card__head">
          <h3>${escapeHtml(result.name)}</h3>
          <div class="result-meta">${escapeHtml(result.datasetName)} · X: ${escapeHtml(result.xCol)} · Y: ${escapeHtml(result.yCol)} · skipped: ${result.skipped}</div>
          <div class="equation mono">${escapeHtml(equationText(result))}</div>
        </div>
        <div class="metric-grid">${metrics.map(([k, v]) => `<div class="metric"><div class="metric__label">${escapeHtml(k)}</div><div class="metric__value">${escapeHtml(v)}</div></div>`).join('')}</div>
        <div class="result-body">
          <div class="coeff-box"><h4>Coefficients</h4>${coeffRows}</div>
          <div class="charts">
            <div class="plot fit-plot" id="fit-${escapeHtml(result.jobId)}"></div>
            <div class="plot residual-plot" id="residual-${escapeHtml(result.jobId)}"></div>
          </div>
        </div>
      </article>`;
  }

  function buildCurve(result, count = 220) {
    const minX = Math.min(...result.xs);
    const maxX = Math.max(...result.xs);
    if (minX === maxX) return { x: [minX], y: [predictValue(minX, result.powers, result.coefficients)] };
    const xs = [];
    const ys = [];
    for (let i = 0; i < count; i += 1) {
      const x = minX + (maxX - minX) * i / (count - 1);
      const y = predictValue(x, result.powers, result.coefficients);
      if (Number.isFinite(y)) { xs.push(x); ys.push(y); }
    }
    return { x: xs, y: ys };
  }

  function plotResult(result) {
    const curve = buildCurve(result);
    const commonLayout = {
      margin: { l: 64, r: 20, t: 42, b: 58 },
      paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff',
      font: { family: 'Inter, system-ui, sans-serif', size: 12 },
      showlegend: true, legend: { orientation: 'h', x: 0, y: 1.12 },
      xaxis: { title: result.xLabel, gridcolor: '#e8edf3', zerolinecolor: '#cbd5e1' },
      yaxis: { title: result.yLabel, gridcolor: '#e8edf3', zerolinecolor: '#cbd5e1' }
    };

    Plotly.newPlot(`fit-${result.jobId}`, [
      { x: result.xs, y: result.ys, mode: 'markers', type: 'scatter', name: 'Measured', marker: { size: 6, opacity: 0.68 } },
      { x: curve.x, y: curve.y, mode: 'lines', type: 'scatter', name: 'Fit', line: { width: 3 } }
    ], { ...commonLayout, title: { text: 'Measured data and fitted model', x: 0.02, xanchor: 'left', font: { size: 14 } } }, { responsive: true, displaylogo: false });

    Plotly.newPlot(`residual-${result.jobId}`, [
      { x: result.xs, y: result.residuals, mode: 'markers', type: 'scatter', name: 'Residual', marker: { size: 6, opacity: 0.7 } }
    ], {
      ...commonLayout,
      title: { text: 'Residuals', x: 0.02, xanchor: 'left', font: { size: 14 } },
      yaxis: { title: `${result.yLabel} residual`, gridcolor: '#e8edf3', zerolinecolor: '#94a3b8', zerolinewidth: 1.5 },
      shapes: [{ type: 'line', x0: Math.min(...result.xs), x1: Math.max(...result.xs), y0: 0, y1: 0, line: { width: 1, dash: 'dash' } }]
    }, { responsive: true, displaylogo: false });
  }

  function renderResults() {
    const ordered = state.jobs.map(job => state.results.get(job.id)).filter(Boolean);
    if (!ordered.length) {
      el.results.innerHTML = '';
      el.exportJsonBtn.disabled = true;
      el.exportPdfBtn.disabled = true;
      return;
    }
    el.results.innerHTML = ordered.map(resultCardHtml).join('');
    ordered.filter(r => r.ok).forEach(plotResult);
    const hasSuccess = ordered.some(r => r.ok);
    el.exportJsonBtn.disabled = !hasSuccess;
    el.exportPdfBtn.disabled = !hasSuccess;
  }

  function updateRunButtons() {
    el.runAllBtn.disabled = !state.datasets.length || !state.jobs.length;
    const hasSuccess = [...state.results.values()].some(r => r.ok);
    el.exportJsonBtn.disabled = !hasSuccess;
    el.exportPdfBtn.disabled = !hasSuccess;
  }

  function slugify(text) {
    return String(text || 'fit-report').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'fit-report';
  }

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const successful = state.jobs.map(job => state.results.get(job.id)).filter(r => r?.ok).map(r => ({
      name: r.name, dataset: r.datasetName, x: r.xCol, y: r.yCol, xLabel: r.xLabel, yLabel: r.yLabel,
      powers: r.powers, coefficients: r.coefficients, equation: equationText(r), metrics: r.metrics, skippedRows: r.skipped
    }));
    const payload = {
      generatedAt: new Date().toISOString(), source: state.sourceLabel, title: el.reportTitle.value.trim(),
      notes: el.reportNotes.value.trim(), fits: successful
    };
    downloadBlob(JSON.stringify(payload, null, 2), 'application/json', `${slugify(el.reportTitle.value)}.json`);
  }

  function reportPageHtml(result, fitImage, residualImage) {
    const coeffRows = result.powers.map((p, i) => `<tr><td style="padding:5px;border-bottom:1px solid #e8edf3;">x^${escapeHtml(formatNumber(p, 5))}</td><td style="padding:5px;border-bottom:1px solid #e8edf3;text-align:right;font-family:Consolas,monospace;">${escapeHtml(formatNumber(result.coefficients[i], 11))}</td></tr>`).join('');
    return `
      <div style="font-family:Inter,'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#172033;background:white;width:794px;padding:34px 38px;box-sizing:border-box;">
        <div style="font-size:11px;letter-spacing:.12em;color:#667085;font-weight:700;">UAV PROPULSION FIT LAB</div>
        <h1 style="font-size:25px;margin:7px 0 2px;">${escapeHtml(result.name)}</h1>
        <div style="font-size:11px;color:#667085;margin-bottom:12px;">${escapeHtml(result.datasetName)} · ${escapeHtml(result.xCol)} → ${escapeHtml(result.yCol)} · N=${result.metrics.n}</div>
        <div style="font-family:Consolas,monospace;font-size:12px;background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:7px;overflow-wrap:anywhere;">${escapeHtml(equationText(result))}</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:12px 0;">
          ${[
            ['R²', formatNumber(result.metrics.r2, 7)], ['Adj R²', formatNumber(result.metrics.adjR2, 7)],
            ['RMSE', formatNumber(result.metrics.rmse, 7)], ['MAE', formatNumber(result.metrics.mae, 7)],
            ['Max |e|', formatNumber(result.metrics.maxAbsError, 7)], ['Skipped', result.skipped]
          ].map(([k,v]) => `<div style="border:1px solid #d8e0ea;border-radius:7px;padding:7px;"><div style="font-size:9px;color:#667085;font-weight:700;">${escapeHtml(k)}</div><div style="font-size:12px;font-weight:700;">${escapeHtml(v)}</div></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:170px 1fr;gap:12px;align-items:start;">
          <table style="width:100%;border-collapse:collapse;font-size:10px;"><thead><tr><th style="text-align:left;border-bottom:1px solid #bcc9d8;padding:5px;">Basis</th><th style="text-align:right;border-bottom:1px solid #bcc9d8;padding:5px;">Coefficient</th></tr></thead><tbody>${coeffRows}</tbody></table>
          <img src="${fitImage}" style="display:block;width:100%;border:1px solid #e5eaf0;border-radius:8px;" />
        </div>
        <img src="${residualImage}" style="display:block;width:100%;margin-top:10px;border:1px solid #e5eaf0;border-radius:8px;" />
      </div>`;
  }

  async function elementToPdfPage(doc, html, isFirstPage) {
    const host = document.createElement('div');
    host.style.position = 'fixed'; host.style.left = '-10000px'; host.style.top = '0'; host.style.zIndex = '-1';
    host.innerHTML = html;
    document.body.appendChild(host);
    try {
      const canvas = await html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const img = canvas.toDataURL('image/jpeg', 0.94);
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 8;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const ratio = Math.min(usableW / canvas.width, usableH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      if (!isFirstPage) doc.addPage();
      doc.addImage(img, 'JPEG', (pageW - w) / 2, margin, w, h, undefined, 'FAST');
    } finally {
      host.remove();
    }
  }

  async function exportPdf() {
    if (typeof html2canvas !== 'function' || !window.jspdf?.jsPDF) {
      setStatus(el.resultStatus, 'PDF 依赖未加载，请刷新页面后重试。', 'error');
      return;
    }
    const successful = state.jobs.map(job => state.results.get(job.id)).filter(r => r?.ok);
    if (!successful.length) return;

    el.exportPdfBtn.disabled = true;
    setStatus(el.resultStatus, `正在生成 PDF（${successful.length} 个拟合）...`);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const cover = `
        <div style="font-family:Inter,'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#172033;background:white;width:794px;min-height:620px;padding:58px 54px;box-sizing:border-box;">
          <div style="font-size:12px;letter-spacing:.15em;color:#0f6cbd;font-weight:800;">MOTOR TESTS</div>
          <h1 style="font-size:38px;line-height:1.1;margin:16px 0 12px;">${escapeHtml(el.reportTitle.value.trim() || 'UAV Propulsion Fit Report')}</h1>
          <p style="font-size:16px;color:#667085;margin:0 0 40px;">Browser-generated fitting report</p>
          <div style="border-top:1px solid #d8e0ea;padding-top:18px;font-size:13px;line-height:1.8;">
            <div><strong>Source:</strong> ${escapeHtml(state.sourceLabel || '—')}</div>
            <div><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString())}</div>
            <div><strong>Successful fits:</strong> ${successful.length}</div>
            <div><strong>Notes:</strong> ${escapeHtml(el.reportNotes.value.trim() || '—')}</div>
          </div>
          <div style="margin-top:46px;padding:14px 16px;border-radius:9px;background:#eef6fd;color:#344054;font-size:12px;">All uploaded data was processed locally in the browser. This report stores fitted results and figures, not the raw source archive.</div>
        </div>`;
      await elementToPdfPage(doc, cover, true);

      for (const result of successful) {
        const fitImage = await Plotly.toImage(`fit-${result.jobId}`, { format: 'png', width: 1000, height: 560, scale: 1 });
        const residualImage = await Plotly.toImage(`residual-${result.jobId}`, { format: 'png', width: 1000, height: 430, scale: 1 });
        await elementToPdfPage(doc, reportPageHtml(result, fitImage, residualImage), false);
      }

      doc.save(`${slugify(el.reportTitle.value)}.pdf`);
      setStatus(el.resultStatus, `PDF 已生成：${successful.length} 个拟合结果。`, 'success');
    } catch (err) {
      console.error(err);
      setStatus(el.resultStatus, `PDF 生成失败：${err.message}`, 'error');
    } finally {
      el.exportPdfBtn.disabled = false;
    }
  }

  el.fileInput.addEventListener('change', event => handleUpload(event.target.files?.[0]));
  el.previewDatasetSelect.addEventListener('change', renderPreview);
  el.addJobBtn.addEventListener('click', () => addJob());
  el.runAllBtn.addEventListener('click', runAll);
  el.exportJsonBtn.addEventListener('click', exportJson);
  el.exportPdfBtn.addEventListener('click', exportPdf);

  ['dragenter', 'dragover'].forEach(type => el.dropzone.addEventListener(type, event => {
    event.preventDefault();
    el.dropzone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach(type => el.dropzone.addEventListener(type, event => {
    event.preventDefault();
    el.dropzone.classList.remove('is-dragging');
  }));
  el.dropzone.addEventListener('drop', event => handleUpload(event.dataTransfer?.files?.[0]));

  if (!window.JSZip || !window.Papa || !window.Plotly || !window.jspdf) {
    setStatus(el.loadStatus, '部分前端依赖未加载。请检查网络连接并刷新页面。', 'error');
  }
})();
