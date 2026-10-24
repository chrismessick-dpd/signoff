# Dovetail Signoff

The landing page for Dovetail's design review tools. It is one static page (`index.html`) that links to:

| Card | Link | What it is |
|---|---|---|
| **Signoff EE** | `../ee_design_review/index.html` | Electrical reviews: schematic, layout, assembly, fab and bring-up |
| **Signoff ME** | `../me_design_review/index.html` | Mechanical design reviews |
| **Fabcheck** (related tool, internal) | `../pcb_dfm/index.html` | Fab package DFM checker |

No build step, no network calls, no third-party scripts. It works opened straight from disk (`file://`) or hosted.

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
- Everything marked `data-internal` is hidden. Right now that is Fabcheck.

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

## To fill in

- The **About Signoff** card is placeholder copy. Look for the `PLACEHOLDER` comment in `index.html`, then replace the text and remove the "Placeholder" chip.
- The EE check count (931) is copied by hand from Signoff EE's templates. Update it when they change.
