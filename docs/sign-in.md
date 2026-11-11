# Sign in with GitHub: plan

Status (2026-11-10): built and tested locally against the dev app and dev Worker; nothing committed.
Chris chose a GitHub App from the start, built to production level. The production app isn't registered yet.

## Goal

Anyone who uses the suite signs in with their normal GitHub login, including 2FA and passkeys, and
comes back to the page they started from. Nobody creates, copies, or tracks a token. One sign-in covers
every tool, because they all run on one origin (`chrismessick-dpd.github.io`). A token pasted by hand
keeps working as a fallback.

## Why a GitHub App plus a Worker

- **A server piece is unavoidable.** Swapping GitHub's one-time code for a token needs the app's client
  secret. PKCE (added July 2025) doesn't remove that, and GitHub's token endpoint has no CORS, so a
  static page can't call it at all. Device flow needs no secret, but has the same CORS block.
- **A GitHub App, not an OAuth App.** A user's token can reach only repos where the app is installed
  *and* the user has access. Installed on `chrismessick-dpd`, a contractor's token reaches the review
  repos shared with them and none of their own private repos. An OAuth App's `repo` scope would reach
  all of them.
- **API coverage confirmed** against GitHub's list of endpoints for GitHub App user tokens: `GET /user`,
  `GET /users/{u}`, `GET`/`POST /user/repos`, `POST /orgs/{o}/repos`, repository invitations (list and
  accept), `PUT` collaborators, `PUT actions/permissions`, contents, and git blobs, trees, commits, and
  refs.
- **Tokens expire, and that's kept on** (GitHub recommends it). Access tokens last 8 hours and refresh
  tokens 6 months, and each refresh issues a new 6-month refresh token. In practice, a person signs in
  again only after six months without using the suite.

## The pieces

### 1. The GitHub App (Chris registers it; Claude can't)

- Owner: `chrismessick-dpd`. Name: Signoff.
- Callback URLs (up to 10 allowed): `https://chrismessick-dpd.github.io/signoff/auth.html`. Local
  testing uses a separate **Signoff (dev)** app with `http://localhost:8774/signoff/auth.html` and
  8771, so the production app never trusts localhost.
- Repository permissions: Contents read and write; Administration read and write (collaborators and
  the Actions switch); Repository creation read and write (GitHub lists it separately, 2026); Metadata
  read. Account permissions: none. Nothing more until something needs it.
- Where it can be installed: **Any account**. GitHub lets only the owner authorize a private app, so
  "Only on this account" would lock out clients and contractors. It's still installed only on
  `chrismessick-dpd`, and a sign-in alone installs nothing, so tokens reach only that account's repos.
- Expire user authorization tokens: **on**. Request user authorization during installation: off.
  Enable Device Flow: **on** (for the command line). Webhook: off. No private key (nothing needs it).
- Install it on `chrismessick-dpd` with **All repositories**, so every new `review-*` repo is covered
  without anyone touching the installation.
- **Dev app (registered 2026-11-10):** Dovetail Signoff App, client id `Iv23liRCoaHFv0aMl16i` (not a
  secret). GitHub requires a private key before an app can be installed, so it has one. Nothing in the
  suite uses the key; keep it off disk and out of every repo.
- **Dev Worker (deployed 2026-11-10):** `https://signoff-auth-dev.misty-dawn-b371.workers.dev`, with
  the dev app's id and secret and the localhost origins. Checked from the command line: it refuses a
  foreign origin, refuses a bad body, and passes a made-up refresh token to GitHub, which answers
  `bad_refresh_token` (not `incorrect_client_credentials`, so the id and secret are right).
- Secret rotation: generate a second client secret, put it in the Worker, check sign-in, delete the old
  one. GitHub allows two at once, so nobody is signed out.

### 2. The Worker (Cloudflare, Chris's account; created 2026-11-10)

Three routes and nothing else. It is not a general proxy.

| Route | Does | GitHub call |
| --- | --- | --- |
| `POST /exchange` `{code, code_verifier, redirect_uri}` | code → access and refresh tokens | `POST /login/oauth/access_token` |
| `POST /refresh` `{refresh_token}` | new token pair | same, `grant_type=refresh_token` |
| `POST /revoke` `{access_token}` | sign out | `DELETE /applications/{client_id}/token` |

- The client id and secret are Worker secrets, never in a repo.
- It answers only requests whose `Origin` is the Pages origin (and the dev ports for the dev app).
- It never logs bodies or tokens and stores nothing. Review data never passes through it.
- Its code is in the public repo `signoff-auth` (created 2026-11-10), with no secrets in it. Its
  README covers the settings, deployment from the dashboard, and secret rotation. Every sign-in must
  use PKCE: `/exchange` refuses a request without `code_verifier`, or with a `redirect_uri` that
  isn't in its allowlist.

### 3. The browser side (built 2026-11-10)

`auth.js` is an **engine file** (`ee_design_review/assets/auth.js`, `window.SignoffAuth`): synced into ME and
FW with the engine, vendored into PL, Fabcheck, Loom, and Flasher (`assets/vendor/auth.js`), and into the
hub (`assets/auth.js`, by `tools/sync_suite_css.py`), so it's stamped with each tool and never runs stale
beside a newer `github.js`. One page, `signoff/auth.html` (with `assets/auth-page.js`), is where GitHub
returns.

- **Which app.** `APPS` in `auth.js` maps the page's origin to its GitHub App and Worker. Only localhost
  8774 and 8771 (the dev app) are listed until the production app exists; anywhere else, `available` is
  false and the tools show the token field as before.
- **Sign in.** The button stores `state`, a PKCE verifier, and the page to return to in sessionStorage,
  then goes to `github.com/login/oauth/authorize`. `auth.html` checks `state`, strips the code from the
  address, calls `/exchange`, asks GitHub who signed in, and only then stores the tokens and the login
  together, and returns to the page.
- **Every tool talks to the Worker** (changed from the plan's iframe): each page's CSP `connect-src`
  lists the Worker. Every tool runs on the same origin as `auth.html`, so an iframe would have isolated
  nothing; the refresh token is readable by any page there either way.
- **Refresh** (`token()`, `refresh(failed)`): an hour before expiry, and once on a 401, inside one
  `navigator.locks` lock across every tab of every tool, re-reading storage inside the lock. The
  engine's `github.js` `apiCall` does this for every call made with a sign-in's token (`owns`: signed in
  and `ghu_`), so stores made earlier with an older token keep working. Loom's `boards.js` does the same
  for its own fetch. A refresh token GitHub refuses signs out; an unreachable Worker keeps everything.
- **Storage.** `signoff.token` holds the current access token, so code that reads it still works.
  `signoff.auth` holds the refresh token, the expiry times, and the GitHub name; `signoff.login` the login.
  A cookie set by the Worker would be third-party from github.io and isn't reliable.
- **Who it is.** `model.tokenTag` (and the hub's copy) fingerprints a sign-in's token by the login, so a
  refresh is the same person and FTE detection survives it. Storage listeners in EE, PL, Fabcheck, and
  Flasher react only when that tag changes.
- **"Remember me" is gone for sign-ins**: a duplicated tab would copy the refresh token, and the first
  refresh would kill the copy. A pasted token keeps the checkbox.
- **Sign out** (every tool's) calls `/revoke`, waits for it, then clears `signoff.token`, `signoff.auth*`,
  and `signoff.login` with the rest. A pasted token the sign-in replaced isn't brought back: Sign out
  means signed out.
- **Settings.** Signed in, Settings says "Signed in with GitHub as @login" and has no token field, and
  Save never touches the token. Signed out where it's set up, *Sign in with GitHub* comes first and the
  token field folds under *Use a token instead*. The signed-out and locked pages offer the button too
  (EE, ME, FW, PL, and Flasher); Fabcheck offers it in its Send sign-in sheet (the page reloads on the
  way back, so send again). Loom and the hub have no sign-in of their own; they use EE's.

### 4. The command line (built 2026-11-10)

`node tools/signoff.js login` uses device flow: it prints a code to enter at github.com/login/device and
waits. Device-flow tokens renew without the client secret, so the CLI needs no Worker. The sign-in is
kept in `~/.signoff/auth.json` (mode 600, outside every repo), renewed before a command when under an
hour is left, and used after `SIGNOFF_TOKEN` and `--token-file` but before `ee_tools_token.txt`.
`logout` forgets it (revoking needs the secret, so it links to github.com/settings/apps/authorizations).
The client id is `SIGNIN_CLIENT_ID` in `signoff.js`, or `signinClientId` in `~/.signoff/config.json`.

### Tests

EE 401 (21 for sign-in: the tag across a refresh and an account change, `apiCall`'s refresh and single
retry, pasted tokens never refreshed, four callers at once making one Worker call, a refused refresh
signing out, and an unreachable Worker keeping the sign-in and the current token), ME 62, FW 70, PL 240, Loom 26, Flasher 55
and 24, the command line 39 × 3 (login with pending and slow_down, renewal, a dead sign-in, logout).

## Spike results (2026-11-10, Chris, in Chrome on http://localhost:8774/signoff/lab/signin.html)

Passed: sign-in through GitHub and back; `/user`; listing repos; listing invitations; two tabs refreshing
at once (one called the Worker, the other waited for its token; neither was signed out); creating a
private repo, reading it back at once, and deleting it; reading the installation's permissions.

Learned: the app does nothing until it's **installed** on the account (github.com/apps/<slug> →
Install → All repositories). Before that, sign-in works but every repo call fails with 403 "Resource
not accessible by integration". Clients and contractors only sign in; they never install it.

Not yet tried: a second GitHub account as a contractor (it should list only what's shared with it),
and a real tool (EE) using the signed-in token.

## Order of work

1. **Spike** (dev app, dev Worker, a scratch page; no tool changes). Prove: sign-in with 2FA and
   return; `/user/repos` lists a shared `review-*` repo for a second account (contractor); `POST
   /user/repos` and then immediate access to the new repo; accepting an invitation; two tabs refreshing
   at once with neither signed out; revoke.
2. `auth.js` and `auth.html` in the hub, with tests.
3. Engine: `github.js` refresh-and-retry, the `tokenTag` change, Settings and the locked page. Build,
   sync into ME and FW, and run their tests.
4. Vendor into PL, Fabcheck, Loom, Flasher, and the hub; move their direct readers and `storage`
   listeners; stamp; run every suite.
5. CLI `login`, with `signoff_test.js` cases.
6. Production app and Worker; Chris signs in on the hosted pages, then a second account as a
   contractor.
7. Docs: EE README (*Users and tokens*), each tool's CLAUDE.md, and the suite CLAUDE.md.

## Production setup (Chris; then Claude adds the origin)

1. Register the production GitHub App, **Dovetail Signoff**, as in section 1, with the callback
   `https://chrismessick-dpd.github.io/signoff/auth.html`. Generate a private key (GitHub needs one to
   install) and a client secret. Install it on `chrismessick-dpd`, All repositories.
2. Create the Worker `signoff-auth` in Cloudflare (as the dev one): `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET` (Secret), `ALLOWED_ORIGINS` = `https://chrismessick-dpd.github.io`,
   `ALLOWED_REDIRECTS` = the callback above. Check its `workers.dev` address.
3. Claude adds the origin to `APPS` in `auth.js`, the Worker to every tool's CSP, and the client id to
   `SIGNIN_CLIENT_ID`, then syncs, vendors, stamps, and tests.
4. Chris signs in on the hosted pages, then a second account as a contractor.

## Decisions for Chris

1. ~~Refresh through an iframe~~: every tool calls the Worker (2026-11-10; the iframe would have
   isolated nothing, since every tool shares `auth.html`'s origin).
2. A separate dev app for localhost (planned), or localhost callbacks on the production app.
3. ~~Where the Worker's code lives~~: `signoff-auth` (Chris, 2026-11-10). The Cloudflare account is
   Chris's, created 2026-11-10 under his work login.
4. Session-only sign-in is dropped for sign-ins (pasted tokens keep it).

Chris approved 1 and 4, and Sign out not restoring a pasted token, on 2026-11-10.
