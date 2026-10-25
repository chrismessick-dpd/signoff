# Dovetail Signoff: user guide

**Part 1** can be shared with customers. **Part 2** is for Dovetail FTEs, and covers how the whole
suite fits together.

---

## Part 1: Dovetail Signoff at a glance

Dovetail Signoff is Dovetail's set of design review tools. Each one turns a review into a
structured, traceable record: what was checked, what was found, who resolved it, and whether the
design meets its requirements.

| Tool | For |
| --- | --- |
| **Signoff EE** | Electrical reviews: schematic, interfaces, layout, assembly, fabrication, bring-up (931 checks) |
| **Signoff ME** | Mechanical reviews: concept, part DFM, tolerancing, assembly, materials, analysis, enclosure, drawings, validation (845 checks) |
| **Fabcheck** | Checking a PCB fab package before release; files never leave the browser |

What they share:

- **Checklists that fit the design.** Describe the product (battery, mains, RF, injection molded,
  sealed…) and checks that don't apply are set aside.
- **Issues and requirements tracked to closure.** Each issue has a severity, owner, discussion and
  outcome. Requirements trace to the checks that show they're met.
- **Real collaboration.** Several reviewers work on the same review at once without overwriting
  each other. Each person sees only the projects they've been given.
- **One look.** The tools share one design, with light and dark mode, and switch between each other
  from the sidebar.

**Try it:** the hub's demo (`?demo`) links to sample reviews in Signoff EE and Signoff ME. They
run entirely in your browser.

---

## Part 2: for Dovetail FTEs

### The suite

```
C:\Dovetail\tools\              each folder is its own private GitHub repo (chrismessick-dpd)
  signoff\            hub: this landing page
  ee_design_review\   Signoff EE + the shared engine          data: ee_design_review_data
  me_design_review\   Signoff ME (engine copied from EE)      data: me_design_review_data
  pcb_dfm\            Fabcheck
```

- Everything is **static HTML/JS**: no server and no build server. Open the `index.html` files from
  disk, or serve the `tools` folder (`python -m http.server`) so the tools share one origin and
  link to each other.
- **Data lives in GitHub.**
  - **Data repos** (FTEs only) hold internal projects and the People list.
  - Each project shared with a contractor moves to its own private **`review-ee-…` / `review-me-…`**
    repo.
  - Fabcheck runs and packages sit next to their project, under `fabcheck/<projectId>/`.
- **Sign-in is a GitHub token kept in the browser.** It is sent only to `api.github.com` and shared by
  all the tools on the same origin, along with your name and light/dark mode.

### Hosted on GitHub Pages

The four tool repos are public and served by GitHub Pages from `main`:

| | |
| --- | --- |
| Hub | https://chrismessick-dpd.github.io/signoff/ |
| Signoff EE | https://chrismessick-dpd.github.io/ee_design_review/ |
| Signoff ME | https://chrismessick-dpd.github.io/me_design_review/ |
| Fabcheck | https://chrismessick-dpd.github.io/pcb_dfm/ |

Things to know about hosting:

- **Updates go live within a minute or two** of a push to `main`, with no build step.
  - `.nojekyll` makes Pages serve the files as they are.
  - Each tool's version stamp tells open copies that a newer tool is available.
- **Reviews stay private.** The data repos and every `review-…` repo remain private. The pages
  only read and write them through GitHub's API with each person's own token.
- **One origin.** All four sites share `chrismessick-dpd.github.io`, so they share one browser
  storage: the sign-in token, your name and light/dark carry across. Any other Pages site
  published from this account would share that storage too, so don't publish untrusted pages
  from it.
- **Contractors** can be sent the Signoff EE or ME link instead of a zip. Like everyone, they get
  the sidebar links to the hub, the other Signoff tool and Fabcheck.
- **Public means public.** The repos' code, checklists, docs (including the FTE sections) and
  commit history, with author name and email, are visible to anyone. Never commit client data,
  tokens or fab packages to them.
- When the repos move to the company organization, the URLs change to that organization's
  `github.io` address. People will need to paste their token once on the new site, because
  browser storage doesn't carry across sites.

### People and access

GitHub grants access per repository, so access follows repos:

| Person | Gets |
| --- | --- |
| FTE | Every suite repo: tool, data, hub, Fabcheck, and every shared project repo. Add them in **both** Signoff EE's and Signoff ME's People pages. |
| Contractor | Only the `review-…` repo of each project they're added to. They never see the data repos or other projects. |

Adding a contractor to a project moves the project into its own repo and sends the GitHub
invitations. Removing them revokes access, and their copy disappears at their next sync.

**Tokens:**
- **Account owner:** a fine-grained token with *All repositories*, and *Contents* and
  *Administration* both read/write. Sharing creates new repos.
- **Everyone else:** a classic token with the `repo` scope. Settings has a link that fills it in.

**On a personal account**, only the owner can create repos and invite people, and every
collaborator can push. Moving the repos to the company GitHub organization lifts that. The
account name is a setting, so the move is cheap.

### Onboarding

**A new FTE**
1. They create a GitHub account and send you their username.
2. Add them as an FTE in Signoff EE's and Signoff ME's People pages, and confirm the invitations.
3. They clone or download the tool folders, open Signoff, paste a token in Settings, and
   accept the invitations from the sidebar.

**A contractor**
1. Add them to the project in People (or in the project's details), and confirm.
2. Send the contractor zip: run `python tools/package.py` in the tool's folder. The zip holds the
   tool only, with no data and no token.
3. They follow *New to GitHub? Set up in four steps* in Settings.

### Changing the tools

- **The engine** (model, sync, UI, styles) is edited only in `ee_design_review`:
  - `python tools/sync_engine.py` copies it into Signoff ME;
  - `python tools/sync_suite_css.py` (hub) and `python tools/sync_vendor.py` (Fabcheck) pick up
    style and engine changes.
- **Each tool:** run its build or stamp script, then its tests (`tests/test.html` over http), then
  commit.
- Review data commits straight to `main`. Tool and checklist changes should go through pull requests.

### Hub specifics

- `index.html` links to the tools by relative path, so the four folders must stay siblings.
- In demo mode the hub links to each tool's demo.

### More detail

- Signoff EE: `ee_design_review/docs/guide.md`, which covers architecture, everyday use and
  troubleshooting.
- Signoff ME: `me_design_review/docs/guide.md`.
- Fabcheck: `pcb_dfm/docs/guide.md`.
