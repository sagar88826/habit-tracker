import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { entries, summaries, userSubscriptions, type Summary } from '../db/schema';
import { toDateStr, getDayBounds, getWeekBounds, getMonthBounds } from '../utils/dateUtils';
import { recalculateFines } from './fineService';

async function computeAndUpsert(
  userId: string,
  activityId: string,
  start: Date,
  end: Date,
  period: 'day' | 'week' | 'month'
): Promise<Summary> {
  // Single SQL aggregation — no full-table JS scan
  const [agg] = await db.select({
    totalEntries: sql<number>`COUNT(*)::int`,
    totalValue:   sql<number>`COALESCE(SUM(COALESCE(${entries.valueCount}, CASE WHEN ${entries.valueBool} THEN 1 ELSE 0 END)), 0)`,
  }).from(entries).where(and(
    eq(entries.userId, userId),
    eq(entries.activityId, activityId),
    gte(entries.date, start),
    lt(entries.date, end),
  ));

  const [sub] = await db.select().from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.activityId, activityId)))
    .limit(1);
  const isComplete = sub?.mandatory ? (agg.totalEntries > 0) : true;

  const [row] = await db.insert(summaries).values({
    userId, activityId, period, startDate: start, endDate: end,
    totalEntries: agg.totalEntries, totalValue: agg.totalValue, isComplete,
  }).onConflictDoUpdate({
    target: [summaries.userId, summaries.activityId, summaries.period, summaries.startDate],
    set: { totalEntries: agg.totalEntries, totalValue: agg.totalValue, isComplete, updatedAt: new Date() },
  }).returning();

  return row;
}

/**
 * Recompute day + week + month summaries for the affected date and trigger fine recalculation.
 * Called automatically after every add/edit/delete entry.
 */
export async function recalculate(userId: string, activityId: string, date: Date, weekStartDay = 1): Promise<void> {
  const dateStr = toDateStr(date);
  const { start: dayStart, end: dayEnd }     = getDayBounds(dateStr);
  const { start: weekStart, end: weekEnd }   = getWeekBounds(date, weekStartDay);
  const { start: monthStart, end: monthEnd } = getMonthBounds(date.getUTCFullYear(), date.getUTCMonth() + 1);

  await computeAndUpsert(userId, activityId, dayStart, dayEnd, 'day');

  const week = await computeAndUpsert(userId, activityId, weekStart, weekEnd, 'week');
  await recalculateFines(userId, activityId, weekStart, 'week', week.totalValue);

  const month = await computeAndUpsert(userId, activityId, monthStart, monthEnd, 'month');
  await recalculateFines(userId, activityId, monthStart, 'month', month.totalValue);
}

export async function getDailySummary(userId: string, dateStr: string): Promise<Summary[]> {
  const { start } = getDayBounds(dateStr);
  return db.select().from(summaries).where(and(eq(summaries.userId, userId), eq(summaries.period, 'day'), eq(summaries.startDate, start)));
}

export async function getWeeklySummary(userId: string, dateStr: string, weekStartDay = 1): Promise<Summary[]> {
  const { start } = getWeekBounds(new Date(dateStr + 'T00:00:00Z'), weekStartDay);
  return db.select().from(summaries).where(and(eq(summaries.userId, userId), eq(summaries.period, 'week'), eq(summaries.startDate, start)));
}

export async function getMonthlySummary(userId: string, year: number, month: number): Promise<Summary[]> {
  const { start } = getMonthBounds(year, month);
  return db.select().from(summaries).where(and(eq(summaries.userId, userId), eq(summaries.period, 'month'), eq(summaries.startDate, start)));
}
