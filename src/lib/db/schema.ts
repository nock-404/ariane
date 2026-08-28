import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ── Menschen ─────────────────────────────────────────────────────────── */

export const person = pgTable("person", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  /** Kürzel für enge Ansichten, z.B. "AR". */
  initials: text("initials").notNull().default(""),
  /** Feiertagsregion: "DE-NW", "PT", "LU" … Leer heißt: die des Teams. */
  region: text("region").notNull().default(""),
  note: text("note").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  /** Gesetzt, wenn jemand das Team verlässt — die Vergangenheit bleibt stehen. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Netto-Kapazität pro Woche, ab einem Stichtag gültig. Kein valid_to —
 * es gilt immer der jüngste Eintrag, dessen Stichtag nicht in der Zukunft
 * liegt. Teilzeitwechsel ist damit eine neue Zeile, kein Datenumbau.
 */
export const personCapacity = pgTable(
  "person_capacity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    validFrom: date("valid_from").notNull(),
    netHours: numeric("net_hours", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [index("person_capacity_person_idx").on(t.personId, t.validFrom)],
);

/** Urlaub in Tagen pro Person und Woche. Kein Grund, bewusst. */
export const absence = pgTable(
  "absence",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    week: date("week").notNull(),
    days: numeric("days", { precision: 3, scale: 1 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.week] })],
);

/* ── Arbeit ───────────────────────────────────────────────────────────── */

export const project = pgTable("project", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  client: text("client").notNull().default(""),
  /** "confirmed" = beauftragt, "offer" = Angebot / noch nicht beauftragt. */
  status: text("status").notNull().default("confirmed"),
  sort: integer("sort").notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subproject = pgTable(
  "subproject",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    /** Dauerläufer ohne Enddatum — laufen bis Jahresende weiter. */
    openEnded: boolean("open_ended").notNull().default(false),
    budgetHours: numeric("budget_hours", { precision: 8, scale: 1 }),
    /** Tatsächlich verbrauchte Stunden, gelegentlich von Hand nachgetragen. */
    actualHours: numeric("actual_hours", { precision: 8, scale: 1 }),
    actualAsOf: date("actual_as_of"),
    sort: integer("sort").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("subproject_project_idx").on(t.projectId, t.sort)],
);

/**
 * Eine Zeile pro Person, Teilprojekt und Woche. Flach, weil jede Woche
 * einzeln änderbar sein muss — Verschieben ist dann ein UPDATE über einen
 * Bereich und kein Modellfeature.
 */
export const assignment = pgTable(
  "assignment",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    subprojectId: uuid("subproject_id")
      .notNull()
      .references(() => subproject.id, { onDelete: "cascade" }),
    week: date("week").notNull(),
    hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.subprojectId, t.week] }),
    index("assignment_week_idx").on(t.week),
    index("assignment_sub_idx").on(t.subprojectId),
  ],
);

/**
 * Wer auf welchem Teilprojekt überhaupt steht — auch mit null Stunden,
 * damit eine frisch zugewiesene Person eine Zeile im Raster bekommt.
 */
export const teamSlot = pgTable(
  "team_slot",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    subprojectId: uuid("subproject_id")
      .notNull()
      .references(() => subproject.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.subprojectId] })],
);

/* ── Einstellungen ────────────────────────────────────────────────────── */

export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Person = typeof person.$inferSelect;
export type PersonCapacity = typeof personCapacity.$inferSelect;
export type Absence = typeof absence.$inferSelect;
export type Project = typeof project.$inferSelect;
export type Subproject = typeof subproject.$inferSelect;
export type Assignment = typeof assignment.$inferSelect;
export type TeamSlot = typeof teamSlot.$inferSelect;
