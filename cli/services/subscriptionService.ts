import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { userSubscriptions, type UserSubscription } from '../db/schema';

export interface SubscriptionConfig {
  canLog: boolean;
  canView: boolean;
  canCompare: boolean;
  mandatory: boolean;
}

export async function assignActivity(activityId: string, userId: string, config: SubscriptionConfig): Promise<UserSubscription> {
  const existing = await db.select().from(userSubscriptions)
    .where(and(eq(userSubscriptions.activityId, activityId), eq(userSubscriptions.userId, userId)))
    .limit(1);
  if (existing.length > 0) throw new Error(`User "${userId}" is already assigned to activity "${activityId}"`);

  const [sub] = await db.insert(userSubscriptions).values({ activityId, userId, ...config }).returning();
  return sub;
}

export async function getSubscription(userId: string, activityId: string): Promise<UserSubscription | null> {
  const [sub] = await db.select().from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.activityId, activityId)))
    .limit(1);
  return sub ?? null;
}

export async function getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
  return db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId));
}

export async function getActivitySubscriptions(activityId: string): Promise<UserSubscription[]> {
  return db.select().from(userSubscriptions).where(eq(userSubscriptions.activityId, activityId));
}
