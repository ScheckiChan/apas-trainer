/**
 * Static station content for APAS Bronze, structured from the NÖ LFV "Bestimmungen für die
 * Ausbildungsprüfung Atemschutz" (Stand 12/2015), Abschnitte 9.2–9.5 plus Fragenkatalog
 * Gerätekunde and Beilage Hindernisstrecke. Ablauf steps, Zeitvorgaben, Fehlerpunkte and
 * the Fragenkatalog follow the wording of the Bestimmungen — edit with the PDF at hand.
 * The official Bestimmungen are authoritative. Fehlerpunkte limits come from STATION_WERTUNG
 * in @apas/shared, which the API uses for the Bestehensregel as well.
 */

import { STATION_WERTUNG, type StationId } from '@apas/shared';

export interface AblaufSchritt {
  titel: string;
  /** Running text of the step. */
  text?: string;
  /** Sub-steps, rendered as a list. */
  punkte?: string[];
}

export interface Zeitvorgabe {
  label: string;
  /** null = not a fixed number (e.g. set by the Hauptprüfer). */
  sekunden: number | null;
  hinweis?: string;
  /** Index of the Fehlerpunkte table (Teil) this time applies to. Default 0. */
  teil?: number;
}

export interface Fehlerpunkt {
  fehler: string;
  /** "je Mitglied", "je Fall", "je 10 Sek." — null when the points apply once. */
  bezug: string | null;
  punkte: number;
}

export interface FehlerTabelle {
  titel: string;
  maxPunkte: number;
  hinweis?: string;
  zeilen: Fehlerpunkt[];
}

export interface ZusatzAbschnitt {
  titel: string;
  text?: string;
  punkte?: string[];
}

export interface Station {
  /** URL slug for the detail route. */
  id: StationId;
  nr: number;
  /** Section in the Bestimmungen. */
  abschnitt: string;
  titel: string;
  /** Short overview for the station grid. */
  ablauf: string;
  schwerpunkte: string[];
  zeitvorgaben: Zeitvorgabe[];
  schritte: AblaufSchritt[];
  hinweise: string[];
  zusatz: ZusatzAbschnitt[];
  fehlerpunkte: FehlerTabelle[];
  /** Station 4 also covers the Gerätekunde-Fragenkatalog (flashcards). */
  fragenkatalog?: boolean;
}

const KURZPRUEFUNG_200: string[] = [
  'Erstes Flaschenventil öffnen, mind. 180 bar Manometeranzeige',
  'Flaschenventil schließen, am Lungenautomat per Spülfunktion Luft langsam ablassen, Manometer beobachten',
  'Warneinrichtung muss bei 55 ± 5 bar ansprechen',
  'Zweites Flaschenventil öffnen, mind. 180 bar',
  'Beide Flaschenventile vollständig öffnen',
  'Pressluftatmer ist einsatzbereit',
];

const FLASCHENWECHSEL_200 =
  'Halterung öffnen → Rüttelsicherung/Verschraubung lösen → Flaschen tauschen (immer am Boden ablegen, ' +
  'gegen Abrollen schützen) → Einbau umgekehrte Reihenfolge → Hochdruckdichtprüfung.';

const FLASCHENWECHSEL_300 =
  'Spannband öffnen → Pressluftatmer auf Flaschenboden stellen → Rüttelsicherung/Verschraubung lösen → ' +
  'Flasche tauschen → Einbau umgekehrte Reihenfolge → Hochdruckdichtprüfung.';

const HOCHDRUCKDICHTPRUEFUNG: string[] = [
  'Flaschenventil öffnen, mind. 270 bar (300er) bzw. mind. 180 bar (200er)',
  'Flaschenventil schließen',
  'Angezeigter Druck darf in 1 Minute max. 10 bar abfallen',
  'Warneinrichtung prüfen',
  '2. Atemluftflasche bei 200-bar-Gerät: Druckkontrolle',
  'Pressluftatmer drucklos machen',
];

export const STATIONEN: Station[] = [
  {
    id: 'ausruesten',
    nr: 1,
    abschnitt: '9.2',
    titel: 'Ausrüsten',
    ablauf:
      'Der Atemschutztrupp rüstet sich auf Kommando mit Atemschutzgerät und persönlicher Schutzausrüstung aus und stellt die Einsatzbereitschaft her.',
    schwerpunkte: [
      'Vollständige, korrekt angelegte Schutzausrüstung',
      'Einsatzkurzprüfung des Atemschutzgeräts',
      'Dichtsitz der Atemschutzmaske',
      'Gegenseitige Kontrolle im Trupp',
    ],
    zeitvorgaben: [
      { label: 'Im Fahrzeug · 200 bar (2× 4 Liter)', sekunden: 170 },
      { label: 'Im Fahrzeug · 300 bar (1× 6/6,8 Liter)', sekunden: 160 },
      { label: 'Außerhalb des Fahrzeuges · 200 bar', sekunden: 220 },
      { label: 'Außerhalb des Fahrzeuges · 300 bar', sekunden: 210 },
      { label: 'Elektronisches Manometer', sekunden: null, hinweis: 'Zeiten vom Hauptprüfer festgelegt' },
    ],
    schritte: [
      {
        titel: 'Auftrag durch den GKDT',
        text:
          'Ausbildungsgruppe begibt sich mit Schutzhaube über dem Nacken (außer GKDT) auf die Fahrzeugplätze. ' +
          'GKDT erteilt Auftrag „Atemschutztrupp … zur Absolvierung der Ausbildungsprüfung laut Bestimmungen ausrüsten". ' +
          'Zeitnehmung beginnt.',
      },
      {
        titel: 'GKDT',
        text:
          'Rüstet sich mit Handfunkgerät + Schreibutensilien aus, Proberuf an Hauptprüfer, verlässt Fahrzeug, ' +
          'bezieht eigene Position, erfasst schriftlich die Daten für die Atemschutzüberwachung.',
      },
      {
        titel: 'Vollmaske bereitmachen',
        text: 'Atemschutztrupp: Vollmaske vom Aufbewahrungsort nehmen, von Verpackung trennen, mit Trageband um den Hals hängen.',
      },
      { titel: 'Kurzprüfung 200 bar Pressluftatmer', punkte: KURZPRUEFUNG_200 },
      {
        titel: 'Kurzprüfung 300 bar Pressluftatmer',
        punkte: [
          'Flaschenventil öffnen, mind. 270 bar Manometeranzeige',
          'Flaschenventil schließen, Spülfunktion, Manometer beobachten',
          'Warneinrichtung bei 55 ± 5 bar',
          'Flaschenventil vollständig öffnen',
          'Einsatzbereit',
        ],
      },
      {
        titel: 'Anlegen des Pressluftatmers',
        punkte: [
          'Mit geöffneter Begurtung aufnehmen',
          'Hüftgurt schließen',
          'Schultergurte spannen bis guter Sitz',
          'Gewichtsverteilung Schulter/Hüfte einstellen, Gurtenden hinter Hüftgurt versorgen',
        ],
      },
      {
        titel: 'Anlegen der Vollmaske',
        punkte: [
          'Bänderung vollständig geöffnet kontrollieren',
          'Bänderung auseinanderhalten, Kinn zuerst in Kinntasche',
          'Bänderung über Kopf streifen, gleichmäßig anziehen: erst Nackenbänder, dann Schläfenbänder, dann Stirnband',
          'Anschlussstück mit Handballen abdichten + einatmen → Unterdruck muss halten',
          'Anschlussstück mit Handballen abdichten + ausatmen → Luft muss ungehindert entweichen',
          '(siehe Beilage Dichtprüfung der Bestimmungen für Dräger-spezifische 2-Punkt-Masken)',
        ],
      },
      {
        titel: 'Schutzhaube und Helm',
        text:
          'Schutzhaube vorsichtig vom Nacken über restlichen Kopf ziehen, nochmals Dichtheitsprobe an der Vollmaske. ' +
          'Zum Schluss Feuerwehrhelm aufsetzen. Lungenautomat NICHT mit Vollmaske verbunden. ' +
          'Schutzhandschuhe am Körper versorgen.',
      },
      {
        titel: 'Kommando „Absitzen"',
        text:
          'Pressluftatmer aus Verriegelung lösen, Aufbewahrungsbehälter im Fahrzeug versorgen, ' +
          'Auftrittsflächen/Türen schließen.',
      },
      {
        titel: 'Zusatzausrüstung und Meldung',
        text:
          'Zusatzausrüstung (Punkt 7.3 der Bestimmungen) aus dem Fahrzeug aufnehmen, gegenseitige Kontrolle auf ' +
          'richtigen Sitz. Proberuf an GKDT, dann Meldung „Atemschutztrupp … einsatzbereit" + Hand heben. ' +
          'Zeitnehmung endet.',
      },
    ],
    hinweise: [
      'Lungenautomat immer am Pressluftatmer oder am Körper versorgt.',
      'Bei dieser Station darf nicht gesprochen werden.',
      'Je nach Gerät gilt Schritt 4 (200 bar) oder Schritt 5 (300 bar).',
    ],
    zusatz: [
      {
        titel: 'Ausrüsten außerhalb des Fahrzeuges',
        text:
          'Gleicher Ablauf, aber Pressluftatmer/Vollmasken werden aus dem Fahrzeug entnommen und auf einer Unterlage ' +
          '(Tisch/Vorrichtung/Boden mit Decke) aufgelegt statt direkt im Mannschaftsraum angelegt. ' +
          'Zeitvorgaben: 200 bar max. 220 Sek., 300 bar max. 210 Sek.',
      },
    ],
    fehlerpunkte: [
      {
        titel: 'Fehlerpunkte Station Ausrüsten',
        maxPunkte: STATION_WERTUNG.ausruesten.teile[0].maxPunkte,
        zeilen: [
          { fehler: 'Falsche Adjustierung', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Nicht ordnungsgemäß angelegtes Gerät', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Fehlerhafte Kurzprüfung', bezug: 'je Mitglied', punkte: 2 },
          { fehler: 'Falsches Arbeiten', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Unterlassen der Dichtheitsprobe', bezug: 'je Mitglied', punkte: 2 },
          { fehler: 'Sprechen während der Arbeit', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Vergessenes oder verlorenes Gerät', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Fehlerhafte Aufzeichnungen des GKDT', bezug: null, punkte: 1 },
          { fehler: 'Proberuf nicht durchgeführt', bezug: null, punkte: 1 },
          { fehler: 'Atemluftflasche nicht geöffnet', bezug: null, punkte: 25 },
          { fehler: 'Zeitüberschreitung', bezug: 'je 10 Sek.', punkte: 2 },
        ],
      },
    ],
  },
  {
    id: 'personensuche',
    nr: 2,
    abschnitt: '9.3',
    titel: 'Personensuche',
    ablauf:
      'Der Trupp sucht unter Atemschutz einen Bereich mit eingeschränkter Sicht systematisch nach einer vermissten Person ab und rettet die aufgefundene Person.',
    schwerpunkte: [
      'Vorgehen als geschlossener Trupp',
      'Systematisches Absuchen des Bereichs',
      'Orientierung und Sicherung des Rückwegs',
      'Rettung der aufgefundenen Person',
    ],
    zeitvorgaben: [{ label: 'Bronze/Silber', sekunden: 500 }],
    schritte: [
      {
        titel: 'Angriffsbefehl',
        text:
          'GKDT fordert weiteren Atemschutztrupp über Funk (Prüfer) an, erteilt Angriffsbefehl „Atemschutztrupp zur ' +
          'Personensuche mit Tragetuch (Notrettungsgeräteset) und Feuerwehraxt durch die Tür in das Übungsobjekt – vor". ' +
          'Zeitnehmung beginnt nach Wiederholung des Befehls durch den Atemschutztruppführer.',
      },
      {
        titel: 'Rückwegsicherung und Druckkontrolle',
        text:
          'ATM2 befestigt Arbeitsleine als Rückwegsicherung. Lungenautomaten mit Vollmasken verbinden (gegenseitige ' +
          'Unterstützung), Schutzhandschuhe anziehen. Truppführer ordnet Druckkontrolle an. GKDT notiert Zeitpunkt + ' +
          'Flaschendruck jedes Mitglieds.',
      },
      {
        titel: 'Optische Kontrolle',
        text:
          '„Optische Kontrolle" der Brandraumtüre (Sichtkontakt von unten nach oben) + Innenraum. Truppführer stellt ' +
          'sicher: nur Brandrauch, kein Brandherd mit Hitzeentwicklung.',
      },
      {
        titel: 'Durchsuchung',
        text:
          'Bodennähe, Wandtechnik, ständiger Körperkontakt (Arme). Bei Kontaktunterbrechung sofort wiederherstellen + ' +
          'durchzählen lassen. Truppführer hält Wandkontakt. Hindernisse und Gefahrenquellen laufend weitermelden.',
      },
      {
        titel: 'Person gefunden',
        text: 'Meldung an GKDT (notiert Zeitpunkt), Truppführer ordnet Druckkontrolle an.',
      },
      {
        titel: 'Rettung',
        text:
          'Person rasch, schonend, mit Rettungsgriffen entlang der Rückwegsicherung (oder sichtbar kürzerem Weg) aus ' +
          'dem Gefahrenbereich bringen, dann mit Tragetuch zur vom Hauptprüfer definierten Stelle (ca. 5–10 m).',
      },
      {
        titel: 'Meldung „Person gerettet"',
        text:
          'Truppführer meldet GKDT „Person gerettet" + Fundort + ggf. Gefahrenquellen (Gefahrzettel). GKDT dokumentiert ' +
          'alles. Zeitnehmung stoppt. Nicht mehr benötigte Zusatzausrüstung ablegen. Druckkontrolle, dann weiter zur ' +
          'nächsten Station.',
      },
    ],
    hinweise: [],
    zusatz: [
      {
        titel: 'Stufe Gold (zur Info, Zeitvorgabe 440 Sek.)',
        text:
          'Zusätzlich: nach Druckkontrolle verliert ein bestimmtes Truppmitglied „scheinbar" das Bewusstsein → GKDT ' +
          'meldet per Funk: 1) verunglücktes Mitglied, 2) Person kann nicht gerettet werden, 3) Rettungstrupp ' +
          'entsenden, 4) Fundort-Beschreibung. Rettungstrupp wird mit Angriffsbefehl entsandt.',
      },
    ],
    fehlerpunkte: [
      {
        titel: 'Fehlerpunkte Station Personensuche',
        maxPunkte: STATION_WERTUNG.personensuche.teile[0].maxPunkte,
        zeilen: [
          { fehler: 'Mangelhafte Ausrüstung', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Falsche Sprechgruppe', bezug: null, punkte: 1 },
          { fehler: 'Nicht durchgeführte/unterlassene Druckkontrolle', bezug: 'je Fall', punkte: 3 },
          { fehler: 'Vergessenes oder verlorenes Gerät', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Mangelhafte Hilfestellung/Kontrolle der Vollzähligkeit', bezug: 'je Fall', punkte: 2 },
          { fehler: 'Gefahrenquellen nicht weitergemeldet', bezug: 'je Fall', punkte: 2 },
          { fehler: 'Person nicht gerettet', bezug: null, punkte: 11 },
          { fehler: 'Falsches Arbeiten', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Rettungstrupp nicht angefordert', bezug: null, punkte: 3 },
          { fehler: 'Angriffsbefehl an Rettungstrupp nicht erteilt (Gold)', bezug: 'je Fall', punkte: 11 },
          { fehler: 'Fehlende Aufzeichnungen des GKDT', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Zeitüberschreitung', bezug: 'je 10 Sek.', punkte: 2 },
        ],
      },
    ],
  },
  {
    id: 'hindernisstrecke',
    nr: 3,
    abschnitt: '9.4',
    titel: 'Löschangriff über Hindernisstrecke',
    ablauf:
      'Der Trupp geht unter Atemschutz mit einer Schlauchleitung über eine Hindernisstrecke vor und führt einen Löschangriff durch.',
    schwerpunkte: [
      'Sicheres Überwinden der Hindernisse',
      'Mitführen und Nachziehen der Schlauchleitung',
      'Richtige Handhabung des Strahlrohrs',
      'Zusammenarbeit innerhalb der Gruppe',
    ],
    zeitvorgaben: [{ label: 'Bronze/Silber', sekunden: 300 }],
    schritte: [
      {
        titel: 'Angriffsbefehl',
        text:
          'Gruppe begibt sich mit Verteiler, 3× C-Druckschlauch, Hohlstrahlrohr, Schlauchhalter, Beleuchtungsgerät, ' +
          'Handfunkgerät zum Hauptprüfer. GKDT erteilt Angriffsbefehl „Atemschutztrupp … zur Brandbekämpfung über die ' +
          'Hindernisbahn mit …strahlrohr – vor". Zeitnehmung beginnt nach Wiederholung.',
      },
      {
        titel: 'Leitung legen',
        text:
          'ATM1 rollt die 3 C-Schläuche seitlich vom Verteiler aus, kuppelt Hohlstrahlrohr am letzten Schlauch an. ' +
          'ATM2 kuppelt Schläuche zusammen + ersten Schlauch an linken Druckausgang des Verteilers. Schlauchträger beim ' +
          'Verteiler ablegen.',
      },
      {
        titel: '„Wasser marsch!" und Druckkontrolle',
        text:
          'ATM1 + ATM2 ergreifen Hohlstrahlrohr. ATM1 gibt Befehl „Atemschutztrupp … Erstes Rohr – Wasser marsch!" ' +
          'Truppführer ordnet Druckkontrolle an, meldet Einmarsch an GKDT, der Zeitpunkt + niedrigsten Flaschendruck ' +
          'notiert.',
      },
      {
        titel: 'Reihenfolge beim Vorgehen zum ersten Hindernis',
        punkte: [
          'ATM1: Hohlstrahlrohr, Schlauchhalter',
          'Truppführer: Handscheinwerfer, Handfunkgerät',
          'ATM2: Schlauchleitung',
        ],
      },
      {
        titel: 'Hindernisse überqueren',
        text:
          'Geräte dürfen abgelegt werden, müssen aber vom selben Mitglied wieder aufgenommen werden. Jedes Hindernis + ' +
          'Überwindungsart ansagen. Nächstes Hindernis erst wenn letztes Mitglied das vorige überwunden hat. Keine ' +
          'Geräte werfen/fallen lassen. Spätestens im Kriechtunnel Beleuchtung einschalten. Nach zweitem Hindernis ' +
          'Druckkontrolle.',
      },
      {
        titel: '„Wasser halt" und Meldung',
        text:
          'Nach letztem Hindernis: Aufstellung mit Löschleitung. ATM1: „Atemschutztrupp … 1. Rohr Wasser halt". ' +
          'Truppführer meldet GKDT „Brandbekämpfung durchgeführt". Zeit gestoppt.',
      },
      {
        titel: 'Abschluss',
        text: 'Geräte ablegen, Lungenautomat von Vollmaske trennen (gegenseitige Unterstützung).',
      },
    ],
    hinweise: [],
    zusatz: [
      {
        titel: 'Die 3 Hindernisse (Beilage Hindernisstrecke)',
        punkte: [
          'Stabile tischähnliche Fläche (Höhe 70–90 cm, Breite ca. 100 cm, Länge mind. 120 cm) — kriechend oberhalb überwinden.',
          'Rohr-/Kriechtunnelkonstruktion (Querschnitt 75×75 cm oder Ø 75 cm, Länge 6 m) — durchkriechend überwinden.',
          'Stabile tischähnliche Fläche (Höhe 70–90 cm, Breite 100 cm, Länge 150–200 cm) mit schräger Auf-/Abstiegsrampe (45°, rutschsicher, Breite 100 cm) — kriechend oberhalb überwinden.',
        ],
        text: 'Alle Konstruktionen müssen stabil und am Boden gesichert sein.',
      },
      {
        titel: 'Stufe Gold (zur Info, Zeitvorgabe 500 Sek.)',
        text:
          'Nach letztem Hindernis + Aufstellung meldet GKDT auf Handzeichen des Hauptprüfers per Funk „Gefahr in ' +
          'Verzug – Sofortiger Rückzug" → Löschleitung ablegen, Hindernisse in umgekehrter Reihenfolge überwinden, ' +
          'Zeitnehmung endet nach Rückmeldung beim GKDT.',
      },
    ],
    fehlerpunkte: [
      {
        titel: 'Fehlerpunkte Station Hindernisstrecke',
        maxPunkte: STATION_WERTUNG.hindernisstrecke.teile[0].maxPunkte,
        zeilen: [
          { fehler: 'Mangelhafte Ausrüstung', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Leuchtmittel nicht eingeschaltet', bezug: null, punkte: 1 },
          { fehler: 'Nicht durchgeführte/unterlassene Druckkontrolle', bezug: 'je Fall', punkte: 3 },
          { fehler: 'Falsches Arbeiten', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Liegengebliebenes oder verlorenes Gerät', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Mangelhafte Hilfestellung', bezug: 'je Fall', punkte: 2 },
          { fehler: 'Alleiniger Rückzug', bezug: 'je Fall', punkte: 2 },
          { fehler: 'Nichtbeachtung der Warneinrichtung', bezug: null, punkte: 11 },
          { fehler: 'Löschleitung nicht über der Ziellinie', bezug: null, punkte: 11 },
          { fehler: 'Zeitüberschreitung', bezug: 'je 10 Sek.', punkte: 2 },
        ],
      },
    ],
  },
  {
    id: 'geraeteversorgung',
    nr: 4,
    abschnitt: '9.5',
    titel: 'Geräteversorgung + Gerätekunde',
    ablauf:
      'Das Atemschutzgerät wird nach dem Einsatz wieder einsatzbereit gemacht. In der Gerätekunde werden Fragen zu Aufbau und Funktion der Atemschutzgeräte aus dem Fragenkatalog beantwortet.',
    schwerpunkte: [
      'Wiederherstellen der Einsatzbereitschaft des Geräts',
      'Sicht- und Funktionskontrolle',
      'Kenntnis von Aufbau und Funktion (Fragenkatalog)',
    ],
    zeitvorgaben: [
      { label: 'Geräteversorgung', sekunden: 500 },
      { label: 'Fragen', sekunden: 300, teil: 1 },
    ],
    schritte: [
      {
        titel: 'Anordnung durch den GKDT',
        text: 'GKDT ordnet Herstellen der Einsatzbereitschaft an. Zeitnehmung beginnt.',
      },
      {
        titel: 'Ablegen der Vollmaske',
        punkte: [
          'Helm ablegen',
          'Schutzhaube nach hinten ziehen',
          'Klemmschnallen mit Daumen nach vorne drücken',
          'Vollmaske am Anschlussstück fassen, nach hinten über Kopf ziehen',
          'Bänderung gänzlich lang stellen',
        ],
      },
      {
        titel: 'Ablegen des Pressluftatmers (gegenseitige Unterstützung)',
        punkte: [
          'Begurtung öffnen und lang ziehen',
          'Pressluftatmer ablegen',
          'Flaschenventile schließen',
          'Luft per Spülfunktion am Lungenautomat gänzlich ablassen',
        ],
      },
      { titel: 'Flaschenwechsel 200 bar', text: FLASCHENWECHSEL_200 },
      { titel: 'Flaschenwechsel 300 bar', text: FLASCHENWECHSEL_300 },
      { titel: 'Hochdruckdichtprüfung', punkte: HOCHDRUCKDICHTPRUEFUNG },
      {
        titel: 'Abschluss',
        text: 'Leere Flaschen + benützte Vollmasken im vorgesehenen Bereich ablegen. Zeitnehmung endet.',
      },
      {
        titel: 'Fragen',
        text: 'Danach: 15 Fragen aus dem Fragenkatalog, vom GKDT an den Hauptprüfer beantwortet.',
      },
    ],
    hinweise: ['Je nach Gerät gilt Schritt 4 (200 bar) oder Schritt 5 (300 bar).'],
    zusatz: [
      {
        titel: 'Stufe Gold (zur Info)',
        text: 'Zusätzlich 4 Gefahrzettel ziehen, mind. 3 richtig benennen, sonst nicht bestanden.',
      },
    ],
    fehlerpunkte: [
      {
        titel: 'Fehlerpunkte Station Geräteversorgung',
        maxPunkte: STATION_WERTUNG.geraeteversorgung.teile[0].maxPunkte,
        zeilen: [
          { fehler: 'Atemluftflaschen nicht am Boden abgelegt', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Fehlerhafte Hochdruckdichtprüfung', bezug: 'je Mitglied', punkte: 1 },
          { fehler: 'Gerät nicht einsatzbereit', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Mangelhafte Überprüfung/Versorgung der Geräte', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Falsches Arbeiten', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Zeitüberschreitung', bezug: 'je 10 Sek.', punkte: 2 },
        ],
      },
      {
        titel: 'Fehlerpunkte Station Fragen',
        maxPunkte: STATION_WERTUNG.geraeteversorgung.teile[1].maxPunkte,
        hinweis: 'Zeit max. 300 Sek.',
        zeilen: [
          { fehler: 'Frage nicht beantwortet', bezug: 'je Fall', punkte: 1 },
          { fehler: 'Gefahrzettel nicht richtig benannt', bezug: 'je Fall', punkte: 4 },
          { fehler: 'Zeitüberschreitung', bezug: 'je 10 Sek.', punkte: 2 },
        ],
      },
    ],
    fragenkatalog: true,
  },
];

export const stationById = (id: string | undefined): Station | undefined => STATIONEN.find((s) => s.id === id);

/** "2 Punkte je Mitglied", "1 Punkt", "2 Punkte je 10 Sek." */
export function punkteLabel(f: Fehlerpunkt): string {
  const p = `${f.punkte} ${f.punkte === 1 ? 'Punkt' : 'Punkte'}`;
  return f.bezug ? `${p} ${f.bezug}` : p;
}

export const FEHLERPUNKTE_REGELN: string[] = [
  'Insgesamt dürfen höchstens 35 Fehlerpunkte erreicht werden.',
  'Zusätzlich darf keine Station ihr eigenes Limit überschreiten: Ausrüsten 20, Personensuche 10, Hindernisstrecke 10, Geräteversorgung 5 + Fragen 6.',
  'Nicht bestanden → frühestens nach 14 Tagen erneut antreten.',
];

// ---------------------------------------------------------------------------
// Fragenkatalog Gerätekunde (Station 4)
// ---------------------------------------------------------------------------

export interface Frage {
  nr: number;
  frage: string;
  /** One line, or several lines rendered as a list. */
  antwort: string | string[];
}

export const FRAGENKATALOG: Frage[] = [
  {
    nr: 1,
    frage: 'Welche Arten von Atemschutzgeräten stehen für den Feuerwehreinsatz zur Verfügung?',
    antwort: [
      'Umluftabhängige Atemschutzgeräte (Atemmasken, Atemfilter)',
      'Umluftunabhängige Atemschutzgeräte (Behältergeräte mit Druckluft = Pressluftatmer, und Regenerationsgeräte = Sauerstoff-/Kreislaufgeräte)',
    ],
  },
  {
    nr: 2,
    frage: 'Welche Arten von umluftabhängigen Atemschutzgeräten gibt es?',
    antwort: 'Partikelfilter, Gasfilter, Kombinationsfilter.',
  },
  { nr: 3, frage: 'Welches Gas entsteht im Körper durch die Atmung und wird ausgeatmet?', antwort: 'Kohlenstoffdioxid.' },
  { nr: 4, frage: 'Wovor schützt eine Schutzhaube?', antwort: 'Vor Wärme und Flammen.' },
  {
    nr: 5,
    frage: 'Was ist eine Brandfluchthaube und wie wird sie verwendet?',
    antwort: 'Ein Fluchtgerät, um Personen durch einen verrauchten Bereich zu bringen.',
  },
  {
    nr: 6,
    frage: 'Aus welchen Bestandteilen setzt sich atmosphärische Luft zusammen?',
    antwort: '21 Vol% Sauerstoff, 78 Vol% Stickstoff, 1 Vol% Edelgase.',
  },
  {
    nr: 7,
    frage: 'Wie hoch ist der Luftverbrauch eines durchschnittlich gebauten gesunden Menschen?',
    antwort: ['Leichte Arbeit ca. 30 l/min', 'Mittelschwere Arbeit ca. 50 l/min', 'Schwerstarbeit ca. 100 l/min'],
  },
  {
    nr: 8,
    frage: 'Wodurch kann eine Atemkrise entstehen?',
    antwort: 'Durch falsches, flaches, hastiges Atmen und Sauerstoffmangel.',
  },
  {
    nr: 9,
    frage: 'Was ist ein „Flash Over"?',
    antwort: 'Schlagartiges Übergreifen (Durchzünden) eines Brandes auf die Oberfläche aller brennbaren Stoffe eines Brandraumes.',
  },
  {
    nr: 10,
    frage: 'Ab welchem Alter darf ein Atemschutzgeräteträger als Atemschutztruppführer eingesetzt werden?',
    antwort: 'Ab dem vollendeten 18. Lebensjahr.',
  },
  {
    nr: 11,
    frage: 'Welche Technik eignet sich am besten, um bei Sichtbehinderung einen typischen Wohnraum abzusuchen?',
    antwort: 'Die Wandtechnik.',
  },
  {
    nr: 12,
    frage: 'Wie geht der Atemschutztrupp in Gebäuden und bei schlechten Sichtverhältnissen vor?',
    antwort:
      'Mit Beleuchtungsgerät, in gebückter Haltung, gesichert durch gefüllte, unter Druck stehende Löschleitung oder durch Leinen.',
  },
  {
    nr: 13,
    frage: 'Wann ist eine Atemschutzüberwachung-Einsatzzeitkontrolle durchzuführen?',
    antwort: 'Generell bei allen Atemschutzeinsätzen.',
  },
  { nr: 14, frage: 'Wann muss eine Kurzprüfung durchgeführt werden?', antwort: 'Vor jedem Gebrauch eines Pressluftatmers.' },
  {
    nr: 15,
    frage: 'Welche Luftmenge muss für den gesicherten Rückzug zur Verfügung stehen?',
    antwort: 'Mindestens die doppelte Luftmenge des Einmarschweges.',
  },
  {
    nr: 16,
    frage: 'Wovon hängt der Atemluftbedarf des Menschen ab?',
    antwort: 'Von körperlicher Beschaffenheit, Fitness, Alter; richtet sich nach dem Energieaufwand der Leistung.',
  },
  {
    nr: 17,
    frage: 'Welche Luftmenge steht bei einem 300 bar Pressluftatmer mit 6-Liter-Stahlflasche zur Verfügung?',
    antwort: 'ca. 1620 Liter.',
  },
  {
    nr: 18,
    frage: 'Welche Aufgabe hat ein Atemschutzsammelplatz?',
    antwort: [
      'Registrierung der Atemschutztrupps',
      'Bevorratung/Wiederbefüllung der Atemluftflaschen',
      'Bereitstellung von Atemschutztrupps für den Einsatz',
    ],
  },
  {
    nr: 19,
    frage: 'Wie ist der Rettungstrupp in Bereitschaft ausgerüstet?',
    antwort: 'Vollständig zur Menschenrettung ausgerüstet, Lungenautomat noch nicht mit Vollmaske verbunden.',
  },
  { nr: 20, frage: 'Welcher Gewinde-Anschluss wird bei einem Überdruckgerät verwendet?', antwort: 'Spitzgewinde (M45x3).' },
  {
    nr: 21,
    frage: 'Durch wen wird der Angriffsbefehl an den Atemschutztrupp erteilt?',
    antwort: 'Durch den zuständigen Gruppenkommandanten.',
  },
  {
    nr: 22,
    frage: 'Welcher Mindestflaschendruck ist für den Einsatz mit 200 bar Pressluftatmern erforderlich?',
    antwort: 'Mind. 180 bar.',
  },
  {
    nr: 23,
    frage: 'Warum ist die Einsatzbekleidung nach jedem Einsatz sofort zu reinigen?',
    antwort: 'Um Schadstoffe zu entfernen, die sich während des Einsatzes festgesetzt haben.',
  },
  {
    nr: 24,
    frage:
      'Welcher Sauerstoffgehalt muss in der Umgebungsluft vorhanden sein, um umluftabhängige Atemschutzgeräte einsetzen zu können?',
    antwort: 'Mindestens 17 Vol%.',
  },
  {
    nr: 25,
    frage: 'Wie wird die Dichtheit der Atemschutzmaske kontrolliert?',
    antwort: 'Einatemventil im Anschlussstück mit Handballen verschließen und einatmen.',
  },
  {
    nr: 26,
    frage: 'Wie ist vorzugehen, wenn ein Truppmitglied verunfallt?',
    antwort: [
      'Rückmeldung an den GKDT (Standort, Lage)',
      'Verunfallten ins Freie bringen',
      'Im Notfall Rettungstrupp anfordern',
    ],
  },
  {
    nr: 27,
    frage: 'Wann spricht die akustische Warneinrichtung beim Pressluftatmer an?',
    antwort: 'Bei 55 ± 5 bar Fülldruck.',
  },
  {
    nr: 28,
    frage: 'Warum dürfen Atemluftflaschen nicht vollständig entleert werden?',
    antwort: 'Damit keine Feuchtigkeit, Schmutz, Schadstoffe eindringen können.',
  },
  {
    nr: 29,
    frage: 'Wodurch unterscheiden sich Normaldruck- von Überdruckvollmasken?',
    antwort: [
      'Form des Anschlussstücks',
      'Ausatemventil bei Normaldruck nicht federbelastet, bei Überdruck federbelastet',
    ],
  },
  {
    nr: 30,
    frage: 'Wie ist mit Pressluftatmer und Vollmaske nach Übungs-/Einsatztätigkeiten umzugehen?',
    antwort: 'Sachbearbeiter Atemschutz sorgt für Befüllen, Reinigung, Desinfektion, Überprüfung.',
  },
  {
    nr: 31,
    frage: 'Wie wird die Ausatemventilfunktion kontrolliert?',
    antwort: 'Einatemventil mit Handballen verschließen und ausatmen.',
  },
  // The Fragenkatalog refers to the station procedures for 32 and 35 — the steps are inlined here.
  { nr: 32, frage: 'Wie ist eine Kurzprüfung bei einem 200 bar Pressluftatmer durchzuführen?', antwort: KURZPRUEFUNG_200 },
  {
    nr: 33,
    frage: 'Nennen Sie fünf Bestandteile der Vollmaske.',
    antwort:
      'Maskenkörper, Sichtscheibe, Sprechmembran, Trageband, Kopfbänderung, Maskendichtrahmen, Steuerventile, Innenmaske, ' +
      'Anschlussstück mit Einatemventil, Ausatemventil und Vorkammer (Auswahl von 5 reicht).',
  },
  {
    nr: 34,
    frage: 'Aus welchen Teilen besteht ein Pressluftatmer?',
    antwort:
      'Atemluftflasche(n), Flaschenventil(e), Druckminderer, Lungenautomat, Manometer, Warneinrichtung, Tragevorrichtung.',
  },
  {
    nr: 35,
    frage: 'Wie ist ein Wechsel der Atemluftflaschen mit Hochdruckdichtprüfung durchzuführen?',
    antwort: [
      `Flaschenwechsel 200 bar: ${FLASCHENWECHSEL_200}`,
      `Flaschenwechsel 300 bar: ${FLASCHENWECHSEL_300}`,
      ...HOCHDRUCKDICHTPRUEFUNG.map((s, i) => `Hochdruckdichtprüfung ${i + 1}: ${s}`),
    ],
  },
  {
    nr: 36,
    frage: 'Wann ist beim Atemschutzeinsatz der Feuerwehrgurt zu tragen und die Rettungsleine mitzuführen?',
    antwort: 'Bei Bedarf auf Anordnung des Gruppenkommandanten.',
  },
];

export const QUELLE =
  'Quelle: NÖ Landesfeuerwehrverband — Bestimmungen für die Ausbildungsprüfung Atemschutz (APAS), Stand 12/2015. ' +
  'Lernhilfe ohne Gewähr; maßgeblich ist die jeweils gültige Fassung der Bestimmungen.';
