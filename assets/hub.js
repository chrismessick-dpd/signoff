/* Dovetail Signoff hub. Shares the theme with Signoff EE/ME through their settings object in
   localStorage, and switches the tool links to demo mode for index.html?demo.
   Loaded in <head> so the theme is set before first paint. */
(function () {
  'use strict';

  // Same detection and namespace as ee_design_review/assets/app.js, so demo and real
  // settings stay apart exactly as they do in the tools.
  var DEMO = /[?&]demo\b/.test(location.search) || location.hash === '#demo';
  var SETTINGS_KEY = (DEMO ? 'signoff.demo.' : 'signoff.v1.') + 'settings';

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
    if (readUi().sideCollapsed && !narrow.matches) app.classList.add('side-collapsed');

    document.addEventListener('click', function (e) {
      if (e.target.closest('#theme-btn')) {
        var next = isDark(currentTheme()) ? 'light' : 'dark';
        writeTheme(next);
        applyTheme(next);
      } else if (e.target.closest('#nav-btn') || e.target.closest('#side-collapse')) {
        toggleSidebar();
      } else if (e.target.closest('#scrim') || e.target.closest('.sidebar a')) {
        setNav(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
      else if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); toggleSidebar(); }
    });

    main.addEventListener('scroll', function () { document.getElementById('toolbar').classList.toggle('scrolled', main.scrollTop > 60); }, { passive: true });
  });
})();
