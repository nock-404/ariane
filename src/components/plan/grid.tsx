"use client";

import { CalendarOff, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from "overlayscrollbars-react";

import { capacityOf, netHoursAt, type PlanData } from "@/lib/capacity";
import { projectColorMap } from "@/lib/colors";
import { toast } from "sonner";

import { usePrefs } from "@/lib/prefs";
import {
  buildColumns,
  buildPeopleRows,
  buildProjectRows,
  cellFor,
  fmt,
  subStatusIndex,
  type Cell,
  type Column,
  type Row,
} from "@/lib/rows";
import { usePlan } from "@/lib/store";
import { todayWeek, weekSpanLabel } from "@/lib/weeks";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { ColumnResizer } from "@/components/ui/column-resizer";

import styles from "./grid.module.css";

type Props = {
  data: PlanData;
  onRemoveSlot: (personId: string, subprojectId: string) => void;
  onDropPerson: (personId: string, subprojectId: string) => void;
  /** Reicht die Sprungfunktionen nach oben. */
  onReady?: (api: { toToday: () => void; toPerson: (personId: string) => void }) => void;
  /** Zeile per Ziehen umsortiert: verschiebe `draggedId` an die Stelle von `targetId`. */
  onReorder: (kind: "person" | "project" | "sub", draggedId: string, targetId: string, parentId?: string) => void;
  /** Lesezugang: sehen und exportieren, aber nichts ändern. */
  readOnly?: boolean;
  /** Urlaub für diese Person eintragen. */
  onAskAbsence: (personId: string) => void;
};

type Focus = { rowId: string; col: number } | null;

export function Grid({ data, onRemoveSlot, onDropPerson, onReady, onReorder, onAskAbsence, readOnly = false }: Props) {
  const hours = usePlan((s) => s.hours);
  const slots = usePlan((s) => s.slots);
  const fillMap = usePlan((s) => s.fillMap);
  const shiftAssignment = usePlan((s) => s.shift);

  const order = usePlan((s) => s.order);
  const {
    view, unit, zoom, includeOffers, expanded, toggleRow,
    cellW, labelW, setLabelW, colW, setColW, resetColW,
  } = usePrefs();

  const [focus, setFocus] = useState<Focus>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<OverlayScrollbarsComponentRef>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Nach Enter oder Tab ist bereits uebernommen — das folgende blur darf
  // nicht ein zweites Mal schreiben, sonst steht ein Schritt doppelt in der
  // Historie und Rueckgaengig scheint wirkungslos.
  const alreadyCommitted = useRef(false);

  const columns = useMemo(() => buildColumns(data.weeks, zoom), [data.weeks, zoom]);
  const subStatus = useMemo(() => subStatusIndex(data.projects), [data.projects]);

  const rows = useMemo(() => {
    const input = { data, hours, slots, includeOffers, expanded, order };
    const built = view === "people" ? buildPeopleRows(input) : buildProjectRows(input);
    return readOnly ? built.map((r) => ({ ...r, editable: false })) : built;
  }, [data, hours, slots, includeOffers, expanded, order, view, readOnly]);

  const subOptions = useMemo(
    () =>
      data.projects.flatMap((project) =>
        project.subs.map((sub) => ({
          id: sub.id,
          label: sub.name,
          hint: project.client ? `${project.name} · ${project.client}` : project.name,
        })),
      ),
    [data.projects],
  );

  /** Breite je Spalte: eigener Wert, sonst die Standardbreite. */
  const base = cellW[zoom];
  const widthOf = useCallback(
    (key: string) => colW[`raster:${key}`] ?? base,
    [colW, base],
  );

  /**
   * Die Vorlage steht einmal am Rahmen; Kopf und alle Zeilen greifen darauf
   * zu, sonst laufen sie auseinander.
   *
   * Der fr-Anteil ist die Breite selbst, nicht 1 — sonst würde freie Fläche
   * gleichmäßig verteilt und alle Spalten wären wieder gleich breit, egal
   * was man an einer einzelnen gezogen hat.
   */
  const template = useMemo(
    () => columns.map((c) => `minmax(${widthOf(c.key)}px, ${widthOf(c.key)}fr)`).join(" "),
    [columns, widthOf],
  );

  const colorOf = useMemo(
    () => projectColorMap(order.projects.length ? order.projects : data.projects.map((p) => p.id)),
    [order.projects, data.projects],
  );

  const cellInput = useMemo(
    () => ({ data, hours, slots, includeOffers }),
    [data, hours, slots, includeOffers],
  );

  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows]);


  /* ── Tastatur ─────────────────────────────────────────────────────── */

  /** Nach dem Bearbeiten zurück aufs Raster, sonst greifen die Tasten nicht. */
  const focusGrid = useCallback(() => {
    scrollerRef.current?.getElement()?.focus({ preventScroll: true });
  }, []);


  const move = useCallback(
    (dRow: number, dCol: number, extend = false) => {
      setFocus((prev) => {
        if (!prev) return prev;
        let index = rowIndex.get(prev.rowId) ?? 0;
        let col = prev.col;

        if (dCol !== 0) {
          col = Math.max(0, Math.min(columns.length - 1, col + dCol));
        }
        if (dRow !== 0) {
          // Nur beschreibbare Zeilen anspringen.
          let next = index + dRow;
          while (next >= 0 && next < rows.length && !rows[next].editable) next += dRow;
          if (next >= 0 && next < rows.length) index = next;
        }
        if (!extend) setAnchor(col);
        return { rowId: rows[index]?.id ?? prev.rowId, col };
      });
    },
    [columns.length, rowIndex, rows],
  );

  const selection = useMemo(() => {
    if (!focus) return null;
    const from = Math.min(focus.col, anchor ?? focus.col);
    const to = Math.max(focus.col, anchor ?? focus.col);
    return { rowId: focus.rowId, from, to };
  }, [focus, anchor]);

  /**
   * Der eingetippte Wert gilt pro Spalte, nicht pro Auswahl — „30" über drei
   * Monate heißt dreißig je Monat. Und im Prozent-Modus bedeutet die Zahl
   * Prozent: sie wird über die Kapazität der jeweiligen Woche in Stunden
   * zurückgerechnet, sonst schriebe man 59 Stunden statt 59 Prozent.
   */
  const commit = useCallback(
    (raw: string) => {
      if (!focus || !selection) return;
      const row = rows[rowIndex.get(focus.rowId) ?? -1];
      if (!row?.editable || !row.person || !row.sub) return;

      const cleaned = raw.replace(",", ".").trim();
      const value = cleaned === "" ? 0 : Number(cleaned);
      if (Number.isNaN(value)) return;

      const perWeek: Record<string, number> = {};
      for (let c = selection.from; c <= selection.to; c++) {
        const column = columns[c];
        if (unit === "percent") {
          for (const week of column.weeks) {
            const cap = capacityOf(row.person, week, data.holidays).available;
            perWeek[week] = (cap * value) / 100;
          }
        } else if (column.weeks.length > 1) {
          const per = value / column.weeks.length;
          for (const week of column.weeks) perWeek[week] = per;
        } else {
          perWeek[column.weeks[0]] = value;
        }
      }

      fillMap(row.person.id, row.sub.id, perWeek);
    },
    [columns, data.holidays, fillMap, focus, rowIndex, rows, selection, unit],
  );

  /** Die Auswahl als Text, tab-getrennt — damit Excel als Zwischenablage taugt. */
  const selectionText = useCallback(() => {
    if (!focus || !selection) return "";
    const row = rows[rowIndex.get(focus.rowId) ?? -1];
    if (!row) return "";
    const out: string[] = [];
    for (let c = selection.from; c <= selection.to; c++) {
      const cell = cellFor(row, columns[c], cellInput, subStatus);
      out.push(cell.hours > 0 ? String(cell.hours).replace(".", ",") : "");
    }
    return out.join("\t");
  }, [cellInput, columns, focus, rowIndex, rows, selection, subStatus]);

  /** Eingefügter Text: Tabs gehen nach rechts, Zeilenumbrüche nach unten. */
  const pasteText = useCallback(
    (text: string) => {
      if (!focus) return;
      const startRow = rowIndex.get(focus.rowId) ?? -1;
      if (startRow < 0) return;

      const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
      let targetRow = startRow;

      for (const line of lines) {
        while (targetRow < rows.length && !rows[targetRow].editable) targetRow += 1;
        const row = rows[targetRow];
        if (!row?.person || !row.sub) break;

        const cells = line.split("\t");
        const perWeek: Record<string, number> = {};
        cells.forEach((raw, i) => {
          const column = columns[focus.col + i];
          if (!column) return;
          const cleaned = raw.replace(",", ".").trim();
          const value = cleaned === "" ? 0 : Number(cleaned);
          if (Number.isNaN(value)) return;
          if (unit === "percent") {
            for (const week of column.weeks) {
              const cap = capacityOf(row.person!, week, data.holidays).available;
              perWeek[week] = (cap * value) / 100;
            }
          } else {
            const per = value / column.weeks.length;
            for (const week of column.weeks) perWeek[week] = per;
          }
        });
        fillMap(row.person.id, row.sub.id, perWeek);
        targetRow += 1;
      }
    },
    [columns, data.holidays, fillMap, focus, rowIndex, rows, unit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Rückgängig hängt bewusst am Fenster (siehe PlanShell) — sonst greift
      // es nicht, sobald der Fokus nach dem Tippen kurz beim Body liegt.
      if ((e.metaKey || e.ctrlKey) && /^[zy]$/i.test(e.key)) return;

      const mod = e.metaKey || e.ctrlKey;

      // Ohne vorherigen Klick tut die Tastatur sonst nichts: der erste
      // sinnvolle Tastendruck setzt den Fokus auf die heutige Woche.
      if (!focus && editing === null) {
        const firstEditable = rows.findIndex((r) => r.editable);
        const startCol = Math.max(0, columns.findIndex((c) => c.isToday));
        const opens =
          /^[0-9]$/.test(e.key) ||
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Tab"].includes(e.key);
        if (firstEditable >= 0 && opens && !mod) {
          e.preventDefault();
          setFocus({ rowId: rows[firstEditable].id, col: startCol });
          setAnchor(startCol);
          if (/^[0-9]$/.test(e.key)) {
            alreadyCommitted.current = false;
            setEditing(e.key);
          }
          return;
        }
      }

      if (editing !== null) {
        if (e.key === "Escape") {
          e.preventDefault();
          alreadyCommitted.current = true;
          setEditing(null);
          focusGrid();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          alreadyCommitted.current = true;
          commit(editing);
          setEditing(null);
          move(1, 0);
          focusGrid();
        }
        if (e.key === "Tab") {
          e.preventDefault();
          alreadyCommitted.current = true;
          commit(editing);
          setEditing(null);
          move(0, e.shiftKey ? -1 : 1);
          focusGrid();
        }
        return;
      }

      if (!focus) return;

      const currentRow = rows[rowIndex.get(focus.rowId) ?? -1];

      // Kopieren, Einfügen, nach rechts ausfüllen.
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void navigator.clipboard.writeText(selectionText());
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void navigator.clipboard.readText().then(pasteText).catch(() => {
          toast.error("Einfügen ging nicht", { description: "Der Browser gibt die Zwischenablage nicht frei." });
        });
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!selection || !currentRow?.editable) return;
        const first = cellFor(currentRow, columns[selection.from], cellInput, subStatus);
        commit(String(unit === "percent" && first.ratio !== null ? Math.round(first.ratio * 100) : first.hours));
        return;
      }

      // Ganze Zuweisung verschieben.
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        if (!currentRow?.editable || !currentRow.person || !currentRow.sub) return;
        shiftAssignment(
          currentRow.person.id,
          currentRow.sub.id,
          data.weeks,
          e.key === "ArrowRight" ? 1 : -1,
        );
        toast.success(`„${currentRow.label}" um eine Woche ${e.key === "ArrowRight" ? "nach hinten" : "nach vorn"} geschoben`);
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          move(0, -1, e.shiftKey);
          return;
        case "ArrowRight":
          e.preventDefault();
          move(0, 1, e.shiftKey);
          return;
        case "ArrowUp":
          e.preventDefault();
          move(-1, 0);
          return;
        case "ArrowDown":
          e.preventDefault();
          move(1, 0);
          return;
        case "Tab":
          e.preventDefault();
          move(0, e.shiftKey ? -1 : 1);
          return;
        case "Enter":
          e.preventDefault();
          setEditing(currentValueText(rows, rowIndex, focus, columns, cellInput, subStatus));
          return;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          commit("0");
          return;
        case "Escape":
          e.preventDefault();
          setFocus(null);
          return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        alreadyCommitted.current = false;
        setEditing(e.key);
      }
      if (e.key === "," || e.key === ".") {
        e.preventDefault();
        alreadyCommitted.current = false;
        setEditing("0,");
      }
    },
    [cellInput, columns, commit, data.weeks, editing, focus, focusGrid, move, pasteText, rowIndex, rows, selection, selectionText, shiftAssignment, subStatus, unit],
  );

  useEffect(() => {
    if (editing !== null) inputRef.current?.focus();
  }, [editing]);

  /* ── Sprung zur heutigen Woche ────────────────────────────────────── */

  const jumpToToday = useCallback(() => {
    const viewport = scrollerRef.current?.osInstance()?.elements().viewport;
    if (!viewport) return;
    const index = columns.findIndex((c) => c.isToday);
    if (index < 0) return;
    const style = getComputedStyle(frameRef.current ?? viewport);
    const labelWidth = parseFloat(style.getPropertyValue("--lbl-w")) || 300;
    const cellWidth = parseFloat(style.getPropertyValue("--cell-w")) || 46;
    viewport.scrollTo({
      left: Math.max(0, labelWidth + index * cellWidth - labelWidth - 40),
      behavior: "smooth",
    });
  }, [columns]);

  /** Zur Zeile einer Person scrollen und sie kurz hervorheben. */
  const [flash, setFlash] = useState<string | null>(null);
  const jumpToPerson = useCallback((personId: string) => {
    const inner = frameRef.current;
    const viewport = scrollerRef.current?.osInstance()?.elements().viewport;
    if (!inner || !viewport) return;
    const row = inner.querySelector<HTMLElement>(`[data-row-id="p:${personId}"]`);
    if (!row) return;

    const headHeight = inner.querySelector<HTMLElement>("[data-head]")?.offsetHeight ?? 0;
    viewport.scrollTo({ top: Math.max(0, row.offsetTop - headHeight - 8), behavior: "smooth" });
    setFlash(personId);
    window.setTimeout(() => setFlash((v) => (v === personId ? null : v)), 1600);
  }, []);

  useEffect(() => {
    onReady?.({ toToday: jumpToToday, toPerson: jumpToPerson });
  }, [jumpToToday, jumpToPerson, onReady]);

  /* ── Marke der laufenden Woche ────────────────────────────────────── */

  const [todayX, setTodayX] = useState<number | null>(null);

  useEffect(() => {
    const inner = frameRef.current;
    if (!inner) return;

    const measure = () => {
      const cell = inner.querySelector<HTMLElement>('[data-week-head][data-today="true"]');
      setTodayX(cell ? cell.offsetLeft : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [columns, template, rows.length]);

  const jumpedRef = useRef(false);
  useEffect(() => {
    if (jumpedRef.current) return;
    const viewport = scrollerRef.current?.osInstance()?.elements().viewport;
    if (!viewport) return;
    jumpedRef.current = true;
    const index = columns.findIndex((c) => c.isToday);
    if (index < 0) return;
    const style = getComputedStyle(frameRef.current ?? viewport);
    const cellWidth = parseFloat(style.getPropertyValue("--cell-w")) || 46;
    viewport.scrollLeft = Math.max(0, index * cellWidth - 40);
  }, [columns]);

  /* ── Auswahl per Maus ─────────────────────────────────────────────── */

  const onCellDown = (row: Row, col: number, shift: boolean) => {
    if (!row.editable) {
      setFocus(null);
      return;
    }
    focusGrid();
    setEditing(null);
    if (shift && focus?.rowId === row.id) {
      setFocus({ rowId: row.id, col });
    } else {
      setFocus({ rowId: row.id, col });
      setAnchor(col);
    }
  };

  if (rows.length === 0) {
    return (
      <div className={styles.frame}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Hier ist noch nichts geplant</p>
          <p className={styles.hint}>
            {view === "people"
              ? "Leg unter Stammdaten Personen an und zieh sie dann in der Projektansicht auf ein Teilprojekt."
              : "Leg unter Stammdaten ein Projekt mit Teilprojekten an, dann kannst du Leute darauf ziehen."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <OverlayScrollbarsComponent
      ref={scrollerRef}
      element="div"
      defer
      options={{
        scrollbars: { theme: "os-theme-ariane", autoHide: "leave", autoHideDelay: 400 },
        overflow: { x: "scroll", y: "scroll" },
      }}
      className={styles.frame}
      data-zoom={zoom}
      tabIndex={0}
      role="grid"
      aria-label={view === "people" ? "Auslastung nach Personen" : "Auslastung nach Projekten"}
      onKeyDown={onKeyDown}
      style={{
        ["--cols" as string]: columns.length,
        ["--cell-w" as string]: `${base}px`,
        ["--lbl-w" as string]: `${labelW}px`,
        ["--cols-template" as string]: template,
      }}
    >
      <div ref={frameRef} className={styles.inner}>
        {todayX !== null ? (
          <span className={styles.todayLine} style={{ left: todayX }} aria-hidden="true" />
        ) : null}
        <Header
          columns={columns}
          view={view}
          unit={unit}
          zoom={zoom}
          labelW={labelW}
          setLabelW={setLabelW}
          widthOf={widthOf}
          setWidth={(key, px) => setColW(`raster:${key}`, px)}
          resetWidth={(key) => resetColW(`raster:${key}`)}
          todayX={todayX}
        />

        {rows.map((row) => (
          <GridRow
            key={row.id}
            row={row}
            flash={flash !== null && row.person?.id === flash}
            columns={columns}
            cellInput={cellInput}
            subStatus={subStatus}
            unit={unit}
            expanded={!!expanded[row.id]}
            onToggle={() => toggleRow(row.id)}
            selection={selection}
            focus={focus}
            editing={editing}
            inputRef={inputRef}
            setEditing={setEditing}
            startEditing={(v) => {
              alreadyCommitted.current = false;
              setEditing(v);
            }}
            onCellDown={onCellDown}
            onCommit={(value) => {
              if (alreadyCommitted.current) {
                alreadyCommitted.current = false;
                return;
              }
              commit(value);
              setEditing(null);
            }}
            onRemoveSlot={onRemoveSlot}
            onDropPerson={onDropPerson}
            readOnly={readOnly}
            onAskAbsence={onAskAbsence}
            people={data.people}
            subOptions={subOptions}
            assignedTo={slots}
            color={row.project ? (colorOf.get(row.project.id) ?? "var(--pc-none)") : null}
            onReorder={onReorder}
          />
        ))}
      </div>
    </OverlayScrollbarsComponent>
  );
}

/* ── Kopfzeile ────────────────────────────────────────────────────────── */

function Header({
  columns,
  view,
  unit,
  zoom,
  labelW,
  setLabelW,
  widthOf,
  setWidth,
  resetWidth,
  todayX,
}: {
  columns: Column[];
  view: string;
  unit: string;
  zoom: string;
  labelW: number;
  setLabelW: (px: number) => void;
  widthOf: (key: string) => number;
  setWidth: (key: string, px: number) => void;
  resetWidth: (key: string) => void;
  todayX: number | null;
}) {
  const bands = useMemo(() => {
    const out: { key: string; label: string; span: number; weeks: string[] }[] = [];
    for (const c of columns) {
      const last = out[out.length - 1];
      if (last && last.key === c.monthKey) {
        last.span += 1;
        last.weeks.push(c.key);
      } else {
        out.push({ key: c.monthKey, label: c.monthLabel, span: 1, weeks: [c.key] });
      }
    }
    return out;
  }, [columns]);

  return (
    <div className={styles.head} data-head="">
      {todayX !== null ? (
        <span className={styles.todayLineHead} style={{ left: todayX }} aria-hidden="true" />
      ) : null}
      <div className={styles.headRow}>
        <div className={`${styles.headCorner} ${styles.cornerMonth}`}>
          {view === "people" ? "Person" : "Projekt"}
        </div>
        {bands.map((band, i) => (
          <div
            key={band.key}
            className={styles.monthBand}
            data-first={i > 0}
            style={{ gridColumn: `span ${band.span}` }}
          >
            <span className={styles.monthLabel}>{band.label}</span>
            <ColumnResizer
              label={`Breite von ${band.label}`}
              width={band.weeks.reduce((sum, key) => sum + widthOf(key), 0)}
              min={band.weeks.length * 26}
              onResize={(total) => {
                // Der gezogene Zuwachs verteilt sich gleichmäßig auf die
                // Wochen dieses Monats — der Monat wird breiter, nicht alle.
                const current = band.weeks.map(widthOf);
                const sum = current.reduce((a, b) => a + b, 0);
                const delta = (total - sum) / band.weeks.length;
                band.weeks.forEach((key, n) => setWidth(key, current[n] + delta));
              }}
              onReset={() => band.weeks.forEach((key) => resetWidth(key))}
            />
          </div>
        ))}
      </div>
      <div className={styles.headRow}>
        <div className={styles.headCorner} style={{ height: "var(--head-week)" }}>
          <span className="text-xs text-dim">
            {zoom === "month" ? "Monate" : "Kalenderwochen"} · {unit === "hours" ? "Stunden" : "Prozent"}
          </span>
          <button
            type="button"
            className={styles.labelResizer}
            aria-hidden="true"
            tabIndex={-1}
          />
          <ColumnResizer
            label="Breite der Namensspalte"
            width={labelW}
            min={180}
            quiet
            onResize={setLabelW}
            onReset={() => setLabelW(300)}
          />
        </div>
        {columns.map((c, i) => (
          <div
            key={c.key}
            className={styles.weekCell}
            data-week-head=""
            data-today={c.isToday}
            data-past={c.isPast}
            data-month-start={i > 0 && c.monthKey !== columns[i - 1].monthKey}
            title={c.weeks.length === 1 ? `KW ${c.label} · ${weekSpanLabel(c.weeks[0])}` : c.monthLabel}
          >
            {c.label}
            <ColumnResizer
              label={c.weeks.length === 1 ? `Breite von KW ${c.label}` : `Breite von ${c.monthLabel}`}
              width={widthOf(c.key)}
              onResize={(px) => setWidth(c.key, px)}
              onReset={() => resetWidth(c.key)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Zeile ────────────────────────────────────────────────────────────── */

type RowProps = {
  row: Row;
  flash: boolean;
  columns: Column[];
  cellInput: Parameters<typeof cellFor>[2];
  subStatus: Map<string, "confirmed" | "offer">;
  unit: string;
  expanded: boolean;
  onToggle: () => void;
  selection: { rowId: string; from: number; to: number } | null;
  focus: Focus;
  editing: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setEditing: (v: string | null) => void;
  startEditing: (v: string) => void;
  onCellDown: (row: Row, col: number, shift: boolean) => void;
  onCommit: (value: string) => void;
  onRemoveSlot: (personId: string, subprojectId: string) => void;
  onDropPerson: (personId: string, subprojectId: string) => void;
  people: PlanData["people"];
  subOptions: { id: string; label: string; hint?: string }[];
  assignedTo: { personId: string; subprojectId: string }[];
  color: string | null;
  readOnly: boolean;
  onAskAbsence: (personId: string) => void;
  onReorder: (kind: "person" | "project" | "sub", draggedId: string, targetId: string, parentId?: string) => void;
};

/** Welche Entität hängt an dieser Zeile, wenn man sie umsortiert? */
function sortableOf(row: Row): { kind: "person" | "project" | "sub"; id: string; parent?: string } | null {
  if (row.kind === "person" && row.person) return { kind: "person", id: row.person.id };
  if (row.kind === "project" && row.project) return { kind: "project", id: row.project.id };
  if (row.kind === "sub" && row.sub && row.project)
    return { kind: "sub", id: row.sub.id, parent: row.project.id };
  return null;
}

function GridRow(props: RowProps) {
  const { row, columns, cellInput, subStatus, unit, expanded, onToggle } = props;
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const [dropping, setDropping] = useState<false | "assign" | "sort">(false);
  const [lifting, setLifting] = useState(false);
  const sortable = props.readOnly ? null : sortableOf(row);

  // Am Griff in der Namensspalte lässt sich die Zeile umsortieren.
  useEffect(() => {
    const el = handleRef.current;
    if (!el || !sortable) return;
    return draggable({
      element: el,
      getInitialData: () => ({
        type: "row",
        kind: sortable.kind,
        id: sortable.id,
        parent: sortable.parent,
      }),
      onDragStart: () => setLifting(true),
      onDrop: () => setLifting(false),
    });
  }, [sortable?.kind, sortable?.id, sortable?.parent]);

  // Ziel für zweierlei: eine Person aus der Teamliste (nur Teilprojektzeilen)
  // und eine gleichartige Zeile beim Umsortieren.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const d = source.data;
        if (d?.type === "person") return row.kind === "sub" && !!row.sub;
        if (d?.type === "row")
          return !!sortable && d.kind === sortable.kind && d.parent === sortable.parent && d.id !== sortable.id;
        return false;
      },
      onDragEnter: ({ source }) => setDropping(source.data?.type === "person" ? "assign" : "sort"),
      onDragLeave: () => setDropping(false),
      onDrop: ({ source }) => {
        setDropping(false);
        const d = source.data;
        if (d?.type === "person" && typeof d.personId === "string" && row.sub) {
          props.onDropPerson(d.personId, row.sub.id);
          return;
        }
        if (d?.type === "row" && sortable && typeof d.id === "string") {
          props.onReorder(sortable.kind, d.id, sortable.id, sortable.parent);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, row.kind, row.sub, sortable?.kind, sortable?.id, sortable?.parent]);

  const cells = useMemo(
    () => columns.map((c) => cellFor(row, c, cellInput, subStatus)),
    [columns, row, cellInput, subStatus],
  );

  return (
    <div
      ref={ref}
      className={styles.row}
      data-depth={row.depth}
      data-kind={row.kind}
      data-row-id={row.id}
      data-dropping={dropping || undefined}
      data-lifting={lifting || undefined}
      data-flash={props.flash || undefined}
      role="row"
      style={props.color ? ({ ["--rowColor" as string]: props.color } as React.CSSProperties) : undefined}
    >
      <div
        className={`${styles.label} ${row.depth === 1 ? styles.indent1 : row.depth === 2 ? styles.indent2 : ""}`}
      >
        {sortable ? (
          <span
            ref={handleRef}
            className={styles.dragHandle}
            title="Zum Umsortieren ziehen"
            aria-hidden="true"
          >
            <GripVertical size={12} />
          </span>
        ) : (
          <span className={styles.dragSpacer} />
        )}

        {props.color && row.kind !== "person" ? (
          <span className={styles.stripe} aria-hidden="true" />
        ) : null}

        {row.hasChildren ? (
          <button
            type="button"
            className={styles.twisty}
            data-open={expanded}
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? `${row.label} zuklappen` : `${row.label} aufklappen`}
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className={styles.twistySpacer} />
        )}

        <span className={styles.labelText}>
          <span className={styles.labelMain}>
            {row.label}
            {row.tentative ? <span className="ml-1.5 text-[10px] text-dim">Angebot</span> : null}
          </span>
          {row.sublabel ? <span className={styles.labelSub}>{row.sublabel}</span> : null}
        </span>

        {row.kind === "person" && row.person ? (
          <span className={styles.capNote} title="Netto-Stunden pro Woche">
            {fmt(netHoursAt(row.person, todayWeek()))} h
          </span>
        ) : null}

        {!props.readOnly && row.kind === "sub" && row.sub ? (
          <AssignButton
            label={`Person auf „${row.sub.name}" einplanen`}
            empty="Alle sind schon eingeplant."
            placeholder="Wen einplanen?"
            options={props.people
              .filter(
                (person) =>
                  !props.assignedTo.some(
                    (a) => a.subprojectId === row.sub!.id && a.personId === person.id,
                  ),
              )
              .map((person) => ({ id: person.id, label: person.name }))}
            onPick={(personId) => props.onDropPerson(personId, row.sub!.id)}
          />
        ) : null}

        {!props.readOnly && row.kind === "person" && row.person ? (
          <button
            type="button"
            className={styles.twisty}
            title={`Urlaub für ${row.person.name} eintragen`}
            aria-label={`Urlaub für ${row.person.name} eintragen`}
            onClick={() => props.onAskAbsence(row.person!.id)}
          >
            <CalendarOff size={13} />
          </button>
        ) : null}

        {!props.readOnly && row.kind === "person" && row.person ? (
          <AssignButton
            label={`${row.person.name} auf ein Teilprojekt setzen`}
            empty="Diese Person ist schon überall drauf."
            placeholder="Auf welches Teilprojekt?"
            options={props.subOptions.filter(
              (option) =>
                !props.assignedTo.some(
                  (a) => a.personId === row.person!.id && a.subprojectId === option.id,
                ),
            )}
            onPick={(subprojectId) => props.onDropPerson(row.person!.id, subprojectId)}
          />
        ) : null}

        {!props.readOnly && row.editable && row.person && row.sub ? (
          <span className={styles.rowTools}>
            <button
              type="button"
              className={styles.twisty}
              title={`${row.person.name} von „${row.sub.name}" nehmen`}
              onClick={() => props.onRemoveSlot(row.person!.id, row.sub!.id)}
            >
              <Trash2 size={13} />
            </button>
          </span>
        ) : null}
      </div>

      {columns.map((column, i) => {
        const cell = cells[i];
        const selected =
          props.selection?.rowId === row.id && i >= props.selection.from && i <= props.selection.to;
        const focused = props.focus?.rowId === row.id && props.focus.col === i;
        const isEditing = focused && props.editing !== null;

        return (
          <div
            key={column.key}
            role="gridcell"
            className={styles.cell}
            data-state={cell.state}
            data-editable={row.editable}
            data-inactive={cell.inactive && cell.hours === 0}
            data-selected={selected}
            data-focused={focused}
            data-today={column.isToday}
            data-tentative={row.tentative}
            data-month-start={i > 0 && column.monthKey !== columns[i - 1].monthKey}
            title={tooltip(row, column, cell)}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              props.onCellDown(row, i, e.shiftKey);
            }}
            onDoubleClick={() => {
              if (row.editable) props.startEditing(valueText(row, cell, unit));
            }}
          >
            {cell.ratio !== null && cell.ratio > 0 ? (
              <span
                className={styles.bar}
                style={{
                  height: `calc(${Math.min(1, cell.ratio) * 100}% - 6px)`,
                  ["--barColor" as string]:
                    row.kind === "person" || row.kind === "team"
                      ? barColor(cell.state)
                      : projectBar(cell.state, props.color),
                }}
              />
            ) : null}

            {isEditing ? (
              <input
                ref={props.inputRef}
                className={styles.editInput}
                value={props.editing ?? ""}
                inputMode="decimal"
                onChange={(e) => props.setEditing(e.target.value)}
                onBlur={() => props.onCommit(props.editing ?? "")}
              />
            ) : (
              <span className={styles.value}>{valueText(row, cell, unit)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Person zuweisen ──────────────────────────────────────────────────── */

type AssignOption = { id: string; label: string; hint?: string };

/**
 * Einplanen geht aus beiden Richtungen: in der Projektansicht wählt man eine
 * Person, in der Personenansicht ein Teilprojekt. Sonst schickt die App
 * einen genau dann in die andere Ansicht, wenn man die Lücke gerade sieht.
 */
function AssignButton({
  label,
  placeholder,
  empty,
  options,
  onPick,
}: {
  label: string;
  placeholder: string;
  empty: string;
  options: AssignOption[];
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type="button" className={styles.twisty} title={label} aria-label={label} />}
      >
        <Plus size={14} />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.hint ?? ""}`}
                  onSelect={() => {
                    onPick(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="truncate text-[11px] text-dim">{option.hint}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Darstellung ──────────────────────────────────────────────────────── */

/**
 * Auslastung der Person. Bis 85 Prozent bleibt es neutral — ein Raster, in
 * dem alles bunt ist, sagt nichts. Erst wenn es eng wird, kommt Farbe:
 * Bernstein ab 85, Moos bei genau voll, Apricot darüber.
 */
function barColor(state: Cell["state"]): string {
  switch (state) {
    case "over":
      return "color-mix(in oklab, var(--crit) 60%, transparent)";
    case "full":
      return "color-mix(in oklab, var(--moss) 58%, transparent)";
    case "tight":
      return "color-mix(in oklab, var(--warn) 52%, transparent)";
    default:
      return "color-mix(in oklab, var(--dim) 32%, transparent)";
  }
}

/** Teilprojektzeilen tragen die Projektfarbe; Überlast bleibt Überlast. */
function projectBar(state: Cell["state"], color: string | null): string {
  if (state === "over") return "color-mix(in oklab, var(--crit) 55%, transparent)";
  if (!color) return "color-mix(in oklab, var(--dim) 28%, transparent)";
  return `color-mix(in oklab, ${color} 45%, transparent)`;
}

function valueText(row: Row, cell: Cell, unit: string): string {
  if (row.kind === "team") {
    if (unit === "percent") return cell.ratio === null ? "" : String(Math.round(cell.ratio * 100));
    const free = Math.round(cell.available - cell.hours);
    return free === 0 ? "0" : String(free);
  }
  if (cell.state === "away" && cell.hours === 0) return "U";
  if (cell.hours === 0 && cell.state !== "over") return "";
  if (row.kind === "project" || row.kind === "sub") return fmt(cell.hours);
  if (unit === "percent" && cell.ratio !== null) return `${Math.round(cell.ratio * 100)}`;
  return fmt(cell.hours);
}

function tooltip(row: Row, column: Column, cell: Cell): string {
  const when =
    column.weeks.length === 1 ? `KW ${column.label} · ${weekSpanLabel(column.weeks[0])}` : column.monthLabel;

  const parts = [`${row.label} · ${when}`];

  if (row.kind === "team") {
    parts.push(`${fmt(Math.round(cell.available - cell.hours))} h frei`);
    parts.push(`${fmt(cell.hours)} von ${fmt(cell.available)} h verplant`);
    if (cell.ratio !== null) parts.push(`${Math.round(cell.ratio * 100)} %`);
    return parts.join(" · ");
  }

  if (row.kind === "project" || row.kind === "sub") {
    parts.push(`${fmt(cell.hours)} h verplant`);
  } else {
    parts.push(`${fmt(cell.hours)} von ${fmt(cell.available)} h`);
    if (cell.ratio !== null) parts.push(`${Math.round(cell.ratio * 100)} %`);
  }
  if (cell.vacationDays > 0) parts.push(`${fmt(cell.vacationDays)} Tage Urlaub`);
  if (cell.holidayNames.length > 0) parts.push(cell.holidayNames.join(", "));
  if (cell.inactive && cell.hours === 0) parts.push("außerhalb der Laufzeit");

  return parts.join(" · ");
}

function currentValueText(
  rows: Row[],
  rowIndex: Map<string, number>,
  focus: NonNullable<Focus>,
  columns: Column[],
  cellInput: Parameters<typeof cellFor>[2],
  subStatus: Map<string, "confirmed" | "offer">,
): string {
  const row = rows[rowIndex.get(focus.rowId) ?? -1];
  if (!row) return "";
  const cell = cellFor(row, columns[focus.col], cellInput, subStatus);
  return cell.hours > 0 ? fmt(cell.hours) : "";
}
