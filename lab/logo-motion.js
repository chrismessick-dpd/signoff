// Animated Dovetail mark (prototype): the dovetail is tapped out of the block.
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var VB = '0 0 59.21 98.68';
  // The logo's block: the stroke, the bowl, and the neck that bridges the hairline between them.
  var SOLID = 'M0 0h18.19v98.68H0z' +
    'M19.79 0L59.21 10.47V88.21L19.79 98.68z' +
    'M18.19 41.89h1.6v14.91h-1.6z';
  // The dovetail as the logo draws it: the gap in the stroke and the flared notch in the bowl.
  var KEY = 'M0 41.88h18.19v14.91H0z' +
    'M19.79 41.89L44.75 35.26V63.42L19.79 56.79z';
  var NECK = 'M18.19 41.89h1.6v14.91h-1.6z';
  // The dovetail's lines, in the order they're cut: the stroke gap's top, the flare's top, its
  // right end and its bottom, then the stroke gap's bottom. The two ends at the hairline are the
  // hairline itself.
  var CUT = 'M0 41.88H18.19M19.79 41.89L44.75 35.26V63.42L19.79 56.79M18.19 56.79H0';
  var BLANK_HOLD = 0.5, FILL_TIME = 0.35, CLOSE_TIME = 0.5;
  var uid = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  var DEFAULTS = {
    fill: '#fff',
    seated: 3,      // seconds the dovetail sits in the block before the taps start
    speed: 1,       // tap-out speed: multiplies the taps and the fall
    logo: 6,        // seconds the logo shows before the dovetail seats again
    cut: true,      // start each round from a blank block and draw the dovetail's lines in
    cutTime: 2,     // seconds to draw the lines
    firstSeated: null  // seconds for the first wait only, to stagger several marks
  };

  // ---- Tap out: the dovetail key, knocked out of the side of the block ----
  // The logo is a block drawn in one-point perspective. The left stroke is its narrow front face,
  // flat to the viewer; the bowl is its side face, receding to the right toward a vanishing point
  // where the bowl's top and bottom edges meet. The dovetail runs back into the block: its small
  // end is the gap in the stroke, and the flared notch is the same piece seen on the side face,
  // taller at the back. Each tap slides the key out through the side face; once it's clear it falls
  // out of the tile, leaving the logo exactly as drawn.
  //
  // 3D coordinates: x across the front face, y down, w into the page (0 at the front face).

  var VPX = 19.79 + 49.34 * (39.42 / 10.47), VPY = 49.34;   // where the bowl's edges meet
  var F = 100;                                              // viewer distance, in front-face units
  var U = 19.79;                                            // the block's width: its side face is x = U
  function depthAt(screenX) { return F * ((VPX - 19.79) / (VPX - screenX) - 1); }
  var W1 = depthAt(44.75);                                  // how deep the dovetail goes
  var HALF_FRONT = (56.79 - 41.88) / 2;                     // its half-height at the front
  var HALF_BACK = ((63.42 - 35.26) / 2) * (VPX - 19.79) / (VPX - 44.75);   // and at the back, true size
  var EYE = [VPX, VPY, -F];
  var LIGHT3 = norm3([0.3, -1, -0.5]);   // from above (y points down)

  function norm3(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function centroid(poly) {
    var c = [0, 0, 0];
    poly.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
    return [c[0] / poly.length, c[1] / poly.length, c[2] / poly.length];
  }
  function hex(c) {
    c = c.replace('#', '');
    if (c.length === 3) c = c.replace(/./g, '$&$&');
    return [0, 2, 4].map(function (i) { return parseInt(c.substr(i, 2), 16); });
  }
  // Shades the fill color: light fills darken, dark fills lighten. amt is 0..1.
  function shade(fill, amt) {
    var rgb = hex(fill);
    var lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    var to = lum > 0.5 ? 0 : 255, k = lum > 0.5 ? amt * 0.75 : amt * 0.6;
    return 'rgb(' + rgb.map(function (x) { return Math.round(x + (to - x) * k); }).join(',') + ')';
  }
  // Keeps the part of a 3D polygon with x >= e.
  function clipRight(poly, e) {
    var out = [];
    poly.forEach(function (p, i) {
      var q = poly[(i + 1) % poly.length], pin = p[0] >= e, qin = q[0] >= e;
      if (pin) out.push(p);
      if (pin !== qin) {
        var t = (e - p[0]) / (q[0] - p[0]);
        out.push([e, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
      }
    });
    return out;
  }
  function proj(p) {
    var s = F / (F + p[2]);
    return [VPX + (p[0] - VPX) * s, VPY + (p[1] - VPY) * s];
  }

  // The key's faces, slid kx to the right and dropped fy, tipped by rot degrees as it falls.
  function keyFaces(kx, fy, rot) {
    var c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
    var mx = U / 2, my = VPY;
    function v(x, y, w) {
      var dx = x - mx, dy = y - my;
      return [mx + dx * c - dy * s + kx, my + dx * s + dy * c + fy, w];
    }
    var cs = [[VPY - HALF_FRONT, 0], [VPY + HALF_FRONT, 0], [VPY + HALF_BACK, W1], [VPY - HALF_BACK, W1]];
    var L = cs.map(function (q) { return v(0, q[0], q[1]); });
    var R = cs.map(function (q) { return v(U, q[0], q[1]); });
    var faces = [
      { name: 'front', poly: [L[0], R[0], R[1], L[1]] },
      { name: 'bottom', poly: [L[1], R[1], R[2], L[2]] },
      { name: 'back', poly: [L[2], R[2], R[3], L[3]] },
      { name: 'top', poly: [L[3], R[3], R[0], L[0]] },
      { name: 'left', poly: [L[0], L[1], L[2], L[3]] },
      { name: 'right', poly: [R[0], R[1], R[2], R[3]] }
    ];
    var mid = centroid(L.concat(R));
    faces.forEach(function (f) {
      var n = norm3(cross(sub(f.poly[1], f.poly[0]), sub(f.poly[2], f.poly[0])));
      if (dot(n, sub(centroid(f.poly), mid)) < 0) n = [-n[0], -n[1], -n[2]];
      f.n = n;
    });
    return faces;
  }

  function create(host, opts) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in opts || {}) o[k] = opts[k];
    var id = 'dvt-tap-' + (++uid);
    var svg = el('svg', { viewBox: VB, 'aria-hidden': 'true', overflow: 'visible' });
    var defs = el('defs', {});
    var mask = el('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: '-60', y: '-60', width: '200', height: '260' });
    mask.appendChild(el('rect', { x: '-60', y: '-60', width: '200', height: '260', fill: '#fff' }));
    // The key's place: open, except while the block is blank before a cut.
    var hole = el('path', { d: KEY, fill: '#000', 'fill-opacity': '1' });
    mask.appendChild(hole);
    // While the key is seated, the neck between its two parts opens too, so the hairline between
    // the block's front and side runs unbroken past the key. It closes again once the key has left.
    var neck = el('path', { d: NECK, fill: '#000', 'fill-opacity': '1' });
    mask.appendChild(neck);
    defs.appendChild(mask);
    // Keeps the seated key's outline out of that gap, so it's exactly as wide as the hairline.
    var keyMask = el('mask', { id: id + 'k', maskUnits: 'userSpaceOnUse', x: '-60', y: '-60', width: '200', height: '260' });
    keyMask.appendChild(el('rect', { x: '-60', y: '-60', width: '200', height: '260', fill: '#fff' }));
    keyMask.appendChild(el('path', { d: NECK, fill: '#000' }));
    defs.appendChild(keyMask);
    // A soft shadow under the dovetail while it's out, so it sits in the scene.
    var shadow = el('filter', { id: id + 's', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    shadow.appendChild(el('feDropShadow', { dx: '0.6', dy: '1.6', stdDeviation: '1.4', 'flood-color': '#000', 'flood-opacity': '0.22' }));
    defs.appendChild(shadow);
    svg.appendChild(defs);
    // The block: the logo, with the key's place open.
    svg.appendChild(el('path', { d: SOLID, fill: o.fill, mask: 'url(#' + id + 'm)' }));
    var keyG = el('g', {});
    svg.appendChild(keyG);
    // The cut lines, drawn along the path as the cut goes on.
    var cut = el('path', { d: CUT, fill: 'none', stroke: shade(o.fill, 0.7), 'stroke-width': '0.8',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: '1', 'stroke-dasharray': '1 1',
      'stroke-dashoffset': '1', opacity: '0' });
    svg.appendChild(cut);
    host.appendChild(svg);

    // Phases: block (key in, waiting) → tapping → falling → logo (holding) → back (key fades in).
    // With cutting on, the round starts from a blank block instead: blank → cutting (the lines are
    // drawn in) → fill (the dovetail appears) → block …, and after the logo the hole closes up
    // (close) to the blank block again.
    var first = o.firstSeated != null ? o.firstSeated : o.seated;
    var phase = o.cut ? 'blank' : 'block', t0 = now(), until = t0 + (o.cut ? Math.min(first, BLANK_HOLD + first * 0.5) : first);
    var out = 0, from = 0, to = 0, tapAt = 0, nextTap = 0;
    var kx = 0, fy = 0, vy = 0, vx = 0, rot = 0, spin = 0;
    var keyA = o.cut ? 0 : 1, holeA = o.cut ? 0 : 1, cutP = 0, cutA = 0, paused = false, last = 0, raf = 0;

    function now() { return performance.now() / 1000; }
    function travel() { return U + 0.5; }
    function pathOf(poly) {
      return 'M' + poly.map(function (p) { var q = proj(p); return q[0].toFixed(3) + ' ' + q[1].toFixed(3); }).join('L') + 'Z';
    }

    function drawKey() {
      var seated = kx <= 0 && fy === 0;
      var blank = phase === 'blank' || phase === 'cutting' || phase === 'fill' || phase === 'close';
      hole.setAttribute('fill-opacity', holeA.toFixed(3));
      cut.setAttribute('stroke-dashoffset', (1 - cutP).toFixed(4));
      cut.setAttribute('opacity', cutA.toFixed(3));
      // The blank block has no neck: the hairline runs its full height.
      neck.setAttribute('fill-opacity', blank ? '1' : seated ? keyA.toFixed(3) : '0');
      if (seated) keyG.setAttribute('mask', 'url(#' + id + 'k)'); else keyG.removeAttribute('mask');
      if (seated) keyG.removeAttribute('filter'); else keyG.setAttribute('filter', 'url(#' + id + 's)');
      if (keyA <= 0) { keyG.innerHTML = ''; return; }
      var face = shade(o.fill, 0.28), html = '', front = '';
      if (seated) {
        // Seated: exactly the logo's cut-out, a shade off the block so the key reads as its own
        // piece, with a soft edge rather than an outline.
        html = '<path d="' + KEY + '" fill="' + face + '" stroke="' + shade(o.fill, 0.36) + '" stroke-width="0.4" stroke-linejoin="round"/>';
      } else {
        keyFaces(kx, fy, rot).forEach(function (f) {
          if (dot(f.n, sub(EYE, centroid(f.poly))) <= 0) return;   // faces away from the viewer
          // The front and the side (the flare) are always in view; the rest only once it's come
          // out past the block's side face, until it's falling free.
          var poly = (f.name === 'front' || f.name === 'right' || phase === 'falling') ? f.poly : clipRight(f.poly, U + 0.01);
          if (poly.length < 3) return;
          // Gentle shading, and each face stroked in its own color with round joins, so the edges
          // and corners are slightly rounded instead of outlined. The front goes on last, on top.
          var fill = f.name === 'front' ? face : shade(o.fill, 0.2 + 0.16 * (1 - dot(f.n, LIGHT3)) / 2 + (f.name === 'right' ? 0.05 : 0));
          var path = '<path d="' + pathOf(poly) + '" fill="' + fill + '" stroke="' + fill + '" stroke-width="1.1" stroke-linejoin="round"/>';
          if (f.name === 'front') front = path; else html += path;
        });
        html += front;
      }
      keyG.innerHTML = html;
      keyG.setAttribute('opacity', keyA.toFixed(3));
    }

    function startTapping(t) { phase = 'tapping'; nextTap = t; from = to = out; tapAt = 0; }

    function step(t, dt) {
      var sp = o.speed, T = travel();
      if (phase === 'block') {
        // The first wait may be staggered; after that it's the seated time, read live.
        if (t >= (until === Infinity ? t0 + o.seated : until)) startTapping(t);
      } else if (phase === 'tapping') {
        var u = Math.min(1, (t - tapAt) / (0.11 / Math.sqrt(sp)));
        out = from + (to - from) * (1 - Math.pow(1 - u, 3));
        kx = out;
        if (u >= 1 && t >= nextTap) {
          if (to >= T) {
            // Clear of the block: it drops, drifting on to the right and tipping a little.
            phase = 'falling'; vy = -rand(5, 15); vx = rand(10, 20); spin = rand(10, 60);
          } else {
            from = out; to = Math.min(T, out + T * rand(0.14, 0.24));
            if (T - to < T * 0.08) to = T;
            tapAt = t; nextTap = t + rand(0.35, 0.85) / sp;
          }
        }
      } else if (phase === 'falling') {
        var dd = dt * sp;
        vy += 520 * dd; fy += vy * dd; kx += vx * dd; rot += spin * dd;
        if (fy > 150) { phase = 'logo'; t0 = t; keyA = 0; }
      } else if (phase === 'logo') {
        if (t - t0 >= o.logo) {
          phase = o.cut ? 'close' : 'back'; t0 = t; out = from = to = 0; kx = fy = rot = 0;
        }
      } else if (phase === 'close') {
        // The hole fills in, back to a blank block.
        holeA = Math.max(0, 1 - (t - t0) / CLOSE_TIME);
        if (holeA <= 0) { phase = 'blank'; t0 = t; until = t + BLANK_HOLD; }
      } else if (phase === 'blank') {
        if (t >= until) { phase = 'cutting'; t0 = t; cutA = 1; cutP = 0; }
      } else if (phase === 'cutting') {
        // The lines are drawn in one after another, at an even pace along their length.
        cutP = Math.min(1, (t - t0) / o.cutTime);
        if (cutP >= 1) { phase = 'fill'; t0 = t; }
      } else if (phase === 'fill') {
        // The dovetail appears inside its lines, then its place opens behind it.
        var f = Math.min(1, (t - t0) / FILL_TIME);
        keyA = f; cutA = 1 - f;
        if (f >= 1) { holeA = 1; cutA = 0; cutP = 0; phase = 'block'; until = Infinity; }
      } else if (phase === 'back') {
        keyA = Math.min(1, (t - t0) / 0.5);
        // The seated time counts from when the dovetail starts to fade back in.
        if (keyA >= 1) { phase = 'block'; until = Infinity; }
      }
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      var t = now(), dt = Math.min(0.05, last ? t - last : 0);
      last = t;
      if (paused) return;
      step(t, dt);
      drawKey();
    }
    drawKey();
    raf = requestAnimationFrame(frame);

    return {
      svg: svg,
      set: function (p) { for (var k in p) o[k] = p[k]; },
      // Tap out now: knock it straight out.
      snap: function () {
        var t = now();
        if (phase === 'block' || phase === 'back' || phase === 'blank' || phase === 'cutting' || phase === 'fill' || phase === 'close') {
          keyA = 1; holeA = 1; cutA = 0; cutP = 0; phase = 'tapping';
        }
        if (phase === 'tapping') { from = out; to = travel(); tapAt = t; nextTap = t; }
      },
      // Seat now: bring the dovetail back from the logo straight away.
      reseat: function () { if (phase === 'logo') t0 = -Infinity; },
      // Start the next round now, from the blank block when cutting is on.
      recut: function () {
        var t = now();
        out = from = to = 0; kx = fy = rot = 0; cutP = 0; cutA = 0; t0 = t;
        if (o.cut) { phase = 'blank'; keyA = 0; holeA = 0; until = t; } else { phase = 'back'; keyA = 0; holeA = 1; }
      },
      pause: function (p) { paused = p; last = 0; },
      state: function () { return { state: phase, out: out, fall: fy }; },
      stop: function () { cancelAnimationFrame(raf); }
    };
  }

  window.DovetailMark = {
    create: create,
    // The block and dovetail in 3D, shared with the spin animation (logo-spin.js).
    geom: { VPX: VPX, VPY: VPY, F: F, U: U, W1: W1, HALF_FRONT: HALF_FRONT, HALF_BACK: HALF_BACK, shade: shade, hex: hex }
  };
})();
