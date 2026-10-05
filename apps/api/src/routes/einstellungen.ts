import { WAPPEN_MAX_BYTES, type WappenContentType } from '@apas/shared';
import express, { Router, type RequestHandler } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { db, EINSTELLUNGEN_ID, type EinstellungenRecord } from '../db.js';
import { requireAusbilder } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { toEinstellungen } from '../serialize.js';

/**
 * Mounted at /api/einstellungen. Instance branding (führende Feuerwehr + Wappen). Reading is
 * public because it is shown before login; changing is Ausbilder-only.
 *
 * The Wappen is uploaded as the raw request body (no multipart, no extra dependency) and
 * stored as DATA_DIR/wappen-<timestamp>.<ext>. The type is decided by sniffing the bytes,
 * never by the client's Content-Type.
 */
export const einstellungenRouter = Router();

const leer = (): EinstellungenRecord => ({ id: EINSTELLUNGEN_ID, fuehrendeFeuerwehr: null, wappen: null });
const laden = async () => db.einstellungen.get(EINSTELLUNGEN_ID);

/** Read-modify-write of the single settings record, inside the collection lock. */
function speichern<R>(fn: (e: EinstellungenRecord) => Promise<R> | R): Promise<R> {
  return db.einstellungen.update(async (items) => {
    const e = items.find((x) => x.id === EINSTELLUNGEN_ID) ?? leer();
    const result = await fn(e);
    return { items: [...items.filter((x) => x.id !== EINSTELLUNGEN_ID), e], result };
  });
}

einstellungenRouter.get('/', async (_req, res) => {
  res.json(toEinstellungen(await laden()));
});

const updateSchema = z.object({
  fuehrendeFeuerwehr: z
    .string()
    .trim()
    .max(120, 'Höchstens 120 Zeichen')
    .nullable()
    .transform((v) => v || null),
});

einstellungenRouter.put('/', requireAusbilder, async (req, res) => {
  const { fuehrendeFeuerwehr } = parseBody(updateSchema, req);
  const e = await speichern((e) => {
    e.fuehrendeFeuerwehr = fuehrendeFeuerwehr;
    return e;
  });
  res.json(toEinstellungen(e));
});

// ---------------------------------------------------------------- Wappen

const EXT: Record<WappenContentType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const UNGUELTIG = 'Nur PNG-, JPG-, WebP- oder SVG-Bilder sind als Wappen erlaubt';

/** Decides the image type from the content itself. */
export function sniffWappen(buf: Buffer): WappenContentType | null {
  const startsWith = (bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return isSvg(buf) ? 'image/svg+xml' : null;
}

function isSvg(buf: Buffer): boolean {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return false; // not valid UTF-8 → not an SVG we accept
  }
  if (text.includes('\u0000')) return false;
  // Entity declarations are never needed for a crest and enable entity-expansion tricks.
  if (/<!ENTITY/i.test(text)) return false;
  // Optional BOM, XML declaration, comments, processing instructions and an SVG doctype,
  // then the root element must be <svg …>.
  const prolog = /^﻿?\s*(?:<\?xml[^>]*\?>\s*)?(?:(?:<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE\s+svg[^>]*>)\s*)*<svg[\s>/]/i;
  return prolog.test(text) && /<\/svg\s*>/i.test(text);
}

/** Accepts any Content-Type (we sniff ourselves) up to WAPPEN_MAX_BYTES. */
const rawBody = express.raw({ type: () => true, limit: WAPPEN_MAX_BYTES });
const wappenBody: RequestHandler = (req, res, next) => {
  rawBody(req, res, (err?: unknown) => {
    if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
      next(new HttpError(413, 'Das Wappen darf höchstens 2 MB groß sein'));
    } else {
      next(err);
    }
  });
};

const dateiPfad = (datei: string) => path.join(config.dataDir, datei);

async function entferneDatei(datei: string | undefined) {
  if (!datei) return;
  await fs.rm(dateiPfad(datei), { force: true }).catch((err) => console.warn(`[wappen] ${datei}: ${err}`));
}

/** Body: the image bytes (Content-Type e.g. image/png — informational only). */
einstellungenRouter.put('/wappen', requireAusbilder, wappenBody, async (req, res) => {
  const buf: unknown = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new HttpError(400, 'Keine Bilddatei empfangen');
  const contentType = sniffWappen(buf);
  if (!contentType) throw new HttpError(415, UNGUELTIG);

  const jetzt = new Date();
  const datei = `wappen-${jetzt.getTime()}.${EXT[contentType]}`;
  let alt: string | undefined;
  const e = await speichern(async (e) => {
    // Write the new file first (atomically), then point the record at it.
    await fs.mkdir(config.dataDir, { recursive: true });
    const tmp = `${dateiPfad(datei)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, dateiPfad(datei));
    alt = e.wappen?.datei;
    e.wappen = { datei, contentType, aktualisiertAm: jetzt.toISOString() };
    return e;
  });
  if (alt !== datei) await entferneDatei(alt);
  res.json(toEinstellungen(e));
});

einstellungenRouter.delete('/wappen', requireAusbilder, async (_req, res) => {
  let alt: string | undefined;
  const e = await speichern((e) => {
    alt = e.wappen?.datei;
    e.wappen = null;
    return e;
  });
  await entferneDatei(alt);
  res.json(toEinstellungen(e));
});

/**
 * Public. `?v=` (from Einstellungen.wappen.pfad) matching the current version → cached for a
 * year; anything else → revalidate. SVGs get a CSP that forbids scripts, so opening the
 * image URL directly can't run code from an uploaded file.
 */
einstellungenRouter.get('/wappen', async (req, res) => {
  const w = (await laden())?.wappen;
  if (!w) throw new HttpError(404, 'Kein Wappen hinterlegt');
  let data: Buffer;
  try {
    data = await fs.readFile(dateiPfad(w.datei));
  } catch {
    throw new HttpError(404, 'Kein Wappen hinterlegt');
  }
  const version = String(new Date(w.aktualisiertAm).getTime());
  res.setHeader('Content-Type', w.contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', req.query.v === version ? 'public, max-age=31536000, immutable' : 'no-cache');
  if (w.contentType === 'image/svg+xml') {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  }
  res.send(data);
});
