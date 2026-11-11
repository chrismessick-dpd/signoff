/* The sidebar foot, the same in every tool (Chris, 2026-11-10): the folded row of tool icons, People
   & access, and a foot with the sync or account pill (state on line 1, the GitHub ID on line 2), the
   theme button, and Settings.

   Signoff EE, ME, FW, and PL draw their own (the engine's app.js and PL's app.js). This file is for
   the tools that don't sync reviews: the hub, Fabcheck, Partcheck, and Loom (Loom keeps its own sync
   pill and takes the rest). Loaded with a plain script tag from ../signoff/assets/ (the CSP forbids
   inline scripts), after auth.js when the page has it. window.SignoffFoot:

     mount(o)     o.pill     the account pill (a .sync-pill with .sync-dot, .sync-title, .sync-sub),
                             drawn here from the suite's GitHub sign-in; leave it out to keep your own.
                  o.settings selector of the gear button(s); opens the Settings sheet.
                  o.people   the People & access button, shown to FTEs only.
                  o.tools    the Dovetail Signoff links: data-signed links show only when signed in,
                             data-internal ones only for an FTE, and the list folds to icons.
                  o.theme()  the current theme; o.setTheme(t) applies and keeps one. With both, the
                             sheet has Appearance.
                  o.intro    the sheet's line under its title.
                  o.changed  called after a token is saved in this tab's sheet (a sign-in comes back
                             to the page, and a sign-out reloads it).
     settings()   opens the Settings sheet.
     who()        { token, login, fte, signedIn, pasted }.
     fold(el)     folds a .side-tools list to its icons, as the engine's setupToolsFold does.
     signOut()    signs out of the whole suite in this browser, as Signoff EE's Sign out does.

   It reads what Signoff EE writes (signoff.v1.settings tokenTag and login, signoff.v1.dataAccess) and
   never writes EE's data, except the theme. A pasted token's login is looked up once and kept in
   signoff.who ({ tag, login }). */
(function () {
  'use strict';
  if (window.SignoffFoot) return;
  var DEMO = /[?&]demo\b/.test(location.search) || location.hash === '#demo';
  var TOKEN_KEY = 'signoff.token', WHO_KEY = 'signoff.who', SETTINGS_KEY = 'signoff.v1.settings';

  // Keep these two lists the same as Signoff EE's signOut (ee_design_review/assets/app.js).
  var SUITE_NS = ['signoff.v1.', 'signoff-me.v1.', 'signoff-fw.v1.', 'signoff-pl.v1.', 'fabcheck.v1.'];
  var SUITE_DBS = ['fabcheck', 'dovetail-handoff', 'dovetail-handoff-demo', 'signoff-pl-pictures', 'signoff-pl-uploads'];

  var opts = {};
  var looking = {};   // tag -> a /user lookup under way

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function json(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function auth() { return window.SignoffAuth || null; }
  function token() { return get(sessionStorage, TOKEN_KEY) || get(localStorage, TOKEN_KEY) || ''; }
  function cleanToken(t) { return String(t || '').replace(/[\s​-‍⁠﻿]/g, ''); }

  // The engine's model.tokenTag (and hub.js's copy): keep them identical.
  function signedInLogin(tok) {
    if (!/^ghu_/.test(tok)) return '';
    if (!get(localStorage, 'signoff.auth')) return '';
    return String(get(localStorage, 'signoff.login') || '');
  }
  function tokenTag(tok) {
    var h = 0x811c9dc5;
    tok = String(tok || '');
    var login = signedInLogin(tok);
    if (login) tok = 'signin:' + login.toLowerCase();
    for (var i = 0; i < tok.length; i++) { h ^= tok.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function who() {
    var tok = DEMO ? '' : token();
    var A = auth(), st = A ? A.status() : {};
    var out = { token: tok, login: '', fte: false, signedIn: !!st.signedIn, pasted: !!tok && !st.signedIn, available: !DEMO && !!st.available };
    if (!tok) return out;
    var tag = tokenTag(tok), s = json(SETTINGS_KEY, {}) || {}, w = json(WHO_KEY, {}) || {};
    out.login = st.login || (s.tokenTag === tag && s.login) || (w.tag === tag && w.login) || '';
    out.fte = s.tokenTag === tag && json('signoff.v1.dataAccess', '') === 'ok';
    out.tag = tag;
    return out;
  }

  // A pasted token's login, asked of GitHub once per token.
  function lookUp(w) {
    if (!w.token || w.login || looking[w.tag]) return;
    looking[w.tag] = true;
    var A = auth(), tokP = A && A.owns && A.owns(w.token) ? A.token() : Promise.resolve(w.token);
    tokP.then(function (t) {
      return fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json' } });
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (u) {
      if (!u || !u.login) return;
      try { localStorage.setItem(WHO_KEY, JSON.stringify({ tag: w.tag, login: u.login })); } catch (e) { /* storage blocked */ }
      render();
    }).catch(function () { /* offline: the pill just says Signed in */ });
  }

  // ── the pill ──
  function drawPill() {
    var pill = opts.pill && document.querySelector(opts.pill);
    if (!pill) return;
    var dot = pill.querySelector('.sync-dot'), title = pill.querySelector('.sync-title'), sub = pill.querySelector('.sync-sub');
    var w = who();
    sub.classList.remove('sync-who');
    if (DEMO) { dot.dataset.tone = 'idle'; title.textContent = 'Demo mode'; sub.textContent = 'Nothing leaves this browser'; pill.title = 'Demo mode'; return; }
    if (!w.token) { dot.dataset.tone = 'idle'; title.textContent = 'Not signed in'; sub.textContent = 'Click to sign in'; pill.title = 'Sign in to GitHub for the Signoff suite'; return; }
    dot.dataset.tone = 'ok';
    title.textContent = 'Signed in';
    if (w.login) { sub.textContent = '@' + w.login; sub.classList.add('sync-who'); } else { sub.textContent = 'GitHub'; lookUp(w); }
    pill.title = 'Signed in to GitHub' + (w.login ? ' as @' + w.login : '') + (w.fte ? ' (FTE)' : '') + '. Click for settings';
  }

  function drawPeople() {
    var b = opts.people && document.querySelector(opts.people);
    if (b) b.hidden = !who().fte;
  }

  function drawTools() {
    var tools = opts.tools && document.querySelector(opts.tools);
    if (!tools) return;
    var w = who();
    // In the demo every tool's demo is open to all, except the FTE-only ones.
    tools.querySelectorAll('[data-signed]').forEach(function (a) { a.hidden = a.hasAttribute('data-internal') ? !w.fte : !(w.token || DEMO); });
    tools.querySelectorAll('[data-internal]:not([data-signed])').forEach(function (a) { a.hidden = !w.fte; });
    if (!tools.dataset.fold) fold(tools);
  }

  function render() { drawPill(); drawPeople(); drawTools(); }

  // ── the tools fold: a copy of the engine's setupToolsFold (ee_design_review/assets/app.js) ──
  var TOOLS_FOLD_MS = 10000;
  function fold(tools) {
    var head = tools.querySelector('.side-head');
    if (!head || tools.dataset.fold) return;
    tools.dataset.fold = '1';
    var label = head.textContent.trim() || 'Dovetail Signoff';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'side-tools-toggle';
    btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>' +
      '<span class="side-label">' + esc(label) + '</span>';
    head.textContent = '';
    head.appendChild(btn);
    var timer = null;
    function inUse() { return tools.matches(':hover') || !!tools.querySelector(':focus-visible'); }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }
    function arm() { stop(); if (!tools.classList.contains('folded') && !inUse()) timer = setTimeout(function () { set(true); }, TOOLS_FOLD_MS); }
    function set(folded) {
      tools.classList.toggle('folded', folded);
      var tip = (folded ? 'Show ' : 'Hide ') + label + ' tools';
      btn.setAttribute('aria-expanded', String(!folded));
      btn.title = tip; btn.setAttribute('aria-label', tip);
      if (folded) stop(); else arm();
    }
    btn.addEventListener('click', function () { set(!tools.classList.contains('folded')); });
    tools.addEventListener('mouseenter', stop);
    tools.addEventListener('mouseleave', function () { setTimeout(arm, 0); });
    tools.addEventListener('focusin', function () { if (inUse()) stop(); });
    tools.addEventListener('focusout', function () { setTimeout(arm, 0); });
    set(true);
  }

  // ── the Settings sheet ──
  var wrap = null;
  function close() { if (wrap) { wrap.remove(); wrap = null; document.removeEventListener('keydown', onKey); } }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function tokenFields(remember) {
    return '<details class="guide"><summary>New to GitHub? Set up in four steps</summary><ol>' +
      '<li>Create a free account at <a href="https://github.com/signup" target="_blank" rel="noopener">github.com/signup</a>.</li>' +
      '<li>Send your username to your Dovetail contact.</li>' +
      '<li><a href="https://github.com/settings/tokens/new?scopes=repo&amp;description=Dovetail%20Signoff" target="_blank" rel="noopener">Create a token</a> (the link fills in the settings; pick an expiry and click <i>Generate token</i>).</li>' +
      '<li>Paste the token below and click <b>Save</b>. Signoff EE shows any invitations waiting for you, with an Accept button.</li></ol></details>' +
      '<div class="field"><label for="sf-token">Access token</label><input class="input" id="sf-token" type="password" placeholder="ghp_… or github_pat_…" autocomplete="off" spellcheck="false">' +
      '<p class="note">Kept in this browser and sent only to api.github.com. Every Signoff tool here shares it. Collaborators use a classic token with the <b>repo</b> scope.</p></div>' +
      '<label class="check"><input type="checkbox" id="sf-remember"' + (remember ? ' checked' : '') + '> Remember the token after closing the browser (avoid on shared computers)</label>';
  }

  function settings() {
    close();
    var w = who(), A = auth();
    var hasTheme = typeof opts.theme === 'function' && typeof opts.setTheme === 'function';
    var theme = hasTheme ? opts.theme() : '';
    var access = '';
    if (DEMO) access = '<p class="note">GitHub is off in demo mode. <a href="' + esc(location.pathname) + '">Open the full tool</a>.</p>';
    else {
      access = '<div class="field-label" style="margin-top:20px;font-size:13px;color:var(--text);font-weight:600">Signoff Repository Access</div>';
      if (w.token) {
        access += '<p class="note" style="margin:0 0 12px">Signed in ' + (w.signedIn ? 'with GitHub ' : 'with a token ') + (w.login ? 'as <b>@' + esc(w.login) + '</b>' : '') +
          ' · ' + (w.fte ? 'FTE: you see every review' : json('signoff.v1.dataAccess', '') === 'none' && !!w.login ? 'Client or contractor: you see what’s shared with you' : 'open Signoff EE and sync to check your access') + '</p>';
      } else if (w.available) {
        access += '<div class="signin-row"><button type="button" class="btn btn-primary" data-sf="signin">Sign in with GitHub</button>' +
          '<button type="button" class="btn token-toggle" data-sf="token" aria-expanded="false" aria-controls="sf-token-panel">Use a token instead</button></div>' +
          '<p class="note" style="margin:0 0 12px">Uses your GitHub login, with its two-factor step. No token to create or keep track of.</p>' +
          '<div class="token-panel" id="sf-token-panel" hidden>' + tokenFields(true) + '</div>';
      } else access += tokenFields(true);
      access += '<div class="log" id="sf-log" hidden></div>';
    }
    var canSave = !DEMO && !w.token;
    wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sf-title"><div class="sheet-head"><h2 id="sf-title">Settings</h2>' +
      (opts.intro ? '<p>' + esc(opts.intro) + '</p>' : '') + '</div><div class="sheet-body">' +
      (hasTheme ? '<div class="field"><span class="field-label">Appearance</span><div class="seg full" id="sf-theme">' + [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(function (t) {
        return '<button type="button" class="' + (theme === t[0] ? 'on' : '') + '" data-theme="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div></div>' : '') +
      access + '</div><div class="sheet-foot">' +
      (!DEMO && w.token ? '<button type="button" class="btn" data-sf="signout" title="' + (w.signedIn ? 'Sign out of GitHub here, and remove' : 'Remove the token and') + ' every Signoff and Fabcheck copy kept in this browser">Sign out</button>' : '') +
      '<span class="spacer"></span><button type="button" class="btn" data-sf="close">' + (canSave ? 'Cancel' : 'Done') + '</button>' +
      (canSave ? '<button type="button" class="btn btn-primary" data-sf="save">Save</button>' : '') + '</div></div>';
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey);
    var root = wrap;
    function log(text, cls) { var l = root.querySelector('#sf-log'); if (!l) return; l.hidden = false; l.innerHTML += '<div class="' + (cls || '') + '">' + esc(text) + '</div>'; }
    root.addEventListener('click', function (e) {
      if (e.target === root) return close();
      var t = e.target.closest('#sf-theme [data-theme]');
      if (t) {
        root.querySelectorAll('#sf-theme button').forEach(function (b) { b.classList.toggle('on', b === t); });
        opts.setTheme(t.dataset.theme);
        return;
      }
      var b = e.target.closest('[data-sf]');
      if (!b) return;
      var act = b.dataset.sf;
      if (act === 'close') return close();
      if (act === 'signout') return signOut();
      if (act === 'token') {
        var panel = root.querySelector('#sf-token-panel'), opening = panel.hidden;
        panel.hidden = !opening; b.setAttribute('aria-expanded', String(opening));
        if (opening) root.querySelector('#sf-token').focus();
        return;
      }
      if (act === 'signin') {
        b.disabled = true;
        A.signIn(location.href).catch(function (err) { b.disabled = false; log(err.message, 'err'); });
        return;
      }
      if (act === 'save') {
        var field = root.querySelector('#sf-token'), tok = cleanToken(field && field.value);
        var panel2 = root.querySelector('#sf-token-panel');
        if (!tok) { if (panel2 && panel2.hidden) return close(); log('Paste a token first.', 'err'); return; }
        b.disabled = true;
        log('Checking your token…');
        fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json' } })
          .then(function (r) { if (!r.ok) throw new Error(r.status === 401 ? 'GitHub didn’t accept that token (mistyped, expired, or revoked?).' : 'GitHub said ' + r.status + '.'); return r.json(); })
          .then(function (u) {
            var remember = root.querySelector('#sf-remember').checked;
            try {
              sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY);
              (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, tok);
              localStorage.setItem(WHO_KEY, JSON.stringify({ tag: tokenTag(tok), login: u.login }));
            } catch (e) { /* storage blocked */ }
            close(); render();
            if (opts.changed) opts.changed();
          })
          .catch(function (err) { b.disabled = false; log(err.message, 'err'); });
      }
    });
    var first = root.querySelector('#sf-token-panel') ? null : root.querySelector('#sf-token');
    if (first) first.focus();
  }

  // Sign out of this browser, as Signoff EE's Sign out does: the token, the sign-in, and every copy
  // the suite keeps here. Only the theme stays. Unsynced changes are counted first.
  function signOut() {
    var unsynced = 0;
    SUITE_NS.forEach(function (ns) {
      try { unsynced += Object.keys(JSON.parse(localStorage.getItem(ns + 'dirty') || '{}') || {}).length; } catch (e) { /* unreadable */ }
    });
    try { unsynced += Object.keys((JSON.parse(localStorage.getItem('signoff.v1.held') || '{}') || {}).projects || {}).length; } catch (e) { /* ignore */ }
    var ask = 'Sign out of this browser? This removes your GitHub sign-in and every Signoff and Fabcheck copy kept here. Your reviews stay on GitHub.';
    if (unsynced) ask = unsynced + (unsynced === 1 ? ' review or list has' : ' reviews or lists have') + ' changes that aren’t on GitHub yet and would be lost. Sync them in their tool first unless you mean to throw them away.\n\n' + ask;
    if (!confirm(ask)) return;
    var theme = (json(SETTINGS_KEY, {}) || {}).theme;
    var A = auth();
    (A ? A.signOut() : Promise.resolve()).catch(function () { /* cleared below anyway */ }).then(function () {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
        Object.keys(localStorage).forEach(function (k) {
          if (k === TOKEN_KEY || k === WHO_KEY || k === 'signoff.login' || k.indexOf('signoff.auth') === 0 || SUITE_NS.some(function (ns) { return k.indexOf(ns) === 0; })) localStorage.removeItem(k);
        });
        if (theme) localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: theme }));
      } catch (e) { /* storage blocked */ }
      try { SUITE_DBS.forEach(function (db) { indexedDB.deleteDatabase(db); }); } catch (e) { /* no IndexedDB */ }
      location.reload();
    });
  }

  function mount(o) {
    opts = o || {};
    var pill = opts.pill && document.querySelector(opts.pill);
    if (pill) pill.addEventListener('click', settings);
    if (opts.settings) document.querySelectorAll(opts.settings).forEach(function (b) { b.addEventListener('click', settings); });
    render();
    // Another tab signed in or out, synced in Signoff EE, or set the theme.
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key === TOKEN_KEY || e.key === 'signoff.login' || e.key === WHO_KEY || e.key === SETTINGS_KEY || e.key === 'signoff.v1.dataAccess') {
        render();   // the tool itself follows a sign-in made in another tab, as it always has
      }
    });
  }

  window.SignoffFoot = { mount: mount, settings: settings, who: who, fold: fold, signOut: signOut, render: render, tokenTag: tokenTag };
})();
