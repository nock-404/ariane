"use client";

import { GripVertical, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

import { Input } from "@/components/ui/input";
import { capacityOf, type PlanData, type PlanPerson } from "@/lib/capacity";
import { usePrefs } from "@/lib/prefs";
import { fmt, personHoursIn, subStatusIndex } from "@/lib/rows";
import { usePlan } from "@/lib/store";
import { todayWeek } from "@/lib/weeks";

/**
 * Die Mannschaftsliste. Von hier zieht man jemanden auf ein Teilprojekt.
 * Der Balken zeigt die Auslastung der laufenden Woche, damit man beim
 * Verteilen sieht, wer überhaupt noch Luft hat.
 */
export function Roster({ data, onPick }: { data: PlanData; onPick: (personId: string) => void }) {
  const [query, setQuery] = useState("");
  const hours = usePlan((s) => s.hours);
  const slots = usePlan((s) => s.slots);
  const includeOffers = usePrefs((s) => s.includeOffers);
  const view = usePrefs((s) => s.view);

  const subStatus = useMemo(() => subStatusIndex(data.projects), [data.projects]);
  const week = todayWeek();

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.people
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .map((person) => {
        const cap = capacityOf(person, week, data.holidays);
        const load = personHoursIn({ data, hours, slots, includeOffers }, person, week, subStatus);
        return {
          person,
          available: cap.available,
          hours: load,
          ratio: cap.available > 0 ? load / cap.available : null,
          away: cap.away,
        };
      });
  }, [data, hours, includeOffers, query, slots, subStatus, week]);

  return (
    <aside className="hidden h-full min-h-0 w-[258px] flex-none flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-[var(--shadow-soft)] lg:flex">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Team</h2>
        <span className="text-[11px] text-dim">diese Woche</span>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-dim"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name suchen"
          className="h-8 pl-8 text-sm"
          aria-label="Person suchen"
        />
      </div>

      <OverlayScrollbarsComponent
        defer
        options={{ scrollbars: { theme: "os-theme-ariane", autoHide: "leave" } }}
        className="-mr-1 min-h-0 flex-1 pr-1"
      >
        <ul className="flex flex-col gap-0.5">
          {people.map((entry) => (
            <RosterItem key={entry.person.id} {...entry} onPick={onPick} />
          ))}
          {people.length === 0 ? (
            <li className="px-1 py-6 text-center text-xs text-dim">
              Niemand gefunden. Personen legst du unter Stammdaten an.
            </li>
          ) : null}
        </ul>
      </OverlayScrollbarsComponent>

      <p className="text-[11px] leading-relaxed text-dim">
        {view === "projects"
          ? "Zieh jemanden auf ein Teilprojekt, um ihn einzuplanen."
          : "Zum Zuweisen in die Projektansicht wechseln und jemanden auf ein Teilprojekt ziehen."}
      </p>
    </aside>
  );
}

function RosterItem({
  person,
  available,
  hours,
  ratio,
  away,
  onPick,
}: {
  person: PlanPerson;
  available: number;
  hours: number;
  ratio: number | null;
  away: boolean;
  onPick: (personId: string) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({ type: "person", personId: person.id, name: person.name }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [person.id]);

  const over = ratio !== null && ratio > 1.001;
  const pct = ratio === null ? null : Math.round(ratio * 100);
  // Dieselbe Lesart wie im Raster: neutral, bis es eng wird.
  const barTone = over
    ? "var(--crit)"
    : ratio !== null && ratio >= 0.98
      ? "var(--moss)"
      : ratio !== null && ratio >= 0.85
        ? "var(--warn)"
        : "color-mix(in oklab, var(--dim) 55%, transparent)";

  return (
    <li
      ref={ref}
      data-dragging={dragging}
      className="group flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-raised data-[dragging=true]:opacity-40"
      title={
        away
          ? `${person.name} · diese Woche abwesend`
          : `${person.name} · ${fmt(hours)} von ${fmt(available)} h`
      }
    >
      <GripVertical size={13} className="flex-none cursor-grab text-faint group-hover:text-dim" />

      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={() => onPick(person.id)}
        title={`Im Raster zu ${person.name} springen`}
      >
        <span className="block truncate text-[13px] leading-tight">{person.name}</span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-hair">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.min(100, (ratio ?? 0) * 100)}%`,
              background: barTone,
            }}
          />
        </span>
      </button>

      <span
        className="flex-none text-[11px] tabular-nums"
        style={{ color: over ? "var(--crit)" : "var(--dim)" }}
      >
        {away ? "Urlaub" : pct === null ? "–" : `${pct}%`}
      </span>
    </li>
  );
}
