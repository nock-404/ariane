"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Ein Rückfrage-Dialog für alles, was wehtut. `window.confirm` kommt hier
 * nicht vor: das sieht nach Betriebssystem aus, lässt sich nicht gestalten
 * und blockiert die Seite.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Wirklich löschen?", tone: "danger" })) …
 */

export type ConfirmOptions = {
  title: string;
  description?: string;
  /** Beschriftung des bestätigenden Knopfs. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" färbt den Knopf in die Warnfarbe. */
  tone?: "default" | "danger";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const openRef = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    // Zwei Rückfragen gleichzeitig wären ein Bedienfehler — die zweite
    // wartet nicht, sie gilt als abgelehnt.
    if (openRef.current) return Promise.resolve(false);
    openRef.current = true;
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      openRef.current = false;
      setPending(null);
    },
    [pending],
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description ? (
              <AlertDialogDescription>{pending.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {pending?.cancelLabel ?? "Abbrechen"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={
                pending?.tone === "danger"
                  ? "bg-crit text-[var(--surface)] hover:bg-crit/85"
                  : undefined
              }
            >
              {pending?.confirmLabel ?? "Ja, machen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm braucht den ConfirmProvider im Baum.");
  return ctx;
}
