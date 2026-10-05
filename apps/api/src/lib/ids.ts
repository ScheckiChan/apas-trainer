import { randomBytes, randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** URL-safe random token (invite links). */
export const randomToken = (bytes = 24): string => randomBytes(bytes).toString('base64url');
