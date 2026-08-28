/**
 * Projektfarben. Sie sind Identität, keine Deko: dieselbe Farbe steht in
 * jeder Ansicht für dasselbe Projekt, damit man in der Personenansicht auf
 * einen Blick sieht, aus welchen Projekten die Stunden kommen.
 *
 * Feste Reihenfolge, nicht durchrotiert. Ab dem siebten Projekt bleibt es
 * neutral — der Name steht ohnehin in jeder Zeile, die Farbe ist immer nur
 * der zweite Kanal.
 */

export const PROJECT_COLOR_SLOTS = 6;

export function projectColor(index: number): string {
  if (index < 0 || index >= PROJECT_COLOR_SLOTS) return "var(--pc-none)";
  return `var(--pc-${index + 1})`;
}

/** Farbe je Projekt-Id, abgeleitet aus der aktuellen Reihenfolge. */
export function projectColorMap(orderedIds: string[]): Map<string, string> {
  return new Map(orderedIds.map((id, i) => [id, projectColor(i)]));
}
