# Change: Trainingspräferenz — preferred training days (user setting)

A personal setting: which days of the week someone is generally available/wants to train on.
Read `packages/shared/src/index.ts` (Benutzer type), the Benutzerverwaltung/account-settings
UI (check `apps/web/src/components/HauptNav.tsx`'s Konto menu and whether there's already an
account-settings screen or if this is the first one), and `apps/web/src/views/Calendar.tsx`
first.

## 1. Data model

- Add `trainingspraeferenz: Wochentag[]` to Benutzer (empty array = no preference set, not
  "available every day" — don't default it to all days, that would be misleading). Define
  `Wochentag` as the 7 weekdays (Montag..Sonntag — reuse the existing `WEEKDAYS`/Monday-first
  convention already used in `Calendar.tsx`'s `WEEKDAYS` constant, keep naming consistent).
- This is purely informational/self-reported — it does NOT restrict or filter what Termine
  someone can be assigned to or RSVP on; Ausbilder still schedule freely. It's a signal, not
  an enforcement mechanism.

## 2. Where it's set

- A simple multi-select of the 7 weekdays (toggleable chips/checkboxes, not a dropdown — 7
  options, all should be visible and tappable at once) somewhere reachable from the account
  menu (`KontoMenu` in `HauptNav.tsx`) — if there's no existing "Mein Konto"/account-settings
  screen yet, create a minimal one (e.g. `/konto`) for this setting alone; don't bolt it onto
  an unrelated screen. Save immediately on toggle (no separate "Speichern" button needed for
  a single multi-select field — match whatever the simplest existing pattern for a
  self-contained toggle-and-persist setting elsewhere in the app does, if one exists).
- Available to every account (Ausbilder, Prüfer, Teilnehmer alike) — everyone trains, not
  just Teilnehmer.

## 3. Where it's shown / used

- On the shared Kalender's Teilnehmer-picker (when an Ausbilder is choosing people for a new
  Fixtermin or assigning an Individualübung), show each person's preferred days as a small
  inline hint next to their name when the Termin being created/edited falls on a day NOT in
  their preference list — something like a subtle muted note, not a blocking warning (e.g.
  small calendar icon + "bevorzugt nicht" or similar, no alert styling — this is a hint for
  the Ausbilder's judgement, never a block). No hint shown for someone with an empty
  preference list (nothing to compare against).
- Keep this addition small and unobtrusive — don't restructure the whole Kalender picker for
  it, just add the one hint where people are already listed.

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Use the project's agent team in `.claude/agents/`: `@api-engineer` for the field + its
  self-service update endpoint, `@web-engineer` for the settings screen and the Kalender
  picker hint, `@design-reviewer` for the new screen and the hint styling, `@qa-verifier` to
  confirm for real: an account sets/clears its preferred days, it persists across
  login/logout, another account's preference isn't editable by anyone but an Ausbilder
  shouldn't even need to (no admin override needed here — it's self-reported, not managed),
  and the Kalender picker hint shows/hides correctly for a Termin on vs. off someone's
  preferred days.
- Update `README.md`/`docs/ARCHITECTURE.md` briefly describing the setting and that it's
  informational only.
- Delete this file (`CHANGE-trainingspraeferenz.md`) once implemented.
- Commit with clear incremental messages, push to origin `feature/trainingspraeferenz` (NOT
  main — this runs in its own git worktree in parallel with another change).
- Work autonomously end to end without asking questions. Make reasonable calls on anything
  left open here and record them in the docs.
