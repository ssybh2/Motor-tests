(() => {
  'use strict';

  function normalizeCoeffText(value) {
    return String(value || '').trim().replace(/_\{([^}]+)\}/g, '_$1').replace(/\s+/g, '');
  }

  function coeffToTex(value) {
    const s = normalizeCoeffText(value) || 'a';
    if (/^\\[A-Za-z]+$/.test(s)) return s;
    const m = s.match(/^([A-Za-z]+)_([A-Za-z0-9]+)$/);
    if (m) return `${m[1]}_{${m[2]}}`;
    if (/^[A-Za-z0-9]+$/.test(s)) return s;
    return '\\mathrm{' + s.replace(/[^A-Za-z0-9]/g, '') + '}';
  }

  function renderMath(node, tex) {
    if (!node) return;
    try {
      if (window.katex) window.katex.render(tex, node, { throwOnError: false, displayMode: false });
      else node.textContent = tex;
    } catch (_) {
      node.textContent = tex;
    }
  }

  function enhanceCoefficientField(input) {
    if (!(input instanceof HTMLInputElement)) return;
    const field = input.closest('.field');
    if (!field || field.dataset.coeffV24 === '1') return;
    field.dataset.coeffV24 = '1';

    const clean = normalizeCoeffText(input.value);
    if (clean) input.value = clean;
    input.placeholder = '例如 K_T2';

    const label = field.querySelector(':scope > span');
    if (label) label.textContent = '系数 / Coefficient';

    const editor = document.createElement('div');
    editor.className = 'coeff-editor-v24';
    const rendered = document.createElement('div');
    rendered.className = 'coeff-render-v24';
    rendered.title = '数学显示 / Rendered symbol';
    const raw = document.createElement('div');
    raw.className = 'coeff-input-v24';
    const help = document.createElement('div');
    help.className = 'coeff-help-v24';
    help.textContent = '输入普通名称，例如 K_T2；左侧自动显示为数学符号。';

    field.insertBefore(editor, input);
    raw.appendChild(input);
    editor.append(rendered, raw, help);

    const refresh = () => renderMath(rendered, coeffToTex(input.value));
    refresh();
    input.addEventListener('input', refresh);
  }

  function enhanceCoefficientFields(root = document) {
    root.querySelectorAll?.('.term-coeff').forEach(enhanceCoefficientField);
  }

  function markVersion() {
    const badge = document.querySelector('.version-badge');
    if (badge) badge.textContent = 'UI v2.4 · adaptive';
    document.title = 'UAV Propulsion Fit Lab · UI v2.4';
  }

  markVersion();
  enhanceCoefficientFields();

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.term-coeff')) enhanceCoefficientField(node);
        enhanceCoefficientFields(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
