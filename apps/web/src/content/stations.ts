/**
 * Static station content for APAS Bronze.
 * Deliberately brief and conservative — summarised from the NÖ LFV Bestimmungen
 * APAS (Stand 12/2015). The official Bestimmungen are authoritative.
 */
export interface Station {
  nr: number;
  titel: string;
  ablauf: string;
  schwerpunkte: string[];
}

export const STATIONEN: Station[] = [
  {
    nr: 1,
    titel: 'Ausrüsten',
    ablauf:
      'Der Atemschutztrupp rüstet sich auf Kommando mit Atemschutzgerät und persönlicher Schutzausrüstung aus und stellt die Einsatzbereitschaft her.',
    schwerpunkte: [
      'Vollständige, korrekt angelegte Schutzausrüstung',
      'Einsatzkurzprüfung des Atemschutzgeräts',
      'Dichtsitz der Atemschutzmaske',
      'Gegenseitige Kontrolle im Trupp',
    ],
  },
  {
    nr: 2,
    titel: 'Personensuche',
    ablauf:
      'Der Trupp sucht unter Atemschutz einen Bereich mit eingeschränkter Sicht systematisch nach einer vermissten Person ab und rettet die aufgefundene Person.',
    schwerpunkte: [
      'Vorgehen als geschlossener Trupp',
      'Systematisches Absuchen des Bereichs',
      'Orientierung und Sicherung des Rückwegs',
      'Rettung der aufgefundenen Person',
    ],
  },
  {
    nr: 3,
    titel: 'Löschangriff über Hindernisstrecke',
    ablauf:
      'Der Trupp geht unter Atemschutz mit einer Schlauchleitung über eine Hindernisstrecke vor und führt einen Löschangriff durch.',
    schwerpunkte: [
      'Sicheres Überwinden der Hindernisse',
      'Mitführen und Nachziehen der Schlauchleitung',
      'Richtige Handhabung des Strahlrohrs',
      'Zusammenarbeit innerhalb der Gruppe',
    ],
  },
  {
    nr: 4,
    titel: 'Geräteversorgung + Gerätekunde',
    ablauf:
      'Das Atemschutzgerät wird nach dem Einsatz wieder einsatzbereit gemacht. In der Gerätekunde werden Fragen zu Aufbau und Funktion der Atemschutzgeräte aus dem Fragenkatalog beantwortet.',
    schwerpunkte: [
      'Wiederherstellen der Einsatzbereitschaft des Geräts',
      'Sicht- und Funktionskontrolle',
      'Kenntnis von Aufbau und Funktion (Fragenkatalog)',
    ],
  },
];

export const FEHLERPUNKTE_REGELN: string[] = [
  'Insgesamt dürfen höchstens 35 Fehlerpunkte erreicht werden.',
  'Zusätzlich ist das Fehlerpunkte-Limit jeder einzelnen Station zu beachten.',
  'Eine Wiederholung der Prüfung ist frühestens nach 14 Tagen möglich.',
];

export const QUELLE =
  'Quelle: NÖ Landesfeuerwehrverband — Bestimmungen für die Ausbildungsprüfung Atemschutz (APAS), Stand 12/2015. ' +
  'Zusammenfassung ohne Gewähr; maßgeblich ist die jeweils gültige Fassung der Bestimmungen.';
