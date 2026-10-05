import {
  isStationId,
  rangliste,
  STATION_WERTUNG,
  stationBestanden,
  type RanglistenEintrag,
  type TeilErgebnis,
} from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type ErgebnisRecord } from '../db.js';
import { loadTruppForPrincipal, requireAny, requireLeiter } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { toErgebnis } from '../serialize.js';

/** Mounted at /api/trupps/:truppId/ergebnisse */
export const ergebnisseRouter = Router({ mergeParams: true });

const sekunden = z.number().int().min(0).max(24 * 3600);
const punkte = z.number().int().min(0).max(999);

const ergebnisSchema = z.object({
  zeitSekunden: sekunden,
  fehlerpunkte: punkte,
  teile: z.array(z.object({ zeitSekunden: sekunden, fehlerpunkte: punkte })).max(4).optional(),
});

ergebnisseRouter.get('/', requireAny, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const list = await db.ergebnisse.find((e) => e.truppId === trupp.id);
  res.json(list.map(toErgebnis));
});

/**
 * Records the latest result of a station run (overwrites the previous one — no history).
 * Owning Ausbildungsleiter only: loadTruppForPrincipal 404s for any other Leiter.
 */
ergebnisseRouter.put('/:stationId', requireLeiter, async (req, res) => {
  const trupp = await loadTruppForPrincipal(req);
  const stationId = String(req.params.stationId);
  if (!isStationId(stationId)) throw new HttpError(404, 'Station nicht gefunden');
  const input = parseBody(ergebnisSchema, req);

  const wertung = STATION_WERTUNG[stationId];
  let teile: TeilErgebnis[];
  if (input.teile) {
    if (input.teile.length !== wertung.teile.length) {
      throw new HttpError(400, `Station ${wertung.titel} hat ${wertung.teile.length} Teil(e)`);
    }
    const sum = (k: keyof TeilErgebnis) => input.teile!.reduce((s, t) => s + t[k], 0);
    if (sum('zeitSekunden') !== input.zeitSekunden || sum('fehlerpunkte') !== input.fehlerpunkte) {
      throw new HttpError(400, 'Die Teile ergeben nicht die Gesamtwerte');
    }
    teile = input.teile;
  } else {
    if (wertung.teile.length > 1) {
      throw new HttpError(400, `Für ${wertung.titel} sind die Werte je Teil erforderlich`);
    }
    teile = [{ zeitSekunden: input.zeitSekunden, fehlerpunkte: input.fehlerpunkte }];
  }

  const rec: ErgebnisRecord = {
    id: `${trupp.id}:${stationId}`,
    truppId: trupp.id,
    stationId,
    zeitSekunden: input.zeitSekunden,
    fehlerpunkte: input.fehlerpunkte,
    teile,
    bestanden: stationBestanden(stationId, teile.map((t) => t.fehlerpunkte)),
    aufgenommenAm: new Date().toISOString(),
    aufgenommenVon: req.leiter!.sub,
  };
  await db.ergebnisse.update((items) => ({ items: [...items.filter((e) => e.id !== rec.id), rec], result: rec }));
  res.json(toErgebnis(rec));
});

/**
 * Mounted at /api/rangliste. Every Trupp of this Ausbildung, visible to any signed-in
 * Ausbildungsleiter or Teilnehmer — the Rangliste is meant to be seen.
 */
export const ranglisteRouter = Router();

ranglisteRouter.get('/', requireAny, async (req, res) => {
  const [trupps, ergebnisse] = await Promise.all([db.trupps.all(), db.ergebnisse.all()]);
  const body: RanglistenEintrag[] = rangliste(
    trupps.map((t) => ({
      truppId: t.id,
      truppName: t.name,
      eigen: req.teilnehmer?.truppId === t.id,
      ergebnisse: ergebnisse.filter((e) => e.truppId === t.id).map(toErgebnis),
    })),
  );
  res.json(body);
});
