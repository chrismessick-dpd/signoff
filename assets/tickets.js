/* Tickets, one list for the whole suite (Chris, 2026-11-12).
   A lightweight way for an FTE to tell the developer something is wrong: Open ticket… in a tool's ⋯
   menu opens a panel on the right (a title, what happened, pictures pasted or dropped, and where you
   were, filled in by itself), and Tickets in the same menu opens one sheet over the page with every
   ticket, its state, who it's assigned to, and its discussion. There's no sidebar link (Chris,
   2026-11-12: the ⋯ menu does it all).

   Loaded with a plain script tag from ../signoff/assets/ (the CSP forbids inline scripts), before the
   tool's app.js, by the hub, Signoff EE, ME, FW, and PL, Fabcheck, Loom, Partcheck, and Flasher. It
   loads tickets.css beside itself. Everything is in signoff/docs/tickets.md.

   Who: FTEs only. A page shows Tickets to whoever it shows People & access (#people-link, FTEs in
   every tool). Never in ?demo.

   Where: the private repo chrismessick-dpd/signoff_tickets, one file per ticket,
   tickets/<number>-<id>.json, and its pictures in images/<id>/. Every write is one commit made with the
   Git Data API against the head it read (never forced), retried on a race by re-reading the ticket and
   applying the same change again, so two people never overwrite each other.

   Hosts:
     - A ⋯ button at the end of #toolbar, unless #toolbar has data-tickets-own: then the tool's own ⋯
       menu offers Open ticket… and Tickets (SignoffTickets.can(), .newTicket(), .open()).
     - Any element with data-tickets-open opens the sheet; ?page=tickets (&ticket=<n>) opens it on load.
     - SignoffTickets.where(fn): fn() returns { unit, view, item, itemLabel } for the page you're on,
       added to a new ticket's place (the toolbar's title and tab are read without it). */
(function () {
  'use strict';
  if (window.SignoffTickets) return;

  var OWNER = 'chrismessick-dpd', REPO = 'signoff_tickets', BRANCH = 'main', API = 'https://api.github.com';
  var DEMO = /[?&]demo\b/.test(location.search) || location.hash === '#demo';
  var DEVELOPER = DEMO ? 'developer' : 'chrismessick-dpd';   // a new ticket goes here unless the reporter picks another
  var EMBEDDED = /[?&]embed=1\b/.test(location.search) && window.parent !== window;
  var DEMO_KEY = 'signoff.demo.tickets';
  var CACHE_KEY = 'signoff.v1.tickets';   // under signoff.v1., so Sign out clears it with the rest
  var MAX_IMAGES = 8, MAX_SIDE = 1920, MAX_BYTES = 2.5e6;

  var STATES = [
    { id: 'open', label: 'Open', tip: 'Waiting for the developer' },
    { id: 'progress', label: 'In progress', tip: 'The developer is on it' },
    { id: 'fixed', label: 'Fixed', tip: 'Fixed: the reporter checks and closes it, or reopens it' },
    { id: 'closed', label: 'Closed', tip: 'Done, or won’t be done (the discussion says why)' }
  ];
  var TOOL_NAMES = {
    signoff: 'Hub', ee_design_review: 'Signoff EE', me_design_review: 'Signoff ME', fw_design_review: 'Signoff FW',
    signoff_pl: 'Signoff PL', pcb_dfm: 'Fabcheck', loom: 'Loom', partcheck: 'Partcheck', flasher: 'Flasher', pincheck: 'Pincheck'
  };

  var ICON = {
    ticket: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 6.5v1.8a1.9 1.9 0 0 0 0 3.4v1.8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 13.5v-1.8a1.9 1.9 0 0 0 0-3.4z"/><path d="M12.5 5.5v9" stroke-dasharray="1.6 1.8"/></svg>',
    more: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="5" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    image: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.4"/><path d="M4 14l4-4 3 3 2-2 3 3"/></svg>',
    bubble: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h12v8H9l-3.5 3v-3H4z"/></svg>',
    refresh: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 8A6 6 0 0 0 4.6 6.5M4.5 12a6 6 0 0 0 10.9 1.5"/><path d="M4.3 3.5v3.2h3.2M15.7 16.5v-3.2h-3.2"/></svg>',
    plus: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 4.5v11M4.5 10h11"/></svg>',
    // State marks differ by shape, not only color (Chris is colorblind).
    open: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="5"/></svg>',
    progress: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="5"/><path d="M7 2a5 5 0 0 1 0 10z" fill="currentColor" stroke="none"/></svg>',
    fixed: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5.2"/><path d="M4.6 7.2l1.7 1.7 3.2-3.4"/></svg>',
    closed: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.8" fill="currentColor"/><path d="M4.9 4.9l4.2 4.2M9.1 4.9l-4.2 4.2" stroke="var(--bg-elev)" stroke-width="1.5" stroke-linecap="round"/></svg>'
  };

  // ── small helpers ──
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function get(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function json(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  function rid(n) { var s = ''; var a = new Uint8Array(n || 8); crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[a[i] % 32]; return s; }
  function now() { return new Date().toISOString(); }
  function stateOf(id) { return STATES.filter(function (s) { return s.id === id; })[0] || STATES[0]; }
  function pad(n) { return ('0000' + n).slice(-4); }
  function relTime(iso) {
    var t = Date.parse(iso); if (!t) return '';
    var s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago';
    return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fullTime(iso) { var t = Date.parse(iso); return t ? new Date(t).toLocaleString() : ''; }
  function hue(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function avatar(login) { return '<div class="avatar" style="background:hsl(' + hue(login) + ' 45% 42%)">' + esc(String(login || '?').slice(0, 2).toUpperCase()) + '</div>'; }
  function folder() { var m = location.pathname.match(/\/([^/]+)\/(?:index\.html)?$/); return m ? m[1] : ''; }
  function toolName(id) { return TOOL_NAMES[id] || id || 'Signoff'; }

  // ── who ──
  function rawToken() { return get(sessionStorage, 'signoff.token') || get(localStorage, 'signoff.token') || ''; }
  function token() {
    var t = rawToken(), A = window.SignoffAuth;
    return A && A.owns && A.owns(t) ? A.token() : Promise.resolve(t);
  }
  var loginLooked = '';
  function me() {
    if (DEMO) return 'you';
    var A = window.SignoffAuth, st = A && A.status ? A.status() : {};
    var s = json('signoff.v1.settings', {}) || {}, w = json('signoff.who', {}) || {};
    return (st.login || s.login || w.login || loginLooked || '').toLowerCase();
  }
  function lookUpLogin() {
    if (DEMO || me()) return Promise.resolve(me());
    return gh('GET', '/user').then(function (u) { loginLooked = (u && u.login || '').toLowerCase(); return loginLooked; });
  }
  // Shown to whoever the page shows People & access (FTEs). Never in the public ?demo (Chris,
  // 2026-11-12). The demo store below is kept for UI work: let DEMO through here to try it locally.
  function can() {
    if (EMBEDDED || DEMO) return false;
    var p = document.getElementById('people-link');
    return !!(p && !p.hidden && rawToken());
  }

  // ── GitHub ──
  function gh(method, path, body, retried) {
    return token().then(function (t) {
      if (!t) throw new Error('Sign in to GitHub first (Settings).');
      return fetch(API + path, {
        method: method,
        headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      }).then(function (r) {
        var A = window.SignoffAuth;
        if (r.status === 401 && !retried && A && A.owns && A.owns(t)) return A.refresh(t).then(function () { return gh(method, path, body, true); });
        if (r.ok) return r.status === 204 ? null : r.json();
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(r.status === 404 ? 'Can’t reach the tickets repo (' + OWNER + '/' + REPO + '). Ask Chris to add you to it.' : (j.message || ('GitHub said ' + r.status)));
          e.status = r.status;
          throw e;
        });
      });
    });
  }
  function repo(p) { return '/repos/' + OWNER + '/' + REPO + p; }
  function b64ToBytes(b64) { var bin = atob(String(b64).replace(/\s/g, '')), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function bytesToB64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }

  // The head, and every ticket file and picture in it: { commit, tree, files: { path: sha } }.
  function head() {
    return gh('GET', repo('/git/ref/heads/' + BRANCH)).then(function (ref) {
      var commit = ref.object.sha;
      return gh('GET', repo('/git/commits/' + commit)).then(function (c) {
        return gh('GET', repo('/git/trees/' + c.tree.sha + '?recursive=1')).then(function (t) {
          var files = {};
          (t.tree || []).forEach(function (e) { if (e.type === 'blob') files[e.path] = e.sha; });
          return { commit: commit, tree: c.tree.sha, files: files };
        });
      });
    });
  }
  var cache = null;   // { login, blobs: { sha: ticket } }
  function cacheFor() {
    var who = me();
    if (!cache) cache = json(CACHE_KEY, null);
    if (!cache || cache.login !== who) cache = { login: who, blobs: {} };
    return cache;
  }
  function readTicket(sha) {
    var c = cacheFor();
    if (c.blobs[sha]) return Promise.resolve(JSON.parse(JSON.stringify(c.blobs[sha])));
    return gh('GET', repo('/git/blobs/' + sha)).then(function (b) {
      var t = JSON.parse(new TextDecoder().decode(b64ToBytes(b.content)));
      c.blobs[sha] = t;
      return JSON.parse(JSON.stringify(t));
    });
  }
  function ticketPaths(files) { return Object.keys(files).filter(function (p) { return /^tickets\/\d+-[a-z0-9]+\.json$/.test(p); }); }
  function pathOf(files, id) { return ticketPaths(files).filter(function (p) { return p.slice(-(id.length + 6)) === '-' + id + '.json'; })[0] || ''; }

  var lastFiles = {}, lastCommit = '';
  function loadAll() {
    return head().then(function (h) {
      lastFiles = h.files; lastCommit = h.commit;
      var paths = ticketPaths(h.files), out = [], i = 0;
      // A few at a time, so a long list doesn't burst GitHub's rate limit.
      function next() {
        if (i >= paths.length) return Promise.resolve();
        var p = paths[i++];
        return readTicket(h.files[p]).then(function (t) { out.push(t); return next(); });
      }
      return Promise.all([next(), next(), next(), next()]).then(function () {
        var c = cacheFor(), live = {};
        paths.forEach(function (p) { live[h.files[p]] = c.blobs[h.files[p]]; });
        c.blobs = live;   // forget versions no longer at the head
        put(CACHE_KEY, c);
        return out;
      });
    });
  }

  // One commit: changes = [{ path, text } | { path, base64 }] against the head h; rejects with
  // .race when someone else committed first.
  function commit(h, changes, message) {
    return Promise.all(changes.map(function (c) {
      if (c.sha) return Promise.resolve({ path: c.path, mode: '100644', type: 'blob', sha: c.sha });
      var body = c.base64 != null ? { content: c.base64, encoding: 'base64' } : { content: c.text, encoding: 'utf-8' };
      return gh('POST', repo('/git/blobs'), body).then(function (b) { c.sha = b.sha; return { path: c.path, mode: '100644', type: 'blob', sha: b.sha }; });
    })).then(function (entries) {
      return gh('POST', repo('/git/trees'), { base_tree: h.tree, tree: entries });
    }).then(function (tree) {
      return gh('POST', repo('/git/commits'), { message: message, tree: tree.sha, parents: [h.commit] });
    }).then(function (c) {
      return gh('PATCH', repo('/git/refs/heads/' + BRANCH), { sha: c.sha, force: false }).catch(function (e) {
        if (e.status === 422 || e.status === 409) e.race = true;
        throw e;
      });
    });
  }
  function serialize(t) { return JSON.stringify(t, null, 2) + '\n'; }

  // Pictures go up once as blobs; a retry reuses their shas.
  function imageChanges(id, imgs) {
    return imgs.map(function (im) { return { path: 'images/' + id + '/' + im.id + '.' + im.ext, base64: im.base64 }; });
  }
  function imageMeta(id, imgs) {
    return imgs.map(function (im) { return { id: im.id, file: 'images/' + id + '/' + im.id + '.' + im.ext, type: im.type, w: im.w, h: im.h, name: im.name || '' }; });
  }

  function createRemote(t, imgs) {
    var pics = imageChanges(t.id, imgs), tries = 0;
    function attempt() {
      return head().then(function (h) {
        var n = ticketPaths(h.files).reduce(function (m, p) { return Math.max(m, parseInt(p.slice(8), 10) || 0); }, 0) + 1;
        t.n = n;
        var path = 'tickets/' + pad(n) + '-' + t.id + '.json';
        return commit(h, pics.concat([{ path: path, text: serialize(t) }]), 'Ticket #' + n + ': ' + t.title).then(function () { return t; });
      }).catch(function (e) { if (e.race && ++tries < 5) return attempt(); throw e; });
    }
    return attempt();
  }
  // Re-reads the ticket at the head, applies change(t), and commits; again from the top on a race.
  function updateRemote(id, change, imgs, message) {
    var pics = imageChanges(id, imgs || []), tries = 0;
    function attempt() {
      return head().then(function (h) {
        var path = pathOf(h.files, id);
        if (!path) throw new Error('That ticket isn’t in the tickets repo any more.');
        return readTicket(h.files[path]).then(function (t) {
          change(t);
          t.updated = now();
          return commit(h, pics.concat([{ path: path, text: serialize(t) }]), message.replace('#?', '#' + t.n)).then(function () { return t; });
        });
      }).catch(function (e) { if (e.race && ++tries < 5) return attempt(); throw e; });
    }
    return attempt();
  }

  var imageUrls = {};   // file -> object URL (or data URL in the demo)
  function imageUrl(t, im) {
    if (DEMO) return Promise.resolve(im.data || '');
    if (imageUrls[im.file]) return Promise.resolve(imageUrls[im.file]);
    var sha = lastFiles[im.file];
    var shaP = sha ? Promise.resolve(sha) : head().then(function (h) { lastFiles = h.files; return h.files[im.file]; });
    return shaP.then(function (s) {
      if (!s) throw new Error('missing picture');
      return gh('GET', repo('/git/blobs/' + s));
    }).then(function (b) {
      var url = URL.createObjectURL(new Blob([b64ToBytes(b.content)], { type: im.type || 'image/png' }));
      imageUrls[im.file] = url;
      return url;
    });
  }

  // ── the demo store: made-up tickets in this browser ──
  function demoSeed() {
    var d = function (days) { return new Date(Date.now() - days * 86400000).toISOString(); };
    return [
      { v: 1, id: 'demo0001', n: 1, title: 'Report button prints the sidebar too', body: 'Review report → Print on the Main PCBA. The printed pages start with the sidebar and the tool icons.', state: 'fixed', assignee: 'developer', reporter: 'you', created: d(9), updated: d(2),
        where: { tool: 'ee_design_review', unit: 'Main PCBA', view: 'Overview', url: '/ee_design_review/index.html?demo' }, images: [],
        log: [{ id: 'l1', kind: 'state', at: d(5), by: 'developer', from: 'open', to: 'progress' }, { id: 'l2', kind: 'comment', at: d(2), by: 'developer', text: 'The print styles hide the sidebar now. Can you try again?' }, { id: 'l3', kind: 'state', at: d(2), by: 'developer', from: 'progress', to: 'fixed' }] },
      { v: 1, id: 'demo0002', n: 2, title: 'Exploded view jumps when I turn the bracket', body: 'In Signoff PL, Structure › Exploded, turning the Wall Bracket makes the whole view jump to the side.', state: 'progress', assignee: 'developer', reporter: 'morgan', created: d(4), updated: d(1),
        where: { tool: 'signoff_pl', unit: 'Smart Thermostat', view: 'Structure', url: '/signoff_pl/index.html?demo' }, images: [],
        log: [{ id: 'l4', kind: 'state', at: d(1), by: 'developer', from: 'open', to: 'progress' }] },
      { v: 1, id: 'demo0003', n: 3, title: 'Wire colors list should start with the common ones', body: 'Picking a wire color in Loom means scrolling past colors nobody uses. Put black, red, white, and green first?', state: 'open', assignee: 'developer', reporter: 'you', created: d(1), updated: d(1),
        where: { tool: 'loom', unit: 'Zone Controller', view: 'Build', url: '/loom/index.html?demo' }, images: [], log: [] }
    ];
  }
  function demoAll() { var a = json(DEMO_KEY, null); if (!a) { a = demoSeed(); put(DEMO_KEY, a); } return a; }
  function demoSave(list) { put(DEMO_KEY, list); }

  // ── the store, either way ──
  var tickets = [], loaded = false, loading = null, people = [];
  function load() {
    if (DEMO) { tickets = demoAll(); loaded = true; return Promise.resolve(tickets); }
    if (loading) return loading;
    loading = lookUpLogin().then(loadAll).then(function (list) {
      tickets = list; loaded = true; loading = null; return list;
    }, function (e) { loading = null; throw e; });
    return loading;
  }
  function loadPeople() {
    var base = [DEVELOPER, me()];
    tickets.forEach(function (t) { base.push(t.assignee, t.reporter); });
    var known = function () { people = base.filter(function (x, i) { return x && base.indexOf(x) === i; }).sort(); };
    known();
    if (DEMO) { base.push('developer', 'morgan'); known(); return Promise.resolve(people); }
    return gh('GET', repo('/collaborators?per_page=100')).then(function (list) {
      (list || []).forEach(function (u) { base.push(String(u.login).toLowerCase()); });
      known();
      return people;
    }, function () { return people; });
  }
  // Assign to: the developer, then you, then everyone else we know of (the tickets repo's
  // collaborators and anyone already on a ticket), then Someone else…, which takes any GitHub name.
  var OTHER = '__other';
  function personLabel(p) {
    var tags = [];
    if (p === DEVELOPER) tags.push('developer');
    if (p === me()) tags.push('you');
    return '@' + esc(p) + (tags.length ? ' (' + tags.join(', ') + ')' : '');
  }
  function assigneeOptions(cur) {
    var who = me(), list = [DEVELOPER];
    if (who && list.indexOf(who) < 0) list.push(who);
    people.slice().sort().forEach(function (p) { if (p && list.indexOf(p) < 0) list.push(p); });
    if (cur && list.indexOf(cur) < 0) list.push(cur);
    return list.map(function (p) { return '<option value="' + esc(p) + '"' + (p === cur ? ' selected' : '') + '>' + personLabel(p) + '</option>'; }).join('') +
      '<option value="' + OTHER + '">Someone else (a GitHub name)…</option>';
  }
  function assigneeField(id, cur, label) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '" class="input tk-assignee">' + assigneeOptions(cur) + '</select>' +
      '<input class="input tk-other" type="text" placeholder="@github-name, then Enter" autocomplete="off" spellcheck="false" aria-label="GitHub name to assign" hidden></div>';
  }
  // A typed name, checked with GitHub: resolves the login as GitHub spells it, lowercased.
  function checkLogin(raw) {
    var login = String(raw || '').trim().replace(/^@/, '');
    if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(login)) return Promise.reject(new Error('That isn’t a GitHub name'));
    login = login.toLowerCase();
    if (DEMO) return Promise.resolve(login);
    return gh('GET', '/users/' + encodeURIComponent(login)).then(function (u) { return String(u.login).toLowerCase(); }, function (e) {
      throw new Error(e.status === 404 ? 'There’s no GitHub account @' + login : (e.message || 'GitHub couldn’t check that name'));
    });
  }
  // Someone not on the tickets repo can't see the ticket until Chris adds them.
  function warnIfOutside(login) {
    if (!DEMO && people.indexOf(login) < 0) toast('@' + login + ' isn’t on the tickets repo yet, so they can’t see it until they’re added.');
  }
  function remember(login) { if (people.indexOf(login) < 0) people.push(login); }
  // Wires one picker: Someone else… shows the name box; done(login) gets the choice.
  function wireAssignee(field, done, revert) {
    var sel = $('.tk-assignee', field), other = $('.tk-other', field);
    sel.addEventListener('change', function () {
      if (sel.value === OTHER) { other.hidden = false; other.value = ''; other.focus(); return; }
      other.hidden = true;
      done(sel.value);
    });
    function commitOther() {
      var v = other.value.trim();
      if (!v) { other.hidden = true; revert(); return; }
      other.disabled = true;
      checkLogin(v).then(function (login) {
        other.disabled = false; other.hidden = true;
        warnIfOutside(login);
        remember(login);
        sel.innerHTML = assigneeOptions(login);
        done(login);
      }, function (e) { other.disabled = false; toast(e.message); other.focus(); other.select(); });
    }
    other.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitOther(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); other.hidden = true; revert(); }
    });
    other.addEventListener('blur', function () { if (!other.hidden && !other.disabled && other.value.trim()) commitOther(); });
  }

  function replace(t) {
    var i = tickets.map(function (x) { return x.id; }).indexOf(t.id);
    if (i < 0) tickets.push(t); else tickets[i] = t;
    if (DEMO) demoSave(tickets);
    drawUnseen();
  }

  // ── what's new on your tickets (Chris, 2026-11-13) ──
  // A ticket you reported counts as updated when someone else changed its state or commented since
  // you last opened it in the sheet. "Seen" is the id of the latest such log entry when you opened
  // it, kept per login in this browser (signoff.ticketsSeen, outside signoff.v1. so Sign out doesn't
  // light every old change up again). The first time a login is seen here, everything so far counts
  // as seen. Ids, not times, so nobody's clock matters.
  var SEEN_KEY = DEMO ? 'signoff.demo.ticketsSeen' : 'signoff.ticketsSeen';
  function lastNews(t, who) {
    var log = t.log || [], i;
    for (i = log.length - 1; i >= 0; i--) {
      var e = log[i];
      if ((e.kind === 'state' || e.kind === 'comment') && e.by && e.by !== who) return e.id;
    }
    return '';
  }
  function unseenOf(list, who, seen) {
    if (!who || !seen) return [];
    return list.filter(function (t) {
      if (t.reporter !== who) return false;
      var news = lastNews(t, who);
      return !!news && seen[t.id] !== news;
    });
  }
  function seenFor(who) {
    var all = json(SEEN_KEY, {}) || {};
    return all[who] || null;
  }
  function saveSeen(who, seen) {
    var all = json(SEEN_KEY, {}) || {};
    all[who] = seen;
    put(SEEN_KEY, all);
  }
  // Called after every load: a login's first one marks everything so far as seen.
  function baseline() {
    var who = me();
    if (!who || seenFor(who)) return;
    var seen = {};
    tickets.forEach(function (t) { if (t.reporter === who) seen[t.id] = lastNews(t, who); });
    saveSeen(who, seen);
  }
  function markSeen(t) {
    var who = me();
    if (!who || t.reporter !== who) return;
    var news = lastNews(t, who), seen = seenFor(who) || {};
    if (!news || seen[t.id] === news) return;
    seen[t.id] = news;
    saveSeen(who, seen);
    drawUnseen();
  }
  function unseen() { return loaded && can() ? unseenOf(tickets, me(), seenFor(me())) : []; }

  // The count rides on #toolbar as a CSS variable, so it survives the tools redrawing their ⋯ button
  // (EE, ME, FW, and PL rebuild #toolbar-actions on every render); tickets.css draws it on the button.
  var unseenCount = 0, unseenKey = '';
  function drawUnseen() {
    var news = unseen(), n = news.length, bar = document.getElementById('toolbar');
    var key = news.map(function (t) { return t.id; }).join(',');
    unseenCount = n;
    if (bar) {
      if (n) { bar.setAttribute('data-tk-unseen', n); bar.style.setProperty('--tk-unseen', '"' + (n > 9 ? '9+' : n) + '"'); }
      else { bar.removeAttribute('data-tk-unseen'); bar.style.removeProperty('--tk-unseen'); }
      labelMore(bar);
    }
    var item = document.querySelector('#menu [data-menu="tickets"], #tk-menu [data-tk="list"]');
    if (item) countItem(item);
    // Redraw an open list only when the set changed: refresh() runs every 5 s, and a rebuilt list
    // under a click would lose it.
    if (wrap && key !== unseenKey) drawList();
    unseenKey = key;
  }
  function moreLabel() { return unseenCount ? 'More (' + unseenCount + ' of your tickets updated)' : 'More'; }
  function labelMore(bar) {
    bar.querySelectorAll('[data-act="project-menu"], #tk-more').forEach(function (b) {
      var l = moreLabel();
      if (b.getAttribute('aria-label') !== l) { b.setAttribute('aria-label', l); b.title = l; }
    });
  }
  function countItem(item) {
    var c = item.querySelector('.tk-menu-count');
    if (!unseenCount) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement('span'); c.className = 'tk-menu-count'; item.appendChild(c); }
    c.textContent = unseenCount;
    c.title = unseenCount + ' of your tickets updated';
  }

  // Checked in the background: soon after the page opens, every 5 minutes, and when the tab comes
  // back. Only the branch's ref is read unless it moved. Not while the sheet is open (it has Refresh).
  var lastCheck = 0, checking = false;
  function check(minAge) {
    if (checking || wrap || !can() || document.hidden) return;
    if (lastCheck && Date.now() - lastCheck < minAge) return;
    lastCheck = Date.now(); checking = true;
    var p = DEMO || !loaded ? load() : gh('GET', repo('/git/ref/heads/' + BRANCH)).then(function (ref) {
      return ref.object.sha === lastCommit ? tickets : load();   // the old list stands until the new one is in
    });
    p.then(function () { checking = false; baseline(); drawUnseen(); }, function () { checking = false; });
  }
  function create(t, imgs) {
    if (DEMO) {
      t.n = tickets.reduce(function (m, x) { return Math.max(m, x.n || 0); }, 0) + 1;
      t.images = imgs.map(function (im) { return { id: im.id, file: '', type: im.type, w: im.w, h: im.h, data: 'data:' + im.type + ';base64,' + im.base64 }; });
      replace(t);
      return Promise.resolve(t);
    }
    t.images = imageMeta(t.id, imgs);
    return createRemote(t, imgs).then(function (saved) {
      imgs.forEach(function (im) { imageUrls['images/' + t.id + '/' + im.id + '.' + im.ext] = im.url; });
      replace(saved);
      return saved;
    });
  }
  // change(t) must be safe to apply to a fresher copy of the ticket.
  function update(t, change, imgs, message) {
    if (DEMO) {
      var copy = JSON.parse(JSON.stringify(t));
      change(copy, (imgs || []).map(function (im) { return { id: im.id, file: '', type: im.type, w: im.w, h: im.h, data: 'data:' + im.type + ';base64,' + im.base64 }; }));
      copy.updated = now();
      replace(copy);
      return Promise.resolve(copy);
    }
    var meta = imageMeta(t.id, imgs || []);
    return updateRemote(t.id, function (x) { change(x, meta); }, imgs, message).then(function (saved) {
      (imgs || []).forEach(function (im) { imageUrls['images/' + t.id + '/' + im.id + '.' + im.ext] = im.url; });
      replace(saved);
      return saved;
    });
  }
  function logEntry(kind, o) { var e = { id: rid(6), kind: kind, at: now(), by: me() }; for (var k in o) e[k] = o[k]; return e; }
  function setState(t, to) {
    var from = t.state;
    if (from === to) return Promise.resolve(t);
    return update(t, function (x) { var was = x.state; if (was === to) return; x.state = to; x.log = (x.log || []).concat([logEntry('state', { from: was, to: to })]); }, null, 'Ticket #?: ' + stateOf(to).label);
  }
  function setAssignee(t, to) {
    return update(t, function (x) { var was = x.assignee || ''; if (was === to) return; x.assignee = to; x.log = (x.log || []).concat([logEntry('assign', { from: was, to: to })]); }, null, 'Ticket #?: assigned to @' + to);
  }
  function setTitle(t, to) {
    return update(t, function (x) { var was = x.title; if (was === to) return; x.title = to; x.log = (x.log || []).concat([logEntry('title', { from: was, to: to })]); }, null, 'Ticket #?: renamed');
  }
  function comment(t, text, imgs, reopen) {
    return update(t, function (x, meta) {
      var add = [logEntry('comment', { text: text, images: meta || [] })];
      if (reopen && x.state !== 'open') { add.push(logEntry('state', { from: x.state, to: 'open' })); x.state = 'open'; }
      x.log = (x.log || []).concat(add);
    }, imgs, 'Ticket #?: comment');
  }

  // ── pictures: pasted, dropped, or picked; scaled down and re-encoded before they go up ──
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) { reject(new Error('Only pictures can be attached.')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        // A screenshot stays sharp as PNG; a photo or a busy picture goes as JPEG.
        var png = c.toDataURL('image/png'), use = png, type = 'image/png', ext = 'png';
        if (png.length * 0.75 > 900000) { use = c.toDataURL('image/jpeg', 0.86); type = 'image/jpeg'; ext = 'jpg'; }
        var base64 = use.slice(use.indexOf(',') + 1);
        if (base64.length * 0.75 > MAX_BYTES) { reject(new Error('That picture is too large, even made smaller.')); return; }
        resolve({ id: rid(6), type: type, ext: ext, w: w, h: h, base64: base64, url: use, name: file.name || '' });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That picture couldn’t be read.')); };
      img.src = url;
    });
  }
  function filesFrom(list) { return Array.prototype.filter.call(list || [], function (f) { return f && /^image\//.test(f.type); }); }
  function clipboardImages(e) {
    var items = (e.clipboardData && e.clipboardData.items) || [], out = [];
    for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) out.push(items[i].getAsFile());
    return out;
  }

  // A tray of pictures waiting to go with a ticket or comment. el is its container.
  function Tray(el, onChange) {
    var pics = [];
    function draw() {
      el.innerHTML = pics.map(function (p, i) {
        return '<div class="tk-thumb"><img src="' + esc(p.url) + '" alt=""><button type="button" class="tk-thumb-x" data-i="' + i + '" title="Remove" aria-label="Remove picture">' + ICON.close + '</button></div>';
      }).join('');
      el.hidden = !pics.length;
      if (onChange) onChange(pics.length);
    }
    el.addEventListener('click', function (e) { var b = e.target.closest('.tk-thumb-x'); if (b) { pics.splice(+b.dataset.i, 1); draw(); } });
    return {
      add: function (files) {
        files = filesFrom(files);
        if (!files.length) return;
        if (pics.length + files.length > MAX_IMAGES) { toast('Up to ' + MAX_IMAGES + ' pictures at a time'); files = files.slice(0, Math.max(0, MAX_IMAGES - pics.length)); }
        Promise.all(files.map(function (f) { return readImage(f).catch(function (e) { toast(e.message); return null; }); }))
          .then(function (list) { list.forEach(function (p) { if (p) pics.push(p); }); draw(); });
      },
      list: function () { return pics.slice(); },
      clear: function () { pics = []; draw(); }
    };
  }
  function wireDrop(zone, tray) {
    zone.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); zone.classList.add('tk-drag'); } });
    zone.addEventListener('dragleave', function (e) { if (!zone.contains(e.relatedTarget)) zone.classList.remove('tk-drag'); });
    zone.addEventListener('drop', function (e) { zone.classList.remove('tk-drag'); if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); tray.add(e.dataTransfer.files); });
    zone.addEventListener('paste', function (e) { var f = clipboardImages(e); if (f.length) { e.preventDefault(); tray.add(f); } });
  }
  // Keys, pastes, and drops inside the ticket UI never reach the tool underneath (Fabcheck and
  // Partcheck load a package dropped anywhere, Loom pastes connectors, the review tools have single-key
  // shortcuts). Escape still goes up to our own handler on document. A drop nothing here took is
  // swallowed, so it can't open a package.
  function shield(el) {
    el.addEventListener('keydown', function (e) { if (e.key !== 'Escape') e.stopPropagation(); });
    ['keyup', 'keypress', 'paste', 'copy', 'cut'].forEach(function (k) { el.addEventListener(k, function (e) { e.stopPropagation(); }); });
    ['dragenter', 'dragover', 'drop'].forEach(function (k) {
      el.addEventListener(k, function (e) { e.stopPropagation(); if (k !== 'dragenter') e.preventDefault(); });
    });
  }
  function filePicker(tray) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.addEventListener('change', function () { tray.add(inp.files); inp.value = ''; });
    inp.click();
  }

  // ── toasts, our own (not every tool has a #toasts) ──
  function toast(text) {
    var box = document.getElementById('tk-toasts');
    if (!box) { box = document.createElement('div'); box.id = 'tk-toasts'; box.className = 'tk-toasts'; document.body.appendChild(box); }
    var t = document.createElement('div'); t.className = 'tk-toast'; t.textContent = text; box.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 3600);
  }

  // ── where you are ──
  var whereHook = null;
  function firstText(el) {
    if (!el) return '';
    for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim()) return el.childNodes[i].textContent.trim();
    return el.textContent.trim();
  }
  function where() {
    var w = { tool: folder(), url: location.pathname + location.search + location.hash };
    var title = $('#toolbar-title') || $('#toolbar .toolbar-title'), tab = $('#view-seg button.on');
    if (title && title.textContent.trim()) w.unit = title.textContent.trim();
    if (tab) w.view = firstText(tab);
    if (whereHook) { try { var x = whereHook() || {}; for (var k in x) if (x[k]) w[k] = String(x[k]); } catch (e) { /* the page's hook failed: keep what we have */ } }
    if (window.SIGNOFF_VERSION && window.SIGNOFF_VERSION.hash) w.version = window.SIGNOFF_VERSION.hash;
    return w;
  }
  function env() {
    var dark = document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark (system)' : 'light (system)');
    return { viewport: innerWidth + ' × ' + innerHeight, ua: navigator.userAgent, theme: dark };
  }
  function crumb(w) {
    return [toolName(w.tool), w.unit, w.view, w.itemLabel || w.item].filter(Boolean).map(esc).join(' › ');
  }

  // ── Open ticket: the panel on the right ──
  var newPanel = null;
  function newTicket(preset) {
    if (!can()) return;
    if (newPanel) { $('.tk-new-title', newPanel).focus(); return; }
    closeMenu();
    var w = where();
    newPanel = document.createElement('aside');
    newPanel.className = 'tk-panel tk-new';
    newPanel.setAttribute('role', 'dialog');
    newPanel.setAttribute('aria-label', 'Open a ticket');
    newPanel.innerHTML =
      '<div class="tk-panel-head"><div class="tk-crumb" title="Where you are now, sent with the ticket">' + crumb(w) + '</div>' +
      '<button type="button" class="icon-btn tk-x" title="Close (Esc)" aria-label="Close">' + ICON.close + '</button></div>' +
      '<div class="tk-panel-body">' +
      '<h2 class="tk-h">Open a ticket</h2>' +
      '<div class="hint"><b>For the developer</b>Something wrong, confusing, or missing? Say what you did, what you expected, and what happened. A screenshot helps most: paste it here with Ctrl+V.</div>' +
      '<div class="field"><label for="tk-new-title">Title</label><input id="tk-new-title" class="input tk-new-title" maxlength="160" placeholder="What went wrong, in a line" autocomplete="off"></div>' +
      '<div class="field"><label for="tk-new-body">What happened</label><textarea id="tk-new-body" class="input tk-new-body" rows="6" placeholder="I clicked…, I expected…, and instead…"></textarea></div>' +
      '<div class="field"><div class="field-label">Pictures</div>' +
      '<div class="tk-drop" tabindex="0">' + ICON.image + '<span>Paste a screenshot (Ctrl+V), drop pictures here, or <button type="button" class="tk-link tk-pick">choose files</button></span></div>' +
      '<div class="tk-tray" hidden></div></div>' +
      '<div class="tk-new-who-field">' + assigneeField('tk-new-who', DEVELOPER, 'Assign to') + '</div>' +
      '<div class="meta-line">Sent with it: this page’s address' + (w.version ? ', the tool version' : '') + ', your window size, and your browser.</div>' +
      '</div>' +
      '<div class="tk-panel-foot"><span class="tk-foot-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send</span>' +
      '<button type="button" class="btn tk-cancel">Cancel</button><button type="button" class="btn btn-primary tk-send">Open ticket</button></div>';
    document.body.appendChild(newPanel);
    requestAnimationFrame(function () { if (newPanel) newPanel.classList.add('open'); });
    var panel = newPanel;
    shield(panel);
    var tray = Tray($('.tk-tray', panel));
    wireDrop(panel, tray);
    var whoField = $('.tk-new-who-field', panel), sel = $('.tk-assignee', whoField), assignee = DEVELOPER;
    function fillPeople() { if (sel.value !== OTHER) sel.innerHTML = assigneeOptions(assignee); }
    wireAssignee(whoField, function (login) { assignee = login; }, function () { sel.innerHTML = assigneeOptions(assignee); });
    (loaded ? Promise.resolve() : load().catch(function () { /* filing still works */ })).then(loadPeople).then(function () { if (panel === newPanel) fillPeople(); });
    if (preset && preset.title) $('.tk-new-title', panel).value = preset.title;
    if (preset && preset.body) $('.tk-new-body', panel).value = preset.body;
    setTimeout(function () { var i = $('.tk-new-title', panel); if (i) i.focus(); }, 60);

    function send() {
      var title = $('.tk-new-title', panel).value.trim(), body = $('.tk-new-body', panel).value.trim();
      if (!title) { $('.tk-new-title', panel).focus(); toast('Give the ticket a title'); return; }
      if (sel.value === OTHER) { $('.tk-other', panel).focus(); toast('Type a GitHub name and press Enter, or pick someone'); return; }
      var btn = $('.tk-send', panel);
      btn.disabled = true; btn.textContent = 'Sending…';
      var reporter = me() || 'unknown';
      var t = { v: 1, id: rid(8), n: 0, title: title, body: body, state: 'open', assignee: assignee || DEVELOPER, reporter: reporter,
        created: now(), updated: now(), where: w, env: env(), images: [], log: [] };
      lookUpLogin().then(function (login) { t.reporter = login || reporter; return create(t, tray.list()); }).then(function (saved) {
        closeNew(true);
        toast('Ticket #' + saved.n + ' opened. Thanks!');
        if (wrap) { selected = saved.id; drawSheet(); }
      }, function (e) {
        btn.disabled = false; btn.textContent = 'Open ticket';
        toast(e.message || 'The ticket couldn’t be sent');
      });
    }
    panel.addEventListener('click', function (e) {
      if (e.target.closest('.tk-x') || e.target.closest('.tk-cancel')) closeNew();
      else if (e.target.closest('.tk-send')) send();
      else if (e.target.closest('.tk-pick')) filePicker(tray);
      else if (e.target.closest('.tk-drop') && !e.target.closest('button')) $('.tk-drop', panel).focus();
    });
    panel.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); }
    });
  }
  function closeNew(sent) {
    if (!newPanel) return;
    var p = newPanel;
    newPanel = null;
    if (!sent) {
      var t = $('.tk-new-title', p), b = $('.tk-new-body', p);
      if ((t && t.value.trim()) || (b && b.value.trim()) || $('.tk-thumb', p)) {
        if (!confirm('Throw this ticket away?')) { newPanel = p; return; }
      }
    }
    p.classList.remove('open');
    setTimeout(function () { p.remove(); }, 340);
  }

  // ── the Tickets sheet ──
  var wrap = null, selected = '', filter = 'active', mine = false, query = '', lastError = '';
  var FILTERS = [{ id: 'active', label: 'Active' }, { id: 'fixed', label: 'Fixed' }, { id: 'closed', label: 'Closed' }, { id: 'all', label: 'All' }];
  function filtered() {
    var who = me(), q = query.toLowerCase();
    return tickets.filter(function (t) {
      if (filter === 'active' && !(t.state === 'open' || t.state === 'progress')) return false;
      if (filter === 'fixed' && t.state !== 'fixed') return false;
      if (filter === 'closed' && t.state !== 'closed') return false;
      if (mine && t.assignee !== who && t.reporter !== who) return false;
      if (q && (t.title + ' ' + t.body + ' #' + t.n + ' ' + toolName(t.where && t.where.tool) + ' ' + t.assignee + ' ' + t.reporter).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.updated || '').localeCompare(a.updated || '') || b.n - a.n; });
  }
  function stateChip(s) { var st = stateOf(s); return '<span class="tk-state tk-s-' + st.id + '" title="' + esc(st.tip) + '">' + ICON[st.id] + esc(st.label) + '</span>'; }
  function comments(t) { return (t.log || []).filter(function (e) { return e.kind === 'comment'; }).length; }
  function pictures(t) { return (t.images || []).length + (t.log || []).reduce(function (n, e) { return n + ((e.images || []).length); }, 0); }

  function open(n) {
    if (EMBEDDED || !can()) return;
    closeMenu();
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'tk-wrap';
      wrap.innerHTML = '<div class="tk-pop" role="dialog" aria-modal="true" aria-label="Tickets">' +
        '<div class="tk-head"><h2>Tickets</h2>' +
        '<div class="seg tk-filter" role="tablist">' + FILTERS.map(function (f) { return '<button type="button" role="tab" data-f="' + f.id + '">' + f.label + '<span class="count"></span></button>'; }).join('') + '</div>' +
        '<label class="tk-mine"><input type="checkbox"> Mine</label>' +
        '<input class="input tk-search" type="search" placeholder="Search" aria-label="Search tickets">' +
        '<button type="button" class="icon-btn tk-refresh" title="Read the tickets again" aria-label="Refresh">' + ICON.refresh + '</button>' +
        '<button type="button" class="btn btn-primary tk-add">' + ICON.plus + '<span class="btn-label">Open ticket</span></button>' +
        '<button type="button" class="icon-btn tk-close" title="Close (Esc)" aria-label="Close">' + ICON.close + '</button></div>' +
        '<div class="tk-body"><div class="tk-list" role="listbox" tabindex="0" aria-label="Tickets"></div><div class="tk-detail" hidden></div></div></div>';
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
      wrap.addEventListener('click', sheetClick);
      $('.tk-search', wrap).addEventListener('input', function (e) { query = e.target.value; drawList(); });
      $('.tk-mine input', wrap).addEventListener('change', function (e) { mine = e.target.checked; drawSheet(); });
      $('.tk-list', wrap).addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        var ids = Array.prototype.map.call(wrap.querySelectorAll('.tk-row'), function (r) { return r.dataset.id; }), i = ids.indexOf(selected);
        var j = e.key === 'ArrowDown' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
        if (ids[j]) { selected = ids[j]; drawSheet(); var r = $('.tk-row.on', wrap); if (r) r.scrollIntoView({ block: 'nearest' }); }
      });
      shield(wrap);
      document.body.appendChild(wrap);
      document.documentElement.classList.add('tk-open');
      // Focus inside the sheet, so typing never lands on the page underneath.
      setTimeout(function () { var s = wrap && $('.tk-list', wrap); if (s) s.focus(); }, 30);
    }
    lastError = '';
    drawSheet();
    load().then(function () {
      baseline();
      if (n) { var t = tickets.filter(function (x) { return String(x.n) === String(n); })[0]; if (t) { selected = t.id; if (filtered().indexOf(t) < 0) filter = 'all'; } }
      drawSheet();
      return loadPeople();
    }).then(function () { if (selected) drawDetail(); }, function (e) { lastError = e.message || 'Tickets couldn’t be read'; drawSheet(); });
  }
  function close() {
    if (!wrap) return;
    wrap.remove(); wrap = null; selected = '';
    document.documentElement.classList.remove('tk-open');
  }
  function drawSheet() { if (!wrap) return; drawFilters(); drawList(); drawDetail(); }
  function drawFilters() {
    var who = me(), base = tickets.filter(function (t) { return !mine || t.assignee === who || t.reporter === who; });
    var counts = { active: 0, fixed: 0, closed: 0, all: base.length };
    base.forEach(function (t) { if (t.state === 'fixed') counts.fixed++; else if (t.state === 'closed') counts.closed++; else counts.active++; });
    wrap.querySelectorAll('.tk-filter button').forEach(function (b) {
      var on = b.dataset.f === filter;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      $('.count', b).textContent = loaded ? ' ' + counts[b.dataset.f] : '';
    });
  }
  function drawList() {
    var el = $('.tk-list', wrap);
    if (!el) return;
    if (!loaded) { el.innerHTML = '<div class="tk-empty">' + (lastError ? esc(lastError) : 'Reading the tickets…') + '</div>'; return; }
    var list = filtered(), news = unseen();
    // Your updated tickets show at the top whatever the filter (a Fixed one would hide under Active),
    // and the one you opened from there stays put after it's marked seen.
    var extra = tickets.filter(function (t) { return list.indexOf(t) < 0 && (news.indexOf(t) >= 0 || t.id === selected); })
      .sort(function (a, b) { return (b.updated || '').localeCompare(a.updated || '') || b.n - a.n; });
    if (!list.length && !extra.length) {
      el.innerHTML = '<div class="tk-empty"><div class="empty-art">' + ICON.ticket + '</div><p>' +
        (tickets.length ? 'No tickets here. Try another filter.' : 'No tickets yet. Open one from any tool’s ⋯ menu, or with the button above.') + '</p></div>';
      return;
    }
    var label = FILTERS.filter(function (f) { return f.id === filter; })[0].label;
    el.innerHTML = (extra.length ? '<div class="tk-group">Updated for you</div>' + rows(extra, news) +
      '<div class="tk-group">' + esc(label) + (mine ? ', mine' : '') + '</div>' : '') +
      (list.length ? rows(list, news) : '<div class="tk-quiet tk-none">No tickets here. Try another filter.</div>');
  }
  function rows(list, news) {
    return list.map(function (t) {
      var w = t.where || {}, c = comments(t), p = pictures(t), fresh = news.indexOf(t) >= 0;
      return '<button type="button" class="tk-row' + (t.id === selected ? ' on' : '') + (fresh ? ' tk-unseen' : '') + ' tk-r-' + esc(t.state) + '" data-id="' + esc(t.id) + '" role="option" aria-selected="' + (t.id === selected) + '">' +
        '<span class="tk-n">#' + esc(t.n) + '</span>' +
        '<span class="tk-row-main"><span class="tk-row-title">' + (fresh ? '<span class="tk-new-mark" title="Someone changed or commented on your ticket since you last opened it">Updated</span>' : '') + esc(t.title) + '</span>' +
        '<span class="tk-row-meta">' + esc(toolName(w.tool)) + (w.unit ? ' · ' + esc(w.unit) : '') + ' · by @' + esc(t.reporter) + ' · ' + esc(relTime(t.updated || t.created)) + '</span></span>' +
        '<span class="tk-row-right">' + (p ? '<span class="cmt-count" title="' + p + ' picture' + (p === 1 ? '' : 's') + '">' + ICON.image + p + '</span>' : '') +
        (c ? '<span class="cmt-count" title="' + c + ' comment' + (c === 1 ? '' : 's') + '">' + ICON.bubble + c + '</span>' : '') +
        '<span class="tk-who" title="Assigned to @' + esc(t.assignee) + '">' + avatar(t.assignee) + '</span>' + stateChip(t.state) + '</span></button>';
    }).join('');
  }

  var draftComment = {};   // ticket id -> text being written, kept across redraws
  var commentTray = null;
  function drawDetail() {
    var el = $('.tk-detail', wrap);
    if (!el) return;
    var t = tickets.filter(function (x) { return x.id === selected; })[0];
    wrap.classList.toggle('tk-has-detail', !!t);
    if (!t) { el.hidden = true; el.innerHTML = ''; return; }
    markSeen(t);
    var keep = $('.tk-comment', el); if (keep && keep.dataset.id) draftComment[keep.dataset.id] = keep.value;
    var w = t.where || {}, e = t.env || {}, who = me();
    var askReporter = t.state === 'fixed' && t.reporter === who;
    el.hidden = false;
    el.innerHTML =
      '<div class="tk-panel-head"><div class="tk-crumb">#' + esc(t.n) + ' · ' + esc(toolName(w.tool)) + '</div>' +
      '<button type="button" class="icon-btn tk-deselect" title="Close (Esc)" aria-label="Close">' + ICON.close + '</button></div>' +
      '<div class="tk-panel-body">' +
      '<input class="tk-title-edit" value="' + esc(t.title) + '" maxlength="160" aria-label="Title" title="Click to rename">' +
      (askReporter ? '<div class="tk-ask"><b>Marked fixed.</b> Does it work for you now?<div class="tk-ask-btns"><button type="button" class="btn btn-sm btn-primary" data-state="closed">Yes, close it</button><button type="button" class="btn btn-sm" data-state="open">No, reopen it</button></div></div>' : '') +
      '<div class="field"><div class="field-label">State</div><div class="seg full tk-states">' + STATES.map(function (s) {
        return '<button type="button" data-state="' + s.id + '" class="' + (s.id === t.state ? 'on tk-s-' + s.id : '') + '" title="' + esc(s.tip) + '">' + ICON[s.id] + esc(s.label) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="tk-who-field">' + assigneeField('tk-assignee', t.assignee, 'Assigned to') + '</div>' +
      '<div class="meta-line" title="' + esc(fullTime(t.created)) + '">Opened by @' + esc(t.reporter) + ' ' + esc(relTime(t.created)) + '</div>' +
      (t.body ? '<div class="tk-body-text">' + esc(t.body) + '</div>' : '') +
      ((t.images || []).length ? '<div class="tk-pics">' + t.images.map(function (im, i) { return '<button type="button" class="tk-pic" data-pic="t:' + i + '" aria-label="Open picture"><span class="tk-pic-wait"></span></button>'; }).join('') + '</div>' : '') +
      '<details class="tk-where"><summary>Where: ' + crumb(w) + '</summary><dl>' +
      (w.url ? '<dt>Page</dt><dd><a href="' + esc(w.url) + '" class="tk-link">' + esc(w.url) + '</a></dd>' : '') +
      (w.item ? '<dt>Item</dt><dd>' + esc(w.item) + '</dd>' : '') +
      (w.version ? '<dt>Version</dt><dd>' + esc(w.version) + '</dd>' : '') +
      (e.viewport ? '<dt>Window</dt><dd>' + esc(e.viewport) + ', ' + esc(e.theme || '') + '</dd>' : '') +
      (e.ua ? '<dt>Browser</dt><dd>' + esc(e.ua) + '</dd>' : '') + '</dl></details>' +
      '<div class="thread"><div class="thread-title">Discussion</div>' + logHtml(t) + '</div>' +
      '</div>' +
      '<div class="composer tk-composer">' +
      '<textarea class="input tk-comment" data-id="' + esc(t.id) + '" placeholder="Add a comment…"></textarea>' +
      '<div class="tk-tray tk-ctray" hidden></div>' +
      '<div class="composer-foot"><div class="composer-hints"><span>Paste or drop a picture, or <button type="button" class="tk-link tk-cpick">choose one</button></span><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to post</span></div>' +
      '<button type="button" class="btn btn-primary tk-post">Comment</button></div></div>';
    var ta = $('.tk-comment', el);
    ta.value = draftComment[t.id] || '';
    commentTray = Tray($('.tk-ctray', el));
    wireAssignee($('.tk-who-field', el), function (login) {
      if (login !== t.assignee) run(setAssignee(t, login), 'Assigned to @' + login);
    }, function () { $('.tk-who-field .tk-assignee', el).innerHTML = assigneeOptions(t.assignee); });
    wireDrop($('.tk-composer', el), commentTray);
    ta.addEventListener('keydown', function (ev) { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); post(t); } });
    var title = $('.tk-title-edit', el);
    title.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); title.blur(); } if (ev.key === 'Escape') { ev.stopPropagation(); title.value = t.title; title.blur(); } });
    title.addEventListener('blur', function () { var v = title.value.trim(); if (!v) { title.value = t.title; return; } if (v !== t.title) run(setTitle(t, v), 'Renamed'); });
    // Pictures fill in as they arrive.
    el.querySelectorAll('[data-pic]').forEach(function (b) {
      var im = picOf(t, b.dataset.pic);
      if (!im) return;
      imageUrl(t, im).then(function (url) { b.innerHTML = '<img src="' + esc(url) + '" alt="">'; }, function () { b.innerHTML = '<span class="tk-pic-wait">Picture missing</span>'; });
    });
  }
  function picOf(t, ref) {
    var parts = ref.split(':');
    if (parts[0] === 't') return (t.images || [])[+parts[1]];
    var e = (t.log || []).filter(function (x) { return x.id === parts[0]; })[0];
    return e && (e.images || [])[+parts[1]];
  }
  function logHtml(t) {
    var log = (t.log || []).slice().sort(function (a, b) { return (a.at || '').localeCompare(b.at || ''); });
    if (!log.length) return '<p class="tk-quiet">No comments yet.</p>';
    return log.map(function (e) {
      if (e.kind === 'comment') {
        return '<div class="cmt">' + avatar(e.by) + '<div><div class="cmt-head"><b>@' + esc(e.by) + '</b><span title="' + esc(fullTime(e.at)) + '">' + esc(relTime(e.at)) + '</span></div>' +
          (e.text ? '<div class="cmt-text">' + esc(e.text) + '</div>' : '') +
          ((e.images || []).length ? '<div class="tk-pics">' + e.images.map(function (im, i) { return '<button type="button" class="tk-pic" data-pic="' + esc(e.id) + ':' + i + '" aria-label="Open picture"><span class="tk-pic-wait"></span></button>'; }).join('') + '</div>' : '') +
          '</div></div>';
      }
      var what = e.kind === 'state' ? 'set it to ' + stateChip(e.to)
        : e.kind === 'assign' ? 'assigned it to @' + esc(e.to)
        : e.kind === 'title' ? 'renamed it from “' + esc(e.from) + '”' : esc(e.kind);
      return '<div class="tk-event"><span>@' + esc(e.by) + ' ' + what + '</span><span class="tk-when" title="' + esc(fullTime(e.at)) + '">' + esc(relTime(e.at)) + '</span></div>';
    }).join('');
  }
  function run(p, done) {
    if (wrap) wrap.classList.add('tk-busy');
    return p.then(function (t) { if (wrap) wrap.classList.remove('tk-busy'); drawSheet(); if (done) toast(done); return t; },
      function (e) { if (wrap) wrap.classList.remove('tk-busy'); toast(e.message || 'That didn’t save'); drawSheet(); });
  }
  function post(t) {
    var ta = $('.tk-detail .tk-comment', wrap), text = ta ? ta.value.trim() : '', imgs = commentTray ? commentTray.list() : [];
    if (!text && !imgs.length) return;
    // A reporter answering a Fixed ticket reopens it only from the buttons, never by commenting.
    var btn = $('.tk-post', wrap); if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }
    run(comment(t, text, imgs, false).then(function (saved) { draftComment[t.id] = ''; return saved; }));
  }

  function sheetClick(e) {
    var t = tickets.filter(function (x) { return x.id === selected; })[0];
    var row = e.target.closest('.tk-row');
    if (row) { selected = row.dataset.id === selected ? '' : row.dataset.id; drawSheet(); return; }
    var f = e.target.closest('.tk-filter button');
    if (f) { filter = f.dataset.f; drawSheet(); return; }
    if (e.target.closest('.tk-close')) { close(); return; }
    if (e.target.closest('.tk-add')) { newTicket(); return; }
    if (e.target.closest('.tk-refresh')) { loaded = DEMO; lastError = ''; drawSheet(); load().then(drawSheet, function (er) { lastError = er.message; drawSheet(); }); return; }
    if (e.target.closest('.tk-deselect')) { selected = ''; drawSheet(); return; }
    var pic = e.target.closest('.tk-pic');
    if (pic && t) { var img = $('img', pic); if (img) lightbox(img.src); return; }
    var s = e.target.closest('[data-state]');
    if (s && t) { run(setState(t, s.dataset.state), 'Ticket #' + t.n + ': ' + stateOf(s.dataset.state).label); return; }
    if (e.target.closest('.tk-post') && t) { post(t); return; }
    if (e.target.closest('.tk-cpick') && commentTray) { filePicker(commentTray); return; }
    // A blank click in the list closes the ticket.
    if (selected && e.target.closest('.tk-list') && !e.target.closest('button')) { selected = ''; drawSheet(); }
  }

  var box = null;
  function lightbox(src) {
    box = document.createElement('div');
    box.className = 'tk-lightbox';
    box.innerHTML = '<img src="' + esc(src) + '" alt="">';
    box.addEventListener('click', function () { box.remove(); box = null; });
    document.body.appendChild(box);
  }

  // ── the ⋯ button, for tools without their own ──
  function placeMore() {
    var bar = document.getElementById('toolbar');
    if (!bar || bar.hasAttribute('data-tickets-own')) return;
    var b = document.getElementById('tk-more');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button'; b.id = 'tk-more'; b.className = 'icon-btn tk-more';
      b.title = 'More'; b.setAttribute('aria-label', 'More'); b.setAttribute('aria-haspopup', 'menu');
      b.innerHTML = ICON.more;
      // A bar with nothing that grows (the hub's) would leave it beside the title.
      if (!bar.querySelector('.toolbar-center, .toolbar-actions')) b.style.marginLeft = 'auto';
      bar.appendChild(b);
      b.addEventListener('click', function (e) { e.stopPropagation(); if ($('#tk-menu')) { closeMenu(); return; } menu(b); });
    }
    b.hidden = !can();
  }
  function menu(anchor) {
    closeMenu();
    var m = document.createElement('div');
    m.className = 'menu'; m.id = 'tk-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = '<button type="button" data-tk="new" role="menuitem">Open ticket…</button><button type="button" data-tk="list" role="menuitem">Tickets</button>';
    countItem($('[data-tk="list"]', m));
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
    m.style.top = (r.bottom + 6) + 'px';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tk]'); if (!b) return;
      closeMenu();
      if (b.dataset.tk === 'new') newTicket(); else open();
    });
  }
  function closeMenu() { var m = $('#tk-menu'); if (m) m.remove(); }
  document.addEventListener('mousedown', function (e) { var m = $('#tk-menu'); if (m && !m.contains(e.target) && !e.target.closest('#tk-more')) closeMenu(); });

  function refresh() { placeMore(); drawUnseen(); check(5 * 60000); }

  // The People link shows and hides as a tool learns who you are; follow it.
  function watch() {
    refresh();
    var people = document.getElementById('people-link');
    if (people && window.MutationObserver) new MutationObserver(refresh).observe(people, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('storage', function (e) { if (!e.key || /^signoff\.(token|login|auth|v1\.settings|v1\.dataAccess)/.test(e.key)) refresh(); });
    // Who's signed in can change without the People link moving (a pill with no People link).
    setInterval(refresh, 5000);
    // Back to the tab after a while: look for news (at most once a minute).
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(60000); });
    // Another tab opened a ticket: its seen marks are ours too.
    window.addEventListener('storage', function (e) { if (e.key === SEEN_KEY) drawUnseen(); });
    // The tools draw their own ⋯ menu (#menu); give its Tickets item the count.
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var item = document.querySelector('#menu [data-menu="tickets"]');
        if (item && unseenCount && !item.querySelector('.tk-menu-count')) countItem(item);
      }).observe(document.body, { childList: true });
      // A redrawn ⋯ button gets its label back.
      var bar = document.getElementById('toolbar');
      if (bar) new MutationObserver(function () { if (unseenCount) labelMore(bar); }).observe(bar, { childList: true, subtree: true });
    }
    var m =location.search.match(/[?&]page=tickets\b/);
    if (m) { var n = (location.search.match(/[?&]ticket=(\d+)/) || [])[1]; setTimeout(function () { open(n); }, 300); }
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-tickets-open]');
    if (!el) return;
    e.preventDefault();
    var app = document.getElementById('app');
    if (app) app.classList.remove('nav-open');
    open();
  });
  // The sheet is modal: with it open, a key whose focus is outside it (a click on its blank parts
  // leaves focus on body) goes no further than here, so the tool's shortcuts don't act underneath.
  window.addEventListener('keydown', function (e) {
    if (!wrap || e.key === 'Escape' || wrap.contains(e.target) || (newPanel && newPanel.contains(e.target))) return;
    var t = e.target;
    if (t === document.body || t === document.documentElement || t === document) e.stopPropagation();
  }, true);
  // Before the tools' own handlers (this script loads first): a picture, then the new-ticket
  // panel, then an open ticket, then the sheet. A tool's own sheet, menu, or busy card goes first.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (box) { box.remove(); box = null; e.stopImmediatePropagation(); return; }
    if ($('#tk-menu')) { closeMenu(); e.stopImmediatePropagation(); return; }
    if (document.getElementById('sheet') || document.getElementById('menu') || document.getElementById('busy-wrap')) return;
    if (newPanel) { e.stopImmediatePropagation(); closeNew(); return; }
    if (!wrap) return;
    e.stopImmediatePropagation();
    if (selected) { selected = ''; drawSheet(); } else close();
  });

  // Our stylesheet sits beside this script.
  (function css() {
    var me = document.currentScript && document.currentScript.src;
    if (!me || document.querySelector('link[data-tickets-css]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = me.replace(/tickets\.js(\?.*)?$/, 'tickets.css$1'); l.setAttribute('data-tickets-css', '');
    document.head.appendChild(l);
  })();

  if (!EMBEDDED) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(watch, 0); });
    else setTimeout(watch, 0);
  }

  window.SignoffTickets = {
    can: can,
    newTicket: newTicket,
    open: open,
    close: close,
    isOpen: function () { return !!wrap || !!newPanel; },
    where: function (fn) { whereHook = fn; },
    refresh: refresh,
    unseenCount: function () { return unseenCount; },
    states: STATES,
    // For tests: the pure parts, and the store (tools/tickets_live_test.js runs it against GitHub).
    _test: { pathOf: pathOf, ticketPaths: ticketPaths, pad: pad, b64ToBytes: b64ToBytes, bytesToB64: bytesToB64,
      load: load, create: create, setState: setState, setAssignee: setAssignee, comment: comment, list: function () { return tickets; },
      lastNews: lastNews, unseenOf: unseenOf, unseen: unseen, check: check }
  };
})();
