# Tickets

Chris (2026-11-12): a lightweight way for anyone signed in to tell the developer something is
wrong, confusing, or missing, with pictures, and one list of every ticket with its state, who it's
assigned to, and its discussion.

## Decisions (Chris, 2026-11-12)

- **Stored** in a new private repo, `chrismessick-dpd/signoff_tickets` (created 2026-11-12, at his
  OK). The GitHub App is installed on All repositories, so sign-ins reach it with no extra setup.
- **FTEs only.** Clients and contractors don't see Open ticket or Tickets. Another FTE needs to be a
  collaborator on `signoff_tickets` to read or file tickets. Since 2026-11-12 it's on the list of repos
  every FTE is invited to (`repos.suite` in EE's, ME's, and FW's `config.js`), so making someone an FTE in
  People & access invites them.
- **Everything is in the ⋯ menu:** *Open ticket…* and *Tickets*, which opens one sheet over the
  page. There's no sidebar link (Chris first asked for one above People & access, then removed it the
  same day, since the menu does it all).
- **States:** Open, In progress, Fixed, and Closed. Fixed means the developer thinks it's done: the
  reporter sees *Does it work for you now?* with *Yes, close it* and *No, reopen it*. Closed also
  covers won't-fix, with the reason in the discussion.

## How it's built

`signoff/assets/tickets.js` (and `tickets.css`, which it loads from beside itself). Every tool loads it with a plain
script tag after `people.js`. It needs nothing from the tool except these hooks:

- **Who.** A page shows tickets to whoever it shows People & access (`#people-link` not hidden, which
  is FTEs in every tool) when a token is present, and never in `?demo`. It watches that link,
  so a sign-in or sign-out follows.
- **The ⋯ menu.** Tools with their own ⋯ menu (EE, ME, FW, and PL; `#toolbar` has
  `data-tickets-own`) offer *Open ticket…* and *Tickets* at the bottom of it, and always draw the
  ⋯, even with no board, part, or project open. Every other tool (the hub, Fabcheck, Loom,
  Partcheck, and Flasher) gets a ⋯ from `tickets.js` at the end of `#toolbar`.
- **Where you were.** A new ticket records the tool, the toolbar's title and tab, the address, the
  tool version, the window size, the theme, and the browser. The engine adds the board or part, the
  open check, and a deep link to it (`SignoffTickets.where` in `app.js`).
- **Deep link.** `?page=tickets` opens the sheet; `&ticket=<n>` opens that ticket.
- **Updates on your tickets** (Chris, 2026-11-13). When someone else changes the state of a ticket you
  reported, or comments on it, a blue bubble with a count sits on the ⋯ button, and the menu's
  *Tickets* item carries the same count, until you open that ticket in the sheet. The sheet lists those
  tickets first under *Updated for you*, whatever the filter (a Fixed one would otherwise hide under
  Active), each marked *Updated*.
  - Seen marks are per login in this browser: `signoff.ticketsSeen` (`{ login: { ticketId: logId } }`,
    the id of the latest state change or comment by someone else when you opened it). It's outside
    `signoff.v1.` on purpose, so Sign out doesn't light every old change up again. A login's first read
    in a browser counts everything so far as seen. Another browser starts afresh.
  - Checked in the background soon after the page opens, every 5 minutes, and on returning to the tab
    (at most once a minute), never while the sheet is open. Only the branch's ref is read unless it moved.
  - The count is put on `#toolbar` (`data-tk-unseen` and the `--tk-unseen` CSS variable) and drawn by
    `tickets.css` on `[data-act="project-menu"]` (EE, ME, FW, and PL) or `#tk-more`, so the tools' own
    redraws of their ⋯ never lose it, and no tool's code changed. The button's label says how many.
- **Assign to** (Chris, 2026-11-12): the developer first, then you, then the tickets repo's
  collaborators and anyone already on a ticket, then *Someone else (a GitHub name)…*. That opens a box
  for any `@name`, checked with GitHub (`/users/<name>`) before it's used. Someone who isn't a
  collaborator on `signoff_tickets` gets a warning, since they can't see the ticket until added.

## The repo

```
tickets/<nnnn>-<id>.json     one ticket: title, body, state, assignee, reporter, where, env, images, log
images/<id>/<pic>.png|jpg    its pictures (and its comments' pictures)
```

`log` holds comments and events (state, assign, title), each with `id`, `at`, and `by`. The number is
in the file name, so the next number comes from the tree alone.

Every write is one commit through the Git Data API (blobs, a tree on the head's tree, a commit, then
the ref with `force: false`). A change is a function applied to the ticket as it is at the head: on a
race (the ref moved) it re-reads and applies it again, up to five times. Two people commenting at
once both land. Pictures are uploaded once as blobs and reused on a retry.

Pictures are pasted (Ctrl+V), dropped, or picked. They're scaled to 1920 px on the long side, kept
as PNG under about 900 KB, otherwise JPEG; 2.5 MB at most, eight at a time. They're read back through
the API with the token and shown as `blob:` URLs, since the tools' CSP allows only `self`, `data:`,
and `blob:` images and the repo is private.

Tickets read are cached by blob sha in `signoff.v1.tickets` (under `signoff.v1.`, so Sign out
clears it).

## The demo

Hidden in `?demo` (Chris, 2026-11-12): no Open ticket… or Tickets, and no ⋯ added. The code
keeps a demo store (three made-up tickets in `signoff.demo.tickets`, never touching GitHub) for UI
work; let `DEMO` through in `can()` to try it locally.

## Tried

- Demo (before it was hidden there), in the browser: EE's ⋯ → Open ticket… with a pasted picture, the list, state changes, Fixed
  with the reporter's question, and comments. The link and ⋯ show in all nine tools.
- Live, from Node with the command-line token (2026-11-12): created a ticket with a picture, set In
  progress, posted two comments at the same moment (both kept), read it back, and deleted it again.
  The repo has no tickets.
- Not tried: a real sign-in in a page (`ghu_` token, refresh on 401).

## Not done

- No email or other notifications. The ⋯ bubble counts updates on tickets you reported, not tickets
  assigned to you.
- `tickets.js` loads unstamped from `../signoff/assets/` in the tools (as `people.js` and `tour.js`
  do), so a tool can run a cached copy for a few minutes after a push.
- Comments can't be edited or deleted.
