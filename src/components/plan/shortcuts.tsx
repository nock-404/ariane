"use client";

import { Keyboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Eintragen",
    rows: [
      ["Zelle anklicken, Zahl tippen", "setzt die Woche"],
      ["Umschalt + Klick", "mehrere Wochen wählen"],
      ["Zahl bei Auswahl", "füllt alle gewählten Wochen"],
      ["Entf", "leert die Auswahl"],
    ],
  },
  {
    title: "Bewegen",
    rows: [
      ["Pfeiltasten", "Zelle wechseln"],
      ["Umschalt + Pfeil", "Auswahl erweitern"],
      ["Enter / Tabulator", "übernehmen und weiter"],
      ["Alt + Pfeil", "Zuweisung um eine Woche schieben"],
    ],
  },
  {
    title: "Übertragen",
    rows: [
      ["⌘C / ⌘V", "kopieren und einfügen, auch aus Excel"],
      ["⌘D", "Auswahl mit dem ersten Wert füllen"],
      ["⌘Z / ⌘⇧Z", "rückgängig und wiederherstellen"],
    ],
  },
];

/** Die Kürzel gehören in eine Hilfe, nicht als Fließtext unter die Tabelle. */
export function Shortcuts() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" title="Tastenkürzel" aria-label="Tastenkürzel" />
        }
      >
        <Keyboard />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="border-b border-line px-4 py-2.5">
          <p className="text-[13px] font-semibold">Tastenkürzel</p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          {GROUPS.map((group) => (
            <section key={group.title} className="flex flex-col gap-1">
              <h3 className="text-[10.5px] font-semibold tracking-wider text-dim uppercase">
                {group.title}
              </h3>
              <dl className="flex flex-col gap-0.5">
                {group.rows.map(([keys, what]) => (
                  <div key={keys} className="flex items-baseline gap-3">
                    <dt className="w-[170px] flex-none text-[12.5px]">{keys}</dt>
                    <dd className="text-[12px] text-dim">{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
