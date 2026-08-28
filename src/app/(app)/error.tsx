"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ariane]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-start gap-3 rounded-lg border border-line bg-surface p-6 shadow-[var(--shadow-soft)]">
        <h1 className="text-[17px] font-bold">Das hat nicht geklappt</h1>
        <p className="text-sm text-dim">
          Die Seite konnte nicht geladen werden. Meistens hilft ein zweiter Versuch — die Datenbank
          schläft nach längerer Ruhe ein und braucht einen Moment zum Aufwachen.
        </p>
        {error.digest ? (
          <p className="text-[11px] text-faint">Kennung: {error.digest}</p>
        ) : null}
        <Button onClick={reset}>Noch einmal versuchen</Button>
      </div>
    </div>
  );
}
