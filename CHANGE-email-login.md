# Change: Login via E-Mail-Adresse statt Name

Read the current auth model first: `apps/api/src/lib/auth.ts`, `apps/api/src/routes/auth.ts`
(or wherever login/register live), `apps/api/src/lib/benutzer.ts` (`nameKey()`/uniqueness),
`packages/shared/src/index.ts` (Benutzer type), `apps/web/src/views/Login.tsx` and the
registration view. Currently accounts are identified by a unique `name` field (instance-wide,
case-insensitive) used to log in — this change switches the login identifier to a real e-mail
address instead, while keeping `name` as a separate display name.

## 1. Data model

- Add `email: string` to Benutzer (shared type + API), normalized lowercase/trimmed, unique
  instance-wide (same uniqueness discipline currently applied to `name` via `nameKey()` — write
  an equivalent `emailKey()`/reuse the pattern). Add real e-mail format validation (zod
  `z.string().email()` or equivalent) server-side.
- `name` stays as-is: the display name shown everywhere (Trupp lists, Kalender, Rangliste,
  Benutzerverwaltung) — NOT used for login anymore, no longer required to be unique.
- Migration for existing accounts (`migrate.ts`, new function, wired into `runMigrations`):
  every existing Benutzer without an `email` needs one. There's no real e-mail on file for
  Teilnehmer accounts created via invite link — generate a clearly-placeholder value instead of
  inventing a fake-but-real-looking address, e.g. `<id>@ohne-email.lokal` or similar, so it's
  obviously not deliverable and an Ausbilder can tell at a glance in Benutzerverwaltung which
  accounts still need a real e-mail set. Log how many were backfilled this way. The Ausbilder
  accounts migrated earlier already came from a real e-mail (check `migrateBenutzer` — Leiter's
  `name` field was set to the e-mail during that migration) — reuse that value as their `email`
  rather than placeholder-generating it too.

## 2. API

- Login endpoint: accept `{ email, password }` instead of `{ name, password }`; look up by
  normalized email instead of name.
- Registration endpoint: require a real `email` (validated format) in addition to `name`;
  reject duplicate emails with a clear error (not a generic 500).
- Benutzerverwaltung: Ausbilder can view/edit a user's `email` (e.g. to replace a placeholder
  once the real address is known), same permission model as other Benutzerverwaltung edits.
- Keep `name` editable too, independently of `email` — they're now fully decoupled.

## 3. Web

- Login form: replace the "Name" input with an "E-Mail-Adresse" input (`type="email"`,
  appropriate `autocomplete="email"` / `autocomplete="username"`).
- Registration form: keep the existing Name field, add a required E-Mail field next to it.
- Benutzerverwaltung screen: show + allow editing each user's e-mail; visually flag placeholder
  emails (the `@ohne-email.lokal`-style ones from the migration) so the Ausbilder knows which
  accounts still need a real address — don't just silently display them as if they were real.

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Use the project's agent team in `.claude/agents/`: `@api-engineer` for schema + migration +
  login/registration endpoint changes, `@web-engineer` for the login/registration/
  Benutzerverwaltung UI changes, `@design-reviewer` for the changed screens,
  `@qa-verifier` to confirm for real: migration backfills emails for every existing account
  without erroring, login with the seeded admin's real email + existing password still works,
  a fresh registration requires and validates a real email, duplicate-email registration is
  rejected with a clear message, an Ausbilder can edit a placeholder email to a real one in
  Benutzerverwaltung.
- Update `README.md`'s auth/API section briefly to describe the new login identifier.
- Delete this file (`CHANGE-email-login.md`) once implemented.
- Commit with clear incremental messages, push to origin `feature/email-login` (NOT main —
  this runs in its own git worktree in parallel with another change; do not merge or push to
  main yourself).
- Work autonomously end to end without asking questions.
