# Change: Truppsuche — self-matching for people without a Trupp

A second self-service path alongside `/trupp-waehlen` (joining an existing, already-created
Trupp). This one is for the opposite situation: several registered people without a Trupp
want to be grouped together into a NEW Trupp based on the APAS-Rolle they want to play, so
an Ausbilder doesn't have to manually sort a pile of loose registrations into balanced
Trupps by hand. Read `apps/web/src/views/TruppWaehlen.tsx`, the self-join endpoint in
`apps/api/src/routes/trupps.ts`, `lib/beitreten.ts`, and the `Trupp`/`Benutzer` types in
`packages/shared/src/index.ts` first.

## 1. Data model

- Add an optional `gewuenschteRolle: Rolle | null` field to Benutzer — the APAS-Rolle
  (GKDT/ATF_ATM1/ATM2/WASSERTRUPPFUEHRER) someone without a Trupp WANTS to play once
  matched. Separate from `rolle` (the role actually held inside a Trupp, which stays null
  until they're in one). Settable only while `truppId === null` — once someone is in a
  Trupp, `gewuenschteRolle` is irrelevant (the real `rolle` takes over); clear it when they
  join/get matched into a Trupp.

## 2. "Truppsuche" screen

- New screen, e.g. `/truppsuche`, reachable from `/trupp-waehlen` (an Ausbilder-independent
  Teilnehmer screen) as a secondary option next to the existing "join an existing Trupp"
  list — something like "Lieber mit anderen Wartenden zu einem neuen Trupp zusammenfinden?".
- Shows: the current list of OTHER Trupp-less Teilnehmer who have set a `gewuenschteRolle`
  (name, FF, desired Rolle — NOT their Checkliste, same privacy rule as the existing
  `GET /termine/personen` endpoint that already excludes Checkliste), grouped/sorted by
  desired Rolle so it's obvious at a glance who still needs grouping and in what role mix.
- The signed-in person picks their own `gewuenschteRolle` from a simple selector (the same
  4-role set, reuse existing Rollen labels/components) and saves it
  (`PATCH /benutzer/me/gewuenschte-rolle` or similar — self-service, not an Ausbilder
  action). It's visible to themselves and other Trupp-less people immediately.

## 3. Matching into a new Trupp

- Self-service, not automatic/background matching — explicit action, so nobody gets
  silently moved. Any Trupp-less Teilnehmer who has set a `gewuenschteRolle` can select OTHER
  Trupp-less people (by name, from the same list) they want to team up with and trigger
  "Neuen Trupp aus Auswahl bilden" — this creates a new Trupp and moves every selected
  person (plus the initiator) into it in one step, each landing with THEIR `rolle` set to
  their own `gewuenschteRolle` (not reassignable by this action alone — Rollen can still be
  changed normally afterward inside the Trupp, same as today).
- Reasonable constraints: between 2 and 6 people total in one such action (a Trupp is
  nominally 4, but duplicate Rollen are already allowed elsewhere in the app, so don't hard
  — block above 4, just don't allow something absurd like 20). Everyone selected must
  currently be Trupp-less (re-check server-side, not just client-side, in case of a race:
  someone else grabbed one of the selected people into another Trupp moments earlier — fail
  the whole action with a clear error rather than partially applying it).
- New Trupp gets a sensible auto-generated name (e.g. based on the Feuerwehr of the
  initiator, or a generic "Neuer Trupp" — Ausbilder/members can rename via the existing
  Trupp-Identität feature afterward, so this doesn't need to be clever) and no
  Prüfungstermin set yet (same as a normal Ausbilder-created Trupp without one — check how
  that's currently handled and stay consistent).
- This creates the Trupp without any Ausbilder action — reasonable given Ausbilder can
  already freely edit/merge/delete Trupps afterward if the result needs adjusting (the
  existing `DELETE /trupps/:id` keeps members, detaches them, so a bad grouping is easily
  undone).

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Use the project's agent team in `.claude/agents/`: `@api-engineer` for the
  gewuenschteRolle field + matching/Trupp-creation endpoint, `@web-engineer` for the
  Truppsuche screen and multi-select "form a Trupp" flow, `@design-reviewer` for the new
  screen, `@qa-verifier` to confirm for real: two Trupp-less accounts set a
  gewuenschteRolle, one selects the other and forms a Trupp, both land in it with the
  right Rollen, a concurrent-claim race (someone already grabbed) is rejected cleanly, and
  someone already in a Trupp cannot be selected into a new one.
- Update `README.md`/`docs/ARCHITECTURE.md` briefly describing this second self-service
  path alongside the existing Trupp-Wahl.
- Delete this file (`CHANGE-truppsuche.md`) once implemented.
- Commit with clear incremental messages, push to origin `feature/truppsuche` (NOT main —
  this runs in its own git worktree in parallel with another change).
- Work autonomously end to end without asking questions. Make reasonable calls on anything
  left open here and record them in the docs.
