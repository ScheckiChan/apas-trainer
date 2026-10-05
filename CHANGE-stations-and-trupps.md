# Change: manual Trupp/Teilnehmer creation + deep station learning aids

Two independent features. Read the existing code first (apps/api/src, apps/web/src)
before changing anything.

## 1. Ausbildungsleiter can create Gruppen AND add Teilnehmer directly

The invite-link self-join flow already works and must keep working as-is (don't remove it
— it's still how most real participants join). ADD a second path: the Ausbildungsleiter can
also add a Teilnehmer directly from `GroupDetail.tsx`, without that person using the invite
link themselves. Useful for pre-populating a Trupp before the first training session.

- New endpoint, e.g. `POST /api/gruppen/:id/teilnehmer` (Ausbildungsleiter-auth only, must
  own the Gruppe): body `{ name, ff }`. Generates a random temporary password (readable,
  e.g. 10-12 chars, avoid ambiguous characters like 0/O/1/l), creates the Teilnehmer the
  same way the self-join flow does (bcrypt hash, `rolle: null`), and returns the plaintext
  temp password ONCE in the response (never store or log it in plaintext after that
  response).
- In `GroupDetail.tsx`, add a small form/button "Person hinzufügen" (Name + FF) next to the
  existing Teilnehmerliste and invite-link/QR code. On success, show the generated
  temporary password in a dismissable confirmation (e.g. "Zugang für Max Mustermann:
  Passwort `xK3mPq9Rst` — jetzt weitergeben, wird nicht erneut angezeigt"), with a copy-to-
  clipboard button. Same duplicate-name handling as the self-join flow (reject/409 if the
  name is already taken in that Gruppe, same error shape).
- The Gruppe-creation flow in `GroupsDashboard.tsx` should already exist from v1 — verify it
  actually works end-to-end in the UI (name input, submit, navigate to the new Gruppe's
  detail page) and fix it if it's just a stub. This needs to be usable without curl.

## 2. Station deep-dive with real learning aids

`reference-apas-bestimmungen-full.md` in this repo's root has the full official procedure
text, Fehlerpunkte tables, and the complete 36-question Gerätekunde Fragenkatalog for all 4
APAS-Bronze stations. Use it as the factual source — don't invent or paraphrase loosely,
structure it faithfully into the data model and UI below.

- Turn the existing flat `Stations.tsx` cards into a two-level view: an overview grid (as
  now) where each station card is clickable, leading to a per-station detail route (e.g.
  `/gruppen/:id/stationen/:stationId` or similar, nested wherever `Stations.tsx` currently
  sits in the routing).
- **Per-station detail page** should contain, built from the reference file's content for
  that station:
  1. **Step-by-step Ablauf** as a numbered, sequential list (use the numbered steps already
     broken out in the reference file for Ausrüsten/Personensuche/Hindernisstrecke/
     Geräteversorgung). Render it as an interactive step-through: one step highlighted/
     active at a time with "Weiter"/"Zurück" buttons and a progress indicator (e.g. "Schritt
     3 von 10"), plus a simple CSS transition/animation when advancing (fade or slide the
     active step in — keep it lightweight, pure CSS, no video/canvas libraries). This is the
     "Animation" Daniel asked for: a guided, animated walk-through of the procedure, not a
     video.
  2. **Checkliste**: the station's Fehlerpunkte table (from the reference file) rendered as
     a checklist of "worauf wird bewertet" items — each row from the table becomes a
     checkable item (purely a local/session UI aid for self-study, e.g. "hab ich das
     vermieden" — no need to persist check state server-side, component-local state is
     fine) with its point value shown (e.g. "Fehlerhafte Kurzprüfung — 2 Punkte je
     Mitglied").
  3. **Zeitvorgabe** prominently shown (e.g. "Soll: 500 Sek.").
  4. For the Geräteversorgung station specifically, also surface the full 36-question
     Gerätekunde-Fragenkatalog from the reference file as a **flashcard component**: one
     question shown at a time, tap/click to flip and reveal the answer, next/previous
     controls, and a shuffle option. This was explicitly out of scope for v1 — it's in scope
     now, build it.
  5. Keep the existing short overview text on the top-level `Stations.tsx` grid (don't
     bloat the overview itself) — the deep content lives on the detail page.
- Everything stays plain React + CSS (same stack as the rest of the app, no new
  dependencies like animation libraries) — CSS keyframes/transitions are enough for the
  step-through "animation" feel.
- Mobile-friendly: this will be used on a phone in a Feuerwehrhaus, not a desktop — step
  cards and flashcards must be comfortably tappable and readable on a small screen.

## Quality bar — same as before

- `npm run typecheck` and `npm run build` must succeed cleanly in all three workspaces.
- Update `README.md`'s Design decisions section to mention the manual-add-Teilnehmer flow
  and the station deep-dive content.
- Delete this file (`CHANGE-stations-and-trupps.md`) once implemented — it's a one-time
  change spec. You may also delete `reference-apas-bestimmungen-full.md` from the repo root
  AFTER its content has been fully absorbed into the station detail components (don't leave
  a half-used dangling reference file lying around once the real content lives in the code).
- Commit with clear messages as you go, push to origin main when fully done and verified.
- Work autonomously end to end without asking questions — make reasonable calls on anything
  left open here and note them in the README's Design decisions section.
