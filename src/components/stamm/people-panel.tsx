"use client";

import { CalendarOff, Plus, Trash2, UserPlus } from "lucide-react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  archivePerson,
  createPerson,
  removeCapacity,
  setAbsenceDates,
  setAbsenceRange,
  setCapacity,
  updatePerson,
} from "@/app/actions";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { netHoursAt, type PlanData, type PlanPerson } from "@/lib/capacity";
import { regionLabel, regionOptions } from "@/lib/holidays";
import { fmt } from "@/lib/rows";
import { addWeeks, isoWeek, todayWeek, weekSpanLabel } from "@/lib/weeks";
import { rangeLabel, spreadAbsence, todayIso } from "@/lib/absence";

const PEOPLE_COLUMNS = [
  { id: "name", label: "Name", width: 190 },
  { id: "cap", label: "Kapazität", width: 110 },
  { id: "land", label: "Feiertage", width: 170 },
  { id: "urlaub", label: "Urlaub", width: 100 },
  { id: "note", label: "Notiz", width: 180 },
  { id: "tools", label: " ", width: 110, align: "right" as const },
];

export function PeoplePanel({ data }: { data: PlanData }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = todayWeek();
  const columns = useColumns("personen", PEOPLE_COLUMNS);
  // Nicht das Objekt merken, sondern die Id — sonst zeigt der offene Dialog
  // nach dem Eintragen noch den Stand von vorhin.
  const editing = data.people.find((p) => p.id === editingId) ?? null;

  if (data.people.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-14 text-center shadow-[var(--shadow-soft)]">
        <p className="font-semibold">Noch niemand im Team</p>
        <p className="max-w-md text-sm text-dim">
          Leg deine Teammitglieder an — Name und wie viele Stunden pro Woche nach Meetings und
          internem Kram übrig bleiben. Alles andere kommt später.
        </p>
        <NewPerson open={open} setOpen={setOpen} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-dim">
          {data.people.length} Personen · Kapazität ist die Netto-Zeit pro Woche, also nach
          Meetings und internem Kram.
        </p>
        <NewPerson open={open} setOpen={setOpen} />
      </div>

      <TableFrame>
        <table className="w-full table-fixed text-sm">
          {columns.colgroup}
          <thead>{columns.header}</thead>
          <tbody>
            {data.people.map((person) => {
              const upcoming = Object.entries(person.absences).filter(([w]) => w >= today);
              const days = upcoming.reduce((sum, [, d]) => sum + d, 0);
              return (
                <tr key={person.id} className="border-b border-hair last:border-0 hover:bg-raised">
                  <td className="truncate px-4 py-2.5 font-medium">{person.name}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {fmt(netHoursAt(person, today))} h
                    {person.caps.length > 1 ? (
                      <span className="ml-1.5 text-[11px] text-dim">
                        {person.caps.length} Stufen
                      </span>
                    ) : null}
                  </td>
                  <td className="truncate px-4 py-2.5 text-dim">
                    {regionLabel(person.region)}
                    {person.regionOwn === "" ? (
                      <span className="ml-1.5 text-[11px] text-faint">Team</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-dim">
                    {days > 0 ? `${fmt(days)} Tage` : "–"}
                  </td>
                  <td className="truncate px-4 py-2.5 text-dim">{person.note || "–"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(person.id)}>
                      Ändern
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableFrame>

      {editing ? (
        <PersonDialog
          person={editing}
          teamLand={data.defaultRegion}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </div>
  );
}

function NewPerson({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [hours, setHours] = useState("34");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        Person anlegen
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Person anlegen</DialogTitle>
          <DialogDescription>
            Die Kapazität ist die Netto-Zeit pro Woche — was nach Meetings und internem Kram für
            Projekte übrig bleibt. Die Feiertage kommen vom Team; abweichen kann man später.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="np-hours">Stunden pro Woche</Label>
            <Input
              id="np-hours"
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            disabled={pending || name.trim() === ""}
            onClick={() =>
              start(async () => {
                // Kein Bundesland: es gilt das des Teams, siehe Einstellungen.
                await createPerson({
                  name: name.trim(),
                  netHours: Number(hours.replace(",", ".")) || 0,
                });
                toast.success(`${name.trim()} angelegt`);
                setName("");
                setOpen(false);
              })
            }
          >
            Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonDialog({
  person,
  teamLand,
  onClose,
}: {
  person: PlanPerson;
  teamLand: string;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState(person.name);
  const [land, setLand] = useState(person.regionOwn || "team");
  const [note, setNote] = useState(person.note);

  const [capFrom, setCapFrom] = useState(todayWeek());
  const [capHours, setCapHours] = useState("");

  const [absFrom, setAbsFrom] = useState(todayIso());
  const [absTo, setAbsTo] = useState(todayIso());

  // Vorschau: was der eingegebene Zeitraum tatsächlich bedeutet.
  const spread = spreadAbsence(absFrom, absTo, person.region);

  const today = todayWeek();
  const upcoming = Object.entries(person.absences)
    .filter(([w]) => w >= addWeeks(today, -4))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[86vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{person.name}</DialogTitle>
          <DialogDescription>
            Kapazität gilt jeweils ab einem Stichtag — so verbiegt ein Wechsel auf Teilzeit die
            Vergangenheit nicht.
          </DialogDescription>
        </DialogHeader>

        <OverlayScrollbarsComponent
          defer
          options={{ scrollbars: { theme: "os-theme-ariane", autoHide: "leave" } }}
          className="-mr-2 max-h-[62vh] pr-2"
        >
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pd-name">Name</Label>
                <Input id="pd-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pd-land">Feiertage</Label>
                <Select value={land} onValueChange={(v) => v && setLand(v)}>
                  <SelectTrigger id="pd-land">
                    <SelectValue>
                      {(code) =>
                        code === "team"
                          ? `wie das Team · ${regionLabel(teamLand)}`
                          : regionLabel(String(code))
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">wie das Team · {regionLabel(teamLand)}</SelectItem>
                    {["Deutschland", "Andere Länder"].map((group) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {regionOptions()
                          .filter((o) => o.group === group)
                          .map((o) => (
                            <SelectItem key={o.code} value={o.code}>
                              {o.label}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pd-note">Notiz</Label>
              <Input
                id="pd-note"
                value={note}
                placeholder="z.B. Senior, Schnittstellen"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold">Kapazität</h3>
            <ul className="flex flex-col divide-y divide-hair rounded-md border border-line">
              {person.caps.map((cap) => (
                <li key={cap.id ?? cap.validFrom} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="tabular-nums">{fmt(cap.netHours)} h / Woche</span>
                  <span className="text-dim">ab {formatDe(cap.validFrom)}</span>
                  {person.caps.length > 1 && cap.id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto"
                      title="Stufe entfernen"
                      onClick={() =>
                        start(async () => {
                          const ok = await confirm({
                            title: "Kapazitätsstufe entfernen?",
                            description: `Ab ${formatDe(cap.validFrom)} gilt dann wieder die vorherige Stufe.`,
                            confirmLabel: "Entfernen",
                            tone: "danger",
                          });
                          if (ok) await removeCapacity(cap.id!);
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pd-capfrom" className="text-[11.5px] text-dim">
                  ab Woche
                </Label>
                <Input
                  id="pd-capfrom"
                  type="date"
                  className="w-40"
                  value={capFrom}
                  onChange={(e) => setCapFrom(mondayInput(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pd-caph" className="text-[11.5px] text-dim">
                  Stunden
                </Label>
                <Input
                  id="pd-caph"
                  className="w-24"
                  inputMode="decimal"
                  value={capHours}
                  placeholder="30"
                  onChange={(e) => setCapHours(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={pending || capHours.trim() === ""}
                onClick={() =>
                  start(async () => {
                    await setCapacity(person.id, capFrom, Number(capHours.replace(",", ".")) || 0);
                    setCapHours("");
                    toast.success("Kapazität geändert");
                  })
                }
              >
                <Plus />
                Stufe hinzufügen
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold">Urlaub</h3>
            {upcoming.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-dim">
                Kein Urlaub eingetragen. Ohne Urlaub stimmt die Auslastung im Sommer nicht.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {upcoming.map(([week, days]) => (
                  <li key={week}>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[12px] hover:border-crit hover:text-crit"
                      title={`KW ${isoWeek(week).week} (${weekSpanLabel(week)}) entfernen`}
                      onClick={() =>
                        start(async () => void (await setAbsenceRange(person.id, [week], 0)))
                      }
                    >
                      <CalendarOff size={12} />
                      KW {isoWeek(week).week} · {fmt(days)} T
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pd-absfrom" className="text-[11.5px] text-dim">
                  erster Tag
                </Label>
                <Input
                  id="pd-absfrom"
                  type="date"
                  className="w-40"
                  value={absFrom}
                  onChange={(e) => {
                    setAbsFrom(e.target.value);
                    if (absTo < e.target.value) setAbsTo(e.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pd-absto" className="text-[11.5px] text-dim">
                  letzter Tag
                </Label>
                <Input
                  id="pd-absto"
                  type="date"
                  className="w-40"
                  min={absFrom}
                  value={absTo}
                  onChange={(e) => setAbsTo(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={pending || spread.days === 0}
                onClick={() =>
                  start(async () => {
                    const res = await setAbsenceDates(person.id, absFrom, absTo);
                    toast.success(
                      `${res.days} ${res.days === 1 ? "Tag" : "Tage"} Urlaub eingetragen`,
                      {
                        description: `${rangeLabel(absFrom, absTo)} · ${res.weeks} ${res.weeks === 1 ? "Woche" : "Wochen"} betroffen`,
                      },
                    );
                  })
                }
              >
                <Plus />
                Eintragen
              </Button>
            </div>

            <p className="text-[11.5px] leading-relaxed text-dim">
              {spread.days === 0
                ? "Wähle den ersten und den letzten Urlaubstag."
                : `${rangeLabel(absFrom, absTo)} sind ${spread.days} ${spread.days === 1 ? "Arbeitstag" : "Arbeitstage"}` +
                  (spread.weekends > 0 ? `, ${spread.weekends} Wochenendtage zählen nicht mit` : "") +
                  (spread.holidays.length > 0
                    ? `, ${spread.holidays.map((h) => h.name).join(" und ")} ebenfalls nicht`
                    : "") +
                  "."}
            </p>
          </section>
        </div>
        </OverlayScrollbarsComponent>

        <DialogFooter className="mt-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-crit hover:text-crit"
            onClick={() =>
              start(async () => {
                const ok = await confirm({
                  title: `${person.name} aus dem Team nehmen?`,
                  description:
                    "Die Person verschwindet aus der Planung. Die bisherigen Wochen bleiben gespeichert, damit die Vergangenheit stimmt.",
                  confirmLabel: "Entfernen",
                  tone: "danger",
                });
                if (!ok) return;
                await archivePerson(person.id);
                toast.success(`${person.name} aus dem Team genommen`);
                onClose();
              })
            }
          >
            Aus dem Team nehmen
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Schließen
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await updatePerson(person.id, {
                    name: name.trim(),
                    region: land === "team" ? "" : land,
                    note,
                  });
                  toast.success("Gespeichert");
                  onClose();
                })
              }
            >
              Speichern
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mondayInput(value: string): string {
  if (!value) return todayWeek();
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  return new Date(date.getTime() + shift * 86_400_000).toISOString().slice(0, 10);
}

function formatDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
