"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_THEME } from "./themes";

export type ViewMode = "people" | "projects";
export type Unit = "hours" | "percent";
export type Zoom = "week" | "month";

type Prefs = {
  view: ViewMode;
  unit: Unit;
  zoom: Zoom;
  /** Angebote in die Auslastung einrechnen. Standard: nein. */
  includeOffers: boolean;
  expanded: Record<string, boolean>;
  showRoster: boolean;
  /** Spaltenbreite in Pixel, getrennt für Wochen- und Monatsraster. */
  cellW: { week: number; month: number };
  /** Breite der Namensspalte. */
  labelW: number;
  /** Farbthema, siehe src/lib/themes.ts. */
  skin: string;
  /**
   * Einzelne Spaltenbreiten, überall in der App. Schlüssel ist
   * `<tabelle>:<spalte>` — im Raster `raster:<wochen- oder monatsschlüssel>`.
   * Was hier nicht steht, nimmt die Standardbreite.
   */
  colW: Record<string, number>;

  setView: (v: ViewMode) => void;
  setUnit: (u: Unit) => void;
  setZoom: (z: Zoom) => void;
  toggleOffers: () => void;
  toggleRow: (id: string) => void;
  setExpanded: (ids: string[], open: boolean) => void;
  toggleRoster: () => void;
  setCellW: (zoom: Zoom, px: number) => void;
  nudgeCellW: (zoom: Zoom, by: number) => void;
  setLabelW: (px: number) => void;
  setSkin: (id: string) => void;
  setColW: (key: string, px: number, min?: number) => void;
  nudgeAllColW: (prefix: string, by: number) => void;
  resetColW: (prefix: string) => void;
};

export const CELL_MIN = 26;
export const CELL_MAX = 120;
export const LABEL_MIN = 180;
export const LABEL_MAX = 520;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      view: "people",
      unit: "hours",
      zoom: "week",
      includeOffers: false,
      expanded: {},
      showRoster: true,
      cellW: { week: 46, month: 62 },
      labelW: 300,
      skin: DEFAULT_THEME,
      colW: {},

      setView: (view) => set({ view }),
      setUnit: (unit) => set({ unit }),
      setZoom: (zoom) => set({ zoom }),
      toggleOffers: () => set((s) => ({ includeOffers: !s.includeOffers })),
      toggleRow: (id) => set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
      setExpanded: (ids, open) =>
        set((s) => {
          const next = { ...s.expanded };
          for (const id of ids) next[id] = open;
          return { expanded: next };
        }),
      toggleRoster: () => set((s) => ({ showRoster: !s.showRoster })),
      setCellW: (zoom, px) =>
        set((s) => ({ cellW: { ...s.cellW, [zoom]: clamp(px, CELL_MIN, CELL_MAX) } })),
      nudgeCellW: (zoom, by) =>
        set((s) => ({ cellW: { ...s.cellW, [zoom]: clamp(s.cellW[zoom] + by, CELL_MIN, CELL_MAX) } })),
      setLabelW: (px) => set({ labelW: clamp(px, LABEL_MIN, LABEL_MAX) }),
      setSkin: (skin) => set({ skin }),

      setColW: (key, px, min = CELL_MIN) =>
        set((s) => ({ colW: { ...s.colW, [key]: clamp(px, min, 720) } })),

      nudgeAllColW: (prefix, by) =>
        set((s) => {
          const next = { ...s.colW };
          for (const key of Object.keys(next)) {
            if (key.startsWith(prefix)) next[key] = clamp(next[key] + by, CELL_MIN, 720);
          }
          return { colW: next };
        }),

      resetColW: (prefix) =>
        set((s) => ({
          colW: Object.fromEntries(Object.entries(s.colW).filter(([k]) => !k.startsWith(prefix))),
        })),
    }),
    { name: "ariane-ansicht", version: 4 },
  ),
);
