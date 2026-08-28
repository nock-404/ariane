"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setAbsenceDates } from "@/app/actions";
import { Button } from "@/components/ui/button";
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
import { rangeLabel, spreadAbsence, todayIso } from "@/lib/absence";
import type { PlanPerson } from "@/lib/capacity";

/**
 * Urlaub direkt aus dem Raster eintragen. Vorher lag das nur in den
 * Stammdaten — die erste Frage der ersten Nutzerin war, wo man es findet.
 */
export function AbsenceDialog({
  person,
  onClose,
}: {
  person: PlanPerson;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());

  const spread = spreadAbsence(from, to, person.region);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Urlaub für {person.name}</DialogTitle>
          <DialogDescription>
            Erster und letzter Urlaubstag. Wochenenden und Feiertage rechnet Ariane selbst heraus.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ab-from" className="text-[11.5px] text-dim">
              erster Tag
            </Label>
            <Input
              id="ab-from"
              type="date"
              className="w-40"
              value={from}
              autoFocus
              onChange={(e) => {
                setFrom(e.target.value);
                if (to < e.target.value) setTo(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ab-to" className="text-[11.5px] text-dim">
              letzter Tag
            </Label>
            <Input
              id="ab-to"
              type="date"
              className="w-40"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <p className="text-[12px] leading-relaxed text-dim">
          {spread.days === 0
            ? "Wähle den ersten und den letzten Urlaubstag."
            : `${rangeLabel(from, to)} sind ${spread.days} ${spread.days === 1 ? "Arbeitstag" : "Arbeitstage"}` +
              (spread.weekends > 0 ? `, ${spread.weekends} Wochenendtage zählen nicht mit` : "") +
              (spread.holidays.length > 0
                ? `, ${spread.holidays.map((h) => h.name).join(" und ")} ebenfalls nicht`
                : "") +
              "."}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={pending || spread.days === 0}
            onClick={() =>
              start(async () => {
                const res = await setAbsenceDates(person.id, from, to);
                toast.success(
                  `${res.days} ${res.days === 1 ? "Tag" : "Tage"} Urlaub für ${person.name}`,
                  { description: rangeLabel(from, to) },
                );
                onClose();
              })
            }
          >
            Eintragen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
