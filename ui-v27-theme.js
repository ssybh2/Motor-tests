(() => {
  'use strict';

  const Plotly = window.Plotly;
  if (!Plotly || Plotly.__motorTestsThemePatched) return;

  function uiScale() {
    const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v27-ui-scale'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function plotElement(target) {
    if (target instanceof HTMLElement) return target;
    if (typeof target === 'string') return document.getElementById(target);
    return null;
  }

  function isMotorPlot(target) {
    const el = plotElement(target);
    return !!el && (el.classList.contains('fit-plot') || el.classList.contains('residual-plot'));
  }

  function isResidualPlot(target) {
    const el = plotElement(target);
    return !!el && el.classList.contains('residual-plot');
  }

  function titleObject(value, size) {
    if (!value) return { font: { size } };
    if (typeof value === 'string') return { text: value, font: { size } };
    return { ...value, font: { ...(value.font || {}), size } };
  }

  function decorateTraces(data, residual) {
    if (!Array.isArray(data)) return data;
    return data.map((trace, index) => {
      const next = { ...trace };
      if (residual) {
        next.marker = { ...(trace.marker || {}), color: '#0ea5e9', line: { color: '#0369a1', width: .6 } };
        return next;
      }
      if (index === 0) {
        next.marker = { ...(trace.marker || {}), color: '#06b6d4', line: { color: '#0e7490', width: .55 } };
      } else if (index === 1) {
        next.line = { ...(trace.line || {}), color: '#7c3aed', width: Math.max(3, Number(trace.line?.width) || 3) };
      }
      return next;
    });
  }

  function decorateLayout(layout, target) {
    const s = uiScale();
    const base = layout || {};
    const residual = isResidualPlot(target);
    const title = titleObject(base.title, 15 * s);
    const xaxis = { ...(base.xaxis || {}) };
    const yaxis = { ...(base.yaxis || {}) };

    return {
      ...base,
      margin: { ...(base.margin || {}), l: 78 * s, r: 26 * s, t: 98 * s, b: 72 * s },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#fbfdff',
      font: { ...(base.font || {}), family: 'Inter, system-ui, sans-serif', size: 12 * s, color: '#26344d' },
      title: {
        ...title,
        x: .02,
        y: .985,
        xanchor: 'left',
        yanchor: 'top',
        font: { ...(title.font || {}), size: 15 * s, color: '#13213a' }
      },
      legend: {
        ...(base.legend || {}),
        orientation: 'h',
        x: .02,
        y: 1.135,
        xanchor: 'left',
        yanchor: 'bottom',
        bgcolor: 'rgba(255,255,255,.86)',
        borderwidth: 0,
        font: { ...(base.legend?.font || {}), size: 11.5 * s, color: '#42526b' }
      },
      xaxis: {
        ...xaxis,
        automargin: true,
        gridcolor: '#e9eef6',
        zerolinecolor: '#cbd5e1',
        tickfont: { ...(xaxis.tickfont || {}), size: 11 * s, color: '#34445f' },
        title: { ...titleObject(xaxis.title, 13.5 * s), standoff: 18 * s, font: { ...titleObject(xaxis.title, 13.5 * s).font, color: '#26344d' } }
      },
      yaxis: {
        ...yaxis,
        automargin: true,
        gridcolor: '#e9eef6',
        zerolinecolor: residual ? '#94a3b8' : '#cbd5e1',
        tickfont: { ...(yaxis.tickfont || {}), size: 11 * s, color: '#34445f' },
        title: { ...titleObject(yaxis.title, 13.5 * s), standoff: 20 * s, font: { ...titleObject(yaxis.title, 13.5 * s).font, color: '#26344d' } }
      }
    };
  }

  const originalNewPlot = Plotly.newPlot.bind(Plotly);
  Plotly.newPlot = function patchedNewPlot(target, data, layout, config) {
    if (!isMotorPlot(target)) return originalNewPlot(target, data, layout, config);
    return originalNewPlot(
      target,
      decorateTraces(data, isResidualPlot(target)),
      decorateLayout(layout, target),
      { ...(config || {}), displaylogo: false }
    );
  };

  if (typeof Plotly.react === 'function') {
    const originalReact = Plotly.react.bind(Plotly);
    Plotly.react = function patchedReact(target, data, layout, config) {
      if (!isMotorPlot(target)) return originalReact(target, data, layout, config);
      return originalReact(
        target,
        decorateTraces(data, isResidualPlot(target)),
        decorateLayout(layout, target),
        { ...(config || {}), displaylogo: false }
      );
    };
  }

  if (typeof Plotly.relayout === 'function') {
    const originalRelayout = Plotly.relayout.bind(Plotly);
    Plotly.relayout = function patchedRelayout(target, update, ...rest) {
      if (!isMotorPlot(target) || !update || typeof update !== 'object') {
        return originalRelayout(target, update, ...rest);
      }
      const s = uiScale();
      const corrected = {
        ...update,
        'margin.l': 78 * s,
        'margin.r': 26 * s,
        'margin.t': 98 * s,
        'margin.b': 72 * s,
        'title.x': .02,
        'title.y': .985,
        'title.xanchor': 'left',
        'title.yanchor': 'top',
        'title.font.size': 15 * s,
        'legend.orientation': 'h',
        'legend.x': .02,
        'legend.y': 1.135,
        'legend.xanchor': 'left',
        'legend.yanchor': 'bottom',
        'legend.font.size': 11.5 * s,
        'xaxis.automargin': true,
        'yaxis.automargin': true,
        'xaxis.title.standoff': 18 * s,
        'yaxis.title.standoff': 20 * s
      };
      return originalRelayout(target, corrected, ...rest);
    };
  }

  Plotly.__motorTestsThemePatched = true;
})();
