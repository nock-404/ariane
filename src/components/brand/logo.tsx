/**
 * Die Marke: ein Faden, der durch die Wochen läuft.
 *
 * Vier blasse Senkrechte sind das Raster, die kräftige Linie ist der Faden
 * der Ariadne — und zugleich die Auslastungskurve. Der Punkt am Ende ist die
 * laufende Woche. Farben kommen aus den Atelier-Variablen.
 */

export function Mark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.3" strokeLinecap="round">
        <line x1="5" y1="5.5" x2="5" y2="22.5" />
        <line x1="11" y1="5.5" x2="11" y2="22.5" />
        <line x1="17" y1="5.5" x2="17" y2="22.5" />
        <line x1="23" y1="5.5" x2="23" y2="22.5" />
      </g>

      <path
        d="M2 20.2C4.6 20.2 5.4 14.6 8.6 13.4C11.5 12.3 12.8 16.6 15.6 14.9C18.4 13.2 19.4 7.8 23 7.8"
        stroke="var(--moss)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="23" cy="7.8" r="3.1" fill="var(--surface)" />
      <circle cx="23" cy="7.8" r="2.2" fill="var(--moss)" />
    </svg>
  );
}

export function Wordmark({
  size = 26,
  className,
  showMark = true,
}: {
  size?: number;
  className?: string;
  showMark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {showMark ? <Mark size={size} className="flex-none" /> : null}
      <span
        className="font-extrabold"
        style={{ fontSize: size * 0.68, letterSpacing: "-0.025em", lineHeight: 1 }}
      >
        Ariane
      </span>
    </span>
  );
}
