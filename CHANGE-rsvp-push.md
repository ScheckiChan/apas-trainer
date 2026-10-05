# Change: RSVP ("anwesend" sign-up) + push notification on new Fixtermin

Two related additions to the shared Kalender. Read the existing code first:
`apps/api/src/routes/termine.ts` (or wherever it landed after the shared-calendar fix),
`apps/api/src/reminders.ts` (existing push/VAPID infra — reuse it, don't reimplement),
`packages/shared/src/index.ts` (Termin type), `apps/web/src/views/Calendar.tsx`.

## 1. "Anwesend" RSVP on Fixtermine

- A Fixtermin (created by an Ausbilder, per the existing `typ: 'fix'`) currently has a fixed
  `teilnehmerIds` list set at creation. Add the ability for any Teilnehmer (from any Trupp,
  per the instance-wide calendar) to mark themselves "anwesend" on a Fixtermin — a simple
  toggle/button on the Termin's detail view in the Calendar, separate from the originally
  assigned `teilnehmerIds` list (the Ausbilder's initial assignment and self-RSVP are two
  different things: the Ausbilder may invite the whole cohort to a Fixtermin, people confirm
  attendance themselves afterward).
- Store this as a new field, e.g. `anwesendIds: string[]` on the Termin record — a Teilnehmer
  can add/remove themselves, not anyone else. The Ausbilder can see the list of who confirmed
  (read-only for them, they don't set it on others' behalf... unless there's an obvious need
  for the Ausbilder to mark someone present manually too, e.g. for someone without the app
  open — if that's easy to support alongside, do it, Ausbilder marking any Teilnehmer present
  is a reasonable addition; a Teilnehmer still can only toggle their own).
- Show an attendance count on the Termin in the Calendar view (e.g. "5 angemeldet") so it's
  useful at a glance, and the full list of names on the Termin's detail/expanded view.
- Individualübungen don't need this RSVP concept — they already have an explicit
  `teilnehmerIds` list chosen by whoever created them; this is specifically for Fixtermine
  where the Ausbildungsleiter doesn't know in advance exactly who's coming.

## 2. Push notification when a new Fixtermin is created

- Reuse the existing `web-push`/VAPID infrastructure in `reminders.ts` — it already sends
  reminders N hours before a Termin on a periodic check. Add a SEPARATE, immediate
  notification: the moment an Ausbilder creates a new Fixtermin, push a notification right
  away (not waiting for the existing before-the-event reminder window) to every Teilnehmer
  who has a push subscription registered, regardless of whether they're in the Termin's
  initial `teilnehmerIds` — since this is a shared instance-wide calendar and anyone might
  want to know a new Fixtermin exists, OR restrict it to just the invited `teilnehmerIds` if
  that reads more correctly — pick whichever matches the existing reminder's targeting logic
  (check `reminders.ts` for how it currently decides who gets a reminder for a Termin, and be
  consistent with that choice here rather than inventing a different targeting rule).
- Notification content: Trupp-agnostic wording appropriate to a shared calendar, e.g. "Neuer
  Übungstermin: {Titel}, {Datum/Uhrzeit}" with a link that opens `/kalender` (or directly to
  the Termin if there's a stable per-Termin URL/anchor).
- Don't send this immediate notification for Individualübungen (only Fixtermine) — those are
  created by individual Teilnehmer for their own practice and pushing a notification to
  everyone for every ad-hoc individual session would be noisy; the existing before-the-event
  reminder logic for Individualübungen (if any) stays as-is, unaffected by this change.

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Use the project's agent team in `.claude/agents/`: `@api-engineer` for the RSVP field +
  push-on-create logic, `@web-engineer` for the RSVP toggle/attendance-count UI,
  `@design-reviewer` for the new UI bits, `@qa-verifier` to confirm the real flow (create a
  Fixtermin, confirm a push fires immediately; have a Teilnehmer RSVP and un-RSVP, confirm
  the Ausbilder sees the updated list; confirm a Teilnehmer can't RSVP someone else).
- Update `README.md`'s Design decisions / API section briefly.
- Delete this file (`CHANGE-rsvp-push.md`) once implemented.
- Commit with clear incremental messages, push to origin main when fully done and verified.
- Work autonomously end to end without asking questions. Make reasonable calls on anything
  left open here and record them in the README.
