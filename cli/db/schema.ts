import { pgTable, pgEnum, uuid, text, boolean, integer, real, timestamp, unique } from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────────────────────────────────────

export const activityTypeEnum = pgEnum('activity_type', ['count', 'boolean']);
export const periodEnum        = pgEnum('period',        ['day', 'week', 'month']);
export const fineTypeEnum      = pgEnum('fine_type',     ['flat', 'per_unit']);
export const limitTypeEnum     = pgEnum('limit_type',    ['min', 'max']);

// ── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  timezone:     text('timezone').notNull(),
  weekStartDay: integer('week_start_day').notNull().default(1),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

export const activities = pgTable('activities', {
  id:          uuid('id').primaryKey().defaultRandom(),
  ownerId:     uuid('owner_id').notNull().references(() => users.id),
  name:        text('name').notNull(),
  type:        activityTypeEnum('type').notNull(),
  description: text('description'),
  archived:    boolean('archived').notNull().default(false),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

export const userSubscriptions = pgTable('user_subscriptions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  activityId:  uuid('activity_id').notNull().references(() => activities.id),
  userId:      uuid('user_id').notNull().references(() => users.id),
  canLog:      boolean('can_log').notNull().default(false),
  canView:     boolean('can_view').notNull().default(false),
  canCompare:  boolean('can_compare').notNull().default(false),
  mandatory:   boolean('mandatory').notNull().default(false),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_subscription_user_activity').on(t.activityId, t.userId),
]);

export const entries = pgTable('entries', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id),
  activityId:  uuid('activity_id').notNull().references(() => activities.id),
  date:        timestamp('date').notNull(),           // UTC midnight
  valueCount:  integer('value_count'),               // for count activities
  valueBool:   boolean('value_bool'),                // for boolean activities
  notes:       text('notes'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

export const summaries = pgTable('summaries', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id),
  activityId:   uuid('activity_id').notNull().references(() => activities.id),
  period:       periodEnum('period').notNull(),
  startDate:    timestamp('start_date').notNull(),
  endDate:      timestamp('end_date').notNull(),
  totalEntries: integer('total_entries').notNull().default(0),
  totalValue:   real('total_value').notNull().default(0),
  isComplete:   boolean('is_complete').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_summary_user_activity_period_start').on(t.userId, t.activityId, t.period, t.startDate),
]);

export const fineRules = pgTable('fine_rules', {
  id:          uuid('id').primaryKey().defaultRandom(),
  activityId:  uuid('activity_id').notNull().references(() => activities.id),
  userId:      uuid('user_id').notNull().references(() => users.id),
  period:      periodEnum('period').notNull(),
  limitType:   limitTypeEnum('limit_type').notNull().default('max'),
  limit:       real('limit').notNull(),
  fineType:    fineTypeEnum('fine_type').notNull(),
  fineAmount:  integer('fine_amount').notNull(),   // in cents
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

export const fines = pgTable('fines', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull().references(() => users.id),
  activityId:      uuid('activity_id').notNull().references(() => activities.id),
  fineRuleId:      uuid('fine_rule_id').notNull().references(() => fineRules.id),
  period:          periodEnum('period').notNull(),
  periodStartDate: timestamp('period_start_date').notNull(),
  periodEndDate:   timestamp('period_end_date').notNull(),
  limitType:       limitTypeEnum('limit_type').notNull().default('max'),
  limit:           real('limit').notNull(),
  actual:          real('actual').notNull(),
  overage:         real('overage').notNull(),
  fineType:        fineTypeEnum('fine_type').notNull(),
  fineAmount:      integer('fine_amount').notNull(),
  totalFine:       integer('total_fine').notNull(),
  isPaid:          boolean('is_paid').notNull().default(false),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_fine_user_activity_period_start').on(t.userId, t.activityId, t.period, t.periodStartDate),
]);

// ── Inferred Types ────────────────────────────────────────────────────────────

export type User             = typeof users.$inferSelect;
export type NewUser          = typeof users.$inferInsert;
export type Activity         = typeof activities.$inferSelect;
export type NewActivity      = typeof activities.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewSubscription  = typeof userSubscriptions.$inferInsert;
export type Entry            = typeof entries.$inferSelect;
export type NewEntry         = typeof entries.$inferInsert;
export type Summary          = typeof summaries.$inferSelect;
export type NewSummary       = typeof summaries.$inferInsert;
export type FineRule         = typeof fineRules.$inferSelect;
export type NewFineRule      = typeof fineRules.$inferInsert;
export type Fine             = typeof fines.$inferSelect;
export type NewFine          = typeof fines.$inferInsert;
