<div align="center">

# Ariane

### Wer ist wann auf welchem Projekt — und wer hat noch Luft.

Kapazitätsplanung für Entwicklungsteams. Ein Wochenraster über zwölf Monate,
in dem eine Team Lead ihre Leute auf Teilprojekte verteilt und **sofort sieht,
wo jemand über der Kapazität liegt**.

`Next.js 16` · `React 19` · `Postgres` · `Drizzle` · `Tailwind 4`

</div>

---

## Warum

Kapazitätsplanung passiert in den meisten Teams in einer Excel-Tabelle, die
niemand pflegen will. Ariane ist der Versuch, genau diese Tabelle zu bauen —
nur so, dass sie rechnet, statt nur Zahlen zu halten.

Alles hängt an einer Formel:

```
verfügbar(Person, Woche) = Netto-Kapazität × (5 − Urlaubstage − Feiertage) / 5
Auslastung               = verplante Stunden / verfügbar
```

Netto-Kapazität ist das, was nach Meetings und internem Kram für Projekte
übrig bleibt. Rot wird es erst über 100 Prozent.

## Was es kann

| | |
|---|---|
| **Wochenraster** | Gut ein Jahr, umschaltbar zwischen Wochen und Monaten, Stunden und Prozent |
| **Zwei Ansichten** | Nach Personen und nach Projekten — dieselben Daten, andere Gruppierung |
| **Excel-artige Eingabe** | Zelle anklicken und tippen. Umschalt für Mehrfachauswahl, Pfeiltasten zum Bewegen, ⌘Z für rückgängig |
| **⌘C / ⌘V** | Tab-getrennt — Excel ist die Zwischenablage. Alt+Pfeil schiebt eine ganze Zuweisung um eine Woche |
| **Urlaub als Zeitraum** | „5. bis 14. August" — Arbeitstage je Woche rechnet Ariane aus, Wochenenden und Feiertage zählen nicht |
| **Feiertage nach Region** | 16 deutsche Länder und 12 weitere. Maßgeblich ist, wo jemand *arbeitet*, nicht wo er wohnt |
| **Kapazität mit Stichtag** | Ein Wechsel auf Teilzeit verbiegt die Vergangenheit nicht |
| **Budget je Teilprojekt** | Verbraucht / verplant / Budget als ein Balken |
| **Angebote** | Ein- und ausblendbar, zählen standardmäßig nicht zur Auslastung |
| **Auswertungen** | Kennzahlen, Verlauf je Woche, Auslastung je Person, Überlast-Blöcke, Budgets — mit Zeitraum-Wähler |
| **Excel-Export** | Für die Runde, in der niemand das Werkzeug aufmacht |
| **Umsortieren per Ziehen** | Personen, Projekte, Teilprojekte — am Griff in der Namensspalte |
| **Zehn Farbthemen** | Atelier, Nord, Solarized, Dracula, Gruvbox, Tokyo Night, Everforest, Rosé Pine, GitHub, Catppuccin — je mit Hell und Dunkel |

## Farbe ist Information, keine Deko

Die Auslastung bleibt bis 85 Prozent **neutral** — ein Raster, in dem alles bunt
ist, sagt nichts. Erst wenn es eng wird, kommt Farbe: Bernstein ab 85, Akzent bei
genau voll, Apricot darüber.

Projektfarben sind Identität: dieselbe Farbe steht in jeder Ansicht für dasselbe
Projekt. Sechs feste Töne, mit einem Paletten-Validator auf Helligkeitsband,
Chroma, Farbsehschwächen und Kontrast geprüft — in beiden Modi. Ab dem siebten
Projekt bleibt es neutral; der Name steht ohnehin in jeder Zeile.

## Loslegen

```bash
docker compose up -d      # Postgres auf Port 5444
pnpm install
pnpm db:migrate
pnpm db:seed              # erfundene, aber plausible Startdaten
pnpm dev
```

Umgebungsvariablen in `.env.local`, Vorlage in `.env.example`.

Mehr zu Aufbau, Deployment und den Entwurfsentscheidungen:
**[DEVELOPMENT.md](DEVELOPMENT.md)**

## Lizenz

MIT
