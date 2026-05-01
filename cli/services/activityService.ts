import { eq, and, ilike } from 'drizzle-orm';
import { db } from '../db/client';
import { activities, type Activity } from '../db/schema';

export async function createActivity(ownerId: string, name: string, type: 'count' | 'boolean', description?: string): Promise<Activity> {
  const existing = await db.select().from(activities)
    .where(and(eq(activities.ownerId, ownerId), ilike(activities.name, name), eq(activities.archived, false)))
    .limit(1);
  if (existing.length > 0) throw new Error(`Activity "${name}" already exists for this user`);

  const [activity] = await db.insert(activities).values({ ownerId, name, type, description, archived: false }).returning();
  return activity;
}

export async function archiveActivity(activityId: string): Promise<Activity> {
  const [updated] = await db.update(activities)
    .set({ archived: true, updatedAt: new Date() })
    .where(eq(activities.id, activityId))
    .returning();
  if (!updated) throw new Error(`Activity "${activityId}" not found`);
  return updated;
}

export async function getActivity(activityId: string): Promise<Activity> {
  const [activity] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
  if (!activity) throw new Error(`Activity "${activityId}" not found`);
  return activity;
}

export async function listActivities(ownerId?: string): Promise<Activity[]> {
  const query = db.select().from(activities).where(
    ownerId ? and(eq(activities.archived, false), eq(activities.ownerId, ownerId)) : eq(activities.archived, false)
  );
  return query;
}
