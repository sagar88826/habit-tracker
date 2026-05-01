import { eq, and, gte, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { entries, type Entry } from '../db/schema';
import { toUtcMidnight, getDayBounds } from '../utils/dateUtils';
import { getSubscription } from './subscriptionService';
import { getActivity } from './activityService';
import { getUser } from './userService';
import { recalculate } from './summaryService';

function validateValue(type: 'count' | 'boolean', value: number | boolean): void {
  if (type === 'count') {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
      throw new Error('Count-based entry value must be a non-negative integer');
  } else {
    if (typeof value !== 'boolean')
      throw new Error('Boolean entry value must be true or false');
  }
}

/** Convert DB row columns back to the domain value type. */
export function parseEntryValue(activityType: 'count' | 'boolean', row: Pick<Entry, 'valueCount' | 'valueBool'>): number | boolean {
  if (activityType === 'boolean') return row.valueBool ?? false;
  return row.valueCount ?? 0;
}

export async function addEntry(
  userId: string,
  activityId: string,
  dateStr: string,
  value: number | boolean,
  notes?: string
): Promise<{ entry: Entry; affectedDate: Date }> {
  const sub = await getSubscription(userId, activityId);
  if (!sub?.canLog) throw new Error(`User "${userId}" does not have log permission for activity "${activityId}"`);

  const activity = await getActivity(activityId);
  validateValue(activity.type, value);

  const date       = toUtcMidnight(dateStr);
  const valueCount = activity.type === 'count'   ? (value as number)  : null;
  const valueBool  = activity.type === 'boolean'  ? (value as boolean) : null;

  // Boolean: one effective value per day — overwrite if exists
  if (activity.type === 'boolean') {
    const { start, end } = getDayBounds(dateStr);
    const [existing] = await db.select().from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.activityId, activityId), gte(entries.date, start), lt(entries.date, end)))
      .limit(1);

    if (existing) {
      const [updated] = await db.update(entries)
        .set({ valueBool, notes, updatedAt: new Date() })
        .where(eq(entries.id, existing.id))
        .returning();
      await _recalculate(userId, activityId, date);
      return { entry: updated, affectedDate: date };
    }
  }

  const [entry] = await db.insert(entries).values({ userId, activityId, date, valueCount, valueBool, notes }).returning();

  // Recompute day + week + month summaries and fines for the affected period.
  // Callers must NOT call recalculate() separately — it is handled here.
  await _recalculate(userId, activityId, date);

  return { entry, affectedDate: date };
}

export async function editEntry(
  entryId: string,
  value?: number | boolean,
  notes?: string
): Promise<{ entry: Entry; affectedDate: Date }> {
  const [existing] = await db.select().from(entries).where(eq(entries.id, entryId)).limit(1);
  if (!existing) throw new Error(`Entry "${entryId}" not found`);

  const updates: Partial<Entry> = { updatedAt: new Date() };

  if (value !== undefined) {
    const activity = await getActivity(existing.activityId);
    validateValue(activity.type, value);
    if (activity.type === 'count') updates.valueCount = value as number;
    else updates.valueBool = value as boolean;
  }
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db.update(entries).set(updates).where(eq(entries.id, entryId)).returning();
  const affectedDate = new Date(existing.date);
  await _recalculate(existing.userId, existing.activityId, affectedDate);
  return { entry: updated, affectedDate };
}

export async function deleteEntry(entryId: string): Promise<{ userId: string; activityId: string; affectedDate: Date }> {
  const [existing] = await db.select().from(entries).where(eq(entries.id, entryId)).limit(1);
  if (!existing) throw new Error(`Entry "${entryId}" not found`);
  await db.delete(entries).where(eq(entries.id, entryId));

  const affectedDate = new Date(existing.date);
  // Recompute summaries and fines immediately — callers must NOT call recalculate() separately.
  await _recalculate(existing.userId, existing.activityId, affectedDate);

  return { userId: existing.userId, activityId: existing.activityId, affectedDate };
}

/** List entries for a user in [start, end) range. */
export async function listEntries(
  userId: string,
  start: Date,
  end: Date,
  activityId?: string
): Promise<Entry[]> {
  const conditions = [
    eq(entries.userId, userId),
    gte(entries.date, start),
    lt(entries.date, end),
  ];
  if (activityId) conditions.push(eq(entries.activityId, activityId));
  return db.select().from(entries).where(and(...conditions)).orderBy(entries.date);
}

/** Internal: fetch weekStartDay and trigger recalculation. */
async function _recalculate(userId: string, activityId: string, date: Date): Promise<void> {
  const user = await getUser(userId);
  await recalculate(userId, activityId, date, user.weekStartDay ?? 1);
}
