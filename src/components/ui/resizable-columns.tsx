"use client";

import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

import { usePrefs } from "@/lib/prefs";

import { ColumnResizer } from "./column-resizer";

export type ColumnDef = { id: string; label: string; width: number; align?: "left" | "right" };

/**
 * Rahmen für eine Tabelle: waagerechtes Scrollen über OverlayScrollbars,
 * niemals nativ. Solange die Spalten hineinpassen, sieht man gar nichts.
 */
export function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-soft)]">
      <OverlayScrollbarsComponent
        defer
        options={{ scrollbars: { theme: "os-theme-ariane", autoHide: "leave" }, overflow: { y: "hidden" } }}
      >
        {children}
      </OverlayScrollbarsComponent>
    </div>
  );
}

/**
 * Spaltenbreiten für gewöhnliche Tabellen. Jede Spalte lässt sich einzeln
 * ziehen und merkt sich das im Browser; Doppelklick auf den Griff setzt
 * genau diese Spalte zurück.
 */
export function useColumns(tableId: string, defs: ColumnDef[]) {
  const colW = usePrefs((s) => s.colW);
  const setColW = usePrefs((s) => s.setColW);
  const resetColW = usePrefs((s) => s.resetColW);

  const widthOf = (id: string) => colW[`${tableId}:${id}`] ?? defs.find((d) => d.id === id)!.width;

  return {
    widthOf,
    /** Muss direkt im <table> stehen, sonst greifen die Breiten nicht. */
    colgroup: (
      <colgroup>
        {defs.map((d) => (
          <col key={d.id} style={{ width: widthOf(d.id) }} />
        ))}
      </colgroup>
    ),
    header: (
      <tr className="group/head border-b border-line text-left text-[11.5px] tracking-wide text-dim uppercase">
        {defs.map((d) => (
          <th
            key={d.id}
            scope="col"
            className={`relative px-4 py-2.5 font-semibold group-hover/head:[&_[data-grip]]:before:bg-[color-mix(in_oklab,var(--ink)_30%,transparent)] ${
              d.align === "right" ? "text-right" : ""
            }`}
          >
            <span className="block truncate">{d.label}</span>
            <ColumnResizer
              label={`Breite von ${d.label}`}
              width={widthOf(d.id)}
              min={60}
              onResize={(px) => setColW(`${tableId}:${d.id}`, px, 60)}
              onReset={() => resetColW(`${tableId}:${d.id}`)}
            />
          </th>
        ))}
      </tr>
    ),
  };
}
