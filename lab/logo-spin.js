// Animated Dovetail mark (prototype): "Spin about".
// The same block and dovetail as Tap out, in the logo's own one-point perspective. Each round, the
// block spins half a turn about z (into the image) while the dovetail stays put; then the dovetail
// spins about y (up), changing color each turn. Between moves it rests as the logo with the
// dovetail seated.
//
// The two solids pass through each other, which SVG can't draw, so each frame is drawn with a
// small depth-buffered rasterizer into a canvas, at twice the resolution and scaled down for
// smooth edges.
//
// 3D coordinates as in logo-motion.js: x across the front face, y down the image, w into the page.
(function () {
  'use strict';
  var G = window.DovetailMark.geom;
  var VPX = G.VPX, VPY = G.VPY, F = G.F, U = G.U, W1 = G.W1, HF = G.HALF_FRONT, HB = G.HALF_BACK;
  var H = 98.68;                                       // the block's height
  var W = F * ((VPX - 19.79) / (VPX - 59.21) - 1);     // its depth: the bowl's right edge
  var CY = H / 2;                                      // the block's middle, and the dovetail's
  var CX = U / 2;
  var HAIR = 1.6;                                      // the hairline between front and side faces
  var EYE = [VPX, VPY, -F];
  var SS = 2;                                          // supersampling

  // Key colors, one per dovetail turn; the first is the seated gray.
  var PALETTE = [null, '#f5a524', '#ef6a4c', '#3fa7e0', '#7cc35a', '#a47be0'];

  function ytop(w) { return CY - HF - (HB - HF) * (w / W1); }
  function ybot(w) { return CY + HF + (HB - HF) * (w / W1); }

  // The block, with its dovetail channel, as convex faces in its own coordinates.
  // kind: 'front' (the face toward the viewer), 'side' (outside faces), 'channel' (inside).
  function blockFaces() {
    var f = [];
    function q(kind, pts) { f.push({ kind: kind, pts: pts }); }
    // Front face, above and below the channel's opening.
    q('front', [[0, 0, 0], [U, 0, 0], [U, ytop(0), 0], [0, ytop(0), 0]]);
    q('front', [[0, ybot(0), 0], [U, ybot(0), 0], [U, H, 0], [0, H, 0]]);
    // Left and right faces, around the channel's flared ends.
    [0, U].forEach(function (x) {
      q('side', [[x, 0, 0], [x, 0, W1], [x, ytop(W1), W1], [x, ytop(0), 0]]);
      q('side', [[x, ybot(0), 0], [x, ybot(W1), W1], [x, H, W1], [x, H, 0]]);
      q('side', [[x, 0, W1], [x, 0, W], [x, H, W], [x, H, W1]]);
    });
    q('side', [[0, 0, 0], [U, 0, 0], [U, 0, W], [0, 0, W]]);      // top
    q('side', [[0, H, 0], [U, H, 0], [U, H, W], [0, H, W]]);      // bottom
    q('side', [[0, 0, W], [U, 0, W], [U, H, W], [0, H, W]]);      // back
    // The channel's walls.
    q('channel', [[0, ytop(0), 0], [U, ytop(0), 0], [U, ytop(W1), W1], [0, ytop(W1), W1]]);
    q('channel', [[0, ybot(0), 0], [U, ybot(0), 0], [U, ybot(W1), W1], [0, ybot(W1), W1]]);
    q('channel', [[0, ytop(W1), W1], [U, ytop(W1), W1], [U, ybot(W1), W1], [0, ybot(W1), W1]]);
    return f;
  }
  // The dovetail, filling the channel.
  function keyFaces() {
    var cs = [[ytop(0), 0], [ybot(0), 0], [ybot(W1), W1], [ytop(W1), W1]];
    var L = cs.map(function (c) { return [0, c[0], c[1]]; }), R = cs.map(function (c) { return [U, c[0], c[1]]; });
    return [
      { kind: 'kfront', pts: [L[0], R[0], R[1], L[1]] },
      { kind: 'key', pts: [L[1], R[1], R[2], L[2]] },
      { kind: 'key', pts: [L[2], R[2], R[3], L[3]] },
      { kind: 'key', pts: [L[3], R[3], R[0], L[0]] },
      { kind: 'key', pts: L.slice() },
      { kind: 'key', pts: R.slice() }
    ];
  }
  var BLOCK = blockFaces(), KEYF = keyFaces();
  // Outward normals: away from the solid's middle (into the channel, for its walls).
  function centroid(p) {
    var c = [0, 0, 0];
    p.forEach(function (v) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; });
    return [c[0] / p.length, c[1] / p.length, c[2] / p.length];
  }
  function normalOf(pts, inside) {
    var a = pts[0], b = pts[1], c = pts[2];
    var u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    var n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    var l = Math.hypot(n[0], n[1], n[2]); n = [n[0] / l, n[1] / l, n[2] / l];
    var m = centroid(pts), d = [m[0] - inside[0], m[1] - inside[1], m[2] - inside[2]];
    return n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
  }
  BLOCK.forEach(function (f) {
    var mid = f.kind === 'channel' ? [CX, CY, W1 * 1.5] : [CX, CY, W / 2];   // channel walls face into the channel
    f.n = normalOf(f.pts, mid);
    if (f.kind === 'channel') f.n = [-f.n[0], -f.n[1], -f.n[2]];
  });
  KEYF.forEach(function (f) { f.n = normalOf(f.pts, [CX, CY, W1 / 2]); });
  // The channel's back wall faces the viewer.
  BLOCK[BLOCK.length - 1].n = [0, 0, -1];

  // Spins: the block about z through its middle; the dovetail about y through its middle.
  function rotZ(p, a) {
    var c = Math.cos(a), s = Math.sin(a), x = p[0] - CX, y = p[1] - CY;
    return [CX + x * c - y * s, CY + x * s + y * c, p[2]];
  }
  function rotY(p, a) {
    var c = Math.cos(a), s = Math.sin(a), x = p[0] - CX, w = p[2] - W1 / 2;
    return [CX + x * c + w * s, p[1], W1 / 2 - x * s + w * c];
  }

  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function rgbOf(c) { return G.hex(c); }
  // Shading that is zero for the faces seen at rest (the front and the right side), so the resting
  // mark is the flat logo; other faces darken (or, on a dark fill, lighten) as they turn away.
  function tone(base, n, extra) {
    var face = Math.max(n[0], -n[2], 0);
    return G.shade(base, Math.min(0.9, 0.32 * (1 - face) + (extra || 0)));
  }

  var DEFAULTS = { fill: '#fff', rest: 2, blockTime: 2.4, turns: 2, turnTime: 1.4, firstRest: null };

  function create(host, opts) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in opts || {}) o[k] = opts[k];
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    var pos = getComputedStyle(host).position;
    if (pos === 'static') host.style.position = 'relative';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var off = document.createElement('canvas'), octx = off.getContext('2d');
    var Wpx, Hpx, sc, ox, oy, img, zbuf, ids;

    function size() {
      var dpr = window.devicePixelRatio || 1;
      var cw = host.clientWidth, ch = host.clientHeight;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      Wpx = canvas.width * SS; Hpx = canvas.height * SS;
      off.width = Wpx; off.height = Hpx;
      // The logo's box (59.21 by 98.68) sits centered, as tall as the SVG mark in the same host.
      var frac = host.classList.contains('tile') ? 0.6 : 0.667;
      sc = Hpx * frac / H;
      ox = (Wpx - 59.21 * sc) / 2; oy = (Hpx - H * sc) / 2;
      img = octx.createImageData(Wpx, Hpx);
      zbuf = new Float32Array(Wpx * Hpx); ids = new Uint8Array(Wpx * Hpx);
    }

    function project(p) {
      var s = F / (F + p[2]);
      return [ox + (VPX + (p[0] - VPX) * s) * sc, oy + (VPY + (p[1] - VPY) * s) * sc, s];
    }

    // Fills one convex face, depth-tested. ties: let the face win where depths are equal.
    function fill(pts, rgb, id, ties) {
      var P = pts.map(project);
      for (var t = 1; t < P.length - 1; t++) tri(P[0], P[t], P[t + 1], rgb, id, ties);
    }
    function tri(a, b, c, rgb, id, ties) {
      var area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-6) return;
      var minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(Wpx - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      var minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(Hpx - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      var data = img.data, eps = ties ? 1e-6 : -1e-6;
      for (var y = minY; y <= maxY; y++) {
        var py = y + 0.5;
        for (var x = minX; x <= maxX; x++) {
          var px = x + 0.5;
          var w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
          var w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
          var w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          var z = w0 * a[2] + w1 * b[2] + w2 * c[2], i = y * Wpx + x;
          if (z + eps < zbuf[i]) continue;
          zbuf[i] = z; ids[i] = id;
          var j = i * 4;
          data[j] = rgb[0]; data[j + 1] = rgb[1]; data[j + 2] = rgb[2]; data[j + 3] = 255;
        }
      }
    }
    function css(c) { var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : rgbOf(c); }

    // State: rest → block (spin about z) → rest → key (spin about y) → rest → block …
    var phase = 'rest', next = 'block', t0 = now(), restFor = o.firstRest != null ? o.firstRest : o.rest;
    var za = 0, ya = 0, colorIdx = 0, turnColor = 0, paused = false, raf = 0, dirty = true, last = 0, pauseAt = 0;

    function now() { return performance.now() / 1000; }
    // The seated gray is the same shade Tap out uses, as hex for the shading helper.
    function keyColor(idx) {
      return PALETTE[idx % PALETTE.length] ||
        '#' + css(G.shade(o.fill, 0.28)).map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('');
    }

    function step(t) {
      var u;
      if (phase === 'rest') {
        if (t - t0 >= restFor) { phase = next; t0 = t; }
      } else if (phase === 'block') {
        u = Math.min(1, (t - t0) / o.blockTime);
        // Half a turn: the block and its channel are symmetric about the middle, so it lands back
        // around the dovetail looking just as it started.
        za = Math.PI * ease(u); dirty = true;
        if (u >= 1) { za = 0; phase = 'rest'; next = 'key'; t0 = t; restFor = o.rest; }
      } else if (phase === 'key') {
        var total = o.turns * o.turnTime;
        u = Math.min(1, (t - t0) / total);
        ya = 2 * Math.PI * o.turns * ease(u); dirty = true;
        // A new color each turn, switched while the dovetail is edge-on so the change isn't seen
        // flat on.
        var n = Math.floor((ya / (2 * Math.PI)) + 0.75);
        turnColor = colorIdx + n;
        if (u >= 1) { ya = 0; colorIdx += o.turns; turnColor = colorIdx; phase = 'rest'; next = 'block'; t0 = t; restFor = o.rest; }
      }
    }

    function render() {
      zbuf.fill(-1e9); ids.fill(0);
      var data = img.data; data.fill(0);
      var fillRgb = css(o.fill);
      // Faces toward the eye only (plus the channel, which is seen from inside).
      function facing(n, pts) {
        var m = centroid(pts);
        return n[0] * (EYE[0] - m[0]) + n[1] * (EYE[1] - m[1]) + n[2] * (EYE[2] - m[2]) > 0;
      }
      BLOCK.forEach(function (f) {
        var pts = f.pts.map(function (p) { return rotZ(p, za); });
        var n = rotZ([f.n[0] + CX, f.n[1] + CY, f.n[2]], za); n = [n[0] - CX, n[1] - CY, n[2]];
        if (!facing(n, pts)) return;
        var rgb = f.kind === 'front' ? fillRgb : css(tone(o.fill, n, f.kind === 'channel' ? 0.3 : 0));
        fill(pts, rgb, f.kind === 'front' ? 1 : 2, false);
      });
      var kc = keyColor(turnColor);
      KEYF.forEach(function (f) {
        var pts = f.pts.map(function (p) { return rotY(p, ya); });
        var n = rotY([f.n[0] + CX, f.n[1], f.n[2] + W1 / 2], ya); n = [n[0] - CX, n[1], n[2] - W1 / 2];
        if (!facing(n, pts)) return;
        // The dovetail wins where it's flush with the block, as when seated.
        fill(pts, css(tone(kc, n, 0)), f.kind === 'kfront' ? 3 : 4, true);
      });
      // The hairline: a strip of the front face along each edge whose side face is in view, cut
      // through to the background. Seated, it runs on through the dovetail, as in the logo.
      // Lined up: the block at 0 or a half turn (it's symmetric), the dovetail square to it.
      var seated = Math.abs(Math.sin(za)) < 1e-3 && Math.abs(Math.sin(ya)) < 1e-3 && Math.cos(ya) > 0;
      var cuts = [];
      [[1, 0, U], [-1, 0, 0], [0, 1, H], [0, -1, 0]].forEach(function (e) {
        // e: the side face's outward normal (in the block's own x, y) and its position.
        var n = rotZ([e[0] + CX, e[1] + CY, 0], za); n = [n[0] - CX, n[1] - CY, 0];
        var p = e[0] ? [e[2], CY, W / 2] : [CX, e[2], W / 2];
        p = rotZ(p, za);
        if (n[0] * (EYE[0] - p[0]) + n[1] * (EYE[1] - p[1]) + n[2] * (EYE[2] - p[2]) > 0) cuts.push(e);
      });
      if (cuts.length) {
        var c = Math.cos(-za), s = Math.sin(-za);
        for (var y = 0; y < Hpx; y++) {
          for (var x = 0; x < Wpx; x++) {
            var i = y * Wpx + x, id = ids[i];
            if (id !== 1 && !(seated && id === 3)) continue;
            // Back to the block's own front-face coordinates (the front face is at w = 0).
            var wx = ((x + 0.5) - ox) / sc - CX, wy = ((y + 0.5) - oy) / sc - CY;
            var lx = CX + wx * c - wy * s, ly = CY + wx * s + wy * c;
            for (var k = 0; k < cuts.length; k++) {
              var e = cuts[k], d = e[0] ? (e[0] > 0 ? e[2] - lx : lx - e[2]) : (e[1] > 0 ? e[2] - ly : ly - e[2]);
              if (d >= -0.01 && d < HAIR) { data[i * 4 + 3] = 0; break; }
            }
          }
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      dirty = false;
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      if (paused) return;
      step(now());
      if (dirty) render();
    }
    size(); render();
    raf = requestAnimationFrame(frame);

    return {
      el: canvas,
      set: function (p) { for (var k in p) o[k] = p[k]; dirty = true; },
      pause: function (p) {
        if (p && !paused) pauseAt = now();
        if (!p && paused) t0 += now() - pauseAt;   // pick up where it stopped
        paused = p;
      },
      state: function () { return { phase: phase, za: za, ya: ya, color: turnColor }; },
      stop: function () { cancelAnimationFrame(raf); canvas.remove(); }
    };
  }

  window.DovetailSpin = { create: create };
})();
