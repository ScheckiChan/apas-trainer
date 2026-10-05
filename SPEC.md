# APAS-Trainer — Build Spec v1

Standalone PWA to organize FF-übergreifendes (cross-fire-brigade) training for the
"APAS Bronze" exam (Ausbildungsprüfung Atemschutz, NÖ Landesfeuerwehrverband).

## Stack (mirror these exact patterns — do not introduce new tooling)

Monorepo like `apps/api` + `apps/web` + `packages/shared`, npm workspaces.

- **apps/web**: React 18 + Vite, PWA (manifest.webmanifest + service worker, installable,
  offline app-shell caching). Plain CSS per view (no CSS framework). TypeScript.
- **apps/api**: Express + TypeScript, `zod` for validation, `jsonwebtoken` for the
  Ausbildungsleiter's session, `bcryptjs` for the Ausbildungsleiter's password,
  `web-push` for push notifications, `cors`, `express-rate-limit`. File-based JSON storage
  under a `data/` directory (one JSON file per entity collection, simple read-modify-write
  with a mutex/queue to avoid write races) — no database server.
- **packages/shared**: TypeScript types shared between api/web (Gruppe, Teilnehmer,
  Rolle, Checkliste, Termin, Ressource, Buchung).

## Data model

- **Ausbildungsleiter**: id, email, password hash. The only password-based account. Can own
  multiple **Gruppen**.
- **Gruppe** (Übungsgruppe): id, name, prüfungstermin (date, optional), ownerId, inviteToken
  (random, used to build the join link `/join/:token`).
- **Teilnehmer**: id, gruppeId, name, ff (Feuerwehr-Name, free text), rolle (enum: GKDT, ATF_ATM1,
  ATM2, WASSERTRUPPFUEHRER), email, emailVerified (bool), joinedAt.
- **Checkliste** per Teilnehmer: { at: 'ok'|'offen', ats3: 'ok'|'offen', tauglichkeit: 'ok'|'offen' }
  (GKDT does not require tauglichkeit per the real rules — reflect that in the UI, e.g. grey out /
  N/A instead of a toggle).
- **Ressource**: id, gruppeId (or global, scoped per Gruppe for v1), name (e.g. "HLF Fels"),
  standort (free text).
- **Termin**: id, gruppeId, typ: 'fix' | 'individual', titel, start (datetime), ende (datetime),
  teilnehmerIds (array — for individual termine this can be any subset of the Gruppe, freely
  assigned by whoever creates it), ressourceId (optional), createdBy (teilnehmerId or
  'ausbildungsleiter').
- Booking rule: creating/editing a Termin with a Ressource checks for overlapping Termine on the
  same Ressource and shows a warning; it does NOT block creation (no approval step) — booking is
  valid immediately, conflicts are informational only.

## Auth model (IMPORTANT — do not build classic per-FF user accounts)

- **Ausbildungsleiter**: email + password login → JWT (httpOnly cookie or Authorization header,
  your call, keep it simple). Can create Gruppen, see an overview dashboard of all their Gruppen,
  generate/regenerate the invite link per Gruppe.
- **Teilnehmer**: NO password. They open the invite link `/join/:token`, fill in Name + FF + Rolle
  + email, submit → backend sends a magic link to that email (console.log the link for now, email
  sending can be a stub/TODO with a clearly marked `sendMagicLink()` function — do not wire a real
  SMTP provider, that is a follow-up with Daniel). Clicking the magic link verifies emailVerified
  and issues a JWT scoped to that Teilnehmer + Gruppe (no separate password ever). Re-entry later
  also goes through a fresh magic link to the same email.
- Keep the two token types (Ausbildungsleiter JWT vs Teilnehmer JWT) clearly separate in payload
  shape and middleware.

## Core views (apps/web/src/views)

1. `Login.tsx` — Ausbildungsleiter email+password login (+ a one-time seed/register flow is fine
   for v1, no public signup needed beyond a bootstrap script).
2. `GroupsDashboard.tsx` — list of the Ausbildungsleiter's Gruppen, create new Gruppe, see
   Prüfungstermin-Countdown per Gruppe, open a Gruppe.
3. `GroupDetail.tsx` — one Gruppe: Teilnehmerliste with Rolle + Ampel-Checkliste-Status per
   Teilnehmer, invite link + QR code (use the `qrcode` npm package, same as FWMS), Prüfungstermin
   editable, link to Calendar and Stations.
4. `Join.tsx` — public page at `/join/:token`: form (Name, FF, Rolle, Email) → submit → "check
   your email" message.
5. `MagicLinkVerify.tsx` — handles the magic-link callback URL, exchanges it for a Teilnehmer JWT.
6. `TeilnehmerView.tsx` — what a Teilnehmer sees after verifying: their own Checkliste (toggle
   ok/offen for their 3 items), the Gruppe's Stationskarten, the Calendar.
7. `Stations.tsx` — static content cards for the 4 APAS-Bronze-Stationen (Ausrüsten,
   Personensuche, Löschangriff über Hindernisstrecke, Geräteversorgung+Gerätekunde) with a short
   Ablauf-Beschreibung and the Fehlerpunkte-Grundregel (max 35 gesamt, Stationslimit beachten,
   Wiederholung erst nach 14 Tagen) — write real summarized content from the NÖ LFV Bestimmungen
   APAS 12/2015, cite the source at the bottom of the page as plain text.
8. `Calendar.tsx` — month view, shows Fixtermine and Individualübungen as entries (different
   color/style), "Neuer Fixtermin" (Ausbildungsleiter only) and "Neue Individualübung" (any
   Teilnehmer) buttons, a form to pick date/time, optional Ressource, and assign any subset of the
   Gruppe's Teilnehmer freely. Show a conflict banner inline when the chosen Ressource overlaps an
   existing Termin, but still allow saving.

## PWA requirements

- `manifest.webmanifest` with name "APAS-Trainer", theme matching a simple red/dark Feuerwehr
  palette, icons (generate simple placeholder PNG icons 192/512/maskable if no real asset — note
  in the README that real icons should replace them later).
- `sw.js` service worker: cache the app shell, versioned `CACHE` string, update-on-reload.
- Push notifications: integrate `web-push` on the backend (VAPID keys generated at setup, stored
  in `.env`, documented in README how to generate), a `push.ts` module mirroring FWMS's — send a
  reminder N hours before each Termin to its assigned Teilnehmer + the Ausbildungsleiter. A cron
  tick (simple `setInterval` in the API process is fine for v1, no external scheduler) checks
  upcoming Termine every few minutes and fires reminders once per Termin.

## Deployment artifacts (write these, I will run the deploy separately)

- `Dockerfile` for each of apps/api and apps/web (web built as static files served by a tiny
  Express/static server or nginx — keep consistent with whatever FWMS's own Dockerfile pattern
  looks like structurally, simple multi-stage build).
- `docker-compose.yml` at repo root exposing api on one port and web on another (or a single
  combined container serving both — your call, document the choice in README).
- `.env.example` listing every required env var (JWT secret, VAPID keys, PORT, DATA_DIR, etc.)
- `README.md`: what this app is, how to run locally (`npm install && npm run dev`), how to build
  for production, how env vars work, and a short "first run" note (how to create the first
  Ausbildungsleiter account — a `npm run seed-admin` script that prompts for email+password is
  fine).

## Explicit non-goals for v1 (do not build these)

- No quiz/flashcard mode for the Gerätekunde-Fragenkatalog (static station content is enough).
- No PDF autofill of the official Anmeldeliste.
- No Silber/Gold support (Bronze only, but keep the data model from being absurdly hardcoded if
  it's cheap not to — don't over-engineer for it either).
- No real SMTP integration — magic link email sending is a stubbed/logged function.
- No admin backoffice beyond the Groups dashboard.

## Quality bar

- `npm run typecheck` and `npm run build` must both succeed cleanly in apps/web, apps/api, and
  packages/shared before you consider this done.
- Commit the work with clear commit messages. Push to `origin main` when finished.
- Do not invent fake APAS procedural details beyond what's summarized above — keep Stations.tsx
  content factual and conservative, it's okay to be brief.
