/**
 * Gesetzliche Feiertage, ohne externe Abhängigkeit. Die beweglichen Tage
 * hängen alle am Ostersonntag, der Rest steht fest.
 *
 * Eine Person hat eine **Feiertagsregion**, keinen Wohnort: maßgeblich ist,
 * wo sie ihre Arbeitsleistung erbringt. Wer in Portugal sitzt, hat
 * portugiesische Feiertage, unabhängig davon, wo das Unternehmen sitzt.
 *
 * Regionen sind Zeichenketten wie "DE-NW", "PT" oder "LU". Länder ohne
 * regionale Unterschiede haben nur den Ländercode.
 */

import { addDays, formatDay, parseDay, utcDate, weekKeyOf, type WeekKey } from "./weeks";

export type Rule = { name: string; day: string; regions?: string[] };

export type RegionOption = { code: string; label: string; group: string };

/* ── Deutschland ──────────────────────────────────────────────────────── */

const DE_STATES: Record<string, string> = {
  "DE-BW": "Baden-Württemberg",
  "DE-BY": "Bayern",
  "DE-BE": "Berlin",
  "DE-BB": "Brandenburg",
  "DE-HB": "Bremen",
  "DE-HH": "Hamburg",
  "DE-HE": "Hessen",
  "DE-MV": "Mecklenburg-Vorpommern",
  "DE-NI": "Niedersachsen",
  "DE-NW": "Nordrhein-Westfalen",
  "DE-RP": "Rheinland-Pfalz",
  "DE-SL": "Saarland",
  "DE-SN": "Sachsen",
  "DE-ST": "Sachsen-Anhalt",
  "DE-SH": "Schleswig-Holstein",
  "DE-TH": "Thüringen",
};

/**
 * Länder ohne regionale Aufteilung.
 *
 * Nachgeschlagen und gegen eine gepflegte Feiertagsquelle abgeglichen, nicht
 * aus dem Gedächtnis. Der Maßstab ist nicht „steht im Gesetzblatt", sondern
 * „an diesem Tag wird dort tatsächlich nicht gearbeitet" — nur so stimmt die
 * Kapazität.
 *
 * Bewusst NICHT enthalten, weil trotzdem gearbeitet wird:
 *   · Luxemburg, Karfreitag — nur Bankfeiertag
 *   · Portugal, Karneval — feriado facultativo, der Arbeitgeber entscheidet
 *   · Niederlande, Karfreitag und Bevrijdingsdag — Letzterer nur im
 *     Lustrumjahr üblich (2025, 2030)
 *   · Belgien, Tag nach Christi Himmelfahrt und 26.12. — betriebsüblich
 *
 * Bewusst ENTHALTEN, obwohl nicht landesweit geregelt:
 *   · Schweiz, Karfreitag, Oster- und Pfingstmontag, Stephanstag — kantonal,
 *     aber in nahezu allen Kantonen arbeitsfrei
 *   · Vereinigtes Königreich: England und Wales; Schottland und Nordirland
 *     weichen ab
 */
const COUNTRIES: Record<string, string> = {
  AT: "Österreich",
  BE: "Belgien",
  CH: "Schweiz",
  CZ: "Tschechien",
  ES: "Spanien",
  FR: "Frankreich",
  GB: "Vereinigtes Königreich",
  IT: "Italien",
  LU: "Luxemburg",
  NL: "Niederlande",
  PL: "Polen",
  PT: "Portugal",
};

export const DEFAULT_REGION = "DE-NW";

/** Für Auswahlfelder: nach Land gruppiert, Deutschland zuerst. */
export function regionOptions(): RegionOption[] {
  return [
    ...Object.entries(DE_STATES).map(([code, label]) => ({
      code,
      label,
      group: "Deutschland",
    })),
    ...Object.entries(COUNTRIES).map(([code, label]) => ({
      code,
      label,
      group: "Andere Länder",
    })),
  ];
}

export function regionLabel(code: string): string {
  return DE_STATES[code] ?? COUNTRIES[code] ?? code;
}

export function isKnownRegion(code: string): boolean {
  return code in DE_STATES || code in COUNTRIES;
}

/* ── Ostern ───────────────────────────────────────────────────────────── */

/** Ostersonntag nach der anonymen gregorianischen Osterformel. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

/** Der n-te Wochentag eines Monats, z.B. der erste Montag im Mai. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  const first = utcDate(year, month, 1);
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return addDays(formatDay(first), shift + (nth - 1) * 7);
}

/** Der letzte Wochentag eines Monats, z.B. der letzte Montag im Mai. */
function lastWeekday(year: number, month: number, weekday: number): string {
  const nextMonth = month === 12 ? utcDate(year + 1, 1, 1) : utcDate(year, month + 1, 1);
  const last = new Date(nextMonth.getTime() - 86_400_000);
  const back = (last.getUTCDay() - weekday + 7) % 7;
  return addDays(formatDay(last), -back);
}

/* ── Die Regeln je Land ───────────────────────────────────────────────── */

function rulesFor(region: string, year: number): Rule[] {
  const easter = easterSunday(year);
  const rel = (n: number) => formatDay(new Date(easter.getTime() + n * 86_400_000));
  const fix = (m: number, d: number) => formatDay(utcDate(year, m, d));

  if (region.startsWith("DE-")) return germany(region, year, rel, fix);

  switch (region) {
    case "AT":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Heilige Drei Könige", day: fix(1, 6) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Staatsfeiertag", day: fix(5, 1) },
        { name: "Christi Himmelfahrt", day: rel(39) },
        { name: "Pfingstmontag", day: rel(50) },
        { name: "Fronleichnam", day: rel(60) },
        { name: "Mariä Himmelfahrt", day: fix(8, 15) },
        { name: "Nationalfeiertag", day: fix(10, 26) },
        { name: "Allerheiligen", day: fix(11, 1) },
        { name: "Mariä Empfängnis", day: fix(12, 8) },
        { name: "Christtag", day: fix(12, 25) },
        { name: "Stefanitag", day: fix(12, 26) },
      ];

    case "BE":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Tag der Arbeit", day: fix(5, 1) },
        { name: "Christi Himmelfahrt", day: rel(39) },
        { name: "Pfingstmontag", day: rel(50) },
        { name: "Nationalfeiertag", day: fix(7, 21) },
        { name: "Mariä Himmelfahrt", day: fix(8, 15) },
        { name: "Allerheiligen", day: fix(11, 1) },
        { name: "Waffenstillstand", day: fix(11, 11) },
        { name: "Weihnachten", day: fix(12, 25) },
      ];

    case "CH":
      // Landesweit gelten nur wenige Tage; die Kantone regeln den Rest.
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Karfreitag", day: rel(-2) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Auffahrt", day: rel(39) },
        { name: "Pfingstmontag", day: rel(50) },
        { name: "Bundesfeier", day: fix(8, 1) },
        { name: "Weihnachten", day: fix(12, 25) },
        { name: "Stephanstag", day: fix(12, 26) },
      ];

    case "CZ":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Karfreitag", day: rel(-2) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Tag der Arbeit", day: fix(5, 1) },
        { name: "Tag des Sieges", day: fix(5, 8) },
        { name: "Kyrill und Method", day: fix(7, 5) },
        { name: "Jan Hus", day: fix(7, 6) },
        { name: "Tag der Staatlichkeit", day: fix(9, 28) },
        { name: "Gründung der Tschechoslowakei", day: fix(10, 28) },
        { name: "Tag des Kampfes für Freiheit", day: fix(11, 17) },
        { name: "Heiligabend", day: fix(12, 24) },
        { name: "1. Weihnachtstag", day: fix(12, 25) },
        { name: "2. Weihnachtstag", day: fix(12, 26) },
      ];

    case "ES":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Heilige Drei Könige", day: fix(1, 6) },
        { name: "Karfreitag", day: rel(-2) },
        { name: "Tag der Arbeit", day: fix(5, 1) },
        { name: "Mariä Himmelfahrt", day: fix(8, 15) },
        { name: "Nationalfeiertag", day: fix(10, 12) },
        { name: "Allerheiligen", day: fix(11, 1) },
        { name: "Tag der Verfassung", day: fix(12, 6) },
        { name: "Mariä Empfängnis", day: fix(12, 8) },
        { name: "Weihnachten", day: fix(12, 25) },
      ];

    case "FR":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Tag der Arbeit", day: fix(5, 1) },
        { name: "Tag des Sieges", day: fix(5, 8) },
        { name: "Christi Himmelfahrt", day: rel(39) },
        { name: "Pfingstmontag", day: rel(50) },
        { name: "Nationalfeiertag", day: fix(7, 14) },
        { name: "Mariä Himmelfahrt", day: fix(8, 15) },
        { name: "Allerheiligen", day: fix(11, 1) },
        { name: "Waffenstillstand", day: fix(11, 11) },
        { name: "Weihnachten", day: fix(12, 25) },
      ];

    case "GB": {
      // England und Wales; Schottland und Nordirland weichen ab.
      // Fällt ein Bankfeiertag aufs Wochenende, wird er am nächsten
      // Werktag nachgeholt — 2027 landen Weihnachten und Boxing Day
      // deshalb auf dem 27. und 28. Dezember.
      const fest = [
        { name: "New Year's Day", day: fix(1, 1) },
        { name: "Christmas Day", day: fix(12, 25) },
        { name: "Boxing Day", day: fix(12, 26) },
      ];
      const belegt = new Set<string>();
      const nachgeholt = fest.map((h) => {
        let day = h.day;
        while (isWeekend(day) || belegt.has(day)) day = addDays(day, 1);
        belegt.add(day);
        return { name: belegt.size && day !== h.day ? `${h.name} (Ersatztag)` : h.name, day };
      });

      return [
        nachgeholt[0],
        { name: "Good Friday", day: rel(-2) },
        { name: "Easter Monday", day: rel(1) },
        { name: "Early May Bank Holiday", day: nthWeekday(year, 5, 1, 1) },
        { name: "Spring Bank Holiday", day: lastWeekday(year, 5, 1) },
        { name: "Summer Bank Holiday", day: lastWeekday(year, 8, 1) },
        nachgeholt[1],
        nachgeholt[2],
      ];
    }

    case "IT":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Heilige Drei Könige", day: fix(1, 6) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Tag der Befreiung", day: fix(4, 25) },
        { name: "Tag der Arbeit", day: fix(5, 1) },
        { name: "Tag der Republik", day: fix(6, 2) },
        { name: "Mariä Himmelfahrt", day: fix(8, 15) },
        // Gesetz 151/2025: der Patron des Landes ist ab 2026 wieder
        // arbeitsfreier Feiertag, nach fast fünfzig Jahren Pause.
        ...(year >= 2026 ? [{ name: "San Francesco d'Assisi", day: fix(10, 4) }] : []),
        { name: "Allerheiligen", day: fix(11, 1) },
        { name: "Mariä Empfängnis", day: fix(12, 8) },
        { name: "Weihnachten", day: fix(12, 25) },
        { name: "Stephanstag", day: fix(12, 26) },
      ];

    case "LU":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Tag der Arbeit", day: fix(5, 1) },
        { name: "Europatag", day: fix(5, 9) },
        { name: "Christi Himmelfahrt", day: rel(39) },
        { name: "Pfingstmontag", day: rel(50) },
        { name: "Nationalfeiertag", day: fix(6, 23) },
        { name: "Mariä Himmelfahrt", day: fix(8, 15) },
        { name: "Allerheiligen", day: fix(11, 1) },
        { name: "Weihnachten", day: fix(12, 25) },
        { name: "Stephanstag", day: fix(12, 26) },
      ];

    case "NL":
      // Karfreitag ist zwar offizieller Feiertag, es wird aber üblicherweise
      // gearbeitet — er steht deshalb nicht drin.
      return [
        { name: "Nieuwjaarsdag", day: fix(1, 1) },
        { name: "Tweede Paasdag", day: rel(1) },
        { name: "Koningsdag", day: kingsDay(year) },
        { name: "Hemelvaartsdag", day: rel(39) },
        { name: "Tweede Pinksterdag", day: rel(50) },
        { name: "Eerste Kerstdag", day: fix(12, 25) },
        { name: "Tweede Kerstdag", day: fix(12, 26) },
      ];

    case "PL":
      return [
        { name: "Neujahr", day: fix(1, 1) },
        { name: "Heilige Drei Könige", day: fix(1, 6) },
        { name: "Ostermontag", day: rel(1) },
        { name: "Tag der Arbeit", day: fix(5, 1) },
        { name: "Tag der Verfassung", day: fix(5, 3) },
        { name: "Pfingsten", day: rel(49) },
        { name: "Fronleichnam", day: rel(60) },
        { name: "Mariä Himmelfahrt", day: fix(8, 15) },
        { name: "Allerheiligen", day: fix(11, 1) },
        { name: "Unabhängigkeitstag", day: fix(11, 11) },
        // Seit dem Gesetz vom Februar 2025 arbeitsfrei — damit hat Polen 14.
        ...(year >= 2025 ? [{ name: "Heiligabend", day: fix(12, 24) }] : []),
        { name: "1. Weihnachtstag", day: fix(12, 25) },
        { name: "2. Weihnachtstag", day: fix(12, 26) },
      ];

    case "PT":
      return [
        { name: "Ano Novo", day: fix(1, 1) },
        { name: "Sexta-feira Santa", day: rel(-2) },
        { name: "Páscoa", day: rel(0) },
        { name: "Dia da Liberdade", day: fix(4, 25) },
        { name: "Dia do Trabalhador", day: fix(5, 1) },
        { name: "Corpo de Deus", day: rel(60) },
        { name: "Dia de Portugal", day: fix(6, 10) },
        { name: "Assunção de Nossa Senhora", day: fix(8, 15) },
        { name: "Implantação da República", day: fix(10, 5) },
        { name: "Todos os Santos", day: fix(11, 1) },
        { name: "Restauração da Independência", day: fix(12, 1) },
        { name: "Imaculada Conceição", day: fix(12, 8) },
        { name: "Natal", day: fix(12, 25) },
      ];

    default:
      return [];
  }
}

function isWeekend(day: string): boolean {
  const dow = parseDay(day).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Koningsdag: 27. April, fällt er auf einen Sonntag, dann am 26. */
function kingsDay(year: number): string {
  const day = utcDate(year, 4, 27);
  return day.getUTCDay() === 0 ? formatDay(utcDate(year, 4, 26)) : formatDay(day);
}

function germany(
  region: string,
  year: number,
  rel: (n: number) => string,
  fix: (m: number, d: number) => string,
): Rule[] {
  const all: Rule[] = [
    { name: "Neujahr", day: fix(1, 1) },
    { name: "Heilige Drei Könige", day: fix(1, 6), regions: ["DE-BW", "DE-BY", "DE-ST"] },
    { name: "Internationaler Frauentag", day: fix(3, 8), regions: ["DE-BE", "DE-MV"] },
    { name: "Karfreitag", day: rel(-2) },
    { name: "Ostermontag", day: rel(1) },
    { name: "Tag der Arbeit", day: fix(5, 1) },
    { name: "Christi Himmelfahrt", day: rel(39) },
    { name: "Pfingstmontag", day: rel(50) },
    {
      name: "Fronleichnam",
      day: rel(60),
      regions: ["DE-BW", "DE-BY", "DE-HE", "DE-NW", "DE-RP", "DE-SL"],
    },
    { name: "Mariä Himmelfahrt", day: fix(8, 15), regions: ["DE-SL"] },
    { name: "Weltkindertag", day: fix(9, 20), regions: ["DE-TH"] },
    { name: "Tag der Deutschen Einheit", day: fix(10, 3) },
    {
      name: "Reformationstag",
      day: fix(10, 31),
      regions: ["DE-BB", "DE-HB", "DE-HH", "DE-MV", "DE-NI", "DE-SN", "DE-ST", "DE-SH", "DE-TH"],
    },
    {
      name: "Allerheiligen",
      day: fix(11, 1),
      regions: ["DE-BW", "DE-BY", "DE-NW", "DE-RP", "DE-SL"],
    },
    { name: "Buß- und Bettag", day: bussUndBettag(year), regions: ["DE-SN"] },
    { name: "1. Weihnachtstag", day: fix(12, 25) },
    { name: "2. Weihnachtstag", day: fix(12, 26) },
  ];

  return all.filter((rule) => !rule.regions || rule.regions.includes(region));
}

/** Der Mittwoch vor dem 23. November. */
function bussUndBettag(year: number): string {
  const nov23 = utcDate(year, 11, 23);
  const dow = nov23.getUTCDay(); // 3 = Mittwoch
  const back = (dow + 4) % 7 || 7;
  return addDays(formatDay(nov23), -back);
}

/* ── Öffentliche Rechnung ─────────────────────────────────────────────── */

export type HolidayHit = { day: string; name: string };

/** Alle Feiertage einer Region in einem Jahr, doppelte Tage zusammengefasst. */
export function holidaysOfYear(region: string, year: number): Rule[] {
  const seen = new Set<string>();
  return rulesFor(region, year).filter((rule) => {
    if (seen.has(rule.day)) return false;
    seen.add(rule.day);
    return true;
  });
}

/**
 * Feiertage je Woche. Samstage und Sonntage sind draußen — sie kosten
 * ohnehin keinen Arbeitstag.
 */
export function holidayWeeks(region: string, years: number[]): Map<WeekKey, HolidayHit[]> {
  const map = new Map<WeekKey, HolidayHit[]>();
  for (const year of years) {
    for (const rule of holidaysOfYear(region, year)) {
      const date = parseDay(rule.day);
      const dow = date.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const key = weekKeyOf(date);
      const list = map.get(key) ?? [];
      list.push({ day: rule.day, name: rule.name });
      map.set(key, list);
    }
  }
  return map;
}
