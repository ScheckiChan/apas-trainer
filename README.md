# APAS-Trainer

Standalone PWA for organising one cross-fire-brigade (FF-übergreifend) training for the
**APAS Bronze** exam (Ausbildungsprüfung Atemschutz, NÖ Landesfeuerwehrverband). It is
deployed once per Ausbildung; the training consists of one or more **Trupps** (4-person
Atemschutztrupps with the roles GKDT, ATF/ATM1, ATM2 and Wassertruppführer).

- Everyone has **one account** (Name + Passwort, no e-mail) and signs in on the same
  login. Accounts come from self-registration (`/registrieren`), a Trupp's invite link, or
  an Ausbilder's "Person hinzufügen". Each account has a **systemRolle**:
  - **Ausbilder** create the Trupps, add people (new or already registered) or share a
    Trupp's invite link / QR code, assign the APAS-Rollen, track every checklist (Ampel),
    set the Prüfungstermin, manage the shared Ressourcen and Fixtermine, and use the
    **Benutzerverwaltung** (change anyone's systemRolle, instance branding).
  - **Prüfer** run and score stations live: Stoppuhr and "Ergebnis speichern" for any Trupp.
  - **Teilnehmer** (default for every new account) see and toggle their own checklist, see
    their Trupp and its role coverage, browse the Stationskarten, save station results for
    their own Trupp, and use the shared calendar (incl. creating Individualübungen with
    people from any Trupp and booking Ressourcen).
- The **APAS-Rolle** (GKDT, ATF/ATM1, ATM2, Wassertruppführer) is a separate thing: the
  position a person holds inside their Trupp, assigned there by any Ausbilder or anyone in
  the Trupp.
- Push reminders go out N hours before each Termin to its assigned people, everyone who
  confirmed attendance, and every Ausbilder. A new Fixtermin is also pushed right away.
- On a Fixtermin anyone can mark themselves "anwesend" ("Ich bin dabei"); Ausbilder see
  the list and may add or remove anyone.

## Repository layout

```
apps/
  api/            Express 5 + TypeScript API, file-based JSON storage
    src/
      routes/     auth (login, registrieren, me), join (invite link), trupps (+Mitglieder),
                  teilnehmer (APAS-Rolle), benutzer (Benutzerverwaltung),
                  einstellungen (Branding + Wappen), termine, ressourcen, ergebnisse, push
      lib/        store (JSON collections + mutex), auth (JWT + systemRolle middleware),
                  benutzer (name rules, account factory), password (bcrypt)
      migrate.ts  idempotent startup migrations
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
npm run seed-admin   # create the first Ausbilder (see "First run")
npm run dev          # API on :3001, web on http://localhost:5173 (proxies /api)
```

- To try the Teilnehmer side, register at `/registrieren` in a private window (or open a
  Trupp's invite link from TruppDetail and use "Neu beitreten"). Coming back later is the
  normal login with name + password.
- The service worker is only registered in production builds, so it never
  interferes with Vite's dev server. Use `npm run build && npm run preview -w @apas/web`
  (with the API running) to test the installable PWA locally.

Other root scripts:

| Script                   | What it does                                               |
| ------------------------ | ---------------------------------------------------------- |
| `npm run typecheck`      | `tsc --noEmit` in shared, api and web                      |
| `npm run build`          | builds shared → api (`dist/`) → web (`dist/`)              |
| `npm start`              | runs the built API (`apps/api/dist/index.js`)              |
| `npm run seed-admin`     | create an Ausbilder / reset a password (+ make Ausbilder)  |
| `npm run generate-vapid` | print a fresh VAPID key pair for `.env`                    |
| `npm run generate-icons` | regenerate the placeholder PWA icons                       |

## First run — creating the first Ausbilder account

Anyone can self-register, but only as Teilnehmer. The first Ausbilder is created with:

```bash
npm run seed-admin
# Anmeldename des Ausbilders: Max Muster
# Passwort (min. 10 Zeichen): ********
```

Further Ausbilder are best promoted in the Benutzerverwaltung. Running the script again
with an existing name (case-insensitive) resets that account's password **and makes it
Ausbilder**, which is also the way back in if every Ausbilder password is lost.
Non-interactive: `ADMIN_NAME=… ADMIN_PASSWORD=… npm run seed-admin` (`ADMIN_EMAIL` is
still accepted as an alias, since migrated Ausbildungsleiter accounts log in with their
former e-mail address as name). The script runs the data migrations first, so it is safe
on an old data directory.

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
| `LEITER_TOKEN_TTL`          | `7d`                         | Session length of accounts that are Ausbilder at login             |
| `TEILNEHMER_TOKEN_TTL`      | `90d`                        | Session length of Prüfer and Teilnehmer accounts                   |
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

**Backups:** everything lives in `DATA_DIR`: the JSON files (`benutzer.json`,
`trupps.json`, `ressourcen.json`, `termine.json`, `ergebnisse.json`,
`einstellungen.json`, `pushsubscriptions.json`, `reminders.json`) plus the uploaded
Wappen (`wappen-<timestamp>.<ext>`, at most one). Copying the volume is a complete backup.
`ausbildungsleiter.json.migriert` / `teilnehmer.json.migriert` are the pre-migration
originals (see **Migration to unified accounts**), and a leftover `magiclinks.json` from
before the password switch is not read either; all of them can be deleted once you're
happy with the migration.

## API overview

All endpoints are under `/api`. Auth is `Authorization: Bearer <jwt>` (one token kind for
every account). "signed in" = any account; roles are the account's **current**
systemRolle, read from storage on every request. Types are in `packages/shared`.

| Method & path                                                    | Auth                                   |
| ---------------------------------------------------------------- | -------------------------------------- |
| `POST /auth/login` {name, password} → `AuthSession`              | public (rate-limited)                  |
| `POST /auth/registrieren` {name, password, ff?} → `AuthSession`  | public (rate-limited); new Teilnehmer without Trupp |
| `GET  /auth/me` → `MeResponse`                                   | signed in                              |
| `GET /trupps/:inviteToken/join` (Trupp name + date)              | public                                 |
| `POST /trupps/:inviteToken/join` {name, ff, password} → `AuthSession` | public (rate-limited); new account in that Trupp |
| `POST /trupps/:inviteToken/beitreten` → `MeResponse`             | signed in, account without Trupp (rate-limited) |
| `GET /trupps` → `TruppSummary[]`                                 | Ausbilder (with invite) · Prüfer (without) |
| `POST /trupps` · `PATCH /trupps/:id` · `POST /trupps/:id/invite/regenerate` | Ausbilder                   |
| `DELETE /trupps/:id` (members kept, detached to "Ohne Trupp"; its Ergebnisse removed) | Ausbilder     |
| `PATCH /trupps/:id/identitaet` {name?, icon?} → `Trupp`          | Ausbilder · Teilnehmer of that Trupp (else 403) |
| `GET /trupps/:id`                                                | Ausbilder · Prüfer · member            |
| `GET /trupps/:id/teilnehmer` → `Teilnehmer[]`                    | Ausbilder · member                     |
| `POST /trupps/:id/teilnehmer` {name, ff?} → {teilnehmer, tempPassword} | Ausbilder                        |
| `POST /trupps/:id/teilnehmer/zuordnen` {benutzerId} → `Teilnehmer` | Ausbilder                            |
| `PATCH /trupps/:id/teilnehmer/:tid/checkliste`                   | Ausbilder or that person               |
| `DELETE /trupps/:id/teilnehmer/:tid` (removes from Trupp, keeps account) | Ausbilder                      |
| `PATCH /teilnehmer/:tid/rolle` {rolle \| null} (APAS-Rolle)     | Ausbilder or any member of that Trupp  |
| `GET /benutzer` · `GET /benutzer/ohne-trupp` → `BenutzerUebersicht[]` | Ausbilder                         |
| `PATCH /benutzer/:id/systemrolle` {systemRolle}                  | Ausbilder (409 for the last Ausbilder) |
| `POST /benutzer/:id/passwort-zuruecksetzen` → {tempPassword}     | Ausbilder                              |
| `DELETE /benutzer/:id`                                           | Ausbilder (not self, not the last Ausbilder) |
| `GET /einstellungen` → `Einstellungen`                           | public                                 |
| `PUT /einstellungen` {fuehrendeFeuerwehr}                        | Ausbilder                              |
| `PUT /einstellungen/wappen` (raw image body, ≤ 2 MB) · `DELETE /einstellungen/wappen` | Ausbilder         |
| `GET /einstellungen/wappen?v=…` (the image)                      | public                                 |
| `GET /ressourcen` · `POST` · `DELETE /:rid`                      | signed in (read) / Ausbilder (write)   |
| `GET /termine?from&to` · `POST`                                  | signed in (Fixtermin: Ausbilder)       |
| `PUT/DELETE /termine/:terminId`                                  | Ausbilder, or creator of an Individualübung |
| `POST /termine/konflikte` {ressourceId, start, ende, excludeTerminId?} | signed in                        |
| `GET /termine/personen` (every account + Trupp name)             | signed in                              |
| `PUT/DELETE /termine/:terminId/anwesend/:benutzerId` (Fixtermin only, returns the Termin) | self; Ausbilder: anyone |
| `GET /trupps/:id/ergebnisse`                                     | Ausbilder · Prüfer · member            |
| `PUT /trupps/:id/ergebnisse/:stationId` {zeitSekunden, fehlerpunkte, teile?} | Ausbilder · Prüfer: any Trupp; Teilnehmer: own Trupp (else 403) |
| `GET /rangliste` (one leaderboard per station)                   | signed in                              |
| `GET /push/vapid-public-key` · `POST /push/subscribe` · `POST /push/unsubscribe` | public / signed in     |
| `GET /health`                                                    | public                                 |

Errors are `{ error, details? }` with a German message: `401` = not signed in / session
invalid (sign in again), `403` = signed in but the systemRolle doesn't allow it, `404`
also for Trupps the caller may not see, `409` = name taken / last Ausbilder / already in
another Trupp, `413`/`415` = Wappen too large / not an allowed image.

## PWA notes

- `apps/web/public/manifest.webmanifest` — name "APAS-Trainer", Feuerwehr-Rot theme colour.
- `apps/web/public/sw.js` — precaches the app shell under a versioned `CACHE` string;
  navigations are network-first (offline → cached shell), hashed assets cache-first,
  `/api` never cached. The worker calls `skipWaiting()`/`clients.claim()` and deletes
  old caches, so a new version is active on the next reload. **Bump `CACHE`** whenever
  you change the shell list or `sw.js` itself. The self-hosted fonts in
  `apps/web/public/fonts/` are part of the precached shell, so type works offline.
- **Icons are placeholders** (a white "A" on the `--accent-fill` red) generated by
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
  "Neuen Trupp erstellen" stay. Each Trupp keeps its own invite link, Prüfungstermin
  and Stationsergebnisse. The **calendar and the Ressourcen belong to the instance**,
  not to a Trupp (1 instance : N Trupps) — see **Termine & calendar**.
- After login an Ausbilder lands on `/trupps`, a plain list of the Trupps
  (sorted by Prüfungstermin). Each row shows the name, "x/4 Rollen besetzt" (red while
  incomplete), the Teilnehmer and "bereit" counts and the Prüfungstermin countdown, and
  opens the Trupp-Details. "+ Neuen Trupp erstellen" is a small secondary button below
  the list. Only when no Trupp exists yet is the create form shown directly.
- Ausbilder create the Trupps and do the Rollen-Zuweisung (Trupp-Details:
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

**Visual design (tokens, colour, type, icons)**
- All raw values live once in `apps/web/src/tokens.css` (colour, type scale, spacing,
  radii, motion). The per-view CSS uses only these custom properties. The two
  remaining literal colours are `theme-color` in `index.html` and the QR raster colours.
- **Light-first, dark follows the OS.** The app is mostly used in daylight, outdoors or
  under the Feuerwehrhaus strip lights, where dark text on a light ground holds up
  against glare. Phones switch to dark at night by themselves, which covers night
  training. A full dark scheme ships via `prefers-color-scheme`.
- **One accent: Feuerwehr-Rot `#fe1e34`**, the brand reference. It is used for marks only
  (today, progress segments, active tab, Ampel "rot"), because it reaches just 3.8:1 as
  text or under white text. Buttons and red text use the deeper
  `oklch(0.54 0.215 25)` (`#ce0b23`, 5.7:1 under white). Dark mode uses
  `oklch(0.72 0.17 22)` for red text (6.6:1). Greys are tinted towards the accent hue
  (H 25), never neutral. `--danger` is a burnt orange (`oklch(0.5 0.16 45)`) so an
  error never reads as "brand", and `--success` is a real green. Contrast values for
  each pairing are noted next to the tokens. Body and muted text are ≥ 4.5:1 in both
  schemes, including on the tinted badge and alert grounds.
- **Type: Switzer** (Fontshare, weights 400/500/600/700), self-hosted woff2 with
  `font-display: swap`, preloaded, no CDN at runtime. General Sans was the other
  candidate. It was rejected because its figures are proportional and it has no `tnum`
  feature. Switzer's figures are tabular by default, so countdowns, Soll-Zeiten,
  Fehlerpunkte and "Schritt 3 von 10" line up (`.num` / `font-variant-numeric:
  tabular-nums` is still set explicitly). There is no mono family; the one-time
  passwords come from an alphabet without ambiguous characters, so Switzer with wide
  tracking reads fine.
- **Icons:** Lucide (via Iconify), inlined in `components/Icon.tsx`, all 24×24 outlines
  at stroke 2 drawn in `currentColor`. They replace every emoji/Unicode glyph that was
  used as an icon. Status never relies on colour alone: the Ampel is check / dashed /
  empty circle, a Rolle is besetzt (solid + check) or unbesetzt (dashed), and a
  checklist item is ok (check, green ground) or offen (empty circle, neutral).
- **Surfaces:** the Trupp list and Trupp detail are "operate" screens: dense
  table/rows, no hero, no stat tiles. Login/Join are a plain narrow "configure" column
  with inline validation (`:user-invalid`, live password-mismatch hint, `aria-busy` on
  submit). The Stationen pages get a little more typographic weight (large station
  numbers, large active step).
- **Touch & motion:** controls are 44 px high (dense 36 px variants grow to 44 px on
  `pointer: coarse`). Motion is the existing step slide and card flip, shortened to
  exponential ease-out tokens. `prefers-reduced-motion` turns them off, plus a global
  transition clamp.

**Stoppuhr, Ergebnisse & Rangliste**
- The station page is built to be operated live, one-handed, while a Trupp runs the
  station. Order: Soll-Zeit, Stoppuhr, Fehlerpunkte of this run, then Ablauf and
  Lernkarten. Once anything is on the clock or ticked, a bar pinned to the bottom keeps
  the clock (with Start/Pause), the running total and pass/fail in view. While a clock
  runs the page holds a screen wake lock. Time is always derived from `Date.now()`, so a
  locked phone or background tab never loses seconds.
- **Stoppuhr per Teil.** Most stations have one; Station 4 has two (Geräteversorgung
  500 Sek., Fragen 300 Sek.), because the Bestimmungen time and score them separately.
  Where a station has variants (Ausrüsten: im Fahrzeug / außerhalb × 200 / 300 bar), a
  selector picks the Soll-Zeit before starting (locked while running). The
  "Elektronisches Manometer" variant has no fixed time, so it takes a Soll-Zeit typed in
  by hand.
- **Zeitüberschreitung** follows the content rule "2 Punkte je 10 Sek." with every
  *started* 10-second block counting: 1–10 s over → +2, 11–20 s → +4, 23 s → +6. The
  spec's example ("23 Sek → +4") contradicts its own "round up" rule; the rule won.
  Whole seconds are compared, so exactly on the Soll-Zeit is no overrun. Past the
  Soll-Zeit the clock turns amber (informational, no flashing, no red).
- **The Fehlerpunkte checklist now records what happened** instead of the earlier
  "vermieden" self-study ticks: one-off rows are checkboxes, "je Mitglied" / "je Fall"
  rows are counters (0–9, points × count), and the Zeitüberschreitung row is filled in
  by the Stoppuhr and can't be ticked by hand. The Gesamt-Fehlerpunkte (checklist +
  time) are shown against the station's own limit as "bestanden / nicht bestanden" for
  this station in isolation; Station 4 passes only if both Teile are within 5 and 6.
- Practising needs no account action: anyone (any account, or the public `/stationen`
  pages) can use the clock and checklist locally; nothing is stored.
  **"Ergebnis speichern"** is deliberately permissive, for live-training gamification:
  every signed-in account may save, **Ausbilder and Prüfer for any Trupp, a Teilnehmer
  only for their own Trupp** (`403` otherwise). The rule is `kannErgebnisSpeichern()` in
  `packages/shared`, used by the API and the web app alike. It is only offered on a
  Trupp-scoped station page, i.e. when it's clear which Trupp ran. Saving stops the clocks
  so the stored time is what is on screen, and the confirmation links to the Rangliste.
  The record keeps who saved it (`aufgenommenVon`, server-side only).
- **Storage: latest result only.** `ergebnisse.json` holds at most one record per
  (Trupp, Station), id `truppId:stationId`; saving again overwrites it. It's a live
  tool, not an archive. The record has `zeitSekunden`, `fehlerpunkte`, `teile` (per-Teil
  time and points, required in the request for Station 4 and checked to add up),
  `bestanden` and `aufgenommenAm`. The server computes `bestanden` from the limits in
  `STATION_WERTUNG` (`packages/shared`), which the web content tables also read, so
  the limits live in one place. The server trusts the submitted points; it can't know
  which errors were observed.
- **Rangliste = per-station leaderboards** (`/rangliste`, header trophy icon for both
  roles, plus a button in Trupp-Details). It is light gamification during live
  training: Trupps compare their times **per station** ("wer war beim Ausrüsten am
  schnellsten?"), not one combined ranking. It covers **every Trupp of the deployment**
  (one Ausbildung per deployment) and is visible to any signed-in account. `GET /api/rangliste` returns one list per station in station order
  (`stationsRanglisten()` in shared):
  - A station's list holds only the Trupps with a recorded result for it. There is no
    "offen" placeholder.
  - **Sorted by Zeit, fastest first.** Equal times share a rank (1, 1, 3). Fehlerpunkte
    only order rows within an equal time. They never move a Trupp past a faster one.
  - Every row shows the Fehlerpunkte against that station's own limit and a
    bestanden / nicht bestanden badge. A fast run that would fail keeps its rank, but its
    rank and time are muted, so it doesn't read as a clean win.
  - **Station 4 is one leaderboard**, ranked on the summed time of both Teile
    (Geräteversorgung + Fragen), because a Trupp runs them back to back and the result is
    stored as one record. Each row also lists the time and points per Teil. "bestanden"
    requires both Teile to be within 5 and 6.
  - The earlier combined ranking (total Fehlerpunkte over all stations against the
    overall 35-point Bestehensregel, "x/4 Stationen absolviert") was removed, not hidden.
  On screen, a segmented control picks the station: 4 across on wide screens, 2 × 2 below
  720 px, so nothing scrolls sideways on a phone. Each segment shows how many Trupps have
  a result. The choice is kept in `?station=`, and "Zur Rangliste" after saving a result
  opens the station just run. The page refreshes itself every 30 s while visible. A
  account's own Trupp is marked "euer Trupp" (`eigen`); accounts without a Trupp see no
  marker.
- There is no delete for a result (re-saving replaces it) and no history. Removing a
  Trupp isn't supported anywhere yet, so orphaned results can't occur.

**Reference project**
- The FWMS repository the spec refers to (Dockerfile structure, `push.ts`) was not
  available on the build machine, so those parts follow a conventional
  multi-stage / web-push layout. Align them with FWMS later if they differ.

**Benutzer & Rollen (systemRolle vs. APAS-Rolle)**
- **One account type** (`benutzer.json`): a global identity (name, bcrypt hash, optional
  FF) with a **systemRolle**, plus an optional Trupp membership (`truppId`) and, inside
  that Trupp, an optional **APAS-Rolle** (`rolle`). The former Ausbildungsleiter and
  per-Trupp Teilnehmer records are gone; every path that creates people creates this one
  type.
- **systemRolle** (`ausbilder` / `pruefer` / `teilnehmer`, `SYSTEM_ROLLEN` in shared) says
  what an account may do in the app. **APAS-Rolle** (`GKDT` / `ATF_ATM1` / `ATM2` /
  `WASSERTRUPPFUEHRER`, `ROLLEN`) is the exam position inside a Trupp. They are
  independent fields with independent endpoints (`PATCH /benutzer/:id/systemrolle` vs.
  `PATCH /teilnehmer/:id/rolle`) and are never derived from each other. A Teilnehmer
  account can hold any APAS-Rolle; an Ausbilder or Prüfer keeps a Trupp membership and
  APAS-Rolle if they had one before being promoted.
- What each systemRolle may do:
  - **Ausbilder**: everything the old single Ausbildungsleiter could, for **all** Trupps
    (there is no per-Trupp ownership any more; `Trupp.ownerId` only records who created
    it): Trupps, invite links, Person hinzufügen, APAS-Rollen, every Checkliste, Kalender
    (Fixtermine, all Termine), Ressourcen, Benutzerverwaltung, Branding.
  - **Prüfer**: Stoppuhr + "Ergebnis speichern" for any Trupp. For that they can read the
    Trupp list (`GET /trupps`, without invite tokens), any Trupp record and its
    Ergebnisse. They **cannot** read other Trupps' member lists: those carry the
    Checklisten (Tauglichkeit is health data) and aren't needed to score a station. No
    Trupp, Kalender or Ressourcen management, no Benutzerverwaltung.
  - **Teilnehmer**: their own Trupp (record, members, Ergebnisse), their own Checkliste,
    APAS-Rollen in their Trupp, Ergebnis speichern for their own Trupp,
    Individualübungen. Other Trupps answer `404`, as before.
  - Everyone signed in: Kalender (read, Individualübungen), Ressourcen (read), Rangliste,
    Stationen.
- **Registration**: `/registrieren` (`POST /auth/registrieren`, name + password, FF
  optional) creates a `teilnehmer` without a Trupp and signs in right away. Every new
  account starts as `teilnehmer`, also via invite link or Person hinzufügen; only
  `seed-admin` and the Benutzerverwaltung make Ausbilder or Prüfer.
- **Invite link and registration are unified**: both create the same account type. The
  invite link (`POST /trupps/:token/join`, name + FF + password) additionally sets the
  Trupp membership. An already registered account without a Trupp can join via the link
  while signed in (`POST /trupps/:token/beitreten`); an account already in another Trupp
  gets a `409` and has to be moved by an Ausbilder (remove + attach).
- **Person hinzufügen** (Ausbilder, TruppDetail) has two modes: create a new account with
  a generated one-time password (as before: 11 characters from an alphabet without
  look-alikes, about 64 bit, returned once, never stored or logged), or attach an existing
  account without Trupp, picked from `GET /benutzer/ohne-trupp` (every account without a
  Trupp, any systemRolle, labelled with it).
- **Removing someone from a Trupp keeps the account** (and its Checkliste, Termine and
  push subscriptions); only membership and APAS-Rolle are cleared, so they can be attached
  elsewhere. Deleting an account is a separate Benutzerverwaltung action
  (`DELETE /benutzer/:id`) that also removes it from every Termin and drops its push
  subscriptions. Saved Ergebnisse belong to the Trupp and stay.
- **Benutzerverwaltung** (`/benutzer`, Ausbilder only): every account with name, FF,
  systemRolle and Trupp; the systemRolle can be changed per row. **Guardrail:** demoting
  (or deleting) the **last** Ausbilder is refused with `409` ("Es muss mindestens ein
  Ausbilder bestehen bleiben …"), whether it's yourself or someone else. The check runs
  inside the collection's write lock, so two concurrent demotions can't both pass. With a
  second Ausbilder it is allowed, including demoting yourself. Nobody can delete their
  own account. "Passwort zurücksetzen" (new one-time password) replaces the old "remove
  and re-add" workaround, now that removing keeps the account. If every Ausbilder
  password is lost, `npm run seed-admin` with an existing name resets it and makes that
  account Ausbilder.

**Auth & sessions**
- **One login for every role**: `POST /auth/login` with name + password, at `/login`.
  Two entry points would have been barely simpler to build and would have kept the
  identity split this change removes. The invite token is no longer part of logging in;
  regenerating an invite link only affects joining.
- **Login identifier = the name, unique instance-wide**, compared trimmed,
  whitespace-collapsed and case-insensitive ("max  muster" = "Max Muster"). Before, names
  were only unique per Trupp. A taken name gets a `409` that suggests signing in or adding
  an initial. Wrong name and wrong password give the same `401`. Unknown names still run a
  bcrypt compare, so timing doesn't reveal which names exist.
- **Token**: a JWT (audience `apas:benutzer`) with the claims
  `{ kind: 'benutzer', sub: <Benutzer id>, systemRolle, iat, exp, aud }`. Only `sub` is
  trusted: every request loads the account from `benutzer.json` and uses its current
  systemRolle and Trupp, so role changes, Trupp moves and deletions take effect on the
  next request without re-login (a deleted account gets `401`). The `systemRolle` claim
  only records the role at login. Clients read role and Trupp from `GET /auth/me`
  (`MeResponse`), not from the token.
- Tokens are sent as `Authorization: Bearer` headers and stored in `localStorage` (no
  cookies → no CSRF handling needed). One token per device.
- Session length is chosen at login: accounts that are Ausbilder at that moment get
  `LEITER_TOKEN_TTL` (7 days), Prüfer and Teilnehmer `TEILNEHMER_TOKEN_TTL` (90 days —
  logging in again on a phone at the Übung should be rare).
- **Old tokens keep working**: tokens issued before the change (audiences `apas:leiter`
  / `apas:teilnehmer`) are accepted until they expire, because the migration kept every
  id, so their `sub` resolves to the same account (with its current role). Anything that
  doesn't resolve gets a clean `401` and the client signs in again.
- Passwords: at least 8 characters (10 for Ausbilder created via the seed script), at
  most 72 (bcrypt's input limit, so input is rejected rather than silently truncated).
  Same bcrypt cost, 12, everywhere (`lib/password.ts`). There is no self-service
  password change or reset (no e-mail); an Ausbilder resets it in the
  Benutzerverwaltung.
- Legacy records from the magic-link era have no password. Login tells them to use "Neu
  beitreten" once on their Trupp's invite link with exactly the same name. That
  **claims** the existing record (sets the password, keeps id, Rolle, checklist and
  Termine).
- Rate limits: 300 req/min per IP on the whole API. Login allows 20 **failed** attempts
  per 15 min per IP (successful logins don't count, so a whole Trupp behind one NAT can
  still sign in). Registration, invite-link join and "beitreten" share a budget of 30
  attempts per 15 min per IP, and every attempt counts because they create or change
  accounts.

**Migration to unified accounts** (`migrateBenutzer` in `src/migrate.ts`)
- Runs at API start (after the Gruppe→Trupp and shared-calendar steps) and at the start
  of `npm run seed-admin`. Idempotent: records already in `benutzer.json` (by id) are
  skipped, and afterwards `ausbildungsleiter.json` / `teilnehmer.json` are renamed to
  `*.migriert` (kept as a backup, never read again, so a deleted account is never
  re-imported).
- **Ids are kept**, so Termin assignments, Ergebnisse (`aufgenommenVon`), push
  subscriptions and issued tokens keep pointing at the same person. Push subscription
  owners are rewritten from `leiter`/`teilnehmer` to `benutzer`.
- Ausbildungsleiter → **Ausbilder**, password hash kept. Its login name is its **former
  e-mail address** (e.g. `kommandant@ff-beispiel.at`), so the person signs in with
  exactly what they typed before, just in the "Name" field.
- Teilnehmer → **teilnehmer** with Trupp membership, APAS-Rolle, Checkliste, FF and
  password hash unchanged (names get their whitespace collapsed).
- **Name collisions** (names were only unique per Trupp before) are resolved
  deterministically: Ausbildungsleiter first (by `createdAt`, then id), then Teilnehmer
  (by `joinedAt`, then id). The first keeps the name; a later one becomes
  "Name (Truppname)", and if that is taken too, "Name (Truppname) 2", "… 3". Every
  rename is logged (`[migrate] Anmeldename „…" doppelt → „…"`) and visible in the
  Benutzerverwaltung, so the Ausbilder can tell those people their new login name.
- Termine created by the old Leiter keep `createdBy: 'ausbildungsleiter'` (every
  Ausbilder may edit them anyway); new Termine store the creator's account id.

**Branding: führende Feuerwehr + Wappen**
- One instance-wide setting (`einstellungen.json`, single record): the name of the
  führende Feuerwehr and an optional Wappen. `GET /einstellungen` is **public**, because
  it is shown on the pre-login pages too; changing it is Ausbilder-only.
- Upload is `PUT /einstellungen/wappen` with the **raw image as the request body**
  (`express.raw`, limit 2 MB → `413`), so no multipart parser and no extra dependency.
  The type is decided by **sniffing the bytes**, never by the client's Content-Type:
  PNG / JPEG / WebP by magic bytes; SVG only if it is valid UTF-8 whose root element
  (after an optional XML declaration, comments and an SVG doctype) is `<svg …>` and that
  contains no `<!ENTITY` declarations. Anything else → `415` "Nur PNG-, JPG-, WebP- oder
  SVG-Bilder sind als Wappen erlaubt".
- Stored next to the JSON files as `DATA_DIR/wappen-<timestamp>.<ext>`: the new file is
  written atomically first, then the record points at it, then the old file is removed.
  `DELETE /einstellungen/wappen` removes both.
- Served by `GET /einstellungen/wappen` with the stored Content-Type and
  `X-Content-Type-Options: nosniff`. SVGs also get
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, so even
  opening an uploaded SVG directly can't run script or load anything (inside an `<img>`
  browsers never run SVG script anyway). SVGs are not sanitised; the CSP is the guard.
- Cache busting: `Einstellungen.wappen.pfad` is `/einstellungen/wappen?v=<upload time in
  ms>`. With the current `v` the image is cached for a year (`immutable`); without `v` or
  with a stale one, `no-cache`. A new upload changes `v`.
- The nginx in front of the API must accept 2 MB request bodies
  (`client_max_body_size`); nginx's default is 1 MB.

**Rollen**
- Rolle is **not** chosen at join. New Teilnehmer start with `rolle: null` ("keine
  Rolle"), and the Rolle is assigned later with `PATCH /teilnehmer/:id/rolle`.
- Anyone in the Trupp may change **anyone's** APAS-Rolle in it at any time: every
  Ausbilder (dropdown per row in TruppDetail) and every member of that Trupp, whatever
  their systemRolle (tab "Trupp" in the Teilnehmer view). Role shuffling before the exam
  is a joint decision. Checklists stay restricted (own checklist, or an Ausbilder).
- Duplicate roles are allowed (Ergänzungsteilnehmer in Trupps with more than 4
  people). Both views show the coverage as "x/4 Rollen besetzt" with one chip per
  Rolle (×n when held more than once), but nothing is blocked.

**Trupp-Identität: Name + Icon**
- For fun and team spirit during training, each Trupp can rename itself and pick a
  mascot icon. **Who may edit:** any Ausbilder, or any Teilnehmer who is a member of that
  Trupp (`PATCH /trupps/:id/identitaet`, rule `kannTruppIdentitaetBearbeiten()` in
  shared). Teilnehmer of another Trupp, accounts without a Trupp and Prüfer (even a Prüfer
  who is a member) get `403`.
  No approval step. Members edit it in their "Trupp" tab, Ausbilder in Trupp-Details.
  The Ausbilder-only `PATCH /trupps/:id` (Prüfungstermin etc.) is unchanged.
- **Name:** trimmed and whitespace-collapsed, 1–40 characters (`TRUPP_NAME_MAX`), content
  otherwise free ("Die Rauchfresser"). The same limit now applies to creating a Trupp and
  the Ausbilder edit (previously 2–100); existing longer names are left alone.
- **Icon set** (`TRUPP_ICONS`, 16 Lucide icons from the existing `Icon.tsx`): flame,
  fire-extinguisher, droplets, siren, axe, shield, zap, target, trophy, crown, rocket,
  mountain, anchor, star, bird, dog. Skulls and weapons were left out as unsuitable for
  Feuerwehr training. The server rejects anything outside the set (`400`), so a stored
  icon always renders. Only the icon id is stored (`Trupp.icon`, `null` = not chosen;
  existing Trupps are backfilled by an idempotent migration).
- **Default:** `users` (`DEFAULT_TRUPP_ICON`), deliberately not pickable and drawn muted,
  so "nothing chosen yet" never looks like a chosen mascot. Chosen icons use the accent.
- The icon sits next to the Trupp name everywhere a Trupp is listed (`TruppName`
  component): Trupp list, Trupp-Details and Teilnehmer header, Rangliste rows, Kalender
  Teilnehmer-Picker, invite page, Benutzerverwaltung, Konto menu.
- The picker is a native radio group (arrow keys work, German labels), 48 px tiles; the
  selected tile gets a thicker ring and a check badge, not just a colour change.

**Data model**
- The Checkliste is embedded in the account record (it describes the person, so it
  survives moving between Trupps). The person and any Ausbilder can toggle it. The Tauglichkeit exemption follows whoever
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
- Ressourcen are instance-wide (no `truppId`): the Trupps of one Ausbildung share the
  same vehicle, Übungsgelände etc. Only Ausbilder create or delete them
  (Ressourcen panel at the bottom of `/kalender`), and anyone signed in can book them
  on Termine. Deleting a Ressource keeps its Termine but removes the booking.
- Removing a person from a Trupp keeps the account and its Termine. Deleting an account
  (Benutzerverwaltung) removes it from all Termine (of any creator, since Termine span
  Trupps) and deletes its push subscriptions.
- `Buchung` is the shared type for "Ressource booked by a Termin for a time window";
  overlap results come back as `BuchungsKonflikt[]`.

**Termine & calendar**
- **One shared calendar per instance.** A deployment is one Ausbildung with one exam
  day, and all its Trupps train towards it with the same Ressourcen, so Termine have no
  `truppId`. The API lives at `/api/termine` (not under a Trupp) and the web app at
  `/kalender`, linked from the header next to the Rangliste for every account. Old entry points redirect there (`/trupps/:id/kalender`,
  `/teilnehmer?tab=kalender`); TruppDetail links to it instead of embedding it.
- Everyone signed in sees every Termin. Fixtermine: only Ausbilder create, edit or
  delete them. Individualübungen: any account can create them, and the creator or any
  Ausbilder can edit or delete them — regardless of which Trupps the creator and the
  assignees belong to. Others see a read-only detail view.
- Permissions check the systemRolle `ausbilder`, never Trupp ownership (there is none
  any more).
- Assignment is completely free (any subset of any Trupps, including none). The picker
  loads `GET /termine/personen` — only id, name, FF, systemRolle, APAS-Rolle and Trupp of
  every account, no Checkliste; accounts without a Trupp come last with `truppName: null` — groups it by Trupp with a "Ganzen Trupp" toggle per
  group, and labels every person as "Name (Trupp …)". Defaults: a new Fixtermin
  pre-selects everyone in every Trupp; a new Individualübung pre-selects the creator.
- Conflicts: the editor calls `POST /termine/konflikte` live (debounced) and shows a
  yellow inline banner. Overlaps are checked against **all** Termine on that Ressource,
  whichever Trupp booked them — two Trupps booking the one vehicle at the same time is
  exactly what this is for. Saving is never blocked. The save response also returns
  the conflicts, as informational data.
- Existing data is migrated on API start (`migrateSharedCalendar` in `src/migrate.ts`,
  idempotent, after the Gruppe→Trupp step): `truppId` is stripped from `termine.json`
  and `ressourcen.json`. Termine and Ressourcen of formerly separate Trupps simply end
  up in the one calendar.
- The calendar form edits single-day Termine (date + start/end time). The API
  accepts any start < end range. The month grid starts on Monday (AT convention)
  and shows Fixtermine as solid red chips and Individualübungen as dashed, hatched
  outline chips (a pattern difference, not just colour). Legend, agenda and editor
  repeat it with an icon (group vs. single person) and the type name. On phones the
  chips collapse to bars (solid vs. hatched) and a "Nächste Termine" list sits below
  the grid.
- Datetimes are stored as UTC ISO strings and shown in the browser's local time. The
  Prüfungstermin is a plain `YYYY-MM-DD` date with no timezone.

**Anwesenheit (RSVP) on Fixtermine**
- `anwesendIds` is separate from `teilnehmerIds`: the Ausbilder's assignment says who is
  invited, `anwesendIds` says who confirmed. Individualübungen don't have it (always
  `[]`; switching a Fixtermin to an Individualübung clears it).
- `PUT`/`DELETE /termine/:terminId/anwesend/:benutzerId`, idempotent, applied atomically
  inside `db.termine.patch`. Every account (Teilnehmer, Prüfer, Ausbilder) may toggle only
  itself; Ausbilder may also mark anyone present or remove them, for people without the
  app at hand. Anyone may confirm, not just the invited people — it's a shared calendar.
  No cut-off date: past Fixtermine can still be corrected.
- The calendar shows "N angemeldet" in "Nächste Termine" and in the month grid's tooltip
  (the chips are too small to print it); the Termin pop-up has the "Ich bin dabei" /
  "Absagen" toggle and the full name list. Deleting an account removes it from
  `anwesendIds`. Existing `termine.json` records get `anwesendIds: []` on API start
  (`migrateAnwesend`, idempotent).

**Push reminders**
- Reminders go to the Termin's assigned accounts (any Trupp), the accounts that
  confirmed attendance, and every Ausbilder, and link to `/kalender`. Push subscriptions
  belong to the account (`owner: { kind: 'benutzer', id }`).
- **New Fixtermin:** right after an Ausbilder creates one, a push "Neuer Übungstermin:
  {Titel}" with date/time goes out (linking to `/kalender`) — same targeting as the
  reminders (assigned accounts + every Ausbilder), minus the creator. Not on edits, never
  for Individualübungen (that would be noise for everyone). It is sent after the response,
  so a push failure never affects saving.
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
- Detail page: the Soll-Zeiten at the top as large tabular numbers ("170 Sek." +
  "max. 2:50 min"), then the Ablauf as a guided step-through. One active step slides in
  with a short CSS keyframe (exponential ease-out, starts partly visible), Weiter/Zurück
  or swipe moves between steps, a segmented bar (one segment per step) shows
  "Schritt x von y",
  and the full numbered list below lets you jump. This is the "animation". No
  libraries, and `prefers-reduced-motion` is honoured.
- Where the Bestimmungen list alternatives (Kurzprüfung 200 vs. 300 bar, Flaschenwechsel
  200 vs. 300 bar), both are separate steps in the walk-through, with a note that only
  the one for your device applies. Gold-only parts and the "außerhalb des Fahrzeuges"
  variant are shown as info cards below the walk-through, not as steps, since v1 is
  Bronze.
- Fehlerpunkte: every table row is scored for the current run (see **Stoppuhr,
  Ergebnisse & Rangliste**). Rows worth 10+ points are highlighted. Station 4 shows
  both of its tables (Geräteversorgung, Fragen).
- Station 4 has flashcards for all 36 questions: tap to flip (CSS 3D), Vorherige/
  Nächste (wrapping), and Mischen / Originalreihenfolge. Questions 32 and 35 only point
  to the station procedure in the Fragenkatalog, so their cards show those steps
  (Kurzprüfung 200 bar; Flaschenwechsel + Hochdruckdichtprüfung) inline.
