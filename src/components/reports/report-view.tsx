"use client";

import { Download, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectColorMap } from "@/lib/colors";
import type { PlanData } from "@/lib/capacity";
import { buildReport, hours as fmtHours, pct, periodWeeks, PERIODS, type PeriodId } from "@/lib/reports";
import { fmt } from "@/lib/rows";
import { isoWeek } from "@/lib/weeks";

import { BudgetBars, Empty, LoadOverTime, PeopleBars, ProjectBars, Stat } from "./charts";
import styles from "./charts.module.css";

/**
 * Die Auswertungsseite rechnet auf demselben Datensatz wie das Raster und
 * beantwortet die vier Fragen, die von außen kommen: Sind wir voll? Wer ist
 * dicht? Wohin geht die Zeit? Und reißt ein Budget?
 */
export function ReportView({ data }: { data: PlanData }) {
  const [period, setPeriod] = useState<PeriodId>("12w");
  const [includeOffers, setIncludeOffers] = useState(false);

  const colorOf = useMemo(
    () => projectColorMap(data.projects.map((p) => p.id)),
    [data.projects],
  );

  const report = useMemo(
    () =>
      buildReport({
        data,
        hours: data.hours,
        slots: data.slots,
        includeOffers,
        weeks: periodWeeks(period, data.weeks),
        colorOf,
      }),
    [data, includeOffers, period, colorOf],
  );

  const { totals } = report;
  const ratio = totals.ratio ?? 0;

  if (data.people.length === 0) {
    return (
      <Empty>
        Sobald Personen und Projekte angelegt sind, stehen hier Auslastung, Verlauf und Budgets.
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-[var(--shadow-soft)]">
        <Tabs value={period} onValueChange={(v) => v && setPeriod(v as PeriodId)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Switch id="rep-offers" checked={includeOffers} onCheckedChange={setIncludeOffers} />
          <Label htmlFor="rep-offers" className="cursor-pointer text-[13px] font-normal text-dim">
            Angebote einrechnen
          </Label>
        </div>

        <span className="ml-auto text-[11.5px] text-dim">
          {report.weeks.length > 0
            ? `KW ${isoWeek(report.weeks[0]).week} – ${isoWeek(report.weeks[report.weeks.length - 1]).week} · ${report.weeks.length} Wochen`
            : "kein Zeitraum"}
        </span>

        <a
          href={`/api/export?von=${report.weeks[0] ?? ""}&bis=${report.weeks[report.weeks.length - 1] ?? ""}`}
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download />
          Excel
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Auslastung"
          value={pct(totals.ratio)}
          hint={`${fmtHours(totals.planned)} von ${fmtHours(totals.capacity)}`}
          tone={ratio > 1.001 ? "crit" : ratio >= 0.85 ? "warn" : "neutral"}
        />
        <Stat
          label={totals.free >= 0 ? "Noch frei" : "Fehlt"}
          value={fmtHours(Math.abs(totals.free))}
          hint={
            totals.free >= 0
              ? `entspricht ${fmt(Math.round((totals.free / 34) * 10) / 10)} Vollzeitwochen`
              : "über der Kapazität"
          }
          tone={totals.free < 0 ? "crit" : "good"}
        />
        <Stat
          label="Über 100 Prozent"
          value={String(totals.peopleOver)}
          hint={totals.peopleOver === 1 ? "Person" : "Personen, mindestens eine Woche"}
          tone={totals.peopleOver > 0 ? "crit" : "good"}
        />
        <Stat
          label="Budget gerissen"
          value={String(totals.projectsOverBudget)}
          hint="Teilprojekte, verbraucht plus verplant"
          tone={totals.projectsOverBudget > 0 ? "warn" : "good"}
        />
      </div>

      <LoadOverTime points={report.points} />

      <div className="grid gap-3 lg:grid-cols-2">
        <PeopleBars people={report.people} />
        <ProjectBars projects={report.projects} />
      </div>

      <OverList report={report} />

      <BudgetBars rows={report.budgets} />
    </div>
  );
}

/* ── Was klemmt ───────────────────────────────────────────────────────── */

function OverList({ report }: { report: ReturnType<typeof buildReport> }) {
  const [all, setAll] = useState(false);
  const blocks = all ? report.overBlocks : report.overBlocks.slice(0, 6);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className="flex items-center gap-2">
          <TriangleAlert size={15} className="text-crit" />
          Was klemmt
        </span>
        {report.overBlocks.length > 6 ? (
          <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? "Weniger" : `Alle ${report.overBlocks.length} zeigen`}
          </Button>
        ) : null}
      </figcaption>

      {report.overBlocks.length === 0 ? (
        <Empty>Im gewählten Zeitraum liegt niemand über der Kapazität.</Empty>
      ) : (
        <ul className={styles.barList}>
          {blocks.map((b) => (
            <li key={`${b.person.id}-${b.from}`} className={styles.barRow}>
              <span className={styles.barName}>{b.person.name}</span>
              <span className="text-[12.5px] text-dim">
                {b.weeks === 1
                  ? `KW ${isoWeek(b.from).week}`
                  : `KW ${isoWeek(b.from).week} – ${isoWeek(b.to).week}`}
                <span className="ml-2 text-faint">
                  {b.weeks} {b.weeks === 1 ? "Woche" : "Wochen"}
                </span>
              </span>
              <span className={styles.barValue} data-tone="crit">
                {Math.round(b.peak * 100)} %
              </span>
              <span className={styles.barNote}>⌀ {Math.round(b.average * 100)} %</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
