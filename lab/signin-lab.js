/* Sign-in lab (signin.html): drives SignoffAuth against the dev app and Worker. Never prints a token. */
(function () {
  'use strict';
  var A = window.SignoffAuth;
  var $ = function (id) { return document.getElementById(id); };
  var OWNER = 'chrismessick-dpd';
  var SPIKE = 'signoff-auth-spike';
  var tabId = Math.random().toString(36).slice(2, 6);

  function kind(t) {
    if (!t) return 'none';
    if (/^ghu_/.test(t)) return 'GitHub App user token (ghu_)';
    if (/^ghp_/.test(t)) return 'classic personal token (ghp_)';
    if (/^github_pat_/.test(t)) return 'fine-grained personal token';
    return 'other';
  }
  function when(ms) {
    if (!ms) return '—';
    var left = ms - Date.now(), d = new Date(ms).toLocaleString();
    var h = Math.round(left / 360000) / 10;
    return d + (left > 0 ? '  (in ' + (h < 48 ? h + ' h' : Math.round(h / 24) + ' days') + ')' : '  (past)');
  }
  function render() {
    var s = A.status();
    var t = localStorage.getItem('signoff.token') || sessionStorage.getItem('signoff.token') || '';
    var rows = [
      ['This tab', tabId],
      ['Set up here', s.available ? 'yes (dev app)' : 'no: open this page on http://localhost:8774'],
      ['Signed in', s.signedIn ? 'yes' + (s.login ? ', as @' + s.login : '') : 'no'],
      ['Stored token', kind(t)],
      ['Token expires', when(s.expiresAt)],
      ['Sign in again by', when(s.refreshExpiresAt)],
    ];
    $('status').innerHTML = '';
    rows.forEach(function (r) {
      var dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = r[0]; dd.textContent = r[1];
      $('status').appendChild(dt); $('status').appendChild(dd);
    });
    $('signin').disabled = !s.available;
    $('signout').disabled = !s.signedIn && !s.pasted;
  }
  function out(id, text) { $(id).textContent = text; }
  function fail(id) { return function (e) { out(id, 'Failed: ' + (e && e.message || e)); render(); }; }

  // GitHub API through SignoffAuth.token(), with one refresh-and-retry on a 401, as the tools will do.
  function gh(path, opts) {
    opts = opts || {};
    function call(tok) {
      return fetch('https://api.github.com' + path, {
        method: opts.method || 'GET',
        headers: Object.assign({ Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
          opts.body ? { 'Content-Type': 'application/json' } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store',
      }).then(function (res) { return { res: res, tok: tok }; });
    }
    return A.token().then(function (tok) {
      if (!tok) throw new Error('Not signed in.');
      return call(tok);
    }).then(function (r) {
      if (r.res.status !== 401) return r.res;
      return A.refresh(r.tok).then(function (tok2) {
        if (!tok2) throw new Error('Signed out: GitHub no longer accepts this sign-in.');
        return call(tok2).then(function (r2) { return r2.res; });
      });
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { /* not JSON */ }
        if (!res.ok) { var e = new Error((data && data.message || 'HTTP') + ' (' + res.status + ')'); e.status = res.status; throw e; }
        return data;
      });
    });
  }

  $('origin').textContent = location.origin;
  $('signin').onclick = function () { A.signIn(location.href).catch(fail('user-out')); };
  $('signout').onclick = function () {
    A.signOut().then(function () { out('user-out', 'Signed out, and the sign-in revoked on GitHub.'); render(); }, fail('user-out'));
  };

  $('user').onclick = function () {
    out('user-out', '…');
    gh('/user').then(function (u) { out('user-out', '@' + u.login + (u.name ? '  (' + u.name + ')' : '') + '\nid ' + u.id + ', ' + u.type); render(); }, fail('user-out'));
  };

  $('repos').onclick = function () {
    out('repos-out', '…');
    var all = [];
    (function page(n) {
      return gh('/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&page=' + n).then(function (list) {
        all = all.concat(list || []);
        return list && list.length === 100 && n < 10 ? page(n + 1) : all;
      });
    })(1).then(function (list) {
      var mine = list.filter(function (r) { return r.owner && r.owner.login.toLowerCase() === OWNER; });
      var other = list.length - mine.length;
      var names = mine.map(function (r) { return (r.private ? '🔒 ' : '   ') + r.name; }).sort();
      out('repos-out', mine.length + ' in ' + OWNER + (other ? ', and ' + other + ' elsewhere (should be 0)' : ', none elsewhere') + '\n\n' + names.join('\n'));
    }, fail('repos-out'));
  };

  $('invites').onclick = function () {
    out('invites-out', '…');
    gh('/user/repository_invitations?per_page=100').then(function (list) {
      out('invites-out', (list || []).length ? list.map(function (i) { return i.repository.full_name + '  (invitation ' + i.id + ')'; }).join('\n') : 'No invitations waiting. (The call worked.)');
    }, fail('invites-out'));
  };

  // ── refresh and the race ──
  function doRefresh(label) {
    var before = localStorage.getItem('signoff.token') || '';
    var calls = A.stats.refreshes;
    var t0 = performance.now();
    return A.refresh(before).then(function (tok) {
      var ms = Math.round(performance.now() - t0);
      if (!tok) return label + ': signed out (' + ms + ' ms)';
      var how = A.stats.refreshes > calls ? 'called the Worker for a new token' : 'waited, then used the token another tab got';
      return gh('/user').then(function (u) {
        return label + ': ' + how + ', /user → @' + u.login + ' (' + ms + ' ms)';
      });
    }).catch(function (e) { return label + ': FAILED ' + e.message; });
  }
  $('refresh').onclick = function () { out('refresh-out', '…'); doRefresh('tab ' + tabId).then(function (t) { out('refresh-out', t); render(); }); };

  var chan = 'BroadcastChannel' in window ? new BroadcastChannel('signoff-auth-lab') : null;
  if (chan) chan.onmessage = function (ev) {
    if (ev.data && ev.data.type === 'race') doRefresh('tab ' + tabId).then(function (t) { chan.postMessage({ type: 'result', text: t }); render(); });
    if (ev.data && ev.data.type === 'result') $('refresh-out').textContent += '\n' + ev.data.text;
  };
  $('race').onclick = function () {
    if (!chan) { out('refresh-out', 'This browser has no BroadcastChannel.'); return; }
    out('refresh-out', 'Racing…');
    chan.postMessage({ type: 'race' });
    doRefresh('tab ' + tabId + ' (this one)').then(function (t) { $('refresh-out').textContent += '\n' + t; render(); });
  };

  // ── what the installation grants ──
  $('perms').onclick = function () {
    out('perms-out', '…');
    gh('/user/installations').then(function (r) {
      var list = (r && r.installations) || [];
      if (!list.length) { out('perms-out', 'The app is installed nowhere this account can see.'); return; }
      out('perms-out', list.map(function (i) {
        var p = i.permissions || {};
        return 'Installed on ' + i.account.login + ' (' + i.repository_selection + ' repositories)\n' +
          Object.keys(p).sort().map(function (k) { return '  ' + k + ': ' + p[k]; }).join('\n');
      }).join('\n\n'));
    }, fail('perms-out'));
  };

  // ── create, read back, delete ──
  $('create').onclick = function () {
    out('create-out', 'Creating ' + OWNER + '/' + SPIKE + '…');
    gh('/user/repos', { method: 'POST', body: { name: SPIKE, private: true, auto_init: true, description: 'Sign-in test; safe to delete.' } })
      .then(function (r) {
        $('create-out').textContent += '\nCreated ' + r.full_name + ' (private: ' + r.private + ').';
        return gh('/repos/' + OWNER + '/' + SPIKE + '/contents/README.md');
      })
      .then(function (f) {
        $('create-out').textContent += '\nRead it back at once: README.md, ' + f.size + ' bytes. ✔';
        $('delete').disabled = false;
      }, function (e) {
        $('create-out').textContent += '\nFailed: ' + e.message + (e.status === 422 ? '  (it may already exist; Delete removes it)' : '');
        $('delete').disabled = false;
      });
  };
  $('delete').onclick = function () {
    out('create-out', 'Deleting ' + OWNER + '/' + SPIKE + '…');
    gh('/repos/' + OWNER + '/' + SPIKE, { method: 'DELETE' }).then(function () {
      out('create-out', 'Deleted ' + OWNER + '/' + SPIKE + '.'); $('delete').disabled = true;
    }, fail('create-out'));
  };

  window.addEventListener('storage', function (ev) { if (/^signoff\.(token|auth|login)/.test(ev.key || '')) render(); });
  render();
  setInterval(render, 30000);
})();
