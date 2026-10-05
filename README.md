# APAS-Trainer

Standalone PWA for organising one cross-fire-brigade (FF-übergreifend) training for the
**APAS Bronze** exam (Ausbildungsprüfung Atemschutz, NÖ Landesfeuerwehrverband). It is
deployed once per Ausbildung; the training consists of one or more **Trupps** (4-person
Atemschutztrupps with the roles GKDT, ATF/ATM1, ATM2 and Wassertruppführer).

- **Ausbildungsleiter** log in with e-mail + password and land on the Trupp-Liste. They
  create the Trupps, assign the Rollen, add Teilnehmer or share a Trupp's invite link /
  QR code, track every Teilnehmer's checklist (Ampel), set the Prüfungstermin, manage
  Ressourcen and schedule Fixtermine.
- **Teilnehmer** open the invite link and either *join* (Name, FF, Passwort) or *sign in*
  again (Name + Passwort) — no e-mail involved. Roles are assigned afterwards, inside the
  Trupp, by anyone in it. Teilnehmer see and toggle their own checklist, see the whole
  Trupp and its role coverage, browse the Stationskarten and use the shared calendar
  (incl. creating Individualübungen and booking Ressourcen).
- Push reminders go out N hours before each Termin to its assigned Teilnehmer and the
  Ausbildungsleiter.

## Repository layout

```
apps/
  api/            Express 5 + TypeScript API, file-based JSON storage
    src/
      routes/     auth, join (invite-link join/login), trupps (+teilnehmer, ressourcen),
                  teilnehmer (Rolle), termine, push
      lib/        store (JSON collections + mutex), auth (JWT middleware), password (bcrypt)
      push.ts     web-push wrapper (VAPID, subscriptions)
      reminders.ts  setInterval reminder loop
      scripts/    seedAdmin.ts, generateVapid.ts
    Dockerfile
  web/            React 18 + Vite PWA
    public/       manifest.webmanifest, sw.js, icons/
    src/views/    Login, TruppDashboard, TruppDetail, Join, TeilnehmerView,
                  Stations, Calendar (+ one .css per view)
    Dockerfile, nginx.conf.template
packages/
  shared/         Types + small pure helpers shared by api and web
scripts/          dev.mjs (runs api + web), generate-icons.mjs
docker-compose.yml
.env.example
```

## Local development

Requirements: Node.js ≥ 22.12, npm ≥ 10.

```bash
npm install          # installs all workspaces and builds packages/shared
cp .env.example .env # optional for dev — sensible defaults are built in
npm run seed-admin   # create the first Ausbildungsleiter (see "First run")
npm run dev          # API on :3001, web on http://localhost:5173 (proxies /api)
```

- To try the Teilnehmer side, copy a Trupp's invite link from TruppDetail into a private
  window and use "Neu beitreten". Coming back later works on the same link via "Anmelden".
- The service worker is only registered in production builds, so it never
  interferes with Vite's dev server. Use `npm run build && npm run preview -w @apas/web`
  (with the API running) to test the installable PWA locally.

Other root scripts:

| Script                   | What it does                                               |
| ------------------------ | ---------------------------------------------------------- |
| `npm run typecheck`      | `tsc --noEmit` in shared, api and web                      |
| `npm run build`          | builds shared → api (`dist/`) → web (`dist/`)              |
| `npm start`              | runs the built API (`apps/api/dist/index.js`)              |
| `npm run seed-admin`     | create an Ausbildungsleiter / reset their password         |
| `npm run generate-vapid` | print a fresh VAPID key pair for `.env`                    |
| `npm run generate-icons` | regenerate the placeholder PWA icons                       |

## First run — creating the Ausbildungsleiter account

There is no public sign-up. Create the account(s) with:

```bash
npm run seed-admin
# E-Mail des Ausbildungsleiters: kommandant@ff-beispiel.at
# Passwort (min. 10 Zeichen): ********
```

Running it again with an existing e-mail resets that account's password.
Non-interactive: `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run seed-admin`.

In Docker:

```bash
docker compose exec api node dist/scripts/seedAdmin.js
```

## Environment variables

All configuration is read by the API from the environment. In dev, `npm run dev` /
`npm start` / `npm run seed-admin` automatically load the root `.env` if it exists;
`docker compose` passes it to the api container via `env_file`. See
[`.env.example`](./.env.example) for the full annotated list.

| Variable                    | Default                      | Notes                                                              |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| `PORT`                      | `3001`                       | API port                                                           |
| `DATA_DIR`                  | `./data`                     | JSON files live here (`/data` volume in Docker)                    |
| `JWT_SECRET`                | dev fallback                 | **Required in production** (`openssl rand -base64 48`)             |
| `LEITER_TOKEN_TTL`          | `7d`                         | Ausbildungsleiter session length                                   |
| `TEILNEHMER_TOKEN_TTL`      | `90d`                        | Teilnehmer session length                                          |
| `CORS_ORIGIN`               | _(empty)_                    | Only needed if web and API are served from different origins       |
| `TRUST_PROXY`               | `1` in production            | Express `trust proxy` (correct client IPs for rate limiting)       |
| `VAPID_PUBLIC_KEY`          | _(empty)_                    | Push is disabled while empty                                       |
| `VAPID_PRIVATE_KEY`         | _(empty)_                    |                                                                    |
| `VAPID_SUBJECT`             | `mailto:admin@example.com`   | Contact for push services                                          |
| `REMINDER_HOURS_BEFORE`     | `24`                         | Reminder lead time                                                 |
| `REMINDER_INTERVAL_MINUTES` | `5`                          | How often the reminder loop checks                                 |
| `TZ`                        | system                       | Timezone used in reminder texts (`Europe/Vienna` recommended)      |
| `API_PORT` / `WEB_PORT`     | `3001` / `8080`              | Host ports in `docker-compose.yml`                                 |

The web app needs no runtime configuration: it calls the API on the same origin under
`/api` (Vite proxy in dev, nginx proxy in Docker). If you ever serve the API from a
different origin, build the web app with `VITE_API_URL=https://api.example.at` and set
`CORS_ORIGIN` on the API accordingly.

### Push notifications (VAPID)

```bash
npm run generate-vapid
# VAPID_PUBLIC_KEY=B...
# VAPID_PRIVATE_KEY=...
```

Paste both lines into `.env`, set `VAPID_SUBJECT`, restart the API. Generate the keys
**once** — changing them invalidates every existing browser subscription. Users enable
reminders per device with the 🔕 button in the header (requires HTTPS in production,
or `localhost`). On iOS, push only works once the PWA has been added to the home screen.

## Production build & deployment

```bash
npm ci
npm run build
NODE_ENV=production JWT_SECRET=… npm start
# serve apps/web/dist as static files and proxy /api → the API
```

### Docker

```bash
cp .env.example .env    # set JWT_SECRET, VAPID_* …
docker compose up -d --build
docker compose exec api node dist/scripts/seedAdmin.js
```

- **api** (`apps/api/Dockerfile`): multi-stage Node 22 Alpine build, runs as `node`,
  stores data in the named volume `apas-data` mounted at `/data`. Exposed on
  `API_PORT` (default 3001) for direct access/health checks.
- **web** (`apps/web/Dockerfile`): multi-stage build → `nginx:alpine` serving the static
  PWA on `WEB_PORT` (default 8080) and reverse-proxying `/api/` to `api:3001`.

Put your TLS-terminating reverse proxy in front of **web** only. Both Dockerfiles use the
repo root as build context.

**Backups:** everything lives in the `DATA_DIR` JSON files
(`ausbildungsleiter.json`, `trupps.json`, `teilnehmer.json`, `ressourcen.json`,
`termine.json`, `pushsubscriptions.json`, `reminders.json`). A leftover `magiclinks.json`
from before the password switch is no longer read and can be deleted.
Copying the volume is a complete backup.

## API overview

All endpoints are under `/api`. Auth is `Authorization: Bearer <jwt>`.

| Method & path                                              | Auth                          |
| ---------------------------------------------------------- | ----------------------------- |
| `POST /auth/leiter/login`                                  | public                        |
| `GET  /auth/leiter/me`                                     | Leiter                        |
| `GET  /auth/teilnehmer/me`                                 | Teilnehmer                    |
| `GET /trupps/:inviteToken/join` (Trupp name + date)        | public                        |
| `POST /trupps/:inviteToken/join` {name, ff, password} → JWT | public                        |
| `POST /trupps/:inviteToken/login` {name, password} → JWT   | public                        |
| `PATCH /teilnehmer/:tid/rolle` {rolle \| null}             | owner or any member           |
| `GET/POST /trupps`                                         | Leiter                        |
| `GET /trupps/:id` · `PATCH /trupps/:id`                    | member / owner                |
| `POST /trupps/:id/invite/regenerate`                       | owner                         |
| `GET /trupps/:id/teilnehmer`                               | member / owner                |
| `POST /trupps/:id/teilnehmer` {name, ff} → {teilnehmer, tempPassword} | owner                         |
| `PATCH /trupps/:id/teilnehmer/:tid/checkliste`             | owner or that Teilnehmer      |
| `DELETE /trupps/:id/teilnehmer/:tid`                       | owner                         |
| `GET /trupps/:id/ressourcen` · `POST` · `DELETE /:rid`     | member (read) / owner (write) |
| `GET /trupps/:id/termine?from&to` · `POST` · `PUT/DELETE /:terminId` | member / owner                |
| `POST /trupps/:id/termine/konflikte`                       | member / owner                |
| `GET /push/vapid-public-key` · `POST /push/subscribe` · `POST /push/unsubscribe` | public / any                  |
| `GET /health`                                              | public                        |

## PWA notes

- `apps/web/public/manifest.webmanifest` — name "APAS-Trainer", red/dark theme.
- `apps/web/public/sw.js` — precaches the app shell under a versioned `CACHE` string;
  navigations are network-first (offline → cached shell), hashed assets cache-first,
  `/api` never cached. The worker calls `skipWaiting()`/`clients.claim()` and deletes
  old caches, so a new version is active on the next reload. **Bump `CACHE`** whenever
  you change the shell list or `sw.js` itself.
- **Icons are placeholders** (a white "A" on red) generated by
  `scripts/generate-icons.mjs`. Replace `apps/web/public/icons/*.png` (192, 512,
  maskable 512 with an 80 % safe zone, 180 apple-touch) with real artwork later.

## Design decisions

Things SPEC.md left open and how they were resolved:

**Scope: one Ausbildung, one or more Trupps**
- The app serves a single APAS-Bronze-Ausbildung per deployment; it is not a
  multi-course platform. What SPEC.md calls a "Gruppe" is a **Trupp** in the code, the
  API (`/api/trupps`, `truppId`) and the UI. SPEC.md itself is kept as the original
  brief and still uses the old term.
- Several Trupps can train in parallel in the same Ausbildung, so the Trupp entity and
  "Neuen Trupp erstellen" stay. Each Trupp keeps its own invite link, Prüfungstermin,
  Ressourcen and calendar, exactly as before. Merging those into one training-wide
  setting would be a schema change the rename deliberately avoids.
- After login the Ausbildungsleiter lands on `/trupps`, a plain list of the Trupps
  (sorted by Prüfungstermin). Each row shows the name, "x/4 Rollen besetzt" (red while
  incomplete), the Teilnehmer and "bereit" counts and the Prüfungstermin countdown, and
  opens the Trupp-Details. "+ Neuen Trupp erstellen" is a small secondary button below
  the list. Only when no Trupp exists yet is the create form shown directly.
- The Ausbildungsleiter creates the Trupps and does the Rollen-Zuweisung (Trupp-Details:
  "+ Person hinzufügen" and the Rolle dropdown per row). Teilnehmer can still adjust
  Rollen in their "Trupp" tab, unchanged from before (see **Rollen**).
- Existing data is migrated on API start (`src/migrate.ts`, idempotent):
  `gruppen.json` is renamed to `trupps.json`, and `gruppeId` becomes `truppId` in
  `teilnehmer.json`, `ressourcen.json` and `termine.json`. Teilnehmer tokens issued
  before the rename (claim `gruppeId`) and the remembered invite link in the browser
  keep working. Old `/gruppen/...` URLs in the web app fall through to `/` and from
  there to `/trupps`.
- Official exam wording in the station content and role labels ("Gruppenkommandant",
  "Sprechgruppe", "Ausbildungsgruppe" …) is quoted from the NÖ LFV Bestimmungen and is
  deliberately not renamed.

**Reference project**
- The FWMS repository the spec refers to (Dockerfile structure, `push.ts`) was not
  available on the build machine, so those parts follow a conventional
  multi-stage / web-push layout. Align them with FWMS later if they differ.

**Auth & sessions**
- Tokens are sent as `Authorization: Bearer` headers and stored in `localStorage`
  (no cookies → no CSRF handling needed). The two token types are separate in every
  way: different `kind` claim (`leiter` / `teilnehmer`), different JWT audience,
  different payload (`email` vs `truppId`), separate middleware (`requireLeiter`,
  `requireTeilnehmer`, `requireAny`), and separate `localStorage` keys, so one device
  can hold both sessions without them leaking into each other.
- Session lengths: Ausbildungsleiter 7 days, Teilnehmer 90 days (logging in again on a
  phone at the Übung should be rare). Both configurable.
- Teilnehmer join and log in with a **password** on the Trupp's invite link
  (`/join/:token`, tabs "Neu beitreten" / "Anmelden"). There is no e-mail at all: no
  address is collected, nothing is sent, and there is no SMTP dependency. Joining
  logs in immediately.
- Identity is **(Trupp, Name) + Passwort**, not a global username, so two Trupps can
  each have a "Max". Names are unique within a Trupp, compared trimmed,
  whitespace-collapsed and case-insensitive ("max  muster" = "Max Muster"). A second
  join with a taken name gets a `409` that tells the person to use "Anmelden" (or to
  add an initial). Wrong name and wrong password give the same `401` error. Unknown
  names still run a bcrypt compare, so timing doesn't reveal which names exist.
- Passwords: at least 8 characters for Teilnehmer (10 for Ausbildungsleiter via the
  seed script), at most 72 (bcrypt's input limit, so input is rejected rather than
  silently truncated). Both use the same bcrypt cost, 12 (`lib/password.ts`).
- Login is tied to the invite token. After "Neu erzeugen" of the invite link,
  Teilnehmer need the new link to log in again (existing sessions keep working).
  The browser remembers the last used invite link, and the Login page offers a
  shortcut back to it.
- **Manual add by the Ausbildungsleiter** (TruppDetail → "+ Person hinzufügen", Name +
  FF), e.g. to pre-populate a Trupp before the first Übung. This is a second path next
  to the invite link, which stays the normal way in. `POST /trupps/:id/teilnehmer`
  creates the record exactly like a self-join (bcrypt, `rolle: null`, same name
  normalisation, same `409` shape for a taken name) with a generated password: 11
  characters from an alphabet without look-alikes (no 0/O/o, 1/l/I), about 64 bit. The
  plaintext is returned once in the response, shown once in a dismissable box with a
  copy button, and never stored or logged. The person logs in on the invite link under
  "Anmelden" with name + that password.
- The generated password stays valid; there is no "change password" flow (out of scope,
  same as reset). If it gets lost before being passed on, remove the person and add
  them again, which takes seconds while they have no data yet.
- There is no password reset for Teilnehmer. If someone forgets theirs, the
  Ausbildungsleiter removes them in TruppDetail and they join again. This loses their
  checklist ticks and Termin assignments, which is acceptable at this scale.
- Migration: Teilnehmer created under the old magic-link flow have no password. Login
  tells them to use "Neu beitreten" once with exactly the same name. That **claims**
  the existing record (sets the password, keeps id, Rolle, checklist and Termine) and
  drops the stored e-mail. Their old sessions remain valid until they expire.
- A Teilnehmer record belongs to exactly one Trupp. The same person in two Trupps
  has two accounts; the browser holds one Teilnehmer session at a time (the most
  recent login).
- No sign-up endpoint exists. Ausbildungsleiter accounts are created only via
  `npm run seed-admin`.
- Rate limits: 300 req/min per IP on the whole API. Password logins (Ausbildungsleiter
  and Teilnehmer) allow 20 **failed** attempts per 15 min per IP. Successful logins
  don't count, so a whole Trupp behind one NAT can still sign in. Join allows 30
  attempts per 15 min per IP, and every attempt counts because it creates accounts.

**Rollen**
- Rolle is **not** chosen at join. New Teilnehmer start with `rolle: null` ("keine
  Rolle"), and the Rolle is assigned later with `PATCH /teilnehmer/:id/rolle`.
- Anyone in the Trupp may change **anyone's** Rolle at any time: the owning
  Ausbildungsleiter (dropdown per row in TruppDetail) and every Teilnehmer (tab
  "Trupp" in the Teilnehmer view). Role shuffling before the exam is a joint
  decision. Checklists stay restricted (own checklist, or the Ausbildungsleiter).
- Duplicate roles are allowed (Ergänzungsteilnehmer in Trupps with more than 4
  people). Both views show the coverage as "x/4 Rollen besetzt" with one chip per
  Rolle (×n when held more than once), but nothing is blocked.

**Data model**
- The Checkliste is embedded in the Teilnehmer record. The Teilnehmer and the owning
  Ausbildungsleiter can both toggle it. The Tauglichkeit exemption follows whoever
  **currently** holds GKDT: for them `tauglichkeit` is shown as greyed "N/A", the API
  ignores changes to it, and the Ampel doesn't count it. The stored value is kept, so
  it comes back unchanged if the Rolle moves on. Without a Rolle, all three items are
  required.
- The checklist labels stay as the short codes **AT** and **ATS3** (plus
  "Tauglichkeit"), because the spec doesn't define their long names. Change them in one
  place: `CHECKLIST_LABELS` in `packages/shared`.
- Ampel: green = all *required* items ok, yellow = some, red = none. The dashboard
  shows "x bereit" (green) per Trupp.
- `Trupp.stufe` exists and is always `'BRONZE'`. It is the cheap hook for
  Silber/Gold later; nothing else is generalised.
- Ressourcen are scoped per Trupp. Only the Ausbildungsleiter creates or deletes them
  (in TruppDetail), and every member can book them on Termine. Deleting a Ressource
  keeps its Termine but removes the booking.
- Removing a Teilnehmer also removes them from all Termine and deletes their push
  subscriptions.
- `Buchung` is the shared type for "Ressource booked by a Termin for a time window";
  overlap results come back as `BuchungsKonflikt[]`.

**Termine & calendar**
- Fixtermine: only the Ausbildungsleiter creates, edits or deletes them.
  Individualübungen: any Teilnehmer (or the Ausbildungsleiter) can create them, and
  the creator or the Ausbildungsleiter can edit or delete them. Everyone in the Trupp
  can see every Termin. Others see a read-only detail view.
- Teilnehmer assignment is completely free (any subset, including none). Defaults:
  a new Fixtermin pre-selects the whole Trupp; a new Individualübung pre-selects the
  creator.
- Conflicts: the editor calls `POST /termine/konflikte` live (debounced) and shows a
  yellow inline banner. Saving is never blocked. The save response also returns the
  conflicts, as informational data.
- The calendar form edits single-day Termine (date + start/end time). The API
  accepts any start < end range. The month grid starts on Monday (AT convention)
  and shows Fixtermine as solid red chips and Individualübungen as dashed outline
  chips. On phones the chips collapse to colour bars and a "Nächste Termine" list
  sits below the grid.
- Datetimes are stored as UTC ISO strings and shown in the browser's local time. The
  Prüfungstermin is a plain `YYYY-MM-DD` date with no timezone.

**Push reminders**
- One reminder per Termin per start time. Moving a Termin re-arms it. The reminder is
  recorded *before* sending (at-most-once, so a crash never causes duplicates). A
  Termin created less than `REMINDER_HOURS_BEFORE` ahead gets its reminder on the
  next tick.
- The loop only runs when VAPID keys are configured. Dead subscriptions (HTTP 404/410)
  are pruned automatically.

**Storage**
- Each collection is one JSON file, cached in memory, with all writes serialised
  through a per-collection promise queue and persisted atomically (temp file +
  rename). This assumes a **single API process**, so don't scale the api container
  horizontally.

**Tooling & deployment**
- New tooling is limited to `tsx`, used only to run TypeScript in dev and for the
  seed script. `scripts/dev.mjs` starts api + web without adding `concurrently`.
  Icons are generated with plain Node (zlib), with no image library.
- Express 5 and zod 4 (current majors). `react-router-dom` is on v7, because v6 has
  open security advisories. v7 still supports React 18.
- Docker uses **two containers**. nginx serves the PWA and proxies `/api`, so the
  browser sees a single origin (no CORS, and the service-worker scope is simple).
  The api port is also published for health checks and direct access.

**Content**
- UI language is German (Austrian conventions: "Servus", Monday-first weeks). Code and
  comments are English.
- The station overview (`Stations.tsx`) stays short: a summary and focus points per
  station, the Bestehensregel (max. 35 in total, per-station limits 20/10/10/5+6,
  repeat after 14 days at the earliest), and the source. Each card opens a **station
  deep-dive** (`StationDetail.tsx`) at `<overview>/:stationId`. It's mounted at
  `/stationen`, `/trupps/:id/stationen` (Leiter) and `/teilnehmer/stationen`
  (Teilnehmer; that overview is the "Stationen" tab, now addressable as
  `/teilnehmer?tab=stationen`).
- All deep-dive content lives in `apps/web/src/content/stations.ts`, structured from
  the NÖ LFV Bestimmungen APAS (12/2015), Abschnitte 9.2–9.5, Fragenkatalog and Beilage
  Hindernisstrecke, keeping their wording. It includes the Ablauf steps, Zeitvorgaben,
  Fehlerpunkte tables and the 36 Gerätekunde questions. Edit it there with the PDF at
  hand; the reference extract it came from was removed from the repo after import.
- Detail page: Zeitvorgabe chips at the top ("Soll: 170 Sek." + mm:ss), then the Ablauf
  as a guided step-through. One active step slides in with a CSS keyframe animation,
  Weiter/Zurück or swipe moves between steps, a progress bar shows "Schritt x von y",
  and the full numbered list below lets you jump. This is the "animation". No
  libraries, and `prefers-reduced-motion` is honoured.
- Where the Bestimmungen list alternatives (Kurzprüfung 200 vs. 300 bar, Flaschenwechsel
  200 vs. 300 bar), both are separate steps in the walk-through, with a note that only
  the one for your device applies. Gold-only parts and the "außerhalb des Fahrzeuges"
  variant are shown as info cards below the walk-through, not as steps, since v1 is
  Bronze.
- Checkliste: every Fehlerpunkte table row is a checkable "vermieden" item with its
  points ("2 Punkte je Mitglied"). Rows worth 10+ points are highlighted. The check
  state is component-local and is reset by leaving the page; it's a self-study aid,
  not a record. Station 4 shows both of its tables (Geräteversorgung, Fragen).
- Station 4 has flashcards for all 36 questions: tap to flip (CSS 3D), Vorherige/
  Nächste (wrapping), and Mischen / Originalreihenfolge. Questions 32 and 35 only point
  to the station procedure in the Fragenkatalog, so their cards show those steps
  (Kurzprüfung 200 bar; Flaschenwechsel + Hochdruckdichtprüfung) inline.
