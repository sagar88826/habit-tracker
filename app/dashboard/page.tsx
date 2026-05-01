import { cookies } from 'next/headers';
import Link from 'next/link';
import { listUsers } from '@/cli/services/userService';
import { listActivities } from '@/cli/services/activityService';
import { getWeeklySummary } from '@/cli/services/summaryService';
import { getWeeklyFines } from '@/cli/services/fineService';
import { listEntries } from '@/cli/services/entryService';
import { getWeekBounds, toDateStr, formatMoney, getWeekLabel, getWeekDays } from '@/cli/utils/dateUtils';
import type { Entry } from '@/cli/db/schema';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const store  = await cookies();
  const userId = store.get('active_user_id')?.value ?? null;
  const users  = await listUsers();
  const active = users.find(u => u.id === userId) ?? users[0] ?? null;

  const sp      = await searchParams;
  const dateStr = sp.date ?? toDateStr(new Date());

  if (!active) {
    return (
      <div className="text-center py-20 text-zinc-500">
        No users yet.{' '}
        <Link href="/users" className="text-zinc-900 dark:text-white underline">Create one</Link>
        {' '}to get started.
      </div>
    );
  }

  const weekStart = toDateStr(getWeekBounds(new Date(dateStr + 'T00:00:00Z'), active.weekStartDay ?? 1).start);
  const weekStartObj = new Date(weekStart + 'T00:00:00Z');
  const nextWeekStartObj = new Date(weekStartObj.getTime() + 7 * 86400_000);

  const [summaries, fines, allActivities, rawEntries] = await Promise.all([
    getWeeklySummary(active.id, dateStr, active.weekStartDay ?? 1),
    getWeeklyFines(active.id, dateStr, active.weekStartDay ?? 1),
    listActivities(),
    listEntries(active.id, weekStartObj, nextWeekStartObj),
  ]);

  const totalFine = fines.reduce((s, f) => s + f.totalFine, 0);
  const actMap    = new Map(allActivities.map(a => [a.id, a.name]));
  const typeMap   = new Map(allActivities.map(a => [a.id, a.type]));

  const prevDate  = toDateStr(new Date(weekStartObj.getTime() - 7 * 86400_000));
  const nextDate  = toDateStr(nextWeekStartObj);

  const weekDays = getWeekDays(weekStartObj);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Fast lookup for entries: Map<activityId, Map<dateStr, entry>>
  const entryMatrix = new Map<string, Map<string, Entry>>();
  for (const e of rawEntries) {
    if (!entryMatrix.has(e.activityId)) entryMatrix.set(e.activityId, new Map());
    const dayMap = entryMatrix.get(e.activityId)!;
    const dStr = toDateStr(new Date(e.date));
    
    if (dayMap.has(dStr)) {
      const existing = dayMap.get(dStr)!;
      if (e.valueCount !== null) {
        existing.valueCount = (existing.valueCount ?? 0) + e.valueCount;
      }
      if (e.valueBool !== null) {
        existing.valueBool = existing.valueBool || e.valueBool;
      }
    } else {
      dayMap.set(dStr, { ...e });
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header row ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">Weekly Summary</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{active.name} · {getWeekLabel(new Date(weekStart))}</p>
        </div>
        {/* Week navigation */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={`/dashboard?date=${prevDate}`}
            className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center"
          >
            ← Prev
          </Link>
          <Link
            href={`/dashboard?date=${toDateStr(new Date())}`}
            className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center"
          >
            Today
          </Link>
          <Link
            href={`/dashboard?date=${nextDate}`}
            className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center"
          >
            Next →
          </Link>
        </div>
      </div>

      {/* ── Summary table ── */}
      {summaries.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 text-sm">
          No activities tracked this week.{' '}
          <Link href="/entries" className="text-zinc-900 dark:text-white underline">Log an entry</Link>.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Activity</th>
                {weekDays.map(d => (
                  <th key={d.getTime()} className="text-center px-2 py-2.5 font-medium text-xs sm:text-sm">
                    {dayNames[d.getUTCDay()]}
                  </th>
                ))}
                <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {summaries.map(s => {
                const aType = typeMap.get(s.activityId);
                const eMap = entryMatrix.get(s.activityId) ?? new Map();
                return (
                  <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-3 sm:px-4 py-2.5 font-medium">{actMap.get(s.activityId) ?? s.activityId}</td>
                    {weekDays.map(d => {
                      const dStr = toDateStr(d);
                      const entry = eMap.get(dStr);
                      let val: React.ReactNode = <span className="text-zinc-300 dark:text-zinc-700">-</span>;
                      if (entry) {
                        if (aType === 'count' && entry.valueCount !== null) {
                          val = <span className="font-mono">{entry.valueCount}</span>;
                        } else if (aType === 'boolean' && entry.valueBool) {
                          val = <span className="text-zinc-900 dark:text-zinc-100 font-bold">✓</span>;
                        }
                      }
                      return (
                        <td key={d.getTime()} className="px-2 py-2.5 text-center">
                          {val}
                        </td>
                      );
                    })}
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono font-medium">{s.totalValue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Fines banner ── */}
      {fines.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Fines this week</p>
          {fines.map(f => (
            <div key={f.id} className="flex justify-between text-sm text-red-700 dark:text-red-300">
              <span className="truncate mr-2">{actMap.get(f.activityId) ?? f.activityId} — over by {f.overage}</span>
              <span className="font-mono shrink-0">{formatMoney(f.totalFine)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold text-red-800 dark:text-red-200 border-t border-red-200 dark:border-red-800 pt-2">
            <span>Total</span>
            <span className="font-mono">{formatMoney(totalFine)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
