# History: who changed what

Chris (2026-11-13): he opened Scribe EE on a co-worker's board and found five *Edited in two places*
conflict copies, though he had edited nothing. A separate session is fixing that sync bug. This doc
covers the longer-term work:

- Scribe changes should sync better.
- Each tool should get a **history tree** that shows who made each change.
- A run of changes by one person folds into one block. Later the block opens to show the changes,
  and maybe to revert them.

This doc has three parts:

1. A survey of how each tool syncs today and what history it already keeps.
2. A recommendation for what to build the history from.
3. The prototype panel, `signoff/lab/history.html`. Its script is `history-lab.js`, beside it. It
   runs on made-up Smart Thermostat data only.

Status: survey and lab only. No engine or data change.

## Survey

### The shared engine: Signoff EE, ME, and FW

**Storage.** One file per review, `projects/<id>.json`. The file sits in the FTE data repo
(`ee_design_review_data` and its ME and FW twins), or in the review's own `review-<tool>-<slug>` repo
once the review is shared. The FTE data repo also holds `users.json`, the roster.

**Sync** (`github.js`, `GitHubStore.prototype.sync`). Each sync does five things:

1. It reads the head, the tree, and every changed blob. Blobs whose sha matches the local cache are
   skipped.
2. It merges the local copy into the remote one (`model.mergeProjects`).
3. It rebuilds the summary (`withSummary`).
4. It commits every file whose bytes changed, as **one commit** (`GitHubStore.prototype.commit`).
5. It moves the branch with `force: false`. On a 422 or 409 it pulls, merges, and tries again.

`patchRecords` (PL writing requirements into a review) and `putFiles` (checker runs, moves) use the
same commit path.

**Per-record stamps.** Every record carries `updatedAt` and `updatedBy` (`model.stamp`). That covers
`meta`, `items` (check status), `sections` (N/A), `comments`, `custom`, `reqs`, `revisions`, and
`spec` (Scribe sections). A record is the unit of history: a check's status, one comment, one
requirement, or one Scribe section's whole text.

- `updatedBy` is `me()`, which is `settings.user`. That is the **display name the person typed in
  Settings** ("Sam Patel"), not their GitHub login.
- Only the **latest state** of each record is kept. The file has no older versions.

**Merging** (`model.js`, *Merging*). The newer record wins, key by key (`newer`, `mergeMaps`). A tie
goes to the larger `updatedBy`. Deletions are **tombstones** (`deleted: true`), so a merge never
brings a deleted record back. A tombstone also records who deleted the record and when.

**Scribe conflict copies** (`mergeSpec`). A Scribe section also carries `hist`, which holds the
`updatedAt` values of its last five versions (`specStamp`, `SPEC_HIST = 5`). It holds times only,
never text.

- If both copies of a section were edited and neither's `updatedAt` is in the other's `hist`, the
  newer one wins.
- The older one is kept as a new section, `<id>~<tag>`, with `conflictOf: <id>`, the title
  "… (conflict copy)", and the losing edit's `updatedBy`. Its `createdAt` is the losing edit's
  `updatedAt`.
- This is the only place the engine keeps two versions of one record side by side.
- **The 2026-11-13 false copies.** `hist` keeps only five times. A browser that missed more than five
  edits to one section saw its stale copy as a simultaneous edit, so five copies appeared on a board
  Chris never edited. The sync session found this by replaying the real merge.
  - **The fix** (committed in EE `92ec887`, ME `90d4348`, and FW `76e3d7b`):
    - `mergeSpec` is now a three-way merge against the version this browser last pulled
      (`model.specBase`, localStorage `bases`). A section changed on one side only takes that side.
      Only a section changed on both sides makes a copy. With no base, it falls back to `opts.since`,
      then to the `hist` test.
    - `GitHubStore.sync` takes `opts.edited(id)`. A browser with no unsynced edits to a review takes
      GitHub's file as it is and never writes it.
    - The command line uses its checkout's `review.json` as the base.
  - The copy's fields are unchanged, so nothing below depends on the fix.

**`model.changesSince(project, since, templates)`.** This lists every record edited after a time as
`{ kind, id, item, label, detail, at, by, deleted }`, newest first. It drives the sync pill's
*unsynced changes* list. **It already produces the row a history needs.** What it lacks is the
record's previous state.

**Scribe back and forward** (`app.js`, `specHists`, `specHistStep`).

- It keeps an undo and a redo stack per review, while the page is open (at most 100 steps).
- A step writes the earlier text back as a **new edit stamped now**, so it syncs like any other edit.
- A step is refused when a sync has since brought in someone else's change to that section.
- It is lost on reload and is never shared. It is a model for Revert, not a source for the history.

**Git commits.** Every sync is one commit on the data repo.

- **Author:** `commit` sets no author, so GitHub uses the token's owner.
  - With Sign in with GitHub, that is each person's own GitHub account.
  - With a pasted personal token, it is whoever made the token. If someone uses Chris's token, every
    commit is his.
- **Message:** `Review update: <names> (<me()>)` (`app.js`, sync). PL writes `Signoff PL: … (<me>)`,
  Fabcheck `Fabcheck: store run …`, and the command line its own.
- **Content:** a commit holds the whole merged file. Diffing two consecutive versions of
  `projects/<id>.json` shows which records changed between them. Each changed record's own stamp says
  who changed it and when.

**Command line** (`tools/signoff.js push`). It merges the way the browser does and stamps records with
the name in `~/.signoff/config.json`. It commits through the same store, so its edits show up in git
the same way.

### Signoff PL (`signoff_pl`)

- **Storage.** One document per PL project in `signoff_pl_data` (or `review-pl-<slug>` once shared).
  The document holds `meta`, `nodes` (the product tree), and `reqs`.
- **Sync.** PL syncs through the engine's `GitHubStore` with its own merge (`pl.js`, `merge`). It is
  record by record, newer wins, with tombstones. Unknown top-level keys are carried along.
- **Stamps.** Nodes and requirements carry `updatedAt` and `updatedBy`, which is `me()`, PL's display
  name.
- **Commit messages.** Syncs say `PL update: <names> (<me>)`, and models say `PL models: …`.
- **Writing into reviews.** PL writes requirement records into EE, ME, and FW reviews
  (`reqs.js` → `patchRecords`) with a base check. If the record changed since PL read it, PL shows a
  *changed in the review* card rather than overwriting it. Those edits land in the review's own git
  history, under the PL user's commit and stamp.
- **History today.** None beyond the stamps and git.
- **Gap.** The tree is a graph: a move changes `parent` and `order`. A history row has to say
  "moved from X to Y", not just "changed".

### Loom (`loom/assets/store.js`)

- **Storage.** One envelope per harness in `loom_data/projects/<id>.json`, or `review-loom-<slug>`
  once shared. Systems are in `systems/`. The envelope's `harness` is the truth; `meta` and `summary`
  are derived.
- **Stamps.** One stamp for the **whole harness**: `h.updated` (ms) and `h.updatedBy`, which is the
  **GitHub login**, not a typed name.
- **Merging is whole-harness.** If only one side changed since this browser's last sync, that side
  wins. If both changed, the newer one wins and the other is kept as a **new harness** named
  "… (conflict copy)" with a new id. Systems work the same way.
- **History today.** Git only. Within a harness, no wire, connector, or set carries its own stamp, so
  a history can say "Morgan changed the Zone Controller harness" but can't say what changed without
  diffing the graph.
- **Gap.** A diff view needs a harness differ (connectors, wires, and sets by id). Loom's records do
  have ids, so it can be built later.

### Fabcheck (`pcb_dfm`)

- **Storage.** Fabcheck only writes to review repos: `Fabcheck: store run <id> (<package>)` puts the
  run record, its package zip, and the board pictures under `fabcheck/<review>/`.
- **History.** Runs are **immutable** records with `at` and `by`, so the list of stored runs already
  is Fabcheck's history.
- **EE side.** Tagging a run as a revision (`project.revisions`) is an ordinary stamped record in the
  review, so it shows in the review's history.
- **Gap.** Waivers live in localStorage (per project or package name). They are never synced, so they
  have no history.

### Flasher (`flasher`)

- **Storage.** `flasher_data` (`manifest.json` and `firmware/<board>/<id>.bin`) and
  `review-flasher-<project>`.
- **Publishing.** `tools/publish.py` publishes from the command line. It proves additivity and commits
  with `force: false`. The manifest keeps each entry's `updated`, `published`, and `built` times.
- **People.** `users.json` changes are commits from `access.js` (`Flasher: People & access`).
- **History.** The manifest times plus git. Each publish is one commit.

### Tickets (`signoff/assets/tickets.js`)

- **Storage.** One file per ticket in `signoff_tickets`, with **one commit per change**: the message is
  `Ticket #n: …`, and it is retried on a race.
- **History.** Each ticket stores a **`log`** array of
  `{ id, kind: 'state' | 'comment' | …, at, by (login), from, to, text }`. **It is the only tool with
  a history built into its data.** If a stored log is ever needed elsewhere, this is the model to
  copy.

### The gaps, in one list

1. **Edits between syncs collapse.**
   - A record keeps only its last state, and a sync writes only what's there at sync time.
   - Five edits to one comment or section before a sync are one change in git.
   - Auto-sync makes the gap small (the commits are frequent) but never zero.
2. **Older text exists only in git.** Scribe's `hist` keeps times, not text. Every other record keeps
   nothing. A diff or Revert has to read the older blob from git.
3. **"Who" isn't one thing.**
   - The engine and PL stamp a typed display name. Loom and Tickets stamp a GitHub login. The commit
     author is the token's owner.
   - Two people can type the same name. One person's name and login don't match.
   - Grouping "consecutive changes by the same person" must pick one. Use the record stamp, and map
     names to logins through the roster (`users.json` has both) when it can.
4. **Commit author ≠ who made the change.** A commit holds the whole merged file, and its author is
   whoever synced. Normally a sync only brings that person's own edits; they merged in everyone
   else's on the way, so those don't differ from the remote. Two cases break that:
   - PL's and the command line's writes into reviews.
   - A shared, pasted token.
   Attribute each row by the record's own stamp, never by the commit.
5. **Scribe back and forward is page-only.** It is gone on reload and is never shared.
6. **Loom has no record-level stamps** inside a harness. Its history is per harness, and its diffs need
   a graph differ.
7. **Rate limits.**
   - Listing commits for a file (`GET /repos/{o}/{r}/commits?path=…`) costs one call per page of 100.
   - Fetching a version costs one call per blob.
   - A history of a busy review is hundreds of calls. Loom already caps drawings per sync for the same
     reason.

## Recommendation: what to build the real history from

**Build it from the data repo's git history, diffed record by record, with no format change.**

1. **Find the versions.** List the commits that touched `projects/<id>.json`, newest first, a page at
   a time, and only when the History panel opens.
2. **Diff them.** Read each version's blob. Blobs never change, so cache them by sha, in IndexedDB
   beside the sync cache. Compare each pair of neighbors record by record, keyed by kind and id.
   - A record whose `updatedAt` changed is one change.
   - Its row is what `changesSince` already builds: kind, label, detail, at, by, and deleted.
   - The old and new record give the diff: text for comments, Scribe, and requirements; state for
     checks.
3. **Attribute by the record's own stamp** (`updatedBy`, `updatedAt`), not the commit's author. Show
   the commit only as "synced by … in commit abc123" in the detail.
4. **Group.** Sort the rows by `at`, then fold consecutive rows with the same `by` into a block (the
   lab merges runs within 2 h). The block names the person, the time span, and a count per kind.
5. **Branches.** Conflict copies come out of this for free.
   - A Scribe section with `conflictOf` is a branch off that section, drawn from the copy's own
     fields: its `createdAt` (the losing edit's time) and `updatedBy`.
   - Deleting the copy (a tombstone) closes the branch. Copying some of its text into the section first
     is the merge.
   - Loom's conflict-copy harnesses are the same, with the new harness id as the branch.
6. **Revert = a new edit.** Write the older record back as a new edit stamped now, the way Scribe back
   and forward does. Refuse it if the record changed since the version being shown, and say who
   changed it.
   - Never `git revert`, never reset, and never force.
   - Review data must never be lost, and a revert written as an edit syncs, merges, and shows up in
     the history like any other change.

**Why not a stored log (like Tickets')?** It would grow every review file forever. It needs a format
change across EE, ME, FW, PL, and the command line. It still wouldn't hold the older text unless the
text were copied in. Git already keeps every synced version for free. Revisit only if gap 1 (edits
between syncs) turns out to matter. Even then, a small per-record `prev` (the last version's text) is
cheaper than a log.

**Order of work** (each a step Chris approves):

1. Engine: `model.recordDiff(before, after, templates)`. This is `changesSince` over two versions, and
   it returns rows with `before` and `after`. Add tests with made-up documents.
2. Engine: `GitHubStore.prototype.fileHistory(path, { page })`. This lists commits and fetches blobs
   by sha, cached. It has a fake-GitHub test, like `sync`'s.
3. A History panel in EE, ME, and FW (the lab's layout), for the open review, with one filter for
   Scribe only. View opens the diff.
4. Resolving a conflict copy in one step, in place of copying text by hand and then deleting the copy
   (Chris, 2026-11-13; prototyped in the lab):
   - **Add checked to section:** the copy's sentences that the section lacks are listed. A sentence
     that shares most of its words with one in the section is marked *Changes a sentence* and is
     unchecked by default. Any other is marked *New sentence*, is checked, and goes after the sentence
     that came before it in the copy.
   - **Use the copy instead:** the copy's text replaces the section's text.
   - **Delete copy:** keeps nothing from the copy.
   - Each action is at most two ordinary edits by the person resolving it: the section's new text, then
     the copy's tombstone. Nothing new is needed in the format, the merge, or the sync. The old text of
     both stays in git.
5. Revert, behind a confirm, for comments, requirements, and Scribe sections first. Checks follow.
6. PL (node moves read as moves), then Loom (per harness; a graph diff later).

## The lab

`signoff/lab/history.html` (script `history-lab.js`), served from the tools folder:
<http://127.0.0.1:8774/signoff/lab/history.html>.

**Made-up data.** It uses one Smart Thermostat review, the Main PCBA, with the EE demo's people
(Sam Patel and Morgan Lee) plus a made-up contractor, Riley Chen.

**What it shows:**

- A timeline, newest first. Same-person runs fold into one block, with initials, the name, the time
  span, and counts per kind. A block opens to its changes.
- One branch: Sam and Morgan edited the *3V3 buck* section from the same version.
  - **Copy still open** (the default): the copy's block offers *Add checked to section*,
    *Use the copy instead*, and *Delete copy*. Each one adds changes by You at the top and closes the
    branch. **Reset** puts the copy back.
  - **Resolved by Morgan**: the same branch resolved by hand. Morgan copies Sam's sentence about the
    switching frequency in, deletes the copy, and the block is tagged *Copy resolved*.
- **View change** opens a diff pane. Lines are marked `+` and `−` with underline and strikethrough,
  never by color alone.
- **Revert…** is a stub. It says what it would write (a new edit by you) and writes nothing. On a
  conflict copy that has been resolved, it explains the copy instead.
- A filter (Everything, Scribe, Checks, Comments, Requirements), a "fold runs within" setting, and a
  theme toggle.

**Colorblind-safe.**

- People are told apart by initials and name, never by hue alone.
- The branch has a dashed edge, a *Conflict copy* label, and `--warn-hatch`.
- Deletions use `--issue-hatch`.
