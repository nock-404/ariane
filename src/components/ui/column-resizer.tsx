"use client";

import { useState } from "react";

import styles from "./column-resizer.module.css";

/**
 * Der Griff am rechten Rand einer Spaltenüberschrift. Ziehen ändert genau
 * diese Spalte — nicht alle auf einmal. Doppelklick setzt sie zurück.
 */
export function ColumnResizer({
  width,
  onResize,
  onReset,
  label,
  min = 26,
  quiet = false,
}: {
  width: number;
  onResize: (px: number) => void;
  onReset?: () => void;
  label: string;
  min?: number;
  /** Kein eigener Strich — die Grenze zeichnet schon ein Rahmen. */
  quiet?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const start = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    setDragging(true);

    const move = (ev: PointerEvent) => onResize(Math.max(min, width + (ev.clientX - startX)));
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      className={`${styles.grip} ${quiet ? styles.quiet : ""}`}
      data-grip=""
      data-dragging={dragging || undefined}
      onPointerDown={start}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onResize(Math.max(min, width - 12));
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onResize(width + 12);
        }
      }}
      title={`${label} — ziehen, Doppelklick setzt zurück`}
    />
  );
}
