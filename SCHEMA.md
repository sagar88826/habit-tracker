# MongoDB Schema Design

## Collections & Indexes

### 1. `users`
Stores user profiles and timezone settings.

```javascript
{
  _id: ObjectId,
  email: string,                  // unique, lowercase
  name: string,
  timezone: string,               // e.g., "America/New_York" (IANA)
  weekStartDay: number,           // 1 = Monday, 0 = Sunday (default: 1)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ email: 1 }` (unique)

---

### 2. `activities`
Activity templates. Each activity belongs to one owner (creator).

```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,              // user who created/owns this activity
  name: string,                   // e.g., "Burger", "Yoga", "LNB Journaling"
  type: "count" | "boolean",      // fixed at creation
  description: string,            // optional
  archived: boolean,              // default: false
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ ownerId: 1, name: 1 }` (ensure name unique per owner)
- `{ archived: 1 }` (for filtering active activities)

---

### 3. `user_subscriptions`
Defines which users can participate in which activities, with permissions.

```javascript
{
  _id: ObjectId,
  activityId: ObjectId,
  userId: ObjectId,
  canLog: boolean,                // can this user add entries?
  canView: boolean,               // can this user see summaries?
  canCompare: boolean,            // can this user compare in KPI?
  mandatory: boolean,             // default: false. If true, missing entries flagged.
  applicableFromDate: Date,       // optional: activity only applicable from this date
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ userId: 1, activityId: 1 }` (unique: one subscription per user-activity pair)
- `{ activityId: 1 }` (find all subscribers for an activity)
- `{ userId: 1 }` (find all activities for a user)

---

### 4. `entries`
Raw activity logs. One entry = one user logging one activity on one day.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  activityId: ObjectId,
  date: Date,                     // stored as UTC midnight (00:00:00 UTC)
  value: number | boolean,        // count for count-based, true/false for boolean
  notes: string,                  // optional user notes
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ userId: 1, activityId: 1, date: 1 }` (find entries for user+activity in date range)
- `{ userId: 1, date: 1 }` (find all entries for user on date)
- `{ date: 1 }` (for bulk recalculation by date)

**Rules**:
- For boolean activities: Only one entry per user per activity per day (upsert on update).
- For count activities: Multiple entries allowed; they accumulate.

---

### 5. `summaries`
Precomputed daily/weekly/monthly aggregations. Recalculated nightly or on-demand.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  activityId: ObjectId,
  period: "day" | "week" | "month",
  startDate: Date,                // UTC midnight start of period
  endDate: Date,                  // UTC midnight end of period (exclusive)
  totalEntries: number,           // count of entries in period
  totalValue: number,             // sum of values (for count-based) or count of true (for boolean)
  isComplete: boolean,            // if mandatory and has entry, true
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ userId: 1, activityId: 1, period: 1, startDate: 1 }` (fetch summary for period)
- `{ userId: 1, period: 1, startDate: 1 }` (find all activity summaries for user in period)

---

### 6. `fine_rules`
Penalty configurations per activity.

```javascript
{
  _id: ObjectId,
  activityId: ObjectId,
  userId: ObjectId,               // user for whom this rule applies (activity owner defines per user)
  period: "week" | "month",       // enforcement period
  limit: number,                  // max allowed value in period
  fineType: "flat" | "per_unit",  // "flat" = one fine if exceeded; "per_unit" = cost per unit over
  fineAmount: number,             // amount (in paise to avoid floats, e.g., 500 = ₹5.00)
  active: boolean,                // default: true
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ activityId: 1, userId: 1 }` (find rules for activity+user)
- `{ userId: 1, period: 1 }` (find all rules for user in period)

---

### 7. `fines`
Calculated fines. Linked to summary periods.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  activityId: ObjectId,
  fineRuleId: ObjectId,
  period: "week" | "month",
  periodStartDate: Date,          // UTC midnight start of period
  periodEndDate: Date,            // UTC midnight end of period (exclusive)
  limit: number,                  // limit from rule (denormalized for history)
  actual: number,                 // actual value logged
  overage: number,                // actual - limit (0 if not exceeded)
  fineType: "flat" | "per_unit",  // from rule (denormalized)
  fineAmount: number,             // amount (in paise)
  totalFine: number,              // calculated fine (in paise)
  isPaid: boolean,                // default: false (future: payment tracking)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ userId: 1, period: 1, periodStartDate: 1 }` (find fines for user in period)
- `{ activityId: 1, period: 1, periodStartDate: 1 }` (find fines for activity in period)

---

## Key Relationships

```
users
  ↓
activities (ownerId → users._id)
  ↓
user_subscriptions (userId → users._id, activityId → activities._id)
  ↓
entries (userId → users._id, activityId → activities._id)
  ↓
summaries (userId → users._id, activityId → activities._id)
  ↓
fine_rules (activityId → activities._id, userId → users._id)
  ↓
fines (userId → users._id, activityId → activities._id, fineRuleId → fine_rules._id)
```

---

## Data Integrity Rules

1. **Entry creation**: 
   - Verify user has `canLog=true` for activityId in user_subscriptions
   - For boolean activities: upsert (replace if exists for that day)
   - For count activities: insert (allow multiple per day)

2. **Entry editing/deletion**:
   - Trigger summary and fine recalculation for affected week/month

3. **Summary recalculation**:
   - Run nightly (configurable) or on-demand after entry changes
   - Aggregate entries for the period
   - Check `mandatory` flag; if true and no entries, mark isComplete=false

4. **Fine calculation**:
   - After summaries are updated, recalculate fines for that period
   - Apply fine_rules for that activity+user
   - Compare actual vs. limit; calculate fine if overage > 0

5. **Activity archival**:
   - Set `archived=true` on activity
   - Do NOT delete entries or summaries
   - Queries filter `archived=false` by default

---

## Query Patterns (High-Level)

### Fetch user's active activities
```
user_subscriptions.find({ userId })
  .populate(activityId)
  .filter(activity.archived = false)
```

### Fetch weekly summary for user
```
summaries.find({
  userId,
  period: "week",
  startDate: { $gte: weekStart, $lt: weekEnd }
})
```

### Fetch fines for user in month
```
fines.find({
  userId,
  period: "month",
  periodStartDate: { $gte: monthStart, $lt: monthEnd }
})
```

### Comparison KPI (user1 vs user2, shared activities only)
```
user_subscriptions.find({
  activityId: { $in: [shared activity IDs] },
  canCompare: true,
  userId: { $in: [user1, user2] }
})
  .join(summaries)
  .compare(user1 totals vs user2 totals)
```

---

## Performance Considerations

- **Summaries precomputed nightly** → Fast dashboard queries (no aggregation pipeline at read time)
- **Indexes on common queries** → (userId, period, startDate) for fast filtering
- **Denormalized fine fields** → Historical accuracy (limit/amount don't change if rule is edited)
- **Soft delete** → No cascading deletes; simpler data recovery if needed
