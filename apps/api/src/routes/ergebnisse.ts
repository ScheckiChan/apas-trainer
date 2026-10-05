import {
  isStationId,
  kannErgebnisSpeichern,
  STATION_WERTUNG,
  stationBestanden,
  stationsRanglisten,
  type StationRangliste,
  type TeilErgebnis,
} from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type ErgebnisRecord } from '../db.js';
import { loadTrupp, requireAuth } from '../lib/auth.js';
import { HttpError, parseBody } from '../lib/http.js';
import { toErgebnis, truppIconOf } from '../serialize.js';

/** Mounted at /api/trupps/:truppId/ergebnisse */
export const ergebnisseRouter = Router({ mergeParams: true });

const sekunden = z.number().int().min(0).max(24 * 3600);
const punkte = z.number().int().min(0).max(999);

const ergebnisSchema = z.object({
  zeitSekunden: sekunden,
  fehlerpunkte: punkte,
  teile: z.array(z.object({ zeitSekunden: sekunden, fehlerpunkte: punkte })).max(4).optional(),
});

/** Ausbilder, Prüfer and members of the Trupp (the station page shows the last saved run). */
ergebnisseRouter.get('/', requireAuth, async (req, res) => {
  const trupp = await loadTrupp(req, 'trupp');
  const list = await db.ergebnisse.find((e) => e.truppId === trupp.id);
  res.json(list.map(toErgebnis));
});

/**
 * Records the latest result of a station run (overwrites the previous one — no history).
 * Any signed-in account (gamification): Ausbilder and Prüfer for any Trupp, a Teilnehmer
 * only for their own Trupp (kannErgebnisSpeichern in shared).
 */
ergebnisseRouter.put('/:stationId', requireAuth, async (req, res) => {
  // Permission first, existence second: a Teilnehmer gets the same 403 for a foreign and
  // a nonexistent Trupp id, so this endpoint doesn't reveal which Trupp ids exist.
  const truppId = String(req.params.truppId);
  if (!kannErgebnisSpeichern(req.benutzer!, truppId)) {
    throw new HttpError(403, 'Als Teilnehmer kannst du Ergebnisse nur für deinen eigenen Trupp speichern');
  }
  const trupp = await db.trupps.get(truppId);
  if (!trupp) throw new HttpError(404, 'Trupp nicht gefunden');
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
    aufgenommenVon: req.benutzer!.id,
  };
  await db.ergebnisse.update((items) => ({ items: [...items.filter((e) => e.id !== rec.id), rec], result: rec }));
  res.json(toErgebnis(rec));
});

/**
 * Mounted at /api/rangliste. One leaderboard per station over every Trupp of this Ausbildung,
 * visible to any signed-in account — the Rangliste is meant to be seen.
 */
export const ranglisteRouter = Router();

ranglisteRouter.get('/', requireAuth, async (req, res) => {
  const [trupps, ergebnisse] = await Promise.all([db.trupps.all(), db.ergebnisse.all()]);
  const body: StationRangliste[] = stationsRanglisten(
    trupps.map((t) => ({
      truppId: t.id,
      truppName: t.name,
      truppIcon: truppIconOf(t),
      eigen: req.benutzer!.truppId === t.id,
      ergebnisse: ergebnisse.filter((e) => e.truppId === t.id).map(toErgebnis),
    })),
  );
  res.json(body);
});
