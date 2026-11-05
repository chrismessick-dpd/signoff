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
    fw_design_review: 'Signoff FW', pcb_dfm: 'Fabcheck', partcheck: 'Partcheck' };
  var STEPS = [
    { tool: 'signoff_pl', url: '../signoff_pl/index.html?demo', title: 'The whole product',
      text: 'Signoff PL is the project lead’s view. The Smart Thermostat is a tree of Parts: two boards, the firmware, an enclosure and a wall bracket, each linked to its own design review, plus purchased Parts. Rings show how much of each review is done; the colored numbers are open issues by severity.',
      try: 'Click a Part to see its details, or look at the Issues tab.' },
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo7', title: 'One board’s design review',
      text: 'Signoff EE reviews the Main PCBA against six checklists, from schematic to bring-up. Checks for things this board doesn’t have (a battery, DDR memory) are set aside, so the list fits the design.',
      try: 'Open a checklist and mark a check Pass, Issue or N/A. Your changes stay in this browser.' },
    { tool: 'ee_design_review', url: '../ee_design_review/index.html?demo&project=pdemo7&item=xfcu3tc7n', title: 'An issue raised by Fabcheck',
      text: 'Fabcheck checked the fab package and found diode D2 placed 180° off. The reviewer tied it to the bring-up issue where D2 went on backwards on three boards.',
      try: 'Click Open in Fabcheck, in the issue’s panel, to see it on the board.' },
    { tool: 'pcb_dfm', url: '../pcb_dfm/index.html?demo', title: 'The fab package, checked',
      text: 'Fabcheck reads the Gerbers, drill files, pick-and-place and BOM in the browser and checks them the way a board house and an assembler would. Nothing is uploaded.',
      try: 'Click any finding to zoom to it. Back to Signoff EE returns you to the issue. (If no board is open, pick Main PCBA.)' },
    { tool: 'me_design_review', url: '../me_design_review/index.html?demo&project=mdemo5', title: 'The enclosure’s review',
      text: 'Signoff ME reviews the Enclosure the same way, with mechanical checklists: part design and DFM, tolerancing, materials, drawings. Its requirements flow down from the product’s: look for ↑ on the Requirements tab.',
      try: 'Open Findings to see every issue in one list.' },
    { tool: 'partcheck', url: '../partcheck/index.html?demo', title: 'The package that goes to the molder',
      text: 'Partcheck checks that the models, drawings and BOM agree before they’re sent out. Here the back cover’s drawing and the BOM name different plastics, and the light pipe has no files.',
      try: 'In Findings, each chip opens the Signoff ME check it gives evidence for.' },
    { tool: 'fw_design_review', url: '../fw_design_review/index.html?demo&project=fdemo3&req=q3-1', title: 'The firmware, and a failing requirement',
      text: 'Signoff FW reviews the firmware. This requirement flows down from the product’s ESD requirement, and it’s failing: at ±8 kV the touch controller stopped responding until the power was cycled.',
      try: 'The checks it traces to are listed under it, with the open issue.' },
    { tool: 'signoff_pl', url: '../signoff_pl/index.html?demo', title: 'Back to the product',
      text: 'The failing firmware requirement shows on the product’s ESD requirement, next to the two boards’ ESD issues. Every review feeds this view, so the project lead sees what blocks the build without asking around.',
      try: 'Open the Requirements tab. That’s the tour: explore anything, and Reset demo in any tool starts it over.' }
  ];

  function folder() { var m = /\/([^\/]+)\/[^\/]*$/.exec(location.pathname); return m ? m[1] : ''; }
  function get() { try { var s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && typeof s.step === 'number' && s.step >= 0 && s.step < STEPS.length ? s : null; } catch (e) { return null; } }
  function set(s) { try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // A step's page, from wherever this page is: every tool is a sibling folder.
  function href(step) { return folder() === 'signoff' || folder() ? STEPS[step].url : STEPS[step].url.replace(/^\.\.\//, ''); }

  // Colors are the suite's theme tokens (every tool loads the engine's styles or suite.css), so the
  // card follows light and dark mode; the fallbacks are the light theme's.
  var css = '.tour{position:fixed;left:16px;bottom:16px;z-index:55;width:340px;max-width:calc(100vw - 32px);box-sizing:border-box;' +
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
    '@media (prefers-reduced-motion:reduce){.tour-link{animation:none}}';

  function style() { if (document.getElementById('tour-css')) return; var s = document.createElement('style'); s.id = 'tour-css'; s.textContent = css; document.head.appendChild(s); }

  // To a step: on this page already (same tool, and every parameter of the step's URL is in this
  // one), only the card changes; otherwise its page opens.
  function go(step) {
    set({ step: step });
    var want = new URL(href(step), location.href), here = new URL(location.href);
    var same = STEPS[step].tool === folder() && Array.from(want.searchParams.keys()).every(function (k) { return here.searchParams.get(k) === want.searchParams.get(k); });
    if (same) card(); else location.href = want.href;
  }

  function card() {
    var st = get(), el = document.getElementById('tour');
    if (!st) { if (el) el.remove(); return; }
    // Arriving at the next step's tool another way (Open in Fabcheck, a sidebar link): move on.
    var here = folder();
    if (STEPS[st.step].tool !== here && STEPS[st.step + 1] && STEPS[st.step + 1].tool === here) { st.step++; set(st); }
    var s = STEPS[st.step], atStep = s.tool === here, last = st.step === STEPS.length - 1;
    if (!el) { el = document.createElement('div'); el.id = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Demo tour'); document.body.appendChild(el); }
    el.className = 'tour' + (st.min ? ' min' : '');
    if (st.min) { el.innerHTML = '<b>Tour</b> · ' + (st.step + 1) + ' of ' + STEPS.length + ' ▴'; el.onclick = function () { st.min = false; set(st); card(); }; return; }
    el.onclick = null;
    el.innerHTML = '<div class="t-top"><span>Demo tour · ' + (st.step + 1) + ' of ' + STEPS.length + '</span>' +
      '<button class="t-x" data-t="min" title="Shrink the tour">▾</button><button class="t-x" data-t="end" title="End the tour">✕</button></div>' +
      '<h3>' + esc(s.title) + '</h3>' +
      (atStep ? '<p>' + esc(s.text) + '</p><p class="t-try">' + esc(s.try) + '</p>'
        : '<p>This step is in ' + esc(NAMES[s.tool] || s.tool) + '.</p>') +
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
      });
    });
  }

  // The intro: what the demo is and where the tour goes, then Start.
  function intro() {
    if (document.querySelector('.tour-scrim')) return;
    var scrim = document.createElement('div');
    scrim.className = 'tour-scrim';
    scrim.innerHTML = '<div class="tour-intro" role="dialog" aria-modal="true" aria-label="Demo tour"><h2>A 5-minute tour of the demo</h2>' +
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
  function start() { if (folder() === STEPS[0].tool) { set({ step: 0 }); card(); } else go(0); }

  // The hub and Signoff PL: a Demo section in the sidebar with a Take the tour button, over the
  // list of tools (on the hub, under Home; in PL, over the Dovetail Signoff links).
  function sideButton() {
    var at = document.querySelector('.sidebar #side-tools') || document.querySelector('.sidebar .side-nav .side-head');
    if (!at || document.getElementById('tour-link')) return;
    var b = document.createElement('button');
    b.id = 'tour-link'; b.type = 'button'; b.className = 'side-link tour-link';
    b.title = 'A 5-minute tour of the demo, from tool to tool';
    b.innerHTML = '<span class="tool-mark"><svg viewBox="0 0 18 18" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="7"/><path d="M11.8 6.2 10 10l-3.8 1.8L8 8z"/></svg></span>' +
      '<span>Take the tour<small>5 minutes through the demo</small></span>';
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
