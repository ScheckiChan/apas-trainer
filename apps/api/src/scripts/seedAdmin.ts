/**
 * Creates an Ausbilder account, or resets the password of an existing account with that
 * name and makes it Ausbilder (e.g. to recover from a lost password).
 *
 *   npm run seed-admin                                        # interactive prompts
 *   ADMIN_NAME="Max Muster" ADMIN_PASSWORD=... npm run seed-admin   # non-interactive
 *
 * ADMIN_EMAIL is still accepted as an alias for ADMIN_NAME: Ausbildungsleiter accounts
 * from before the unified accounts log in with their former e-mail address as name.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config } from '../config.js';
import { db } from '../db.js';
import { findByName, nameSchema, newBenutzerRecord } from '../lib/benutzer.js';
import { hashPassword } from '../lib/password.js';
import { runMigrations } from '../migrate.js';

async function promptHidden(question: string): Promise<string> {
  // Minimal hidden input: mute echo while reading one line.
  if (!stdin.isTTY) {
    const rl = createInterface({ input: stdin, output: stdout });
    const v = await rl.question(question);
    rl.close();
    return v;
  }
  stdout.write(question);
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const origWrite = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  const v = await rl.question('');
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = origWrite;
  rl.close();
  stdout.write('\n');
  return v;
}

async function main() {
  // Bring legacy data (ausbildungsleiter.json / teilnehmer.json) into benutzer.json first,
  // so this script never writes next to unmigrated data.
  runMigrations(config.dataDir);

  let rawName = process.env.ADMIN_NAME ?? process.env.ADMIN_EMAIL ?? '';
  let password = process.env.ADMIN_PASSWORD ?? '';

  if (!rawName) {
    const rl = createInterface({ input: stdin, output: stdout });
    rawName = await rl.question('Anmeldename des Ausbilders: ');
    rl.close();
  }
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) throw new Error(`Ungültiger Name: "${rawName}" (2–100 Zeichen)`);
  const name = parsed.data;

  if (!password) {
    password = await promptHidden('Passwort (min. 10 Zeichen): ');
    const repeat = await promptHidden('Passwort wiederholen: ');
    if (password !== repeat) throw new Error('Passwörter stimmen nicht überein');
  }
  if (password.length < 10) throw new Error('Passwort muss mindestens 10 Zeichen haben');
  if (password.length > 72) throw new Error('Passwort darf höchstens 72 Zeichen haben');

  const passwordHash = await hashPassword(password);
  const action = await db.benutzer.update((items) => {
    const existing = findByName(items, name);
    if (existing) {
      existing.passwordHash = passwordHash;
      const war = existing.systemRolle;
      existing.systemRolle = 'ausbilder';
      return { items, result: war === 'ausbilder' ? 'Passwort aktualisiert' : `Passwort aktualisiert, ${war} → Ausbilder` };
    }
    items.push(newBenutzerRecord({ name, ff: null, passwordHash, systemRolle: 'ausbilder' }));
    return { items, result: 'Ausbilder-Konto angelegt' };
  });

  console.log(`✔ ${action}: ${name} (Daten in ${config.dataDir})`);
}

main().catch((err) => {
  console.error(`✖ ${(err as Error).message}`);
  process.exit(1);
});
