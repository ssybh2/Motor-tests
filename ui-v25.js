(() => {
  'use strict';

  const CARD_FLAG = 'data-ui-v25';

  function normalizeMath(tex) {
    return String(tex ?? '')
      .replace(/\\,\s*/g, '\\mathbin{\\cdot} ')
      .replace(/(-?\d+(?:\.\d+)?)e([+-]?\d+)/gi, '$1\\times 10^{$2}');
  }

  function patchKatex() {
    if (!window.katex || window.katex.__motorTestsV25Patched) return;
    const render = window.katex.render.bind(window.katex);
    const renderToString = window.katex.renderToString.bind(window.katex);
    window.katex.render = (tex, element, options) => render(normalizeMath(tex), element, options);
    window.katex.renderToString = (tex, options) => renderToString(normalizeMath(tex), options);
    window.katex.__motorTestsV25Patched = true;
  }

  function normalizeCoeff(value) {
    return String(value || '').trim().replace(/\s+/g, '');
  }

  function coeffToTex(value) {
    const s = normalizeCoeff(value) || 'a';
    if (/^\\[A-Za-z]+$/.test(s)) return s;
    if (/^[A-Za-z]+_[A-Za-z0-9]+$/.test(s)) {
      const [base, sub] = s.split('_');
      return `${base}_{${sub}}`;
    }
    if (/^[A-Za-z]+_\{[A-Za-z0-9]+\}$/.test(s)) return s;
    if (/^[A-Za-z0-9]+$/.test(s)) return s;
    return `\\mathrm{${s.replace(/[^A-Za-z0-9]/g, '') || 'a'}}`;
  }

  function renderInlineMath(node, tex) {
    if (!node) return;
    try {
      if (window.katex) {
        window.katex.render(tex, node, { throwOnError: false, displayMode: false });
      } else {
        node.textContent = tex;
      }
    } catch (_) {
      node.textContent = tex;
    }
  }

  function refreshCoeffPreview(input) {
    const field = input.closest('.field');
    const preview = field?.querySelector('.coeff-preview-v25');
    if (!preview) return;
    renderInlineMath(preview, coeffToTex(input.value));
  }

  function enhanceCoeffField(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.uiV25Coeff === '1') return;
    input.dataset.uiV25Coeff = '1';
    input.placeholder = '例如 K_T2';

    const field = input.closest('.field');
    const label = field?.querySelector(':scope > span');
    if (label && !label.querySelector('.coeff-preview-v25')) {
      label.textContent = '系数符号 / Coefficient ';
      const preview = document.createElement('span');
      preview.className = 'coeff-preview-v25';
      preview.title = '数学符号预览';
      label.appendChild(preview);
    }

    refreshCoeffPreview(input);
    input.addEventListener('input', () => refreshCoeffPreview(input));
  }

  function termRows(card) {
    return Array.from(card.querySelectorAll('.term-row'));
  }

  function setTermMode(card, mode) {
    const rows = termRows(card);
    if (!rows.length) return;

    let maxPower = -Infinity;
    if (mode === 'highest') {
      for (const row of rows) {
        const p = Number(row.querySelector('.term-power')?.value);
        if (Number.isFinite(p)) maxPower = Math.max(maxPower, p);
      }
    }

    for (const row of rows) {
      const checkbox = row.querySelector('.term-enabled');
      if (!checkbox) continue;
      const p = Number(row.querySelector('.term-power')?.value);
      const next = mode === 'all' ? true : Number.isFinite(p) && Math.abs(p - maxPower) < 1e-12;
      if (checkbox.checked !== next) {
        checkbox.checked = next;
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  function refreshPowerBadges(card) {
    termRows(card).forEach((row) => {
      const input = row.querySelector('.term-power');
      const badge = row.querySelector('.term-power-badge-v25');
      if (!input || !badge) return;
      const p = Number(input.value);
      if (!Number.isFinite(p)) badge.textContent = '幂次 ?';
      else if (Math.abs(p) < 1e-12) badge.textContent = '常数项';
      else if (Math.abs(p - 1) < 1e-12) badge.textContent = '一次项';
      else if (Math.abs(p - 2) < 1e-12) badge.textContent = '二次项';
      else if (Math.abs(p - 3) < 1e-12) badge.textContent = '三次项';
      else badge.textContent = `${p} 次项`;
    });
  }

  function enhanceTermRow(row, card) {
    if (!(row instanceof HTMLElement) || row.dataset.uiV25Term === '1') return;
    row.dataset.uiV25Term = '1';

    const powerField = row.querySelector('.term-power')?.closest('.field');
    const powerLabel = powerField?.querySelector(':scope > span');
    if (powerLabel && !powerLabel.querySelector('.term-power-badge-v25')) {
      powerLabel.textContent = '幂次 / Power ';
      const badge = document.createElement('span');
      badge.className = 'term-power-badge-v25';
      powerLabel.appendChild(badge);
    }

    row.querySelectorAll('.term-coeff').forEach(enhanceCoeffField);
    row.querySelector('.term-power')?.addEventListener('input', () => refreshPowerBadges(card));
  }

  function makeToolButton(label, title, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model-tool-btn-v25';
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }

  function enhanceModelTools(card) {
    const head = card.querySelector('.model-head');
    if (!head || head.querySelector('.model-tools-v25')) return;

    const addButton = head.querySelector('.add-term');
    const tools = document.createElement('div');
    tools.className = 'model-tools-v25';
    tools.append(
      makeToolButton('全部启用', '让所有模型项参与拟合', () => setTermMode(card, 'all')),
      makeToolButton('仅最高次项', '只保留当前最高幂次项；其余系数固定为 0', () => setTermMode(card, 'highest'))
    );
    if (addButton) tools.appendChild(addButton);
    head.appendChild(tools);
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.getAttribute(CARD_FLAG) !== '1') {
      card.setAttribute(CARD_FLAG, '1');
      enhanceModelTools(card);
    }
    card.querySelectorAll('.term-row').forEach((row) => enhanceTermRow(row, card));
    refreshPowerBadges(card);
  }

  function enhanceAll(root = document) {
    root.querySelectorAll?.('.job-card').forEach(enhanceCard);
  }

  function markVersion() {
    const badge = document.querySelector('.version-badge');
    if (badge) badge.textContent = 'UI v2.5 · focused';
    document.title = 'UAV Propulsion Fit Lab · UI v2.5';
  }

  patchKatex();
  markVersion();
  enhanceAll();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.job-card')) enhanceCard(node);
        if (node.matches?.('.term-row')) {
          const card = node.closest('.job-card');
          if (card) enhanceTermRow(node, card);
        }
        enhanceAll(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
