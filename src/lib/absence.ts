/**
 * Urlaub wird als echter Zeitraum eingegeben — „5. bis 14. August" — und
 * daraus rechnet die App die Tage je Kalenderwoche aus. Vorher musste man
 * Wochen wählen; das war nicht nur umständlich, es hat auch stillschweigend
 * auf Montage gerundet und den Zeitraum verschoben.
 */

import { holidaysOfYear } from "./holidays";
import { addDays, formatDay, parseDay, weekKeyOf, type WeekKey } from "./weeks";

export type AbsenceSpread = {
  /** Wochenschlüssel → Arbeitstage Urlaub in dieser Woche. */
  perWeek: Record<WeekKey, number>;
  /** Summe der Arbeitstage. */
  days: number;
  /** Feiertage im Zeitraum — die zählen nicht als Urlaub. */
  holidays: { day: string; name: string }[];
  weekends: number;
};

/**
 * Arbeitstage je Woche zwischen zwei Daten, einschließlich beider.
 * Wochenenden zählen nicht, Feiertage auch nicht: die kürzen die Woche
 * ohnehin schon über die Kapazität. Beides mitzuzählen hieße, denselben Tag
 * zweimal abzuziehen.
 */
export function spreadAbsence(fromDay: string, toDay: string, region: string): AbsenceSpread {
  const perWeek: Record<WeekKey, number> = {};
  const holidayHits: { day: string; name: string }[] = [];
  let days = 0;
  let weekends = 0;

  if (!fromDay || !toDay || toDay < fromDay) {
    return { perWeek, days: 0, holidays: [], weekends: 0 };
  }

  const years = new Set<number>();
  years.add(parseDay(fromDay).getUTCFullYear());
  years.add(parseDay(toDay).getUTCFullYear());

  const holidayByDay = new Map<string, string>();
  for (const year of years) {
    for (const rule of holidaysOfYear(region, year)) holidayByDay.set(rule.day, rule.name);
  }

  let cursor = fromDay;
  let guard = 0;
  while (cursor <= toDay && guard < 800) {
    guard += 1;
    const date = parseDay(cursor);
    const dow = date.getUTCDay();

    if (dow === 0 || dow === 6) {
      weekends += 1;
    } else {
      const holiday = holidayByDay.get(cursor);
      if (holiday) {
        holidayHits.push({ day: cursor, name: holiday });
      } else {
        const week = weekKeyOf(date);
        perWeek[week] = (perWeek[week] ?? 0) + 1;
        days += 1;
      }
    }
    cursor = addDays(cursor, 1);
  }

  // Mehr als fünf Arbeitstage kann eine Woche nicht haben.
  for (const week of Object.keys(perWeek)) {
    perWeek[week] = Math.min(5, perWeek[week]);
  }

  return { perWeek, days, holidays: holidayHits, weekends };
}

/** Für die Anzeige: „5.8. – 14.8." */
export function rangeLabel(fromDay: string, toDay: string): string {
  const f = parseDay(fromDay);
  const t = parseDay(toDay);
  const short = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  return fromDay === toDay ? short(f) : `${short(f)} – ${short(t)}`;
}

export function todayIso(): string {
  return formatDay(new Date());
}
