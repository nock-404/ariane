"use client";

import {
  CalendarDays,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleAlert,
  Download,
  Loader2,
  Minus,
  Plus,
  Redo2,
  Undo2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addSlot as addSlotAction, removeSlot as removeSlotAction } from "@/app/actions";
import type { PlanData } from "@/lib/capacity";
import { CELL_MAX, CELL_MIN, usePrefs } from "@/lib/prefs";
import { buildPeopleRows, buildProjectRows } from "@/lib/rows";
import { useConfirm } from "@/components/ui/confirm";
import { attachUnloadGuard, redoStep, undoStep, usePlan } from "@/lib/store";

import { AbsenceDialog } from "./absence-dialog";
import { Grid } from "./grid";
import { Shortcuts } from "./shortcuts";
import { Roster } from "./roster";

export function PlanShell({ data, readOnly = false }: { data: PlanData; readOnly?: boolean }) {
  const init = usePlan((s) => s.init);
  const saveState = usePlan((s) => s.saveState);
  const addSlot = usePlan((s) => s.addSlot);
  const dropSlot = usePlan((s) => s.dropSlot);
  const hours = usePlan((s) => s.hours);
  const slots = usePlan((s) => s.slots);

  const { view, unit, zoom, includeOffers, expanded, showRoster, cellW } = usePrefs();
  const prefs = usePrefs();

  const confirm = useConfirm();
  const jumpRef = useRef<{ toToday: () => void; toPerson: (id: string) => void } | null>(null);
  const [absenceFor, setAbsenceFor] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Nur beim Einhaengen befuellen. Waehrend des Tippens ist der Client die
  // Quelle der Wahrheit; neue Serverdaten kommen ueber einen Seitenwechsel.
  useEffect(() => {
    init(data);
    usePlan.temporal.getState().clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => attachUnloadGuard(), []);

  // Rückgängig und Wiederherstellen gelten für die ganze Seite. Am Raster
  // allein würden sie ins Leere laufen, weil der Fokus nach dem Tippen
  // kurzzeitig beim Body liegt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;

      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "TEXTAREA" ||
          (el.tagName === "INPUT" && el.getAttribute("type") !== "checkbox") ||
          el.isContentEditable);
      if (typing) return;

      e.preventDefault();
      if (key === "y" || e.shiftKey) redoStep();
      else undoStep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const temporal = usePlan.temporal;
    const sync = () => {
      const s = temporal.getState();
      setCanUndo(s.pastStates.length > 0);
      setCanRedo(s.futureStates.length > 0);
    };
    sync();
    return temporal.subscribe(sync);
  }, []);

  const rows = useMemo(() => {
    const input = { data, hours, slots, includeOffers, expanded };
    return view === "people" ? buildPeopleRows(input) : buildProjectRows(input);
  }, [data, hours, slots, includeOffers, expanded, view]);

  const allParentIds = useMemo(() => {
    const input = { data, hours, slots, includeOffers, expanded: allOpen(data) };
    const full = view === "people" ? buildPeopleRows(input) : buildProjectRows(input);
    return full.filter((r) => r.hasChildren).map((r) => r.id);
  }, [data, hours, slots, includeOffers, view]);

  const anyOpen = rows.some((r) => r.hasChildren && expanded[r.id]);

  const onDropPerson = useCallback(
    async (personId: string, subprojectId: string) => {
      addSlot(personId, subprojectId);
      const person = data.people.find((p) => p.id === personId);

      // Aufklappen, sonst passiert für das Auge nichts: die neue Zeile
      // steckt unter einem zugeklappten Teilprojekt.
      const project = data.projects.find((pr) => pr.subs.some((sub) => sub.id === subprojectId));
      if (project) {
        prefs.setExpanded(
          [`pr:${project.id}`, `pr:${project.id}:s:${subprojectId}`, `p:${personId}`],
          true,
        );
      }

      try {
        await addSlotAction(personId, subprojectId);
        toast.success(`${person?.name ?? "Person"} eingeplant`, {
          description: "Jetzt Stunden pro Woche eintragen.",
        });
      } catch {
        dropSlot(personId, subprojectId);
        toast.error("Konnte nicht zugewiesen werden");
      }
    },
    [addSlot, data.people, data.projects, dropSlot, prefs],
  );

  const onReorder = useCallback(
    (kind: "person" | "project" | "sub", draggedId: string, targetId: string, parentId?: string) => {
      const store = usePlan.getState();
      if (kind === "person") {
        store.movePerson(draggedId, store.order.people.indexOf(targetId));
      } else if (kind === "project") {
        store.moveProject(draggedId, store.order.projects.indexOf(targetId));
      } else if (parentId) {
        store.moveSub(parentId, draggedId, (store.order.subs[parentId] ?? []).indexOf(targetId));
      }
    },
    [],
  );

  const onRemoveSlot = useCallback(
    async (personId: string, subprojectId: string) => {
      const person = data.people.find((p) => p.id === personId);
      const sub = data.projects.flatMap((pr) => pr.subs).find((x) => x.id === subprojectId);

      // Das hier löscht alle Wochen dieser Zuweisung auf einmal — dafür gibt
      // es eine Rückfrage, und danach einen Weg zurück.
      const hours = usePlan.getState().hours[`${personId}:${subprojectId}`] ?? {};
      const total = Object.values(hours).reduce((sum, v) => sum + v, 0);
      const backup = { ...hours };

      const ok = await confirm({
        title: `${person?.name ?? "Person"} von „${sub?.name ?? "Teilprojekt"}" nehmen?`,
        description:
          total > 0
            ? `Damit verschwinden ${Math.round(total)} verplante Stunden über ${Object.keys(hours).length} Wochen.`
            : "Es sind keine Stunden eingetragen.",
        confirmLabel: "Entfernen",
        tone: "danger",
      });
      if (!ok) return;

      dropSlot(personId, subprojectId);
      try {
        await removeSlotAction(personId, subprojectId);
        toast.success(`${person?.name ?? "Person"} entfernt`, {
          action: {
            label: "Rückgängig",
            onClick: () => {
              void (async () => {
                addSlot(personId, subprojectId);
                await addSlotAction(personId, subprojectId);
                usePlan.getState().fillMap(personId, subprojectId, backup);
              })();
            },
          },
        });
      } catch {
        toast.error("Konnte nicht entfernt werden");
      }
    },
    [addSlot, confirm, data.people, data.projects, dropSlot],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-[var(--shadow-soft)]">
        <Tabs value={view} onValueChange={(v) => prefs.setView(v as "people" | "projects")}>
          <TabsList>
            <TabsTrigger value="people">Personen</TabsTrigger>
            <TabsTrigger value="projects">Projekte</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={zoom} onValueChange={(v) => prefs.setZoom(v as "week" | "month")}>
          <TabsList>
            <TabsTrigger value="week">Wochen</TabsTrigger>
            <TabsTrigger value="month">Monate</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={unit} onValueChange={(v) => prefs.setUnit(v as "hours" | "percent")}>
          <TabsList>
            <TabsTrigger value="hours">Stunden</TabsTrigger>
            <TabsTrigger value="percent">Prozent</TabsTrigger>
          </TabsList>
        </Tabs>

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <div className="flex items-center gap-2">
          <Switch
            id="offers"
            checked={includeOffers}
            onCheckedChange={() => prefs.toggleOffers()}
          />
          <Label htmlFor="offers" className="cursor-pointer text-[13px] font-normal text-dim">
            Angebote einrechnen
          </Label>
        </div>

        {readOnly ? (
          <span className="rounded-md border border-line px-2 py-1 text-[11.5px] text-dim">
            Nur lesen
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <SaveBadge state={saveState} />

          <Button
            variant="ghost"
            size="icon"
            title="Rückgängig (⌘Z)"
            hidden={readOnly}
            disabled={!canUndo}
            onClick={() => undoStep()}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Wiederherstellen (⌘⇧Z)"
            hidden={readOnly}
            disabled={!canRedo}
            onClick={() => redoStep()}
          >
            <Redo2 />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title={anyOpen ? "Alles zuklappen" : "Alles aufklappen"}
            onClick={() => prefs.setExpanded(allParentIds, !anyOpen)}
          >
            {anyOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
          </Button>

          <Button variant="ghost" size="icon" title="Team ein- oder ausblenden" onClick={() => prefs.toggleRoster()}>
            <Users />
          </Button>

          {readOnly ? null : <Shortcuts />}

          <span className="flex items-center rounded-lg border border-line">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-r-none"
              title="Spalten schmaler (oder am Spaltenrand ziehen)"
              aria-label="Spalten schmaler"
              disabled={cellW[zoom] <= CELL_MIN}
              onClick={() => {
                prefs.nudgeCellW(zoom, -8);
                prefs.nudgeAllColW("raster:", -8);
              }}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-l-none border-l border-line"
              title="Spalten breiter (oder am Spaltenrand ziehen)"
              aria-label="Spalten breiter"
              disabled={cellW[zoom] >= CELL_MAX}
              onClick={() => {
                prefs.nudgeCellW(zoom, 8);
                prefs.nudgeAllColW("raster:", 8);
              }}
            >
              <Plus />
            </Button>
          </span>

          <Button variant="outline" size="sm" onClick={() => jumpRef.current?.toToday()}>
            <CalendarDays />
            Heute
          </Button>

          <a
            href="/api/export"
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download />
            Excel
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {showRoster ? (
          <Roster
            data={data}
            onPick={(personId) => {
              // Aus der Teamliste springt man ins Raster zur Person; in der
              // Projektansicht gibt es die Zeile nicht, also erst wechseln.
              if (view !== "people") prefs.setView("people");
              window.setTimeout(() => jumpRef.current?.toPerson(personId), view === "people" ? 0 : 120);
            }}
          />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Grid
            data={data}
            readOnly={readOnly}
            onRemoveSlot={onRemoveSlot}
            onDropPerson={onDropPerson}
            onReorder={onReorder}
            onAskAbsence={setAbsenceFor}
            onReady={(api) => {
              jumpRef.current = api;
            }}
          />
          {readOnly ? (
            <p className="mt-2 flex-none px-1 text-[11.5px] text-dim">
              Dieser Zugang darf schauen und exportieren, aber nichts ändern.
            </p>
          ) : null}
        </div>
      </div>

      {absenceFor ? (
        <AbsenceDialog
          person={data.people.find((p) => p.id === absenceFor)!}
          onClose={() => setAbsenceFor(null)}
        />
      ) : null}
    </div>
  );
}

function SaveBadge({ state }: { state: ReturnType<typeof usePlan.getState>["saveState"] }) {
  if (state === "idle") return null;

  const map = {
    dirty: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "ändert…", tone: "var(--dim)" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "speichert…", tone: "var(--dim)" },
    saved: { icon: <Check className="size-3.5" />, text: "gespeichert", tone: "var(--moss)" },
    error: { icon: <CircleAlert className="size-3.5" />, text: "nicht gespeichert", tone: "var(--crit)" },
  } as const;

  const entry = map[state as keyof typeof map];
  if (!entry) return null;

  return (
    <span
      className="mr-1 flex items-center gap-1.5 text-[12px] whitespace-nowrap"
      style={{ color: entry.tone }}
      role="status"
    >
      {entry.icon}
      {entry.text}
    </span>
  );
}

function allOpen(data: PlanData): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const p of data.people) map[`p:${p.id}`] = true;
  for (const pr of data.projects) {
    map[`pr:${pr.id}`] = true;
    for (const sub of pr.subs) map[`pr:${pr.id}:s:${sub.id}`] = true;
  }
  return map;
}
