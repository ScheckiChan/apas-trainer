# Change: real design system for APAS-Trainer (claude-design + Daniel's web-design-rules)

Apply Daniel's standing design rules (see repo-external context: tokens-first, deliberate
typography, real icons, disciplined motion, hard anti-slop bans) to this ACTUAL React app —
not a standalone HTML mockup. Read `apps/web/src/*` fully first: every view, every `.css`
file, `styles.css`, `AppHeader.tsx/css`, the manifest/sw.js. Lift what's reusable, replace
what's generic-looking.

## Surface declaration (commit to this before touching any token)

This app has THREE surface modes across its screens, not one — name the primary per screen
and design accordingly, don't average them into mush:

- **Operate** (primary, most screens): TruppDashboard, TruppDetail (Teilnehmerliste,
  Rollen-Zuweisung, Checkliste, Kalender/Ressourcenbuchung). Dense, action-first, no hero,
  no marketing framing. The admin is getting things done, not being sold to.
- **Configure**: Login, Join/Beitreten (Name+FF+Passwort or Anmelden tabs). Progressive,
  low-decoration, clear validation/error states.
- **Decide/Learn**: the Stationen overview + per-station deep-dive (step-through, Fehlerpunkte
  checklist, flashcards). This is the one place a bit more visual/editorial treatment earns
  its keep — people are learning a procedure, not administering data. Still no fake stats or
  filler.

## 1. Color system

Base it on Feuerwehr-Rot as the single accent (this is explicitly a fire-brigade context —
a red accent is a pinned-brief override of the "avoid generic tech hues" default, not a
cliché here, it's literally correct for the domain). Daniel has used `#fe1e34` as the
Feuerwehr-Rot reference elsewhere in his own work — use that as the anchor, refine into a
small oklch-based scale around it if it needs tonal variants (hover/active/subtle
background) rather than inventing a second accent.

- Define: `--ink` (near-black, not pure #000), `--surface`/`--surface-raised`,
  `--muted` (secondary text, must be a TINTED gray from the accent hue, not neutral gray),
  `--border`, `--accent` (`#fe1e34` family), `--accent-ink` (text-on-accent), `--danger`
  (can reuse accent-adjacent or a distinct red-orange — check it's still distinguishable from
  the brand accent at a glance), `--success` (a real green, not accent-tinted).
- Dark-mode-first or light-mode-first — pick by use scene (rule: light vs dark chosen by
  scene, not by category default). This is used standing in a Feuerwehrhaus or outdoors,
  sometimes at night during training — consider whether a dark UI reduces glare/improves
  battery on a phone screen in the dark, and whether the red accent reads better on dark.
  Your call, but state the reasoning.
- Check contrast: body text ≥ 4.5:1, large text ≥ 3:1, including secondary/muted text on any
  colored surface (role badges, accent buttons, the checklist "ok" state, etc).
- Replace ANY ad-hoc hex values currently scattered across the per-view `.css` files with
  these CSS custom properties, defined once (e.g. in `styles.css` or a new `tokens.css`).

## 2. Typography

Currently using default/system fonts — replace with a deliberate choice from Fontshare
(https://www.fontshare.com, free, self-hostable). Verify the exact family name/weights
available on Fontshare before wiring the `<link>` (don't guess a slug that doesn't exist).
Suggested direction, adjust if a better real pairing exists on Fontshare:
- **UI/body**: a clean geometric-humanist sans built for software — General Sans or Switzer
  are good candidates, used for everything (nav, labels, body, buttons).
- **Numerics/timers**: use `font-variant-numeric: tabular-nums` for all countdowns, Soll-
  Zeiten, Fehlerpunkte values, step counters ("Schritt 3 von 10") — these appear a lot in
  this app and must align in a monospaced-numeral style without necessarily switching the
  whole family to mono. Only reach for an actual mono family if there's a real "data/code"
  moment that needs it (there probably isn't one here — skip a mono family unless you find a
  genuine use).
- One `<link>` per family (Fontshare's combined `f[]=a&f[]=b` URL silently drops families).
  Self-host the woff2 files in the repo (`apps/web/public/fonts/` or similar) rather than
  relying on Fontshare's CDN at runtime, since this is a PWA that should work with a flaky
  connection — load via `@font-face` with `font-display: swap`.
- Body measure stays readable (don't need 65-75ch on a mobile-first admin app, but avoid
  edge-to-edge unbroken text blocks). Balanced headings where there are any
  (`text-wrap: balance`/`pretty`). No default Inter/system-ui left anywhere.

## 3. Icons

Replace ANY emoji or Unicode glyph currently used as an icon (checkmarks, arrows, etc. —
grep for them) with real inlined SVG icons from one consistent library, one stroke weight:
Lucide via Iconify (`curl https://api.iconify.design/lucide/<name>.svg`). Use for: role
badges/indicators, checklist checkmarks, nav/back arrows, calendar icons, flashcard
flip/shuffle controls, copy-to-clipboard button, step-through prev/next, install/push
notification prompts. Keep the icon set small and consistent — same stroke width and size
scale throughout.

## 4. Anti-slop — explicitly avoid in this pass

- No eyebrow/kicker labels above headings.
- No icon-topper cards (rounded-square icon centered above a heading) for the role/
  Teilnehmer list or anything else — use real layout hierarchy instead.
- No left-border accent-rail cards.
- No glassmorphism/blur as decoration.
- No gradient text, no gradient backgrounds slapped on for texture.
- No fake/decorative stats anywhere (this app has REAL numbers already — Fehlerpunkte,
  Soll-Zeiten, "x/4 Rollen besetzt" — surface those properly instead of inventing more).
- The TruppDashboard is an Operate surface: do not give it a hero + cards layout.

## 5. Components to specifically re-pass (read each file, then redesign in place)

- `AppHeader` — the shell every screen sits in. Get this right first, it sets the tone.
- `TruppDashboard` (Trupp-Liste after the rename) — dense list/table feel, not marketing
  cards. Show Rollen-Besetzung and Prüfungstermin-Countdown as real inline data, not stat
  tiles.
- `TruppDetail` — Teilnehmerliste with role dropdown, Checkliste ampel-status, invite-link/QR
  box, "Person hinzufügen" form + one-time password reveal.
- Login / Join (tabs: Neu beitreten / Anmelden) — Configure surface, progressive, clear
  validation states (error, loading, success).
- `Stations` overview grid + the per-station deep-dive (step-through, Fehlerpunkte
  checklist, flashcards on Geräteversorgung) — this is the Decide/Learn surface, can carry a
  bit more visual confidence (larger type for the active step, a clear progress indicator)
  without turning into a marketing page.
- `Calendar` — Fixtermine vs. Individualübungen need a clear, non-decorative visual
  distinction (not just a color swatch — consider a label/pattern too for colorblind
  accessibility), Ressourcen-Konflikt warning needs to read as a warning without being
  alarmist (it's informational, not blocking).

## 6. Motion

Keep it CSS-only (no new JS animation library/dependency — this app deliberately has zero
extra deps beyond what v1 already pulled in). The step-through and flashcard flip animations
already exist from the stations work — review and tighten them against the "discipline, not
theater" rule: exponential ease-out, content usable if animation is skipped,
`prefers-reduced-motion` already respected per the last build (verify it still is after this
pass). Don't add new animation beyond polishing what's there — this is a utility app used
mid-training, not a showcase.

## 7. Mobile-first, same bar as before

44px minimum touch targets, no horizontal scroll at 390px, test real content (German copy,
which runs longer than English) at both 390px and a desktop width (1440px) — this app is
used primarily on a phone in a Feuerwehrhaus or outdoors.

## Process (per claude-design skill, repo-implementation mode)

1. Read every current view + its CSS fully before changing anything — don't design from
   memory/vibes.
2. State the color choice (dark vs light, accent scale) and typography choice (exact
   Fontshare families, verified to exist) in ONE short paragraph before touching code —
   this is the "commit before tokens" step.
3. Define the tokens once (CSS custom properties), then apply them across every view's CSS,
   removing ad-hoc values as you go.
4. Build fully, then do ONE batched screenshot verification pass: desktop 1440x900 and
   mobile 390x844, covering TruppDashboard (or equivalent post-rename name), TruppDetail,
   Login/Join, Stations overview, one station deep-dive mid-step-through, one flashcard, and
   Calendar. Fix everything found in that one pass, don't loop indefinitely.
5. Run the slop self-audit from the design skill (score the 10 tells, fix what fired,
   re-score) before calling it done.

## Quality bar

- `npm run typecheck` and `npm run build` succeed cleanly in all three workspaces.
- Update `README.md`'s Design decisions section with the color/type choices and why.
- Delete this file (`CHANGE-design-system.md`) once implemented.
- Commit with clear, incremental messages (e.g. "tokens", "typography", "icons", "per-view
  repass", "screenshot fixes") rather than one giant commit — push to origin main when fully
  done and verified.
- Work autonomously end to end without asking questions. Where this spec leaves something
  open (exact Fontshare family, dark vs light call, icon choices), make the call yourself and
  record it in the README's Design decisions section with the reasoning.
