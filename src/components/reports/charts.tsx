"use client";

import { useId, useState } from "react";

import { fmt } from "@/lib/rows";
import { hours as fmtHours, pct, type BudgetRow, type PersonLoad, type ProjectShare, type WeekPoint } from "@/lib/reports";
import { weekSpanLabel } from "@/lib/weeks";

import styles from "./charts.module.css";

/* ── Kennzahl ─────────────────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "crit";
}) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {hint ? <span className={styles.statHint}>{hint}</span> : null}
    </div>
  );
}

/* ── Verlauf: verplant gegen Kapazität ────────────────────────────────── */

export function LoadOverTime({ points }: { points: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();

  if (points.length === 0) return <Empty>Für diesen Zeitraum liegen keine Wochen vor.</Empty>;

  const W = 1000;
  const H = 240;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 26;

  const max = Math.max(
    120,
    ...points.map((p) => Math.max(p.capacity, p.planned)),
  );
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, points.length - 1);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const step = (W - padL - padR) / Math.max(1, points.length - 1);

  const line = (key: "capacity" | "planned") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const areaPath =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.planned).toFixed(1)}`).join(" ") +
    ` L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const active = hover === null ? null : points[hover];

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span>Kapazität und Verplantes je Woche</span>
        <Legend
          items={[
            { color: "var(--dim)", label: "Kapazität", dashed: true },
            { color: "var(--moss)", label: "verplant" },
          ]}
        />
      </figcaption>

      <div className={styles.plotWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.plot} role="img" aria-label="Kapazität und verplante Stunden je Woche">
          <defs>
            <clipPath id={clipId}>
              <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
            </clipPath>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={padL - 8} y={y(t) + 4} className={styles.axis} textAnchor="end">
                {t}
              </text>
            </g>
          ))}

          <g clipPath={`url(#${clipId})`}>
            <path d={areaPath} className={styles.area} />
            <path d={line("capacity")} className={styles.lineCapacity} />
            <path d={line("planned")} className={styles.linePlanned} />
            {points.map((p, i) =>
              p.ratio !== null && p.ratio > 1.001 ? (
                <circle key={p.week} cx={x(i)} cy={y(p.planned)} r={3.5} className={styles.dotOver} />
              ) : null,
            )}
          </g>

          {points.map((p, i) => (
            <text
              key={p.week}
              x={x(i)}
              y={H - 8}
              className={styles.axis}
              textAnchor="middle"
              opacity={points.length > 26 ? (i % 4 === 0 ? 1 : 0) : i % 2 === 0 ? 1 : 0}
            >
              {p.label}
            </text>
          ))}

          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} className={styles.crosshair} />
          ) : null}

          {points.map((p, i) => (
            <rect
              key={`hit-${p.week}`}
              x={x(i) - step / 2}
              y={padT}
              width={step}
              height={H - padT - padB}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {active ? (
          <div
            className={styles.tooltip}
            style={{ left: `${(x(hover!) / W) * 100}%` }}
            role="status"
          >
            <b>KW {active.label}</b>
            <span>{weekSpanLabel(active.week)}</span>
            <span>
              {fmtHours(active.planned)} von {fmtHours(active.capacity)}
            </span>
            <span data-tone={active.free < 0 ? "crit" : "ok"}>
              {active.free >= 0 ? `${fmt(active.free)} h frei` : `${fmt(-active.free)} h zu viel`}
              {active.ratio !== null ? ` · ${pct(active.ratio)}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

/* ── Auslastung je Person ─────────────────────────────────────────────── */

export function PeopleBars({ people }: { people: PersonLoad[] }) {
  const sorted = [...people].sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1));
  if (sorted.length === 0) return <Empty>Noch niemand im Team.</Empty>;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span>Auslastung je Person im Zeitraum</span>
        <Legend
          items={[
            { color: "var(--moss)", label: "bis 100 %" },
            { color: "var(--crit)", label: "darüber" },
          ]}
        />
      </figcaption>

      <ul className={styles.barList}>
        {sorted.map((row) => {
          const ratio = row.ratio ?? 0;
          const over = ratio > 1.001;
          return (
            <li key={row.person.id} className={styles.barRow}>
              <span className={styles.barName} title={row.person.name}>
                {row.person.name}
              </span>
              <span className={styles.barTrack}>
                <span
                  className={styles.barFill}
                  style={{
                    width: `${Math.min(100, ratio * 100)}%`,
                    background: over ? "var(--crit)" : "var(--moss)",
                  }}
                />
                <span className={styles.barMark} />
                {over ? (
                  <span
                    className={styles.barOver}
                    style={{ width: `${Math.min(60, (ratio - 1) * 100)}%` }}
                  />
                ) : null}
              </span>
              <span className={styles.barValue} data-tone={over ? "crit" : undefined}>
                {pct(row.ratio)}
              </span>
              <span className={styles.barNote}>
                {row.overWeeks > 0
                  ? `${row.overWeeks} Wo. über`
                  : row.awayWeeks > 0
                    ? `${row.awayWeeks} Wo. weg`
                    : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/* ── Stunden je Projekt ───────────────────────────────────────────────── */

export function ProjectBars({ projects }: { projects: ProjectShare[] }) {
  if (projects.length === 0) return <Empty>Im Zeitraum ist nichts verplant.</Empty>;
  const max = Math.max(...projects.map((p) => p.hours));

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span>Wohin die Zeit geht</span>
      </figcaption>

      <ul className={styles.barList}>
        {projects.map((p) => (
          <li key={p.id} className={styles.barRow}>
            <span className={styles.barName} title={`${p.name}${p.client ? ` · ${p.client}` : ""}`}>
              <span className={styles.swatch} style={{ background: p.color }} />
              {p.name}
              {p.status === "offer" ? <span className={styles.tag}>Angebot</span> : null}
            </span>
            <span className={styles.barTrack}>
              <span
                className={styles.barFill}
                style={{ width: `${(p.hours / max) * 100}%`, background: p.color }}
              />
            </span>
            <span className={styles.barValue}>{fmtHours(p.hours)}</span>
            <span className={styles.barNote}>{Math.round(p.share * 100)} %</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ── Budgets ──────────────────────────────────────────────────────────── */

export function BudgetBars({ rows }: { rows: BudgetRow[] }) {
  if (rows.length === 0) {
    return <Empty>Kein Teilprojekt hat ein Stundenbudget hinterlegt.</Empty>;
  }

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span>Budget je Teilprojekt</span>
        <Legend
          items={[
            { color: "var(--ink)", label: "verbraucht" },
            { color: "var(--dim)", label: "verplant" },
            { color: "var(--crit)", label: "über Budget" },
          ]}
        />
      </figcaption>

      <ul className={styles.barList}>
        {rows.map((row) => {
          const total = row.actual + row.planned;
          const scale = Math.max(row.budget, total);
          return (
            <li key={`${row.projectId}-${row.sub}`} className={styles.barRow}>
              <span className={styles.barName} title={`${row.project} · ${row.sub}`}>
                <span className={styles.swatch} style={{ background: row.color }} />
                {row.sub}
                <span className={styles.sub}>{row.project}</span>
              </span>
              <span className={styles.barTrack} data-budget="">
                <span
                  className={styles.budgetActual}
                  style={{ width: `${(row.actual / scale) * 100}%` }}
                />
                <span
                  className={styles.budgetPlanned}
                  style={{ width: `${(row.planned / scale) * 100}%` }}
                />
                <span className={styles.budgetLimit} style={{ left: `${(row.budget / scale) * 100}%` }} />
              </span>
              <span className={styles.barValue} data-tone={row.over ? "crit" : undefined}>
                {Math.round((total / row.budget) * 100)} %
              </span>
              <span className={styles.barNote}>
                {fmt(total)} von {fmt(row.budget)} h
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/* ── Bausteine ────────────────────────────────────────────────────────── */

function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <span className={styles.legend}>
      {items.map((i) => (
        <span key={i.label} className={styles.legendItem}>
          <span
            className={styles.legendMark}
            data-dashed={i.dashed || undefined}
            style={{ background: i.dashed ? "transparent" : i.color, borderColor: i.color }}
          />
          {i.label}
        </span>
      ))}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
