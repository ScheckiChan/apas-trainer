# Change: rename Gruppe → Trupp, simplify to single-instance scope

This app is deployed ONCE for ONE APAS-Bronze training cohort — it is not a multi-course
SaaS. "Gruppe" in the current code/UI literally IS a Trupp (a 4-person Atemschutztrupp with
GKDT/ATF/ATM1/ATM2/Wassertruppführer roles). There may be more than one Trupp in this one
training (e.g. several 4-person teams training in parallel), but there is no need to frame
this as "courses" or imply the Ausbildungsleiter manages many unrelated future trainings
over time.

Read the existing code first (apps/api/src, apps/web/src, packages/shared/src) before
changing anything.

## 1. Rename Gruppe → Trupp throughout

- Rename the `Gruppe` type/concept to `Trupp` everywhere it's user-facing: UI copy/labels
  ("Trupp erstellen", "Meine Trupps", "Trupp-Details", "Trupp beitreten" instead of
  "Gruppe..."), route names/paths where reasonable (e.g. `/trupps/:id` instead of
  `/gruppen/:id` — update all links/navigation accordingly), component/file names where it's
  a clean rename (`GroupDetail.tsx` → `TruppDetail.tsx`, `GroupsDashboard.tsx` →
  `TruppDashboard.tsx`, etc.), API route paths (`/api/gruppen` → `/api/trupps`,
  `/api/gruppen/:token/join` → `/api/trupps/:token/join`, etc.), and internal
  types/variables/field names (`gruppeId` → `truppId`, the `Gruppe` type in
  `packages/shared` → `Trupp`, etc.).
- Do a thorough find-and-replace-with-judgment pass — grep for `Gruppe`/`gruppe`/`GRUPPE` in
  both apps/web/src and apps/api/src and packages/shared/src, and rename every user-facing
  and internal occurrence consistently. Leave only things that are genuinely generic English
  code terms (e.g. don't rename unrelated words that happen to contain "group" in a
  different, non-APAS sense if any exist — there shouldn't be any, this is a from-scratch
  app, but double check).
- `stufe: 'BRONZE'` field, roles, checklist etc. stay as they are — only the Gruppe→Trupp
  rename, not a broader schema rewrite.

## 2. Simplify the Ausbildungsleiter dashboard

- Replace the current `GroupsDashboard`/`TruppDashboard` framing (which currently emphasizes
  "create a new course/Gruppe" as the primary action, implying an ongoing multi-course
  system) with a simple, direct **Trupp-Liste**: on login, the Ausbildungsleiter lands
  straight on a list of the Trupps that exist for this training (likely just one or a
  handful), each as a clickable card/row showing: Trupp-Name, wie viele der 4 Rollen besetzt
  sind, Prüfungstermin-Countdown if set. "Neuen Trupp erstellen" stays available (there can
  legitimately be more than one Trupp in this one training) but as a secondary action (e.g.
  a button at the top/bottom of the list), not the dominant first-screen call-to-action.
- Remove any copy/wording that implies this is a general-purpose reusable course-management
  platform (e.g. anything saying "Kurs" or implying recurring future trainings). This is a
  single APAS-Bronze-Ausbildung's tool.
- The Ausbildungsleiter remains the one who creates Trupps and does Rollen-Zuweisung /
  manages Teilnehmer (via the existing "Person hinzufügen" flow and the role dropdown) — no
  change needed there, that's already correct per Daniel's explicit instruction ("Die Trupps
  und Zuweisung macht der admin").

## Quality bar — same as before

- `npm run typecheck` and `npm run build` must succeed cleanly in all three workspaces.
- Update `README.md` to use Trupp terminology consistently and reflect the simplified
  single-instance framing in the Design decisions section.
- Delete this file (`CHANGE-rename-trupp.md`) once implemented.
- Commit with clear messages as you go, push to origin main when fully done and verified.
- Work autonomously end to end without asking questions. Where the spec leaves something
  open, make a reasonable call and note it in the README's Design decisions section.
