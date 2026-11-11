/* Dovetail Signoff hub. Shares the theme with Signoff EE/ME through their settings object in
   localStorage, and switches the tool links to demo mode for index.html?demo.
   Loaded in <head> so the theme is set before first paint. */
(function () {
  'use strict';

  // Same detection and namespace as ee_design_review/assets/app.js, so demo and real
  // settings stay apart exactly as they do in the tools.
  var DEMO = /[?&]demo\b/.test(location.search) || location.hash === '#demo';
  // The light/dark theme is the suite's, under one fixed key in the demo too (Chris, 2026-11-08: the
  // demo tour flipped between light and dark as it moved between tools that kept it apart).
  var SETTINGS_KEY = 'signoff.v1.settings';

  function readSettings() {
    try { var v = JSON.parse(localStorage.getItem(SETTINGS_KEY)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
  }
  // Write back only `theme`; everything else in the object belongs to the tools.
  function writeTheme(theme) {
    var s = readSettings();
    s.theme = theme;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* private window: theme just won't persist */ }
  }

  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function currentTheme() { return readSettings().theme || 'auto'; }
  function isDark(theme) { return theme === 'dark' || (theme !== 'light' && !!(darkQuery && darkQuery.matches)); }

  var ICON = {
    moon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M16.2 12.4A6.6 6.6 0 017.6 3.8a6.6 6.6 0 108.6 8.6z"/></svg>',
    sun: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.4"/><path d="M10 2v1.8M10 16.2V18M2 10h1.8M16.2 10H18M4.3 4.3l1.3 1.3M14.4 14.4l1.3 1.3M15.7 4.3l-1.3 1.3M5.6 14.4l-1.3 1.3"/></svg>'
  };

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    var btn = document.getElementById('theme-btn');
    if (btn) {
      var dark = isDark(theme);
      btn.innerHTML = dark ? ICON.sun : ICON.moon;
      btn.title = dark ? 'Light mode' : 'Dark mode';
    }
  }
  applyTheme(currentTheme());
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', function () { applyTheme(currentTheme()); });
  // Follow a theme change made in a tool open in another tab.
  window.addEventListener('storage', function (e) { if (e.key === SETTINGS_KEY) applyTheme(currentTheme()); });

  // Whether this browser's token is an FTE's, as Signoff EE last found at sync: EE records the
  // token's fingerprint (`tokenTag`, the engine's model.tokenTag) and whether that token could
  // open its data repo (`dataAccess`). The hub makes no request of its own.
  function signedInLogin(token) {
    if (!/^ghu_/.test(token)) return '';
    try {
      if (typeof localStorage === 'undefined' || !localStorage.getItem('signoff.auth')) return '';
      return String(localStorage.getItem('signoff.login') || '');
    } catch (e) { return ''; }
  }
  function tokenTag(token) {
    var h = 0x811c9dc5;
    token = String(token || '');
    var login = signedInLogin(token);
    if (login) token = 'signin:' + login.toLowerCase();
    for (var i = 0; i < token.length; i++) { h ^= token.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function isFte() {
    if (DEMO) return false;
    var token = '', access = '';
    try {
      token = sessionStorage.getItem('signoff.token') || localStorage.getItem('signoff.token') || '';
      access = JSON.parse(localStorage.getItem('signoff.v1.dataAccess') || '""');
    } catch (e) { return false; }
    return !!token && readSettings().tokenTag === tokenTag(token) && access === 'ok';
  }

  // The hub's own UI state, kept apart from the tools' `ui` objects.
  var UI_KEY = 'signoff.hub.ui';
  function readUi() {
    try { var v = JSON.parse(localStorage.getItem(UI_KEY)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
  }
  function writeUi(ui) {
    try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* private window: just won't persist */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var app = document.getElementById('app');
    var main = document.getElementById('main');
    var navBtn = document.getElementById('nav-btn');
    applyTheme(currentTheme());
    // People & access lives in Signoff EE, whose list decides who's an FTE; the link is for FTEs.
    function showPeople() { document.getElementById('people-link').hidden = !isFte(); }
    showPeople();
    window.addEventListener('storage', showPeople);
    // The sidebar foot shared with the tools (assets/sidefoot.js): the sign-in pill and Settings.
    if (window.SignoffFoot) {
      window.SignoffFoot.mount({
        pill: '#sync-pill', settings: '[data-foot-settings]',
        theme: currentTheme, setTheme: function (t) { writeTheme(t); applyTheme(t); },
        intro: 'One GitHub sign-in serves every Signoff tool in this browser.',
        changed: showPeople
      });
    }

    if (DEMO) {
      document.querySelectorAll('[data-tool]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href') + '?demo'); });
      document.querySelectorAll('[data-internal]').forEach(function (el) { el.hidden = true; });
      document.getElementById('demo-banner').hidden = false;
      document.body.classList.add('has-banner');
      document.querySelectorAll('a[href="index.html"]').forEach(function (a) { a.setAttribute('href', 'index.html?demo'); });
    }

    function setNav(open) {
      app.classList.toggle('nav-open', open);
      navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    // Same behavior as toggleSidebar() in Signoff EE: the sidebar slides over the page on
    // narrow windows; on wide ones it collapses away and stays that way until opened again.
    var narrow = window.matchMedia ? window.matchMedia('(max-width: 860px)') : { matches: false };
    function toggleSidebar() {
      if (narrow.matches) { setNav(!app.classList.contains('nav-open')); return; }
      var ui = readUi();
      ui.sideCollapsed = !ui.sideCollapsed;
      app.classList.toggle('side-collapsed', ui.sideCollapsed);
      writeUi(ui);
    }
    // Start as it was left, without playing the slide. Applied on narrow windows too (suite.css
    // only hides it above 860 px), so widening the window later shows it as it was left.
    if (readUi().sideCollapsed) {
      app.style.transition = 'none';
      app.classList.add('side-collapsed');
      void app.offsetWidth;
      app.style.transition = '';
    }

    document.addEventListener('click', function (e) {
      // A tap outside the open menu (on its scrim, suite.css) closes it and goes no further.
      if (app.classList.contains('nav-open') && e.target === app) { setNav(false); e.preventDefault(); return; } // the scrim is #app's ::after
      if (e.target.closest('#theme-btn')) {
        var next = isDark(currentTheme()) ? 'light' : 'dark';
        writeTheme(next);
        applyTheme(next);
      } else if (e.target.closest('#nav-btn') || e.target.closest('#side-collapse')) {
        toggleSidebar();
      } else if (e.target.closest('.sidebar a')) {
        setNav(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
      else if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); toggleSidebar(); }
    });

    // The tool picker. A plain click on a tile selects it and shows it on the stage; a click on the
    // tile already selected opens it, so a double-click opens too, and so does Enter on a focused,
    // selected tile. Modifier and middle clicks are left to the browser. The choice is remembered.
    var tiles = [].slice.call(document.querySelectorAll('.pk-tile'));
    // On narrow windows the tiles are one sideways-scrolling row; keep the selected one in view.
    function pick(id) {
      tiles.forEach(function (t) {
        var on = t.getAttribute('data-pick') === id;
        t.classList.toggle('sel', on);
        if (on) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
        var row = t.parentNode;
        if (on && row.scrollWidth > row.clientWidth && (t.offsetLeft < row.scrollLeft || t.offsetLeft + t.offsetWidth > row.scrollLeft + row.clientWidth)) {
          row.scrollTo({ left: t.offsetLeft - 4, behavior: 'smooth' });
        }
      });
      document.querySelectorAll('.pk-panel').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== id; });
      var ui = readUi();
      ui.pick = id;
      writeUi(ui);
    }
    if (tiles.length) {
      var saved = readUi().pick;
      pick(tiles.some(function (t) { return t.getAttribute('data-pick') === saved; }) ? saved : 'pl');
      document.getElementById('picker').addEventListener('click', function (e) {
        var tile = e.target.closest('.pk-tile');
        if (!tile || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (tile.classList.contains('sel')) return;
        e.preventDefault();
        pick(tile.getAttribute('data-pick'));
      });
      document.getElementById('picker').addEventListener('keydown', function (e) {
        var i = tiles.indexOf(e.target);
        if (i < 0 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
        e.preventDefault();
        var next = tiles[(i + (e.key === 'ArrowRight' ? 1 : tiles.length - 1)) % tiles.length];
        next.focus();
        pick(next.getAttribute('data-pick'));
      });
    }

    main.addEventListener('scroll', function () { document.getElementById('toolbar').classList.toggle('scrolled', main.scrollTop > 60); }, { passive: true });
  });
})();
