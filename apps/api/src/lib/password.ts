import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

/** Same cost for Ausbildungsleiter and Teilnehmer passwords. */
const BCRYPT_COST = 12;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_COST);

// Compared against when the account doesn't exist, so timing doesn't reveal which names/e-mails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-dummy-password', BCRYPT_COST);

/** Constant-ish time check; `hash` undefined = unknown account (always false). */
export async function verifyPassword(password: string, hash: string | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && hash !== undefined;
}

// No 0/O/o, 1/l/I — the temp password is read off a phone screen and typed in by hand.
const TEMP_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Readable random password for Teilnehmer added by the Ausbildungsleiter (11 chars ≈ 64 bit). */
export function generateTempPassword(length = 11): string {
  let out = '';
  for (let i = 0; i < length; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}
