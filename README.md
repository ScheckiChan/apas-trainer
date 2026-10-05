# APAS-Trainer

Standalone Progressive Web App for organising **cross-fire-brigade APAS Bronze training**
(Ausbildungsprüfung Atemschutz, NÖ Landesfeuerwehrverband) — one exam date, several
4-person **Trupps**, shared calendar and resources, live station timers and leaderboards.

Built for one real exam cycle at a time: an Ausbilder sets it up, people self-register with
an instance-wide invite link, pick or get assigned to a Trupp, and the whole crew trains
towards the same Prüfungstermin with live feedback.

## Features

- **Self-service onboarding** — one shareable invite link (+ QR code) per exam instance;
  people register with e-mail, password, name and Feuerwehr, then pick their own Trupp and
  APAS-Rolle (GKDT, ATF/ATM1, ATM2, Wassertruppführer).
- **Role-based access** — Ausbilder (full control), Prüfer (score any Trupp live), Teilnehmer
  (their own Trupp, checklist and results).
- **Station training** — step-by-step walkthroughs, a live stopwatch per station with
  automatic Fehlerpunkte scoring, flashcards for the Gerätekunde question bank, and a
  per-station leaderboard so Trupps can compare times during live training.
- **Shared calendar & resource booking** — one calendar for the whole exam cohort, fixed
  training dates and individual practice sessions, shared equipment/vehicle booking with
  conflict warnings, RSVP ("Ich bin dabei") on fixed dates.
- **Push notifications** — reminders before a training date, and an immediate push when a
  new one is scheduled.
- **Installable PWA** — works offline for the station content, installable on any phone,
  no app store.
- **Instance branding** — set the leading Feuerwehr's name and crest (Wappen), shown on the
  login/landing screen.

## Tech stack

- **API** — Node.js, Express 5, TypeScript, file-based JSON storage (no database server)
- **Web** — React 18, Vite, plain CSS with a small design-token system
- **Shared** — a small `packages/shared` workspace with types and pure logic used by both
- **Push** — Web Push / VAPID
- **Deployment** — two Docker containers (API + nginx serving the PWA), no external services
  required

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full technical reference: API
surface, data model, auth model, and the reasoning behind every non-obvious decision.

## Quick start

Requirements: Node.js ≥ 22.12, npm ≥ 10.

```bash
npm install
cp .env.example .env
npm run seed-admin   # create the first Ausbilder account
npm run dev          # API on :3001, web on http://localhost:5173
```

Open `http://localhost:5173`, sign in with the account you just seeded. To try the
Teilnehmer side, register at `/registrieren` in a private window and pick a Trupp.

### Docker

```bash
cp .env.example .env    # set JWT_SECRET, VAPID_*
docker compose up -d --build
docker compose exec api node dist/scripts/seedAdmin.js
```

Put a TLS-terminating reverse proxy in front of the `web` container; it already proxies
`/api` to the `api` container, so the browser only ever talks to one origin.

## Repository layout

```
apps/
  api/            Express + TypeScript API, file-based JSON storage
  web/            React + Vite PWA
packages/
  shared/         Types and pure logic shared by api and web
scripts/          Dev tooling (runs api + web together, icon generation)
docs/
  ARCHITECTURE.md Full technical reference and design decisions
docker-compose.yml
.env.example
```

## Scripts

| Script                   | What it does                                              |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev`             | runs the API and the web dev server together                |
| `npm run typecheck`      | type-checks every workspace                                 |
| `npm run build`          | production build of every workspace                         |
| `npm start`              | runs the built API                                           |
| `npm run seed-admin`     | create an Ausbilder account / reset a password               |
| `npm run generate-vapid` | print a fresh VAPID key pair for push notifications          |
| `npm run generate-icons` | regenerate the PWA icon set                                  |

## Content source

The station content (procedures, time limits, scoring, question bank) is transcribed from
the NÖ Landesfeuerwehrverband's official APAS Bestimmungen — this app doesn't define the
exam rules, it only helps a crew train and organise around them.

## License

[MIT](./LICENSE)
