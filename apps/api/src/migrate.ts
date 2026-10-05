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
