(() => {
  'use strict';

  function normalizeMath(tex) {
    let out = String(tex ?? '');
    out = out.replace(/\\,\s*/g, '\\cdot ');
    out = out.replace(/([}\w])\s*,\s*(?=(?:\\mathrm|\\omega|\\Omega|[A-Za-z]))/g, '$1\\cdot ');
    out = out.replace(/\b([A-Za-z]+)_([A-Za-z0-9]+)\b/g, '$1_{$2}');
    out = out.replace(/(-?\d+(?:\.\d+)?)e([+-]?\d+)/gi, '$1\\times 10^{$2}');
    return out;
  }

  function patchKatex() {
    if (!window.katex || window.katex.__motorTestsV27Patched) return;
    const render = window.katex.render.bind(window.katex);
    const renderToString = window.katex.renderToString.bind(window.katex);
    window.katex.render = (tex, element, options) => render(normalizeMath(tex), element, options);
    window.katex.renderToString = (tex, options) => renderToString(normalizeMath(tex), options);
    window.katex.__motorTestsV27Patched = true;
  }

  function normalizeCoeffRaw(value) {
    let s = String(value || '').trim().replace(/\s+/g, '');
    s = s.replace(/([A-Za-z]+)_?\{([A-Za-z0-9]+)\}/g, '$1_$2');
    return s;
  }

  function coeffToTex(value) {
    const s = normalizeCoeffRaw(value) || 'a';
    if (/^\\[A-Za-z]+$/.test(s)) return s;
    const m = s.match(/^([A-Za-z]+)_([A-Za-z0-9]+)$/);
    if (m) return `${m[1]}_{${m[2]}}`;
    if (/^[A-Za-z0-9]+$/.test(s)) return s;
    return `\\mathrm{${s.replace(/[^A-Za-z0-9]/g, '') || 'a'}}`;
  }

  function renderInlineMath(node, tex) {
    if (!node) return;
    try {
      if (window.katex) window.katex.render(tex, node, { throwOnError: false, displayMode: false });
      else node.textContent = tex;
    } catch (_) {
      node.textContent = tex;
    }
  }

  function enhanceCoeffField(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.uiV27Coeff === '1') return;
    input.dataset.uiV27Coeff = '1';
    input.placeholder = '例如 K_T2';

    const normalized = normalizeCoeffRaw(input.value);
    if (normalized && normalized !== input.value) {
      input.value = normalized;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const field = input.closest('.field');
    const label = field?.querySelector(':scope > span');
    let preview = field?.querySelector('.coeff-preview-v27');
    if (label && !preview) {
      label.textContent = '系数符号 / Coefficient ';
      preview = document.createElement('span');
      preview.className = 'coeff-preview-v27';
      preview.title = '数学符号预览';
      label.appendChild(preview);
    }

    const refresh = () => {
      const clean = normalizeCoeffRaw(input.value);
      if (clean !== input.value) {
        const pos = input.selectionStart;
        input.value = clean;
        try { input.setSelectionRange(pos, pos); } catch (_) {}
      }
      renderInlineMath(preview, coeffToTex(input.value));
    };
    refresh();
    input.addEventListener('input', refresh);
  }

  function powerLabel(p) {
    if (!Number.isFinite(p)) return '幂次 ?';
    if (Math.abs(p) < 1e-12) return '常数项';
    if (Math.abs(p - 1) < 1e-12) return '一次项';
    if (Math.abs(p - 2) < 1e-12) return '二次项';
    if (Math.abs(p - 3) < 1e-12) return '三次项';
    return `${p} 次项`;
  }

  function termRows(card) {
    return Array.from(card.querySelectorAll('.term-row'));
  }

  function refreshPowerBadges(card) {
    termRows(card).forEach((row) => {
      const input = row.querySelector('.term-power');
      const badge = row.querySelector('.term-power-badge-v27');
      if (input && badge) badge.textContent = powerLabel(Number(input.value));
    });
  }

  function setTermMode(card, mode) {
    const rows = termRows(card);
    if (!rows.length) return;
    let maxPower = -Infinity;
    if (mode === 'highest') {
      rows.forEach((row) => {
        const p = Number(row.querySelector('.term-power')?.value);
        if (Number.isFinite(p)) maxPower = Math.max(maxPower, p);
      });
    }
    rows.forEach((row) => {
      const checkbox = row.querySelector('.term-enabled');
      if (!checkbox) return;
      const p = Number(row.querySelector('.term-power')?.value);
      const next = mode === 'all' ? true : Number.isFinite(p) && Math.abs(p - maxPower) < 1e-12;
      if (checkbox.checked !== next) {
        checkbox.checked = next;
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  function makeToolButton(label, title, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model-tool-btn-v27';
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }

  function enhanceTermRow(row, card) {
    if (!(row instanceof HTMLElement) || row.dataset.uiV27Term === '1') return;
    row.dataset.uiV27Term = '1';
    row.querySelectorAll('.term-coeff').forEach(enhanceCoeffField);

    const powerInput = row.querySelector('.term-power');
    const powerField = powerInput?.closest('.field');
    const powerLabelNode = powerField?.querySelector(':scope > span');
    if (powerLabelNode && !powerLabelNode.querySelector('.term-power-badge-v27')) {
      powerLabelNode.textContent = '幂次 / Power ';
      const badge = document.createElement('span');
      badge.className = 'term-power-badge-v27';
      powerLabelNode.appendChild(badge);
    }
    powerInput?.addEventListener('input', () => refreshPowerBadges(card));
  }

  function enhanceModelTools(card) {
    const head = card.querySelector('.model-head');
    if (!head || head.querySelector('.model-tools-v27')) return;
    const addButton = head.querySelector('.add-term');
    const tools = document.createElement('div');
    tools.className = 'model-tools-v27';
    tools.append(
      makeToolButton('全部启用', '所有模型项参与拟合', () => setTermMode(card, 'all')),
      makeToolButton('仅最高次项', '仅最高幂次参与拟合，其余项固定为 0', () => setTermMode(card, 'highest'))
    );
    if (addButton) tools.appendChild(addButton);
    head.appendChild(tools);
  }

  function closeAxisPickers(except = null) {
    document.querySelectorAll('.axis-select-v27.is-open').forEach((node) => {
      if (node !== except) {
        node.classList.remove('is-open');
        node.querySelector('.axis-select-button-v27')?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function enhanceAxisSelect(select) {
    if (!(select instanceof HTMLSelectElement) || select.dataset.uiV27Select === '1') return;
    select.dataset.uiV27Select = '1';
    select.classList.add('native-axis-select-v27');

    const shell = document.createElement('div');
    shell.className = 'axis-select-v27';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'axis-select-button-v27';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('div');
    panel.className = 'axis-select-panel-v27';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'axis-select-search-v27';
    search.placeholder = '搜索数据列…';
    search.autocomplete = 'off';

    const options = document.createElement('div');
    options.className = 'axis-select-options-v27';
    options.setAttribute('role', 'listbox');

    panel.append(search, options);
    shell.append(button, panel);
    select.insertAdjacentElement('afterend', shell);

    function syncButton() {
      const option = select.options[select.selectedIndex];
      button.textContent = option?.textContent || select.value || '请选择数据列';
      button.title = button.textContent;
    }

    function rebuild(filter = '') {
      const q = filter.trim().toLowerCase();
      const all = Array.from(select.options).filter((opt) => !q || opt.textContent.toLowerCase().includes(q));
      options.innerHTML = '';
      if (!all.length) {
        const empty = document.createElement('div');
        empty.className = 'axis-select-empty-v27';
        empty.textContent = '没有匹配的数据列';
        options.appendChild(empty);
        return;
      }
      all.forEach((opt) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'axis-select-option-v27';
        item.textContent = opt.textContent;
        item.title = opt.textContent;
        if (opt.value === select.value) item.classList.add('is-selected');
        item.addEventListener('click', () => {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncButton();
          shell.classList.remove('is-open');
          button.setAttribute('aria-expanded', 'false');
        });
        options.appendChild(item);
      });
    }

    button.addEventListener('click', () => {
      const willOpen = !shell.classList.contains('is-open');
      closeAxisPickers(shell);
      shell.classList.toggle('is-open', willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        search.value = '';
        rebuild('');
        setTimeout(() => search.focus(), 0);
      }
    });

    search.addEventListener('input', () => rebuild(search.value));
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        shell.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        button.focus();
      }
    });
    select.addEventListener('change', syncButton);
    shell.__syncAxisSelect = syncButton;
    syncButton();
  }

  function refreshAxisPickers(card = document) {
    card.querySelectorAll?.('.job-x,.job-y').forEach(enhanceAxisSelect);
    card.querySelectorAll?.('.axis-select-v27').forEach((shell) => shell.__syncAxisSelect?.());
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    enhanceModelTools(card);
    card.querySelectorAll('.term-row').forEach((row) => enhanceTermRow(row, card));
    refreshPowerBadges(card);
    refreshAxisPickers(card);
  }

  function enhanceAll(rootNode = document) {
    rootNode.querySelectorAll?.('.job-card').forEach(enhanceCard);
  }

  function init() {
    document.title = 'UAV Propulsion Fit Lab · UI v2.7';
    enhanceAll();

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.axis-select-v27')) closeAxisPickers();
    });

    document.addEventListener('change', (event) => {
      if (event.target.matches?.('.job-preset,.job-dataset')) {
        const card = event.target.closest('.job-card');
        setTimeout(() => card && refreshAxisPickers(card), 0);
      }
    });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('.job-card')) enhanceCard(node);
          const card = node.closest?.('.job-card');
          if (node.matches?.('.term-row') && card) enhanceTermRow(node, card);
          enhanceAll(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  patchKatex();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
