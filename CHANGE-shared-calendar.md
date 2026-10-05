# Fix: shared instance-wide calendar, not per-Trupp

Bug: Termine (Kalender) and Ressourcen are currently scoped to a single Trupp
(`truppId` foreign key, API mounted at `/api/trupps/:truppId/termine`, Ressourcen validated
against `trupp.id`). This is wrong for how this instance is actually used: **one deployment
= one Prüfungstermin/Ausbildung**, with potentially many Trupps (4-person teams) all training
for the SAME exam day and sharing the SAME resources (e.g. one vehicle). They must share ONE
calendar, not each get their own. Relationship is 1 instance : N Trupps, and the calendar
belongs to the instance, not to any one Trupp.

Read the existing code first: `apps/api/src/routes/termine.ts`, `apps/api/src/db.ts`,
`packages/shared/src/index.ts` (Termin/Ressource types), `apps/web/src/views/Calendar.tsx`,
and wherever Calendar is mounted/linked from (`TruppDetail.tsx`, `TeilnehmerView.tsx`).

## 1. Data model change

- Remove `truppId` from `TerminRecord` and from the `Ressource` type entirely — both become
  instance-global entities, not attached to any single Trupp.
- `teilnehmerIds` on a Termin can reference Teilnehmer from ANY Trupp in the instance, not
  just one. When assigning people to a Termin, the picker must list Teilnehmer across all
  Trupps (grouped or labeled by their Trupp name so it's clear who's who when multiple Trupps
  share a training day).
- `createdBy` stays as-is (either `'ausbildungsleiter'` or a Teilnehmer's id) — a Teilnehmer
  from any Trupp can still create an Individualübung and assign anyone from any Trupp to it.
- Resource-conflict detection (`findKonflikte`) must check overlaps against ALL Termine on
  that Ressource instance-wide, not scoped to one Trupp — that's the whole point (two Trupps
  can't both book the one shared vehicle at the same time without a visible conflict).
- Write a small one-time migration (same pattern as the existing `migrate.ts` for the
  Gruppe→Trupp rename) that strips `truppId` from any already-stored Termin/Ressource
  records on startup, so existing data in `/data` doesn't break.

## 2. API changes

- Move the routes from `/api/trupps/:truppId/termine` to a top-level `/api/termine` (and
  `/api/ressourcen` if Ressourcen have their own route file — check and move similarly).
  `mergeParams`-based `truppId` access goes away.
- Auth: `requireAny` (Leiter or any Teilnehmer) stays the gate for read/write, same as now —
  but no longer scoped to "my Trupp's" termine. Any authenticated principal (any Teilnehmer
  of any Trupp, or the Ausbildungsleiter) can read the shared calendar and create an
  Individualübung. Fixtermine remain Ausbildungsleiter-only to create (`isOwner` check —
  since there's only one Ausbildungsleiter account in this single-instance deployment, this
  simplifies: just check `req.leiter` is present, no more per-Trupp ownership check needed).
- `validateRefs`: Teilnehmer validity check must look across ALL Teilnehmer in the instance
  (any Trupp), not one Trupp's members. Ressource validity check no longer needs a
  `trupp.id` match, just that the Ressource exists.
- `canModify`: Ausbildungsleiter can edit everything; a Teilnehmer can edit an Individualübung
  they created, regardless of which Trupp they or the other assignees belong to.

## 3. Frontend changes

- Calendar becomes a single shared view at a top-level route (e.g. `/kalender`), not nested
  under `/trupps/:id/kalender`. Link to it from the main navigation (same place the
  Rangliste/trophy link lives), visible to both Leiter and any Teilnehmer.
- Remove any Calendar entry point that's nested inside `TruppDetail.tsx`/per-Trupp context —
  replace with a link to the shared `/kalender`.
- The Teilnehmer/Ressource picker in the "Neuer Termin" form must show which Trupp each
  Teilnehmer belongs to (e.g. "Max Mustermann (Trupp Alpha)") since people from different
  Trupps now appear together in one list.
- Ressourcen (e.g. the vehicle) are managed instance-wide too — if there's a "Ressource
  anlegen" UI, move it out of per-Trupp context into the shared Kalender view (Leiter-only to
  create/edit Ressourcen, same as Fixtermine).

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Reuse the existing design tokens/components — don't reintroduce old styling.
- Update `README.md`'s Design decisions / API overview section to reflect the calendar now
  being instance-wide, not per-Trupp.
- Delete this file (`CHANGE-shared-calendar.md`) once implemented.
- Commit with clear incremental messages, push to origin main when fully done and verified.
  Test it for real against the live-style API shape (create a Termin assigning people from
  two different Trupps, confirm a Ressourcen-Konflikt is detected across Trupps) before
  calling it done.
- Work autonomously end to end without asking questions. Make reasonable calls on anything
  left open here and record them in the README's Design decisions section.
