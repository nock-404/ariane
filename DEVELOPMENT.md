# Entwicklung

## Einrichten

```bash
docker compose up -d      # Postgres auf Port 5444
pnpm install
pnpm db:migrate
pnpm db:seed              # optional: erfundene Startdaten
pnpm dev
```

### Umgebungsvariablen

`.env.local`, Vorlage in `.env.example`:

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | Postgres-Verbindung |
| `ARIANE_PASSWORD` | Planen, ändern, Stammdaten pflegen |
| `ARIANE_PASSWORD_LESEN` | Nur schauen und exportieren. Leer lassen = kein Lesezugang |

### Befehle

| | |
|---|---|
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` | Migration + Production-Build |
| `pnpm db:generate` | Migration aus dem Schema erzeugen |
| `pnpm db:migrate` | Migrationen anwenden |
| `pnpm db:seed` | Beispieldaten (leert vorher alle Tabellen) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

Das Seed-Skript beginnt mit einem `truncate`. Zeigt `DATABASE_URL` nicht auf
localhost, bricht es ab — es sei denn, `ARIANE_SEED_FORCE=ja` ist gesetzt.

## Aufbau

```
src/lib/weeks.ts       Wochenrechnung, alles in UTC, eine Woche ist ihr Montag
src/lib/holidays.ts    Feiertage je Region, ohne externe Abhängigkeit
src/lib/capacity.ts    die Kapazitätsformel und die Typen des Datensatzes
src/lib/rows.ts        Zeilenmodell und Zellwerte für beide Ansichten
src/lib/plan.ts        ein Ladevorgang, ein Datensatz
src/lib/store.ts       Client-Zustand mit Historie und gesammeltem Speichern
src/lib/reports.ts     Auswertungen, gerechnet auf demselben Datensatz
src/lib/session.ts     Rollenprüfung für jede Server Action
src/lib/themes.ts      die zehn Farbthemen, eine Quelle für das Stylesheet
src/app/actions.ts     Server Actions
src/components/plan    Raster, Teamliste, Werkzeugleiste
src/components/stamm   Personen und Projekte pflegen
src/components/reports Kennzahlen, Kurve, Balken, Budgets
```

### Warum der Datensatz komplett geladen wird

Ein Team mal gut hundert Wochen ist klein genug, um alles auf einmal zu laden.
Jede Nachladerei würde das Bedienen nur zäh machen. Während des Tippens ist der
Client die Quelle der Wahrheit; geschrieben wird gesammelt und mit Verzögerung,
damit jede Zahl sofort steht.

### Feiertage

Ohne externe Abhängigkeit. Die beweglichen Tage hängen alle am Ostersonntag, der
Rest steht fest. Eine Person hat eine **Feiertagsregion**, keinen Wohnort:
maßgeblich ist, wo sie ihre Arbeitsleistung erbringt.

Der Maßstab ist nicht „steht im Gesetzblatt", sondern „an diesem Tag wird dort
tatsächlich nicht gearbeitet" — nur so stimmt die Kapazität. Die Abweichungen
sind in `src/lib/holidays.ts` im Kopfkommentar begründet.

## Zugang

Statt Benutzerkonten gibt es zwei Passwörter. Die Rolle steckt im Cookie und
wird in **jeder** Server Action geprüft (`requireWriter` in
`src/lib/session.ts`) — der Schutz im Layout allein reicht nicht, Server Actions
sind offene Endpunkte.

Der Cookie enthält keine Sitzungsdaten, sondern einen aus dem Passwort
abgeleiteten HMAC-Beweis; ein geändertes Passwort entwertet damit sofort alle
Cookies. Sobald das Werkzeug wirklich benutzt wird, kommt `better-auth` darüber,
ohne dass sich am Rest etwas ändert.

## Gestaltung

Entwurf „Atelier": kühles Papier, Moos als Akzent, Apricot ausschließlich für
Überlast, Mulish als Schrift. Farben stehen als CSS-Variablen in
`src/app/globals.css` und werden auf die shadcn-Token abgebildet — im Code steht
keine einzige Farbe fest.

Die zehn Themen liegen in `src/lib/themes.ts` und setzen dieselben Variablen;
das Stylesheet wird daraus erzeugt, es gibt also keine zweite Quelle. Die Wahl
steckt im Browser des Nutzers, nicht in der Datenbank.

Native Scrollbalken kommen nirgends vor — alles Scrollbare läuft über
OverlayScrollbars. `window.confirm` ebenso wenig: Rückfragen laufen über
`src/components/ui/confirm.tsx`.

## Deployment

Läuft als gewöhnliche Next.js-App gegen eine Postgres-Datenbank. Der Build führt
die Migrationen selbst aus — `pnpm build` ruft `src/lib/db/migrate.ts` vor
`next build`.

Wird die App mit echten Personendaten betrieben, gehört sie hinter einen
Zugangsschutz: In der Planung stehen Namen und Leistungsdaten von Menschen. Vor
einem produktiven Einsatz sind die betrieblichen und datenschutzrechtlichen
Voraussetzungen zu klären.
