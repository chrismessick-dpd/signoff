/* People & access, one sheet for the whole suite (2026-11-07).
   Loaded with a plain script tag (the CSP forbids inline scripts) by the hub, Signoff EE, ME, FW
   and PL. It opens a sheet over the page you're on, with one tab per review tool. Each tool keeps
   its own People list (users.json in its data repo), so each tab is that tool's own People page:
     - a review tool (EE, ME or FW) draws its own tab natively, through SignoffPeople.register;
     - every other tab is the other tool's page in an iframe, index.html?page=people&embed=1,
       which shows only People (app.js, EMBED).
   A tool never frames itself: two copies of one tool in one tab would write one roster over the
   other. The hub registers nothing, so all three tabs are frames there. Signoff PL registers a tab of
   its own (label given to register), which is drawn first and only in PL: PL's People & access across
   every tool's people list (2026-11-08).

   Hosts: any element with data-people-open opens the sheet (the hub and PL sidebars); the
   engine's data-act="people" calls SignoffPeople.open(). ?page=people opens it on load (the
   engine does that itself). Escape or a click outside closes it. */
(function () {
  'use strict';
  if (window.SignoffPeople) return;
  var TOOLS = [
    { id: 'ee_design_review', label: 'Signoff EE', sub: 'Boards' },
    { id: 'me_design_review', label: 'Signoff ME', sub: 'Parts' },
    { id: 'fw_design_review', label: 'Signoff FW', sub: 'Firmware' }
  ];
  var TAB_KEY = 'signoff.people.tab';
  var EMBEDDED = /[?&]embed=1\b/.test(location.search) && window.parent !== window;
  var host = null;     // { id, draw(el), changed() } of the review tool this page is, if any
  var wrap = null, tab = '';

  function remembered() { try { return localStorage.getItem(TAB_KEY) || ''; } catch (e) { return ''; } }
  function remember(id) { try { localStorage.setItem(TAB_KEY, id); } catch (e) { /* storage blocked */ } }
  function known(id) { return TOOLS.some(function (t) { return t.id === id; }); }
  function notify() { if (host && host.changed) host.changed(); }

  function pane(id) { return wrap && wrap.querySelector('.people-pane[data-tool="' + id + '"]'); }

  function show(id) {
    if (!wrap) return;
    tab = known(id) ? id : TOOLS[0].id;
    remember(tab);
    wrap.querySelectorAll('.people-tabs button').forEach(function (b) {
      var on = b.dataset.tool === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    wrap.querySelectorAll('.people-pane').forEach(function (p) { p.hidden = p.dataset.tool !== tab; });
    var p = pane(tab);
    if (!p) {
      p = document.createElement('div');
      p.className = 'people-pane';
      p.dataset.tool = tab;
      wrap.querySelector('.people-body').appendChild(p);
      if (!(host && host.id === tab)) {
        // Frames stay loaded while the sheet is open, so switching tabs back is instant.
        var f = document.createElement('iframe');
        f.title = 'People & access in ' + TOOLS.filter(function (t) { return t.id === tab; })[0].label;
        f.src = '../' + tab + '/index.html?page=people&embed=1';
        p.classList.add('framed');
        p.appendChild(f);
      }
    }
    if (host && host.id === tab) host.draw(p);
    notify();
  }

  function open(id) {
    if (EMBEDDED) return;
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'people-wrap';
      wrap.id = 'people-pop';
      wrap.innerHTML = '<div class="people-pop" role="dialog" aria-modal="true" aria-label="People and access">' +
        '<div class="people-head"><h2>People &amp; access</h2>' +
        '<div class="seg people-tabs" role="tablist">' + TOOLS.map(function (t) {
          return '<button type="button" role="tab" data-tool="' + t.id + '" title="' + t.label + ' (' + t.sub.toLowerCase() + ')">' + t.label + '</button>';
        }).join('') + '</div>' +
        '<button type="button" class="icon-btn people-close" aria-label="Close" title="Close (Esc)">' +
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>' +
        '<div class="people-body"></div></div>';
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
      wrap.addEventListener('click', function (e) {
        var b = e.target.closest('.people-tabs button');
        if (b) { show(b.dataset.tool); return; }
        if (e.target.closest('.people-close')) close();
      });
      document.body.appendChild(wrap);
      document.documentElement.classList.add('people-open');
    }
    // The tool you're in first, unless you asked for one or last looked at another.
    show(id || (host ? host.id : '') || remembered() || TOOLS[0].id);
  }

  function close() {
    if (!wrap) return;
    wrap.remove();
    wrap = null; tab = '';
    document.documentElement.classList.remove('people-open');
    notify();
  }

  // The host's own native pane, when the sheet is open on it (else null).
  function hostPane(id) { return wrap && tab === id ? pane(id) : null; }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-people-open]');
    if (!el) return;
    e.preventDefault();
    var app = document.getElementById('app');
    if (app) app.classList.remove('nav-open');
    open();
  });
  // Registered before the tools' own handlers (this script loads first), so Escape closes the
  // sheet before anything under it reacts. A person sheet, menu or busy card on top goes first.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !wrap) return;
    if (document.getElementById('sheet') || document.getElementById('menu') || document.getElementById('busy-wrap')) return;
    e.stopImmediatePropagation();
    close();
  });

  window.SignoffPeople = {
    tools: TOOLS,
    embedded: EMBEDDED,
    // A host that isn't one of the review tools above (PL) passes a label: its tab comes first, here only.
    register: function (id, o) {
      host = { id: id, draw: o.draw, changed: o.changed, own: !!o.label };
      if (o.label && !known(id)) TOOLS.unshift({ id: id, label: o.label, sub: o.sub || '' });
    },
    open: open,
    close: close,
    isOpen: function () { return !!wrap; },
    pane: hostPane
  };

  // The hub and PL (a host with its own tab): ?page=people opens the sheet. The review tools do it
  // from app.js.
  if (!EMBEDDED && /[?&]page=people\b/.test(location.search)) {
    var start = function () { if ((!host || host.own) && !/[?&]demo\b/.test(location.search)) open(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
    else setTimeout(start, 0);
  }
})();
