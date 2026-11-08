# Dovetail Signoff hub (signoff): notes for Claude

This repo is the landing page for the suite: one static page, `index.html`, plus `assets/hub.js`
and `assets/hub.css`. It links by relative path to the sibling tool folders: `ee_design_review`,
`me_design_review`, `fw_design_review` (a prototype), `signoff_pl`, `pcb_dfm`, `partcheck` (a prototype) and `loom` (a prototype; only the hub links to it so far). When the suite folder is checked out, read
`../CLAUDE.md` first. This repo is public.

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
- **People & access** (FTEs only) opens `assets/people.js`'s sheet over the hub, with the EE, ME
  and FW People pages framed (see `../CLAUDE.md`). EE, ME, FW and PL load the same file. `hub.js` copies the
  engine's `model.tokenTag`; keep it identical.
- **Tool picker.** The page opens with a gallery of the seven tools (`.pk-tile`) over a stage
  (`.pk-panel`, one per tool) that previews the selected one. A plain click selects; a click on
  the selected tile, a double-click or Enter opens it; modifier clicks open as links. The choice is
  remembered in `signoff.hub.ui.pick` (EE by default). The art is SVG `<symbol>`s at the top of
  the picker, made up (never a real board). Theme colors for it are CSS variables on `:root`,
  because rules inside `<use>` copies can't see `:root`.
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
