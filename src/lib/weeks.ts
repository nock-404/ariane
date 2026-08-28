/**
 * Wochen-Rechnerei. Eine Woche ist immer das Datum ihres Montags, als
 * "YYYY-MM-DD". Gerechnet wird ausschliesslich in UTC — die Domaene kennt
 * keine Uhrzeiten und keine Zeitzonen, damit ein Montag nicht je nach
 * Serverstandort zum Sonntag wird.
 */

export type WeekKey = string; // "YYYY-MM-DD", immer ein Montag

const DAY = 86_400_000;

export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return utcDate(y, m, d);
}

export function formatDay(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Montag der Woche, in der dieses Datum liegt. */
export function mondayOf(date: Date): Date {
  const dow = date.getUTCDay(); // 0 = Sonntag
  const shift = dow === 0 ? -6 : 1 - dow;
  return new Date(date.getTime() + shift * DAY);
}

export function weekKeyOf(date: Date): WeekKey {
  return formatDay(mondayOf(date));
}

export function addWeeks(week: WeekKey, n: number): WeekKey {
  return formatDay(new Date(parseDay(week).getTime() + n * 7 * DAY));
}

export function addDays(day: string, n: number): string {
  return formatDay(new Date(parseDay(day).getTime() + n * DAY));
}

export function weeksBetween(from: WeekKey, to: WeekKey): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / (7 * DAY));
}

/** Alle Montage von `from` bis einschliesslich `to`. */
export function weekRange(from: WeekKey, to: WeekKey): WeekKey[] {
  const out: WeekKey[] = [];
  const n = weeksBetween(from, to);
  for (let i = 0; i <= n; i++) out.push(addWeeks(from, i));
  return out;
}

/** ISO-8601-Kalenderwoche (1..53) und das dazugehoerige ISO-Jahr. */
export function isoWeek(week: WeekKey): { year: number; week: number } {
  const monday = parseDay(week);
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const firstThursday = (() => {
    const jan4 = utcDate(year, 1, 4);
    return new Date(mondayOf(jan4).getTime() + 3 * DAY);
  })();
  const diff = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY));
  return { year, week: diff + 1 };
}

export function kwLabel(week: WeekKey): string {
  return String(isoWeek(week).week);
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/**
 * Der Monat, dem eine Woche zugeordnet wird — nach ISO der Monat des
 * Donnerstags, damit Wochen ueber den Monatswechsel eindeutig landen.
 */
export function monthOf(week: WeekKey): { key: string; label: string; short: string } {
  const thursday = new Date(parseDay(week).getTime() + 3 * DAY);
  const y = thursday.getUTCFullYear();
  const m = thursday.getUTCMonth();
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
    label: `${MONTH_NAMES[m]} ${y}`,
    short: MONTH_NAMES[m].slice(0, 3),
  };
}

/** Wochen zu Monatsbloecken zusammenfassen — fuer die Monatsansicht. */
export function groupByMonth(weeks: WeekKey[]): { key: string; label: string; short: string; weeks: WeekKey[] }[] {
  const out: { key: string; label: string; short: string; weeks: WeekKey[] }[] = [];
  for (const w of weeks) {
    const m = monthOf(w);
    const last = out[out.length - 1];
    if (last && last.key === m.key) last.weeks.push(w);
    else out.push({ ...m, weeks: [w] });
  }
  return out;
}

export function todayWeek(): WeekKey {
  return weekKeyOf(new Date());
}

/** Datumsspanne einer Woche, z.B. "3.–9. Aug." — fuer Tooltips. */
export function weekSpanLabel(week: WeekKey): string {
  const mon = parseDay(week);
  const sun = new Date(mon.getTime() + 6 * DAY);
  const fmt = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  return `${fmt(mon)} – ${fmt(sun)}`;
}
