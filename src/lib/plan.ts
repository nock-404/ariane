import "server-only";

import { and, asc, inArray, isNull } from "drizzle-orm";

import { db } from "./db";
import * as s from "./db/schema";
import { DEFAULT_REGION, holidayWeeks } from "./holidays";
import type { PlanData, PlanProject } from "./capacity";
import { addWeeks, parseDay, todayWeek, weekRange } from "./weeks";

const WEEKS_BACK = 8;
const WEEKS_FORWARD = 60;

/**
 * Ein Aufruf, ein Datensatz. Das Raster ist mit einem üblichen Team und gut
 * hundert Wochen klein genug, um alles auf einmal zu laden — jede
 * Nachladerei würde das Bedienen nur zäh machen.
 */
export async function loadPlan(): Promise<PlanData> {
  const today = todayWeek();
  const from = addWeeks(today, -WEEKS_BACK);
  const to = addWeeks(today, WEEKS_FORWARD);
  const weeks = weekRange(from, to);

  const [people, caps, absences, projects, subs, settings] = await Promise.all([
    db.select().from(s.person).where(isNull(s.person.archivedAt)).orderBy(asc(s.person.sort), asc(s.person.name)),
    db.select().from(s.personCapacity).orderBy(asc(s.personCapacity.validFrom)),
    db.select().from(s.absence),
    db.select().from(s.project).where(isNull(s.project.archivedAt)).orderBy(asc(s.project.sort), asc(s.project.name)),
    db.select().from(s.subproject).where(isNull(s.subproject.archivedAt)).orderBy(asc(s.subproject.sort)),
    db.select().from(s.setting),
  ]);

  const defaultRegion =
    settings.find((row) => row.key === "defaultRegion")?.value || DEFAULT_REGION;

  // Zuweisungen nur zu dem, was auch sichtbar ist. Sonst zählen die Stunden
  // eines archivierten Teilprojekts weiter in die Auslastung, und die
  // Summenzeile ist größer als die Summe ihrer sichtbaren Kinder.
  const livePeople = people.map((p) => p.id);
  const liveProjects = new Set(projects.map((p) => p.id));
  const liveSubs = subs.filter((sub) => liveProjects.has(sub.projectId)).map((sub) => sub.id);

  const [slots, assignments] =
    livePeople.length === 0 || liveSubs.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select()
            .from(s.teamSlot)
            .where(
              and(
                inArray(s.teamSlot.personId, livePeople),
                inArray(s.teamSlot.subprojectId, liveSubs),
              ),
            ),
          db
            .select()
            .from(s.assignment)
            .where(
              and(
                inArray(s.assignment.personId, livePeople),
                inArray(s.assignment.subprojectId, liveSubs),
              ),
            ),
        ]);

  const capsByPerson = new Map<string, { id: string; validFrom: string; netHours: number }[]>();
  for (const row of caps) {
    const list = capsByPerson.get(row.personId) ?? [];
    list.push({ id: row.id, validFrom: row.validFrom, netHours: Number(row.netHours) });
    capsByPerson.set(row.personId, list);
  }

  const absByPerson = new Map<string, Record<string, number>>();
  for (const row of absences) {
    const map = absByPerson.get(row.personId) ?? {};
    map[row.week] = Number(row.days);
    absByPerson.set(row.personId, map);
  }

  const planPeople = people.map((p) => ({
    id: p.id,
    name: p.name,
    initials: p.initials,
    region: p.region || defaultRegion,
    regionOwn: p.region,
    note: p.note,
    sort: p.sort,
    caps: capsByPerson.get(p.id) ?? [],
    absences: absByPerson.get(p.id) ?? {},
  }));

  const subsByProject = new Map<string, PlanProject["subs"]>();
  for (const row of subs) {
    if (!liveProjects.has(row.projectId)) continue;
    const list = subsByProject.get(row.projectId) ?? [];
    list.push({
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      openEnded: row.openEnded,
      budgetHours: row.budgetHours === null ? null : Number(row.budgetHours),
      actualHours: row.actualHours === null ? null : Number(row.actualHours),
      actualAsOf: row.actualAsOf,
      sort: row.sort,
    });
    subsByProject.set(row.projectId, list);
  }

  const planProjects: PlanProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client,
    status: p.status === "offer" ? "offer" : "confirmed",
    sort: p.sort,
    subs: subsByProject.get(p.id) ?? [],
  }));

  const hours: PlanData["hours"] = {};
  for (const row of assignments) {
    if (row.week < from || row.week > to) continue;
    const key = `${row.personId}:${row.subprojectId}`;
    (hours[key] ??= {})[row.week] = Number(row.hours);
  }

  const years = new Set<number>();
  for (const w of [from, to]) years.add(parseDay(w).getUTCFullYear());
  years.add(parseDay(from).getUTCFullYear() + 1);
  const yearList = [...years].sort();

  const holidays: PlanData["holidays"] = {};
  for (const region of new Set(planPeople.map((p) => p.region))) {
    holidays[region] = Object.fromEntries(holidayWeeks(region, yearList));
  }

  return {
    weeks,
    defaultRegion,
    people: planPeople,
    projects: planProjects,
    slots: slots.map((x) => ({ personId: x.personId, subprojectId: x.subprojectId })),
    hours,
    holidays,
  };
}
