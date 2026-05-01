import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { fineRules, fines, type Fine, type FineRule } from '../db/schema';
import { getWeekBounds, getMonthBounds } from '../utils/dateUtils';

export async function createFineRule(
  activityId: string,
  userId: string,
  period: 'week' | 'month',
  limitType: 'min' | 'max',
  limit: number,
  fineType: 'flat' | 'per_unit',
  fineAmount: number  // in cents
): Promise<FineRule> {
  const existing = await db.select().from(fineRules)
    .where(and(eq(fineRules.activityId, activityId), eq(fineRules.userId, userId), eq(fineRules.active, true)))
    .limit(1);
  if (existing.length > 0) throw new Error('An active fine rule already exists for this user + activity');

  const [rule] = await db.insert(fineRules).values({ activityId, userId, period, limitType, limit, fineType, fineAmount, active: true }).returning();
  return rule;
}

export async function deactivateFineRule(fineRuleId: string): Promise<FineRule> {
  const [updated] = await db.update(fineRules)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(fineRules.id, fineRuleId))
    .returning();
  if (!updated) throw new Error(`Fine rule "${fineRuleId}" not found`);
  return updated;
}

export async function listFineRules(userId: string): Promise<FineRule[]> {
  return db.select().from(fineRules)
    .where(and(eq(fineRules.userId, userId), eq(fineRules.active, true)));
}

export async function recalculateFines(
  userId: string,
  activityId: string,
  periodStart: Date,
  period: 'week' | 'month',
  actualValue: number
): Promise<void> {
  const [rule] = await db.select().from(fineRules)
    .where(and(eq(fineRules.activityId, activityId), eq(fineRules.userId, userId), eq(fineRules.active, true), eq(fineRules.period, period)))
    .limit(1);
  if (!rule) return;

  const overage = rule.limitType === 'min'
    ? Math.max(0, rule.limit - actualValue)
    : Math.max(0, actualValue - rule.limit);

  const totalFine = overage > 0 ? (rule.fineType === 'flat' ? rule.fineAmount : overage * rule.fineAmount) : 0;
  const periodEnd = period === 'week'
    ? new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    : new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1));

  await db.insert(fines).values({
    userId, activityId, fineRuleId: rule.id, period, periodStartDate: periodStart, periodEndDate: periodEnd,
    limitType: rule.limitType, limit: rule.limit, actual: actualValue, overage, fineType: rule.fineType,
    fineAmount: rule.fineAmount, totalFine, isPaid: false,
  }).onConflictDoUpdate({
    target: [fines.userId, fines.activityId, fines.period, fines.periodStartDate],
    set: { actual: actualValue, overage, totalFine, updatedAt: new Date() },
  });
}

export async function getWeeklyFines(userId: string, dateStr: string, weekStartDay = 1): Promise<Fine[]> {
  const { start } = getWeekBounds(new Date(dateStr + 'T00:00:00Z'), weekStartDay);
  return db.select().from(fines)
    .where(and(eq(fines.userId, userId), eq(fines.period, 'week'), eq(fines.periodStartDate, start), gt(fines.totalFine, 0)));
}

export async function getMonthlyFines(userId: string, year: number, month: number): Promise<Fine[]> {
  const { start } = getMonthBounds(year, month);
  return db.select().from(fines)
    .where(and(eq(fines.userId, userId), eq(fines.period, 'month'), eq(fines.periodStartDate, start), gt(fines.totalFine, 0)));
}
