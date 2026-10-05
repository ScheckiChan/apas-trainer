import {
  ROLLEN,
  TRUPP_NAME_MAX,
  TRUPPSUCHE_MAX_PERSONEN,
  TRUPPSUCHE_MIN_PERSONEN,
  type Rolle,
  type TruppsuchePerson,
  type TruppsucheResponse,
} from '@apas/shared';
import { Router } from 'express';
import { z } from 'zod';
import { db, type BenutzerRecord, type TruppRecord } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { inTruppSetzen } from '../lib/beitreten.js';
import { HttpError, parseBody } from '../lib/http.js';
import { newTruppRecord } from '../lib/trupp.js';
import { meResponse } from './auth.js';

/*
 * Truppsuche — the second self-service path next to the Trupp-Wahl (joining an existing
 * Trupp): Teilnehmer without a Trupp set the APAS-Rolle they want to play
 * (gewuenschteRolle), see each other in a list and form a NEW Trupp from a selection.
 *
 * Who: systemRolle 'teilnehmer' without a Trupp — the same audience as the self-join
 * (POST /trupps/waehlbar/:truppId/beitreten). Ausbilder may read the list (helps them see
 * who is still waiting) but can't set a Wunschrolle or form a Trupp here — they have
 * POST /trupps + zuordnen. Prüfer: 403.
 *
 * Listed are only accounts that are systemRolle 'teilnehmer', have no Trupp and a
 * Wunschrolle set. Only id, name, FF and Wunschrolle are exposed — no Checkliste, no
 * e-mail (same privacy rule as GET /termine/personen).
 */

/** Mounted at /api/truppsuche */
export const truppsucheRouter = Router();

/** Mounted at /api/benutzer/me — BEFORE benutzerRouter (which is Ausbilder-only throughout). */
export const eigenesKontoRouter = Router();

const IN_TRUPP = 'Du bist bereits in einem Trupp — die Truppsuche ist nur für Personen ohne Trupp.';
const NUR_TEILNEHMER = 'Nur Teilnehmer ohne Trupp können die Truppsuche nutzen.';

const wartet = (b: BenutzerRecord): b is BenutzerRecord & { gewuenschteRolle: Rolle } =>
  b.systemRolle === 'teilnehmer' && b.truppId === null && !!b.gewuenschteRolle;

// ---------------------------------------------------------------- Own Wunschrolle

const gewuenschteRolleSchema = z.object({ gewuenschteRolle: z.enum(ROLLEN).nullable() }).strict();

/**
 * Sets (or with null clears) the caller's own Wunschrolle. Teilnehmer only (403), and only
 * while without a Trupp (409) — both checked against the stored record inside the lock.
 * Response: MeResponse.
 */
eigenesKontoRouter.patch('/gewuenschte-rolle', requireAuth, async (req, res) => {
  const { gewuenschteRolle } = parseBody(gewuenschteRolleSchema, req);
  const benutzer = await db.benutzer.update((items) => {
    const b = items.find((x) => x.id === req.benutzer!.id);
    if (!b) throw new HttpError(401, 'Sitzung abgelaufen oder ungültig — bitte neu anmelden');
    if (b.systemRolle !== 'teilnehmer') throw new HttpError(403, NUR_TEILNEHMER);
    if (b.truppId) {
      throw new HttpError(409, 'Du bist bereits in einem Trupp — deine Rolle legt ihr dort im Trupp fest.');
    }
    b.gewuenschteRolle = gewuenschteRolle;
    return { items, result: b };
  });
  res.json(await meResponse(benutzer));
});

// ---------------------------------------------------------------- List

/**
 * The OTHER waiting people (caller excluded), sorted by Wunschrolle in ROLLEN order, then
 * name. Teilnehmer without Trupp and Ausbilder; Teilnehmer in a Trupp 409, Prüfer 403.
 */
truppsucheRouter.get('/', requireAuth, async (req, res) => {
  const me = req.benutzer!;
  if (me.systemRolle === 'pruefer') throw new HttpError(403, NUR_TEILNEHMER);
  if (me.systemRolle === 'teilnehmer' && me.truppId) throw new HttpError(409, IN_TRUPP);

  const benutzer = await db.benutzer.all();
  const eigen = benutzer.find((b) => b.id === me.id);
  const personen: TruppsuchePerson[] = benutzer
    .filter(wartet)
    .filter((b) => b.id !== me.id)
    .sort(
      (a, b) =>
        ROLLEN.indexOf(a.gewuenschteRolle) - ROLLEN.indexOf(b.gewuenschteRolle) || a.name.localeCompare(b.name, 'de'),
    )
    .map((b) => ({ id: b.id, name: b.name, ff: b.ff, gewuenschteRolle: b.gewuenschteRolle }));

  const body: TruppsucheResponse = {
    eigeneGewuenschteRolle: eigen && !eigen.truppId ? (eigen.gewuenschteRolle ?? null) : null,
    personen,
  };
  res.json(body);
});

// ---------------------------------------------------------------- Form a new Trupp

const truppBildenSchema = z
  .object({
    benutzerIds: z
      .array(z.string().min(1).max(100))
      .min(TRUPPSUCHE_MIN_PERSONEN - 1, `Wähle mindestens ${TRUPPSUCHE_MIN_PERSONEN - 1} weitere Person aus`)
      .max(
        TRUPPSUCHE_MAX_PERSONEN - 1,
        `Höchstens ${TRUPPSUCHE_MAX_PERSONEN} Personen pro Trupp (du und ${TRUPPSUCHE_MAX_PERSONEN - 1} weitere)`,
      ),
  })
  .strict()
  .refine((x) => new Set(x.benutzerIds).size === x.benutzerIds.length, {
    message: 'Jede Person nur einmal auswählen',
    path: ['benutzerIds'],
  });

/**
 * "Trupp <FF des Initiators>" (or "Neuer Trupp" without FF), max TRUPP_NAME_MAX chars.
 * Names aren't unique by rule; we still append " 2", " 3", … against existing Trupps so
 * the Trupp-Wahl list stays readable. Members can rename via PATCH /trupps/:id/identitaet.
 */
function truppName(ff: string | null, vorhanden: readonly TruppRecord[]): string {
  const basis = ff ? `Trupp ${ff}` : 'Neuer Trupp';
  const key = (s: string) => s.trim().toLocaleLowerCase('de');
  const belegt = new Set(vorhanden.map((t) => key(t.name)));
  const kuerzen = (s: string, platz: number) => (s.length > platz ? s.slice(0, platz).trimEnd() : s);
  let name = kuerzen(basis, TRUPP_NAME_MAX);
  for (let n = 2; belegt.has(key(name)); n++) {
    const suffix = ` ${n}`;
    name = kuerzen(basis, TRUPP_NAME_MAX - suffix.length) + suffix;
  }
  return name;
}

/**
 * Creates a new Trupp (like an Ausbilder-created one without Prüfungstermin) and moves the
 * caller plus every selected person into it, each with rolle = own Wunschrolle (which is
 * then cleared). All-or-nothing: everything is re-validated inside the benutzer write lock,
 * so if anyone was grabbed / changed meanwhile the whole action fails with 409 and nothing
 * is written. Response 201: MeResponse (caller's view incl. the new Trupp).
 */
truppsucheRouter.post('/trupp', requireAuth, async (req, res) => {
  const { benutzerIds } = parseBody(truppBildenSchema, req);
  const meId = req.benutzer!.id;
  if (benutzerIds.includes(meId)) {
    throw new HttpError(400, 'Du gehörst automatisch dazu — wähle nur die anderen Personen aus');
  }

  let angelegt: TruppRecord | undefined;
  try {
    const benutzer = await db.benutzer.update(async (items) => {
      const me = items.find((x) => x.id === meId);
      if (!me) throw new HttpError(401, 'Sitzung abgelaufen oder ungültig — bitte neu anmelden');
      if (me.systemRolle !== 'teilnehmer') throw new HttpError(403, NUR_TEILNEHMER);
      if (me.truppId) throw new HttpError(409, IN_TRUPP);
      if (!me.gewuenschteRolle) {
        throw new HttpError(409, 'Wähle zuerst deine Wunschrolle — erst dann kannst du einen Trupp bilden.');
      }

      const auswahl: BenutzerRecord[] = [];
      const weg: string[] = [];
      let unbekannt = 0;
      for (const id of benutzerIds) {
        const b = items.find((x) => x.id === id);
        if (!b) unbekannt++;
        else if (!wartet(b)) weg.push(b.name);
        else auswahl.push(b);
      }
      if (weg.length || unbekannt) {
        const teile = [
          ...(weg.length ? [`${weg.join(', ')} ${weg.length === 1 ? 'ist' : 'sind'} nicht mehr in der Truppsuche`] : []),
          ...(unbekannt ? [`${unbekannt === 1 ? 'Eine ausgewählte Person gibt' : `${unbekannt} ausgewählte Personen gibt`} es nicht mehr`] : []),
        ];
        throw new HttpError(
          409,
          `${teile.join('; ')} (z. B. inzwischen in einem Trupp). Es wurde kein Trupp gebildet — bitte Liste aktualisieren und neu auswählen.`,
          { nichtVerfuegbar: benutzerIds.filter((id) => !auswahl.some((b) => b.id === id)) },
        );
      }

      const trupp = newTruppRecord({ name: truppName(me.ff, await db.trupps.all()), pruefungstermin: null, ownerId: me.id });
      await db.trupps.insert(trupp);
      angelegt = trupp;
      for (const b of [me, ...auswahl]) inTruppSetzen(b, trupp.id, b.gewuenschteRolle);
      return { items, result: me };
    });
    res.status(201).json(await meResponse(benutzer));
  } catch (err) {
    // The Trupp is inserted before benutzer.json is persisted: if that write failed, don't
    // leave an empty Trupp behind.
    if (angelegt) {
      const id = angelegt.id;
      const mitglieder = await db.benutzer.find((b) => b.truppId === id);
      if (mitglieder.length === 0) await db.trupps.remove((t) => t.id === id);
    }
    throw err;
  }
});
