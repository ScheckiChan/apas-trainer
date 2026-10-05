# Change: password-based Teilnehmer accounts, dynamic role assignment

This REPLACES the email-magic-link auth for Teilnehmer and DECOUPLES role
assignment from joining. Read the existing code first (apps/api/src,
apps/web/src) before changing anything — keep everything else (Ausbildungsleiter
auth, Gruppen, Checkliste, Kalender/Ressourcen, Stations) as-is.

## 1. Teilnehmer auth: password instead of email magic link

- Remove the magic-link flow entirely: delete `sendMagicLink()`, the
  magic-link token model/storage, the `/join/:token` → email → verify
  round trip, and the `MagicLinkVerify.tsx` view + route.
- The `Join.tsx` page (`/join/:token`) now collects: Name, FF (Feuerwehr),
  Passwort (+ Passwort wiederholen). NO email field, NO Rolle field.
  Submitting creates the Teilnehmer immediately (bcrypt-hash the password,
  same way the Ausbildungsleiter's password is hashed) and logs them straight
  in — issue the Teilnehmer JWT right away, no extra verification step.
- Add a **returning-Teilnehmer login** at the same invite link: the `/join/:token`
  page needs a toggle/tab "Neu beitreten" vs "Anmelden" (or two separate simple
  forms) — login takes Name + Passwort, scoped to that Gruppe's token (so two
  different Gruppen can both have a "Max" without collision; identity is
  (gruppeId, name) + password, not a global username). Handle the case of a
  duplicate name within one Gruppe sensibly (e.g. require unique names within
  a Gruppe, reject a second join with the same name with a clear error telling
  them to use "Anmelden" instead).
- Drop the `email` / `emailVerified` fields from the Teilnehmer type in
  `packages/shared` (or keep email purely optional/unused if removing it
  breaks too much — your call, but it must not be required or shown in the UI
  anywhere).
- Remove now-dead code: the email-sending stub, VAPID subject mailto reference
  is fine to keep (that's push, unrelated), any magic-link rate limiting /
  cron cleanup for expired tokens.

## 2. Role assignment becomes dynamic, not part of joining

- Remove "Rolle" from the Join form entirely (see above). A newly joined
  Teilnehmer has `rolle: null` (make the field nullable/optional in the shared
  type).
- Add role assignment to `GroupDetail.tsx`: for each Teilnehmer in the list,
  a dropdown/select to assign one of the 4 roles (GKDT, ATF_ATM1, ATM2,
  WASSERTRUPPFUEHRER) or "keine" (null). Anyone who can see GroupDetail should
  be able to change any Teilnehmer's role at any time (including the
  Ausbildungsleiter AND the Teilnehmer themselves if they have a group view —
  check how `TeilnehmerView.tsx` currently works and extend it the same way:
  Teilnehmer can see and change their own role, and ideally see/change
  others' too, since role-shuffling before the actual exam is a group
  decision, not solely the Ausbildungsleiter's call).
- A role can be assigned to more than one Teilnehmer at a time if the Gruppe
  has more than 4 people (e.g. substitutes) — don't hard-block duplicate role
  assignment, that's a real scenario (Ergänzungsteilnehmer per the APAS
  rules). Just show the current 4-role coverage clearly (e.g. a small
  roles-filled indicator: "3/4 Rollen besetzt") without blocking anything.
- The Checkliste (AT/ATS3/Tauglichkeit) and GKDT-exemption-from-Tauglichkeit
  logic should now key off whichever Teilnehmer currently holds the GKDT
  role, dynamically — not something fixed at join time.

## 3. API changes

- New/changed endpoints roughly:
  - `POST /api/gruppen/:token/join` — { name, ff, password } → creates
    Teilnehmer + returns Teilnehmer JWT.
  - `POST /api/gruppen/:token/login` — { name, password } → returns
    Teilnehmer JWT for an existing Teilnehmer in that Gruppe.
  - `PATCH /api/teilnehmer/:id/rolle` — { rolle: Role | null } — update role,
    authorized for the Ausbildungsleiter who owns the Gruppe OR any
    authenticated Teilnehmer of that same Gruppe.
- Remove whatever routes/modules existed only for the magic-link flow.
- Keep rate limiting on join/login (password brute-force matters here).

## 4. Quality bar — same as before

- `npm run typecheck` and `npm run build` must succeed cleanly in all three
  workspaces.
- Update `README.md`: remove the "no real SMTP" known-gap note (no longer
  applicable), replace with a short description of the password-based join
  flow instead. Update the "Design decisions" section to reflect this.
- Remove `MAGIC_LINK_TTL_MINUTES` from `.env.example` (and anywhere else
  referenced) since it's no longer used.
- Commit with clear messages, push to origin main when done and verified.
- Work autonomously, don't ask questions — make reasonable calls on anything
  left open here and note them in the README's Design decisions section.
