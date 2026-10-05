import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * One-time data migration from the Gruppe era: gruppen.json → trupps.json and
 * `gruppeId` → `truppId` on Teilnehmer, Ressourcen and Termine. Idempotent; runs
 * synchronously at startup before the first collection is loaded.
 */
export function migrateGruppeToTrupp(dataDir: string): void {
  const oldFile = path.join(dataDir, 'gruppen.json');
  const newFile = path.join(dataDir, 'trupps.json');
  if (existsSync(oldFile) && !existsSync(newFile)) {
    renameSync(oldFile, newFile);
    console.log('[migrate] gruppen.json → trupps.json');
  }

  for (const name of ['teilnehmer', 'ressourcen', 'termine']) {
    const file = path.join(dataDir, `${name}.json`);
    if (!existsSync(file)) continue;
    const items = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>[];
    let changed = 0;
    for (const item of items) {
      if ('gruppeId' in item && !('truppId' in item)) {
        item.truppId = item.gruppeId;
        delete item.gruppeId;
        changed++;
      }
    }
    if (changed === 0) continue;
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
    renameSync(tmp, file);
    console.log(`[migrate] ${name}.json: gruppeId → truppId (${changed})`);
  }
}

/**
 * One-time data migration to the shared calendar: Termine and Ressourcen used to belong
 * to one Trupp and now belong to the whole instance, so their `truppId` is dropped.
 * Idempotent; runs synchronously at startup after migrateGruppeToTrupp.
 */
export function migrateSharedCalendar(dataDir: string): void {
  for (const name of ['ressourcen', 'termine']) {
    const file = path.join(dataDir, `${name}.json`);
    if (!existsSync(file)) continue;
    const items = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>[];
    let changed = 0;
    for (const item of items) {
      if ('truppId' in item || 'gruppeId' in item) {
        delete item.truppId;
        delete item.gruppeId;
        changed++;
      }
    }
    if (changed === 0) continue;
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
    renameSync(tmp, file);
    console.log(`[migrate] ${name}.json: truppId entfernt — Kalender ist jetzt instanzweit (${changed})`);
  }
}

// ---------------------------------------------------------------------------
// Unified accounts (Ausbildungsleiter + Teilnehmer → Benutzer with systemRolle)
// ---------------------------------------------------------------------------

/** Kept in sync with nameKey() in lib/benutzer.ts (not imported: migrations stay self-contained). */
const loginKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');

function readArray(file: string): Record<string, unknown>[] {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>[]) : [];
}

function writeArray(file: string, items: unknown[]): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
  renameSync(tmp, file);
}

/** Moves a migrated source file aside (never deleted — it doubles as a backup). */
function retire(file: string): void {
  let target = `${file}.migriert`;
  if (existsSync(target)) target = `${file}.migriert-${Date.now()}`;
  renameSync(file, target);
  console.log(`[migrate] ${path.basename(file)} → ${path.basename(target)} (Sicherung, wird nicht mehr gelesen)`);
}

const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v : fallback);
/** Same normalisation as nameSchema: trimmed, inner whitespace collapsed. */
const cleanName = (v: unknown, fallback: string): string => str(v, fallback).trim().replace(/\s+/g, ' ');

/**
 * One-time migration to one account type: ausbildungsleiter.json and teilnehmer.json are
 * merged into benutzer.json. Ids are kept, so Termine, Ergebnisse, push subscriptions and
 * already issued tokens keep pointing at the same person.
 *
 * - Ausbildungsleiter → systemRolle 'ausbilder', password hash kept. Its login name is its
 *   former e-mail address (so it signs in exactly as before, just in the "Name" field).
 * - Teilnehmer → systemRolle 'teilnehmer', Trupp membership, APAS-Rolle, Checkliste, FF and
 *   password hash (if any) kept.
 * - Login names must now be unique instance-wide (case-insensitive). Collisions are
 *   resolved deterministically: Leiter first (by createdAt, id), then Teilnehmer (by
 *   joinedAt, id); the first keeps the name, later ones become "Name (Truppname)", then
 *   "Name (Truppname) 2", … Every rename is logged.
 * - Push subscription owners 'leiter' / 'teilnehmer' become 'benutzer'.
 *
 * Idempotent: records already in benutzer.json (by id) are skipped, and the source files
 * are renamed to *.migriert afterwards so a later run (or a deleted account) is never re-imported.
 */
export function migrateBenutzer(dataDir: string): void {
  const benutzerFile = path.join(dataDir, 'benutzer.json');
  const leiterFile = path.join(dataDir, 'ausbildungsleiter.json');
  const teilnehmerFile = path.join(dataDir, 'teilnehmer.json');

  if (existsSync(leiterFile) || existsSync(teilnehmerFile)) {
    const benutzer = readArray(benutzerFile);
    const ids = new Set(benutzer.map((b) => String(b.id)));
    const taken = new Set(benutzer.map((b) => loginKey(String(b.name))));
    const truppName = new Map(
      readArray(path.join(dataDir, 'trupps.json')).map((t) => [String(t.id), String(t.name)]),
    );
    const byDateThenId = (field: string) => (a: Record<string, unknown>, b: Record<string, unknown>) =>
      String(a[field] ?? '').localeCompare(String(b[field] ?? '')) || String(a.id).localeCompare(String(b.id));

    const uniqueName = (wanted: string, suffix: string | null): string => {
      const candidates = [wanted];
      if (suffix) candidates.push(`${wanted} (${suffix})`);
      let name = candidates.find((c) => !taken.has(loginKey(c)));
      const base = candidates[candidates.length - 1];
      for (let n = 2; !name; n++) if (!taken.has(loginKey(`${base} ${n}`))) name = `${base} ${n}`;
      taken.add(loginKey(name));
      if (name !== wanted) console.log(`[migrate] Anmeldename „${wanted}" doppelt → „${name}"`);
      return name;
    };

    const emptyCheckliste = { at: 'offen', ats3: 'offen', tauglichkeit: 'offen' };
    let added = 0;

    for (const l of readArray(leiterFile).sort(byDateThenId('createdAt'))) {
      if (ids.has(String(l.id))) continue;
      const createdAt = str(l.createdAt, new Date().toISOString());
      benutzer.push({
        id: l.id,
        name: uniqueName(cleanName(l.email, `Ausbilder ${String(l.id).slice(0, 8)}`), null),
        ...(typeof l.passwordHash === 'string' ? { passwordHash: l.passwordHash } : {}),
        systemRolle: 'ausbilder',
        ff: null,
        truppId: null,
        rolle: null,
        checkliste: { ...emptyCheckliste },
        createdAt,
        joinedAt: null,
      });
      ids.add(String(l.id));
      added++;
    }

    for (const t of readArray(teilnehmerFile).sort(byDateThenId('joinedAt'))) {
      if (ids.has(String(t.id))) continue;
      const truppId = typeof t.truppId === 'string' ? t.truppId : null;
      const joinedAt = str(t.joinedAt, new Date().toISOString());
      benutzer.push({
        id: t.id,
        name: uniqueName(cleanName(t.name, `Teilnehmer ${String(t.id).slice(0, 8)}`), truppId ? (truppName.get(truppId) ?? 'Trupp') : null),
        ...(typeof t.passwordHash === 'string' ? { passwordHash: t.passwordHash } : {}),
        // Magic-link era address, if any — migrateEmail validates and keeps it.
        ...(typeof t.email === 'string' ? { email: t.email } : {}),
        systemRolle: 'teilnehmer',
        ff: typeof t.ff === 'string' && t.ff.trim() ? t.ff : null,
        truppId,
        rolle: truppId && typeof t.rolle === 'string' ? t.rolle : null,
        checkliste: { ...emptyCheckliste, ...((t.checkliste as object | undefined) ?? {}) },
        createdAt: joinedAt,
        joinedAt: truppId ? joinedAt : null,
      });
      ids.add(String(t.id));
      added++;
    }

    writeArray(benutzerFile, benutzer);
    console.log(`[migrate] benutzer.json: ${added} Konto/Konten aus Ausbildungsleiter/Teilnehmer übernommen`);
    if (existsSync(leiterFile)) retire(leiterFile);
    if (existsSync(teilnehmerFile)) retire(teilnehmerFile);
  }

  const pushFile = path.join(dataDir, 'pushsubscriptions.json');
  if (existsSync(pushFile)) {
    const subs = readArray(pushFile);
    let changed = 0;
    for (const s of subs) {
      const owner = s.owner as { kind?: unknown; id?: unknown } | undefined;
      if (owner && owner.kind !== 'benutzer') {
        s.owner = { kind: 'benutzer', id: owner.id };
        changed++;
      }
    }
    if (changed) {
      writeArray(pushFile, subs);
      console.log(`[migrate] pushsubscriptions.json: Besitzer → benutzer (${changed})`);
    }
  }
}

/**
 * Trupp-Identität: every Trupp gets an explicit `icon: null` ("not chosen yet") if the field
 * is missing. Purely additive — existing icons and every other field stay untouched.
 * Idempotent: once every record has the key, nothing is written. (Reads normalise via
 * truppIconOf() in serialize.ts anyway; this just keeps trupps.json self-describing.)
 */
export function migrateTruppIcon(dataDir: string): void {
  const file = path.join(dataDir, 'trupps.json');
  if (!existsSync(file)) return;
  const trupps = readArray(file);
  let changed = 0;
  for (const t of trupps) {
    if (!('icon' in t)) {
      t.icon = null;
      changed++;
    }
  }
  if (changed === 0) return;
  writeArray(file, trupps);
  console.log(`[migrate] trupps.json: icon: null ergänzt (${changed})`);
}

/**
 * RSVP on Fixtermine: every Termin gets `anwesendIds: []` if it has none (non-array values
 * are reset to []). Additive only; idempotent.
 */
export function migrateAnwesend(dataDir: string): void {
  const file = path.join(dataDir, 'termine.json');
  if (!existsSync(file)) return;
  const items = readArray(file);
  let changed = 0;
  for (const item of items) {
    if (!Array.isArray(item.anwesendIds)) {
      item.anwesendIds = [];
      changed++;
    }
  }
  if (changed === 0) return;
  writeArray(file, items);
  console.log(`[migrate] termine.json: anwesendIds ergänzt (${changed})`);
}

// ---------------------------------------------------------------------------
// Login via e-mail address (name → email as login identifier)
// ---------------------------------------------------------------------------

/** Kept in sync with PLACEHOLDER_EMAIL_DOMAIN in @apas/shared (not imported: migrations stay self-contained). */
const PLATZHALTER_DOMAIN = 'ohne-email.lokal';
/** Deliberately simple plausibility check — the strict zod check guards all new input. */
const looksLikeEmail = (v: string): boolean => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const asEmail = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return looksLikeEmail(e) ? e : null;
};

/**
 * Every account gets an `email` (the new login identifier), unique instance-wide, stored
 * lowercase. Per record:
 *
 * 1. An existing plausible `email` (e.g. left over from the magic-link era) is kept, only
 *    normalised (trimmed, lowercase).
 * 2. Otherwise an Ausbilder whose `name` is an e-mail address — migrateBenutzer set the former
 *    Ausbildungsleiter's name to their e-mail — gets that address. `name` stays unchanged.
 * 3. Otherwise a placeholder `<id>@ohne-email.lokal`: obviously not deliverable, flagged in
 *    the Benutzerverwaltung so an Ausbilder can enter the real address.
 *
 * Ausbilder are processed first (they sign in with that address today); an address already
 * used by an earlier record gets a placeholder instead (logged). Purely
 * additive apart from the lowercase normalisation; idempotent (nothing is written once every
 * record has a unique normalised address). Never throws on odd records.
 */
export function migrateEmail(dataDir: string): void {
  const file = path.join(dataDir, 'benutzer.json');
  if (!existsSync(file)) return;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[migrate] benutzer.json nicht lesbar — E-Mail-Migration übersprungen: ${(err as Error).message}`);
    return;
  }
  if (!Array.isArray(raw)) return;

  const taken = new Set<string>();
  let normalisiert = 0;
  let ausName = 0;
  let platzhalter = 0;
  let changed = false;

  const records = raw.map((item: unknown, i: number) => ({ item, i }));
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const rank = (v: unknown) => (isObj(v) && v.systemRolle === 'ausbilder' ? 0 : 1);
  // Ausbilder first: they sign in with that address today, so they win a collision.
  records.sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i);

  for (const { item, i } of records) {
    if (!isObj(item)) continue;
    const b = item;
    const id = typeof b.id === 'string' && b.id ? b.id : `konto-${i}`;
    const label = `„${typeof b.name === 'string' ? b.name : id}"`;

    const vorhanden = asEmail(b.email);
    const ausAusbilderName = !vorhanden && b.systemRolle === 'ausbilder' ? asEmail(b.name) : null;
    const wanted = vorhanden ?? ausAusbilderName;

    let email: string;
    if (wanted && !taken.has(wanted)) {
      email = wanted;
      if (vorhanden) {
        if (b.email !== vorhanden) normalisiert++;
      } else {
        ausName++;
      }
    } else {
      email = `${id}@${PLATZHALTER_DOMAIN}`;
      if (wanted) console.log(`[migrate] E-Mail „${wanted}" doppelt → Konto ${label} bekommt Platzhalter ${email}`);
      if (taken.has(email)) email = `${id}-${i}@${PLATZHALTER_DOMAIN}`; // duplicate ids — shouldn't exist
      platzhalter++;
    }
    taken.add(email);
    if (b.email !== email) {
      b.email = email;
      changed = true;
    }
  }

  if (!changed) return;
  writeArray(file, raw);
  console.log(
    `[migrate] benutzer.json: email ergänzt — ${ausName} aus bestehender Adresse, ` +
      `${platzhalter} Platzhalter (…@${PLATZHALTER_DOMAIN})` +
      (normalisiert ? `, ${normalisiert} vorhandene Adresse(n) kleingeschrieben` : ''),
  );
}

/**
 * Trainingspräferenz: every account gets `trainingspraeferenz: []` ("no preference set" — not
 * "every day") if the field is missing or not an array. Additive only; existing values and
 * every other field stay untouched. Idempotent. (Reads normalise via trainingspraeferenzOf()
 * in serialize.ts anyway.)
 */
export function migrateTrainingspraeferenz(dataDir: string): void {
  const file = path.join(dataDir, 'benutzer.json');
  if (!existsSync(file)) return;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[migrate] benutzer.json nicht lesbar — Trainingspräferenz-Migration übersprungen: ${(err as Error).message}`);
    return;
  }
  if (!Array.isArray(raw)) return;
  let changed = 0;
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const b = item as Record<string, unknown>;
    if (!Array.isArray(b.trainingspraeferenz)) {
      b.trainingspraeferenz = [];
      changed++;
    }
  }
  if (changed === 0) return;
  writeArray(file, raw);
  console.log(`[migrate] benutzer.json: trainingspraeferenz: [] ergänzt (${changed})`);
}

/** Every migration, in order. Run before the first collection is read (API start, seed script). */
export function runMigrations(dataDir: string): void {
  if (!existsSync(dataDir)) return;
  migrateGruppeToTrupp(dataDir);
  migrateSharedCalendar(dataDir);
  migrateBenutzer(dataDir);
  migrateEmail(dataDir);
  migrateTruppIcon(dataDir);
  migrateAnwesend(dataDir);
  migrateTrainingspraeferenz(dataDir);
}
