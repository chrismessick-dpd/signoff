# Dovetail Signoff

**User guide:** [docs/guide.md](docs/guide.md), with a customer-shareable overview and the suite-wide architecture for FTEs.

The landing page for Dovetail's design review tools. It is one static page (`index.html`) that links to:

| Card | Link | What it is |
|---|---|---|
| **Signoff EE** | `../ee_design_review/index.html` | Electrical reviews: schematic, layout, assembly, fab and bring-up |
| **Signoff ME** | `../me_design_review/index.html` | Mechanical design reviews |
| **Fabcheck** (related tool) | `../pcb_dfm/index.html` | Fab package DFM checker |

No build step, no network calls, no third-party scripts. It works opened straight from disk (`file://`) or hosted.

## Live site

https://chrismessick-dpd.github.io/signoff/ (GitHub Pages, from `main`). See `docs/guide.md` for how the hosted suite works.

## Folder layout it assumes

The links are relative, so the hub and the tools must be sibling folders:

```
tools/
  signoff/            ← this hub
  ee_design_review/   ← Signoff EE
  me_design_review/   ← Signoff ME
  pcb_dfm/            ← Fabcheck
```

If a tool's folder is missing, its card still shows, but its link leads nowhere. To link back to the hub from a tool, use `../signoff/index.html`, or `../signoff/index.html?demo` in demo mode.

To preview it with every tool working, serve the parent folder:

```bash
python -m http.server 8790 --directory C:/Dovetail/tools
```

Then open http://localhost:8790/signoff/index.html.

## Demo mode

`index.html?demo` (or `#demo`) is the customer-facing version:
- A demo banner shows at the top.
- The EE and ME links point to each tool's `index.html?demo`.
- Anything marked `data-internal` is hidden (nothing is today; Fabcheck is public).

## Shared look and theme

- `assets/suite.css` is a copy of `ee_design_review/assets/styles.css`, so the hub uses Signoff EE's tokens and components. Don't edit it here. Re-copy it after the EE stylesheet changes:

  ```bash
  python tools/sync_suite_css.py
  ```

  Fabcheck works the same way.
- `assets/hub.css` holds the few rules only the hub needs.
- Dark mode shares the `theme` value with the tools. It is stored in the localStorage key `signoff.v1.settings`, or `signoff.demo.settings` in demo mode (the same namespaces Signoff EE uses).
  - The hub reads that object.
  - The sidebar toggle writes back only `theme`.
  - A theme change in a tool open in another tab carries over.
- The sidebar collapses the same way as in Signoff EE: use the button next to the brand or the `[` key, and the toolbar menu button brings it back. On wide windows the hub remembers the collapsed state in localStorage under `signoff.hub.ui`. On narrow windows the sidebar slides over the page instead.

## Keeping it current

- The check counts (EE 931, ME 845) are copied by hand from each tool's templates. Update them when the templates change.
