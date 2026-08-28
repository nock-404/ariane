/**
 * Auswertungen. Reine Rechnung auf demselben Datensatz, den auch das Raster
 * benutzt — es gibt keine zweite Wahrheit und keine zweite Formel.
 */

import { capacityOf, slotKey, type PlanData, type PlanPerson } from "./capacity";
import { personHoursIn, subStatusIndex } from "./rows";
import { addWeeks, isoWeek, monthOf, todayWeek, weekRange, type WeekKey } from "./weeks";

export type PeriodId = "12w" | "quartal" | "quartal-next" | "6m" | "12m";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "12w", label: "Nächste 12 Wochen" },
  { id: "quartal", label: "Laufendes Quartal" },
  { id: "quartal-next", label: "Nächstes Quartal" },
  { id: "6m", label: "Nächste 6 Monate" },
  { id: "12m", label: "Nächste 12 Monate" },
];

/** Der Zeitraum, immer auf ganze Wochen gerundet. */
export function periodWeeks(period: PeriodId, available: WeekKey[]): WeekKey[] {
  const today = todayWeek();
  const clamp = (list: WeekKey[]) => list.filter((w) => available.includes(w));

  if (period === "12w") return clamp(weekRange(today, addWeeks(today, 11)));
  if (period === "6m") return clamp(weekRange(today, addWeeks(today, 25)));
  if (period === "12m") return clamp(weekRange(today, addWeeks(today, 51)));

  // Quartale: vom Montag der ersten Woche des Quartals bis zur letzten.
  const [y, m] = monthOf(today).key.split("-").map(Number);
  const shift = period === "quartal-next" ? 3 : 0;
  const startMonth = Math.floor((m - 1) / 3) * 3 + shift;
  const year = y + Math.floor(startMonth / 12);
  const from = startMonth % 12;
  const wanted = new Set([from, (from + 1) % 12, (from + 2) % 12]);

  return available.filter((w) => {
    const mo = monthOf(w);
    const [wy, wm] = mo.key.split("-").map(Number);
    if (!wanted.has(wm - 1)) return false;
    // Ein Quartal kann über den Jahreswechsel gehen.
    return wm - 1 >= from ? wy === year : wy === year + 1;
  });
}

export type WeekPoint = {
  week: WeekKey;
  label: string;
  monthKey: string;
  capacity: number;
  planned: number;
  /** Positiv = Luft, negativ = Überhang. */
  free: number;
  ratio: number | null;
};

export type PersonLoad = {
  person: PlanPerson;
  capacity: number;
  planned: number;
  ratio: number | null;
  /** Wochen im Zeitraum, in denen die Person über 100 Prozent liegt. */
  overWeeks: number;
  awayWeeks: number;
};

export type OverBlock = {
  person: PlanPerson;
  from: WeekKey;
  to: WeekKey;
  weeks: number;
  peak: number;
  average: number;
};

export type ProjectShare = {
  id: string;
  name: string;
  client: string;
  color: string;
  status: "confirmed" | "offer";
  hours: number;
  share: number;
};

export type BudgetRow = {
  projectId: string;
  project: string;
  client: string;
  sub: string;
  color: string;
  budget: number;
  actual: number;
  /** Verplant ab der laufenden Woche — Vergangenes steckt schon im Ist. */
  planned: number;
  over: boolean;
};

export type Report = {
  weeks: WeekKey[];
  points: WeekPoint[];
  people: PersonLoad[];
  overBlocks: OverBlock[];
  projects: ProjectShare[];
  budgets: BudgetRow[];
  totals: {
    capacity: number;
    planned: number;
    free: number;
    ratio: number | null;
    peopleOver: number;
    projectsOverBudget: number;
  };
};

type Input = {
  data: PlanData;
  hours: PlanData["hours"];
  slots: { personId: string; subprojectId: string }[];
  includeOffers: boolean;
  weeks: WeekKey[];
  colorOf: Map<string, string>;
};

export function buildReport(input: Input): Report {
  const { data, hours, slots, includeOffers, weeks, colorOf } = input;
  const cellInput = { data, hours, slots, includeOffers };
  const subStatus = subStatusIndex(data.projects);
  const today = todayWeek();

  /* ── Verlauf je Woche ── */
  const points: WeekPoint[] = weeks.map((week) => {
    let capacity = 0;
    let planned = 0;
    for (const person of data.people) {
      capacity += capacityOf(person, week, data.holidays).available;
      planned += personHoursIn(cellInput, person, week, subStatus);
    }
    return {
      week,
      label: String(isoWeek(week).week),
      monthKey: monthOf(week).key,
      capacity: round(capacity),
      planned: round(planned),
      free: round(capacity - planned),
      ratio: capacity > 0 ? planned / capacity : null,
    };
  });

  /* ── Je Person ── */
  const people: PersonLoad[] = data.people.map((person) => {
    let capacity = 0;
    let planned = 0;
    let overWeeks = 0;
    let awayWeeks = 0;

    for (const week of weeks) {
      const cap = capacityOf(person, week, data.holidays);
      const h = personHoursIn(cellInput, person, week, subStatus);
      capacity += cap.available;
      planned += h;
      if (cap.available === 0) awayWeeks += 1;
      else if (h / cap.available > 1.001) overWeeks += 1;
    }

    return {
      person,
      capacity: round(capacity),
      planned: round(planned),
      ratio: capacity > 0 ? planned / capacity : null,
      overWeeks,
      awayWeeks,
    };
  });

  /* ── Überlast am Stück ── */
  const overBlocks: OverBlock[] = [];
  for (const person of data.people) {
    let run: { from: WeekKey; to: WeekKey; ratios: number[] } | null = null;

    const close = () => {
      if (!run) return;
      const peak = Math.max(...run.ratios);
      const average = run.ratios.reduce((a, b) => a + b, 0) / run.ratios.length;
      overBlocks.push({
        person,
        from: run.from,
        to: run.to,
        weeks: run.ratios.length,
        peak,
        average,
      });
      run = null;
    };

    for (const week of weeks) {
      const cap = capacityOf(person, week, data.holidays);
      const h = personHoursIn(cellInput, person, week, subStatus);
      const over = cap.available > 0 && h / cap.available > 1.001;
      if (over) {
        const ratio = h / cap.available;
        if (run) {
          run.to = week;
          run.ratios.push(ratio);
        } else {
          run = { from: week, to: week, ratios: [ratio] };
        }
      } else {
        close();
      }
    }
    close();
  }
  overBlocks.sort((a, b) => b.peak - a.peak || b.weeks - a.weeks);

  /* ── Stunden je Projekt ── */
  const perProject = new Map<string, number>();
  for (const slot of slots) {
    const entry = data.projects.find((p) => p.subs.some((s) => s.id === slot.subprojectId));
    if (!entry) continue;
    if (!includeOffers && entry.status === "offer") continue;
    const row = hours[slotKey(slot.personId, slot.subprojectId)] ?? {};
    let sum = 0;
    for (const week of weeks) sum += row[week] ?? 0;
    perProject.set(entry.id, (perProject.get(entry.id) ?? 0) + sum);
  }

  const totalProjectHours = [...perProject.values()].reduce((a, b) => a + b, 0);
  const projects: ProjectShare[] = data.projects
    .filter((p) => (perProject.get(p.id) ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client,
      color: colorOf.get(p.id) ?? "var(--pc-none)",
      status: p.status,
      hours: round(perProject.get(p.id) ?? 0),
      share: totalProjectHours > 0 ? (perProject.get(p.id) ?? 0) / totalProjectHours : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  /* ── Budgets ── */
  const budgets: BudgetRow[] = [];
  for (const project of data.projects) {
    for (const sub of project.subs) {
      if (sub.budgetHours == null) continue;
      let planned = 0;
      for (const slot of slots) {
        if (slot.subprojectId !== sub.id) continue;
        const row = hours[slotKey(slot.personId, sub.id)] ?? {};
        for (const [week, value] of Object.entries(row)) {
          // Nur was noch kommt — Vergangenes steckt in den Ist-Stunden.
          if (week >= today) planned += value;
        }
      }
      const actual = sub.actualHours ?? 0;
      budgets.push({
        projectId: project.id,
        project: project.name,
        client: project.client,
        sub: sub.name,
        color: colorOf.get(project.id) ?? "var(--pc-none)",
        budget: sub.budgetHours,
        actual: round(actual),
        planned: round(planned),
        over: actual + planned > sub.budgetHours,
      });
    }
  }
  budgets.sort((a, b) => (b.actual + b.planned) / b.budget - (a.actual + a.planned) / a.budget);

  /* ── Summen ── */
  const capacity = round(points.reduce((sum, p) => sum + p.capacity, 0));
  const planned = round(points.reduce((sum, p) => sum + p.planned, 0));

  return {
    weeks,
    points,
    people,
    overBlocks,
    projects,
    budgets,
    totals: {
      capacity,
      planned,
      free: round(capacity - planned),
      ratio: capacity > 0 ? planned / capacity : null,
      peopleOver: people.filter((p) => p.overWeeks > 0).length,
      projectsOverBudget: budgets.filter((b) => b.over).length,
    },
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function pct(ratio: number | null): string {
  return ratio === null ? "–" : `${Math.round(ratio * 100)} %`;
}

export function hours(n: number): string {
  return `${Math.round(n).toLocaleString("de-DE")} h`;
}
