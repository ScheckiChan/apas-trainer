# Change: station Timer + cross-Trupp Leaderboard, for use DURING live training

Two connected features, meant to be operated live while a Trupp is actually running a
station during a training session (not just studied beforehand). Read the existing code
first (apps/api/src, apps/web/src, packages/shared/src), especially `StationDetail.tsx` and
the station content data (Fehlerpunkte tables, Soll-Zeiten) that already exists.

## 1. Timer on the station detail page

Add a real stopwatch to `StationDetail.tsx`, usable one-handed, large and readable (someone
is holding a phone while watching a Trupp train, not sitting at a desk):

- Start / Pause / Reset controls, big `mm:ss` display.
- Compares live against that station's real Soll-Zeit (already in the content data — e.g.
  170 Sek for Ausrüsten im Fahrzeug 200 bar, 500 Sek for Personensuche, etc. — use the
  correct Soll-Zeit per station, and where a station has sub-variants with different times
  — e.g. Ausrüsten im Fahrzeug vs. außerhalb, 200 bar vs 300 bar — let the user pick which
  Soll-Zeit applies before starting, e.g. a small selector).
- Once the elapsed time exceeds the Soll-Zeit, show it visually as overrunning (color
  change, not alarming/red-flashing — informational) AND auto-compute the real
  Zeitüberschreitungs-Fehlerpunkte per the actual rule already in the content data ("je 10
  Sekunden 2 Punkte") — round the overage up to the next full 10-second block. Show this
  computed value live next to the timer (e.g. "Überschreitung: 23 Sek → +4 Fehlerpunkte").
- The existing Fehlerpunkte-Checkliste on the station detail page (built in the earlier
  stations change) already lets someone tick off which Fehlerpunkte-table rows applied
  during a run, with their point values. Sum the ticked items' points live, add the
  timer's computed Zeitüberschreitung points, show a running **Gesamt-Fehlerpunkte** total
  for this run, and indicate against that station's own max-Fehlerpunkte limit (from the
  content data) whether this run would still pass that station in isolation.
- Anyone can use the timer locally to practice (Teilnehmer or Leiter) — it works without
  saving anything. Saving an official result (next section) is Leiter-only.

## 2. Recording a result + cross-Trupp Leaderboard

- Data model addition (packages/shared + API storage): per Trupp, per Station, store the
  LATEST recorded result only (not a full history — this is a live-use tool, not an
  archive): `{ zeitSekunden, fehlerpunkte, bestanden, aufgenommenAm }`. `bestanden` for that
  single station = fehlerpunkte <= that station's own max from the content data.
- New endpoint, Leiter-auth only, must own the Trupp: something like
  `PUT /api/trupps/:id/ergebnisse/:stationId` with body `{ zeitSekunden, fehlerpunkte }`.
  On the station detail page, the Leiter gets an "Ergebnis speichern" button (not visible
  to Teilnehmer) that submits the current timer + checklist total. Confirm visually once
  saved.
- New `Leaderboard` view/route, visible to anyone authenticated (Leiter or any Teilnehmer of
  any Trupp — this is meant to be motivating/visible, not hidden). Content:
  - One row per Trupp, ranked primarily by whether they'd pass OVERALL (sum of all recorded
    station Fehlerpunkte <= 35 AND no single station over its own limit — use the real
    Bestehensregel already in the content data), secondarily by total Fehlerpunkte ascending
    (lower is better) among Trupps with the same pass/fail status.
  - A Trupp that hasn't recorded all 4 stations yet still appears, clearly marked as
    incomplete (e.g. "2/4 Stationen absolviert"), not ranked as if it had a full result —
    don't let a Trupp with only 1 great station outrank a Trupp with 4 solid ones.
  - Expandable/visible per-station breakdown (time, Fehlerpunkte, pass/fail per station) per
    Trupp row.
  - Make it genuinely readable at a glance on a phone — this might be projected or passed
    around during a training session.
- Add a link/entry to the Leaderboard in the app's navigation (wherever TruppDashboard /
  TeilnehmerView currently link out to Stationen etc.).

## Quality bar — same as before

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Keep using the design tokens / component patterns already established by the design-
  system pass (check what's landed in apps/web/src by the time you start — read the current
  CSS/tokens before adding new UI, don't reintroduce old ad-hoc styling).
- Update `README.md`'s Design decisions section briefly with how results are stored
  (latest-only, not history) and the ranking rule.
- Delete this file (`CHANGE-timer-leaderboard.md`) once implemented.
- Commit with clear incremental messages, push to origin main when fully done and verified.
- Work autonomously end to end without asking questions. Make reasonable calls on anything
  left open here and note them in the README's Design decisions section.
