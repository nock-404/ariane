"use client";

import { useTransition } from "react";
import { toast } from "sonner";

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
import { setDefaultRegion } from "@/app/actions";
import { regionLabel, regionOptions } from "@/lib/holidays";

/**
 * Die Feiertagsregion steht am Team, nicht an jeder Person — für fast alle
 * ist sie gleich. Wer woanders arbeitet, bekommt seine eigene: maßgeblich
 * ist, wo jemand die Arbeitsleistung erbringt, nicht wo die Firma sitzt.
 */
const GROUPS = ["Deutschland", "Andere Länder"];

export function TeamSettings({ value, readOnly }: { value: string; readOnly: boolean }) {
  const [pending, start] = useTransition();

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">Feiertage</h2>
        <p className="text-sm text-dim">
          Feiertage kürzen die verfügbare Zeit einer Woche. Hier steht, welche für das Team gelten.
          Wer woanders arbeitet — anderes Bundesland oder anderes Land — bekommt seine eigene
          Region in den Stammdaten.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="team-land">Feiertage des Teams</Label>
        <Select
          value={value}
          disabled={readOnly || pending}
          onValueChange={(v) =>
            v &&
            start(async () => {
              await setDefaultRegion(v);
              toast.success("Bundesland geändert", {
                description: "Die Feiertage sind neu gerechnet.",
              });
            })
          }
        >
          <SelectTrigger id="team-land" className="w-full sm:w-80">
            {/* Base UI zeigt sonst den Schlüssel, nicht die Beschriftung. */}
            <SelectValue>{(code) => regionLabel(String(code))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((group) => (
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
    </section>
  );
}
