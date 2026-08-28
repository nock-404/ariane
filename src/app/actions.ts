"use server";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import * as t from "@/lib/db/schema";
import { requireWriter } from "@/lib/session";
import { todayWeek } from "@/lib/weeks";
import { spreadAbsence } from "@/lib/absence";
import { DEFAULT_REGION } from "@/lib/holidays";


/* ── Raster ───────────────────────────────────────────────────────────── */

export type HoursPatch = { personId: string; subprojectId: string; week: string; hours: number };

/**
 * Gesammeltes Speichern aus dem Raster. Null Stunden heißt „Zelle leer",
 * dafür wird die Zeile gelöscht statt eine Null abgelegt — sonst wächst
 * die Tabelle mit jedem Herumprobieren.
 */
export async function saveHours(patches: HoursPatch[]) {
  await requireWriter();
  if (patches.length === 0) return { ok: true as const, written: 0 };

  const remove = patches.filter((p) => p.hours <= 0);
  const upsert = patches.filter((p) => p.hours > 0);

  await db.transaction(async (tx) => {
    for (const p of remove) {
      await tx
        .delete(t.assignment)
        .where(
          and(
            eq(t.assignment.personId, p.personId),
            eq(t.assignment.subprojectId, p.subprojectId),
            eq(t.assignment.week, p.week),
          ),
        );
    }
    if (upsert.length > 0) {
      await tx
        .insert(t.assignment)
        .values(
          upsert.map((p) => ({
            personId: p.personId,
            subprojectId: p.subprojectId,
            week: p.week,
            hours: String(p.hours),
          })),
        )
        .onConflictDoUpdate({
          target: [t.assignment.personId, t.assignment.subprojectId, t.assignment.week],
          set: { hours: sql`excluded.hours` },
        });
    }
  });

  // Bewusst KEIN revalidatePath: der Client haelt den Zustand waehrend des
  // Tippens, ein Server-Refresh wuerde ihn samt Undo-Historie ueberschreiben.
  return { ok: true as const, written: patches.length };
}

export async function addSlot(personId: string, subprojectId: string) {
  await requireWriter();
  await db.insert(t.teamSlot).values({ personId, subprojectId }).onConflictDoNothing();
}

export async function removeSlot(personId: string, subprojectId: string) {
  await requireWriter();
  await db.transaction(async (tx) => {
    await tx
      .delete(t.assignment)
      .where(and(eq(t.assignment.personId, personId), eq(t.assignment.subprojectId, subprojectId)));
    await tx
      .delete(t.teamSlot)
      .where(and(eq(t.teamSlot.personId, personId), eq(t.teamSlot.subprojectId, subprojectId)));
  });
}

/** Eine ganze Zuweisung um n Wochen verschieben. */
export async function shiftSlot(personId: string, subprojectId: string, weeksBy: number) {
  await requireWriter();
  if (weeksBy === 0) return;
  const rows = await db
    .select()
    .from(t.assignment)
    .where(and(eq(t.assignment.personId, personId), eq(t.assignment.subprojectId, subprojectId)));

  const moved = rows.map((r) => {
    const d = new Date(`${r.week}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + weeksBy * 7);
    return { ...r, week: d.toISOString().slice(0, 10) };
  });

  await db.transaction(async (tx) => {
    await tx
      .delete(t.assignment)
      .where(and(eq(t.assignment.personId, personId), eq(t.assignment.subprojectId, subprojectId)));
    if (moved.length > 0) await tx.insert(t.assignment).values(moved);
  });
}

/* ── Personen ─────────────────────────────────────────────────────────── */

export async function createPerson(input: {
  name: string;
  netHours: number;
  /** Leer heißt: die Feiertagsregion des Teams. */
  region?: string;
  note?: string;
}) {
  await requireWriter();
  const initials = input.name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);

  const [row] = await db
    .insert(t.person)
    .values({
      name: input.name,
      initials,
      region: input.region ?? "",
      note: input.note ?? "",
      sort: 999,
    })
    .returning();

  await db.insert(t.personCapacity).values({
    personId: row.id,
    // Montag der laufenden Woche: Kapazität wird wochenweise verglichen,
    // ein Mittwochsdatum ließe die Person bis Sonntag mit null Stunden
    // und „U" im Raster stehen.
    validFrom: todayWeek(),
    netHours: String(input.netHours),
  });

  revalidatePath("/", "layout");
  return row.id;
}

export async function updatePerson(
  id: string,
  input: { name?: string; region?: string; note?: string },
) {
  await requireWriter();
  await db.update(t.person).set(input).where(eq(t.person.id, id));
  revalidatePath("/", "layout");
}

export async function archivePerson(id: string) {
  await requireWriter();
  await db.update(t.person).set({ archivedAt: new Date() }).where(eq(t.person.id, id));
  revalidatePath("/", "layout");
}

export async function setCapacity(personId: string, validFrom: string, netHours: number) {
  await requireWriter();
  const existing = await db
    .select()
    .from(t.personCapacity)
    .where(and(eq(t.personCapacity.personId, personId), eq(t.personCapacity.validFrom, validFrom)));

  if (existing.length > 0) {
    await db
      .update(t.personCapacity)
      .set({ netHours: String(netHours) })
      .where(eq(t.personCapacity.id, existing[0].id));
  } else {
    await db
      .insert(t.personCapacity)
      .values({ personId, validFrom, netHours: String(netHours) });
  }
  revalidatePath("/", "layout");
}

export async function removeCapacity(id: string) {
  await requireWriter();
  await db.delete(t.personCapacity).where(eq(t.personCapacity.id, id));
  revalidatePath("/", "layout");
}

export async function setAbsence(personId: string, week: string, days: number) {
  await requireWriter();
  if (days <= 0) {
    await db
      .delete(t.absence)
      .where(and(eq(t.absence.personId, personId), eq(t.absence.week, week)));
  } else {
    await db
      .insert(t.absence)
      .values({ personId, week, days: String(Math.min(5, days)) })
      .onConflictDoUpdate({
        target: [t.absence.personId, t.absence.week],
        set: { days: String(Math.min(5, days)) },
      });
  }
  revalidatePath("/", "layout");
}

/** Urlaub über mehrere Wochen am Stück eintragen. */
export async function setAbsenceRange(personId: string, weeks: string[], days: number) {
  await requireWriter();
  if (weeks.length === 0) return;
  if (days <= 0) {
    await db
      .delete(t.absence)
      .where(and(eq(t.absence.personId, personId), inArray(t.absence.week, weeks)));
  } else {
    await db
      .insert(t.absence)
      .values(weeks.map((week) => ({ personId, week, days: String(Math.min(5, days)) })))
      .onConflictDoUpdate({
        target: [t.absence.personId, t.absence.week],
        set: { days: String(Math.min(5, days)) },
      });
  }
  revalidatePath("/", "layout");
}

/**
 * Urlaub als Zeitraum: „5. bis 14. August". Die Tage je Woche rechnet die
 * App aus — Wochenenden und Feiertage zählen nicht mit.
 */
export async function setAbsenceDates(personId: string, fromDay: string, toDay: string) {
  await requireWriter();

  const [row] = await db.select().from(t.person).where(eq(t.person.id, personId));
  if (!row) throw new Error("Person nicht gefunden.");

  const spread = spreadAbsence(fromDay, toDay, row.region || (await teamRegion()));
  const entries = Object.entries(spread.perWeek);
  if (entries.length === 0) return { days: 0, weeks: 0 };

  // Vorhandene Tage derselben Woche werden ergänzt, nicht überschrieben —
  // zwei getrennte Urlaube in einer Woche sind möglich.
  const existing = await db
    .select()
    .from(t.absence)
    .where(and(eq(t.absence.personId, personId), inArray(t.absence.week, entries.map(([w]) => w))));
  const before = new Map(existing.map((e) => [e.week, Number(e.days)]));

  await db
    .insert(t.absence)
    .values(
      entries.map(([week, days]) => ({
        personId,
        week,
        days: String(Math.min(5, (before.get(week) ?? 0) + days)),
      })),
    )
    .onConflictDoUpdate({
      target: [t.absence.personId, t.absence.week],
      set: { days: sql`excluded.days` },
    });

  revalidatePath("/", "layout");
  return { days: spread.days, weeks: entries.length };
}

/* ── Projekte ─────────────────────────────────────────────────────────── */

export async function createProject(input: {
  name: string;
  client: string;
  status: "confirmed" | "offer";
}) {
  await requireWriter();
  const [row] = await db.insert(t.project).values({ ...input, sort: 999 }).returning();
  revalidatePath("/", "layout");
  return row.id;
}

export async function updateProject(
  id: string,
  input: { name?: string; client?: string; status?: "confirmed" | "offer" },
) {
  await requireWriter();
  await db.update(t.project).set(input).where(eq(t.project.id, id));
  revalidatePath("/", "layout");
}

export async function archiveProject(id: string) {
  await requireWriter();
  await db.update(t.project).set({ archivedAt: new Date() }).where(eq(t.project.id, id));
  revalidatePath("/", "layout");
}

export async function createSubproject(input: {
  projectId: string;
  name: string;
  startsOn?: string | null;
  endsOn?: string | null;
  openEnded?: boolean;
  budgetHours?: number | null;
}) {
  await requireWriter();
  const [row] = await db
    .insert(t.subproject)
    .values({
      projectId: input.projectId,
      name: input.name,
      startsOn: input.openEnded ? null : (input.startsOn ?? null),
      endsOn: input.openEnded ? null : (input.endsOn ?? null),
      openEnded: input.openEnded ?? false,
      budgetHours: input.budgetHours == null ? null : String(input.budgetHours),
      sort: 999,
    })
    .returning();
  revalidatePath("/", "layout");
  return row.id;
}

export async function updateSubproject(
  id: string,
  input: {
    name?: string;
    startsOn?: string | null;
    endsOn?: string | null;
    openEnded?: boolean;
    budgetHours?: number | null;
    actualHours?: number | null;
  },
) {
  await requireWriter();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.openEnded !== undefined) patch.openEnded = input.openEnded;
  if (input.startsOn !== undefined) patch.startsOn = input.startsOn;
  if (input.endsOn !== undefined) patch.endsOn = input.endsOn;
  if (input.budgetHours !== undefined)
    patch.budgetHours = input.budgetHours == null ? null : String(input.budgetHours);
  if (input.actualHours !== undefined) {
    patch.actualHours = input.actualHours == null ? null : String(input.actualHours);
    patch.actualAsOf = input.actualHours == null ? null : todayWeek();
  }
  await db.update(t.subproject).set(patch).where(eq(t.subproject.id, id));
  revalidatePath("/", "layout");
}

export async function archiveSubproject(id: string) {
  await requireWriter();
  await db.update(t.subproject).set({ archivedAt: new Date() }).where(eq(t.subproject.id, id));
  revalidatePath("/", "layout");
}

/* ── Sonstiges ────────────────────────────────────────────────────────── */

/** Wochenwerte eines Teilprojekts in einem Bereich löschen. */
export async function clearRange(
  personId: string,
  subprojectId: string,
  fromWeek: string,
  toWeek: string,
) {
  await requireWriter();
  await requireWriter();
  await db
    .delete(t.assignment)
    .where(
      and(
        eq(t.assignment.personId, personId),
        eq(t.assignment.subprojectId, subprojectId),
        gte(t.assignment.week, fromWeek),
        lte(t.assignment.week, toWeek),
      ),
    );
}

/** Feiertagsregion des Teams — gilt für alle ohne eigenen Eintrag. */
export async function setDefaultRegion(code: string) {
  await requireWriter();
  await db
    .insert(t.setting)
    .values({ key: "defaultRegion", value: code })
    .onConflictDoUpdate({ target: t.setting.key, set: { value: code } });
  revalidatePath("/", "layout");
}

async function teamRegion(): Promise<string> {
  const [row] = await db.select().from(t.setting).where(eq(t.setting.key, "defaultRegion"));
  return row?.value || DEFAULT_REGION;
}

/* ── Reihenfolge ──────────────────────────────────────────────────────── */

/**
 * Reihenfolge per Ziehen. Die Liste kommt komplett und in der gewünschten
 * Folge — daraus wird schlicht der Index geschrieben.
 */
export async function reorderPeople(ids: string[]) {
  await requireWriter();
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(t.person).set({ sort: index }).where(eq(t.person.id, id));
    }
  });
  revalidatePath("/", "layout");
}

export async function reorderProjects(ids: string[]) {
  await requireWriter();
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(t.project).set({ sort: index }).where(eq(t.project.id, id));
    }
  });
  revalidatePath("/", "layout");
}

export async function reorderSubprojects(ids: string[]) {
  await requireWriter();
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(t.subproject).set({ sort: index }).where(eq(t.subproject.id, id));
    }
  });
  revalidatePath("/", "layout");
}
