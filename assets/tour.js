/* Demo tour: a short guided path through the Smart Thermostat demo, across the Signoff tools.
   Every tool loads it (../signoff/assets/tour.js; the tools share one origin when hosted and when
   served locally). It does nothing outside ?demo. In the hub's and Signoff PL's sidebars it adds a
   Take the tour button, which opens an intro and then the tour's card. Its state is sessionStorage
   signoff.demo.tour: { step } while it runs, removed when the visitor ends it. sessionStorage
   belongs to the tab, which the tools share (they open each other in the same tab), so a tour
   left unfinished doesn't come back in a later visit or another tab. */
(function () {
  'use strict';
  if (!/[?&]demo\b/.test(location.search)) return;
  var KEY = 'signoff.demo.tour';
  var SRC = document.currentScript && document.currentScript.src;
  var NAMES = { signoff: 'the hub', signoff_pl: 'Signoff PL', ee_design_review: 'Signoff EE', me_design_review: 'Signoff ME',
    fw_design_review: 'Signoff FW', pcb_dfm: 'Fabcheck', partcheck: 'Partcheck', loom: 'Loom' };
  // A step's spot: what its card points at, ringed on the page (see spot() below). Candidates in order,
  // each a selector, or [selector, text it must contain]; the first one shown on the page wins, so a
  // step can point at the next thing to click as the visitor goes (the Revisions tab, then Tag as
  // revision). `group` rings a heading together with the card under it.
  var STEPS = [
    // at(): the page shows what the step is about (the tools switch boards, packages and harnesses
    // without a reload, so the URL alone can't tell); place names it for the card when it doesn't, and
    // fix() puts it right in the page. landing(): arriving from the step before by another way (Open in
    // Fabcheck), the page is already this step's, so the tour moves on to it.
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo7', title: 'A board’s design review',
      at: function () { return eeShows('main-pcba'); }, fix: function () { eeOpen('main-pcba'); }, place: 'the Main PCBA in Signoff EE',
      text: 'Signoff EE reviews a board against checklists, from schematic and layout to fab release and bring-up. Each board picks the checklists it needs, and its profile (mains, RF, certification…) sets aside the checks that don’t apply, so the list fits the design.',
      try: 'Click {Edit profile} to see every checklist that can be turned on for this board, and the profile tags. {Cancel} leaves it as it was.',
      spot: ['[data-act="edit-project"]', '.sheet #f-checklists'] },
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo7', title: 'Reviewing together',
      at: function () { return eeShows('main-pcba'); }, fix: function () { eeOpen('main-pcba'); }, place: 'the Main PCBA in Signoff EE',
      text: 'Everyone on the board works in the same review: checks are marked {Pass}, {Issue} or {N/A}, issues get a severity, a resolution and a comment thread, and @revnotes in a comment lists it for the next revision. {Recent discussion} collects the latest comments, including the issues Fabcheck raised.',
      try: 'Click one of the Fabcheck comments to open its issue, then click {Open in Fabcheck} in the issue’s panel.',
      // The board picture in EE's header opens Fabcheck too (.head-pic-img); ring the issue panel's button.
      spot: ['[data-act="open-fabcheck"]:not(.head-pic-img)', ['.section-title', 'Recent discussion', 'group']] },
    // Fabcheck's deep link to the Main PCBA's fixed demo run (pcb_dfm/demo/boards.js): the package opens
    // and runs on arrival, on Overview, where the stage animates the checks (Chris), and stays there
    // (a link with no place or check keeps its view; pcb_dfm applyLink).
    { tool: 'pcb_dfm', url: '../pcb_dfm/index.html?demo#/overview?run=rdemo1042b&project=pdemo7', title: 'The fab package, checked',
      text: 'Fabcheck reads the Gerbers, drill files, pick-and-place and BOM in the browser and checks them the way a board house and an assembler would, under the fab’s rules. Nothing is uploaded. This is the Main PCBA’s package: watch the stage light each layer as its checks run and pin what they find.',
      try: 'When the run finishes, the {Checks} cards sum up each kind of check, with its errors, warnings and info. {Next} goes to the errors on the board.',
      at: function () { return fabRun() === 'rdemo1042b'; }, place: 'the Main PCBA’s package in Fabcheck',
      spot: ['#stage', '.stage'] },
    // The same run on the Board tab, the CAM viewer. Signoff EE's Open in Fabcheck lands here (on a
    // linked check), so arriving that way skips the Overview step (landing).
    { tool: 'pcb_dfm', url: '../pcb_dfm/index.html?demo#/board?run=rdemo1042b&project=pdemo7', title: 'Errors in the CAM viewer',
      text: 'The {Board} tab is Fabcheck’s CAM viewer: every Gerber and drill layer drawn as the fab will see it, with the findings pinned where they are. The rail on the right lists them; this run has 4 errors.',
      try: 'Turn off {Warnings} and {Info} in the rail to leave only the errors (from a Signoff link, click {Show all} first), then click one: the board flies to it and turns on its layers. {Realistic} shows the board as built.',
      at: function () { return fabRun() === 'rdemo1042b'; }, place: 'the Main PCBA’s package in Fabcheck',
      landing: function () { return /^#\/board/.test(location.hash); },
      spot: ['[data-act="clear-focus"]', '.rail-list [data-act="board-finding"]:has(.dot.error)', '.sev-seg'] },
    // The Display & Sensor Board's run isn't tagged in the demo, so sending it gives the next step a
    // run to tag (the Main PCBA's is already B.1).
    { tool: 'pcb_dfm', url: '../pcb_dfm/index.html?demo#/overview?run=rdemo1043a&project=pdemo11', title: 'Send a run to Signoff EE',
      at: function () { return fabRun() === 'rdemo1043a'; }, place: 'the Display & Sensor Board’s package in Fabcheck',
      text: 'This is the Display & Sensor Board’s package, checked. {Send to Signoff EE} turns its errors and warnings into issues on the board’s Fabrication & Release checklist and keeps the run with the review. Sending again updates the same issues.',
      try: 'When its run finishes, check under {Send to Signoff EE} that the project is Display & Sensor Board, click {Send to Signoff EE}, then {Open in Signoff EE}.',
      spot: ['.filters:has([data-act="signoff-send"])', '[data-act="signoff-send"]', '[data-view="overview"]'] },
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo11', title: 'Tag the run as a revision',
      at: function () { return eeShows('display-sensor-board'); }, fix: function () { eeOpen('display-sensor-board'); }, place: 'the Display & Sensor Board in Signoff EE',
      text: 'Back in Signoff EE, the {Revisions} tab lists the board’s Fabcheck runs. Tagging one names the revision that went to the fab: its label, status, fab house, date and order, so everyone knows which package was built. (In a real review, the package zip can be downloaded here too.)',
      try: 'Open the {Revisions} tab, click the board’s run to open it, then click {Tag as revision}. If no run is listed, go back a step and send it.',
      spot: ['.sheet #v-label', '[data-act="rev-tag"]', '[data-act="rev-toggle"]', '[data-view="revisions"]'] },
    // Loom opens on its demo harness, an example for another made-up product, with the menu and the
    // parts pane folded away and the diagram fitted, so it's big enough to click (Chris). A selection
    // brings the parts pane back (loom/assets/app.js, unfoldForSelection).
    { tool: 'loom', url: '../loom/index.html?demo&project=hdemo1', title: 'Harness drawings',
      text: 'Loom draws any cable harness, from a two-wire pigtail to a full cable set: connectors, wires, splices, twisted pairs, shields, cables and bundles. From that one picture it makes the package a tech builds from: the wiring diagram, connector faces, wire list and BOM. This example harness, for another made-up product, has a bit of everything.',
      try: 'Click a connector, a wire or a cable: its Properties open on the right. Loom’s own guide walks through every feature on this harness.',
      guide: true,
      at: function () { var h = loomH(); return !!h && h.id === 'hdemo1'; }, fix: function () { var g = loomGuide(); if (g) g.demo(); }, place: 'Loom’s demo harness',
      enter: function () { var g = loomGuide(); if (g) { g.demo(); if (g.focus) g.focus(); } } },
    // Then the visitor builds the thermostat's own small harness beside it, from the Main PCBA's J1 as
    // Fabcheck's demo package has it (AC_N, AC_L), with the menu and parts pane back out. Each stage is
    // ticked off from the harness as it is (loomJ1 and friends below) and rings what to do next.
    { tool: 'loom', url: '../loom/index.html?demo', title: 'Build the thermostat’s harness',
      text: 'Now one of your own, next to the example: the thermostat’s mains leads, from the Main PCBA’s terminal block J1 to the electrical box. Loom reads J1 from the package Fabcheck checked, with its designator and net names.',
      // The first Loom step's ?project=hdemo1 would reopen the example on a reload; drop it here.
      enter: function () {
        try { if (/[?&]project=/.test(location.search)) history.replaceState(history.state, '', location.pathname + '?demo' + location.hash); } catch (e) { /* no history */ }
        var g = loomGuide(); if (g) { g.menu(); g.panels(); g.help(false); }
      },
      stages: [
        { text: 'Click {+} beside Harnesses in the menu. A new harness starts with two ends, P1 and P2.',
          done: function (h) { return !!h && h.id !== 'hdemo1'; },
          spot: function () { return ['.sidebar [data-act="new"]']; } },
        { text: 'Click {From a board}, pick the Main PCBA and {Add} J1. It arrives as P3, with its nets AC_N and AC_L as pin labels.',
          done: function (h) { return !!loomJ1(h); },
          // The board picker is a modal (.lm-modal), which findSpot looks inside while it's open.
          spot: function () { return ['[data-act="bm-add"][data-ref="J1"]', ['[data-act="bm-board"]', 'Main PCBA'], '#parts-pane [data-act="from-board"]', '[data-act="fold-parts"]']; } },
        { text: 'Select P2 and set its {Family} to {Flying leads} and {Leads} to 2: the leads to the electrical box.',
          done: function (h) { var f = loomLeads(h); return !!f && +f.pins === 2; },
          spot: function (h) {
            var p2 = loomNode(h, 'P2');
            if (!loomPicked(p2)) return [loomItem(p2)];
            return [p2.family === 'flying' ? '#parts-pane [data-f="n.pins"]' : '#parts-pane [data-f="n.family"]'];
          } },
        { text: 'Click P3’s pin 1 (AC_N), then lead 1 on P2. Do the same for pin 2.',
          done: function (h) { return loomWired(h) >= 2; },
          spot: function (h) { return [loomItem(loomJ1(h))]; } },
        { text: 'Select P1, the end you didn’t use, and press {Delete}.',
          done: function (h) { return !!h && !loomUnused(h); },
          spot: function (h) { return [loomItem(loomUnused(h))]; } }
      ],
      // Loom lays a harness out again as ends and wires are added, which can move a part off screen,
      // so the canvas fits whenever the harness gains or loses one.
      refit: true,
      done: 'That’s a harness. {Drawing} shows its sheet, ready for a tech.' },
    { tool: 'me_design_review', url: '../me_design_review/index.html?demo&project=mdemo5', title: 'The enclosure’s review',
      at: function () { return eeShows('enclosure'); }, fix: function () { eeOpen('enclosure'); }, place: 'the Enclosure in Signoff ME',
      text: 'Signoff ME reviews the Enclosure the same way, with mechanical checklists: part design and DFM, tolerancing, materials, drawings. Its requirements flow down from the product’s: look for ↑ on the {Requirements} tab.',
      try: 'Open {Findings} to see every issue in one list.' },
    { tool: 'partcheck', url: '../partcheck/index.html?demo', title: 'The package that goes to the molder',
      text: 'Partcheck checks that the models, drawings and BOM agree before they’re sent out. Here the back cover’s drawing and the BOM name different plastics, and the light pipe has no files.',
      try: 'In {Findings}, each chip opens the Signoff ME check it gives evidence for.' },
    { tool: 'fw_design_review', url: '../fw_design_review/index.html?demo&project=fdemo3&req=q3-1', title: 'The firmware, and a failing requirement',
      at: function () { return eeShows('thermostat-firmware'); }, place: 'the Thermostat Firmware in Signoff FW',
      text: 'Signoff FW reviews the firmware. This requirement flows down from the product’s ESD requirement, and it’s failing: at ±8 kV the touch controller stopped responding until the power was cycled.',
      try: 'Its panel is open: scroll it down to {Traced checks} for the checks it traces to, with the open issue.' },
    { tool: 'signoff_pl', url: '../signoff_pl/index.html?demo', title: 'The whole product',
      text: 'Signoff PL is the project lead’s view. The Smart Thermostat is a tree of Parts: the two boards, the firmware, the enclosure and the wall bracket, each linked to its review, plus purchased Parts. Rings show how much of each review is done, and the colored numbers are open issues. The failing firmware requirement shows on the product’s ESD requirement, next to the boards’ ESD issues.',
      try: 'Open the {Requirements} tab: the product’s ESD requirement, REQ-002, is failing with the firmware’s under it. (Clicking a Part first shows only that Part’s.) That’s the tour: explore anything, and {Reset demo} in a tool’s banner starts it over.',
      spot: ['[data-view="reqs"]:not(.on)'] }
  ];

  var V = STEPS.map(function (s) { return s.title; }).join('|');
  function folder() { var m = /\/([^\/]+)\/[^\/]*$/.exec(location.pathname); return m ? m[1] : ''; }
  // The state names its step by title and this script's version (V, the steps' titles), because the
  // tools load this file without a version stamp: just after a push, one page can run a cached copy
  // with other steps (Chris: the tour got confused). A page whose copy differs from the one that last
  // wrote the state fetches this file afresh and reloads, once per version; after that it finds the
  // step by its title.
  function get() {
    try {
      var s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (!s || typeof s.step !== 'number') return null;
      if (s.v && s.v !== V) {
        if (SRC && sessionStorage.getItem(KEY + '.fresh') !== s.v) {
          sessionStorage.setItem(KEY + '.fresh', s.v);
          fetch(SRC, { cache: 'reload' }).then(function () { location.reload(); }, function () { location.reload(); });
          return null;
        }
        for (var i = 0; i < STEPS.length; i++) if (STEPS[i].title === s.id) { s.step = i; break; }
        set(s);
      }
      return s.step >= 0 && s.step < STEPS.length ? s : null;
    } catch (e) { return null; }
  }
  function set(s) {
    try {
      if (s) { s.id = STEPS[s.step] ? STEPS[s.step].title : ''; s.v = V; sessionStorage.setItem(KEY, JSON.stringify(s)); }
      else sessionStorage.removeItem(KEY);
    } catch (e) { /* storage blocked */ }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // The review tools (EE, ME, FW share the engine): the board open in the sidebar, by its slug.
  function eeShows(slug) { var a = document.querySelector('.proj.active'); return !!a && a.getAttribute('data-slug') === slug; }
  function eeOpen(slug) { var b = document.querySelector('.proj[data-slug="' + slug + '"]'); if (b) b.click(); }
  // Fabcheck (pcb_dfm/assets/app.js, Fab.app): the run of the open package, while it runs too.
  function fabRun() {
    try {
      var s = window.Fab.app.state, e = s.pkgs.filter(function (x) { return x.id === s.active; })[0];
      return (e && ((e.run && e.run.id) || (e.expect && e.expect.run && e.expect.run.id) || (e.need && e.need.runId))) || '';
    } catch (err) { return ''; }
  }
  // Is this page the step's? Its tool, and what it shows (at), when the step says.
  function onStep(s) { if (!s || s.tool !== folder()) return false; if (!s.at) return true; try { return !!s.at(); } catch (e) { return false; } }
  // Loom's page (loom/assets/app.js, LM.app), for the Loom steps: its guide hooks and the open harness.
  function loomGuide() { try { return window.LM.app.guide; } catch (e) { return null; } }
  function loomH() { try { return window.LM.app.H(); } catch (e) { return null; } }
  function loomNode(h, ref) { return h ? h.nodes.filter(function (n) { return n.ref === ref && !n.board; })[0] || null : null; }
  function loomJ1(h) { return h ? h.nodes.filter(function (n) { return n.board && n.board.ref === 'J1' && n.board.name === 'Main PCBA'; })[0] || null : null; }
  function loomLeads(h) { return h ? h.nodes.filter(function (n) { return n.kind === 'connector' && !n.board && n.family === 'flying'; })[0] || null : null; }
  function loomWired(h) {
    var j = loomJ1(h), f = loomLeads(h);
    return j && f ? h.wires.filter(function (w) { return (w.from.node === j.id && w.to.node === f.id) || (w.to.node === j.id && w.from.node === f.id); }).length : 0;
  }
  function loomUnused(h) {
    return h ? h.nodes.filter(function (n) { return n.kind === 'connector' && !h.wires.some(function (w) { return w.from.node === n.id || w.to.node === n.id; }); })[0] || null : null;
  }
  function loomItem(n) { return n ? '[data-item="n:' + n.id + '"]' : null; }
  function loomPicked(n) { try { var s = window.LM.app.state.sel; return !!n && !!s && s.kind === 'node' && s.ids.has(n.id); } catch (e) { return false; } }
  // A step with stages: the first one not done (stages.length when all are).
  function stageAt(s) {
    var h = loomH();
    for (var i = 0; i < s.stages.length; i++) { var ok = false; try { ok = s.stages[i].done(h); } catch (e) { /* page not ready */ } if (!ok) return i; }
    return s.stages.length;
  }
  // What a step rings now: its stage's spot, its spot function's or its spot list.
  function spotList(s) {
    var l = null;
    try {
      if (s.stages) { var i = stageAt(s); l = i < s.stages.length ? s.stages[i].spot(loomH()) : []; }
      else l = typeof s.spot === 'function' ? s.spot() : s.spot;
    } catch (e) { l = null; }
    return (l || []).filter(Boolean);
  }
  // A step's text names buttons and tabs in braces, drawn as chips so "Edit profile shows…" doesn't read
  // as a sentence (Chris).
  function marks(s) { return esc(s).replace(/\{([^{}]+)\}/g, '<span class="t-ui">$1</span>'); }
  // A step's page, from wherever this page is: every tool is a sibling folder.
  function href(step) { return folder() === 'signoff' || folder() ? STEPS[step].url : STEPS[step].url.replace(/^\.\.\//, ''); }

  // The card and its ring sit over the tools' sheets (z-index 60), so a step can point into one.
  // Colors are the suite's theme tokens (every tool loads the engine's styles or suite.css), so the
  // card follows light and dark mode; the fallbacks are the light theme's.
  var css = '.tour{position:fixed;left:16px;bottom:16px;z-index:75;width:340px;max-width:calc(100vw - 32px);box-sizing:border-box;' +
    'background:var(--bg-elev,#fff);color:var(--text,#1d1d1f);border:1px solid var(--hair-2,rgba(0,0,0,.14));border-radius:14px;' +
    'box-shadow:var(--shadow-lg,0 24px 64px rgba(0,0,0,.18));padding:14px 16px;font:13px/1.45 var(--sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}' +
    '.tour .t-top{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent,#00727f);font-weight:600}' +
    '.tour .t-top span{flex:1}.tour .t-x{background:none;border:0;color:var(--text-3,#86868b);cursor:pointer;font-size:12px;padding:2px 4px}.tour .t-x:hover{color:var(--text,#1d1d1f)}' +
    '.tour h3{margin:0 0 6px;font-size:15px;color:var(--text,#1d1d1f)}.tour p{margin:0 0 8px;color:var(--text-2,#515154)}.tour .t-try{color:var(--text,#1d1d1f);font-weight:500}' +
    '.tour .t-ui{display:inline-block;padding:0 6px;border:1px solid var(--hair-2,rgba(0,0,0,.14));border-radius:6px;background:var(--bg,#f5f5f7);font-size:.92em;font-weight:600;line-height:1.45;white-space:nowrap;color:var(--text,#1d1d1f)}' +
    '.tour .t-dots{display:flex;gap:4px;margin:10px 0}.tour .t-dots i{flex:1;height:3px;border-radius:2px;background:var(--hair-2,rgba(0,0,0,.14))}.tour .t-dots i.on{background:var(--accent,#00727f)}' +
    '.tour .t-act,.tour-intro .t-act{display:flex;gap:8px;justify-content:flex-end}' +
    '.tour button.t-b,.tour-intro button.t-b{border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer;border:1px solid var(--hair-2,rgba(0,0,0,.14));background:transparent;color:var(--text,#1d1d1f)}' +
    '.tour button.t-b.p,.tour-intro button.t-b.p{background:var(--accent,#00727f);border-color:transparent;color:#fff}' +
    '.tour.min{width:auto;padding:8px 12px;cursor:pointer}' +
    // When the ring would sit under the card, the card moves to the bottom right (placeCard).
    '.tour.side{left:auto;right:16px}.tour.top{left:auto;right:16px;bottom:auto;top:72px}' +
    '.tour ol.t-stages{margin:0 0 8px;padding-left:20px}.tour ol.t-stages li{margin:0 0 4px;color:var(--text-3,#86868b)}' +
    '.tour ol.t-stages li.now{color:var(--text,#1d1d1f);font-weight:500}.tour ol.t-stages li.done{color:var(--text-2,#515154)}.tour ol.t-stages b{color:var(--accent,#00727f)}' +
    '.tour-scrim{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.tour-intro{width:560px;max-width:100%;max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;background:var(--bg-elev,#fff);color:var(--text,#1d1d1f);' +
    'border-radius:16px;box-shadow:var(--shadow-lg,0 24px 64px rgba(0,0,0,.18));padding:22px 24px;font:14px/1.5 var(--sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}' +
    '.tour-intro h2{margin:0 0 6px;font-size:19px}.tour-intro p{margin:0 0 12px;color:var(--text-2,#515154)}' +
    '.tour-intro ol{margin:0 0 18px;padding-left:20px}.tour-intro li{margin:0 0 3px}.tour-intro li span{color:var(--text-3,#86868b)}' +
    '.tour-side{margin:6px 0 10px}' +
    '.tour-link{width:calc(100% - 20px);box-sizing:border-box;border:0;font:inherit;text-align:left;cursor:pointer;background:var(--accent-soft,rgba(0,114,127,.1));color:var(--text,#1d1d1f);animation:tour-breathe 2.4s ease-in-out infinite}' +
    '.tour-link:hover{background:var(--accent-soft,rgba(0,114,127,.1));filter:brightness(1.04)}' +
    '@keyframes tour-breathe{50%{box-shadow:0 0 0 4px var(--accent-soft,rgba(0,114,127,.1))}}' +
    '.tour-spot{position:fixed;z-index:74;pointer-events:none;border:2px solid var(--accent,#00727f);border-radius:12px;box-sizing:border-box;' +
    'box-shadow:0 0 0 4px var(--accent-soft,rgba(0,114,127,.18));animation:tour-spot 1.8s ease-in-out infinite}' +
    '@keyframes tour-spot{50%{box-shadow:0 0 0 9px var(--accent-soft,rgba(0,114,127,.1))}}' +
    // While Loom's guide runs (it adds .lm-guide-on), it has the floor.
    '.lm-guide-on .tour,.lm-guide-on .tour-spot{display:none}' +
    '@media (prefers-reduced-motion:reduce){.tour-link,.tour-spot{animation:none}}';

  function style() { if (document.getElementById('tour-css')) return; var s = document.createElement('style'); s.id = 'tour-css'; s.textContent = css; document.head.appendChild(s); }

  // To a step: on this page already (same tool, and every parameter of the step's URL is in this
  // one), only the card changes; otherwise its page opens.
  // A step whose URL has a hash (Fabcheck's routes) is the same page only with that hash too; one
  // that differs from this page only in the hash is reached without a reload, so the card is redrawn
  // here.
  function go(step) {
    set({ step: step });
    var want = new URL(href(step), location.href), here = new URL(location.href);
    var s = STEPS[step], tool = s.tool === folder();
    var same = tool && Array.from(want.searchParams.keys()).every(function (k) { return here.searchParams.get(k) === want.searchParams.get(k); }) &&
      (!want.hash || want.hash === here.hash);
    // The right tool showing something else (another board, package or harness): put it right in the
    // page when the step can, else open the step's page again (Chris: the tour got stuck after
    // clicking around, since the address still matched).
    if (tool && !onStep(s) && s.fix) { try { s.fix(); } catch (e) { /* page not ready */ } card(); }
    else if (same && onStep(s)) card();
    else if (want.hash && want.pathname === here.pathname && want.search === here.search) {
      if (want.hash === here.hash) location.reload(); else { location.hash = want.hash; card(); }
    }
    else location.href = want.href;
  }

  // The spot: a ring over what the step's card points at, drawn as its own element over the page
  // (the tools redraw their pages with innerHTML, which would wipe a class on the target) and moved
  // every frame to follow it. While a sheet or modal is open, only a target inside it is ringed. A
  // new target off screen is scrolled into view once.
  var spotRaf = 0, spotWas = null, refitWas = '';
  function shown(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function findSpot(list) {
    var modal = document.querySelector('.sheet-wrap .sheet, .lm-modal-back:not([hidden]) .lm-modal');
    for (var i = 0; i < list.length; i++) {
      var c = typeof list[i] === 'string' ? [list[i]] : list[i], els = [];
      try { els = document.querySelectorAll(c[0]); } catch (e) { /* a selector this browser can't read */ }
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (!shown(el) || (c[1] && el.textContent.indexOf(c[1]) < 0) || (modal && !modal.contains(el))) continue;
        return { el: el, group: c[2] === 'group' };
      }
    }
    return null;
  }
  function spotTick() {
    spotRaf = 0;
    var st = get(), s = st && !st.min && STEPS[st.step], here = onStep(s), ring = document.getElementById('tour-spot');
    // A stage done on the page: redraw the card, which ticks it off and starts this again.
    if (here && s.stages && stageAt(s) !== stageShown) { card(); return; }
    if (here && s.refit) {
      var lh = loomH(), sig = lh ? lh.id + ':' + lh.nodes.length + ':' + lh.wires.length : '';
      if (sig !== refitWas) { if (refitWas && sig) setTimeout(function () { var g = loomGuide(); if (g) g.fit(); }, 80); refitWas = sig; }
    }
    var f = here && (s.spot || s.stages) ? findSpot(spotList(s)) : null;
    if (!f) { if (ring) ring.remove(); spotWas = null; placeCard(null); if (s && (s.spot || s.stages)) spotRaf = requestAnimationFrame(spotTick); return; }
    var r = f.el.getBoundingClientRect(), x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    var nx = f.group && f.el.nextElementSibling;
    if (nx && shown(nx)) { var q = nx.getBoundingClientRect(); x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    if (!ring) { ring = document.createElement('div'); ring.id = 'tour-spot'; ring.className = 'tour-spot'; ring.setAttribute('aria-hidden', 'true'); document.body.appendChild(ring); }
    var pad = 5;
    ring.style.left = (x0 - pad) + 'px'; ring.style.top = (y0 - pad) + 'px';
    ring.style.width = (x1 - x0 + pad * 2) + 'px'; ring.style.height = (y1 - y0 + pad * 2) + 'px';
    placeCard({ left: x0 - pad, top: y0 - pad, right: x1 + pad, bottom: y1 + pad });
    if (spotWas !== f.el) {
      spotWas = f.el;
      if (y0 < 0 || y1 > innerHeight || x0 < 0 || x1 > innerWidth) f.el.scrollIntoView({ block: y1 - y0 > innerHeight * 0.6 ? 'start' : 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    spotRaf = requestAnimationFrame(spotTick);
  }
  function spot() { spotWas = null; if (!spotRaf) spotRaf = requestAnimationFrame(spotTick); }
  // The card sits at the bottom left, or moves to the bottom right or the top right while its home
  // would cover the ring or come within GAP of it (Chris: it covered what a step pointed at, such as
  // Fabcheck's Project picker); with no clear corner, the one that covers least.
  var GAP = 24;
  function placeCard(r) {
    var el = document.getElementById('tour');
    if (!el || el.classList.contains('min')) return;
    var w = el.offsetWidth, ht = el.offsetHeight, W = innerWidth, H = innerHeight;
    var spots = [['', 16, H - 16 - ht], ['side', W - 16 - w, H - 16 - ht], ['top', W - 16 - w, 72]];
    var cover = function (x, y) {
      if (!r) return 0;
      var dx = Math.min(x + w, r.right + GAP) - Math.max(x, r.left - GAP), dy = Math.min(y + ht, r.bottom + GAP) - Math.max(y, r.top - GAP);
      return dx > 0 && dy > 0 ? dx * dy : 0;
    };
    var best = spots[0], least = Infinity;
    for (var i = 0; i < spots.length; i++) { var c = cover(spots[i][1], spots[i][2]); if (c < least) { least = c; best = spots[i]; } if (!c) break; }
    ['side', 'top'].forEach(function (k) { if (el.classList.contains(k) !== (best[0] === k)) el.classList.toggle(k, best[0] === k); });
  }

  // entered: the step whose enter() last ran on this page; stageShown: the stage the card shows;
  // shownKey: the page the card was drawn for (pageKey), which watch() compares twice a second, so
  // the card follows a board, package, harness or route changed inside a tool.
  var entered = -1, stageShown = -1, shownKey = '';
  function pageKey() { var st = get(), s = st && STEPS[st.step]; return location.href + '|' + (st ? st.step + ':' + onStep(s) : ''); }
  function watch() { var st = get(); if (st && !st.min && pageKey() !== shownKey) card(); }
  function card() {
    var st = get(), el = document.getElementById('tour');
    spot();
    if (!st) { if (el) el.remove(); return; }
    // Arriving at the next step's tool another way (Open in Fabcheck, a sidebar link): move on.
    var here = folder();
    if (STEPS[st.step].tool !== here && STEPS[st.step + 1] && STEPS[st.step + 1].tool === here) {
      st.step++;
      while (STEPS[st.step + 1] && STEPS[st.step + 1].tool === here && STEPS[st.step + 1].landing && STEPS[st.step + 1].landing()) st.step++;
      set(st);
    }
    var s = STEPS[st.step], atStep = onStep(s), last = st.step === STEPS.length - 1;
    shownKey = pageKey();
    // A step's enter() sets its page up once on arrival (Loom folds or shows its panels).
    if (!atStep) entered = -1;
    else if (entered !== st.step) { entered = st.step; if (s.enter) { try { s.enter(); } catch (e) { /* page not ready */ } } }
    var at = atStep && s.stages ? stageAt(s) : -1;
    stageShown = at;
    var tryHtml = !atStep ? '' : s.stages
      ? '<ol class="t-stages">' + s.stages.map(function (x, i) { return '<li class="' + (i < at ? 'done' : i === at ? 'now' : '') + '">' + (i < at ? '<b>✓</b> ' : '') + marks(x.text) + '</li>'; }).join('') + '</ol>' +
        (at >= s.stages.length && s.done ? '<p class="t-try">' + marks(s.done) + '</p>' : '')
      : '<p class="t-try">' + marks(s.try) + '</p>';
    if (!el) { el = document.createElement('div'); el.id = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Demo tour'); document.body.appendChild(el); }
    el.className = 'tour' + (st.min ? ' min' : '');
    if (st.min) { el.innerHTML = '<b>Tour</b> · ' + (st.step + 1) + ' of ' + STEPS.length + ' ▴'; el.onclick = function () { st.min = false; set(st); card(); }; return; }
    el.onclick = null;
    // Loom's own guide (loom/assets/guide.js, window.LoomGuide) takes over from the Loom step.
    var guide = atStep && s.guide && window.LoomGuide;
    // Loom's How it works card opens on a first visit over the Add palette, where the step's
    // From a board is; close it as Loom's guide does (LM.app.guide.help).
    if (guide) { try { window.LM.app.guide.help(false); } catch (e) { /* Loom not ready */ } }
    el.innerHTML = '<div class="t-top"><span>Demo tour · ' + (st.step + 1) + ' of ' + STEPS.length + '</span>' +
      '<button class="t-x" data-t="min" title="Shrink the tour">▾</button><button class="t-x" data-t="end" title="End the tour">✕</button></div>' +
      '<h3>' + esc(s.title) + '</h3>' +
      (atStep ? '<p>' + marks(s.text) + '</p>' + tryHtml
        : '<p>This step is on ' + esc(s.place && s.tool === here ? s.place : NAMES[s.tool] || s.tool) + '.</p>') +
      (guide ? '<p><button class="t-b" data-t="guide">Open Loom’s guide</button></p>' : '') +
      '<div class="t-dots">' + STEPS.map(function (x, i) { return '<i class="' + (i <= st.step ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="t-act">' + (st.step > 0 ? '<button class="t-b" data-t="back">Back</button>' : '') +
      (atStep ? (last ? '<button class="t-b p" data-t="end">Finish</button>' : '<button class="t-b p" data-t="next">Next</button>')
        : '<button class="t-b" data-t="here">Go there</button>' + (last ? '' : '<button class="t-b p" data-t="next">Next</button>')) + '</div>';
    el.querySelectorAll('[data-t]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var t = b.getAttribute('data-t');
        if (t === 'end') { set(null); card(); }
        else if (t === 'min') { st.min = true; set(st); card(); }
        else if (t === 'here') go(st.step);
        else if (t === 'back') go(st.step - 1);
        else if (t === 'next') go(st.step + 1);
        else if (t === 'guide') window.LoomGuide.start();
      });
    });
  }

  // The intro: what the demo is and where the tour goes, then Start.
  function intro() {
    if (document.querySelector('.tour-scrim')) return;
    var scrim = document.createElement('div');
    scrim.className = 'tour-scrim';
    scrim.innerHTML = '<div class="tour-intro" role="dialog" aria-modal="true" aria-label="Demo tour"><h2>A 10-minute tour of the demo</h2>' +
      '<p>Every tool in this demo shows the same made-up product, a Smart Thermostat for Acme Climate, part way through its first engineering build. The tour follows it from tool to tool:</p>' +
      '<ol>' + STEPS.map(function (s) { return '<li><b>' + esc(s.title) + '</b> <span>· ' + esc(NAMES[s.tool]) + '</span></li>'; }).join('') + '</ol>' +
      '<p>Nothing you change leaves this browser. You can leave the tour at any step and look around.</p>' +
      '<div class="t-act"><button class="t-b" data-t="close">Not now</button><button class="t-b p" data-t="start">Start the tour</button></div></div>';
    document.body.appendChild(scrim);
    function close() { scrim.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    scrim.addEventListener('click', function (e) {
      var t = e.target.closest('[data-t]');
      if (e.target === scrim || (t && t.getAttribute('data-t') === 'close')) close();
      else if (t && t.getAttribute('data-t') === 'start') { close(); start(); }
    });
    var b = scrim.querySelector('[data-t="start"]'); if (b) b.focus();
  }
  // From the first step's own page, no reload: the card just appears.
  // The review tools' demo welcome sheet (signoff.demo.welcomed) would cover the first step, so the
  // tour counts as the welcome.
  function start() {
    try { localStorage.setItem('signoff.demo.welcomed', '1'); } catch (e) { /* storage blocked */ }
    if (folder() === STEPS[0].tool) { set({ step: 0 }); card(); } else go(0);
  }

  // The hub and Signoff PL: a Demo section in the sidebar with a Take the tour button, over the
  // list of tools (on the hub, under Home; in PL, over the Dovetail Signoff links).
  function sideButton() {
    var at = document.querySelector('.sidebar #side-tools') || document.querySelector('.sidebar .side-nav .side-head');
    if (!at || document.getElementById('tour-link')) return;
    var b = document.createElement('button');
    b.id = 'tour-link'; b.type = 'button'; b.className = 'side-link tour-link';
    b.title = 'A 10-minute tour of the demo, from tool to tool';
    b.innerHTML = '<span class="tool-mark"><svg viewBox="0 0 18 18" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="7"/><path d="M11.8 6.2 10 10l-3.8 1.8L8 8z"/></svg></span>' +
      '<span>Take the tour<small>10 minutes through the demo</small></span>';
    b.addEventListener('click', intro);
    var sec = document.createElement('div');
    sec.className = 'tour-side';
    sec.innerHTML = '<div class="side-head"><span class="side-label">Demo</span></div>';
    sec.appendChild(b);
    at.parentNode.insertBefore(sec, at);
  }

  function init() {
    style();
    if (folder() === 'signoff' || folder() === 'signoff_pl') sideButton();
    // An older version kept the tour in localStorage, where an unfinished one came back later.
    try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
    card();
    setInterval(watch, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.SignoffTour = { start: start, intro: intro, end: function () { set(null); card(); } };
})();
