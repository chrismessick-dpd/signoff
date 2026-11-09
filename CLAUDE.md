# Dovetail Signoff hub (signoff): notes for Claude

This repo is the landing page for the suite: one static page, `index.html`, plus `assets/hub.js`
and `assets/hub.css`. It links by relative path to the sibling tool folders: `ee_design_review`,
`me_design_review`, `fw_design_review` (a prototype), `signoff_pl`, `pcb_dfm`, `partcheck` (a prototype), and `loom` (a prototype; only the hub links to it so far). When the suite folder is checked out, read
`../CLAUDE.md` first. This repo is public.

**Serial comma** (Chris, 2026-11-08): use the Oxford comma in every list of three or more, in UI text, docs, demo data, checklists, and commit messages: "A, B, and C". Never change check ids or data keys to fit it.

- **`docs/guide.md` is the suite-wide guide.** It covers:
  - the folder and repo map
  - Pages hosting
  - people and access
  - onboarding
  - how engine changes flow between the tools
  - the demo suite

  Keep it current when a tool is added or the engine flow changes.
- **`assets/suite.css`** is copied from `ee_design_review/assets/styles.css` by
  `python tools/sync_suite_css.py`. Never edit it here.
- **People & access** (FTEs only) opens `assets/people.js`'s sheet over the hub, with the EE, ME,
  and FW People pages framed (see `../CLAUDE.md`). EE, ME, FW, and PL load the same file. `hub.js` copies the
  engine's `model.tokenTag`; keep it identical.
- **Tool picker.** The page opens with a gallery of the seven tools (`.pk-tile`) over a stage
  (`.pk-panel`, one per tool) that previews the selected one. A plain click selects; a click on
  the selected tile, a double-click or Enter opens it; modifier clicks open as links. The choice is
  remembered in `signoff.hub.ui.pick` (EE by default). The art is SVG `<symbol>`s at the top of
  the picker, made up (never a real board). Theme colors for it are CSS variables on `:root`,
  because rules inside `<use>` copies can't see `:root`.
- **The demo tour** (`assets/tour.js`, loaded by every tool): `docs/tour.md` is the reference for its
  steps (Chris, 2026-11-08). Change a step there and in `tour.js` together.
- **The Fourier panel** (`assets/fourier.js`, 2026-11-08): the Fourier Epicycles artifact's Tool view as a
  panel for the tools. It draws the 1D wave, the 2D outline, or the 3D curve. Its controls are Reset, the
  1D/2D/3D toggle, and the arrow that hides the series strip; the drag hints show from 420 px wide up. No tool's
  own pages load it (Chris: don't add it to any tool); the demo tour's last step, *You're set*, loads it on
  first use and shows one with its defaults (Chris, 2026-11-08). Embed it with
  `<script src="../signoff/assets/fourier.js">` and `<div data-signoff-fourier>`, or call
  `SignoffFourier.mount(el, opts)` from a tool's script; the options are listed at the top of the file.
  - 3D loads `assets/vendor/three.min.js` the first time a panel shows it, and never over a page's own
    `THREE`. That file is three.js r128 (MIT) from
    `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`, sha256 `9274bbce…a2c1ce2`
    (`9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2`).
  - Each panel owns its canvases, so several can share a page; `destroy()` releases the WebGL context. It
    animates only while on screen.
  - Its canvases take touches (`touch-action: none`) for drawing and turning, so on a phone a swipe that
    starts on the panel doesn't scroll the page.
  - `lab/fourier.html` shows two panels under the tools' CSP. Fabcheck, Partcheck, and Loom allow inline
    styles too, so the injected stylesheet works in every tool.
- **Demo mode.** `?demo` appends `?demo` to every `[data-tool]` link. Each tile, Open button and
  sidebar link needs `data-tool`; the panels' "Try the demo" links must not have it (they're
  `data-internal`, hidden in demo mode).
- **Hand-copied numbers.** The check counts on the picker panels and in the About sheet (EE 930, ME 845,
  FW 196, Fabcheck's 33 rules) are copied by hand. Update them when the templates change.
- **Stamp before committing.** Run `python tools/stamp_version.py` after any change to
  `index.html` or `assets/` (including `sync_suite_css.py`). It puts `?v=<hash>` on the asset
  URLs so a phone never mixes a new page with cached old CSS or JS; `--check` exits 1 when stale.
- **Before committing**, open `index.html` (from disk or served) and check every link and the dark
  mode toggle. There are no tests or build step.
