import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, roleOf, type Role } from "./auth";

/**
 * Jede Server Action ist ein offener POST-Endpunkt, dessen Kennung im
 * Client-Bundle steht. Der Schutz im Layout reicht deshalb nicht — jede
 * Action prüft selbst.
 */
export async function currentRole(): Promise<Role | null> {
  const jar = await cookies();
  return roleOf(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Für Seiten. Nicht werfen, sondern umleiten — das Layout leitet zwar auch
 * um, läuft aber parallel; ein geworfener Fehler landet vorher in der
 * Fehlerseite und im Log.
 */
export async function requireReader(): Promise<Role> {
  const role = await currentRole();
  if (!role) redirect("/login");
  return role;
}

export async function requireWriter(): Promise<void> {
  const role = await currentRole();
  if (role !== "writer") throw new Error("Dieser Zugang darf nur lesen.");
}
