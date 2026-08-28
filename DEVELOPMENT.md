# Development

## Setup

```bash
docker compose up -d      # Postgres on port 5444
pnpm install
pnpm db:migrate
pnpm db:seed              # optional: invented starter data
pnpm dev
```

### Environment variables

`.env.local`, template in `.env.example`:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `ARIANE_PASSWORD` | Plan, edit, maintain master data |
| `ARIANE_PASSWORD_LESEN` | View and export only. Leave empty to disable read access |

### Commands

| | |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Migration + production build |
| `pnpm db:generate` | Generate a migration from the schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Sample data (truncates every table first) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

The seed script starts with a `truncate`. If `DATABASE_URL` doesn't point at
localhost it aborts — unless `ARIANE_SEED_FORCE=ja` is set.

## Structure

```
src/lib/weeks.ts       week arithmetic, all UTC; a week is its Monday
src/lib/holidays.ts    holidays per region, no external dependency
src/lib/capacity.ts    the capacity formula and the dataset types
src/lib/rows.ts        row model and cell values for both views
src/lib/plan.ts        one load, one dataset
src/lib/store.ts       client state with history and batched saving
src/lib/reports.ts     reports, computed on the same dataset
src/lib/session.ts     role check for every server action
src/lib/themes.ts      the ten themes, one source for the stylesheet
src/app/actions.ts     server actions
src/components/plan    grid, roster, toolbar
src/components/stamm   maintain people and projects
src/components/reports key figures, curve, bars, budgets
```

### Why the whole dataset is loaded at once

A team times a hundred-odd weeks is small enough to load in one go. Any
lazy-loading would only make editing sluggish. While you type, the client is the
source of truth; writes are batched and delayed so every number appears
instantly.

### Holidays

No external dependency. The movable feasts all hang off Easter Sunday; the rest
are fixed. A person has a **holiday region**, not a home address: what matters is
where they perform their work.

The yardstick is not "it's in the statute book" but "on this day people there
genuinely don't work" — that's the only way the capacity number is right. The
deviations are justified in the header comment of `src/lib/holidays.ts`.

## Access

Instead of user accounts there are two passwords. The role lives in the cookie
and is checked in **every** server action (`requireWriter` in
`src/lib/session.ts`) — guarding the layout alone is not enough, server actions
are open endpoints.

The cookie holds no session data, only an HMAC proof derived from the password;
changing the password therefore invalidates every cookie at once. Once the tool
is genuinely in use, `better-auth` goes on top without anything else changing.

## Design

Draft "Atelier": cool paper, moss as the accent, apricot exclusively for
overload, Mulish as the typeface. Colours live as CSS variables in
`src/app/globals.css` and are mapped onto the shadcn tokens — not a single
colour is hardcoded in a component.

The ten themes live in `src/lib/themes.ts` and set the same variables; the
stylesheet is generated from them, so there is no second source. The choice is
stored in the user's browser, not in the database.

Native scrollbars appear nowhere — everything scrollable runs through
OverlayScrollbars. Same for `window.confirm`: prompts go through
`src/components/ui/confirm.tsx`.

## Deployment

Runs as an ordinary Next.js app against a Postgres database. The build applies
the migrations itself — `pnpm build` calls `src/lib/db/migrate.ts` before
`next build`.

If you run this with real personnel data, put it behind access control: the plan
contains people's names and performance data. Clear the relevant employment-law
and data-protection requirements before putting it into production.
