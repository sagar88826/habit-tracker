import { cookies } from 'next/headers';
import { listUsers } from '@/cli/services/userService';
import { getUserSubscriptions } from '@/cli/services/subscriptionService';
import { getActivity } from '@/cli/services/activityService';
import { listEntries, parseEntryValue } from '@/cli/services/entryService';
import { toDateStr, toUtcMidnight, getWeekLabel } from '@/cli/utils/dateUtils';
import { AddEntryForm, DeleteEntryButton } from './EntryForm';
import Link from 'next/link';

export default async function EntriesPage({
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

  const subs     = active ? await getUserSubscriptions(active.id) : [];
  const loggable = subs.filter(s => s.canLog);

  const activities = await Promise.all(
    loggable.map(s => getActivity(s.activityId).catch(() => null))
  ).then(arr => arr.filter(Boolean) as Awaited<ReturnType<typeof getActivity>>[]);

  // Use listEntries() from the service — no raw db query in the page
  const start = toUtcMidnight(dateStr);
  const end   = new Date(start.getTime() + 7 * 86400_000);
  const recentEntries = active ? await listEntries(active.id, start, end) : [];

  const actMap   = new Map(activities.map(a => [a.id, a]));
  const prevDate = toDateStr(new Date(start.getTime() - 7 * 86400_000));
  const nextDate = toDateStr(new Date(start.getTime() + 7 * 86400_000));

  return (
    <div className="space-y-6">
      {/* ── Header + week nav ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-lg sm:text-xl font-semibold">Log Entry</h1>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href={`/entries?date=${prevDate}`} className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center">← Prev</Link>
          <Link href={`/entries?date=${toDateStr(new Date())}`} className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center">Today</Link>
          <Link href={`/entries?date=${nextDate}`} className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] flex items-center">Next →</Link>
        </div>
      </div>

      {/* ── Add entry form (client component — dynamic type switching) ── */}
      {active && activities.length > 0 ? (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-4">
          <h2 className="font-medium">New entry</h2>
          <AddEntryForm userId={active.id} activities={activities} defaultDate={dateStr} />
        </section>
      ) : (
        <div className="text-sm text-zinc-500 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5">
          {!active ? 'Select a user to log entries.' : 'No loggable activities. Go to Activities to assign some.'}
        </div>
      )}

      {/* ── Recent entries ── */}
      <section className="space-y-3">
        <h2 className="font-medium text-sm sm:text-base">Entries for {getWeekLabel(new Date(dateStr))}</h2>
        {recentEntries.length === 0 ? (
          <p className="text-sm text-zinc-500">No entries this week.</p>
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Activity</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Value</th>
                  <th className="text-left px-3 sm:px-4 py-2.5 font-medium hidden sm:table-cell">Notes</th>
                  <th className="px-3 sm:px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentEntries.map(e => {
                  const act = actMap.get(e.activityId);
                  const val = act ? parseEntryValue(act.type, e) : (e.valueCount ?? e.valueBool);
                  return (
                    <tr key={e.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-3 sm:px-4 py-2.5 font-mono text-xs whitespace-nowrap">{toDateStr(new Date(e.date))}</td>
                      <td className="px-3 sm:px-4 py-2.5 max-w-[120px] truncate">{act?.name ?? e.activityId}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{String(val)}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-zinc-500 hidden sm:table-cell">{e.notes ?? '–'}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right">
                        <DeleteEntryButton entryId={e.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
