# Change: Trupp picks its own icon + custom display name (fun/gamification)

Small, low-stakes feature for team identity/fun during training — each Trupp can choose a
fun icon and a custom display name for themselves, self-service (not Ausbilder-only). Read
the existing code first: `packages/shared/src/index.ts` (Trupp type), `apps/api/src/routes`
(wherever Trupps are read/updated), `apps/web/src/views/TruppDetail.tsx` and
`TruppDashboard.tsx`, and the existing `components/Icon.tsx` (Lucide/Iconify icon system
already established — reuse it, don't add a new icon source).

## 1. What to add

- **Custom name**: Trupps already have a `name` field set at creation. Allow it to be
  EDITED afterward too — by any Teilnehmer who is a member of that Trupp, not just the
  Ausbilder (this is deliberately a self-service, for-fun customization, same spirit as
  self-service Rollen-Zuweisung already in place). Keep reasonable validation (non-empty,
  a sane max length) but don't over-restrict the content — this is meant to be playful
  ("Die Rauchfresser", "Team Kriechtunnel", whatever they come up with).
- **Icon**: let the Trupp pick one icon from a small curated set of fun, appropriate Lucide
  icons (e.g. flame, shield, zap, target, trophy, skull — pick a reasonable set of ~10-16
  that read as fun/team-mascot-ish without being inappropriate; use the SAME Iconify/Lucide
  source and `Icon.tsx` component already in the app, don't introduce emoji or a new icon
  library). Store just the icon's name/id on the Trupp record.
- Editable from `TruppDetail.tsx` by any member of that Trupp — a simple name field +
  icon picker (grid of selectable icons), save button. No Ausbilder approval needed.
- Show the chosen icon next to the Trupp's name everywhere a Trupp is listed/referenced:
  `TruppDashboard`, the per-station leaderboards (next to each Trupp's row), the shared
  Kalender (wherever Trupp names show up, e.g. the Teilnehmer-Picker grouped-by-Trupp
  labels), and the Trupp's own header on `TruppDetail`. If a Trupp hasn't picked an icon
  yet, show a sane neutral default icon (don't show nothing/broken).

## 2. API

- Extend the existing Trupp update endpoint (or add a small dedicated one if that's cleaner
  given the current route structure) to accept `{ name?, icon? }`, open to the Ausbilder OR
  any Teilnehmer who is a member of that Trupp (not Teilnehmer of a DIFFERENT Trupp).
- Validate `icon` against the fixed curated set server-side too (reject an arbitrary string),
  so the stored value always maps to a real icon the frontend can render.

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Reuse the agent team already set up in `.claude/agents/` for this: `@api-engineer` for the
  backend bit, `@web-engineer` for the picker UI, `@design-reviewer` to check the icon grid
  doesn't violate the established design system, `@qa-verifier` to confirm a Teilnehmer from
  a DIFFERENT Trupp genuinely cannot rename/re-icon a Trupp they don't belong to, before
  calling this done.
- Update `README.md`'s Design decisions section briefly (the icon set chosen, who can edit).
- Delete this file (`CHANGE-trupp-identity.md`) once implemented.
- Commit with clear incremental messages, push to origin main when fully done and verified.
- Work autonomously end to end without asking questions. Make reasonable calls on anything
  left open here (exact icon set, max name length) and record them in the README.
