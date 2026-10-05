import type { Gruppe, Ressource, Teilnehmer, Termin } from '@apas/shared';
import type { GruppeRecord, RessourceRecord, TeilnehmerRecord, TerminRecord } from './db.js';

export function toGruppe(g: GruppeRecord, opts: { includeInvite: boolean }): Gruppe {
  return {
    id: g.id,
    name: g.name,
    stufe: g.stufe,
    pruefungstermin: g.pruefungstermin,
    ownerId: g.ownerId,
    createdAt: g.createdAt,
    ...(opts.includeInvite ? { inviteToken: g.inviteToken } : {}),
  };
}

export function toTeilnehmer(t: TeilnehmerRecord, opts: { includeEmail: boolean }): Teilnehmer {
  return {
    id: t.id,
    gruppeId: t.gruppeId,
    name: t.name,
    ff: t.ff,
    rolle: t.rolle,
    emailVerified: t.emailVerified,
    joinedAt: t.joinedAt,
    checkliste: t.checkliste,
    ...(opts.includeEmail ? { email: t.email } : {}),
  };
}

export function toRessource(r: RessourceRecord): Ressource {
  return { id: r.id, gruppeId: r.gruppeId, name: r.name, standort: r.standort };
}

export function toTermin(t: TerminRecord): Termin {
  return {
    id: t.id,
    gruppeId: t.gruppeId,
    typ: t.typ,
    titel: t.titel,
    start: t.start,
    ende: t.ende,
    teilnehmerIds: t.teilnehmerIds,
    ressourceId: t.ressourceId,
    createdBy: t.createdBy,
  };
}
