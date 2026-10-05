/**
 * Creates an Ausbilder account, or resets the password of an existing account with that
 * login e-mail address and makes it Ausbilder (e.g. to recover from a lost password).
 *
 *   npm run seed-admin                                                    # interactive prompts
 *   ADMIN_EMAIL=max@ff-x.at ADMIN_PASSWORD=... npm run seed-admin            # non-interactive
 *   ADMIN_EMAIL=max@ff-x.at ADMIN_NAME="Max Muster" ADMIN_PASSWORD=... npm run seed-admin
 *
 * ADMIN_EMAIL is the login. ADMIN_NAME is the display name, only used when the account is
 * created (an existing account keeps its name); it defaults to the address's local part.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config } from '../config.js';
import { db } from '../db.js';
import { emailSchema, findByEmail, nameSchema, newBenutzerRecord } from '../lib/benutzer.js';
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

  let rawEmail = process.env.ADMIN_EMAIL ?? '';
  let password = process.env.ADMIN_PASSWORD ?? '';

  if (!rawEmail) {
    const rl = createInterface({ input: stdin, output: stdout });
    rawEmail = await rl.question('E-Mail-Adresse (Login) des Ausbilders: ');
    rl.close();
  }
  const parsedEmail = emailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    throw new Error(`Ungültige E-Mail-Adresse: "${rawEmail}" (${parsedEmail.error.issues[0]?.message ?? 'ungültig'})`);
  }
  const email = parsedEmail.data;

  // Display name: ADMIN_NAME, else the local part of the address (padded if too short).
  const rawName = process.env.ADMIN_NAME?.trim() || email.split('@')[0]!;
  const parsedName = nameSchema.safeParse(rawName.length >= 2 ? rawName : `Ausbilder ${rawName}`);
  if (!parsedName.success) throw new Error(`Ungültiger Name: "${rawName}" (2–100 Zeichen)`);
  const name = parsedName.data;

  if (!password) {
    password = await promptHidden('Passwort (min. 10 Zeichen): ');
    const repeat = await promptHidden('Passwort wiederholen: ');
    if (password !== repeat) throw new Error('Passwörter stimmen nicht überein');
  }
  if (password.length < 10) throw new Error('Passwort muss mindestens 10 Zeichen haben');
  if (password.length > 72) throw new Error('Passwort darf höchstens 72 Zeichen haben');

  const passwordHash = await hashPassword(password);
  const action = await db.benutzer.update((items) => {
    const existing = findByEmail(items, email);
    if (existing) {
      existing.passwordHash = passwordHash;
      const war = existing.systemRolle;
      existing.systemRolle = 'ausbilder';
      return { items, result: war === 'ausbilder' ? 'Passwort aktualisiert' : `Passwort aktualisiert, ${war} → Ausbilder` };
    }
    items.push(newBenutzerRecord({ email, name, ff: null, passwordHash, systemRolle: 'ausbilder' }));
    return { items, result: `Ausbilder-Konto „${name}" angelegt` };
  });

  console.log(`✔ ${action}: ${email} (Daten in ${config.dataDir})`);
}

main().catch((err) => {
  console.error(`✖ ${(err as Error).message}`);
  process.exit(1);
});
