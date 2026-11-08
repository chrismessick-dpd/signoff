# Demo tour steps

The demo tour is the guided path through the Smart Thermostat demo, from tool to tool. It starts from
**Take the tour** in the hub's sidebar (or Signoff PL's) and runs in the visitor's tab. This page is the
reference for its steps: what each one shows, what its card says, and how it behaves. The code is
`signoff/assets/tour.js` (the `ALL` list). Keep the two in step: change a step here and there together.

Agreed with Chris on 2026-11-08. The tour follows the **Main PCBA** (Signoff EE `pdemo7`, Fabcheck run
`rdemo1042b`) wherever a board is involved, and the cards name it.

## The steps

Each step lists its page, what the tour does on arrival, what it rings, and the card's text. In the
card text, `{…}` is a button, tab or field, drawn as a chip.

### 1. Dovetail Signoff

- **Page:** the hub, `signoff/index.html?demo`, with **Signoff PL** picked on its stage.
- **On arrival:** picks the Signoff PL tile (a click on a tile that isn't picked; the picked tile is
  never clicked, since that would open the tool). **Rings:** the Signoff PL tile.
- **Card:** Signoff is Dovetail's set of tools for design reviews, requirements, checklists, fab and
  package checks, harness drawings, and project tracking. Each review is built around one board,
  harness, or part, in pages made for working on it together. Project data lives in private Git
  repositories: engineers, clients, and contractors see the same data at the same time, and every
  change (a requirement, an issue, a checked item) syncs to the project's repo in the background, with
  its history kept. One source of truth, versioned, and shared only with the people a project is shared
  with.
- **Try:** Dovetail engineers see every project and can share one with a client or contractor, who then
  sees exactly what Dovetail sees about it. {Signoff PL}, picked here, ties a product's boards,
  harnesses, parts, and firmware together for the project lead.

### 2. Signoff EE

- **Page:** the hub, with **Signoff EE** picked. **Rings:** the Signoff EE tile.
- **Card:** Signoff EE follows a board through its whole life, from requirements and schematic to
  layout, fab release, and bring-up. Each board is set up with its requirements and the checklists its
  design type needs. It works with Fabcheck: every fab package Fabcheck checks can send its errors and
  warnings to the board's review as issues, and every run is kept, so DFM checks repeat with each
  revision and their issues are tracked to closure.
- **Try:** The tour comes back to the Smart Thermostat's Main PCBA in Signoff EE. First, the other
  tools: {Next} picks Signoff ME.

Steps 3 to 7 pick each other tool on the hub's stage the same way, so the visitor sees the whole suite,
then the whole product (step 8), before any one tool's detail (Chris, 2026-11-08). Each rings its tile.

### 3. Signoff ME

- **Card:** Signoff ME reviews a mechanical part or product from concept to production validation:
  part design and DFM, tolerancing, materials, the enclosure, drawings, and validation testing. Like a
  board in Signoff EE, each part is set up with its requirements and the checklists it needs, and its
  requirements flow down from the product's.
- **Try:** In the demo, the Smart Thermostat's Enclosure and Wall Bracket are reviewed here. {Next}
  picks Signoff FW.

### 4. Signoff FW

- **Card:** Signoff FW reviews one firmware image from architecture to factory programming and field
  updates: hardware interfaces, memory and faults, concurrency, power, communications, security, and
  release. It works the same way as Signoff EE and ME, with requirements and checklists picked for the
  product.
- **Try:** The demo reviews the Smart Thermostat's firmware. {Next} picks Fabcheck.

### 5. Fabcheck

- **Card:** Fabcheck checks a PCB fab and assembly package (Gerbers, drill files, pick-and-place, BOM,
  or ODB++) the way a board house would, before it's sent, and shows exactly where on the board each
  problem is. It runs in the browser, so the files never leave the computer, and it sends what it
  finds to the board's review in Signoff EE.
- **Try:** Later in the tour you run the Main PCBA's package through it. {Next} picks Loom.

### 6. Loom

- **Card:** Loom draws the harnesses that join the boards and parts: connectors, wires, twisted pairs,
  shields, cables, and bundles in one wiring diagram, with the connector faces, wire list, and BOM on
  the sheet a tech builds from. Board connectors come from a Signoff EE board's fab package, with
  their pins and net names.
- **Try:** Signed in, harnesses sync with Loom's private data repo, and Signoff PL places them in the
  product. {Next} picks Partcheck.

### 7. Partcheck

- **Card:** Partcheck is Fabcheck's mechanical counterpart. It checks that a part's STEP model,
  drawing, flat pattern, and BOM agree before they go to the shop, and shows every part in 3D with its
  mass, draft, and wall thickness. Like Fabcheck, it runs in the browser, and its findings give
  evidence for checks in Signoff ME.
- **Try:** {Next} opens Signoff PL, where all of these come together as one product.

### 8. The whole product

- **Page:** Signoff PL, `?demo`. **Rings:** the {Requirements} tab until it's open.
- **Card:** Signoff PL is the project lead's view. The Smart Thermostat is a tree of Parts: the two
  boards, the firmware, the enclosure and the wall bracket, each linked to its review, plus purchased
  Parts. Rings show how much of each review is done, and the colored numbers are open issues.
- **Try:** Open the {Requirements} tab: the product's ESD requirement, REQ-002, is failing with the
  firmware's under it. (Clicking a Part first shows only that Part's.) {Next} goes into one of these
  Parts: the Main PCBA's review in Signoff EE.

### 9. A board's design review

- **Page:** Signoff EE, `?demo&project=pdemo7`, the Main PCBA's Overview.
- **On arrival:** the Overview tab. **Rings:** {Edit profile}, then the sheet's Checklists.
- **Card:** This is the Main PCBA's review. Signoff EE reviews a board against checklists, from
  schematic and layout to fab release and bring-up. Each board picks the checklists it needs, and its
  profile (mains, RF, certification…) sets aside the checks that don't apply, so the list fits the
  design.
- **Try:** Click {Edit profile} to see every checklist that can be turned on for the Main PCBA, and its
  profile tags. {Cancel} leaves it as it was.

### 10. Reviewing together

- **Page:** the Main PCBA's Overview. **Rings:** an issue panel's {Open in Fabcheck} when one is open,
  else the Recent discussion section.
- **Card:** Everyone on the board works in the same review: checks are marked {Pass}, {Issue} or
  {N/A}, issues get a severity, a resolution and a comment thread, and @revnotes in a comment lists it
  for the next revision. {Recent discussion} collects the latest comments, including the issues
  Fabcheck raised.
- **Try:** Click one of the Fabcheck comments to open its issue: {Open in Fabcheck} in its panel opens
  that finding in Fabcheck. {Next} goes to Fabcheck to run the Main PCBA's package yourself.
- **Side path:** Open in Fabcheck lands on Fabcheck's Board tab, so the tour moves on to step 14.

### 11. Check a fab package

- **Page:** Fabcheck's start page, `pcb_dfm/index.html?demo`, with no package open.
- **Rings:** the {Main PCBA (DT-1042 rev B)} button, pulsing, for the visitor to press.
- **Behavior:** the button opens the board by its fixed run (`#/overview?run=rdemo1042b&project=pdemo7`,
  as the demo links do), and once that run is going the tour moves on to step 12 by itself. It always
  loads the package and runs its checks live, even when this browser keeps that run (Fabcheck's
  `state.liveRun`; Chris, 2026-11-08).
- **Card:** Fabcheck is Dovetail's DFM check for fab packages. It reads a package in the browser,
  nothing uploaded, and checks that its contents agree and its board data is clean: parts,
  descriptions, and footprints across the BOM, pick-and-place data, and Gerbers. It renders the Gerber
  and drill layers and checks them for errors and warnings against a fab process class. The classes
  come from fab houses' published capabilities and can be copied and tailored to a particular fab.
- **Try:** Click {Main PCBA (DT-1042 rev B)} to check the Main PCBA's package.

### 12. The fab package, checked

- **Page:** Fabcheck, the Main PCBA's run on Overview (`#/overview?run=rdemo1042b&project=pdemo7`). The
  run plays on the inspection stage and the page stays on Overview when it finishes.
- **Rings:** the stage while the run plays, then {Run checks again} (disabled during a run) once it's done.
- **Card:** Fabcheck reads the Gerbers, drill files, pick-and-place and BOM and checks them the way a
  board house and an assembler would, under the fab's rules. Watch the stage light each layer of the
  Main PCBA as its checks run and pin what they find.
- **Try:** When the run finishes, the {Checks} cards sum up each kind of check, with its errors,
  warnings and info. To watch it again, click {Run checks again}. After a check has been
  run, you can click and slide along the status bar to view individual checks and the limits they
  are using. {Next} goes to the findings.

### 13. Findings

- **Page:** Fabcheck's Findings tab for the run (`#/findings?run=…`), scrolled to **Build & assembly**.
- **Rings:** the D2 error at the top of Build & assembly ("D2: pin 1 is 180° off from the other 2
  SOD-123 parts"), kept in view after Fabcheck's redraw.
- **Card:** {Findings} lists everything the run found, grouped by type (package, build and assembly,
  BOM audit, fabrication DFM) and narrowed by the severity and type buttons. At the top of
  {Build & assembly} is an error: D2 sits 180° from the other two SOD-123 diodes.
- **Try:** Click the D2 error: its details and a preview of the spot on the board open on the right.

### 14. Errors in the CAM viewer

- **Page:** Fabcheck's Board tab for the run. **Rings:** the first error in the rail. The card keeps
  clear of the layers list.
- **Card:** The {Board} tab is Fabcheck's CAM viewer: every Gerber and drill layer drawn as the fab will
  see it, with the findings pinned where they are. The rail on the right lists them; the Main PCBA has
  4 errors.
- **Try:** Turn off {Warnings} and {Info} in the rail to leave only the errors, then click one: the
  board flies to it and turns on its layers. Then play: zoom and pan, show and hide layers on the left,
  flip to {Bottom}, and switch {Realistic} on for the board as built.

### 15. Send a run to Signoff EE

- **Page:** the run's Overview, scrolled to its foot. **Rings:** the Project picker and
  {Send to Signoff EE} row; the card moves to the top right, off it.
- **Check:** the Project picker shows **Main PCBA · DT-1042** (the run's project), so the issues go to
  the Main PCBA's Fab & Release checklist.
- **Card:** {Send to Signoff EE}, at the foot of {Overview}, turns the run's errors and warnings into
  issues on the Main PCBA's Fabrication & Release checklist and keeps the run with the review. Sending
  again updates the same issues and keeps their status in Signoff.
- **Try:** Check that the project is {Main PCBA}, click {Send to Signoff EE}, then {Open in Signoff EE}.

### 16. Fabcheck's issues in the review

- **Page:** Signoff EE, the Main PCBA's Findings tab. **Rings:** the "Fabcheck: D2: pin 1…" issue.
- **Card:** The run's errors and warnings are issues on the Main PCBA's {Fab & Release} checklist now,
  listed with every other issue under {Findings}. D2's error came over with Fabcheck's details and a
  link back to the finding.
- **Try:** Click the D2 issue to open it, then change its status or resolution, or leave a comment on
  any issue: everyone on the board sees it.

### 17. Revisions

- **Page:** the Main PCBA's Revisions tab, with its run (tagged B.1) expanded. Nothing rings.
- **Card:** The {Revisions} tab lists the Main PCBA's Fabcheck runs. A run that went to the fab is
  tagged as a revision, here B.1, with its status, fab house, date and order, so everyone knows which
  package was built. In a real review, each run's fab package can be downloaded here.
- **Try:** B.1 is open, with the issues its run raised. Below it, {Next revision updates} collects
  every comment tagged @revnotes.

### 18. Harness drawings

- **Page:** Loom, `?demo&project=hdemo1`, the demo harness (an example for a made-up Zone Controller,
  not the thermostat). The menu and the parts pane fold away and the diagram fits the canvas; a
  selection brings the parts pane back with its Properties. An {Open Loom's guide} button starts
  Loom's own guide, which hides the tour's card while it runs.
- **Card:** Loom draws any cable harness, from a two-wire pigtail to a full cable set: connectors,
  wires, splices, twisted pairs, shields, cables and bundles. From that one picture it makes the
  package a tech builds from: the wiring diagram, connector faces, wire list and BOM. This example
  harness, for another made-up product, has a bit of everything.
- **Try:** Click a connector, a wire or a cable: its Properties open on the right. Loom's own guide
  walks through every feature on this harness.

### 19. Build the thermostat's harness

- **Page:** Loom, with the menu and the panes back out.
- **Card:** Now one of your own, next to the example: the thermostat's mains leads, from the Main
  PCBA's terminal block J1 to the electrical box. Loom reads J1 from the package Fabcheck checked, with
  its designator and net names.
- **Stages,** each ticked off from the harness as it is, ringing what to do next; the canvas refits as
  ends and wires are added:
  1. Click {+} beside Harnesses in the menu. A new harness starts with two ends, P1 and P2.
  2. Click {From a board}, pick the Main PCBA and {Add} J1. It arrives as P3, with its nets AC_N and
     AC_L as pin labels.
  3. Select P2 and set its {Family} to {Flying leads} and {Leads} to 2: the leads to the electrical box.
  4. Click P3's pin 1 (AC_N), then lead 1 on P2. Do the same for pin 2.
  5. Select P1, the end you didn't use, and press {Delete}.
- **When done:** That's a harness. {Drawing} shows its sheet, ready for a tech.

### 20. The firmware review

- **Page:** Signoff FW, `?demo&project=fdemo3`, the Thermostat Firmware's Overview.
- **Rings:** {Edit profile}, then the sheet's Checklists.
- **Card:** Signoff FW reviews firmware with the same setup as Signoff EE: requirements, and
  checklists picked for the product, from architecture and hardware interfaces to memory, concurrency,
  power, communications and security. Its profile tags set aside the checks that don't apply.
- **Try:** Click {Edit profile} to see the checklists and profile tags this firmware uses. {Cancel}
  leaves it as it was.

### 21. The enclosure's review

- **Page:** Signoff ME, `?demo&project=mdemo5`, the Enclosure's Overview.
- **Card:** Signoff ME reviews the Enclosure the same way, with mechanical checklists: part design and
  DFM, tolerancing, materials, drawings. Its requirements flow down from the product's: look for ↑ on
  the {Requirements} tab.
- **Try:** Open {Findings} to see every issue in one list.

### 22. The package that goes to the molder

- **Page:** Partcheck, `?demo`.
- **Card:** Partcheck checks that the models, drawings and BOM agree before they're sent out. Here the
  back cover's drawing and the BOM name different plastics, and the light pipe has no files.
- **Try:** In {Findings}, each chip opens the Signoff ME check it gives evidence for. (The back cover's
  chip opens `pd-cad-8`, an open issue in Signoff ME.) That's the tour: explore anything, and
  {Reset demo} in a tool's banner starts it over.

### Hidden: The firmware, and a failing requirement

Kept in `tour.js` with `skip: true`, to add back later (Chris, 2026-11-08). It would sit right after
step 20.

- **Page:** Signoff FW, `?demo&project=fdemo3&req=q3-1`, with REQ-002's panel open.
- **Card:** Signoff FW reviews the firmware. This requirement flows down from the product's ESD
  requirement, and it's failing: at ±8 kV the touch controller stopped responding until the power was
  cycled.
- **Try:** Its panel is open: scroll it down to {Traced checks} for the checks it traces to, with the
  open issue.

## How the tour behaves

- **State** is sessionStorage `signoff.demo.tour`: the step's number and title, and the script's
  version (the steps' titles joined). The tools load `tour.js` without a version stamp, so for about
  ten minutes after a push a page can run a cached copy with other steps. A page whose copy differs
  from the one that wrote the state fetches `tour.js` afresh and reloads, once, then finds the step by
  its title.
- **Following the page.** The tools switch boards, packages and harnesses without changing the address,
  so each step says what it's about (`at`): the board open in Signoff EE, ME or FW's sidebar (by slug:
  `main-pcba`, `enclosure`, `thermostat-firmware`), Fabcheck's open run, Loom's harness, or the hub's
  picked tile. The card checks twice a second. When the page doesn't match, it says where the step is
  ("This step is on the Main PCBA in Signoff EE") with **Go there**, and Go there, Next and Back put it
  right in the page (`fix`: click the board, pick the tile, open the demo harness) or open the step's
  page again.
- **On arrival** (`enter`), a step sets its page up: a tab (EE's Findings or Revisions, FW's Overview),
  the hub's tile, Loom's panels. It runs once per arrival at the step's tool, before the page is
  checked.
- **Moving on by itself.** `advance` (step 11: the run is going) moves to the next step on the same page.
  `landing` (step 14) catches the visitor arriving at Fabcheck another way: when the next step isn't
  the page they landed on, a later Fabcheck step that is takes over.
- **The ring** (`spot`) goes round the first candidate shown on the page, so a step can point at the
  next thing to click as the visitor goes. A target off screen is scrolled into view and kept there for
  a moment, since some tools redraw just after arriving.
- **The card** sits at the bottom left, or the bottom right or top right when its corner would cover the
  ring or what the step asks it to keep clear of (`avoid`: Fabcheck's layers list on step 14). A long
  card scrolls.
- **Fabcheck runs on Overview.** A run link with no check or place (`#/overview?run=…`,
  `#/findings?run=…`) stays on that view; links from Signoff EE, which carry a check or a place, go to
  the board. The start page's demo-board buttons open their board by its fixed run, the same way.
- **Contents.** The ☰ in the card's top line swaps the card's text for every step, under the tool it
  runs in; a click jumps to that step (as Loom's guide does). It stays open, as `contents` in the
  state, until it's closed or a step is picked.
- **The theme** is the suite's, under `signoff.v1.settings` in every tool, demo included, so the tour
  doesn't flip between light and dark as it moves from tool to tool.

## Changing the tour

1. Edit the step here and in `tour.js` (`ALL`).
2. Steps that switch tool state need `at`, `place` and, where the page can be put right in place,
   `fix`. Anything a step names on the page should exist in the demo (check the demo data in the
   tool's `config.js` or `demo.js`).
3. Run `python tools/stamp_version.py` in the hub.
4. Walk the whole tour in a browser over http (preview `signoff-suite-alt`, port 8774), including the
   side paths: Open in Fabcheck from step 10, Back across tools, a reload on a Fabcheck step, and
   switching board or harness mid-step.
