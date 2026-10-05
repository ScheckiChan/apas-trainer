import bcrypt from 'bcryptjs';

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
