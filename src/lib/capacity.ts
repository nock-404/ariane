/**
 * Die eine Rechnung, auf der alles steht:
 *
 *   verfuegbar(Person, Woche) = Netto-Kapazitaet × (5 − Urlaubstage − Feiertage) / 5
 *   Auslastung                = verplante Stunden / verfuegbar
 *
 * Netto-Kapazitaet ist das, was nach Meetings und internem Kram uebrig
 * bleibt, und ist pro Person unterschiedlich. Sie gilt ab einem Stichtag,
 * damit ein Teilzeitwechsel die Vergangenheit nicht rueckwirkend verbiegt.
 */

import type { HolidayHit } from "./holidays";
import type { WeekKey } from "./weeks";

export type CapacityStep = { id?: string; validFrom: string; netHours: number };

export type PlanPerson = {
  id: string;
  name: string;
  initials: string;
  /** Aufgelöst: eigene Feiertagsregion, sonst die des Teams. */
  region: string;
  /** Was an der Person steht — leer heißt „wie das Team". */
  regionOwn: string;
  note: string;
  sort: number;
  caps: CapacityStep[];
  absences: Record<WeekKey, number>;
};

export type PlanSubproject = {
  id: string;
  projectId: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  openEnded: boolean;
  budgetHours: number | null;
  actualHours: number | null;
  actualAsOf: string | null;
  sort: number;
};

export type PlanProject = {
  id: string;
  name: string;
  client: string;
  status: "confirmed" | "offer";
  sort: number;
  subs: PlanSubproject[];
};

export type PlanData = {
  weeks: WeekKey[];
  /** Feiertagsregion des Teams; gilt für alle ohne eigenen Eintrag. */
  defaultRegion: string;
  people: PlanPerson[];
  projects: PlanProject[];
  slots: { personId: string; subprojectId: string }[];
  /** "personId:subprojectId" → Woche → Stunden */
  hours: Record<string, Record<WeekKey, number>>;
  /** Region → Woche → Feiertage */
  holidays: Record<string, Record<WeekKey, HolidayHit[]>>;
};

export const slotKey = (personId: string, subprojectId: string) => `${personId}:${subprojectId}`;

/** Netto-Kapazitaet, die in dieser Woche gilt. */
export function netHoursAt(person: PlanPerson, week: WeekKey): number {
  let value = 0;
  for (const step of person.caps) {
    if (step.validFrom <= week) value = step.netHours;
    else break; // caps sind aufsteigend sortiert
  }
  return value;
}

export function holidayDays(
  person: PlanPerson,
  week: WeekKey,
  holidays: PlanData["holidays"],
): number {
  return holidays[person.region]?.[week]?.length ?? 0;
}

export type WeekCapacity = {
  /** Volle Netto-Woche, ohne Abzuege. */
  gross: number;
  /** Nach Urlaub und Feiertagen tatsaechlich verfuegbar. */
  available: number;
  vacationDays: number;
  holidayDays: number;
  holidayNames: string[];
  /** Person ist die ganze Woche weg. */
  away: boolean;
};

export function capacityOf(
  person: PlanPerson,
  week: WeekKey,
  holidays: PlanData["holidays"],
): WeekCapacity {
  const gross = netHoursAt(person, week);
  const vacationDays = person.absences[week] ?? 0;
  const hits = holidays[person.region]?.[week] ?? [];
  const off = Math.min(5, vacationDays + hits.length);
  const available = Math.max(0, round2((gross * (5 - off)) / 5));
  return {
    gross,
    available,
    vacationDays,
    holidayDays: hits.length,
    holidayNames: hits.map((h) => h.name),
    away: gross > 0 && available === 0,
  };
}

export type Load = {
  hours: number;
  available: number;
  /** Anteil, 1 = genau voll. Ohne Kapazitaet undefiniert. */
  ratio: number | null;
  state: "away" | "empty" | "light" | "good" | "tight" | "full" | "over";
};

export function loadState(hours: number, available: number, away: boolean): Load["state"] {
  if (away) return "away";
  if (available <= 0) return hours > 0 ? "over" : "away";
  const r = hours / available;
  if (r > 1.001) return "over";
  if (r >= 0.98) return "full";
  if (r >= 0.85) return "tight";
  if (r >= 0.5) return "good";
  if (r > 0) return "light";
  return "empty";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ist ein Teilprojekt in dieser Woche ueberhaupt aktiv? */
export function subActiveIn(sub: PlanSubproject, week: WeekKey): boolean {
  if (sub.startsOn && week < startWeekOf(sub.startsOn)) return false;
  if (!sub.openEnded && sub.endsOn && week > startWeekOf(sub.endsOn)) return false;
  return true;
}

function startWeekOf(day: string): string {
  // Vergleich auf Wochenebene: der Montag der Woche, in der der Tag liegt.
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(date.getTime() + shift * 86_400_000);
  return monday.toISOString().slice(0, 10);
}
