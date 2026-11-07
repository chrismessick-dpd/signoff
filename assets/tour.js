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
  var NAMES = { signoff: 'the hub', signoff_pl: 'Signoff PL', ee_design_review: 'Signoff EE', me_design_review: 'Signoff ME',
    fw_design_review: 'Signoff FW', pcb_dfm: 'Fabcheck', partcheck: 'Partcheck', loom: 'Loom' };
  // A step's spot: what its card points at, ringed on the page (see spot() below). Candidates in order,
  // each a selector, or [selector, text it must contain]; the first one shown on the page wins, so a
  // step can point at the next thing to click as the visitor goes (the Revisions tab, then Tag as
  // revision). `group` rings a heading together with the card under it.
  var STEPS = [
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo7', title: 'A board’s design review',
      text: 'Signoff EE reviews a board against checklists, from schematic and layout to fab release and bring-up. Each board picks the checklists it needs, and its profile (mains, RF, certification…) sets aside the checks that don’t apply, so the list fits the design.',
      try: 'Click Edit profile to see every checklist that can be turned on for this board, and the profile tags. Cancel leaves it as it was.',
      spot: ['[data-act="edit-project"]', '.sheet #f-checklists'] },
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo7', title: 'Reviewing together',
      text: 'Everyone on the board works in the same review: checks are marked Pass, Issue or N/A, issues get a severity, a resolution and a comment thread, and @revnotes in a comment lists it for the next revision. Recent discussion collects the latest comments, including the issues Fabcheck raised.',
      try: 'Click one of the Fabcheck comments to open its issue, then click Open in Fabcheck in the issue’s panel.',
      spot: ['[data-act="open-fabcheck"]', ['.section-title', 'Recent discussion', 'group']] },
    // Fabcheck's deep link to the Main PCBA's fixed demo run (pcb_dfm/demo/boards.js): the board opens
    // and runs on arrival. Signoff EE's Open in Fabcheck lands here too.
    { tool: 'pcb_dfm', url: '../pcb_dfm/index.html?demo#/board?run=rdemo1042b&project=pdemo7', title: 'The fab package, checked',
      text: 'Fabcheck reads the Gerbers, drill files, pick-and-place and BOM in the browser and checks them the way a board house and an assembler would, under the fab’s rules. Nothing is uploaded. This is the Main PCBA’s run, the one its Fabcheck issues came from.',
      try: 'Look through Findings and click one to zoom to it on the board. Next opens the other board’s package.' },
    // The Display & Sensor Board's run isn't tagged in the demo, so sending it gives the next step a
    // run to tag (the Main PCBA's is already B.1).
    { tool: 'pcb_dfm', url: '../pcb_dfm/index.html?demo#/board?run=rdemo1043a&project=pdemo11', title: 'Send a run to Signoff EE',
      text: 'This is the Display & Sensor Board’s package, checked. Send to Signoff EE turns its errors and warnings into issues on the board’s Fabrication & Release checklist and keeps the run with the review. Sending again updates the same issues.',
      try: 'On the Overview tab, check that the project is Display & Sensor Board, click Send to Signoff EE, then Open in Signoff EE.',
      spot: ['[data-act="signoff-send"]', '[data-view="overview"]'] },
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo11', title: 'Tag the run as a revision',
      text: 'Back in Signoff EE, the Revisions tab lists the board’s Fabcheck runs. Tagging one names the revision that went to the fab: its label, status, fab house, date and order, so everyone knows which package was built. (In a real review, the package zip can be downloaded here too.)',
      try: 'Open the Revisions tab, click the run you sent to open it, then click Tag as revision. If no run is listed, go back a step and send it.',
      spot: ['.sheet #v-label', '[data-act="rev-tag"]', '[data-act="rev-toggle"]', '[data-view="revisions"]'] },
    { tool: 'loom', url: '../loom/index.html?demo', title: 'The harness between the boards',
      text: 'Loom draws the cable harness a tech builds from: connectors, wires, splices, twisted pairs, shields, cables and bundles, then the wiring diagram, wire list and BOM. This one joins the Main PCBA to the Display & Sensor Board and the remote sensor. Pin labels are the boards’ net names, read from the packages Fabcheck checked.',
      try: 'Click a connector, a wire or a cable to see its properties. Loom’s own guide walks through every feature.',
      guide: true },
    { tool: 'me_design_review', url: '../me_design_review/index.html?demo&project=mdemo5', title: 'The enclosure’s review',
      text: 'Signoff ME reviews the Enclosure the same way, with mechanical checklists: part design and DFM, tolerancing, materials, drawings. Its requirements flow down from the product’s: look for ↑ on the Requirements tab.',
      try: 'Open Findings to see every issue in one list.' },
    { tool: 'partcheck', url: '../partcheck/index.html?demo', title: 'The package that goes to the molder',
      text: 'Partcheck checks that the models, drawings and BOM agree before they’re sent out. Here the back cover’s drawing and the BOM name different plastics, and the light pipe has no files.',
      try: 'In Findings, each chip opens the Signoff ME check it gives evidence for.' },
    { tool: 'fw_design_review', url: '../fw_design_review/index.html?demo&project=fdemo3&req=q3-1', title: 'The firmware, and a failing requirement',
      text: 'Signoff FW reviews the firmware. This requirement flows down from the product’s ESD requirement, and it’s failing: at ±8 kV the touch controller stopped responding until the power was cycled.',
      try: 'The checks it traces to are listed under it, with the open issue.' },
    { tool: 'signoff_pl', url: '../signoff_pl/index.html?demo', title: 'The whole product',
      text: 'Signoff PL is the project lead’s view. The Smart Thermostat is a tree of Parts: the two boards, the firmware, the enclosure and the wall bracket, each linked to its review, plus purchased Parts. Rings show how much of each review is done, and the colored numbers are open issues. The failing firmware requirement shows on the product’s ESD requirement, next to the boards’ ESD issues.',
      try: 'Click a Part, then open the Requirements tab. That’s the tour: explore anything, and Reset demo in any tool starts it over.' }
  ];

  function folder() { var m = /\/([^\/]+)\/[^\/]*$/.exec(location.pathname); return m ? m[1] : ''; }
  function get() { try { var s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && typeof s.step === 'number' && s.step >= 0 && s.step < STEPS.length ? s : null; } catch (e) { return null; } }
  function set(s) { try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
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
    '.tour .t-dots{display:flex;gap:4px;margin:10px 0}.tour .t-dots i{flex:1;height:3px;border-radius:2px;background:var(--hair-2,rgba(0,0,0,.14))}.tour .t-dots i.on{background:var(--accent,#00727f)}' +
    '.tour .t-act,.tour-intro .t-act{display:flex;gap:8px;justify-content:flex-end}' +
    '.tour button.t-b,.tour-intro button.t-b{border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer;border:1px solid var(--hair-2,rgba(0,0,0,.14));background:transparent;color:var(--text,#1d1d1f)}' +
    '.tour button.t-b.p,.tour-intro button.t-b.p{background:var(--accent,#00727f);border-color:transparent;color:#fff}' +
    '.tour.min{width:auto;padding:8px 12px;cursor:pointer}' +
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
    var same = STEPS[step].tool === folder() && Array.from(want.searchParams.keys()).every(function (k) { return here.searchParams.get(k) === want.searchParams.get(k); }) &&
      (!want.hash || want.hash === here.hash);
    if (same) card();
    else if (want.hash && want.pathname === here.pathname && want.search === here.search) { location.hash = want.hash; card(); }
    else location.href = want.href;
  }

  // The spot: a ring over what the step's card points at, drawn as its own element over the page
  // (the tools redraw their pages with innerHTML, which would wipe a class on the target) and moved
  // every frame to follow it. While a sheet or modal is open, only a target inside it is ringed. A
  // new target off screen is scrolled into view once.
  var spotRaf = 0, spotWas = null;
  function shown(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function findSpot(list) {
    var modal = document.querySelector('.sheet-wrap .sheet, .lm-modal-back:not([hidden]) .lm-modal');
    for (var i = 0; i < list.length; i++) {
      var c = typeof list[i] === 'string' ? [list[i]] : list[i], els = document.querySelectorAll(c[0]);
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
    var st = get(), s = st && !st.min && STEPS[st.step], ring = document.getElementById('tour-spot');
    var f = s && s.spot && s.tool === folder() ? findSpot(s.spot) : null;
    if (!f) { if (ring) ring.remove(); spotWas = null; if (s && s.spot) spotRaf = requestAnimationFrame(spotTick); return; }
    var r = f.el.getBoundingClientRect(), x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    var nx = f.group && f.el.nextElementSibling;
    if (nx && shown(nx)) { var q = nx.getBoundingClientRect(); x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    if (!ring) { ring = document.createElement('div'); ring.id = 'tour-spot'; ring.className = 'tour-spot'; ring.setAttribute('aria-hidden', 'true'); document.body.appendChild(ring); }
    var pad = 5;
    ring.style.left = (x0 - pad) + 'px'; ring.style.top = (y0 - pad) + 'px';
    ring.style.width = (x1 - x0 + pad * 2) + 'px'; ring.style.height = (y1 - y0 + pad * 2) + 'px';
    if (spotWas !== f.el) {
      spotWas = f.el;
      if (y0 < 0 || y1 > innerHeight || x0 < 0 || x1 > innerWidth) f.el.scrollIntoView({ block: y1 - y0 > innerHeight * 0.6 ? 'start' : 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    spotRaf = requestAnimationFrame(spotTick);
  }
  function spot() { spotWas = null; if (!spotRaf) spotRaf = requestAnimationFrame(spotTick); }

  function card() {
    var st = get(), el = document.getElementById('tour');
    spot();
    if (!st) { if (el) el.remove(); return; }
    // Arriving at the next step's tool another way (Open in Fabcheck, a sidebar link): move on.
    var here = folder();
    if (STEPS[st.step].tool !== here && STEPS[st.step + 1] && STEPS[st.step + 1].tool === here) { st.step++; set(st); }
    var s = STEPS[st.step], atStep = s.tool === here, last = st.step === STEPS.length - 1;
    if (!el) { el = document.createElement('div'); el.id = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Demo tour'); document.body.appendChild(el); }
    el.className = 'tour' + (st.min ? ' min' : '');
    if (st.min) { el.innerHTML = '<b>Tour</b> · ' + (st.step + 1) + ' of ' + STEPS.length + ' ▴'; el.onclick = function () { st.min = false; set(st); card(); }; return; }
    el.onclick = null;
    // Loom's own guide (loom/assets/guide.js, window.LoomGuide) takes over from the Loom step.
    var guide = atStep && s.guide && window.LoomGuide;
    el.innerHTML = '<div class="t-top"><span>Demo tour · ' + (st.step + 1) + ' of ' + STEPS.length + '</span>' +
      '<button class="t-x" data-t="min" title="Shrink the tour">▾</button><button class="t-x" data-t="end" title="End the tour">✕</button></div>' +
      '<h3>' + esc(s.title) + '</h3>' +
      (atStep ? '<p>' + esc(s.text) + '</p><p class="t-try">' + esc(s.try) + '</p>'
        : '<p>This step is in ' + esc(NAMES[s.tool] || s.tool) + '.</p>') +
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
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.SignoffTour = { start: start, intro: intro, end: function () { set(null); card(); } };
})();
