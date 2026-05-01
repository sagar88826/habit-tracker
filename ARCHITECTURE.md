# Habit Tracker Architecture

## Design Pattern: Option A + C
Activity subscription model (Option A) with precomputed summaries for KPI and fines (Option C).

---

## Core Design Decisions

### 1. Timezone & Time Boundaries
- **Storage**: All timestamps stored as UTC in MongoDB
- **Display**: User timezone applied only at display/reporting time
- **Week boundaries**: Monday–Sunday by default; configurable per user
- **Month boundaries**: Calendar month (1st–last day)
- **Entry timing**: Entry logged at 11:50 PM Mon counts toward Monday, regardless of user timezone UTC offset

### 2. Multiple Entries Per Day
- **Count-based activities**: Multiple entries per day allowed and accumulated (e.g., "2 burgers" + "1 burger" = 3 total)
- **Boolean activities**: Only one entry per day allowed (subsequent entries overwrite)
- **Validation**: Enforced at API level during entry creation

### 3. Editing & Deleting Past Entries
- **Allowed**: Users can edit or delete any past entry
- **Recalculation**: Summaries (daily/weekly/monthly) and fines recalculated automatically for affected periods
- **Audit trail**: Optional logging of edit history (consider for future)

### 4. Activity Applicability
- **Mandatory activities**: Must appear on dashboard as "expected". Missing entries flagged in weekly summaries.
- **Not applicable activities**: Hidden from tracking and reporting for that user
- **Enforcement**: Enforced in UI and API queries (never show non-applicable to that user)

### 5. Shared Activity Permissions
Three permission levels per user per activity:
- **canLog**: Can this user add/edit entries for this activity?
- **canView**: Can this user see summaries for this activity?
- **canCompare**: Can this user see head-to-head comparison for this activity?

Example: "Burger" is shared between Sarah and Abhinav.
- Sarah: canLog=true, canView=true, canCompare=true
- Abhinav: canLog=true, canView=true, canCompare=true

vs. "Sarah's Journal" shared read-only:
- Sarah: canLog=true, canView=true, canCompare=false
- Abhinav: canLog=false, canView=true, canCompare=false

### 6. Activity Naming
- **Unique per user**: Each user can have an activity named "yoga"; they are separate activities
- **Benefit**: No naming conflicts; simpler to reason about "my activities"

### 7. Type Validation
- **Type fixed at creation**: Cannot change type after creation
- **Count-based**: Accept integers ≥ 0 only. Reject strings, decimals, negative numbers.
- **Boolean-based**: Accept true/false or yes/no equivalents. Reject numbers.
- **UI enforcement**: Different input fields per type (number spinner vs. toggle)

### 8. Fine Limits
- **Exact limit = no fine**: If limit is 3/week and user has 3 entries, no fine applied
- **Overage = fine**: Fine triggered only when actual > limit
- **Zero entries = no fine**: Failing to log does not trigger a fine (unless it's a mandatory minimum, future extension)

### 9. Fine Rules
- **One per activity**: Each activity has at most one fine rule
- **Rule structure**: 
  - `period` (week or month)
  - `limit` (max allowed)
  - `fineType` (flat or per-unit)
  - `fineAmount` (dollar amount or per-unit cost)
- **Multiple limits**: Use separate activities or future tiered rule support (not MVP)

### 10. Comparison KPI
- **Private activities excluded**: Only shared activities with canCompare=true appear in head-to-head comparisons
- **Non-shared activities**: Hidden from all comparisons

### 11. Activity Lifecycle
- **Soft delete**: Activities marked as archived. Historical entries remain visible in past summaries.
- **Current tracking**: Archived activities don't appear in current tracking or KPI dashboards.

### 12. No-Data State
- **Empty weeks/months**: Show "No entries yet" or "0 entries, no streaks, no fines"
- **Comparisons**: Private activities show as "N/A"; no entries show as "0"

---

## Data Model Overview

> **Implementation note**: The original design targeted MongoDB (see `SCHEMA.md`). The actual implementation uses **PostgreSQL + Drizzle ORM** (`cli/db/schema.ts`). All table/field names are the same; the collection → table mapping is 1:1.

### Tables

1. **users**: User profiles and settings
2. **activities**: Activity templates (yoga, burger, journaling, etc.)
3. **user_subscriptions**: Defines which users participate in which activities (with permissions)
4. **entries**: Raw activity logs (one entry = one user logging one activity)
5. **summaries**: Precomputed daily/weekly/monthly aggregations
6. **fine_rules**: Penalty configurations per activity
7. **fines**: Calculated fines (upserted per period when entries change)

---

## Design Rationale

- **Activity + Subscription model** (A) allows user-specific customization without duplicating activity definitions
- **Precomputed summaries** (C) enable fast KPI and dashboard queries for frequent reads
- **Soft delete** preserves historical data while keeping current UI clean
- **Permission matrix** (canLog, canView, canCompare) offers flexibility for shared vs. private activities
- **One fine rule per activity** keeps logic simple; future tiers can be added without redesign

---

## Implementation Status

| Item | Status |
|---|---|
| PostgreSQL schema (Drizzle) | ✅ Done — `cli/db/schema.ts` |
| TypeScript types (inferred) | ✅ Done — `$inferSelect` / `$inferInsert` |
| CLI layer (Commander.js) | ✅ Done — `cli/commands/` |
| Service layer (shared) | ✅ Done — `cli/services/` |
| Precomputed summaries + fines | ✅ Done — triggered on every entry write |
| Web UI — all pages | ✅ Done — `app/` (Next.js 16 App Router) |
| Mobile-responsive layout | ✅ Done — bottom tab bar + overflow tables |
| Smoke test | ✅ Done — `scripts/smoketest.go` |
| Authentication | ❌ Not implemented — cookie-based user switch only |
| Fine rule deactivation UI | ❌ Not implemented |
| Payment tracking (`isPaid`) | ❌ Not implemented |

See `docs/WEB_UI.md` for full implementation detail.
