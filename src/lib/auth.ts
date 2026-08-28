import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Testphase-Zugang: zwei Passwörter statt Benutzerkonten — eines zum
 * Planen, eines nur zum Schauen für alle, die mitlesen sollen. Der Cookie enthält
 * keine Sitzungsdaten, sondern einen aus dem Passwort abgeleiteten Beweis;
 * ein geändertes Passwort entwertet damit sofort alle Cookies.
 *
 * Sobald das Werkzeug wirklich benutzt wird, kommt better-auth darüber.
 */

export const SESSION_COOKIE = "ariane_zugang";

export type Role = "writer" | "reader";

function writerPassword(): string {
  const pw = process.env.ARIANE_PASSWORD;
  if (!pw) throw new Error("ARIANE_PASSWORD fehlt — in .env.local oder in Vercel setzen.");
  return pw;
}

/** Optional. Fehlt es, gibt es schlicht keinen Nur-Lesen-Zugang. */
function readerPassword(): string | null {
  const pw = process.env.ARIANE_PASSWORD_LESEN;
  return pw && pw.length > 0 ? pw : null;
}

function tokenFrom(secret: string, role: Role): string {
  return createHmac("sha256", secret).update(`ariane-zugang-v2:${role}`).digest("hex");
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Welche Rolle gehört zu diesem Passwort — oder keine. */
export function roleForPassword(input: string): Role | null {
  if (same(input, writerPassword())) return "writer";
  const reader = readerPassword();
  if (reader && same(input, reader)) return "reader";
  return null;
}

export function tokenFor(role: Role): string {
  return tokenFrom(role === "writer" ? writerPassword() : (readerPassword() ?? writerPassword()), role);
}

/** Welche Rolle steckt in diesem Cookie — oder keine. */
export function roleOf(value: string | undefined): Role | null {
  if (!value) return null;
  if (same(value, tokenFor("writer"))) return "writer";
  if (readerPassword() && same(value, tokenFor("reader"))) return "reader";
  return null;
}
