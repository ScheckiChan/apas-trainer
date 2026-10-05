# Fix: per-station leaderboards instead of one combined overall Rangliste

Scope correction: the Rangliste currently ranks Trupps by an overall combined score
(pass/fail + total Fehlerpunkte summed across all stations). That's wrong for the actual use
case — this is meant as light gamification DURING live training, where Trupps compare
themselves against each other **per station** (e.g. "who was fastest/cleanest at
Ausrüsten"), not as one grand combined ranking. Read the existing code first:
`apps/api/src/routes/*.ts` (wherever `/rangliste` lives), `packages/shared/src/index.ts`,
`apps/web/src/views/Rangliste.tsx` (or wherever it landed), and the station content/ids in
`apps/web/src/content/stations.ts`.

## 1. Replace the combined ranking with 4 per-station leaderboards

- The Rangliste view shows one leaderboard PER STATION (Ausrüsten, Personensuche,
  Hindernisstrecke, Geräteversorgung — same 4 station ids already used elsewhere), not one
  combined cross-station ranking.
- Each per-station leaderboard ranks every Trupp that has a recorded result for THAT
  station, by **Zeit** primarily (fastest first — this is literally a stopwatch comparison,
  the "kleine Gamification" is about speed), with Fehlerpunkte shown alongside each row
  (not necessarily the primary sort key — time is, per Daniel's framing "sich mit den
  Zeiten messen"). Still show whether each result would pass that station's own
  Fehlerpunkte limit (bestanden/nicht bestanden badge), since a blazing-fast but
  disqualifying run shouldn't look like a clean win — but don't let Fehlerpunkte override
  the time-based ranking; show both, sort by time.
- A Trupp with no recorded result for a given station simply doesn't appear in that
  station's leaderboard (no "incomplete" placeholder needed per station — the old
  "x/4 Stationen absolviert" framing was for the combined view, which goes away).
- Geräteversorgung has two timed parts (Geräteversorgung + Fragen, per the earlier
  change) — decide whether that's one combined leaderboard for the station or two separate
  mini-leaderboards for its two timed parts; pick whichever reads cleanly and say which you
  chose in the README.
- Keep the page easy to flip between the 4 stations on a phone (tabs, a segmented control,
  or four stacked sections — your call, favor something that doesn't need horizontal
  scrolling at 390px).

## 2. What to drop

- Remove the combined "gesamtFehlerpunkte" / overall pass-fail ranking logic entirely — it
  doesn't match how this is actually used. Don't keep it as a hidden/secondary view unless
  trivial to leave in; if it adds meaningful complexity to maintain both, just replace it.
- Keep the underlying per-Trupp, per-station, latest-result storage exactly as it is — this
  change is about how results are RANKED AND DISPLAYED, not how they're recorded. The
  Stoppuhr/Fehlerpunkte-checklist/"Ergebnis speichern" flow on the station page is unaffected.

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Reuse the current design tokens/components (this lands after the design-system and shared-
  calendar passes — check what's live in the repo by the time you start, don't reintroduce
  old styling or re-fight the now-shared-calendar routes).
- Update `README.md`'s Design decisions / API section to describe per-station leaderboards
  instead of the old combined Rangliste.
- Delete this file (`CHANGE-per-station-leaderboard.md`) once implemented.
- Commit with clear incremental messages, push to origin main when fully done and verified.
  Test for real: record results for the same station from two different Trupps with
  different times, confirm the leaderboard orders them correctly by time.
- Work autonomously end to end without asking questions. Make reasonable calls on anything
  left open here and record them in the README's Design decisions section.
