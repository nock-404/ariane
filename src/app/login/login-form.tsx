"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm() {
  const [state, action] = useActionState(signIn, INITIAL);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="passwort">Passwort</Label>
        <Input
          id="passwort"
          name="passwort"
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "passwort-fehler" : undefined}
        />
        {state.error ? (
          <p id="passwort-fehler" className="text-[12.5px] text-crit" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Einen Moment…" : "Anmelden"}
    </Button>
  );
}
