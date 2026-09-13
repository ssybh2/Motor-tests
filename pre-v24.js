(() => {
  'use strict';

  function updateZoomCompensation() {
    try {
      const sw = Number(window.screen?.width) || 0;
      const iw = Number(window.innerWidth) || 0;
      if (!sw || !iw) return;
      const ratio = sw / iw;
      const root = document.documentElement;
      if (ratio > 0.12 && ratio < 0.78 && iw > 1400) {
        const factor = Math.min(4, Math.max(1, 1 / ratio));
        root.classList.add('site-zoom-compensated');
        root.style.setProperty('--site-scale', factor.toFixed(4));
        root.style.setProperty('--site-width', `${(100 / factor).toFixed(4)}%`);
      } else {
        root.classList.remove('site-zoom-compensated');
        root.style.removeProperty('--site-scale');
        root.style.removeProperty('--site-width');
      }
    } catch (_) {}
  }

  function normalizeMath(tex) {
    let out = String(tex ?? '');
    // app-v2 historically used \, as a thin-space separator. Always show an explicit multiplication dot.
    out = out.replace(/\\,\s*/g, '\\mathbin{\\cdot} ');
    // Defensive fallback for any literal comma that appears between a coefficient and a variable.
    out = out.replace(/([}\w])\s*,\s*(?=(?:\\mathrm|\\omega|\\Omega|[A-Za-z]))/g, '$1\\mathbin{\\cdot} ');
    // Editable coefficient names such as K_T2 become proper LaTeX subscripts.
    out = out.replace(/\b([A-Za-z]+)_([A-Za-z0-9]+)\b/g, '$1_{$2}');
    // Scientific notation should look like mathematics.
    out = out.replace(/(-?\d+(?:\.\d+)?)e([+-]?\d+)/gi, '$1\\times 10^{$2}');
    return out;
  }

  function patchKatex() {
    if (!window.katex || window.katex.__motorTestsV24Patched) return;
    const render = window.katex.render.bind(window.katex);
    const renderToString = window.katex.renderToString.bind(window.katex);
    window.katex.render = (tex, element, options) => render(normalizeMath(tex), element, options);
    window.katex.renderToString = (tex, options) => renderToString(normalizeMath(tex), options);
    window.katex.__motorTestsV24Patched = true;
  }

  updateZoomCompensation();
  patchKatex();
  window.addEventListener('resize', updateZoomCompensation, { passive: true });
})();
