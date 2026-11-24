/* Dovetail Signoff hub: Tool Maintenance (Chris, 2026-11-24).
 *
 * An FTE-only page (index.html#maintenance) that shows the suite's onboarding guide, ONBOARDING.md in the
 * private repo signoff_suite, read with the visitor's own GitHub sign-in. Nothing from it is cached or kept:
 * the guide is fetched each time the page opens, so it is always the version on main. The guide's prompts
 * (block quotes) and commands (code blocks) have a Copy button, since they're meant to be pasted into Claude
 * Code or a terminal.
 *
 *   SignoffMaint.show(el)   fetch and draw the guide into el
 */
(function () {
  'use strict';
  var OWNER = 'chrismessick-dpd', REPO = 'signoff_suite', FILE = 'ONBOARDING.md', API = 'https://api.github.com';

  function get(store, k) { try { return store.getItem(k) || ''; } catch (e) { return ''; } }
  function token() {
    var t = get(sessionStorage, 'signoff.token') || get(localStorage, 'signoff.token'), A = window.SignoffAuth;
    return A && A.owns && A.owns(t) ? A.token() : Promise.resolve(t);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── Markdown, the subset the guide uses ──
  // Headings, rules, paragraphs, block quotes, nested lists, fenced code, `code`, **bold**, *italic*, links,
  // and bare URLs. Everything is escaped first; links take only http(s) and #anchors.
  function inline(s) {
    // Code spans first, held aside so bold, links, and URLs around them (or stars inside them) work.
    var held = [];
    var h = s.split('`').map(function (part, i) {
      if (!(i % 2)) return esc(part);
      held.push('<code>' + esc(part) + '</code>');
      return '\u0000' + (held.length - 1) + '\u0000';
    }).join('');
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      return /^(https?:\/\/|#)/.test(u) ? '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>' : t;
    });
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)\u0000]+[^\s<).,;:\u0000])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<i>$2</i>');
    return h.replace(/\u0000(\d+)\u0000/g, function (m, n) { return held[+n]; });
  }
  var LIST = /^(\s*)([-*]|\d+[.)])\s+/;
  function indentOf(l) { return /^ */.exec(l)[0].length; }
  function blocks(lines) {
    var out = '', i = 0, n = lines.length, m;
    while (i < n) {
      var l = lines[i], t = l.trim();
      if (!t) { i++; continue; }
      if (/^```/.test(t)) {
        var ind = indentOf(l), code = [];
        for (i++; i < n && !/^```/.test(lines[i].trim()); i++) code.push(lines[i].slice(Math.min(ind, indentOf(lines[i]))));
        i++;
        out += copyable('<pre><code>' + esc(code.join('\n')) + '</code></pre>', code.join('\n'));
        continue;
      }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(t))) { var lv = Math.min(m[1].length + 1, 6); out += '<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>'; i++; continue; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { out += '<hr>'; i++; continue; }
      if (/^>/.test(t)) {
        var q = [];
        for (; i < n && /^\s*>/.test(lines[i]); i++) q.push(lines[i].replace(/^\s*> ?/, ''));
        out += copyable('<blockquote>' + blocks(q) + '</blockquote>', q.join('\n'));
        continue;
      }
      if ((m = LIST.exec(l))) {
        var ordered = /\d/.test(m[2]), base = m[1].length, items = [];
        while (i < n) {
          var mm = LIST.exec(lines[i]);
          if (!mm || mm[1].length !== base || /\d/.test(mm[2]) !== ordered) break;
          var cut = mm[0].length, body = [lines[i].slice(cut)];
          for (i++; i < n; i++) {
            var nl = lines[i];
            if (!nl.trim()) { if (i + 1 < n && lines[i + 1].trim() && indentOf(lines[i + 1]) > base) { body.push(''); continue; } break; }
            if (indentOf(nl) <= base && (LIST.test(nl) || /^\s*(#|>|```)/.test(nl))) break;
            if (indentOf(nl) <= base && !LIST.test(nl)) { body.push(nl.trim()); continue; }
            body.push(nl.slice(Math.min(cut, indentOf(nl))));
          }
          items.push(body);
        }
        var tag = ordered ? 'ol' : 'ul';
        out += '<' + tag + '>' + items.map(function (b) {
          var tight = b.indexOf('') < 0 && !b.some(function (x) { return LIST.test(x) || /^\s*```/.test(x); });
          return '<li>' + (tight ? inline(b.join(' ')) : blocks(b)) + '</li>';
        }).join('') + '</' + tag + '>';
        continue;
      }
      var para = [];
      for (; i < n && lines[i].trim() && !/^\s*(#{1,6}\s|>|```|-{3,}\s*$)/.test(lines[i]) && !(para.length && LIST.test(lines[i])); i++) para.push(lines[i].trim());
      if (!para.length) { para.push(t); i++; }
      out += '<p>' + inline(para.join(' ')) + '</p>';
    }
    return out;
  }
  var copies = [];
  function copyable(html, text) {
    copies.push(text);
    return '<div class="mt-copyable">' + html + '<button type="button" class="btn mt-copy" data-copy="' + (copies.length - 1) + '">Copy</button></div>';
  }
  function render(md) { copies = []; return blocks(String(md).replace(/\r\n?/g, '\n').split('\n')); }

  function note(el, title, body) {
    el.innerHTML = '<div class="mt-note"><b>' + esc(title) + '</b><p>' + body + '</p></div>';
  }
  function show(el) {
    if (!el) return;
    el.innerHTML = '<div class="mt-loading">Loading the guide…</div>';
    token().then(function (t) {
      if (!t) { note(el, 'Sign in first', 'Sign in with GitHub (the pill at the bottom of the sidebar) to read the guide.'); return null; }
      return fetch(API + '/repos/' + OWNER + '/' + REPO + '/contents/' + FILE + '?ref=main', {
        headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github.raw' }, cache: 'no-store'
      }).then(function (r) {
        if (r.status === 404 || r.status === 403) {
          note(el, 'No access to the guide yet', 'The guide lives in the private repo <code>' + REPO + '</code>, which your GitHub account can’t open. Ask Chris to add you (People &amp; access gives every FTE access), then accept the invitation from GitHub.');
          return null;
        }
        if (r.status === 401) { note(el, 'Sign in again', 'GitHub didn’t accept this browser’s sign-in. Sign out and in again from Settings (the gear at the bottom of the sidebar), then open this page again.'); return null; }
        if (!r.ok) throw new Error('GitHub said ' + r.status);
        return r.text();
      });
    }).then(function (md) {
      if (md == null) return;
      el.innerHTML = '<article class="mt-guide">' + render(md) + '</article>' +
        '<div class="mt-source">From <a href="https://github.com/' + OWNER + '/' + REPO + '/blob/main/' + FILE + '" target="_blank" rel="noopener">' + REPO + '/' + FILE + '</a> on GitHub.</div>';
      var list = copies;
      el.querySelectorAll('.mt-copy').forEach(function (b) {
        b.addEventListener('click', function () {
          var text = list[+b.getAttribute('data-copy')] || '';
          var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { b.textContent = 'Copy failed'; });
        });
      });
    }).catch(function (e) {
      note(el, 'Couldn’t load the guide', esc(e && e.message || String(e)) + '. Check your connection and open the page again.');
    });
  }

  window.SignoffMaint = { show: show, render: render };
})();
