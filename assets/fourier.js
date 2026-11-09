// Signoff Fourier panel: circles turning on circles (epicycles) draw a wave (1D), an outline (2D),
// or a space curve (3D), adding terms each turn, with the series that draws it printed underneath.
// It was made in the Fourier Epicycles artifact (Chris, 2026-11-08) as a panel for the tools. No
// tool loads it yet; lab/fourier.html shows it.
//
// Embed. The tools' CSP forbids inline scripts, so it is markup plus this file:
//   <script src="../signoff/assets/fourier.js"></script>   (from the hub itself: assets/fourier.js)
//   <div data-signoff-fourier data-mode="2d"></div>          mounts itself once the page has loaded
// or, from a tool's own script:
//   const panel = SignoffFourier.mount(el, { mode: '3d' });  ...  panel.destroy();
// SignoffFourier.mountAll(scope) mounts any [data-signoff-fourier] added later. The panel fills
// its host's width; its height follows the view.
//
// Options (as data-* attributes in kebab case, e.g. data-curve-mode="split"; lists comma-separated):
//   mode       '2d'        the view it opens on: '1d', '2d', or '3d'
//   modes      '1d,2d,3d'  the views its toggle offers (a single view hides the toggle)
//   series     true        the series strip starts shown (the arrow at the bottom right hides it)
//   build      true        add terms each turn; with every term in, hold two turns and start over
//   playing    true        false (and reduced motion) shows each finished curve, still
//   wave       'square'    1D: square, saw, triangle, pulse, or rect
//   waveTurn   4           1D: seconds a turn
//   shape      'dovetail'  2D: dovetail, heart, star, square, or fish
//   outline                2D: your own closed outline instead, [[x, y], ...] with y up
//   layout     'side'      2D: 'side' (circles left, picture right) or 'center'
//   shapeTurn  10          2D: seconds a turn
//   curve      'dovetail'  3D: dovetail, trefoil, tennis, torus, or cube
//   curveMode  'tilted'    3D: 'tilted' (pairs of circles in tilted planes) or 'split' (floor + wall)
//   curveTurn  10          3D: seconds a turn
//   spin       true        3D: the view turns slowly
//   logoView   false       3D: the Dovetail seen from where the logo's perspective puts the eye
//   threeUrl               where three.js is; by default vendor/three.min.js beside this file. It
//                          loads the first time a panel shows 3D, unless the page already has THREE.
//
// In the panel: drag on 1D or 2D to draw a new wave or outline, or on 3D to turn it (Ctrl + wheel
// zooms; a plain wheel scrolls the page). Reset puts back the chosen shape and camera and starts
// over from one term. Colors come from the suite's tokens (--bg-elev, --text, --text-2, --text-3,
// --hair-2, --accent, --accent-soft, --mono), with fallbacks, and follow data-theme.
(function () {
  'use strict';
  if (window.SignoffFourier) return;

  const SCRIPT = document.currentScript ? document.currentScript.src : '';
  const THREE_URL = SCRIPT ? new URL('vendor/three.min.js', SCRIPT).href : 'vendor/three.min.js';
  const TAU = Math.PI * 2;
  const MINUS = '\u2212', DEG = '\u00b0', PI = '\u03c0';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
  const DARK = matchMedia('(prefers-color-scheme: dark)');
  // circle counts the 2D and 3D views step through, a turn each
  const STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 100, 128, 160, 200, 250, 300];
  const FADE = 900;   // ms for the previous step's gray curve and an old target to fade in or out
  const fadeOf = (g, now) => Math.min(1, (now - g.born) / FADE) * (g.dying ? Math.max(0, 1 - (now - g.dying) / FADE) : 1);
  // The traced line is one trail two turns long. It fades a quarter over its first turn, so its end is
  // at 75% as the next cycle starts (Chris, 2026-11-07), then fades out over the second.
  const trailAlpha = age => { const a = age / TAU; return a <= 1 ? 1 - 0.25 * a : Math.max(0, 0.75 * (2 - a)); };
  const degOf = a => { const d = Math.round(a * 180 / Math.PI); return ((d + 180) % 360 + 360) % 360 - 180; };
  const phase = d => d ? ` ${d < 0 ? MINUS : '+'} ${Math.abs(d)}${DEG}` : '';
  const fmt = v => Math.abs(v).toFixed(3);
  let uid = 0;

  // ---------- styles ----------
  const C = {
    panel: 'var(--bg-elev, var(--panel, #fff))', ink: 'var(--text, var(--ink, #1d1d1f))',
    muted: 'var(--text-2, var(--muted, #515154))', faint: 'var(--text-3, var(--muted, #86868b))',
    line: 'var(--hair-2, var(--line, rgba(0, 0, 0, 0.14)))', accent: 'var(--accent, #00727f)',
    soft: 'var(--accent-soft, rgba(0, 114, 127, 0.1))',
  };
  const CSS = `
.sfx { position: relative; overflow: hidden; color: ${C.ink}; background: ${C.panel}; border: 1px solid ${C.line};
  border-radius: 12px; font: 13px/1.4 var(--sans, system-ui, sans-serif); }
.sfx [hidden] { display: none !important; }
.sfx-view { position: relative; }
.sfx-canvas { display: block; width: 100%; touch-action: none; }
.sfx-draw { cursor: crosshair; }
.sfx-turn { cursor: grab; }
.sfx-turn:active { cursor: grabbing; }
.sfx-hint { position: absolute; right: 12px; top: 9px; font-size: 12px; color: ${C.faint}; pointer-events: none; }
.sfx-bar { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px; }
.sfx-btn { width: 28px; height: 28px; margin: 0; padding: 0; display: grid; place-items: center; color: ${C.muted};
  background: ${C.panel}; border: 1px solid ${C.line}; border-radius: 7px; cursor: pointer; }
.sfx-btn:hover { color: ${C.ink}; background: ${C.soft}; }
.sfx-fold { position: absolute; right: 10px; bottom: 10px; }
.sfx-fold[aria-expanded="false"] svg { transform: rotate(180deg); }
.sfx-modes { height: 28px; padding: 2px; display: flex; gap: 2px; background: ${C.panel}; border: 1px solid ${C.line};
  border-radius: 7px; }
.sfx-modes button { margin: 0; font: 600 11px/1 var(--sans, system-ui, sans-serif); color: ${C.muted}; background: transparent;
  border: 0; border-radius: 5px; padding: 0 7px; cursor: pointer; }
.sfx-modes button[aria-pressed="true"] { color: ${C.panel}; background: ${C.ink}; }
.sfx-modes button:hover:not([aria-pressed="true"]) { color: ${C.ink}; background: ${C.soft}; }
.sfx button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
.sfx-msg { font-size: 12px; color: ${C.ink}; background: ${C.soft}; border-radius: 6px; padding: 4px 8px; }
.sfx-series { border-top: 1px solid ${C.line}; padding: 8px 12px; font: 12px/1.6 var(--mono, ui-monospace, Consolas, monospace);
  min-height: calc(3.2em + 17px); max-height: calc(19.2em + 17px); overflow-y: auto; overflow-wrap: anywhere; }
.sfx-series .t { white-space: nowrap; }
.sfx-series .new { background: ${C.soft}; border-radius: 4px; padding: 1px 3px; }
.sfx-series sup { font-size: 0.75em; line-height: 0; }
`;
  function injectCss() {
    if (document.getElementById('sfx-style')) return;
    const s = document.createElement('style');
    s.id = 'sfx-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const ICON = (d, extra) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra || ''}</svg>`;
  const ICON_RESET = ICON('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>', '<path d="M3 3v5h5"/>');
  const ICON_FOLD = ICON('<path d="M6 15l6-6 6 6"/>');

  // ---------- colors ----------
  const TOKENS = {
    panel: ['--bg-elev', '--panel', '#ffffff'], ink: ['--text', '--ink', '#1d1d1f'], muted: ['--text-2', '--muted', '#515154'],
    line: ['--hair-2', '--line', 'rgba(0, 0, 0, 0.14)'], accent: ['--accent', '#00727f'],
    mono: ['--mono', 'ui-monospace, Consolas, monospace'],
  };
  function readColors(el) {
    const cs = getComputedStyle(el), out = {};
    for (const k in TOKENS) {
      for (const t of TOKENS[k]) {
        const v = t.startsWith('--') ? cs.getPropertyValue(t).trim() : t;
        if (v) { out[k] = v; break; }
      }
    }
    return out;
  }
  // three.js drops a color's alpha, so translucent tokens (--hair-2) are painted over the panel first
  let mixer = null;
  function opaque(color, over) {
    if (!mixer) { const m = document.createElement('canvas'); m.width = m.height = 1; mixer = m.getContext('2d', { willReadFrequently: true }); }
    mixer.clearRect(0, 0, 1, 1);
    mixer.fillStyle = '#ffffff'; mixer.fillStyle = over; mixer.fillRect(0, 0, 1, 1);
    mixer.fillStyle = '#000000'; mixer.fillStyle = color; mixer.fillRect(0, 0, 1, 1);
    const d = mixer.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
  }

  // ---------- the series strip ----------
  // Items are { sign, text, fresh } in order; fresh ones (added this turn) are highlighted.
  function seriesLine(prefix, items) {
    return prefix + ' = ' + items.map((it, j) => `<span class="t${it.fresh ? ' new' : ''}">` +
      (j ? (it.sign < 0 ? MINUS + ' ' : '+ ') : (it.sign < 0 ? MINUS : '')) + it.text + '</span>').join(' ');
  }

  function canvasEl(cls, label) {
    const cv = document.createElement('canvas');
    cv.className = 'sfx-canvas ' + cls;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', label);
    cv.hidden = true;
    return cv;
  }

  // Each view: { cv, hint, layout(W, dpr), tick(dt), draw(), reset(), series(), recolor(), destroy() }.
  // It calls panel.terms(view) whenever its terms change, and reads panel.colors and panel.playing.

  // ---------- 1D: one period of a wave ----------
  const WAVES = {
    square: t => t < Math.PI ? 1 : -1,
    saw: t => (t - Math.PI) / Math.PI,
    triangle: t => (2 / Math.PI) * Math.asin(Math.sin(t)),
    pulse: t => t < Math.PI / 2 ? 1 : 0,
    rect: t => Math.max(0, Math.sin(t)),
  };
  function waveView(panel, o) {
    const M = 1024, N_MAX = 60, P = 720;
    const cv = canvasEl('sfx-draw', 'Circles on the left trace a wave on the right; drag on the plot to draw your own');
    const c = cv.getContext('2d');
    const st = {
      wave: '', base: WAVES[o.wave] ? o.wave : 'square', samples: new Float32Array(M), a0: 0, terms: [], order: [],
      k: 1, t: 0, hold: 0, turn: +o.waveTurn > 0 ? +o.waveTurn : 4, build: o.build !== false,
      cur: new Float32Array(P + 1), prev: new Float32Array(P + 1), target: new Float32Array(P + 1),
    };
    let geo = {}, size = { W: 0, H: 0 }, drawing = null;
    const view = { cv, hint: 'Drag on the plot to draw a new wave' };

    function setWave(name) {
      st.wave = name;
      const f = WAVES[name];
      for (let i = 0; i < M; i++) st.samples[i] = f(TAU * (i + 0.5) / M);
      analyze();
    }
    // Amplitude and phase of each harmonic n = 1..60, by multiplying the wave by sin(nt) and cos(nt) and
    // averaging; terms smaller than 0.2% of the largest are skipped (the square wave's even ones).
    function analyze() {
      const s = st.samples;
      let sum = 0;
      for (let i = 0; i < M; i++) sum += s[i];
      st.a0 = 2 * sum / M;
      st.terms = [];
      for (let n = 1; n <= N_MAX; n++) {
        let a = 0, b = 0;
        for (let i = 0; i < M; i++) { const th = n * TAU * (i + 0.5) / M; a += s[i] * Math.cos(th); b += s[i] * Math.sin(th); }
        a *= 2 / M; b *= 2 / M;
        st.terms.push({ n, r: Math.hypot(a, b), phi: Math.atan2(a, b) });
      }
      const rmax = Math.max(...st.terms.map(t => t.r), 1e-9);
      st.order = st.terms.filter(t => t.r > rmax * 2e-3);
      if (!st.order.length) st.order = [st.terms[0]];
      for (let i = 0; i <= P; i++) st.target[i] = s[Math.min(M - 1, Math.floor(i / P * M))];
      fit();
      start();
    }
    function partial(k, out) {
      const half = st.a0 / 2;
      for (let i = 0; i <= P; i++) {
        const t = TAU * i / P;
        let y = half;
        for (let j = 0; j < k; j++) { const q = st.order[j]; y += q.r * Math.sin(q.n * t + q.phi); }
        out[i] = y;
      }
    }
    function setK(k, resetT) {
      st.k = Math.max(1, Math.min(st.order.length, k));
      partial(st.k, st.cur);
      partial(st.k - 1, st.prev);
      if (resetT) st.t = 0;
      st.hold = 0;
      panel.terms(view);
    }
    // playing: from one term; still: the finished wave
    function start() {
      if (panel.playing) setK(1, true);
      else { setK(st.order.length, true); st.t = TAU - 1e-9; }
    }

    // Zoomed out 1.5x in a column of the usual width, so the circles have room on the left; room at the
    // bottom for the buttons, and the plot stops short of the series arrow at the bottom right.
    function fit() {
      const { W, H } = size;
      if (!W) return;
      const padT = 18, padB = 46, half = (H - padT - padB) / 2;
      let lo = Infinity, hi = -Infinity;
      for (const v of st.target) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const mid = (lo + hi) / 2, r1 = st.order[0] ? st.order[0].r : 1;
      const reach = Math.max((hi - lo) / 2 * 1.2, r1 * 1.05, 0.2);
      const L = Math.min(H * 0.95, W * 0.36);
      const scale = Math.min(half / reach, (L / 2 - 6) / Math.max(r1, 0.2)) / 1.5;
      geo = { W, H, L, cx: L / 2 + 8, cy: padT + half + mid * scale, scale, x0: L + 40, x1: W - 56 };
    }
    view.layout = (W, dpr) => {
      const H = Math.round(W * 0.46);
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      size = { W, H };
      fit();
    };
    const X = t => geo.x0 + (geo.x1 - geo.x0) * t / TAU;
    const Y = v => geo.cy - v * geo.scale;
    function curvePath(arr, upto) {
      const last = Math.min(P, Math.floor(upto / TAU * P));
      c.beginPath();
      for (let i = 0; i <= last; i++) { const x = X(TAU * i / P), y = Y(arr[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    }

    view.draw = () => {
      const g = geo, col = panel.colors;
      if (!g.W) return;
      c.clearRect(0, 0, g.W, g.H);
      // axes and ticks
      c.lineWidth = 1; c.strokeStyle = col.line;
      c.beginPath(); c.moveTo(g.x0, Y(0)); c.lineTo(g.x1, Y(0)); c.stroke();
      c.setLineDash([2, 4]);
      for (const v of [1, -1]) { c.beginPath(); c.moveTo(g.x0, Y(v)); c.lineTo(g.x1, Y(v)); c.stroke(); }
      c.setLineDash([]);
      c.fillStyle = col.muted; c.font = '11px ' + col.mono;
      c.textAlign = 'center'; c.textBaseline = 'top';
      for (const [t, s] of [[0, '0'], [Math.PI / 2, PI + '/2'], [Math.PI, PI], [1.5 * Math.PI, '3' + PI + '/2'], [TAU, '2' + PI]]) {
        const x = X(t);
        c.beginPath(); c.moveTo(x, g.H - 22); c.lineTo(x, g.H - 18); c.stroke();
        c.fillText(s, x, g.H - 16);
      }
      c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillText('+1', g.x0 - 6, Y(1)); c.fillText('0', g.x0 - 6, Y(0)); c.fillText(MINUS + '1', g.x0 - 6, Y(-1));
      // target, the previous sum, the sum so far
      c.strokeStyle = col.ink; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.globalAlpha = 0.14;
      curvePath(st.target, TAU); c.stroke();
      c.setLineDash([]); c.globalAlpha = 1;
      if (st.k > 1) { c.strokeStyle = col.muted; c.lineWidth = 1; c.globalAlpha = 0.55; curvePath(st.prev, TAU); c.stroke(); c.globalAlpha = 1; }
      c.strokeStyle = col.accent; c.lineWidth = 2.5; c.lineJoin = 'round';
      curvePath(st.cur, st.t); c.stroke();
      // the circles, from the DC level
      let px = g.cx, py = Y(st.a0 / 2);
      if (Math.abs(st.a0) > 1e-3) {
        c.strokeStyle = col.muted; c.lineWidth = 1; c.setLineDash([2, 3]);
        c.beginPath(); c.moveTo(g.cx, Y(0)); c.lineTo(px, py); c.stroke(); c.setLineDash([]);
      }
      c.beginPath(); c.moveTo(g.cx - 4, Y(0)); c.lineTo(g.cx + 4, Y(0)); c.strokeStyle = col.muted; c.stroke();
      for (let j = 0; j < st.k; j++) {
        const q = st.order[j], R = q.r * g.scale, th = q.n * st.t + q.phi;
        const nx = px + R * Math.cos(th), ny = py - R * Math.sin(th);
        const newest = j === st.k - 1 && st.k > 1;
        c.globalAlpha = Math.max(0.22, 0.75 - j * 0.06);
        c.strokeStyle = col.ink; c.lineWidth = newest ? 1.6 : 1;
        if (newest) c.setLineDash([3, 3]);
        c.beginPath(); c.arc(px, py, R, 0, TAU); c.stroke();
        c.setLineDash([]);
        c.globalAlpha = Math.min(1, c.globalAlpha + 0.25);
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
        c.globalAlpha = 1;
        px = nx; py = ny;
      }
      // the bar across to the plot, and its dots
      const gx = X(st.t);
      c.strokeStyle = col.accent; c.lineWidth = 1; c.setLineDash([4, 4]); c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(px, py); c.lineTo(gx, py); c.stroke();
      c.setLineDash([]); c.globalAlpha = 1;
      for (const [x, y, r] of [[px, py, 4], [gx, py, 5]]) {
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col.accent; c.fill();
        c.lineWidth = 2; c.strokeStyle = col.panel; c.stroke();
      }
    };

    view.tick = dt => {
      if (!panel.playing) return;
      st.t += dt * TAU / st.turn;
      if (st.t >= TAU) {
        st.t -= TAU;
        if (st.build) {
          if (st.k < st.order.length) setK(st.k + 1);
          else if (++st.hold >= 2) setK(1);
        }
      }
    };

    // drawing your own: one value per sample across the plot
    function sampleAt(e) {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const i = Math.round((x - geo.x0) / (geo.x1 - geo.x0) * (M - 1));
      const v = Math.max(-1.6, Math.min(1.6, (geo.cy - y) / geo.scale));
      return { i: Math.max(0, Math.min(M - 1, i)), v, inside: x >= geo.x0 - 10 && x <= geo.x1 + 10 };
    }
    const retarget = () => { for (let i = 0; i <= P; i++) st.target[i] = st.samples[Math.min(M - 1, Math.floor(i / P * M))]; };
    cv.addEventListener('pointerdown', e => {
      if (!geo.W) return;
      const s = sampleAt(e);
      if (!s.inside) return;
      cv.setPointerCapture(e.pointerId);
      panel.msg('');
      drawing = s;
      st.samples[s.i] = s.v;
      st.wave = 'drawn';
      retarget();
    });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return;
      const s = sampleAt(e), a = drawing, step = s.i >= a.i ? 1 : -1;
      for (let i = a.i; i !== s.i + step; i += step) st.samples[i] = a.v + (s.v - a.v) * (s.i === a.i ? 1 : (i - a.i) / (s.i - a.i));
      drawing = s;
      retarget();
    });
    const endDraw = () => { if (drawing) { drawing = null; analyze(); } };
    cv.addEventListener('pointerup', endDraw);
    cv.addEventListener('pointercancel', endDraw);

    view.reset = () => { panel.msg(''); if (st.wave === st.base) start(); else setWave(st.base); };

    function termText(q) {
      const deg = q.phi * 180 / Math.PI, arg = q.n === 1 ? 't' : q.n + 't';
      const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < 1.5;
      if (near(deg, 0)) return [1, `${fmt(q.r)} sin(${arg})`];
      if (near(deg, 180)) return [-1, `${fmt(q.r)} sin(${arg})`];
      if (near(deg, 90)) return [1, `${fmt(q.r)} cos(${arg})`];
      if (near(deg, -90)) return [-1, `${fmt(q.r)} cos(${arg})`];
      return [1, `${fmt(q.r)} sin(${arg}${phase(Math.round(deg))})`];
    }
    view.series = () => {
      const items = [];
      if (Math.abs(st.a0) > 1e-3) items.push({ sign: Math.sign(st.a0), text: fmt(st.a0 / 2) });
      st.order.slice(0, st.k).forEach((q, j) => { const [sign, text] = termText(q); items.push({ sign, text, fresh: st.k > 1 && j === st.k - 1 }); });
      return seriesLine(`f<sub>${st.k}</sub>(t)`, items);
    };
    view.recolor = () => {};
    view.destroy = () => {};
    setWave(st.base);
    return view;
  }

  // ---------- 2D: a closed outline ----------
  // Shapes in y-up coordinates; each returns a closed polyline.
  const dense = (f, n = 2000) => { const out = []; for (let i = 0; i < n; i++) out.push(f(TAU * i / n)); return out; };
  const SHAPES = {
    // The Dovetail mark (viewBox 59.21 x 98.68, y down): top-left block, bottom-left block, then the slotted
    // block, ordered so the hops between blocks run along the thin gaps.
    dovetail: () => [
      [18.19, 41.88], [0, 41.88], [0, 0], [18.19, 0], [18.19, 41.88],
      [18.19, 56.79], [18.19, 98.67], [0, 98.67], [0, 56.79], [18.19, 56.79],
      [19.79, 56.79], [19.79, 98.68], [59.21, 88.21], [59.21, 10.47], [19.79, 0], [19.79, 41.89],
      [44.75, 35.26], [44.75, 63.42], [19.79, 56.79],
    ].map(([x, y]) => [x, -y]),
    heart: () => dense(th => [16 * Math.sin(th) ** 3, 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)]),
    star: () => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.42 : 1, a = Math.PI / 2 + i * Math.PI / 5; return [r * Math.cos(a), r * Math.sin(a)]; }),
    square: () => [[1, 1], [-1, 1], [-1, -1], [1, -1]],
    fish: () => dense(th => [Math.cos(th) - Math.sin(th) ** 2 / Math.SQRT2, Math.cos(th) * Math.sin(th)]),
  };
  let TABLES = null;   // cos and sin of 2*pi*k/1024, shared by every 2D view
  function outlineView(panel, o) {
    const M = 1024, K = 150, P = 1200;
    if (!TABLES) {
      TABLES = { cos: new Float64Array(M), sin: new Float64Array(M) };
      for (let k = 0; k < M; k++) { TABLES.cos[k] = Math.cos(TAU * k / M); TABLES.sin[k] = Math.sin(TAU * k / M); }
    }
    const { cos: COS, sin: SIN } = TABLES;
    const cv = canvasEl('sfx-draw', 'Circles trace a closed outline; drag to draw your own');
    const c = cv.getContext('2d');
    const custom = Array.isArray(o.outline) && o.outline.length >= 3 && o.outline.every(p => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]));
    const name = SHAPES[o.shape] ? o.shape : 'dovetail';
    const st = {
      shape: '', xs: new Float64Array(M), ys: new Float64Array(M), c0: [0, 0], coef: [], k: 1, prevK: 0, t: 0, hold: 0,
      turn: +o.shapeTurn > 0 ? +o.shapeTurn : 10, build: o.build !== false, side: o.layout !== 'center',
      cur: new Float32Array(2 * (P + 1)), prev: new Float32Array(2 * (P + 1)), stroke: null,
      base: custom ? { poly: o.outline.map(p => [+p[0], +p[1]]), shape: 'custom' } : { poly: SHAPES[name](), shape: name },
      cum: 0,        // total angle turned; the trail is measured in it
      runs: [],      // trail pieces: { arr: the curve for one circle count, start: cum when it began, t0: t then, reset }
      grays: [],     // previous-step curves, cross-fading: { arr, born, dying }
      targets: [],   // target outlines, cross-fading: { xs, ys, born, dying }
    };
    let geo = {};
    const view = { cv, hint: 'Drag on the plot to draw a new outline' };

    // resampled to M points evenly spaced along the outline, centered and scaled to span 2 units
    function resample(poly) {
      const n = poly.length, seg = new Float64Array(n);
      let L = 0;
      for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]); L += seg[i]; }
      let j = 0, acc = 0;
      for (let k = 0; k < M; k++) {
        const s = k * L / M;
        while (j < n - 1 && acc + seg[j] < s) { acc += seg[j]; j++; }
        const a = poly[j], b = poly[(j + 1) % n], f = seg[j] ? (s - acc) / seg[j] : 0;
        st.xs[k] = a[0] + (b[0] - a[0]) * f; st.ys[k] = a[1] + (b[1] - a[1]) * f;
      }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let k = 0; k < M; k++) { x0 = Math.min(x0, st.xs[k]); x1 = Math.max(x1, st.xs[k]); y0 = Math.min(y0, st.ys[k]); y1 = Math.max(y1, st.ys[k]); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max(x1 - x0, y1 - y0, 1e-9) / 2;
      for (let k = 0; k < M; k++) { st.xs[k] = (st.xs[k] - cx) / half; st.ys[k] = (st.ys[k] - cy) / half; }
    }
    // one coefficient c_n per frequency -150..150 from a DFT of the points read as x + iy; circles sorted biggest first
    function setPoints(poly, shape) {
      st.shape = shape;
      resample(poly);
      const now = performance.now();
      for (const g of st.targets) if (!g.dying) g.dying = now;
      st.targets.push({ xs: st.xs.slice(), ys: st.ys.slice(), born: st.targets.length ? now : now - FADE, dying: null });
      const list = [];
      for (let n = -K; n <= K; n++) {
        let re = 0, im = 0;
        for (let k = 0; k < M; k++) {
          const idx = (((n * k) % M) + M) % M, co = COS[idx], si = SIN[idx], x = st.xs[k], y = st.ys[k];
          re += x * co + y * si; im += y * co - x * si;
        }
        re /= M; im /= M;
        if (n === 0) st.c0 = [re, im];
        else list.push({ n, r: Math.hypot(re, im), a: Math.atan2(im, re) });
      }
      list.sort((p, q) => q.r - p.r);
      st.coef = list;
      start();
    }
    function partial(k, out) {
      for (let i = 0; i <= P; i++) {
        const t = TAU * i / P;
        let x = st.c0[0], y = st.c0[1];
        for (let j = 0; j < k; j++) { const q = st.coef[j], th = q.a + q.n * t; x += q.r * Math.cos(th); y += q.r * Math.sin(th); }
        out[2 * i] = x; out[2 * i + 1] = y;
      }
    }
    const stepUp = k => Math.min(st.coef.length, STEPS.find(s => s > k) || st.coef.length);
    const stepDown = k => { let b = 0; for (const s of STEPS) if (s < k) b = s; return b; };
    function setK(k, prevK, resetT) {
      st.k = Math.max(1, Math.min(st.coef.length, k));
      st.prevK = prevK == null ? stepDown(st.k) : prevK;
      partial(st.k, st.cur);
      if (st.prevK > 0) partial(st.prevK, st.prev);
      if (resetT) st.t = 0;
      // the trail carries on with the new curve (a reset starts a separate piece); while still, the
      // new curve shows along the whole trail at once
      if (panel.playing) st.runs.push({ arr: st.cur.slice(), start: st.cum, t0: st.t, reset: !!resetT });
      else st.runs = [{ arr: st.cur.slice(), start: st.cum - TAU, t0: st.t - TAU, reset: true }];
      const now = performance.now();
      for (const g of st.grays) if (!g.dying) g.dying = now;
      if (st.prevK > 0) st.grays.push({ arr: st.prev.slice(), born: now, dying: null });
      st.hold = 0;
      panel.terms(view);
    }
    function start() {
      if (panel.playing) setK(1, 0, true);
      else setK(st.coef.length, 0, true);
    }

    view.layout = (W, dpr) => {
      const H = Math.round(W * (st.side ? 0.5 : 0.6));
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      // cx: center of the circles; ox: center of the picture (the same point when centered)
      geo = st.side
        ? { W, H, cx: W * 0.25, ox: W * 0.72, cy: H / 2, s: Math.min(W * 0.18, H * 0.4) }
        : { W, H, cx: W / 2, ox: W / 2, cy: H / 2, s: Math.min(W, H) * 0.38 };
    };
    const X = x => geo.ox + x * geo.s, XC = x => geo.cx + x * geo.s, Y = y => geo.cy - y * geo.s;
    function pathOf(arr, upto) {
      const last = Math.min(P, Math.floor(upto / TAU * P));
      c.beginPath();
      for (let i = 0; i <= last; i++) { const x = X(arr[2 * i]), y = Y(arr[2 * i + 1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    }
    function drawTrail() {
      const cum = st.cum, lo = cum - 2 * TAU, step = TAU / P, BANDS = 32;
      const endOf = i => i + 1 < st.runs.length ? st.runs[i + 1].start : cum;
      st.runs = st.runs.filter((r, i) => endOf(i) > lo || i === st.runs.length - 1);
      c.strokeStyle = panel.colors.accent; c.lineWidth = 2.5;
      let band = -1, open = false;
      const flush = () => { if (open) { c.globalAlpha = band / BANDS; c.stroke(); } open = false; };
      for (let i = 0; i < st.runs.length; i++) {
        const r = st.runs[i], end = endOf(i), a = Math.max(r.start, lo);
        if (end <= a) continue;
        if (r.reset) flush();
        for (let cc = a, last = false; !last; cc += step) {
          if (cc >= end) { cc = end; last = true; }
          const lt = ((r.t0 + cc - r.start) % TAU + TAU) % TAU;
          const f = lt / TAU * P, i0 = Math.min(P - 1, Math.floor(f)), fr = f - i0;
          const px = X(r.arr[2 * i0] + (r.arr[2 * i0 + 2] - r.arr[2 * i0]) * fr);
          const py = Y(r.arr[2 * i0 + 1] + (r.arr[2 * i0 + 3] - r.arr[2 * i0 + 1]) * fr);
          const b = Math.round(BANDS * trailAlpha(cum - cc));
          if (!open) { c.beginPath(); c.moveTo(px, py); open = true; band = b; continue; }
          c.lineTo(px, py);
          if (b !== band) { flush(); c.beginPath(); c.moveTo(px, py); open = true; band = b; }
        }
      }
      flush();
      c.globalAlpha = 1;
    }

    view.draw = () => {
      const g = geo, col = panel.colors;
      if (!g.W) return;
      c.clearRect(0, 0, g.W, g.H);
      c.lineJoin = 'round'; c.lineCap = 'round';
      if (st.stroke) {   // drawing in progress
        c.strokeStyle = col.accent; c.lineWidth = 2.5;
        c.beginPath(); st.stroke.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.stroke();
        return;
      }
      const now = performance.now();
      // target outlines, cross-fading when the shape changes
      st.targets = st.targets.filter(t => !t.dying || now - t.dying < FADE);
      c.strokeStyle = col.ink; c.lineWidth = 1.5; c.setLineDash([5, 4]);
      for (const t of st.targets) {
        c.globalAlpha = 0.125 * fadeOf(t, now);
        c.beginPath();
        for (let k = 0; k <= M; k++) { const i = k % M, x = X(t.xs[i]), y = Y(t.ys[i]); k ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
      c.setLineDash([]);
      // the previous step, cross-fading at each change of circle count
      st.grays = st.grays.filter(gr => !gr.dying || now - gr.dying < FADE);
      c.strokeStyle = col.muted; c.lineWidth = 1;
      for (const gr of st.grays) { c.globalAlpha = 0.55 * fadeOf(gr, now); pathOf(gr.arr, TAU); c.stroke(); }
      c.globalAlpha = 1;
      drawTrail();
      // the circles
      let x = st.c0[0], y = st.c0[1];
      c.strokeStyle = col.ink;
      for (let j = 0; j < st.k; j++) {
        const q = st.coef[j], th = q.a + q.n * st.t;
        const nx = x + q.r * Math.cos(th), ny = y + q.r * Math.sin(th), R = q.r * g.s;
        if (R > 0.6) {
          c.globalAlpha = Math.max(0.12, 0.6 - j * 0.03); c.lineWidth = 1;
          c.beginPath(); c.arc(XC(x), Y(y), R, 0, TAU); c.stroke();
          c.globalAlpha = Math.max(0.3, 0.9 - j * 0.03); c.lineWidth = 1.3;
          c.beginPath(); c.moveTo(XC(x), Y(y)); c.lineTo(XC(nx), Y(ny)); c.stroke();
        }
        x = nx; y = ny;
      }
      c.globalAlpha = 1;
      const dots = [[XC(x), Y(y)]];
      if (g.ox !== g.cx) {   // side by side: carry the tip across to the drawing point
        c.strokeStyle = col.accent; c.lineWidth = 1; c.setLineDash([4, 4]); c.globalAlpha = 0.8;
        c.beginPath(); c.moveTo(XC(x), Y(y)); c.lineTo(X(x), Y(y)); c.stroke();
        c.setLineDash([]); c.globalAlpha = 1;
        dots.push([X(x), Y(y)]);
      }
      for (const [dx, dy] of dots) {
        c.beginPath(); c.arc(dx, dy, 4.5, 0, TAU); c.fillStyle = col.accent; c.fill();
        c.lineWidth = 2; c.strokeStyle = col.panel; c.stroke();
      }
    };

    view.tick = dt => {
      if (!panel.playing || st.stroke) return;
      st.t += dt * TAU / st.turn;
      st.cum += dt * TAU / st.turn;
      if (st.t >= TAU) {
        st.t -= TAU;
        if (st.build) {
          if (st.k < st.coef.length) setK(stepUp(st.k), st.k);
          else if (++st.hold >= 2) setK(1, 0);
        }
      }
    };

    // drawing your own outline, measured against the picture
    const toModel = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - geo.ox) / geo.s, (geo.cy - (e.clientY - r.top)) / geo.s]; };
    cv.addEventListener('pointerdown', e => {
      if (!geo.W) return;
      cv.setPointerCapture(e.pointerId);
      st.stroke = [toModel(e)];
      panel.msg('');
    });
    cv.addEventListener('pointermove', e => {
      if (!st.stroke) return;
      const p = toModel(e), q = st.stroke[st.stroke.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) * geo.s > 2) st.stroke.push(p);
    });
    const endStroke = () => {
      if (!st.stroke) return;
      const pts = st.stroke;
      st.stroke = null;
      if (pts.length < 8) { panel.msg('That outline was too short. Drag a longer line.'); return; }
      setPoints(pts, 'drawn');
    };
    cv.addEventListener('pointerup', endStroke);
    cv.addEventListener('pointercancel', endStroke);

    view.reset = () => { panel.msg(''); if (st.shape === st.base.shape) start(); else setPoints(st.base.poly, st.base.shape); };
    // the center, then one term per circle, biggest first
    view.series = () => {
      const items = [], [cx, cy] = st.c0, re = Math.abs(cx) >= 5e-4, im = Math.abs(cy) >= 5e-4;
      if (re && im) items.push({ sign: 1, text: `(${cx < 0 ? MINUS : ''}${fmt(cx)} ${cy < 0 ? MINUS : '+'} ${fmt(cy)}i)` });
      else if (re) items.push({ sign: Math.sign(cx), text: fmt(cx) });
      else if (im) items.push({ sign: Math.sign(cy), text: fmt(cy) + 'i' });
      st.coef.slice(0, st.k).forEach((q, j) => {
        const m = Math.abs(q.n), f = (q.n < 0 ? MINUS : '') + (m === 1 ? '' : m) + 't';
        items.push({ sign: 1, text: `${q.r.toFixed(3)} e<sup>i(${f}${phase(degOf(q.a))})</sup>`, fresh: st.k > 1 && j >= st.prevK });
      });
      return seriesLine(`z<sub>${st.k}</sub>(t)`, items);
    };
    view.recolor = () => {};
    view.destroy = () => {};
    setPoints(st.base.poly, st.base.shape);
    return view;
  }

  // ---------- 3D: a closed space curve ----------
  // The Dovetail mark as a solid (the same reading as mark.js): a block in one-point perspective. The left
  // stroke is its narrow front face; the bowl is its right side face, receding toward a vanishing point
  // where the bowl's top and bottom edges meet. A dovetail channel is cut into the front face and runs the
  // block's full width, narrow at the front and flaring as it goes in. Logo units: x across the front face,
  // y down, w into the page.
  const LOGO = (() => {
    const U = 19.79, H = 98.68, F = 100, VPY = 49.34;
    const VPX = 19.79 + 49.34 * (39.42 / 10.47);
    const depthAt = sx => F * ((VPX - 19.79) / (VPX - sx) - 1);
    const W = depthAt(59.21), W1 = depthAt(44.75);
    const HF = (56.79 - 41.88) / 2, HB = ((63.42 - 35.26) / 2) * (VPX - 19.79) / (VPX - 44.75);
    // a side face's outline (y, w): the block's outer corners, then the channel
    const prof = [[0, 0], [0, W], [H, W], [H, 0], [VPY + HF, 0], [VPY + HB, W1], [VPY - HB, W1], [VPY - HF, 0]];
    // every edge once and the 8 edges across the width twice: zigzag between the left (L) and right (R)
    // faces, then back the other way
    const SEQ = 'L1 L2 R2 R3 L3 L4 R4 R5 L5 L6 R6 R7 L7 L8 R8 R1 R2 L2 L3 R3 R4 L4 L5 R5 R6 L6 L7 R7 R8 L8 L1 R1'.split(' ');
    // Proportions tuned by eye (Chris, 2026-11-07): 3/4 of the mark's height for its width, and half again
    // as deep, channel and all. The camera shows it at 2x.
    const SQ = 0.75, DS = 1.5, ys = y => H / 2 + (y - H / 2) * SQ;
    // scene axes: x across, y into the page, z up
    const path = SEQ.map(s => { const [y, w] = prof[+s[1] - 1]; return [s[0] === 'L' ? 0 : U, w * DS, -ys(y)]; });
    // where the logo puts the eye (normalized like the scene: centered on the block, scaled by half its
    // height), and the patch of image plane the block fills, as offsets from the vanishing point
    const half = H * SQ / 2, D = W * DS;
    const eye = [(VPX - U / 2) / half, (-F - D / 2) / half, (H / 2 - VPY) / half];
    const right = VPX + (U - VPX) * F / (F + D);
    return { path, eye, F, uc: right / 2 - VPX, hh: half };
  })();
  const CURVES = {
    dovetail: () => LOGO.path,
    trefoil: () => dense(t => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)]),
    tennis: () => dense(t => { const a = 1, b = 0.35; return [a * Math.cos(t) + b * Math.cos(3 * t), a * Math.sin(t) - b * Math.sin(3 * t), 2 * Math.sqrt(a * b) * Math.sin(2 * t)]; }),
    torus: () => dense(t => { const r = 2 + 0.75 * Math.cos(5 * t); return [r * Math.cos(2 * t), r * Math.sin(2 * t), 0.75 * Math.sin(5 * t)]; }),
    cube: () => [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 0, 1], [0, 0, 1]],
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const scl = (a, s) => a.map(v => v * s);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  let threeLoad = null;
  function loadThree(url) {
    if (window.THREE) return Promise.resolve(window.THREE);   // never load a second copy (Partcheck has its own)
    if (!threeLoad) {
      threeLoad = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = () => window.THREE ? resolve(window.THREE) : reject(new Error('three.js did not define THREE'));
        s.onerror = () => { threeLoad = null; s.remove(); reject(new Error('three.js did not load')); };
        document.head.appendChild(s);
      });
    }
    return threeLoad;
  }

  function curveView(panel, o, THREE) {
    const M = 512, K = 100, P = 600, SEG = 48, MAXC = 300, FLOOR = -1.6, WALL = 2.0;
    const cv = canvasEl('sfx-turn', 'Circles in 3D trace a closed space curve; drag to turn it');
    const st = {
      curve: CURVES[o.curve] ? o.curve : 'dovetail', mode: o.curveMode === 'split' ? 'split' : 'tilted',
      pts: [], base: [0, 0, 0], circles: [], X: [], Y: [], Z: [], k: 1, prevK: 0, t: 0, hold: 0,
      turn: +o.curveTurn > 0 ? +o.curveTurn : 10, build: o.build !== false, spin: o.spin !== false,
      cum: 0, runs: [],   // the trail, as in 2D
    };
    const view = { cv, hint: '' };

    // ---- math ----
    function resample(poly) {
      const n = poly.length, seg = [];
      let L = 0;
      for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); seg.push(d); L += d; }
      const out = [];
      let j = 0, acc = 0;
      for (let k = 0; k < M; k++) {
        const s = k * L / M;
        while (j < n - 1 && acc + seg[j] < s) { acc += seg[j]; j++; }
        const a = poly[j], b = poly[(j + 1) % n], f = seg[j] ? (s - acc) / seg[j] : 0;
        out.push([0, 1, 2].map(d => a[d] + (b[d] - a[d]) * f));
      }
      // sized from the input's own corners, which the even spacing may step over
      const lo = [0, 1, 2].map(d => Math.min(...poly.map(p => p[d]))), hi = [0, 1, 2].map(d => Math.max(...poly.map(p => p[d])));
      const mid = lo.map((v, d) => (v + hi[d]) / 2), half = Math.max(...hi.map((v, d) => v - lo[d])) / 2 || 1;
      return out.map(p => p.map((v, d) => (v - mid[d]) / half));
    }
    function dft(vals) {
      const res = [];
      for (let n = 0; n <= K; n++) {
        let re = 0, im = 0;
        for (let k = 0; k < M; k++) { const th = TAU * n * k / M; re += vals[k] * Math.cos(th); im -= vals[k] * Math.sin(th); }
        res.push([re / M, im / M]);
      }
      return res;
    }
    function buildCircles() {
      const { X, Y, Z } = st, list = [];
      st.base = [X[0][0], Y[0][0], Z[0][0]];
      if (st.mode === 'tilted') {
        for (let n = 1; n <= K; n++) {
          const A = [2 * X[n][0], 2 * Y[n][0], 2 * Z[n][0]], B = [2 * X[n][1], 2 * Y[n][1], 2 * Z[n][1]];
          // term = A cos(nt) - B sin(nt): an ellipse in the plane of A and B, as two counter-turning circles
          const u = len(A) > 1e-12 ? scl(A, 1 / len(A)) : len(B) > 1e-12 ? scl(B, 1 / len(B)) : null;
          if (!u) continue;
          let w = sub(B, scl(u, dot(B, u)));
          if (len(w) < 1e-9) w = cross(u, Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
          const v = scl(w, 1 / len(w));
          const al = dot(A, u), be = -dot(B, u), ga = dot(A, v), de = -dot(B, v);
          const cp = [(al + de) / 2, (ga - be) / 2], cm = [(al - de) / 2, (ga + be) / 2];
          list.push({ n, s: n, r: Math.hypot(...cp), phi: Math.atan2(cp[1], cp[0]), u, v, kind: 'free' });
          list.push({ n, s: -n, r: Math.hypot(...cm), phi: Math.atan2(cm[1], cm[0]), u, v, kind: 'free' });
        }
      } else {
        const ux = [1, 0, 0], uy = [0, 1, 0], uz = [0, 0, 1];
        for (let n = 1; n <= K; n++) {
          // x + iy as a complex series on the floor; z as a real series on the wall
          const cpos = [X[n][0] - Y[n][1], X[n][1] + Y[n][0]], cneg = [X[n][0] + Y[n][1], -X[n][1] + Y[n][0]];
          list.push({ n, s: n, r: Math.hypot(...cpos), phi: Math.atan2(cpos[1], cpos[0]), u: ux, v: uy, kind: 'floor' });
          list.push({ n, s: -n, r: Math.hypot(...cneg), phi: Math.atan2(cneg[1], cneg[0]), u: ux, v: uy, kind: 'floor' });
          list.push({ n, s: n, r: 2 * Math.hypot(...Z[n]), phi: Math.atan2(Z[n][1], Z[n][0]) + Math.PI / 2, u: ux, v: uz, kind: 'side' });
        }
      }
      const rmax = Math.max(...list.map(q => q.r));
      st.circles = list.filter(q => q.r > rmax * 1e-4).sort((a, b) => b.r - a.r).slice(0, MAXC);
    }
    function evalAt(k, t, out) {
      let x = st.base[0], y = st.base[1], z = st.base[2];
      for (let j = 0; j < k; j++) {
        const q = st.circles[j], a = q.phi + q.s * t, co = q.r * Math.cos(a), si = q.r * Math.sin(a);
        const ox = co * q.u[0] + si * q.v[0], oy = co * q.u[1] + si * q.v[1], oz = co * q.u[2] + si * q.v[2];
        if (q.kind === 'side') z += oz; else { x += ox; y += oy; z += oz; }
      }
      out[0] = x; out[1] = y; out[2] = z;
      return out;
    }
    const stepUp = k => Math.min(st.circles.length, STEPS.find(s => s > k) || st.circles.length);
    const stepDown = k => { let b = 0; for (const s of STEPS) if (s < k) b = s; return b; };
    function curvePoints(k) {
      const pts = [], p = [0, 0, 0];
      for (let i = 0; i < P; i++) { evalAt(k, TAU * i / P, p); pts.push(new THREE.Vector3(p[0], p[1], p[2])); }
      return pts;
    }

    // ---- scene ----
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.up.set(0, 0, 1);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55);
    sun.position.set(3, -4, 6);
    scene.add(sun);
    const mkLines = n => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
      obj.frustumCulled = false;
      scene.add(obj);
      return obj;
    };
    const circleLines = mkLines(MAXC * SEG * 2), armLines = mkLines(MAXC * 2), linkLines = mkLines(4);
    const target = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.15 }));
    const grays = [];   // previous-step curves, cross-fading: { o, born, dying }

    // The trail: a tube two turns long, rebuilt each frame, with its own opacity at every point.
    const TR = 6, TRAIL_MAX = 2 * P + 400, TRAIL_R = 0.022;
    const RC = Array.from({ length: TR }, (_, j) => Math.cos(TAU * j / TR)), RS = Array.from({ length: TR }, (_, j) => Math.sin(TAU * j / TR));
    const tPos = new Float32Array(TRAIL_MAX * TR * 3), tNor = new Float32Array(TRAIL_MAX * TR * 3), tAlp = new Float32Array(TRAIL_MAX * TR);
    const tIdx = new Uint32Array(TRAIL_MAX * TR * 6);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    trailGeo.setAttribute('normal', new THREE.BufferAttribute(tNor, 3));
    trailGeo.setAttribute('alpha', new THREE.BufferAttribute(tAlp, 1));
    trailGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
    // lit like the scene's other solids (ambient 0.7, sun 0.55 from above front right)
    const trailMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color() }, sun: { value: new THREE.Vector3(3, -4, 6).normalize() } },
      vertexShader: 'attribute float alpha; varying float vA; varying vec3 vN;' +
        'void main() { vA = alpha; vN = normalize(mat3(modelMatrix) * normal);' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 color; uniform vec3 sun; varying float vA; varying vec3 vN;' +
        'void main() { float l = 0.7 + 0.55 * max(dot(normalize(vN), sun), 0.0);' +
        ' gl_FragColor = vec4(min(color * l, vec3(1.0)), vA); }',
      transparent: true, depthWrite: false,
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.frustumCulled = false;
    function buildTrail() {
      const cum = st.cum, lo = cum - 2 * TAU, step = TAU / P;
      const endOf = i => i + 1 < st.runs.length ? st.runs[i + 1].start : cum;
      st.runs = st.runs.filter((r, i) => endOf(i) > lo || i === st.runs.length - 1);
      const Xs = [], A = [], brk = [];   // points, their opacity, and whether each starts a new piece
      for (let i = 0; i < st.runs.length; i++) {
        const r = st.runs[i], end = endOf(i), a = Math.max(r.start, lo);
        if (end <= a) continue;
        let first = true;
        for (let cc = a, last = false; !last; cc += step) {
          if (cc >= end) { cc = end; last = true; }
          const lt = ((r.t0 + cc - r.start) % TAU + TAU) % TAU;
          const f = lt / TAU * P, i0 = Math.min(P - 1, Math.floor(f)), fr = f - i0, k = 3 * i0, q = r.arr;
          Xs.push(q[k] + (q[k + 3] - q[k]) * fr, q[k + 1] + (q[k + 4] - q[k + 1]) * fr, q[k + 2] + (q[k + 5] - q[k + 2]) * fr);
          A.push(trailAlpha(cum - cc));
          brk.push(first && (r.reset || A.length === 1));
          first = false;
        }
      }
      const n = A.length, s0 = Math.max(0, n - TRAIL_MAX);   // keep the newest part if there is too much
      let nIdx = 0, N = null, T = [1, 0, 0];
      for (let i = s0; i < n; i++) {
        const v = i - s0, starts = i === s0 || brk[i], ends = i === n - 1 || brk[i + 1];
        const a = starts ? i : i - 1, b = ends ? i : i + 1;
        const tx = Xs[3 * b] - Xs[3 * a], ty = Xs[3 * b + 1] - Xs[3 * a + 1], tz = Xs[3 * b + 2] - Xs[3 * a + 2];
        const tl = Math.hypot(tx, ty, tz);
        if (tl > 1e-9) T = [tx / tl, ty / tl, tz / tl];
        if (starts || !N) N = cross(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
        else {   // carry the ring's orientation along without twisting
          N = sub(N, scl(T, dot(N, T)));
          if (len(N) < 1e-6) N = cross(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
        }
        N = scl(N, 1 / len(N));
        const B = cross(T, N);
        for (let j = 0; j < TR; j++) {
          const nx = RC[j] * N[0] + RS[j] * B[0], ny = RC[j] * N[1] + RS[j] * B[1], nz = RC[j] * N[2] + RS[j] * B[2];
          const k = (v * TR + j) * 3;
          tNor[k] = nx; tNor[k + 1] = ny; tNor[k + 2] = nz;
          tPos[k] = Xs[3 * i] + TRAIL_R * nx; tPos[k + 1] = Xs[3 * i + 1] + TRAIL_R * ny; tPos[k + 2] = Xs[3 * i + 2] + TRAIL_R * nz;
          tAlp[v * TR + j] = A[i];
          if (!starts) {
            const j2 = (j + 1) % TR, a0 = (v - 1) * TR + j, a1 = (v - 1) * TR + j2, b0 = v * TR + j, b1 = v * TR + j2;
            tIdx[nIdx] = a0; tIdx[nIdx + 1] = b0; tIdx[nIdx + 2] = b1;
            tIdx[nIdx + 3] = a0; tIdx[nIdx + 4] = b1; tIdx[nIdx + 5] = a1;
            nIdx += 6;
          }
        }
      }
      trailGeo.setDrawRange(0, nIdx);
      for (const nm of ['position', 'normal', 'alpha']) trailGeo.attributes[nm].needsUpdate = true;
      trailGeo.index.needsUpdate = true;
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), new THREE.MeshBasicMaterial());
    const tipFloor = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), tip.material);
    const tipWall = new THREE.Mesh(tipFloor.geometry, tip.material);
    scene.add(target, trail, tip, tipFloor, tipWall);
    let floorGrid = null, wallGrid = null;
    const col = {};
    view.recolor = () => {
      const pc = panel.colors, bg = opaque(pc.panel, '#ffffff');
      col.panel = new THREE.Color(bg);
      for (const k of ['ink', 'muted', 'line', 'accent']) col[k] = new THREE.Color(opaque(pc[k], bg));
      target.material.color = col.ink;
      for (const g of grays) g.o.material.color = col.muted;
      trailMat.uniforms.color.value = col.accent;
      tip.material.color = col.accent;
      for (const g of [floorGrid, wallGrid]) if (g) { scene.remove(g); g.geometry.dispose(); g.material.dispose(); }
      floorGrid = new THREE.GridHelper(4, 16, col.line, col.line); floorGrid.rotation.x = Math.PI / 2; floorGrid.position.z = FLOOR;
      wallGrid = new THREE.GridHelper(4, 16, col.line, col.line); wallGrid.position.y = WALL;
      scene.add(floorGrid, wallGrid);
    };

    function setK(k, prevK, resetT) {
      st.k = Math.max(1, Math.min(st.circles.length, k));
      st.prevK = prevK == null ? stepDown(st.k) : prevK;
      const pts = curvePoints(st.k);
      if (resetT) st.t = 0;
      // the trail carries on with the new curve (a reset starts a separate piece); while still, the new
      // curve shows along a whole turn at once
      const arr = new Float32Array(3 * (P + 1));
      pts.forEach((q, i) => { arr[3 * i] = q.x; arr[3 * i + 1] = q.y; arr[3 * i + 2] = q.z; });
      arr.set(arr.subarray(0, 3), 3 * P);
      if (panel.playing) st.runs.push({ arr, start: st.cum, t0: st.t, reset: !!resetT });
      else st.runs = [{ arr, start: st.cum - TAU, t0: st.t - TAU, reset: true }];
      // the previous step's curve cross-fades
      const now = performance.now();
      for (const g of grays) if (!g.dying) g.dying = now;
      if (st.prevK > 0) {
        const obj = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curvePoints(st.prevK)),
          new THREE.LineBasicMaterial({ color: col.muted, transparent: true, opacity: 0 }));
        scene.add(obj);
        grays.push({ o: obj, born: now, dying: null });
      }
      st.hold = 0;
      panel.terms(view);
    }
    function start() {
      if (panel.playing) setK(1, 0, true);
      else setK(st.circles.length, 0, true);
    }

    // ---- camera ----
    const DIST0 = 7.5 * Math.exp(0.3), AZ0 = -1.05, EL0 = 0.42;
    const cam = { az: AZ0, el: EL0, dist: DIST0, drag: null, logo: false, logoSet: o.logoView === true && st.curve === 'dovetail' };
    let size = { W: 0, H: 0 };
    // the Dovetail is shown at 2x, centered; floor + wall stays at 1x so its circles stay in view
    function placeCamera() {
      if (cam.logo) { placeLogoCamera(); return; }
      const big = st.curve === 'dovetail' && st.mode === 'tilted', zoom = big ? 2 : 1, tz = big ? 0 : -0.2;
      if (camera.zoom !== zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
      const ce = Math.cos(cam.el);
      camera.position.set(cam.dist * ce * Math.cos(cam.az), cam.dist * ce * Math.sin(cam.az), cam.dist * Math.sin(cam.el) + tz);
      camera.lookAt(0, 0, tz);
    }
    // the logo's own view: the eye off to the right at mid-height, looking straight at the front face, with
    // the image shifted over to where the mark is (one-point perspective with an offset lens)
    function placeLogoCamera() {
      const e = LOGO.eye, n = camera.near, k = n / LOGO.F;
      const hh = LOGO.hh * 1.2, hw = hh * size.W / size.H;
      camera.position.set(e[0], e[1], e[2]);
      camera.lookAt(e[0], e[1] + 1, e[2]);
      camera.projectionMatrix.makePerspective((LOGO.uc - hw) * k, (LOGO.uc + hw) * k, hh * k, -hh * k, n, camera.far);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    function setLogoView(on) {
      if (cam.logo === on) return;
      cam.logo = on;
      if (!on) {   // leave from near the logo's side
        camera.updateProjectionMatrix();
        cam.az = Math.atan2(LOGO.eye[1], LOGO.eye[0]); cam.el = 0.12; cam.dist = DIST0;
      }
    }
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); cam.drag = [e.clientX, e.clientY]; setLogoView(false); });
    cv.addEventListener('pointermove', e => {
      if (!cam.drag) return;
      cam.az -= (e.clientX - cam.drag[0]) * 0.008;
      cam.el = Math.max(-1.2, Math.min(1.45, cam.el + (e.clientY - cam.drag[1]) * 0.008));
      cam.drag = [e.clientX, e.clientY];
    });
    const endDrag = () => { cam.drag = null; };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    // a plain wheel scrolls the tool's page; Ctrl + wheel (and a trackpad pinch) zooms
    cv.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setLogoView(false);
      cam.dist = Math.max(4, Math.min(18, cam.dist * Math.exp(e.deltaY * 0.001)));
    }, { passive: false });

    view.layout = (W, dpr) => {
      const H = Math.round(W * 0.6);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      cv.style.height = H + 'px';
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      size = { W, H };
    };

    function updateScene() {
      const split = st.mode === 'split';
      const cpos = circleLines.geometry.attributes.position.array, ccol = circleLines.geometry.attributes.color.array;
      const apos = armLines.geometry.attributes.position.array, acol = armLines.geometry.attributes.color.array;
      const chains = { free: st.base.slice(), floor: [st.base[0], st.base[1], FLOOR], side: [0, WALL, st.base[2]] };
      let ci = 0, ai = 0;
      const put = (arr, i, p) => { arr[i] = p[0]; arr[i + 1] = p[1]; arr[i + 2] = p[2]; };
      const c3 = new THREE.Color();
      for (let j = 0; j < st.k; j++) {
        const q = st.circles[j], org = chains[q.kind], a = q.phi + q.s * st.t;
        c3.copy(col.ink).lerp(col.panel, Math.min(0.85, 0.25 + j * 0.025));
        for (let s = 0; s < SEG; s++) {
          for (const e of [s, s + 1]) {
            const b = TAU * e / SEG, co = q.r * Math.cos(b), si = q.r * Math.sin(b);
            put(cpos, ci, [org[0] + co * q.u[0] + si * q.v[0], org[1] + co * q.u[1] + si * q.v[1], org[2] + co * q.u[2] + si * q.v[2]]);
            ccol[ci] = c3.r; ccol[ci + 1] = c3.g; ccol[ci + 2] = c3.b; ci += 3;
          }
        }
        const co = q.r * Math.cos(a), si = q.r * Math.sin(a);
        const nx = [org[0] + co * q.u[0] + si * q.v[0], org[1] + co * q.u[1] + si * q.v[1], org[2] + co * q.u[2] + si * q.v[2]];
        c3.copy(col.ink).lerp(col.panel, Math.min(0.6, 0.05 + j * 0.02));
        put(apos, ai, org); acol.set([c3.r, c3.g, c3.b], ai); ai += 3;
        put(apos, ai, nx); acol.set([c3.r, c3.g, c3.b], ai); ai += 3;
        org[0] = nx[0]; org[1] = nx[1]; org[2] = nx[2];
      }
      circleLines.geometry.setDrawRange(0, ci / 3);
      circleLines.geometry.attributes.position.needsUpdate = true; circleLines.geometry.attributes.color.needsUpdate = true;
      armLines.geometry.setDrawRange(0, ai / 3);
      armLines.geometry.attributes.position.needsUpdate = true; armLines.geometry.attributes.color.needsUpdate = true;
      const p = evalAt(st.k, st.t, [0, 0, 0]);
      tip.position.set(p[0], p[1], p[2]);
      tipFloor.visible = tipWall.visible = linkLines.visible = split;
      floorGrid.visible = !cam.logo;
      wallGrid.visible = split && !cam.logo;
      if (split) {
        const f = chains.floor, w = chains.side;
        tipFloor.position.set(f[0], f[1], f[2]); tipWall.position.set(w[0], w[1], w[2]);
        const lp = linkLines.geometry.attributes.position.array, lc = linkLines.geometry.attributes.color.array;
        lp.set([f[0], f[1], f[2], p[0], p[1], p[2], w[0], w[1], w[2], p[0], p[1], p[2]]);
        for (let i = 0; i < 4; i++) lc.set([col.accent.r, col.accent.g, col.accent.b], i * 3);
        linkLines.geometry.setDrawRange(0, 4);
        linkLines.geometry.attributes.position.needsUpdate = true; linkLines.geometry.attributes.color.needsUpdate = true;
      }
      buildTrail();
      const now = performance.now();
      for (let i = grays.length - 1; i >= 0; i--) {
        const g = grays[i];
        if (g.dying && now - g.dying >= FADE) { scene.remove(g.o); g.o.geometry.dispose(); g.o.material.dispose(); grays.splice(i, 1); continue; }
        g.o.material.opacity = 0.45 * fadeOf(g, now);
      }
    }

    view.tick = dt => {
      if (!panel.playing) return;
      st.t += dt * TAU / st.turn;
      st.cum += dt * TAU / st.turn;
      if (st.t >= TAU) {
        st.t -= TAU;
        if (st.build) {
          if (st.k < st.circles.length) setK(stepUp(st.k), st.k);
          else if (++st.hold >= 2) setK(1, 0);
        }
      }
      if (st.spin && !cam.drag && !cam.logo) cam.az += dt * 0.12;
    };
    view.draw = () => {
      if (!size.W) return;
      placeCamera();
      updateScene();
      renderer.render(scene, camera);
    };
    // the camera back where the options put it, from one circle
    view.reset = () => {
      panel.msg('');
      if (cam.logo !== cam.logoSet) setLogoView(cam.logoSet);
      if (!cam.logo) { cam.az = AZ0; cam.el = EL0; cam.dist = DIST0; }
      start();
    };

    // One real series per axis. A circle of radius r in the plane of u and v adds r(u cos th + v sin th),
    // th = s t + phi, to each axis it reaches; per axis that is Re(r(u - iv)e^(i phi) e^(i s t)), and a
    // backward circle is the conjugate at +n. Summing at each n gives |Z| cos(nt + arg Z). Floor + wall:
    // floor circles reach x and y, wall circles only z (as evalAt).
    view.series = () => {
      const amp = [new Map(), new Map(), new Map()];   // per axis, in order of first appearance: n -> { re, im, at }
      for (let j = 0; j < st.k; j++) {
        const q = st.circles[j], n = Math.abs(q.s), co = Math.cos(q.phi), si = Math.sin(q.phi);
        for (let d = 0; d < 3; d++) {
          if (q.kind === 'side' && d !== 2) continue;
          const uu = q.u[d], vv = q.v[d];
          if (!uu && !vv) continue;
          const e = amp[d].get(n) || { re: 0, im: 0, at: 0 };
          e.re += q.r * (uu * co + vv * si);
          e.im += q.r * (uu * si - vv * co) * Math.sign(q.s);
          e.at = j;
          amp[d].set(n, e);
        }
      }
      return ['x', 'y', 'z'].map((name, d) => {
        const items = [], b = st.base[d];
        if (Math.abs(b) >= 5e-4) items.push({ sign: Math.sign(b), text: fmt(b) });
        for (const [n, e] of amp[d]) {
          const A = Math.hypot(e.re, e.im);
          if (A < 5e-4) continue;
          items.push({ sign: 1, text: `${A.toFixed(3)} cos(${n === 1 ? '' : n}t${phase(degOf(Math.atan2(e.im, e.re)))})`, fresh: st.k > 1 && e.at >= st.prevK });
        }
        if (!items.length) items.push({ sign: 1, text: '0' });
        return `<div>${seriesLine(`${name}<sub>${st.k}</sub>(t)`, items)}</div>`;
      }).join('');
    };
    view.destroy = () => {
      scene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) obj.material.dispose(); });
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    };

    view.recolor();
    st.pts = resample(CURVES[st.curve]());
    st.X = dft(st.pts.map(p => p[0])); st.Y = dft(st.pts.map(p => p[1])); st.Z = dft(st.pts.map(p => p[2]));
    target.geometry.dispose();
    target.geometry = new THREE.BufferGeometry().setFromPoints(st.pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    target.computeLineDistances();
    buildCircles();
    if (cam.logoSet) setLogoView(true);
    start();
    return view;
  }

  // ---------- the panel ----------
  const DEFAULTS = {
    mode: '2d', modes: ['1d', '2d', '3d'], series: true, build: true, playing: true,
    wave: 'square', waveTurn: 4,
    shape: 'dovetail', outline: null, layout: 'side', shapeTurn: 10,
    curve: 'dovetail', curveMode: 'tilted', curveTurn: 10, spin: true, logoView: false,
    threeUrl: '',
  };
  const VIEWS = { '1d': ['1D', 'The 1D wave'], '2d': ['2D', 'The 2D outline'], '3d': ['3D', 'The 3D curve'] };

  function mount(host, options) {
    if (!host) throw new Error('SignoffFourier.mount needs an element');
    if (host.signoffFourier) return host.signoffFourier;
    injectCss();
    const o = Object.assign({}, DEFAULTS, options || {});
    let modes = (Array.isArray(o.modes) ? o.modes : String(o.modes).split(',')).map(m => String(m).trim().toLowerCase()).filter(m => VIEWS[m]);
    modes = modes.filter((m, i) => modes.indexOf(m) === i);
    if (!modes.length) modes = ['2d'];
    let mode = modes.includes(String(o.mode).toLowerCase()) ? String(o.mode).toLowerCase() : modes[0];

    const root = document.createElement('div');
    root.className = 'sfx';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Fourier epicycles');
    const sid = 'sfx-series-' + (++uid);
    root.innerHTML =
      '<div class="sfx-view"><div class="sfx-hint" hidden></div><div class="sfx-bar">' +
      `<button type="button" class="sfx-btn sfx-reset" title="Reset" aria-label="Reset">${ICON_RESET}</button>` +
      '<div class="sfx-modes" role="group" aria-label="Panel shows">' +
      modes.map(m => `<button type="button" data-mode="${m}" aria-pressed="false" title="${VIEWS[m][1]}">${VIEWS[m][0]}</button>`).join('') +
      '</div><div class="sfx-msg" hidden></div></div>' +
      `<button type="button" class="sfx-btn sfx-fold" aria-controls="${sid}" aria-expanded="true" title="Hide the series" aria-label="The series drawing it">${ICON_FOLD}</button>` +
      `</div><div class="sfx-series" id="${sid}" aria-label="The series drawing it"></div>`;
    host.appendChild(root);
    const q = s => root.querySelector(s);
    const viewEl = q('.sfx-view'), strip = q('.sfx-series'), hintEl = q('.sfx-hint'), msgEl = q('.sfx-msg');
    const fold = q('.sfx-fold'), modesEl = q('.sfx-modes');
    if (modes.length < 2) modesEl.hidden = true;

    const views = {};
    let active = null, wanted = mode, key = '', raf = 0, last = 0, onScreen = true, dead = false;
    const panel = {
      playing: o.playing !== false && !REDUCE.matches,
      colors: readColors(root),
      msg(text) { msgEl.textContent = text || ''; msgEl.hidden = !text; },
      terms(v) { if (v === active) strip.innerHTML = v.series(); },
    };

    function showStrip(show) {
      fold.setAttribute('aria-expanded', String(show));
      fold.title = show ? 'Hide the series' : 'Show the series';
      strip.hidden = !show;
    }
    if (o.series === false) showStrip(false);
    function press(m) { for (const b of modesEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === m)); }

    function makeView(m) {
      if (views[m]) return Promise.resolve(views[m]);
      if (m === '3d') {
        return loadThree(o.threeUrl || THREE_URL).then(T => {
          if (dead) throw new Error('destroyed');
          return views[m] || (views[m] = curveView(panel, o, T));
        });
      }
      try { views[m] = m === '1d' ? waveView(panel, o) : outlineView(panel, o); } catch (err) { return Promise.reject(err); }
      return Promise.resolve(views[m]);
    }
    function setMode(m) {
      m = String(m).toLowerCase();
      if (dead || !modes.includes(m)) return;
      wanted = m;
      press(m);
      if (!views[m] && m === '3d') panel.msg('Loading 3D\u2026');
      makeView(m).then(v => {
        if (dead || wanted !== m) return;
        if (!v.cv.parentNode) viewEl.insertBefore(v.cv, viewEl.firstChild);
        for (const k in views) views[k].cv.hidden = views[k] !== v;
        active = v; mode = m; key = '';
        hintEl.textContent = v.hint;
        syncHint();
        panel.msg('');
        layout();
        strip.innerHTML = v.series();
        run();
      }, () => {
        if (dead || wanted !== m) return;
        wanted = mode;
        press(active ? mode : '');
        panel.msg(m === '3d' ? '3D is not available here.' : 'This view could not start.');
      });
    }

    // the drag hint crowds the picture in a narrow panel (a phone), so it shows from 420 px up
    function syncHint() { hintEl.hidden = !active || !active.hint || viewEl.clientWidth < 420; }
    function layout() {
      if (!active) return;
      const W = viewEl.clientWidth, dpr = window.devicePixelRatio || 1;
      if (!W) return;   // hidden
      const k = W + ',' + dpr + ',' + mode;
      if (k === key) return;   // resizing clears the canvas, so only when it changed
      key = k;
      active.layout(W, dpr);
      syncHint();
    }
    function frame(ts) {
      raf = 0;
      if (dead || !onScreen) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
      last = ts;
      if (!active) return;
      active.tick(dt);
      active.draw();
    }
    function run() { if (!raf && !dead && onScreen) { last = 0; raf = requestAnimationFrame(frame); } }

    const ro = new ResizeObserver(() => layout());
    ro.observe(viewEl);
    // runs only while on screen
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
      onScreen = es[es.length - 1].isIntersecting;
      if (onScreen) { layout(); run(); }
    }) : null;
    if (io) io.observe(root);
    const recolor = () => { panel.colors = readColors(root); for (const k in views) views[k].recolor(); };
    const mo = new MutationObserver(recolor);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    DARK.addEventListener('change', recolor);

    q('.sfx-reset').addEventListener('click', () => { if (active) active.reset(); });
    modesEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
    fold.addEventListener('click', () => showStrip(strip.hidden));

    function destroy() {
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      if (io) io.disconnect();
      mo.disconnect();
      DARK.removeEventListener('change', recolor);
      for (const k in views) views[k].destroy();
      root.remove();
      delete host.signoffFourier;
    }
    const api = {
      el: root,
      get mode() { return mode; },
      setMode,
      reset() { if (active) active.reset(); },
      destroy,
    };
    host.signoffFourier = api;
    setMode(mode);
    return api;
  }

  // data-* attributes to options
  function optionsFrom(el) {
    const d = el.dataset, o = {};
    const yes = v => !/^(false|0|no|off)$/i.test(String(v).trim());
    for (const k of ['mode', 'wave', 'shape', 'layout', 'curve', 'curveMode', 'threeUrl']) if (d[k] != null) o[k] = d[k];
    if (d.modes != null) o.modes = d.modes.split(',');
    for (const k of ['series', 'build', 'playing', 'spin', 'logoView']) if (d[k] != null) o[k] = yes(d[k]);
    for (const k of ['waveTurn', 'shapeTurn', 'curveTurn']) if (d[k] != null && +d[k] > 0) o[k] = +d[k];
    if (d.outline) { try { o.outline = JSON.parse(d.outline); } catch (err) { /* not JSON: keep the shape */ } }
    return o;
  }
  function mountAll(scope) {
    const found = [];
    for (const el of (scope || document).querySelectorAll('[data-signoff-fourier]')) found.push(el.signoffFourier || mount(el, optionsFrom(el)));
    return found;
  }

  window.SignoffFourier = { mount, mountAll, version: 1 };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountAll());
  else mountAll();
})();
