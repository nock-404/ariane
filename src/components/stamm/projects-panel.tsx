"use client";

import { FolderPlus, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  archiveProject,
  archiveSubproject,
  createProject,
  createSubproject,
  updateProject,
  updateSubproject,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { TableFrame, useColumns } from "@/components/ui/resizable-columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { slotKey, type PlanData, type PlanProject, type PlanSubproject } from "@/lib/capacity";
import { fmt } from "@/lib/rows";
import { todayWeek } from "@/lib/weeks";

const SUB_COLUMNS = [
  { id: "name", label: "Teilprojekt", width: 200 },
  { id: "laufzeit", label: "Laufzeit", width: 170 },
  { id: "budget", label: "Budget", width: 95 },
  { id: "verbraucht", label: "Verbraucht", width: 105 },
  { id: "verplant", label: "Verplant", width: 150 },
  { id: "tools", label: " ", width: 100, align: "right" as const },
];

export function ProjectsPanel({ data }: { data: PlanData }) {
  const columns = useColumns("teilprojekte", SUB_COLUMNS);
  const [newProject, setNewProject] = useState(false);
  const [editSub, setEditSub] = useState<{ project: PlanProject; sub: PlanSubproject } | null>(null);
  const [addSubTo, setAddSubTo] = useState<PlanProject | null>(null);
  const [editProject, setEditProject] = useState<PlanProject | null>(null);

  const planned = plannedBySub(data);

  if (data.projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-14 text-center shadow-[var(--shadow-soft)]">
        <p className="font-semibold">Noch keine Projekte</p>
        <p className="max-w-md text-sm text-dim">
          Ein Projekt bündelt Teilprojekte. Geplant wird auf den Teilprojekten, das Projekt zeigt
          die Summe.
        </p>
        <Button onClick={() => setNewProject(true)}>
          <FolderPlus />
          Projekt anlegen
        </Button>
        {newProject ? <ProjectDialog onClose={() => setNewProject(false)} /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-dim">
          {data.projects.length} Projekte · geplant wird auf den Teilprojekten.
        </p>
        <Button onClick={() => setNewProject(true)}>
          <FolderPlus />
          Projekt anlegen
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {data.projects.map((project) => (
          <article
            key={project.id}
            className="overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-soft)]"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-semibold">
                  {project.name}
                  {project.status === "offer" ? (
                    <Badge variant="outline" className="text-dim">
                      Angebot
                    </Badge>
                  ) : null}
                </h3>
                {project.client ? (
                  <p className="text-[12.5px] text-dim">{project.client}</p>
                ) : null}
              </div>

              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditProject(project)}>
                  Bearbeiten
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddSubTo(project)}>
                  <Plus />
                  Teilprojekt
                </Button>
              </div>
            </header>

            {project.subs.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-dim">
                Noch kein Teilprojekt. Ohne Teilprojekt lässt sich hier niemand einplanen.
              </p>
            ) : (
              <TableFrame><table className="w-full table-fixed text-sm">
                {columns.colgroup}
                <thead>{columns.header}</thead>
                <tbody>
                  {project.subs.map((sub) => (
                    <tr key={sub.id} className="border-t border-hair hover:bg-raised">
                      <td className="truncate px-4 py-2.5 font-medium">{sub.name}</td>
                      <td className="truncate px-4 py-2.5 text-dim">
                        {sub.openEnded
                          ? "Dauerläufer"
                          : sub.startsOn && sub.endsOn
                            ? `${formatDe(sub.startsOn)} – ${formatDe(sub.endsOn)}`
                            : "offen"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {sub.budgetHours == null ? "–" : `${fmt(sub.budgetHours)} h`}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {sub.actualHours == null ? "–" : `${fmt(sub.actualHours)} h`}
                      </td>
                      <td className="px-4 py-2.5">
                        <BudgetBar
                          budget={sub.budgetHours}
                          actual={sub.actualHours}
                          planned={planned.get(sub.id) ?? 0}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditSub({ project, sub })}>
                          Ändern
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></TableFrame>
            )}
          </article>
        ))}
      </div>

      {newProject ? <ProjectDialog onClose={() => setNewProject(false)} /> : null}
      {editProject ? (
        <ProjectDialog project={editProject} onClose={() => setEditProject(null)} />
      ) : null}
      {addSubTo ? (
        <SubDialog projectId={addSubTo.id} onClose={() => setAddSubTo(null)} />
      ) : null}
      {editSub ? (
        <SubDialog
          projectId={editSub.project.id}
          sub={editSub.sub}
          planned={planned.get(editSub.sub.id) ?? 0}
          onClose={() => setEditSub(null)}
        />
      ) : null}
    </div>
  );
}

function BudgetBar({
  budget,
  actual,
  planned,
}: {
  budget: number | null;
  actual: number | null;
  planned: number;
}) {
  if (budget == null) {
    return <span className="text-[12px] text-dim tabular-nums">{fmt(planned)} h</span>;
  }
  const used = actual ?? 0;
  const usedPct = Math.min(100, (used / budget) * 100);
  const plannedPct = Math.min(100 - usedPct, (planned / budget) * 100);
  const over = used + planned > budget;

  return (
    <span className="flex items-center gap-2">
      <span className="relative block h-2 w-28 overflow-hidden rounded-full bg-hair">
        <span
          className="absolute inset-y-0 left-0 bg-[var(--moss)]"
          style={{ width: `${usedPct}%` }}
        />
        <span
          className="absolute inset-y-0"
          style={{
            left: `${usedPct}%`,
            width: `${Math.max(0, plannedPct)}%`,
            background: "color-mix(in oklab, var(--moss) 40%, transparent)",
          }}
        />
      </span>
      <span
        className="text-[11.5px] tabular-nums"
        style={{ color: over ? "var(--crit)" : "var(--dim)" }}
        title={`${fmt(used)} h verbraucht, ${fmt(planned)} h verplant, Budget ${fmt(budget)} h`}
      >
        {fmt(planned)} h
      </span>
    </span>
  );
}

function ProjectDialog({ project, onClose }: { project?: PlanProject; onClose: () => void }) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState(project?.name ?? "");
  const [client, setClient] = useState(project?.client ?? "");
  const [status, setStatus] = useState<"confirmed" | "offer">(project?.status ?? "confirmed");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Projekt bearbeiten" : "Projekt anlegen"}</DialogTitle>
          <DialogDescription>
            Angebote lassen sich in der Planung ein- und ausblenden und zählen standardmäßig nicht
            zur Auslastung.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pj-name">Name</Label>
            <Input id="pj-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pj-client">Kunde</Label>
              <Input
                id="pj-client"
                value={client}
                placeholder="z.B. Nordlicht Versicherung"
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pj-status">Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as "confirmed" | "offer")}>
                <SelectTrigger id="pj-status">
                  <SelectValue>{(v) => (v === "offer" ? "Angebot" : "beauftragt")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">beauftragt</SelectItem>
                  <SelectItem value="offer">Angebot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {project ? (
            <Button
              variant="ghost"
              className="text-crit hover:text-crit"
              onClick={() =>
                start(async () => {
                  const ok = await confirm({
                    title: `„${project.name}" archivieren?`,
                    description:
                      "Das Projekt verschwindet samt Teilprojekten aus der Planung. Die eingetragenen Wochen bleiben gespeichert.",
                    confirmLabel: "Archivieren",
                    tone: "danger",
                  });
                  if (!ok) return;
                  await archiveProject(project.id);
                  toast.success("Projekt archiviert");
                  onClose();
                })
              }
            >
              Archivieren
            </Button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              disabled={pending || name.trim() === ""}
              onClick={() =>
                start(async () => {
                  if (project) {
                    await updateProject(project.id, { name: name.trim(), client, status });
                    toast.success("Gespeichert");
                  } else {
                    await createProject({ name: name.trim(), client, status });
                    toast.success(`„${name.trim()}" angelegt`);
                  }
                  onClose();
                })
              }
            >
              {project ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubDialog({
  projectId,
  sub,
  planned = 0,
  onClose,
}: {
  projectId: string;
  sub?: PlanSubproject;
  planned?: number;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState(sub?.name ?? "");
  const [openEnded, setOpenEnded] = useState(sub?.openEnded ?? false);
  const [startsOn, setStartsOn] = useState(sub?.startsOn ?? todayWeek());
  const [endsOn, setEndsOn] = useState(sub?.endsOn ?? "");
  const [budget, setBudget] = useState(sub?.budgetHours == null ? "" : String(sub.budgetHours));
  const [actual, setActual] = useState(sub?.actualHours == null ? "" : String(sub.actualHours));

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sub ? "Teilprojekt bearbeiten" : "Teilprojekt anlegen"}</DialogTitle>
          <DialogDescription>
            Die verbrauchten Stunden trägst du gelegentlich von Hand nach — daraus wird der
            Balken „verbraucht, verplant, Budget".
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sp-name">Name</Label>
            <Input id="sp-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="sp-open" checked={openEnded} onCheckedChange={setOpenEnded} />
            <Label htmlFor="sp-open" className="cursor-pointer font-normal">
              Dauerläufer ohne Enddatum
            </Label>
          </div>

          {!openEnded ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sp-start">Beginn</Label>
                <Input
                  id="sp-start"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sp-end">Ende</Label>
                <Input
                  id="sp-end"
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sp-budget">Budget in Stunden</Label>
              <Input
                id="sp-budget"
                inputMode="decimal"
                value={budget}
                placeholder="optional"
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sp-actual">Bisher verbraucht</Label>
              <Input
                id="sp-actual"
                inputMode="decimal"
                value={actual}
                placeholder="optional"
                onChange={(e) => setActual(e.target.value)}
              />
            </div>
          </div>

          {sub ? (
            <p className="text-[12px] text-dim">
              Aktuell {fmt(planned)} h verplant
              {sub.actualAsOf ? ` · verbrauchte Stunden zuletzt am ${formatDe(sub.actualAsOf)} nachgetragen` : ""}
            </p>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {sub ? (
            <Button
              variant="ghost"
              className="text-crit hover:text-crit"
              onClick={() =>
                start(async () => {
                  const ok = await confirm({
                    title: `„${sub.name}" archivieren?`,
                    description:
                      "Das Teilprojekt verschwindet aus der Planung, die eingetragenen Wochen bleiben gespeichert.",
                    confirmLabel: "Archivieren",
                    tone: "danger",
                  });
                  if (!ok) return;
                  await archiveSubproject(sub.id);
                  toast.success("Teilprojekt archiviert");
                  onClose();
                })
              }
            >
              Archivieren
            </Button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              disabled={pending || name.trim() === ""}
              onClick={() =>
                start(async () => {
                  const payload = {
                    name: name.trim(),
                    openEnded,
                    startsOn: openEnded ? null : startsOn || null,
                    endsOn: openEnded ? null : endsOn || null,
                    budgetHours: num(budget),
                    actualHours: num(actual),
                  };
                  if (sub) {
                    await updateSubproject(sub.id, payload);
                    toast.success("Gespeichert");
                  } else {
                    await createSubproject({ projectId, ...payload });
                    toast.success(`„${name.trim()}" angelegt`);
                  }
                  onClose();
                })
              }
            >
              {sub ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function plannedBySub(data: PlanData): Map<string, number> {
  const map = new Map<string, number>();
  for (const slot of data.slots) {
    const row = data.hours[slotKey(slot.personId, slot.subprojectId)] ?? {};
    let sum = 0;
    for (const value of Object.values(row)) sum += value;
    map.set(slot.subprojectId, (map.get(slot.subprojectId) ?? 0) + sum);
  }
  return map;
}

function formatDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
