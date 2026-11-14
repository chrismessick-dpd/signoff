/* History lab (signoff/lab/history.html). A prototype of a per-tool history panel: changes newest
   first, consecutive changes by one person folded into a block, a conflict-copy branch with ways to
   resolve it (add sentences to the section, use the copy's version, or delete it), and stubs for
   viewing a change (a diff) and Revert. Made-up Smart Thermostat data only; reads and writes
   nothing. The design is in signoff/docs/history.md. */
(function () {
  'use strict';

  var PEOPLE = {
    'Sam Patel':  { init: 'SP', login: 'spatel', role: 'FTE' },
    'Morgan Lee': { init: 'ML', login: 'mlee', role: 'FTE' },
    'Riley Chen': { init: 'RC', login: 'rchen', role: 'Contractor' },
    'You':        { init: 'YOU', login: 'you', role: 'FTE' }
  };

  var BUCK_BASE = 'U7 is a 2 A synchronous buck with a 2.2 µH inductor and 22 µF of output capacitance. Keep the ripple under 30 mV at the Wi-Fi module @req.';
  var BUCK_SAM = 'U7 is a 2 A synchronous buck with a 2.2 µH inductor and 44 µF of output capacitance. Keep the ripple under 30 mV at the Wi-Fi module @req. It runs at 2.2 MHz, above the AM band.';
  var BUCK_MORGAN = 'U7 is a 2 A synchronous buck with a 2.2 µH inductor and 22 µF of output capacitance. Keep the ripple under 20 mV at the Wi-Fi module @req. Soft start limits the inrush to 400 mA.';
  var BUCK_MERGED = 'U7 is a 2 A synchronous buck with a 2.2 µH inductor and 22 µF of output capacitance. Keep the ripple under 20 mV at the Wi-Fi module @req. Soft start limits the inrush to 400 mA. It runs at 2.2 MHz, above the AM band.';

  // m: minutes ago. rec: the record (kind:id); a later change to the same record blocks a plain Revert.
  // lane 1 is the conflict copy. fork / join mark where the branch leaves and rejoins.
  var CHANGES = [
    { m: 10, by: 'Riley Chen', kind: 'comment', rec: 'comment:c41', label: 'Relay contacts rated for the load', before: null,
      after: 'K1 and K2 are rated 5 A at 250 V AC. The compressor call is under 1 A, so there’s margin. Closing my question.', commit: '9f3c2e1' },
    { m: 14, by: 'Riley Chen', kind: 'check', rec: 'check:ee-hv-07', label: 'Creepage across the isolation slot is at least 6.4 mm (252 mil)',
      before: { status: 'To review' }, after: { status: 'Issue', sev: 'Major' }, commit: '9f3c2e1' },
    { m: 18, by: 'Riley Chen', kind: 'comment', rec: 'comment:c40', label: 'Creepage across the isolation slot is at least 6.4 mm (252 mil)', before: null,
      after: 'The slot under PS1 stops 1.1 mm short of the board edge, so the path around it is 5.8 mm.', commit: '9f3c2e1' },
    { m: 45, by: 'Morgan Lee', kind: 'req', rec: 'req:REQ-004', label: 'REQ-004 The 3.3 V rail ripple stays under 30 mV',
      before: { verify: 'Open' }, after: { verify: 'Pass', evidence: 'Bench, 18 mV p-p at full Wi-Fi transmit' }, commit: 'b71d0a4' },
    { m: 50, by: 'Morgan Lee', kind: 'spec', rec: 'spec:relays', label: 'Relay outputs',
      before: 'K1 and K2 switch the heat and cool calls. Each coil has a flyback diode.',
      after: 'K1 and K2 switch the heat and cool calls. Each coil has a flyback diode, and Q3 and Q4 drive them from the MCU.', commit: 'b71d0a4' },
    { m: 120, resolution: true, by: 'Morgan Lee', kind: 'spec', rec: 'spec:buck~7c2', label: '3V3 buck (conflict copy)', deleted: true, join: true,
      before: BUCK_SAM, after: null, commit: '40ae6d2', note: 'Deleted the copy after taking what was needed from it. This ends the branch.' },
    { m: 122, resolution: true, by: 'Morgan Lee', kind: 'spec', rec: 'spec:buck', label: '3V3 buck', before: BUCK_MORGAN, after: BUCK_MERGED, commit: '40ae6d2',
      note: 'Copied Sam Patel’s sentence about the switching frequency from the copy into the section.' },
    { m: 195, by: 'Morgan Lee', kind: 'spec', rec: 'spec:buck', label: '3V3 buck', before: BUCK_BASE, after: BUCK_MORGAN, commit: 'e05b9f7',
      note: 'Sam Patel edited this section from the same version at the same time. This edit was newer, so it became the section.' },
    { m: 200, by: 'Sam Patel', kind: 'spec', rec: 'spec:buck~7c2', label: '3V3 buck (conflict copy)', lane: 1, before: BUCK_BASE, after: BUCK_SAM, commit: 'd2c8813',
      note: 'Morgan Lee edited this section from the same version at the same time. Morgan’s edit was newer, so it became the section. This one was kept beside it as a copy, so no text was lost.' },
    { m: 210, by: 'Sam Patel', kind: 'spec', rec: 'spec:mains', label: 'Mains input',
      before: 'Line and neutral land on a two-way screw terminal, J1, then a 1 A slow-blow fuse, F1.',
      after: 'Line and neutral land on a two-way screw terminal, J1, then a 1 A slow-blow fuse, F1, with a 275 V varistor, RV1, across the line.', commit: 'd2c8813' },
    { m: 240, by: 'Sam Patel', kind: 'check', rec: 'check:ee-pwr-03', label: 'Fuse rating covers the inrush of the isolated supply',
      before: { status: 'To review' }, after: { status: 'Pass' }, commit: 'd2c8813' },
    { m: 300, by: 'Sam Patel', kind: 'spec', rec: 'spec:buck', label: '3V3 buck', fork: true,
      before: 'U7 is a 2 A synchronous buck. Keep the ripple low at the Wi-Fi module.', after: BUCK_BASE, commit: '6a1f0c9',
      note: 'Sam Patel and Morgan Lee both started their next edits from this version.' },
    { m: 1500, by: 'Morgan Lee', kind: 'req', rec: 'req:REQ-004', label: 'REQ-004 The 3.3 V rail ripple stays under 30 mV', before: null,
      after: { text: 'The 3.3 V rail ripple stays under 30 mV peak to peak at the Wi-Fi module.', verify: 'Open', method: 'Test' }, commit: '1c9e3b2' },
    { m: 1530, by: 'Morgan Lee', kind: 'comment', rec: 'comment:c22', label: 'Whole review', before: null,
      after: 'Profile now includes Wi-Fi, so the RF checklist is on.', commit: '1c9e3b2' },
    { m: 1545, by: 'Sam Patel', kind: 'meta', rec: 'meta', label: 'Profile', before: { profile: 'Mains, Relays, and MCU' },
      after: { profile: 'Mains, Relays, MCU, and Wi-Fi' }, commit: '58d07ee' },
    { m: 1560, by: 'Sam Patel', kind: 'check', rec: 'check:ee-sch-12', label: 'Every IC has a local decoupling capacitor',
      before: { status: 'To review' }, after: { status: 'Pass' }, commit: '58d07ee' }
  ];

  var KINDS = { spec: 'Scribe', check: 'Check', comment: 'Comment', req: 'Req', meta: 'Details' };
  var NOUN = { spec: ['Scribe edit', 'Scribe edits'], check: ['check', 'checks'], comment: ['comment', 'comments'], req: ['requirement', 'requirements'], meta: ['detail change', 'detail changes'] };
  var FILTERS = [['all', 'Everything'], ['spec', 'Scribe'], ['check', 'Checks'], ['comment', 'Comments'], ['req', 'Requirements']];
  var NOW = Date.now();
  CHANGES.forEach(function (c, i) { c.id = 'c' + i; c.at = NOW - c.m * 60000; });

  // scenario 'open': the copy is waiting (Morgan's resolution left out), and the lab's own actions add
  // changes by You. 'resolved': the history as Morgan resolved it.
  var ui = { filter: 'all', win: 120, open: {}, sel: null, scenario: 'open', added: [], picks: null };
  function all() {
    return ui.scenario === 'open' ? CHANGES.filter(function (c) { return !c.resolution; }).concat(ui.added) : CHANGES;
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plural(n, k) { return n + ' ' + NOUN[k][n === 1 ? 0 : 1]; }
  function series(a) { return a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]; }
  function clock(t) { var d = new Date(t); return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function ago(t) {
    var m = Math.round((NOW - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    if (m < 1440) return Math.round(m / 60) + ' h ago';
    return Math.round(m / 1440) + ' d ago';
  }
  function dayOf(t) {
    var d = new Date(t), today = new Date(NOW);
    if (d.toDateString() === today.toDateString()) return 'Today';
    var y = new Date(NOW - 86400000);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // Fold consecutive changes (newest first) by the same person, within the window, on the same lane.
  function blocks() {
    var list = all().filter(function (c) { return ui.filter === 'all' || c.kind === ui.filter; })
      .sort(function (a, b) { return b.at - a.at; });
    var out = [];
    list.forEach(function (c) {
      var b = out[out.length - 1], lane = c.lane || 0;
      var fits = b && ui.win > 0 && b.by === c.by && b.lane === lane && (b.changes[b.changes.length - 1].at - c.at) <= ui.win * 60000 && dayOf(b.end) === dayOf(c.at);
      if (fits) { b.changes.push(c); b.start = c.at; }
      else out.push({ id: 'b' + c.id, by: c.by, lane: lane, changes: [c], start: c.at, end: c.at });
    });
    out.forEach(function (b) {
      b.fork = b.changes.some(function (c) { return c.fork; });
      b.join = b.changes.some(function (c) { return c.join; });
    });
    // Blocks the branch lane passes: from the join block (exclusive) down to the fork block (exclusive).
    var j = -1, f = -1;
    out.forEach(function (b, i) { if (b.join && j < 0) j = i; if (b.fork) f = i; });
    // An open copy (no join yet) runs the lane to the top.
    out.forEach(function (b, i) { b.through = f >= 0 && i > j && i < f && b.lane === 0; });
    return out;
  }

  function counts(b) {
    var n = {};
    b.changes.forEach(function (c) { n[c.kind] = (n[c.kind] || 0) + 1; });
    return series(Object.keys(n).map(function (k) { return plural(n[k], k); }));
  }

  function gutter(b) {
    var p = PEOPLE[b.by] || { init: '?' }, h = '<div class="gut" aria-hidden="true"><span class="lane l0"></span>';
    if (b.lane === 1) h += '<span class="lane l1"></span>';
    else if (b.through) h += '<span class="lane l1"></span>';
    else if (b.join) h += '<span class="lane l1 half-bot"></span><span class="elbow"></span>';
    else if (b.fork) h += '<span class="lane l1 half-top"></span><span class="elbow"></span>';
    return h + '<span class="node' + (b.lane === 1 ? ' on-l1' : '') + '">' + esc(p.init) + '</span></div>';
  }

  var CHEV = '<svg class="chev" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.2 3.5L8.8 7l-3.6 3.5"/></svg>';

  function rowDetail(c) {
    if (c.deleted) return 'deleted';
    if (c.before == null) return 'added';
    if (c.kind === 'check') return c.before.status + ' → ' + c.after.status + (c.after.sev ? ' (' + c.after.sev + ')' : '');
    if (c.kind === 'req' && c.after.verify) return 'Verify: ' + c.before.verify + ' → ' + c.after.verify;
    return 'edited';
  }

  function renderTimeline() {
    var bs = blocks(), h = '', lastDay = '';
    bs.forEach(function (b) {
      var day = dayOf(b.end);
      if (day !== lastDay) { h += '<li class="day">' + esc(day) + '</li>'; lastDay = day; }
      var p = PEOPLE[b.by] || {}, open = !!ui.open[b.id], sel = ui.sel && ui.sel.type === 'block' && ui.sel.id === b.id;
      var span = b.changes.length > 1 ? clock(b.start) + '–' + clock(b.end) : clock(b.end);
      h += '<li class="blk' + (open ? ' open' : '') + (sel ? ' sel' : '') + '" data-block="' + b.id + '">' + gutter(b) +
        '<div class="blk-body"><button class="blk-head" data-act="block" data-id="' + b.id + '" aria-expanded="' + open + '">' + CHEV +
        '<span><span class="who">' + esc(b.by) + '</span><span class="role">' + esc(p.role || '') + '</span>' +
        (b.lane === 1 ? '<span class="tag conflict">Conflict copy</span>' : '') +
        (b.join ? '<span class="tag merge">Copy resolved</span>' : '') +
        '<br><span class="when">' + esc(span) + ' · ' + esc(ago(b.end)) + '</span>' +
        '<div class="counts">' + esc(counts(b)) + '</div></span></button>' +
        '<ul class="rows">' + b.changes.map(function (c) {
          var s = ui.sel && ui.sel.type === 'change' && ui.sel.id === c.id;
          return '<li class="row' + (s ? ' sel' : '') + '" data-act="change" data-id="' + c.id + '" tabindex="0"><span class="kind">' + esc(KINDS[c.kind]) + '</span>' +
            '<span class="what">' + esc(c.label) + (c.deleted ? '<span class="tag del">Deleted</span>' : '') + ' <span class="det">' + esc(rowDetail(c)) + '</span></span>' +
            '<time>' + esc(clock(c.at)) + '</time></li>';
        }).join('') + '</ul></div></li>';
    });
    $('tl').innerHTML = h || '<li class="empty">No changes of this kind.</li>';
    var people = {};
    all().forEach(function (c) { people[c.by] = 1; });
    $('tl-sub').textContent = bs.length + ' blocks, ' + bs.reduce(function (n, b) { return n + b.changes.length; }, 0) + ' changes, by ' + series(Object.keys(people)) + '.';
  }

  // Word-level diff (longest common subsequence). Enough for a lab; the real one would diff sentences first.
  function diffWords(a, b) {
    var x = String(a || '').split(/(\s+)/), y = String(b || '').split(/(\s+)/), n = x.length, m = y.length, i, j;
    var L = []; for (i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = [], push = function (t, s) { var l = out[out.length - 1]; if (l && l.t === t) l.s += s; else out.push({ t: t, s: s }); };
    i = 0; j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { push('=', x[i]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { push('-', x[i]); i++; }
      else { push('+', y[j]); j++; }
    }
    while (i < n) push('-', x[i++]);
    while (j < m) push('+', y[j++]);
    return out.map(function (p) {
      if (p.t === '=') return esc(p.s);
      var lead = p.s.match(/^\s*/)[0], core = p.s.slice(lead.length);
      return esc(lead) + (core ? (p.t === '+' ? '<ins>' : '<del>') + esc(core) + (p.t === '+' ? '</ins>' : '</del>') : '');
    }).join('');
  }

  function fields(o) { return Object.keys(o || {}).map(function (k) { return k + ': ' + o[k]; }).join('\n'); }

  function changeHtml(c, showWho) {
    var p = PEOPLE[c.by] || {}, body;
    if (typeof c.after === 'string' || typeof c.before === 'string') body = '<div class="diff">' + diffWords(c.before || '', c.after || '') + '</div>';
    else if (c.before == null) body = '<div class="diff">' + diffWords('', fields(c.after)) + '</div>';
    else body = '<div class="diff">' + diffWords(fields(c.before), fields(c.after)) + '</div>';
    return '<div class="chg"><h3>' + esc(KINDS[c.kind]) + ': ' + esc(c.label) + (c.lane === 1 ? '<span class="tag conflict">Conflict copy</span>' : '') +
      (c.deleted ? '<span class="tag del">Deleted</span>' : '') + '</h3>' +
      '<p class="meta">' + (showWho ? esc(c.by) + ' · ' : '') + esc(clock(c.at)) + ', ' + esc(ago(c.at)) +
      (c.commit ? ' · synced by @' + esc(p.login) + ' in commit <code>' + esc(c.commit) + '</code>' : ' · not synced yet') + '</p>' +
      (c.note ? '<p class="meta">' + esc(c.note) + '</p>' : '') + body +
      (c.lane === 1 && copyOpen() ? resolveHtml()
        : '<div class="acts"><button class="btn" data-act="revert" data-id="' + c.id + '">Revert…</button><span class="stub">Stub</span></div>') + '</div>';
  }

  // ── Resolving the conflict copy ──
  // The section's text now, the copy's text, and the copy's sentences that aren't in the section: each
  // either changes a section sentence (most words shared) or is new (goes after the sentence before it).
  var SECTION = 'spec:buck', COPY = 'spec:buck~7c2';
  function copyOpen() { return !all().some(function (c) { return c.rec === COPY && c.deleted; }); }
  function latest(rec) {
    return all().filter(function (c) { return c.rec === rec; }).sort(function (a, b) { return b.at - a.at; })[0];
  }
  function sentences(t) { return String(t || '').split(/(?<=\.)\s+/).filter(Boolean); }
  function words(t) { return t.toLowerCase().split(/\s+/); }
  function likeness(a, b) {
    var wa = words(a), wb = words(b), n = 0;
    wa.forEach(function (w) { if (wb.indexOf(w) >= 0) n++; });
    return n / Math.max(wa.length, wb.length);
  }
  function resolvePlan() {
    var sec = sentences(latest(SECTION).after), cp = sentences(latest(COPY).after), anchor = sec.length - 1, items = [];
    cp.forEach(function (t) {
      var at = sec.indexOf(t);
      if (at >= 0) { anchor = at; return; }
      var best = -1, score = 0;
      sec.forEach(function (x, i) { var l = likeness(t, x); if (l > score) { score = l; best = i; } });
      if (score >= 0.6) { items.push({ mode: 'change', target: best, text: t }); anchor = best; }
      else items.push({ mode: 'add', after: anchor, text: t });
    });
    return { sec: sec, items: items };
  }
  function applyPicks(plan, picks) {
    var swap = {}, adds = {};
    plan.items.forEach(function (it, k) {
      if (!picks[k]) return;
      if (it.mode === 'change') swap[it.target] = it.text;
      else (adds[it.after] = adds[it.after] || []).push(it.text);
    });
    var out = (adds[-1] || []).slice();
    plan.sec.forEach(function (t, i) { out.push(swap[i] || t); out = out.concat(adds[i] || []); });
    return out.join(' ');
  }
  function resolveHtml() {
    var plan = resolvePlan(), sec = latest(SECTION), cp = latest(COPY);
    if (!ui.picks || ui.picks.length !== plan.items.length) ui.picks = plan.items.map(function (it) { return it.mode === 'add'; });
    return '<div class="resolve"><h4>Resolve the copy</h4>' +
      '<p class="meta">The section has ' + esc(sec.by) + '’s newer text. Pick what to keep from ' + esc(cp.by) + '’s copy.</p>' +
      (plan.items.length ? '<ul class="picks">' + plan.items.map(function (it, k) {
        var d = it.mode === 'change' ? diffWords(plan.sec[it.target], it.text) : diffWords('', it.text);
        return '<li><label><input type="checkbox" data-pick="' + k + '"' + (ui.picks[k] ? ' checked' : '') + '> ' +
          '<span class="pk-mode">' + (it.mode === 'change' ? 'Changes a sentence' : 'New sentence') + '</span></label>' +
          '<div class="diff">' + d + '</div></li>';
      }).join('') + '</ul>' : '<p class="meta">Everything in the copy is already in the section.</p>') +
      '<div class="acts">' +
      (plan.items.length ? '<button class="btn btn-primary" data-act="res-add">Add checked to section</button>' +
        '<button class="btn" data-act="res-use">Use the copy instead</button>' : '') +
      '<button class="btn" data-act="res-drop">Delete copy</button></div>' +
      '<p class="meta" style="margin-top:8px">Each one deletes the copy afterward. The copy and the section’s old text stay in the history, so any of it can be brought back.</p></div>';
  }
  var seq = 0;
  function youChange(fields) {
    return Object.assign({ id: 'n' + (++seq), m: 0, at: Date.now(), by: 'You', kind: 'spec', commit: null }, fields);
  }
  function resolve(how) {
    var plan = resolvePlan(), sec = latest(SECTION), cp = latest(COPY), text = null, note = '';
    if (how === 'add') {
      if (!ui.picks.some(Boolean)) { flash('Check at least one sentence to add, or use Delete copy.'); return; }
      text = applyPicks(plan, ui.picks); note = 'Took sentences from ' + cp.by + '’s conflict copy.';
    } else if (how === 'use') { text = cp.after; note = 'Replaced the text with ' + cp.by + '’s conflict copy. ' + sec.by + '’s text stays in the history.'; }
    var made = [];
    if (text != null && text !== sec.after) made.push(youChange({ rec: SECTION, label: '3V3 buck', before: sec.after, after: text, note: note }));
    made.push(youChange({ rec: COPY, label: '3V3 buck (conflict copy)', deleted: true, join: true, before: cp.after, after: null,
      note: how === 'drop' ? 'Deleted the copy without taking anything from it. This ends the branch.' : 'Deleted the copy after taking what was needed from it. This ends the branch.' }));
    made.forEach(function (c, i) { c.at += i; });   // the delete lands last
    ui.added = ui.added.concat(made); ui.picks = null;
    var b = blocks()[0]; ui.open[b.id] = true; ui.sel = { type: 'block', id: b.id };
    render();
    flash(how === 'drop' ? 'Copy deleted.' : 'Section updated and copy deleted.');
  }
  var flashTimer;
  function flash(t) {
    var el = $('flash'); el.textContent = t; el.classList.add('on');
    clearTimeout(flashTimer); flashTimer = setTimeout(function () { el.classList.remove('on'); }, 3500);
  }

  function renderPane() {
    var s = ui.sel, h = '';
    if (!s) { $('pane').innerHTML = '<p class="empty">Pick a block or a change on the left.</p>'; return; }
    if (s.type === 'change') {
      var c = all().filter(function (x) { return x.id === s.id; })[0];
      h = c ? changeHtml(c, true) : '';
    } else {
      var b = blocks().filter(function (x) { return x.id === s.id; })[0];
      if (!b) { ui.sel = null; renderPane(); return; }
      h = '<p class="meta"><b>' + esc(b.by) + '</b> · ' + esc(counts(b)) + ' · ' + esc(clock(b.start)) + (b.changes.length > 1 ? '–' + esc(clock(b.end)) : '') + '</p>' +
        b.changes.map(function (c) { return changeHtml(c, false); }).join('') +
        (b.changes.length > 1 ? '<div class="acts"><button class="btn" data-act="revert-block" data-id="' + b.id + '">Revert all ' + b.changes.length + '…</button><span class="stub">Stub</span></div>' : '');
    }
    $('pane').innerHTML = h;
  }

  function render() { renderTimeline(); renderPane(); }

  // Revert stub: says what it would write, and whether someone changed the record since.
  function later(c) {
    return all().filter(function (x) { return x.rec === c.rec && x.at > c.at; }).sort(function (a, b) { return b.at - a.at; })[0];
  }
  function revertText(c) {
    if (c.lane === 1) {
      var sec = c.label.replace(' (conflict copy)', '');
      return '<p>This edit lives only in the conflict copy. The section “' + esc(sec) + '” has the newer edit.</p>' +
        '<p>To keep any of it, copy what you need into the section. To drop it, delete the copy. Either way, nothing is lost: the copy stays in the history.</p>';
    }
    var what = c.before == null ? 'remove ' + KINDS[c.kind].toLowerCase() + ' “' + c.label + '”'
      : c.deleted ? 'bring back “' + c.label + '”'
      : 'put “' + c.label + '” back as it was before this change';
    var l = later(c);
    return '<p>This would ' + esc(what) + '. It’s saved as a <b>new edit by you</b>, so it syncs and shows up here like any other change. Nothing in git is rewritten.</p>' +
      (l ? '<p class="warnbox">' + esc(l.by) + ' changed it ' + esc(ago(l.at)) + ', after this change, so Revert would be refused. Look at that change first.</p>' : '');
  }
  function openDialog(html) { $('dlg-body').innerHTML = html; $('scrim').classList.add('on'); $('dlg-cancel').focus(); }
  function closeDialog() { $('scrim').classList.remove('on'); }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) { if (e.target === $('scrim')) closeDialog(); return; }
    var id = t.getAttribute('data-id'), act = t.getAttribute('data-act');
    if (act === 'block') { ui.open[id] = !ui.open[id]; ui.sel = { type: 'block', id: id }; render(); }
    else if (act === 'change') { ui.sel = { type: 'change', id: id }; render(); }
    else if (act === 'res-add') resolve('add');
    else if (act === 'res-use') resolve('use');
    else if (act === 'res-drop') resolve('drop');
    else if (act === 'revert') { openDialog(revertText(all().filter(function (x) { return x.id === id; })[0])); }
    else if (act === 'revert-block') {
      var b = blocks().filter(function (x) { return x.id === id; })[0];
      openDialog('<p>This would undo all ' + b.changes.length + ' changes in ' + esc(b.by) + '’s block, newest first, each as a new edit stamped now. A change someone else has edited since is left alone and listed.</p>');
    }
  });
  document.addEventListener('change', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-pick');
    if (k != null && ui.picks) ui.picks[+k] = e.target.checked;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDialog();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('row')) { e.preventDefault(); e.target.click(); }
  });
  $('dlg-cancel').addEventListener('click', closeDialog);

  $('filter').innerHTML = FILTERS.map(function (f) { return '<button data-f="' + f[0] + '" aria-pressed="' + (f[0] === ui.filter) + '">' + esc(f[1]) + '</button>'; }).join('');
  $('filter').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    ui.filter = b.getAttribute('data-f'); ui.sel = null;
    Array.prototype.forEach.call($('filter').children, function (x) { x.setAttribute('aria-pressed', x === b); });
    render();
  });
  $('window').addEventListener('change', function () { ui.win = +this.value; ui.open = {}; ui.sel = null; render(); });
  $('expand').addEventListener('click', function () {
    var all = blocks(), anyClosed = all.some(function (b) { return !ui.open[b.id]; });
    all.forEach(function (b) { ui.open[b.id] = anyClosed; });
    this.textContent = anyClosed ? 'Close all' : 'Open all';
    render();
  });

  // Theme: Auto follows the system; Light and Dark set data-theme, as the tools do.
  var THEMES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  $('theme').innerHTML = THEMES.map(function (t) { return '<button data-t="' + t[0] + '" aria-pressed="' + (t[0] === 'auto') + '">' + t[1] + '</button>'; }).join('');
  $('theme').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var t = b.getAttribute('data-t');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    Array.prototype.forEach.call($('theme').children, function (x) { x.setAttribute('aria-pressed', x === b); });
  });

  // Copy still open, or resolved as Morgan did; Reset drops what You did here.
  function showBranch() {
    ui.open = {}; ui.sel = null; ui.picks = null;
    blocks().forEach(function (b) { if (b.lane === 1) { ui.open[b.id] = true; ui.sel = { type: 'block', id: b.id }; } });
    render();
  }
  $('scenario').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    ui.scenario = b.getAttribute('data-s');
    Array.prototype.forEach.call($('scenario').children, function (x) { x.setAttribute('aria-pressed', x === b); });
    $('reset').hidden = ui.scenario !== 'open';
    showBranch();
  });
  $('reset').addEventListener('click', function () { ui.added = []; showBranch(); flash('Back to the open copy.'); });

  showBranch();
})();
