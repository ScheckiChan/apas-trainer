/**
 * Creates (or resets the password of) an Ausbildungsleiter account.
 *
 *   npm run seed-admin                       # interactive prompts
 *   ADMIN_EMAIL=a@b.at ADMIN_PASSWORD=... npm run seed-admin   # non-interactive
 */
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { newId } from '../lib/ids.js';

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
  let email = process.env.ADMIN_EMAIL ?? '';
  let password = process.env.ADMIN_PASSWORD ?? '';

  if (!email) {
    const rl = createInterface({ input: stdin, output: stdout });
    email = await rl.question('E-Mail des Ausbildungsleiters: ');
    rl.close();
  }
  email = email.trim().toLowerCase();
  if (!z.email().safeParse(email).success) throw new Error(`Ungültige E-Mail: "${email}"`);

  if (!password) {
    password = await promptHidden('Passwort (min. 10 Zeichen): ');
    const repeat = await promptHidden('Passwort wiederholen: ');
    if (password !== repeat) throw new Error('Passwörter stimmen nicht überein');
  }
  if (password.length < 10) throw new Error('Passwort muss mindestens 10 Zeichen haben');

  const passwordHash = await bcrypt.hash(password, 12);
  const action = await db.leiter.update((items) => {
    const existing = items.find((l) => l.email === email);
    if (existing) {
      existing.passwordHash = passwordHash;
      return { items, result: 'Passwort aktualisiert' };
    }
    items.push({ id: newId(), email, passwordHash, createdAt: new Date().toISOString() });
    return { items, result: 'Konto angelegt' };
  });

  console.log(`✔ ${action}: ${email} (Daten in ${config.dataDir})`);
}

main().catch((err) => {
  console.error(`✖ ${(err as Error).message}`);
  process.exit(1);
});
