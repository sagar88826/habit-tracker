import { cookies } from 'next/headers';
import { listUsers } from '@/cli/services/userService';
import { getPersonalKPI, compareUsers } from '@/cli/services/kpiService';
import { getWeekBounds, toDateStr, getWeekLabel } from '@/cli/utils/dateUtils';
import Link from 'next/link';

const TREND_ICON: Record<string, string>  = { improved: '↑', declined: '↓', same: '→', 'no-data': '–' };
const TREND_COLOR: Record<string, string> = {
  improved: 'text-green-600 dark:text-green-400',
  declined: 'text-red-500 dark:text-red-400',
  same:     'text-zinc-400',
  'no-data':'text-zinc-400',
};

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; compare?: string }>;
}) {
  const store  = await cookies();
  const userId = store.get('active_user_id')?.value ?? null;
  const users  = await listUsers();
  const active = users.find(u => u.id === userId) ?? users[0] ?? null;

  const sp      = await searchParams;
  const dateStr = sp.date ?? toDateStr(new Date());
  const cmpId   = sp.compare ?? null;

  if (!active) {
    return (
      <div className="text-center py-20 text-zinc-500">
        No users yet. <Link href="/users" className="underline text-zinc-900 dark:text-white">Create one</Link>.
      </div>
    );
  }

  const kpi     = await getPersonalKPI(active.id, dateStr);
  const cmp     = cmpId ? await compareUsers(active.id, cmpId, dateStr) : null;
  const cmpUser = cmpId ? users.find(u => u.id === cmpId) : null;

  const weekStart = kpi.weekStart;
  const prevDate  = toDateStr(new Date(new Date(weekStart + 'T00:00:00Z').getTime() - 7 * 86400_000));
  const nextDate  = toDateStr(new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 7 * 86400_000));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">KPI</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            {active.name} · {getWeekLabel(new Date(weekStart + 'T00:00:00Z'))}
            {' '}
            <span className={`font-medium ${TREND_COLOR[kpi.overallTrend] ?? 'text-zinc-400'}`}>
              {TREND_ICON[kpi.overallTrend]}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href={`/kpi?date=${prevDate}`} className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center">← Prev</Link>
          <Link href={`/kpi?date=${toDateStr(new Date())}`} className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center">Today</Link>
          <Link href={`/kpi?date=${nextDate}`} className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center">Next →</Link>
        </div>
      </div>

      {/* Personal KPI */}
      <section className="space-y-3">
        <h2 className="font-medium">This week vs last week</h2>
        {kpi.activities.length === 0 ? (
          <p className="text-sm text-zinc-500">No data for this week.</p>
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead className="bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Activity</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 font-medium">This wk</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Last wk</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Trend</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 font-medium hidden sm:table-cell">Done</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {kpi.activities.map(a => (
                  <tr key={a.activityId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-3 sm:px-4 py-2.5 font-medium">{a.activityName}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{a.thisWeek}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{a.prevWeek ?? '–'}</td>
                    <td className={`px-3 sm:px-4 py-2.5 text-right font-mono ${TREND_COLOR[a.trend] ?? 'text-zinc-400'}`}>
                      {TREND_ICON[a.trend] ?? a.trend}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-right hidden sm:table-cell">{a.isComplete ? '✓' : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Compare users */}
      <section className="space-y-3">
        <h2 className="font-medium">Compare with another user</h2>
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="date" value={dateStr} />
          <select name="compare" defaultValue={cmpId ?? ''} className={inputCls}>
            <option value="">— select user —</option>
            {users.filter(u => u.id !== active.id).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button type="submit" className="px-3 py-2 text-sm rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-80 transition-opacity min-h-[40px]">
            Compare
          </button>
        </form>

        {cmp && cmpUser && (
          cmp.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No shared comparable activities.</p>
          ) : (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
              <table className="w-full text-sm min-w-[360px]">
                <thead className="bg-zinc-100 dark:bg-zinc-800">
                  <tr>
                    <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Activity</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">{active.name}</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">{cmpUser.name}</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Winner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {cmp.rows.map(r => (
                    <tr key={r.activityId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-3 sm:px-4 py-2.5 font-medium">{r.activityName}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{r.values[active.id] ?? 0}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{r.values[cmpId!] ?? 0}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right text-xs font-medium">
                        {r.winner === 'no-data' ? '–' : r.winner === 'tie' ? 'tie' : r.winner === active.id ? active.name : cmpUser.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </div>
  );
}

const inputCls = 'rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm min-h-[40px]';
