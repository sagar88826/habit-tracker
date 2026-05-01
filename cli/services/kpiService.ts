import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { summaries, activities, userSubscriptions } from '../db/schema';
import { getWeekBounds, toDateStr } from '../utils/dateUtils';
import { getUser } from './userService';

type Trend = 'improved' | 'declined' | 'same' | 'no-data';

export interface ActivityKPI {
  activityId:   string;
  activityName: string;
  thisWeek:     number;
  prevWeek:     number | null;
  trend:        Trend;
  isComplete:   boolean;
}

export interface PersonalKPI {
  userId:        string;
  weekStart:     string;
  weekEnd:       string;
  activities:    ActivityKPI[];
  overallTrend:  Trend;
}

export interface ComparisonRow {
  activityId:   string;
  activityName: string;
  winner:       string;           // userId, "tie", or "no-data"
  values:       Record<string, number>;
}

export interface ComparisonKPI {
  weekStart: string;
  user1:     string;
  user2:     string;
  rows:      ComparisonRow[];
}

export async function getPersonalKPI(userId: string, dateStr: string): Promise<PersonalKPI> {
  const user = await getUser(userId);
  const ws   = user.weekStartDay ?? 1;
  const { start: thisStart, end: thisEnd } = getWeekBounds(new Date(dateStr + 'T00:00:00Z'), ws);
  const prevStart = new Date(thisStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [thisSums, prevSums, acts] = await Promise.all([
    db.select().from(summaries).where(and(eq(summaries.userId, userId), eq(summaries.period, 'week'), eq(summaries.startDate, thisStart))),
    db.select().from(summaries).where(and(eq(summaries.userId, userId), eq(summaries.period, 'week'), eq(summaries.startDate, prevStart))),
    db.select().from(activities).where(eq(activities.archived, false)),
  ]);

  if (thisSums.length === 0) {
    return { userId, weekStart: toDateStr(thisStart), weekEnd: toDateStr(thisEnd), activities: [], overallTrend: 'no-data' };
  }

  const activityKPIs: ActivityKPI[] = thisSums.map(s => {
    const act  = acts.find(a => a.id === s.activityId);
    const prev = prevSums.find(p => p.activityId === s.activityId);
    let trend: Trend;
    if (!prev) trend = 'no-data';
    else if (s.totalValue > prev.totalValue) trend = 'improved';
    else if (s.totalValue < prev.totalValue) trend = 'declined';
    else trend = 'same';

    return { activityId: s.activityId, activityName: act?.name ?? 'Unknown', thisWeek: s.totalValue, prevWeek: prev?.totalValue ?? null, trend, isComplete: s.isComplete };
  });

  const trends   = activityKPIs.map(k => k.trend).filter(t => t !== 'no-data');
  const improved = trends.filter(t => t === 'improved').length;
  const declined = trends.filter(t => t === 'declined').length;
  let overallTrend: Trend = 'no-data';
  if (trends.length > 0) overallTrend = improved > declined ? 'improved' : declined > improved ? 'declined' : 'same';

  return { userId, weekStart: toDateStr(thisStart), weekEnd: toDateStr(thisEnd), activities: activityKPIs, overallTrend };
}

export async function compareUsers(user1Id: string, user2Id: string, dateStr: string): Promise<ComparisonKPI> {
  const [user1, user2] = await Promise.all([getUser(user1Id), getUser(user2Id)]);
  const { start: weekStart } = getWeekBounds(new Date(dateStr + 'T00:00:00Z'), user1.weekStartDay ?? 1);

  const [u1Subs, u2Subs] = await Promise.all([
    db.select().from(userSubscriptions).where(and(eq(userSubscriptions.userId, user1Id), eq(userSubscriptions.canCompare, true))),
    db.select().from(userSubscriptions).where(and(eq(userSubscriptions.userId, user2Id), eq(userSubscriptions.canCompare, true))),
  ]);

  const sharedIds = u1Subs.filter(s1 => u2Subs.some(s2 => s2.activityId === s1.activityId)).map(s => s.activityId);
  if (sharedIds.length === 0) return { weekStart: toDateStr(weekStart), user1: user1.name, user2: user2.name, rows: [] };

  const [acts, u1Sums, u2Sums] = await Promise.all([
    db.select().from(activities).where(and(inArray(activities.id, sharedIds), eq(activities.archived, false))),
    db.select().from(summaries).where(and(eq(summaries.userId, user1Id), eq(summaries.period, 'week'), eq(summaries.startDate, weekStart), inArray(summaries.activityId, sharedIds))),
    db.select().from(summaries).where(and(eq(summaries.userId, user2Id), eq(summaries.period, 'week'), eq(summaries.startDate, weekStart), inArray(summaries.activityId, sharedIds))),
  ]);

  const rows: ComparisonRow[] = acts.map(act => {
    const v1 = u1Sums.find(s => s.activityId === act.id)?.totalValue ?? 0;
    const v2 = u2Sums.find(s => s.activityId === act.id)?.totalValue ?? 0;
    const winner = v1 === 0 && v2 === 0 ? 'no-data' : v1 > v2 ? user1Id : v2 > v1 ? user2Id : 'tie';
    return { activityId: act.id, activityName: act.name, winner, values: { [user1Id]: v1, [user2Id]: v2 } };
  });

  return { weekStart: toDateStr(weekStart), user1: user1.name, user2: user2.name, rows };
}
