(() => {
  'use strict';

  // v2.3 deliberately never changes browser/page zoom. Remove any stale inline values
  // left by v2.2 if this page was restored from bfcache.
  function clearLegacyZoomHack() {
    document.documentElement.style.zoom = '';
    document.documentElement.style.width = '';
    document.body.style.zoom = '';
    document.body.style.width = '';
    document.querySelectorAll('.zoom-comp-badge').forEach(n => n.remove());
  }

  function normalizeCoeffText(value) {
    return String(value || '')
      .trim()
      .replace(/_\{([^}]+)\}/g, '_$1')
      .replace(/\s+/g, '');
  }

  function coeffToTex(value) {
    const s = normalizeCoeffText(value) || 'a';
    if (/^\\[A-Za-z]+$/.test(s)) return s;
    const m = s.match(/^([A-Za-z]+)_([A-Za-z0-9]+)$/);
    if (m) return `${m[1]}_{${m[2]}}`;
    if (/^[A-Za-z0-9]+$/.test(s)) return s;
    return 'a';
  }

  function prettifyLatex(tex) {
    let out = String(tex || '');
    // Use an explicit multiplication dot, never a spacing comma.
    out = out.replace(/\\,/g, '\\cdot ');
    // Turn plain editable coefficient names into proper LaTeX subscripts.
    out = out.replace(/\b([A-Za-z]+)_([A-Za-z0-9]+)\b/g, '$1_{$2}');
    // Render scientific notation as mathematics rather than the letter e.
    out = out.replace(/(-?\d+(?:\.\d+)?)e([+-]?\d+)/gi, '$1\\times 10^{$2}');
    return out;
  }

  function patchKatex() {
    if (!window.katex || window.katex.__motorTestsV23Patched) return;
    const originalRender = window.katex.render.bind(window.katex);
    const originalRenderToString = window.katex.renderToString.bind(window.katex);
    window.katex.render = (tex, element, options) => originalRender(prettifyLatex(tex), element, options);
    window.katex.renderToString = (tex, options) => originalRenderToString(prettifyLatex(tex), options);
    window.katex.__motorTestsV23Patched = true;
  }

  function renderCoeffPreview(preview, value) {
    if (!preview) return;
    const tex = coeffToTex(value);
    try {
      if (window.katex) window.katex.render(tex, preview, { throwOnError: false, displayMode: false });
      else preview.textContent = normalizeCoeffText(value);
    } catch (_) {
      preview.textContent = normalizeCoeffText(value);
    }
  }

  function enhanceCoefficientField(input) {
    if (!(input instanceof HTMLInputElement)) return;
    const field = input.closest('.field');
    if (!field || field.dataset.coeffEnhanced === '1') return;
    field.dataset.coeffEnhanced = '1';
    field.classList.add('coefficient-field');

    const clean = normalizeCoeffText(input.value);
    if (clean) input.value = clean;
    input.placeholder = '例如 K_T2';
    input.setAttribute('aria-label', 'Coefficient name');

    const title = field.querySelector(':scope > span');
    if (title) title.textContent = '系数 / Coefficient';

    const editor = document.createElement('div');
    editor.className = 'coeff-editor';
    const preview = document.createElement('div');
    preview.className = 'coeff-math-preview';
    preview.title = '数学显示 / Rendered symbol';
    const raw = document.createElement('div');
    raw.className = 'coeff-raw';
    const hint = document.createElement('div');
    hint.className = 'coeff-hint';
    hint.textContent = '左侧为数学显示；右侧输入普通名称，如 K_T2。';

    input.parentNode.insertBefore(editor, input);
    raw.appendChild(input);
    editor.append(preview, raw, hint);
    renderCoeffPreview(preview, input.value);
    input.addEventListener('input', () => renderCoeffPreview(preview, input.value));
  }

  function enhanceTermRows(root = document) {
    root.querySelectorAll?.('.term-coeff').forEach(enhanceCoefficientField);
  }

  function enhanceResultLabels(root = document) {
    root.querySelectorAll?.('.coeff-table tbody tr td:first-child').forEach(cell => {
      if (cell.dataset.mathEnhanced === '1') return;
      const raw = cell.textContent.trim();
      if (!raw) return;
      cell.dataset.mathEnhanced = '1';
      const tex = prettifyLatex(raw
        .replace(/·/g, '\\cdot ')
        .replace(/\^(-?\d+(?:\.\d+)?)/g, '^{$1}'));
      try {
        if (window.katex) window.katex.render(tex, cell, { throwOnError: false, displayMode: false });
      } catch (_) {}
    });
  }

  function markVersion() {
    const badge = document.querySelector('.version-badge');
    if (badge) badge.textContent = 'UI v2.3 · responsive';
    document.title = 'UAV Propulsion Fit Lab · UI v2.3';
  }

  patchKatex();
  clearLegacyZoomHack();
  markVersion();
  enhanceTermRows();
  enhanceResultLabels();

  window.addEventListener('pageshow', clearLegacyZoomHack);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.term-coeff')) enhanceCoefficientField(node);
        enhanceTermRows(node);
        enhanceResultLabels(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
