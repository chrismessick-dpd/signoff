// Wires the lab page's tabs and settings to every animated mark on it.
(function () {
  'use strict';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hosts = [].slice.call(document.querySelectorAll('[data-mark]'));
  var tab = 'tap', paused = false, marks = [];
  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { return +$(id).value; };
  var secs = function (v) { return v + ' s'; };

  function settings() {
    if (tab === 'tap') return { seated: num('seated'), speed: num('speed'), logo: num('logo'), cut: $('cut').checked, cutTime: num('cutTime') };
    if (tab === 'spin') return { rest: num('rest'), blockTime: num('blockTime'), turns: num('turns'), turnTime: num('turnTime') };
    return { size: num('lsize'), weight: num('lweight'), turns: num('lturns'), turnTime: num('lturnTime'), rest: num('lrest') };
  }
  // The sidebar sample names the tool whose mark is showing.
  var SIDE = { dovetail: ['Signoff EE', 'Electrical design review'], loom: ['Loom', 'Dovetail harness drawings'] };

  function show() {
    $('seated-out').textContent = secs(num('seated'));
    $('speed-out').textContent = num('speed').toFixed(2).replace(/\.?0+$/, '') + '×';
    $('logo-out').textContent = secs(num('logo'));
    $('cut-out').textContent = secs(num('cutTime'));
    $('cutTime').disabled = !$('cut').checked;
    $('rest-out').textContent = secs(num('rest'));
    $('block-out').textContent = secs(num('blockTime'));
    $('turns-out').textContent = num('turns');
    $('turn-out').textContent = secs(num('turnTime'));
    $('lsize-out').textContent = Math.round(num('lsize') * 100) + '%';
    $('lweight-out').textContent = num('lweight').toFixed(2).replace(/\.?0+$/, '');
    $('lturns-out').textContent = num('lturns') === 0.5 ? '½' : String(num('lturns'));
    $('lturn-out').textContent = secs(num('lturnTime'));
    $('lrest-out').textContent = num('lrest') ? secs(num('lrest')) : 'none';
  }

  function build() {
    marks.forEach(function (m) { m.stop(); if (m.svg) m.svg.remove(); });
    var s = settings();
    marks = hosts.map(function (host, i) {
      var opts = { fill: host.getAttribute('data-fill') || '#fff' };
      for (var k in s) opts[k] = s[k];
      // Stagger the first wait so the marks don't all move together.
      if (tab === 'tap') { opts.firstSeated = 0.8 + i * 0.5; return DovetailMark.create(host, opts); }
      opts.firstRest = 0.8 + i * 0.5;
      return tab === 'spin' ? DovetailSpin.create(host, opts) : LoomSpin.create(host, opts);
    });
    var side = SIDE[tab === 'loom' ? 'loom' : 'dovetail'];
    $('side-name').textContent = side[0]; $('side-sub').textContent = side[1];
    if (paused) all(function (m) { m.pause(true); });
  }

  function all(fn) { marks.forEach(fn); }
  function setPaused(p) {
    paused = p;
    all(function (m) { m.pause(p); });
    $('b-pause').textContent = p ? 'Play' : 'Pause';
  }

  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      tab = b.getAttribute('data-tab');
      document.querySelectorAll('[data-tab]').forEach(function (x) {
        var on = x === b;
        x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-selected', String(on));
      });
      $('ctl-tap').hidden = tab !== 'tap';
      $('ctl-spin').hidden = tab !== 'spin';
      $('ctl-loom').hidden = tab !== 'loom';
      build();
    });
  });
  ['seated', 'speed', 'logo', 'cut', 'cutTime', 'rest', 'blockTime', 'turns', 'turnTime',
    'lsize', 'lweight', 'lturns', 'lturnTime', 'lrest'].forEach(function (id) {
    $(id).addEventListener('input', function () { show(); var s = settings(); all(function (m) { m.set(s); }); });
  });
  $('b-tap').addEventListener('click', function () { if (paused) setPaused(false); all(function (m) { m.snap(); }); });
  $('b-reseat').addEventListener('click', function () { if (paused) setPaused(false); all(function (m) { m.reseat(); }); });
  $('b-lspin').addEventListener('click', function () { if (paused) setPaused(false); all(function (m) { m.spinNow(); }); });
  $('b-pause').addEventListener('click', function () { setPaused(!paused); });
  $('b-restart').addEventListener('click', build);

  show();
  build();
  if (reduced) { $('rm').style.display = 'block'; setPaused(true); }
})();
