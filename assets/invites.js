/* Invitations, one card for the whole suite (Chris, 2026-11-12).
   GitHub emails one invitation per repo. This card lists every invitation from the suite's owner that
   waits for the signed-in person, in the sidebar of every tool, with one Accept all.

   Why the Worker: a Sign in with GitHub token (ghu_) reaches only repos the person can already see, so
   GitHub's own list (/user/repository_invitations) leaves out every private repo until it's accepted:
   the data repos and every review-* repo. It can still accept one by id (tried 2026-11-12). So the
   card asks two places and merges them by id:
     1. GitHub's list with the person's own token (all of them for a pasted classic token; the public
        tool repos for a sign-in);
     2. the signoff-auth Worker's POST /invitations, which checks who the token belongs to and looks up
        that login's invitations on the owner's private repos as the GitHub App.
   Accepting is always the person's own token: PATCH /user/repository_invitations/<id>.

   Loaded with a plain script tag from ../signoff/assets/ (the CSP forbids inline scripts) by the hub,
   Signoff EE, ME, FW, and PL, Fabcheck, Loom, Partcheck, and Flasher. Never in ?demo or an embed.

   Where: a card just above the sidebar's list (#sidebar .side-list, or the hub's .side-nav).
   When: shortly after the page opens, when the tab comes back into view, every 5 minutes, and when a
   tool calls SignoffInvites.refresh() (after its sync). A check is shared across tabs and tools for five
   minutes (signoff.v1.invites, cleared with the rest of signoff.v1. at Sign out); only a new token or
   SignoffInvites.refresh(true) checks sooner.
   After Accept all: the event 'signoff:invites-accepted' ({ detail: { repos } }) on window, so a tool
   can sync and pick up what it just joined. Tools that draw their own card skip it when
   window.SignoffInvites is here. */
(function () {
  'use strict';
  if (window.SignoffInvites) return;

  var OWNER = 'chrismessick-dpd', API = 'https://api.github.com';
  // The Worker for this site: keep in step with APPS in auth.js (the engine's, vendored everywhere).
  var WORKERS = {
    'https://chrismessick-dpd.github.io': 'https://signoff-auth.misty-dawn-b371.workers.dev',
    'http://localhost:8774': 'https://signoff-auth-dev.misty-dawn-b371.workers.dev',
    'http://localhost:8771': 'https://signoff-auth-dev.misty-dawn-b371.workers.dev'
  };
  var DEMO = /[?&]demo\b/.test(location.search) || location.hash === '#demo';
  var EMBEDDED = /[?&]embed=1\b/.test(location.search) && window.parent !== window;
  var KEY = 'signoff.v1.invites';
  var FRESH = 5 * 60 * 1000, EVERY = 5 * 60 * 1000;   // the Worker's scan costs ~20 GitHub calls

  var state = { list: [], incomplete: false, busy: false, note: '', failed: [] };
  var timer = null, running = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function readCache() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function writeCache(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function rawToken() { return (get(sessionStorage, 'signoff.token') || get(localStorage, 'signoff.token') || '').trim(); }
  function token() {
    var t = rawToken(), A = window.SignoffAuth;
    return A && A.owns && A.owns(t) ? A.token().then(function (x) { return x || t; }) : Promise.resolve(t);
  }
  // A short fingerprint of the token, so a cached list never shows to another account in this browser.
  // A sign-in is fingerprinted by its login, which stays the same across its 8-hour token refreshes.
  function who() {
    var t = rawToken(), A = window.SignoffAuth;
    if (!t) return '';
    if (A && A.owns && A.owns(t)) { var st = A.status ? A.status() : {}; if (st.login) return 'login:' + String(st.login).toLowerCase(); }
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return 'tok:' + h.toString(36);
  }
  function short(repo) { return String(repo).split('/')[1] || repo; }
  function mine(repo) { return String(repo || '').split('/')[0].toLowerCase() === OWNER.toLowerCase(); }

  function gh(method, path, retried) {
    return token().then(function (t) {
      return fetch(API + path, {
        method: method,
        headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        cache: 'no-store'
      }).then(function (r) {
        var A = window.SignoffAuth;
        if (r.status === 401 && !retried && A && A.owns && A.owns(t)) return A.refresh(t).then(function () { return gh(method, path, true); });
        if (r.ok) return r.status === 204 ? null : r.json();
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(j.message || ('GitHub said ' + r.status)); e.status = r.status; throw e;
        });
      });
    });
  }
  // Only for a sign-in: a pasted token's own list already has every invitation, and the Worker
  // serves only this app's tokens.
  function fromWorker() {
    var url = WORKERS[location.origin], A = window.SignoffAuth;
    if (!url) return Promise.reject(new Error('no Worker for this site'));
    if (!(A && A.owns && A.owns(rawToken()))) return Promise.resolve({ invitations: [], partial: false, own: true });
    return token().then(function (t) {
      return fetch(url + '/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: t }), cache: 'no-store'
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error_description || ('The Worker said ' + r.status)); e.status = r.status; throw e; }
          return j;
        });
      });
    });
  }

  // Ask both places; a failure in one still shows what the other found.
  function check() {
    var tag = who();
    var own = gh('GET', '/user/repository_invitations?per_page=100').then(function (list) {
      return (list || []).map(function (i) { return { id: i.id, repo: i.repository && i.repository.full_name }; });
    }, function () { return null; });
    var worker = fromWorker().then(function (j) { return { list: j.invitations || [], partial: !!j.partial, own: !!j.own }; }, function () { return null; });
    return Promise.all([own, worker]).then(function (r) {
      var byId = {};
      (r[0] || []).concat(r[1] ? r[1].list : []).forEach(function (i) { if (i && i.id && mine(i.repo)) byId[i.id] = { id: i.id, repo: i.repo }; });
      var list = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) { return a.repo < b.repo ? -1 : 1; });
      // Incomplete: neither place answered fully, so private repos may be missing.
      var incomplete = !r[1] || r[1].partial || (r[1].own && !r[0]);
      if (!r[0] && !r[1]) throw new Error('Couldn’t check invitations');
      var out = { who: tag, at: Date.now(), list: list, incomplete: incomplete };
      if (who() === tag) writeCache(out);
      return out;
    });
  }

  function refresh(force) {
    if (DEMO || EMBEDDED || !rawToken()) { state.list = []; render(); return Promise.resolve(state.list); }
    var c = readCache(), tag = who();
    if (c && c.who === tag) { state.list = c.list || []; state.incomplete = !!c.incomplete; render(); }
    if (!force && c && c.who === tag && Date.now() - c.at < FRESH) return Promise.resolve(state.list);
    if (running) return running;
    running = check().then(function (out) {
      if (out.who !== who()) return state.list;
      state.list = out.list; state.incomplete = out.incomplete;
      render();
      return state.list;
    }, function () { return state.list; }).then(function (l) { running = null; return l; });
    return running;
  }

  function acceptAll() {
    if (state.busy || !state.list.length) return;
    state.busy = true; state.note = ''; state.failed = []; render();
    var joined = [], failed = [];
    var list = state.list.slice();
    // One at a time: a handful of PATCHes, and GitHub dislikes bursts of writes.
    list.reduce(function (chain, inv) {
      return chain.then(function () {
        return gh('PATCH', '/user/repository_invitations/' + inv.id).then(function () { joined.push(inv.repo); }, function (e) { failed.push({ repo: inv.repo, message: e.message, status: e.status }); });
      });
    }, Promise.resolve()).then(function () {
      state.busy = false;
      state.list = state.list.filter(function (i) { return joined.indexOf(i.repo) < 0; });
      state.failed = failed;
      state.note = joined.length ? 'Joined ' + joined.length + ' repo' + (joined.length === 1 ? '' : 's') + '.' : '';
      var c = readCache();
      if (c && c.who === who()) { c.list = state.list; c.at = Date.now(); writeCache(c); }
      render();
      if (joined.length) {
        try { window.dispatchEvent(new CustomEvent('signoff:invites-accepted', { detail: { repos: joined } })); } catch (e) { /* old browser */ }
      }
    });
  }

  function host() {
    var side = document.getElementById('sidebar');
    return side && (side.querySelector('.side-list') || side.querySelector('.side-nav'));
  }
  function render() {
    var anchor = host(), el = document.getElementById('sg-invites');
    var show = !DEMO && !EMBEDDED && (state.list.length || state.note || state.failed.length);
    if (!anchor || !show) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'sg-invites';
      el.style.cssText = 'flex: none; padding: 0 10px;';
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-invites-accept]')) acceptAll();
        if (e.target.closest('[data-invites-close]')) { state.note = ''; state.failed = []; render(); }
      });
    }
    if (el.nextSibling !== anchor) anchor.parentNode.insertBefore(el, anchor);
    var n = state.list.length, h = '';
    if (n) {
      h += '<b>' + n + ' invitation' + (n === 1 ? '' : 's') + ' from ' + esc(OWNER) + '</b>' +
        '<span>' + state.list.map(function (i) { return esc(short(i.repo)); }).join(', ') + '</span>' +
        '<span>Accept them here; you can ignore GitHub’s emails.</span>' +
        '<button type="button" class="btn btn-primary" data-invites-accept' + (state.busy ? ' disabled' : '') + '>' + (state.busy ? 'Accepting…' : n > 1 ? 'Accept all' : 'Accept') + '</button>';
    }
    if (state.incomplete && n) h += '<span>Some private repos couldn’t be checked; GitHub’s emails have the rest.</span>';
    if (state.note) h += '<span>' + esc(state.note) + (n ? '' : ' Sync to see what’s new.') + '</span>';
    if (state.failed.length) {
      h += '<span>Couldn’t accept ' + state.failed.map(function (f) {
        return '<a href="https://github.com/' + esc(f.repo) + '/invitations" target="_blank" rel="noopener">' + esc(short(f.repo)) + '</a>';
      }).join(', ') + ' (' + esc(state.failed[0].message) + '). Click a name to accept it on GitHub.</span>';
    }
    if (!n) h += '<button type="button" class="btn" data-invites-close>OK</button>';
    el.className = 'invite-card';
    el.innerHTML = h;
  }

  function start() {
    if (DEMO || EMBEDDED) return;
    setTimeout(function () { refresh(); }, 1500);
    if (!timer) timer = setInterval(function () { if (!document.hidden) refresh(); }, EVERY);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    window.addEventListener('storage', function (e) {
      if (e.key === 'signoff.token' || e.key === 'signoff.login' || e.key === null) refresh(true);
      else if (e.key === KEY) { var c = readCache(); if (c && c.who === who()) { state.list = c.list || []; render(); } }
    });
    // A tool that re-renders its sidebar may drop the card's spot; put it back.
    var side = document.getElementById('sidebar');
    if (side && window.MutationObserver) new MutationObserver(function () { if (state.list.length && !document.getElementById('sg-invites')) render(); }).observe(side, { childList: true });
  }

  window.SignoffInvites = {
    refresh: function (force) { return refresh(!!force); },
    list: function () { return state.list.slice(); },
    count: function () { return state.list.length; },
    incomplete: function () { return state.incomplete; },
    acceptAll: acceptAll
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
