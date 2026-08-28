"use client";

import { create } from "zustand";
import { temporal } from "zundo";

import {
  addSlot as addSlotOnServer,
  removeSlot as removeSlotOnServer,
  reorderPeople,
  reorderProjects,
  reorderSubprojects,
  saveHours,
  type HoursPatch,
} from "@/app/actions";
import { slotKey, type PlanData } from "./capacity";
import type { WeekKey } from "./weeks";

type Slot = { personId: string; subprojectId: string };

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type PlanState = {
  hours: Record<string, Record<WeekKey, number>>;
  slots: Slot[];
};

/** Reihenfolge der Zeilen — per Ziehen änderbar, deshalb im Client gehalten. */
export type PlanOrder = {
  people: string[];
  projects: string[];
  subs: Record<string, string[]>;
};

type PlanStore = PlanState & {
  /* Nicht rückgängig machbar — gehört nicht in die Historie. */
  saveState: SaveState;
  lastError: string | null;
  pending: Map<string, HoursPatch>;

  order: PlanOrder;
  init: (data: PlanData) => void;
  movePerson: (id: string, toIndex: number) => void;
  moveProject: (id: string, toIndex: number) => void;
  moveSub: (projectId: string, id: string, toIndex: number) => void;
  setCell: (personId: string, subprojectId: string, week: WeekKey, hours: number) => void;
  fillCells: (personId: string, subprojectId: string, weeks: WeekKey[], hours: number) => void;
  /** Wochen mit je eigenem Wert setzen — ein Schritt in der Historie. */
  fillMap: (personId: string, subprojectId: string, values: Record<WeekKey, number>) => void;
  addSlot: (personId: string, subprojectId: string) => void;
  dropSlot: (personId: string, subprojectId: string) => void;
  shift: (personId: string, subprojectId: string, weeks: WeekKey[], by: number) => void;
  flush: () => Promise<void>;
  markSaveState: (state: SaveState) => void;
};

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

/** numeric(5,2) in der Datenbank — mehr als 999,99 gibt es nicht. */
const MAX_HOURS = 999;

function clampHours(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(MAX_HOURS, Math.max(0, Math.round(raw * 4) / 4));
}

function beschreibe(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export const usePlan = create<PlanStore>()(
  temporal(
    (set, get) => ({
      hours: {},
      slots: [],
      saveState: "idle",
      lastError: null,
      pending: new Map(),
      order: { people: [], projects: [], subs: {} },

      init: (data) =>
        set({
          hours: structuredClone(data.hours),
          slots: [...data.slots],
          order: {
            people: data.people.map((p) => p.id),
            projects: data.projects.map((p) => p.id),
            subs: Object.fromEntries(
              data.projects.map((p) => [p.id, p.subs.map((sub) => sub.id)]),
            ),
          },
        }),

      movePerson: (id, toIndex) => {
        const next = moveInList(get().order.people, id, toIndex);
        set((state) => ({ order: { ...state.order, people: next } }));
        void reorderPeople(next);
      },

      moveProject: (id, toIndex) => {
        const next = moveInList(get().order.projects, id, toIndex);
        set((state) => ({ order: { ...state.order, projects: next } }));
        void reorderProjects(next);
      },

      moveSub: (projectId, id, toIndex) => {
        const next = moveInList(get().order.subs[projectId] ?? [], id, toIndex);
        set((state) => ({
          order: { ...state.order, subs: { ...state.order.subs, [projectId]: next } },
        }));
        void reorderSubprojects(next);
      },

      setCell: (personId, subprojectId, week, hours) =>
        get().fillCells(personId, subprojectId, [week], hours),

      fillCells: (personId, subprojectId, weeks, hours) => {
        const value = clampHours(hours);
        const values: Record<WeekKey, number> = {};
        for (const w of weeks) values[w] = value;
        get().fillMap(personId, subprojectId, values);
      },

      fillMap: (personId, subprojectId, values) => {
        const key = slotKey(personId, subprojectId);
        const clean: Record<WeekKey, number> = {};
        for (const [week, raw] of Object.entries(values)) clean[week] = clampHours(raw);

        set((state) => {
          const next = { ...state.hours };
          const row = { ...(next[key] ?? {}) };
          for (const [week, value] of Object.entries(clean)) {
            if (value <= 0) delete row[week];
            else row[week] = value;
          }
          next[key] = row;
          return { hours: next };
        });

        const pending = get().pending;
        for (const [week, value] of Object.entries(clean)) {
          pending.set(`${key}:${week}`, { personId, subprojectId, week, hours: value });
        }
        scheduleFlush(get);
      },

      addSlot: (personId, subprojectId) =>
        set((state) =>
          state.slots.some((s) => s.personId === personId && s.subprojectId === subprojectId)
            ? state
            : { slots: [...state.slots, { personId, subprojectId }] },
        ),

      dropSlot: (personId, subprojectId) =>
        set((state) => {
          const key = slotKey(personId, subprojectId);
          const next = { ...state.hours };
          delete next[key];
          return {
            hours: next,
            slots: state.slots.filter(
              (s) => !(s.personId === personId && s.subprojectId === subprojectId),
            ),
          };
        }),

      shift: (personId, subprojectId, weeks, by) => {
        const key = slotKey(personId, subprojectId);
        const row = get().hours[key] ?? {};
        const moved: Record<WeekKey, number> = {};
        const index = new Map(weeks.map((w, i) => [w, i]));
        for (const [week, value] of Object.entries(row)) {
          const i = index.get(week);
          if (i === undefined) {
            moved[week] = value;
            continue;
          }
          const target = weeks[i + by];
          if (target) moved[target] = value;
        }
        set((state) => ({ hours: { ...state.hours, [key]: moved } }));

        const pending = get().pending;
        for (const week of weeks) {
          pending.set(`${key}:${week}`, {
            personId,
            subprojectId,
            week,
            hours: moved[week] ?? 0,
          });
        }
        scheduleFlush(get);
      },

      markSaveState: (saveState) => set({ saveState, lastError: saveState === "error" ? get().lastError : null }),

      flush: async () => {
        const { pending } = get();
        if (pending.size === 0) return;
        const batch = [...pending.values()];
        pending.clear();
        set({ saveState: "saving" });
        try {
          await saveHours(batch);
          failures = 0;
          set({ saveState: get().pending.size > 0 ? "dirty" : "saved" });
          window.setTimeout(() => {
            if (usePlan.getState().saveState === "saved") usePlan.setState({ saveState: "idle" });
          }, 1600);
        } catch (err) {
          failures += 1;
          console.error("[ariane] Speichern fehlgeschlagen", err);

          if (failures >= 3) {
            // Ein Stapel, der dreimal scheitert, ist kaputt und würde jeden
            // weiteren mit sich reißen. Lieber fallen lassen und sagen.
            failures = 0;
            set({ saveState: "error", lastError: beschreibe(err) });
            return;
          }

          for (const patch of batch) {
            pending.set(`${patch.personId}:${patch.subprojectId}:${patch.week}`, patch);
          }
          set({ saveState: "error", lastError: beschreibe(err) });
          // Von selbst noch einmal versuchen, nicht erst beim nächsten Tastendruck.
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => void usePlan.getState().flush(), 1500 * failures);
        }
      },
    }),
    {
      limit: 80,
      // Nur die fachlichen Daten wandern in die Historie.
      partialize: (state): PlanState => ({ hours: state.hours, slots: state.slots }),
      equality: (a, b) => a.hours === b.hours && a.slots === b.slots,
    },
  ),
);

// Im Entwicklungsmodus zum Nachschauen in der Konsole.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __ariane?: unknown }).__ariane = usePlan;
}

function moveInList(list: string[], id: string, toIndex: number): string[] {
  const from = list.indexOf(id);
  if (from < 0) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, id);
  return next;
}

function scheduleFlush(get: () => PlanStore) {
  get().markSaveState("dirty");
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void usePlan.getState().flush();
  }, 700);
}

/**
 * Rückgängig und Wiederherstellen müssen in die Datenbank durchschlagen.
 * zundo setzt nur den Zustand zurück; hier wird der Unterschied davor und
 * danach in Patches übersetzt und mitgeschickt — sonst zeigt der Bildschirm
 * etwas anderes als die Datenbank, und beim nächsten Laden ist die
 * Rücknahme verpufft.
 */
export function undoStep() {
  applyHistory(() => usePlan.temporal.getState().undo());
}

export function redoStep() {
  applyHistory(() => usePlan.temporal.getState().redo());
}

function applyHistory(step: () => void) {
  const before = usePlan.getState();
  const beforeHours = before.hours;
  const beforeSlots = before.slots;

  step();

  const after = usePlan.getState();
  enqueueHourDiff(beforeHours, after.hours);
  syncSlotDiff(beforeSlots, after.slots);
  if (usePlan.getState().pending.size > 0) void usePlan.getState().flush();
}

function enqueueHourDiff(
  before: Record<string, Record<WeekKey, number>>,
  after: Record<string, Record<WeekKey, number>>,
) {
  const pending = usePlan.getState().pending;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const [personId, subprojectId] = key.split(":");
    if (!personId || !subprojectId) continue;
    const a = before[key] ?? {};
    const b = after[key] ?? {};
    for (const week of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const from = a[week] ?? 0;
      const to = b[week] ?? 0;
      if (from === to) continue;
      pending.set(`${key}:${week}`, { personId, subprojectId, week, hours: to });
    }
  }
  if (pending.size > 0) usePlan.getState().markSaveState("dirty");
}

function syncSlotDiff(before: Slot[], after: Slot[]) {
  const key = (s: Slot) => `${s.personId}:${s.subprojectId}`;
  const had = new Set(before.map(key));
  const has = new Set(after.map(key));

  for (const slot of after) {
    if (!had.has(key(slot))) void addSlotOnServer(slot.personId, slot.subprojectId);
  }
  for (const slot of before) {
    if (!has.has(key(slot))) void removeSlotOnServer(slot.personId, slot.subprojectId);
  }
}

/** Vor dem Schließen noch offene Änderungen wegschreiben. */
export function attachUnloadGuard() {
  if (typeof window === "undefined") return () => {};
  const handler = (e: BeforeUnloadEvent) => {
    if (usePlan.getState().pending.size > 0) {
      void usePlan.getState().flush();
      e.preventDefault();
    }
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}
