/**
 * Zeilenmodell und Rechnung fürs Raster. Beide Ansichten — nach Personen
 * und nach Projekten — sind dieselbe Struktur mit vertauschter Gruppierung,
 * damit es nur eine Darstellung und eine Bedienung gibt.
 */

import {
  capacityOf,
  loadState,
  round2,
  slotKey,
  subActiveIn,
  type Load,
  type PlanData,
  type PlanPerson,
  type PlanProject,
  type PlanSubproject,
} from "./capacity";
import { groupByMonth, isoWeek, todayWeek, type WeekKey } from "./weeks";

export type Column = {
  key: string;
  /** Beschriftung in der Kopfzeile: Kalenderwoche oder Monatskürzel. */
  label: string;
  weeks: WeekKey[];
  monthLabel: string;
  monthKey: string;
  isToday: boolean;
  isPast: boolean;
};

export function buildColumns(weeks: WeekKey[], zoom: "week" | "month"): Column[] {
  const today = todayWeek();
  if (zoom === "month") {
    return groupByMonth(weeks).map((m) => ({
      key: m.key,
      label: m.short,
      weeks: m.weeks,
      monthLabel: m.label,
      monthKey: m.key,
      isToday: m.weeks.includes(today),
      isPast: m.weeks[m.weeks.length - 1] < today,
    }));
  }
  return weeks.map((w) => {
    const iso = isoWeek(w);
    const month = groupByMonth([w])[0];
    return {
      key: w,
      label: String(iso.week),
      weeks: [w],
      monthLabel: month.label,
      monthKey: month.key,
      isToday: w === today,
      isPast: w < today,
    };
  });
}

export type RowKind = "team" | "person" | "personSub" | "project" | "sub" | "subPerson";

export type Row = {
  id: string;
  kind: RowKind;
  depth: 0 | 1 | 2;
  label: string;
  sublabel?: string;
  person?: PlanPerson;
  project?: PlanProject;
  sub?: PlanSubproject;
  /** Zellen dieser Zeile sind direkt beschreibbar. */
  editable: boolean;
  /** Zeile hat Kinder und lässt sich auf-/zuklappen. */
  parentId?: string;
  hasChildren: boolean;
  /** Angebot — wird optisch abgesetzt und optional aus der Summe genommen. */
  tentative: boolean;
};

export type Cell = {
  hours: number;
  available: number;
  ratio: number | null;
  state: Load["state"];
  vacationDays: number;
  holidayNames: string[];
  /** Zelle liegt außerhalb der Laufzeit des Teilprojekts. */
  inactive: boolean;
};

type Order = { people: string[]; projects: string[]; subs: Record<string, string[]> };

type BuildInput = {
  data: PlanData;
  hours: PlanData["hours"];
  slots: { personId: string; subprojectId: string }[];
  includeOffers: boolean;
  expanded: Record<string, boolean>;
  /** Vom Nutzer gezogene Reihenfolge; leer heißt: wie vom Server geliefert. */
  order?: Order;
};

function byOrder<T extends { id: string }>(items: T[], ids: string[] | undefined): T[] {
  if (!ids || ids.length === 0) return items;
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
}

export function buildPeopleRows(input: BuildInput): Row[] {
  const { data, slots, includeOffers, expanded } = input;
  const subIndex = indexSubs(data.projects);
  const projectRank = new Map((input.order?.projects ?? data.projects.map((p) => p.id)).map((id, i) => [id, i]));
  const rows: Row[] = [];

  // Ganz oben: was das Team insgesamt noch frei hat. Das ist die Frage,
  // die von außen kommt — und die man sonst über alle Zeilen addiert.
  if (data.people.length > 0) {
    rows.push({
      id: "team",
      kind: "team",
      depth: 0,
      label: "Team",
      sublabel: "noch frei",
      editable: false,
      hasChildren: false,
      tentative: false,
    });
  }

  for (const person of byOrder(data.people, input.order?.people)) {
    const mine = slots
      .filter((s) => s.personId === person.id)
      .map((s) => subIndex.get(s.subprojectId))
      .filter((x): x is { project: PlanProject; sub: PlanSubproject } => !!x)
      .filter((x) => includeOffers || x.project.status !== "offer")
      .sort(
        (a, b) =>
          (projectRank.get(a.project.id) ?? 0) - (projectRank.get(b.project.id) ?? 0) ||
          a.sub.sort - b.sub.sort,
      );

    rows.push({
      id: `p:${person.id}`,
      kind: "person",
      depth: 0,
      label: person.name,
      editable: false,
      hasChildren: mine.length > 0,
      tentative: false,
      person,
    });

    if (!expanded[`p:${person.id}`]) continue;

    for (const { project, sub } of mine) {
      rows.push({
        id: `p:${person.id}:s:${sub.id}`,
        parentId: `p:${person.id}`,
        kind: "personSub",
        depth: 1,
        label: sub.name,
        sublabel: project.client ? `${project.name} · ${project.client}` : project.name,
        editable: true,
        hasChildren: false,
        tentative: project.status === "offer",
        person,
        project,
        sub,
      });
    }
  }

  return rows;
}

export function buildProjectRows(input: BuildInput): Row[] {
  const { data, slots, includeOffers, expanded } = input;
  const peopleById = new Map(data.people.map((p) => [p.id, p]));
  const personRank = new Map((input.order?.people ?? data.people.map((p) => p.id)).map((id, i) => [id, i]));
  const rows: Row[] = [];

  for (const project of byOrder(data.projects, input.order?.projects)) {
    if (!includeOffers && project.status === "offer") continue;

    rows.push({
      id: `pr:${project.id}`,
      kind: "project",
      depth: 0,
      label: project.name,
      sublabel: project.client || undefined,
      editable: false,
      hasChildren: project.subs.length > 0,
      tentative: project.status === "offer",
      project,
    });

    if (!expanded[`pr:${project.id}`]) continue;

    for (const sub of byOrder(project.subs, input.order?.subs?.[project.id])) {
      const subRowId = `pr:${project.id}:s:${sub.id}`;
      const members = slots
        .filter((s) => s.subprojectId === sub.id)
        .map((s) => peopleById.get(s.personId))
        .filter((x): x is PlanPerson => !!x)
        .sort((a, b) => (personRank.get(a.id) ?? 0) - (personRank.get(b.id) ?? 0));

      rows.push({
        id: subRowId,
        parentId: `pr:${project.id}`,
        kind: "sub",
        depth: 1,
        label: sub.name,
        sublabel: budgetLabel(sub),
        editable: false,
        hasChildren: members.length > 0,
        tentative: project.status === "offer",
        project,
        sub,
      });

      if (!expanded[subRowId]) continue;

      for (const person of members) {
        rows.push({
          id: `${subRowId}:p:${person.id}`,
          parentId: subRowId,
          kind: "subPerson",
          depth: 2,
          label: person.name,
          editable: true,
          hasChildren: false,
          tentative: project.status === "offer",
          project,
          sub,
          person,
        });
      }
    }
  }

  return rows;
}

function budgetLabel(sub: PlanSubproject): string | undefined {
  if (sub.budgetHours == null) return sub.openEnded ? "Dauerläufer" : undefined;
  const used = sub.actualHours ?? 0;
  return `${fmt(used)} von ${fmt(sub.budgetHours)} h verbraucht`;
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/* ── Zellwerte ────────────────────────────────────────────────────────── */

type CellInput = {
  data: PlanData;
  hours: PlanData["hours"];
  slots: { personId: string; subprojectId: string }[];
  includeOffers: boolean;
};

/** Summe aller Stunden einer Person in einer Woche. */
export function personHoursIn(
  input: CellInput,
  person: PlanPerson,
  week: WeekKey,
  subStatus: Map<string, "confirmed" | "offer">,
): number {
  let total = 0;
  for (const slot of input.slots) {
    if (slot.personId !== person.id) continue;
    if (!input.includeOffers && subStatus.get(slot.subprojectId) === "offer") continue;
    total += input.hours[slotKey(person.id, slot.subprojectId)]?.[week] ?? 0;
  }
  return total;
}

export function subprojectHoursIn(input: CellInput, subId: string, week: WeekKey): number {
  let total = 0;
  for (const slot of input.slots) {
    if (slot.subprojectId !== subId) continue;
    total += input.hours[slotKey(slot.personId, subId)]?.[week] ?? 0;
  }
  return total;
}

export function indexSubs(projects: PlanProject[]) {
  const map = new Map<string, { project: PlanProject; sub: PlanSubproject }>();
  for (const project of projects) {
    for (const sub of project.subs) map.set(sub.id, { project, sub });
  }
  return map;
}

export function subStatusIndex(projects: PlanProject[]) {
  const map = new Map<string, "confirmed" | "offer">();
  for (const project of projects) {
    for (const sub of project.subs) map.set(sub.id, project.status);
  }
  return map;
}

/** Der Wert einer Zelle — für jede Zeilenart eine eigene Rechnung. */
export function cellFor(
  row: Row,
  column: Column,
  input: CellInput,
  subStatus: Map<string, "confirmed" | "offer">,
): Cell {
  const { data } = input;

  if (row.kind === "team") {
    let hours = 0;
    let available = 0;
    for (const person of data.people) {
      for (const week of column.weeks) {
        available += capacityOf(person, week, data.holidays).available;
        hours += personHoursIn(input, person, week, subStatus);
      }
    }
    return {
      hours: round2(hours),
      available: round2(available),
      ratio: available > 0 ? hours / available : null,
      state: loadState(hours, available, false),
      vacationDays: 0,
      holidayNames: [],
      inactive: false,
    };
  }

  if (row.kind === "person" || row.kind === "personSub" || row.kind === "subPerson") {
    const person = row.person!;
    let hours = 0;
    let available = 0;
    let vacationDays = 0;
    const holidayNames: string[] = [];
    let inactive = row.kind !== "person";

    for (const week of column.weeks) {
      const cap = capacityOf(person, week, data.holidays);
      available += cap.available;
      vacationDays += cap.vacationDays;
      for (const n of cap.holidayNames) if (!holidayNames.includes(n)) holidayNames.push(n);

      if (row.kind === "person") {
        hours += personHoursIn(input, person, week, subStatus);
      } else {
        hours += input.hours[slotKey(person.id, row.sub!.id)]?.[week] ?? 0;
        if (subActiveIn(row.sub!, week)) inactive = false;
      }
    }

    const away = available === 0 && column.weeks.some((w) => capacityOf(person, w, data.holidays).away);
    return {
      hours: round2(hours),
      available: round2(available),
      ratio: available > 0 ? hours / available : null,
      state: loadState(hours, available, away),
      vacationDays,
      holidayNames,
      inactive,
    };
  }

  // Projekt- und Teilprojektzeilen zeigen Stunden, keine Auslastung.
  let hours = 0;
  const subs = row.kind === "sub" ? [row.sub!] : (row.project?.subs ?? []);
  for (const sub of subs) {
    for (const week of column.weeks) hours += subprojectHoursIn(input, sub.id, week);
  }
  return {
    hours: round2(hours),
    available: 0,
    ratio: null,
    state: hours > 0 ? "good" : "empty",
    vacationDays: 0,
    holidayNames: [],
    inactive: false,
  };
}
