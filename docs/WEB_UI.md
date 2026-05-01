# Habit Tracker — Web UI Documentation

> **Filename**: `docs/WEB_UI.md`
> **Companion docs**: `ARCHITECTURE.md` (design decisions), `SCHEMA.md` (original MongoDB schema — superseded by Drizzle/PostgreSQL, kept for design rationale)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [Database Layer](#4-database-layer)
5. [Service Layer (shared by CLI and Web)](#5-service-layer-shared-by-cli-and-web)
6. [Web UI — Next.js App Router](#6-web-ui--nextjs-app-router)
7. [Page Reference](#7-page-reference)
8. [Active-User State (Cookie)](#8-active-user-state-cookie)
9. [Mobile Layout](#9-mobile-layout)
10. [Smoke-Test Script (Go)](#10-smoke-test-script-go)
11. [Running Locally](#11-running-locally)
12. [Environment Variables](#12-environment-variables)
13. [Known Limitations & Future Work](#13-known-limitations--future-work)

---

## 1. Project Overview

A multi-user habit/activity tracker with:

- **CLI interface** — `bun run cli` (Commander.js, `cli/index.ts`)
- **Web UI** — Next.js 16 App Router (`app/`)
- **Shared service layer** — both CLI and Web import the same service functions from `cli/services/`
- **PostgreSQL** — Drizzle ORM for type-safe schema and queries
- **Precomputed summaries** — every entry write triggers recalculation of day/week/month summaries and fines

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Bun 1.x |
| Web Framework | Next.js 16.2.4 (App Router, React 19) |
| Database | PostgreSQL via Drizzle ORM (`drizzle-orm/postgres-js`) |
| Styling | Tailwind CSS v4 |
| Font | Geist (`next/font/google`) |
| CLI | Commander.js |
| Migrations | `bunx drizzle-kit push` (schema-push, no migration files) |
| Smoke Test | Go (`scripts/smoketest.go`) |

> **Note**: `SCHEMA.md` describes the original MongoDB design. The implementation uses **PostgreSQL + Drizzle** (`cli/db/schema.ts`). `SCHEMA.md` is retained for design-rationale reference only.

---

## 3. Repository Structure

```
habit-tracker/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout: header, nav, user switcher
│   ├── page.tsx                # Root → redirect /dashboard
│   ├── globals.css             # Tailwind v4 import + CSS custom properties
│   ├── actions.ts              # Global server action: setActiveUser (cookie)
│   ├── ui/
│   │   └── nav.tsx             # DesktopNav + MobileNav (bottom tab bar)
│   ├── dashboard/page.tsx      # Weekly summary + fines banner
│   ├── entries/
│   │   ├── page.tsx            # Log entries + recent entries table
│   │   └── actions.ts          # addEntryAction, deleteEntryAction
│   ├── activities/
│   │   ├── page.tsx            # Activity list + create + assign forms
│   │   └── actions.ts          # createActivityAction, archiveActivityAction, assignActivityAction
│   ├── kpi/page.tsx            # Personal KPI + user comparison
│   ├── fines/
│   │   ├── page.tsx            # Fines table + create fine rule form
│   │   └── actions.ts          # createFineRuleAction
│   └── users/
│       ├── page.tsx            # User list + create user form
│       └── actions.ts          # createUserAction
│
├── cli/                        # CLI + shared service layer
│   ├── index.ts                # CLI entry point (Commander.js)
│   ├── commands/               # CLI command registrations (6 files)
│   ├── db/
│   │   ├── client.ts           # Drizzle client (postgres-js, pool max=20)
│   │   └── schema.ts           # Drizzle table definitions + inferred types
│   ├── services/               # Business logic (used by both CLI and Web)
│   │   ├── userService.ts
│   │   ├── activityService.ts
│   │   ├── subscriptionService.ts
│   │   ├── entryService.ts
│   │   ├── summaryService.ts
│   │   ├── fineService.ts
│   │   └── kpiService.ts
│   └── utils/
│       └── dateUtils.ts        # UTC date helpers + formatMoney
│
├── scripts/
│   └── smoketest.go            # HTTP smoke test for all web routes
│
├── drizzle.config.ts           # Drizzle Kit config (reads .env.local)
├── next.config.ts              # Next.js config (currently empty)
├── tsconfig.json               # paths: @/* → ./*
├── package.json
├── ARCHITECTURE.md             # Design decisions (authoritative)
├── SCHEMA.md                   # Original MongoDB schema (reference only)
└── docs/
    └── WEB_UI.md               # ← this file
```

---

## 4. Database Layer

### Schema (`cli/db/schema.ts`)

Seven PostgreSQL tables, all using UUID primary keys:

| Table | Purpose |
|---|---|
| `users` | User profiles — `email` (unique), `name`, `timezone`, `weekStartDay` |
| `activities` | Activity templates — `ownerId`, `name`, `type` (count\|boolean), `archived` |
| `user_subscriptions` | Per-user-per-activity permissions — `canLog`, `canView`, `canCompare`, `mandatory` |
| `entries` | Raw logs — `userId`, `activityId`, `date` (UTC midnight), `valueCount`, `valueBool` |
| `summaries` | Precomputed aggregations — `period` (day\|week\|month), `totalEntries`, `totalValue`, `isComplete` |
| `fine_rules` | Penalty config — `period`, `limit`, `fineType` (flat\|per_unit), `fineAmount` (cents) |
| `fines` | Calculated fines — upserted per `(userId, activityId, period, periodStartDate)` |

### Key constraints

- `entries.valueCount` / `entries.valueBool` — mutually exclusive columns; only one set per row based on `activity.type`
- `summaries` — unique on `(userId, activityId, period, startDate)` — upserted on every entry change
- `fines` — unique on `(userId, activityId, period, periodStartDate)` — overwritten when entries change
- `user_subscriptions` — unique on `(activityId, userId)` — one subscription per pair

### Client (`cli/db/client.ts`)

```ts
const client = postgres(process.env.DATABASE_URL!, { max: 20, idle_timeout: 20 });
export const db = drizzle(client, { schema });
```

Shared singleton — both CLI and Next.js Server Components import `db` directly. No ORM abstraction layer.

### Migrations

```bash
bun run db:push      # bunx drizzle-kit push — applies schema to DB (no migration files)
bun run db:studio    # bunx drizzle-kit studio — GUI browser for the DB
```

Drizzle Kit reads `DATABASE_URL` from `.env.local` via `drizzle.config.ts` (has its own dotenv parser since `drizzle-kit` doesn't load `.env.local` automatically).

---

## 5. Service Layer (shared by CLI and Web)

All business logic lives in `cli/services/`. Every service is a set of plain async functions — no classes, no dependency injection.

### `userService.ts`
- `createUser(name, email, timezone, weekStartDay?)` — deduplicates by email
- `listUsers()` — returns all users
- `getUser(userId)` — throws if not found

### `activityService.ts`
- `createActivity(ownerId, name, type, description?)` — case-insensitive name uniqueness per owner
- `archiveActivity(activityId)` — soft delete (`archived=true`)
- `getActivity(activityId)` — throws if not found
- `listActivities(ownerId?)` — filters `archived=false`

### `subscriptionService.ts`
- `assignActivity(activityId, userId, config)` — throws if already subscribed
- `getSubscription(userId, activityId)` — returns `null` if not found
- `getUserSubscriptions(userId)` — all subs for a user
- `getActivitySubscriptions(activityId)` — all users for an activity

### `entryService.ts`
- `addEntry(userId, activityId, dateStr, value, notes?)` — validates `canLog`, validates value type. Boolean activities: upserts. Count activities: inserts.
- `editEntry(entryId, value?, notes?)` — partial update
- `deleteEntry(entryId)` — hard delete, returns `{userId, activityId, affectedDate}` for recalculation
- `parseEntryValue(activityType, row)` — converts DB columns back to domain value

> **Note**: There is **no** `getEntries()` function in `entryService.ts`. Web pages that need to query entries must use `db.select().from(entries).where(...)` directly (as `entries/page.tsx` does).

### `summaryService.ts`
- `recalculate(userId, activityId, date, weekStartDay?)` — called automatically after every entry write. Computes day + week + month summaries, then triggers `recalculateFines`.
- `getWeeklySummary(userId, dateStr, weekStartDay?)` → `Summary[]`
- `getDailySummary(userId, dateStr)` → `Summary[]`
- `getMonthlySummary(userId, year, month)` → `Summary[]`

### `fineService.ts`
- `createFineRule(activityId, userId, period, limit, fineType, fineAmount)` — `fineAmount` in **cents**. Throws if active rule already exists for this user+activity.
- `recalculateFines(userId, activityId, periodStart, period, actualValue)` — upserts fine record
- `getWeeklyFines(userId, dateStr, weekStartDay?)` → `Fine[]` (only where `totalFine > 0`)
- `getMonthlyFines(userId, year, month)` → `Fine[]`

### `kpiService.ts`
- `getPersonalKPI(userId, dateStr)` → `PersonalKPI` — compares this week vs last week per activity
- `compareUsers(user1Id, user2Id, dateStr)` → `ComparisonKPI` — shared activities with `canCompare=true` only

### `dateUtils.ts`
- `toUtcMidnight(dateStr)` — `"YYYY-MM-DD"` → UTC `Date`
- `toDateStr(date)` — UTC `Date` → `"YYYY-MM-DD"`
- `getDayBounds(dateStr)` → `{start, end}` (exclusive end)
- `getWeekBounds(date, weekStartDay?)` → `{start, end}`
- `getMonthBounds(year, month)` → `{start, end}`
- `formatMoney(cents)` → `"$X.XX"` — fineAmount is always stored in cents

---

## 6. Web UI — Next.js App Router

### Rendering model

- All page components are **async Server Components** — they run on the server, query the database, and render HTML.
- **No React state, no client-side data fetching** for page data.
- **Server Actions** (`'use server'`) handle all form submissions. Forms use native HTML `action=` attribute.
- The only client component is `app/ui/nav.tsx` (`'use client'`) because it reads `usePathname()`.

### Active-user state

The active user is stored in a **cookie** (`active_user_id`), not URL params or session. This avoids auth complexity while supporting multi-user viewing.

```
Cookie: active_user_id=<uuid>   maxAge: 1 year   path: /
```

- **Set by**: `setActiveUser` server action in `app/actions.ts`
- **Read by**: every page's Server Component via `cookies()` from `next/headers`
- **Fallback**: if cookie is absent or the user ID is stale, falls back to `users[0]` from the database

### Path aliases

`tsconfig.json` maps `@/*` to the project root (`./`), so:
- `@/cli/services/userService` → `cli/services/userService.ts`
- `@/cli/db/client` → `cli/db/client.ts`
- `@/app/actions` → `app/actions.ts`

### `searchParams` typing (Next.js 16)

In Next.js 16, `searchParams` is a **Promise** in Server Components:

```ts
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
```

---

## 7. Page Reference

### `/` → redirects to `/dashboard`
`app/page.tsx` — `redirect('/dashboard')`

### `/dashboard`
**File**: `app/dashboard/page.tsx`

Displays the active user's weekly summary table and fines banner. Supports `?date=YYYY-MM-DD` for week navigation (prev/today/next links). Data sources:
- `getWeeklySummary()` — summary rows
- `getWeeklyFines()` — fine totals
- `listActivities()` — to resolve `activityId → name` (summaries only store UUID references)

### `/entries`
**File**: `app/entries/page.tsx`

Two sections:
1. **New entry form** — activity picker, date picker, value input (adapts between `number` and boolean `select` based on first subscribed activity's type), notes
2. **Entries table** — current week's entries, queried directly via `db.select().from(entries).where(...)` — no `getEntries()` helper exists

**Important**: `activityType` is embedded as a hidden form field to inform the server action how to parse the value string (since form data is always strings).

Supports `?date=YYYY-MM-DD` for week navigation.

### `/activities`
**File**: `app/activities/page.tsx`

Three sections:
1. **Activity list** — all non-archived activities with subscription status for active user
2. **Create activity** form — `ownerId` pre-filled from active user cookie
3. **Assign to user** form — assign any activity to any user with permission flags

### `/kpi`
**File**: `app/kpi/page.tsx`

Two sections:
1. **Personal KPI** — `getPersonalKPI(userId, dateStr)` returns `PersonalKPI`:
   - `activities: ActivityKPI[]` — each with `thisWeek`, `prevWeek`, `trend` (`improved|declined|same|no-data`), `isComplete`
   - `overallTrend` — majority trend across all activities
2. **Compare** — `compareUsers(user1Id, user2Id, dateStr)` returns `ComparisonKPI`:
   - `rows: ComparisonRow[]` — each with `values: Record<userId, number>`, `winner` (userId | `"tie"` | `"no-data"`)

**Function signatures** (important for future agents):
```ts
getPersonalKPI(userId: string, dateStr: string): Promise<PersonalKPI>       // 2 args
compareUsers(user1Id: string, user2Id: string, dateStr: string): Promise<ComparisonKPI>  // 3 args
```

### `/fines`
**File**: `app/fines/page.tsx`

Two sections:
1. **Fines table** — weekly or monthly, filtered by `?period=week|month&date=YYYY-MM-DD`
2. **Add fine rule** form — `fineAmount` entered in Rupees (₹), converted to paise (`Math.round(rupees * 100)`) in `createFineRuleAction`

### `/users`
**File**: `app/users/page.tsx`

Two sections:
1. **User list** — with active indicator and switch button (calls `setActiveUser` server action)
2. **Create user** form

---

## 8. Active-User State (Cookie)

```
app/actions.ts → setActiveUser(formData)
```

Sets `active_user_id` cookie and redirects to `/dashboard`. Called from:
- Header user-switcher form (in `layout.tsx`)
- Users page switch button

Every page reads the cookie and falls back to `users[0]` — so the app is usable even without an explicit selection.

---

## 9. Mobile Layout

### Navigation strategy

| Breakpoint | Navigation |
|---|---|
| `< md` (< 768px) | Fixed bottom tab bar with icons + labels (`MobileNav`) |
| `≥ md` (≥ 768px) | Horizontal pill nav in header (`DesktopNav`) |

Both components are exported from `app/ui/nav.tsx` (client component). `Nav` default export renders both; each self-hides via `hidden md:flex` / `md:hidden`.

### Bottom tab bar

Fixed at the bottom (`position: fixed; bottom: 0`), 56px tall. Contains 6 tabs: Dashboard, Log, Activities, KPI, Fines, Users. Each has an inline SVG icon and a 10px label.

`<main>` uses `pb-24 md:pb-8` to prevent content from hiding behind the bottom nav.

### Touch targets

All interactive elements meet the 44px minimum tap target:
- Inputs: `min-h-[40px]`
- Submit buttons: `min-h-[44px]`
- Table action buttons: `min-h-[36px]`

### Responsive tables

All tables use `overflow-x-auto` wrapper + `min-w-[Xpx]` to scroll horizontally on narrow screens rather than breaking layout. Secondary columns are hidden on mobile using `hidden sm:table-cell` / `hidden md:table-cell`.

### Header

`h-12` fixed height. User switcher is compact on mobile (`max-w-[110px]` for the select, "Viewing as" label hidden below `sm`).

---

## 10. Smoke-Test Script (Go)

**File**: `scripts/smoketest.go`

A lightweight HTTP integration test — no browser, no headless Chrome, no JavaScript execution. Tests server-rendered HTML only.

```bash
go run scripts/smoketest.go                     # default: http://localhost:3000
go run scripts/smoketest.go http://staging.host # custom base URL
```

**What it checks per route:**
1. HTTP status code is 200 (redirects followed up to 5 hops)
2. Response body does **not** contain any Next.js/React error markers: `"Application error:"`, `"Internal Server Error"`, `"digest:"`, `"TypeError"`, `"__NEXT_ERROR__"`, etc.
3. Response body **contains** an expected heading string (e.g., `"Weekly Summary"`, `"Log Entry"`)

**Exit codes**: 0 = all pass, 1 = any failure.

**Routes tested**: `/`, `/dashboard`, `/entries`, `/activities`, `/kpi`, `/fines`, `/users`

---

## 11. Running Locally

```bash
# Install dependencies
bun install

# Apply schema to database
bun run db:push

# Start web dev server (Turbopack)
bun run dev

# Run CLI
bun run cli -- --help

# Run smoke test (requires dev server running)
go run scripts/smoketest.go

# Open Drizzle Studio
bun run db:studio
```

---

## 12. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/habitdb` |

Set in `.env.local` (root of repo). This file is `.gitignore`d.

Both Next.js (via automatic `.env.local` loading) and `drizzle-kit` (via manual parser in `drizzle.config.ts`) read this file.

---

## 13. Known Limitations & Future Work

### Current limitations

| Area | Issue |
|---|---|
| `getEntries()` | No helper exists in `entryService.ts`. Pages query `db` directly. If this becomes a pattern, add a `listEntries(userId, start, end)` service function. |
| Entry form — activity type | `activityType` is a hidden field set to the **first** subscribed activity's type. Changing the activity select does not update the value input type (requires JavaScript / client component). |
| `SCHEMA.md` | Still describes MongoDB. Should be updated or annotated to reflect the actual PostgreSQL/Drizzle implementation. |
| `ARCHITECTURE.md` | "Next Steps" section lists MongoDB schema work as pending — outdated, that work is done. |
| Fine rules | One active rule per user+activity enforced. No tiered rules. No deactivation UI (only `active=true` rules surface). |
| `isPaid` | `fines.isPaid` column exists but is never set to `true`. No payment-tracking UI. |
| Pagination | Entry and fine tables have no pagination. Large datasets will render everything. |
| Auth | No authentication. The active user is just a cookie with a UUID — anyone with access to the URL can switch users. |
| Error handling | Server action errors are thrown (not caught and displayed). A future UX improvement is to return error messages to the form. |
| Mobile — entry form | Activity type selector does not dynamically switch between number/boolean input on mobile or desktop without JS. |

### Suggested next steps

1. Add `listEntries(userId, start, end)` to `entryService.ts` for consistency
2. Make the entry form activity picker a client component so the value input adapts dynamically
3. Update `SCHEMA.md` to reflect PostgreSQL reality (or delete it and consolidate into `ARCHITECTURE.md`)
4. Add a "deactivate fine rule" action to `fines/actions.ts`
5. Add pagination to entries and fines tables
6. Extend the smoke test to cover POST form submissions (create user, add entry, etc.)
