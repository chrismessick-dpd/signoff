# draw.io import and export for Scribe diagrams and Loom drawings (feasibility, 2026-11-20)

Chris asked whether Scribe's diagram, and later Loom's drawings, could be exported to and imported from
draw.io, accepting that some information may be lost on the way. This note is the answer. The prototype and
sample files are in `C:/Dovetail/scratch/drawio/` (outside the repos).

**Built for Scribe EE (2026-11-20, Chris: export and import, as one `.drawio.svg`; rails and the legend as pictures
import reads back).** What it does and its rules: `../../ee_design_review/docs/scribe-ee.md`, *draw.io*. The code is the
engine file `ee_design_review/assets/drawio.js` and the *draw.io* part of EE's `app.js`. Loom is still this note's
assessment only. Where this note and the build differ (power flags are now drawn, as pictures; the SVG, not a `.drawio`,
is the export), the build is right.

## The answer

| Drawing | Export to draw.io | Import from draw.io | Tried |
| --- | --- | --- | --- |
| Scribe EE block diagram (flow) | Yes, close to what Scribe draws | Yes: names, sections, places, connections, Parts, and Power come back; routes don't | Prototyped on the EE demo, both ways, through the real draw.io editor |
| Scribe EE power tree | Yes, as a second page in the same file | Same as the block diagram, into its own arrangement (`ptree`) | No (same code paths) |
| Scribe FW layered map | Yes | Names and links only; its layout comes from the layers | No |
| Loom systems | Yes: blocks, connector tabs, and cables | Places, and maybe new cables between existing connectors | No: an assessment from the code |
| Loom harness drawings | Yes, as a drawing with the data attached | Not worth building: pins, colors, gauges, lengths, and sets can't be edited safely there | No: an assessment from the code |

Scribe is a good fit because its diagram is mostly drawn from text: a block is a heading, a section is a
heading with headings under it, and a line is a `Connects:` item. draw.io keeps arbitrary data on every
shape, so the file can carry each block's Scribe id and properties, and an import can match them back.

## Why draw.io is easy to target

- **The file is open XML** (`mxfile` › `diagram` › `mxGraphModel` › cells). No library is needed to
  write or read it. A page may be stored compressed (base64 of raw deflate); the browser's
  `CompressionStream` and `DecompressionStream` read and write that, so nothing new loads and the CSP
  doesn't change.
- **Custom data survives editing.** A shape wrapped in `<UserObject id="…" scribeId="…" parts="…">`
  keeps its id and every attribute through draw.io's editor (checked, below). People can see and edit
  those attributes in draw.io's *Edit Data* (Ctrl+M).
- **Containers.** A section is a draw.io container; its blocks are children with positions relative to
  it, so moving a section in draw.io moves its blocks.
- **Ports and routes.** A line's ends are `exitX`/`exitY` and `entryX`/`entryY`, fractions of each
  block's box, which match Scribe's ports (`{ side, t }`) exactly. Corners are waypoints.
- **Where people use it:** draw.io desktop (offline), the VS Code extension, and app.diagrams.net, which
  works in the browser and keeps files local unless they're saved to a cloud drive.
- **Editable pictures.** draw.io also reads an SVG or PNG with its XML embedded (`.drawio.svg`,
  `.drawio.png`). Scribe's existing SVG export could embed the same XML at almost no cost, so one file is
  both a picture anywhere and an editable diagram in draw.io.

## What was tried (2026-11-20, EE demo, Main PCBA)

The prototype (`scribe-drawio-proto.js`) runs in Signoff EE's page with Scribe's Diagram open. It reads the
drawn diagram and `Signoff.app.spec.analysis()`. A real build would read `specFlowLast` (block boxes and
routed points) instead of parsing the SVG.

1. **Export.** The 3 sections, 9 blocks, 7 lines, and their signal labels came out as a 15 KB `.drawio`
   (`main-pcba-demo.drawio`). In draw.io's viewer it looks like Scribe's diagram: the same boxes, the same
   ports, right-angle lines with rounded corners, the same arrowheads, and the same labels. Power flags
   aren't drawn (see *What's lost*).
2. **No-op round trip.** The importer compares a file with what Scribe draws now and lists the edits it
   implies. The unchanged file, read back directly or from its compressed form, gives **no edits**. That's
   the acceptance test, because the demo's blocks have no kept places (`pos` is empty): a naive import
   would write `pos` on all nine and mark the review edited, which breaks the rule that nothing derived is
   written.
3. **Simulated edits** on the parsed file each mapped to the right Scribe edit: a block moved (snapped to
   the 10-unit grid), a block renamed (draw.io rewrites the label's HTML; the title is its first line), a
   new shape inside a section (a new block there), a new line with its signal typed on the line itself (a
   new `Connects` item), Parts changed in Edit Data, a copy pasted in draw.io (a new block, not a second
   copy of the same id), and an arrow added at the start (direction "both ways").
4. **The real editor.** The file opened in app.diagrams.net (made-up demo data only). There, the Status
   LEDs block was dragged and MCU renamed "MCU (STM32)". draw.io kept the `UserObject` wrappers, custom ids,
   every Scribe attribute, the file's root data, and the positions relative to their sections. It also
   snapped the drag to its grid. Imported back, the result was exactly two edits: rename MCU, and move
   Status LEDs. Two behaviors to design for:
   - draw.io **didn't grow the section** when the block was dragged partly outside it. Scribe fits sections
     to their blocks anyway.
   - draw.io **kept the moved block's line waypoints** and drew the line from them. So a line whose block
     moved has to route again in Scribe even when its waypoints are unchanged.
   Not tried: saving to a file from draw.io (the model was read from the editor's memory). Whether a file
   comes back compressed depends on the user's draw.io setting; the reader handles both.

## How Scribe maps

| Scribe | In draw.io | Back into Scribe |
| --- | --- | --- |
| The review | Root data: `scribeFormat="scribe-drawio/1"`, tool, review id, name, export time | Warns if the file is for another review |
| Section (heading with headings under it) | Container, title as its label | A rename renames the heading; a new container is a new section around the blocks in it |
| Block (heading) | Rounded box: title, then up to four designators | First line of the label is the title; size is never read (Scribe's blocks are 160 × 60, grown by their ports) |
| Which section a block is in | The container it's in | A change moves the block there (`specNest`), as Within does |
| Kept place (`pos`) | Position | Written only if the block moved, snapped to 10 |
| Section size (`grow`) | Container size | A resize its blocks don't explain becomes `grow` |
| Parts, Power, gist, requirements | Edit Data attributes | Parts and Power are read back if changed (the same text Scribe writes); gist and requirements are for reference only |
| Connection (`Connects: MCU (UART, in)`) | Edge, source and target blocks | A new edge between blocks adds a `Connects` item; a missing one is listed, not removed |
| Signal name | Edge label (on the edge or in a label under it) | A change renames the signal |
| Direction | Arrowheads | A change sets `in`, `out`, or `both ways` |
| Port (`ports`) | `exitX`/`exitY`, `entryX`/`entryY` | A change becomes a kept port |
| Route shape (`routes`) | Waypoints | Not kept: a changed line, or a line with a moved end, routes afresh |
| Label place (`labels`) | Label position along the edge | Could map to `t`; the prototype doesn't |

### Import rules

- **Nothing derived is written.** Only a real difference from what Scribe draws now becomes an edit, so
  importing an unchanged file changes nothing.
- **Match by `scribeId`.** The first shape with an id is that block; a pasted copy is a new block (and needs
  a unique title, "Mains input 2").
- **Show the edits first.** Import lists what it will do (rename, move, add, connect), like the CLI's dry
  run, then applies it as one Scribe edit with Back and Undo. It waits for Sync like any Scribe edit.
- **Never delete text silently.** A block, section, or connection missing from the file is listed with a
  choice. Deleting a container in draw.io deletes its blocks, so this happens easily.
- **Foreign drawings** (no Scribe data) can import into an empty diagram: boxes become blocks, containers
  become sections, edges with both ends on boxes become `Connects`. Text-only shapes, images, and loose
  lines are skipped and listed. Labels lose their formatting.

## What's lost

- **Power flags and the legend.** Each block's rails go out in Edit Data, and come back if edited there,
  but draw.io doesn't draw them as bars and circles. They could be drawn as small locked shapes over each
  block, which would cost more on import (they'd have to be ignored).
- **Route shapes.** Lines keep their corners in draw.io, but a line edited or moved there routes afresh in
  Scribe. Scribe's shape record (`{ v, a, b, mode }`) can't be rebuilt from arbitrary waypoints.
- **Scribe's look.** Gap marks, requirement counts, notes, and the selection current aren't drawn. Colors
  are fixed (light), and draw.io's dark mode recolors them on screen only.
- **Anything draw.io adds** that Scribe has no place for: colors, fonts, extra shapes, text boxes, layers,
  and more than one page. A file that's mostly decoration imports as a few blocks.
- **Long text.** Only the gist goes out; section text stays in Scribe (it's the source).

## Loom (not prototyped)

**Systems** (`assets/system.js`) are blocks in mm (boards with their outline, drawn boards, devices, and
placed systems), connector tabs on them, and cables between tabs.

- *Export:* each block is a box, or the board's outline as an embedded picture. Each connector is a small
  port shape on its block, and each cable an edge between ports, its corners from the stored or auto
  route. A harness cable with three or more ends goes through a small junction dot. The scale (mm to
  draw.io units) goes in the root data.
- *Lost:* device harness drawings (the wires fanning to their far ends), mini views inside placed systems,
  turns other than right angles, and checks.
- *Import:* block and tab places, and a new link cable between two existing connectors, are worth it.
  Adding boards or connectors in draw.io isn't: they come from Signoff EE's packages.

**Harness drawings** (`assets/conn.js`) are WireViz-style: connector tables with a row per pin, and wires
in their colors.

- *Export:* draw.io's table shape can draw the connector tables, and each wire is an edge in its color
  ending on its pin's row, with its signal, gauge, and color as data. That makes a fair drawing.
- *Lost:* striped wires (draw.io has one stroke color), twists, shields, cable sheaths, lacing, face views,
  and Real proportions.
- *Import:* not recommended. A harness's facts are pins, colors, gauges, lengths, and nested sets, which
  draw.io would let anyone break with no checks. For a picture, Loom's own SVG and sheet are better.

## If it's built

- **Engine file `assets/drawio.js`** (EE, as the source): write and read `mxfile`, compression, and
  `.drawio.svg` embedding. Synced into ME and FW, and vendored into Loom when Loom needs it.
- **Scribe (EE `app.js`):** *draw.io (.drawio)* in the diagram's Export menu (block diagram and power tree
  as two pages), and *Import from draw.io…* in the ☰ menu, with the list of edits before it applies.
  Export reads `specFlowLast` and `specPtLast`; import writes through the same model calls as the diagram
  (`specNest`, `pos`, ports, `Connects` text).
- **Tests:** export then import gives no edits; one test per mapped edit; a pasted copy; a deleted
  container; a compressed page; a foreign drawing.
- **Order:** Scribe export, then import, then the power tree page, then Loom systems (export first).

## Privacy

Signoff sends nothing anywhere: the file is made and read in the browser. A client design opened in
app.diagrams.net stays in that browser unless it's saved to a cloud drive; draw.io desktop and the VS
Code extension are fully offline, so they're the ones to suggest for client work. Embedding draw.io's
editor inside Signoff (its embed mode) would load third-party code next to review data and change every
CSP; not recommended now.

## Questions for Chris

1. Is import worth building, or is export (with the `.drawio.svg` picture) enough for now?
2. Should power flags be drawn in draw.io (as shapes import ignores), or only kept as data?
3. For a foreign drawing into a review that already has a diagram: refuse, or merge by title?
4. Loom: systems only, or a harness export too?
