(() => {
  'use strict';

  const normalizeCoeffText = value => String(value || '')
    .replace(/_\{([^}]+)\}/g, '_$1')
    .replace(/\s+/g, '');

  function prettifyLatex(tex) {
    let out = String(tex || '');
    out = out.replace(/\\,/g, '\\cdot ');
    out = out.replace(/\b([A-Za-z]+)_([A-Za-z0-9]+)\b/g, '$1_{$2}');
    return out;
  }

  function patchKatex() {
    if (!window.katex || window.katex.__motorTestsV22Patched) return;
    const originalRender = window.katex.render.bind(window.katex);
    const originalRenderToString = window.katex.renderToString.bind(window.katex);
    window.katex.render = (tex, element, options) => originalRender(prettifyLatex(tex), element, options);
    window.katex.renderToString = (tex, options) => originalRenderToString(prettifyLatex(tex), options);
    window.katex.__motorTestsV22Patched = true;
  }

  function normalizeCoefficientInputs(root = document) {
    root.querySelectorAll('.term-coeff').forEach(input => {
      const clean = normalizeCoeffText(input.value);
      if (clean && clean !== input.value) {
        input.value = clean;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  function normalizeResultLabels(root = document) {
    root.querySelectorAll('.coeff-table tbody tr td:first-child').forEach(cell => {
      const clean = normalizeCoeffText(cell.textContent);
      if (clean !== cell.textContent) cell.textContent = clean;
    });
  }

  function compensateRememberedBrowserZoom() {
    try {
      if (!window.outerWidth || !window.innerWidth) return;
      const ratio = window.outerWidth / window.innerWidth;
      if (ratio > 0.15 && ratio < 0.72) {
        const factor = Math.min(4, Math.max(1, 1 / ratio));
        document.body.style.zoom = String(factor);
        document.body.style.width = `${100 / factor}%`;
        const badge = document.createElement('div');
        badge.className = 'zoom-comp-badge';
        badge.textContent = `已补偿浏览器缩放 ×${factor.toFixed(1)}`;
        document.body.appendChild(badge);
        setTimeout(() => badge.remove(), 4500);
      }
    } catch (_) {}
  }

  function markVersion() {
    const lead = document.querySelector('.hero__lead');
    if (lead && !document.querySelector('.version-badge')) {
      const badge = document.createElement('div');
      badge.className = 'version-badge';
      badge.textContent = 'UI v2.2 · readable controls';
      lead.insertAdjacentElement('afterend', badge);
    }
  }

  patchKatex();
  compensateRememberedBrowserZoom();
  markVersion();
  normalizeCoefficientInputs();
  normalizeResultLabels();

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        normalizeCoefficientInputs(node);
        normalizeResultLabels(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
