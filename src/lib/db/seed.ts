import { config } from "dotenv";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { addWeeks, todayWeek, weekRange } from "../weeks";
import * as s from "./schema";

config({ path: ".env.local" });
config();

/**
 * Erfundene, aber plausible Startdaten — damit beim ersten Öffnen ein
 * gefülltes Raster steht und nicht ein leeres Gitter mit einem Hinweis.
 */

// Kleiner deterministischer Zufall, damit jeder Lauf dieselben Daten baut.
let seedState = 20260801;
const rnd = () => ((seedState = (seedState * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

type SeedPerson = { name: string; net: number; land?: string; note?: string };

const PEOPLE: SeedPerson[] = [
  { name: "Anna Reuter", net: 34, note: "Senior, Formular-Engine" },
  { name: "Ben Kasparek", net: 27, note: "Teilzeit, 4 Tage" },
  { name: "Cem Yildiz", net: 34, note: "Senior, Regelwerk" },
  { name: "Doreen Falk", net: 25, note: "Teilzeit" },
  { name: "Erik Mbeki", net: 34 },
  { name: "Frauke Lind", net: 20, note: "Teilzeit, 3 Tage" },
  { name: "Gregor Hansen", net: 34, note: "Schnittstellen" },
  { name: "Hanna Vogt", net: 34 },
  { name: "Ilias Petrou", net: 30, land: "DE-HE" },
  { name: "Jonas Brehm", net: 34, note: "Junior" },
  { name: "Katrin Suhr", net: 26, note: "Teilzeit" },
  { name: "Lasse Oderbruch", net: 34 },
  { name: "Mira Ashrafi", net: 32, land: "PT", note: "arbeitet aus Portugal" },
  { name: "Nils Wegener", net: 34, note: "Junior" },
  { name: "Olga Rempel", net: 28, note: "Teilzeit" },
  { name: "Paul Tietjen", net: 34, land: "DE-NI" },
  { name: "Rike Sandmann", net: 22, note: "Werkstudentin" },
];

type SeedProject = {
  name: string;
  client: string;
  status: "confirmed" | "offer";
  subs: { name: string; budget?: number; actual?: number; openEnded?: boolean; weeksLong?: number }[];
};

const PROJECTS: SeedProject[] = [
  {
    name: "Antragsstrecke",
    client: "Nordlicht Versicherung",
    status: "confirmed",
    subs: [
      { name: "Formular-Engine", budget: 720, actual: 410, weeksLong: 34 },
      { name: "Regelwerk", budget: 480, actual: 260, weeksLong: 28 },
      { name: "Schnittstellen", budget: 300, actual: 95, weeksLong: 20 },
    ],
  },
  {
    name: "Kundenportal",
    client: "Stadtwerke Ostheim",
    status: "confirmed",
    subs: [
      { name: "Migration Bestandsdaten", budget: 540, actual: 380, weeksLong: 24 },
      { name: "Self-Service-Strecke", budget: 620, actual: 140, weeksLong: 30 },
    ],
  },
  {
    name: "Schadenmeldung",
    client: "Kranich Assekuranz",
    status: "confirmed",
    subs: [
      { name: "Prozessdesign", budget: 180, actual: 176, weeksLong: 12 },
      { name: "Umsetzung", budget: 640, actual: 210, weeksLong: 32 },
    ],
  },
  {
    name: "Onboarding-Strecke",
    client: "Bürgerbank Ostheim",
    status: "confirmed",
    subs: [{ name: "Umsetzung", budget: 380, actual: 300, weeksLong: 18 }],
  },
  {
    name: "Wartung & Support",
    client: "intern",
    status: "confirmed",
    subs: [
      { name: "Laufender Betrieb", openEnded: true },
      { name: "Rufbereitschaft", openEnded: true },
    ],
  },
  {
    name: "Interne Plattform",
    client: "intern",
    status: "confirmed",
    subs: [{ name: "Komponenten-Bibliothek", openEnded: true }],
  },
  {
    name: "Datenmigration",
    client: "Hanse Versicherung",
    status: "confirmed",
    subs: [
      { name: "Extraktion", budget: 260, actual: 240, weeksLong: 14 },
      { name: "Ladepipeline", budget: 340, actual: 60, weeksLong: 22 },
    ],
  },
  {
    name: "Schulung & Enablement",
    client: "intern",
    status: "confirmed",
    subs: [{ name: "Workshops", openEnded: true }],
  },
  {
    name: "Kundenportal",
    client: "Meridian Versicherung",
    status: "offer",
    subs: [
      { name: "Konzept", budget: 120, weeksLong: 8 },
      { name: "Umsetzung", budget: 800, weeksLong: 30 },
    ],
  },
  {
    name: "Bestandsmigration",
    client: "Falkenberg Leben",
    status: "offer",
    subs: [{ name: "Analyse", budget: 160, weeksLong: 10 }],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt.");

  // Dieses Skript beginnt mit einem truncate. Gegen alles, was nicht die
  // eigene Maschine ist, läuft es nur mit ausdrücklichem Wunsch.
  const local = /(^|@)(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);
  if (!local && process.env.ARIANE_SEED_FORCE !== "ja") {
    throw new Error(
      "Das Seed-Skript leert alle Tabellen und zeigt hier nicht auf localhost. " +
        "Wenn das wirklich gewollt ist: ARIANE_SEED_FORCE=ja setzen.",
    );
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema: s });

  console.log("[seed] leere Tabellen …");
  await sql`truncate table assignment, team_slot, absence, person_capacity, subproject, project, person, setting restart identity cascade`;

  const start = addWeeks(todayWeek(), -12);
  const end = addWeeks(todayWeek(), 44);
  const weeks = weekRange(start, end);

  /* ── Personen ─────────────────────────────────────────────────────── */
  const people = await db
    .insert(s.person)
    .values(
      PEOPLE.map((p, i) => ({
        name: p.name,
        initials: p.name
          .split(" ")
          .map((w) => w[0])
          .join(""),
        region: p.land ?? "",
        note: p.note ?? "",
        sort: i,
      })),
    )
    .returning();

  await db.insert(s.personCapacity).values(
    people.map((row, i) => ({
      personId: row.id,
      validFrom: addWeeks(todayWeek(), -80),
      netHours: String(PEOPLE[i].net),
    })),
  );

  // Eine Person geht im Herbst auf Teilzeit — zeigt die Stichtags-Logik.
  const goingPartTime = people[7];
  await db.insert(s.personCapacity).values({
    personId: goingPartTime.id,
    validFrom: addWeeks(todayWeek(), 10),
    netHours: "22",
  });

  /* ── Urlaub ───────────────────────────────────────────────────────── */
  const absences: { personId: string; week: string; days: string }[] = [];
  for (const row of people) {
    const count = between(2, 4);
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const week = pick(weeks);
      if (used.has(week)) continue;
      used.add(week);
      absences.push({ personId: row.id, week, days: String(pick([2, 3, 5, 5, 5])) });
    }
  }
  await db.insert(s.absence).values(absences);

  /* ── Projekte ─────────────────────────────────────────────────────── */
  const subRows: { id: string; projectId: string; openEnded: boolean; from: string; to: string }[] = [];

  for (const [pi, proj] of PROJECTS.entries()) {
    const [projectRow] = await db
      .insert(s.project)
      .values({ name: proj.name, client: proj.client, status: proj.status, sort: pi })
      .returning();

    for (const [si, sub] of proj.subs.entries()) {
      const offset = sub.openEnded ? -12 : between(-10, 6);
      const from = addWeeks(todayWeek(), offset);
      const to = sub.openEnded ? end : addWeeks(from, sub.weeksLong ?? 20);
      const [subRow] = await db
        .insert(s.subproject)
        .values({
          projectId: projectRow.id,
          name: sub.name,
          startsOn: sub.openEnded ? null : from,
          endsOn: sub.openEnded ? null : to,
          openEnded: !!sub.openEnded,
          budgetHours: sub.budget ? String(sub.budget) : null,
          actualHours: sub.actual ? String(sub.actual) : null,
          actualAsOf: sub.actual ? todayWeek() : null,
          sort: si,
        })
        .returning();
      subRows.push({
        id: subRow.id,
        projectId: projectRow.id,
        openEnded: !!sub.openEnded,
        from,
        to: to > end ? end : to,
      });
    }
  }

  /* ── Zuweisungen ──────────────────────────────────────────────────── */
  const slots: { personId: string; subprojectId: string }[] = [];
  const hours: { personId: string; subprojectId: string; week: string; hours: string }[] = [];

  const maintenance = subRows.filter((r) => r.openEnded);
  const delivery = subRows.filter((r) => !r.openEnded);

  for (const [i, row] of people.entries()) {
    const net = PEOPLE[i].net;

    // Fast jeder hat einen kleinen Sockel im laufenden Betrieb.
    if (i % 3 !== 2) {
      const sub = maintenance[i % maintenance.length];
      slots.push({ personId: row.id, subprojectId: sub.id });
      const h = pick([2, 4, 4, 6]);
      for (const w of weekRange(sub.from, sub.to)) {
        hours.push({ personId: row.id, subprojectId: sub.id, week: w, hours: String(h) });
      }
    }

    // Dazu ein bis zwei Lieferprojekte.
    const count = between(1, 2);
    const taken = new Set<string>();
    for (let k = 0; k < count; k++) {
      const sub = delivery[(i * 3 + k * 5 + between(0, 2)) % delivery.length];
      if (taken.has(sub.id)) continue;
      taken.add(sub.id);
      slots.push({ personId: row.id, subprojectId: sub.id });

      const span = weekRange(sub.from, sub.to);
      const base = Math.max(4, Math.round((net * pick([0.4, 0.5, 0.6, 0.7])) / 2) * 2);
      for (const [wi, w] of span.entries()) {
        // Anlauf, Hochphase, Ausklang statt einer flachen Linie.
        const t = span.length > 1 ? wi / (span.length - 1) : 0.5;
        const shape = t < 0.15 ? 0.5 : t > 0.85 ? 0.4 : 1;
        const value = Math.round(base * shape * pick([0.9, 1, 1, 1.15]));
        if (value <= 0) continue;
        hours.push({ personId: row.id, subprojectId: sub.id, week: w, hours: String(value) });
      }
    }
  }

  // Ein paar bewusste Überlastungen, damit Rot im Raster vorkommt.
  const hotspot = people[0];
  const hotSub = delivery[1];
  if (!slots.some((x) => x.personId === hotspot.id && x.subprojectId === hotSub.id)) {
    slots.push({ personId: hotspot.id, subprojectId: hotSub.id });
  }
  for (const w of weekRange(addWeeks(todayWeek(), 2), addWeeks(todayWeek(), 6))) {
    hours.push({ personId: hotspot.id, subprojectId: hotSub.id, week: w, hours: "14" });
  }

  await db.insert(s.teamSlot).values(dedupeSlots(slots));
  await db.insert(s.assignment).values(mergeHours(hours));

  await db.insert(s.setting).values([
    { key: "weeksBack", value: "8" },
    { key: "weeksForward", value: "44" },
    { key: "defaultRegion", value: "DE-NW" },
  ]);

  await sql.end();
  console.log(
    `[seed] ${people.length} Personen, ${PROJECTS.length} Projekte, ${subRows.length} Teilprojekte, ${mergeHours(hours).length} Wochenwerte`,
  );
}

function dedupeSlots(list: { personId: string; subprojectId: string }[]) {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = `${x.personId}:${x.subprojectId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function mergeHours(list: { personId: string; subprojectId: string; week: string; hours: string }[]) {
  const map = new Map<string, { personId: string; subprojectId: string; week: string; hours: string }>();
  for (const row of list) {
    const key = `${row.personId}:${row.subprojectId}:${row.week}`;
    const prev = map.get(key);
    if (prev) prev.hours = String(Number(prev.hours) + Number(row.hours));
    else map.set(key, { ...row });
  }
  return [...map.values()];
}

main().catch((err) => {
  console.error("[seed] fehlgeschlagen:", err);
  process.exit(1);
});
