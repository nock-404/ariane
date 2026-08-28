"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, roleForPassword, tokenFor } from "@/lib/auth";

export type LoginState = { error: string | null };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const input = String(formData.get("passwort") ?? "");

  const role = roleForPassword(input);
  if (!role) {
    return { error: "Das Passwort stimmt nicht. Noch einmal versuchen." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, tokenFor(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });

  redirect("/");
}
