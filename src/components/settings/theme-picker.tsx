"use client";

import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { usePrefs } from "@/lib/prefs";
import { THEMES, type Skin, type Theme } from "@/lib/themes";

/**
 * Themenauswahl. Jede Karte zeigt eine kleine, echte Vorschau des Rasters —
 * hell und dunkel nebeneinander, damit man nicht raten muss.
 */
export function ThemePicker() {
  const skin = usePrefs((s) => s.skin);
  const setSkin = usePrefs((s) => s.setSkin);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Farbthema</h2>
          <p className="text-sm text-dim">
            Gilt für die ganze Oberfläche. Hell und Dunkel sind jeweils eigens abgestimmt, die
            Projektfarben bleiben überall gleich.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
          <Button
            variant={mounted && resolvedTheme === "light" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTheme("light")}
          >
            Hell
          </Button>
          <Button
            variant={mounted && resolvedTheme === "dark" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTheme("dark")}
          >
            Dunkel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTheme("system")}>
            System
          </Button>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => (
          <li key={theme.id}>
            <button
              type="button"
              onClick={() => setSkin(theme.id)}
              aria-pressed={skin === theme.id}
              className="group flex w-full flex-col gap-2 rounded-lg border border-line bg-surface p-2.5 text-left transition-colors hover:border-moss aria-pressed:border-moss aria-pressed:ring-2 aria-pressed:ring-moss/35"
            >
              <span className="flex items-center gap-2 px-0.5">
                <span className="text-[13.5px] font-semibold">{theme.name}</span>
                {skin === theme.id ? (
                  <Check size={14} className="text-moss" />
                ) : null}
                <span className="ml-auto text-[11px] text-dim">Hell · Dunkel</span>
              </span>

              <span className="grid grid-cols-2 gap-1.5">
                <Preview skin={theme.light} />
                <Preview skin={theme.dark} />
              </span>

              <span className="px-0.5 text-[11.5px] leading-snug text-dim">{theme.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ein Miniraster in den Farben des Themas: Kopfzeile, zwei Zeilen, Balken. */
function Preview({ skin }: { skin: Skin }) {
  const bars = [0.35, 0.6, 0.95, 1.2, 0.5, 0.8];

  return (
    <span
      className="block overflow-hidden rounded-md border"
      style={{ background: skin.surface, borderColor: skin.line }}
    >
      <span className="flex items-center gap-1 px-1.5 py-1" style={{ background: skin.bg }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: skin.moss }} />
        <span className="h-1 w-6 rounded-full" style={{ background: skin.dim, opacity: 0.5 }} />
        <span className="ml-auto h-1 w-3 rounded-full" style={{ background: skin.faint, opacity: 0.6 }} />
      </span>

      <span className="flex items-end gap-[3px] px-1.5 pt-2 pb-1.5" style={{ height: 42 }}>
        {bars.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-[2px]"
            style={{
              height: `${Math.min(1, v) * 100}%`,
              background:
                v > 1 ? skin.crit : v >= 0.95 ? skin.moss : v >= 0.85 ? skin.warn : skin.dim,
              opacity: v > 1 || v >= 0.85 ? 0.85 : 0.35,
            }}
          />
        ))}
      </span>

      <span className="flex items-center gap-1 border-t px-1.5 py-1" style={{ borderColor: skin.hair }}>
        <span className="h-1 w-8 rounded-full" style={{ background: skin.ink, opacity: 0.35 }} />
        <span className="h-1 w-4 rounded-full" style={{ background: skin.moss, opacity: 0.8 }} />
      </span>
    </span>
  );
}

export type { Theme };
