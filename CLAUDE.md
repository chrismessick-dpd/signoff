# Dovetail Signoff hub (signoff): notes for Claude

This repo is the landing page for the suite: one static page, `index.html`, plus `assets/hub.js`
and `assets/hub.css`. It links by relative path to the sibling tool folders: `ee_design_review`,
`me_design_review`, `signoff_pl` and `pcb_dfm`. When the suite folder is checked out, read
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
- **Demo mode.** `?demo` appends `?demo` to every `[data-tool]` link. Each tool card and sidebar
  link needs `data-tool`.
- **Hand-copied numbers.** The check counts on the cards and in the About sheet (EE 930, ME 845,
  Fabcheck's 28 rules) are copied by hand. Update them when the templates change.
- **Before committing**, open `index.html` (from disk or served) and check every link and the dark
  mode toggle. There are no tests or build step.
