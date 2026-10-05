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

/** Every migration, in order. Run before the first collection is read (API start, seed script). */
export function runMigrations(dataDir: string): void {
  if (!existsSync(dataDir)) return;
  migrateGruppeToTrupp(dataDir);
  migrateSharedCalendar(dataDir);
  migrateBenutzer(dataDir);
}
