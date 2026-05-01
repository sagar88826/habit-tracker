import { cookies } from 'next/headers';
import { listUsers } from '@/cli/services/userService';
import { listActivities } from '@/cli/services/activityService';
import { getWeeklyFines, getMonthlyFines, listFineRules } from '@/cli/services/fineService';
import { toDateStr, formatMoney, getWeekBounds, getWeekLabel } from '@/cli/utils/dateUtils';
import Link from 'next/link';
import { createFineRuleAction, deactivateFineRuleAction } from './actions';

export default async function FinesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string }>;
}) {
  const store  = await cookies();
  const userId = store.get('active_user_id')?.value ?? null;
  const users  = await listUsers();
  const active = users.find(u => u.id === userId) ?? users[0] ?? null;

  const sp      = await searchParams;
  const dateStr = sp.date ?? toDateStr(new Date());
  const period  = sp.period === 'month' ? 'month' : 'week';

  if (!active) {
    return (
      <div className="text-center py-20 text-zinc-500">
        No users yet. <Link href="/users" className="underline text-zinc-900 dark:text-white">Create one</Link>.
      </div>
    );
  }

  const activities = await listActivities();
  const activeRules = await listFineRules(active.id);
  const date = new Date(dateStr + 'T00:00:00Z');

  let fines: Awaited<ReturnType<typeof getWeeklyFines>>;
  let periodLabel: string;
  if (period === 'month') {
    fines = await getMonthlyFines(active.id, date.getUTCFullYear(), date.getUTCMonth() + 1);
    periodLabel = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  } else {
    fines = await getWeeklyFines(active.id, dateStr, active.weekStartDay ?? 1);
    const ws = getWeekBounds(date, active.weekStartDay ?? 1);
    periodLabel = getWeekLabel(ws.start);
  }

  const total  = fines.reduce((s, f) => s + f.totalFine, 0);
  const actMap = new Map(activities.map(a => [a.id, a.name]));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">Fines</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{active.name} · {periodLabel}</p>
        </div>
        {/* Period + date filter */}
        <form className="flex flex-wrap items-center gap-2">
          <input type="date" name="date" defaultValue={dateStr} className={inputCls} />
          <select name="period" defaultValue={period} className={inputCls}>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <button type="submit" className="px-3 py-2 text-sm rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-80 transition-opacity min-h-[40px]">
            Filter
          </button>
        </form>
      </div>

      {/* ── Fines table ── */}
      {fines.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 text-sm">
          No fines for this period. 🎉
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[380px]">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Activity</th>
                <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Limit</th>
                <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Actual</th>
                <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Over / Under</th>
                <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {fines.map(f => (
                <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-3 sm:px-4 py-2.5 max-w-[120px] truncate">{actMap.get(f.activityId) ?? f.activityId}</td>
                  <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{f.limitType === 'min' ? '≥ ' : '≤ '}{f.limit}</td>
                  <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{f.actual}</td>
                  <td className="px-3 sm:px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">
                    {f.limitType === 'min' ? '-' : '+'}{f.overage}
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 text-right font-mono font-semibold">{formatMoney(f.totalFine)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 dark:bg-zinc-900 font-semibold">
                <td colSpan={4} className="px-3 sm:px-4 py-2.5 text-right text-sm">Total</td>
                <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{formatMoney(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Active fine rules ── */}
      {activeRules.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-sm sm:text-base">Active fine rules</h2>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Activity</th>
                  <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Period</th>
                  <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Type</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Limit</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 font-medium">Fine</th>
                  <th className="px-3 sm:px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {activeRules.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-3 sm:px-4 py-2.5 max-w-[120px] truncate font-medium">{actMap.get(r.activityId) ?? r.activityId}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-zinc-500">{r.period}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-zinc-500">{r.limitType === 'min' ? 'Min' : 'Max'}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono">{r.limit}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-mono">
                      {r.fineType === 'flat' ? 'Flat ' : 'Per unit '}
                      {formatMoney(r.fineAmount)}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-right">
                      <form action={deactivateFineRuleAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline min-h-[36px]">
                          deactivate
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Add fine rule ── */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-4">
        <h2 className="font-medium">Add fine rule</h2>
        <form action={createFineRuleAction} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Activity</label>
              <select name="activityId" className={inputCls}>
                {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">User</label>
              <select name="userId" defaultValue={active.id} className={inputCls}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Period</label>
              <select name="period" className={inputCls}>
                <option value="week">week</option>
                <option value="month">month</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Limit type</label>
              <select name="limitType" className={inputCls}>
                <option value="max">Max (punish overage)</option>
                <option value="min">Min (punish shortfall)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Limit</label>
              <input type="number" name="limit" min="0" step="1" defaultValue="3" required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Fine type</label>
              <select name="fineType" className={inputCls}>
                <option value="flat">flat</option>
                <option value="per_unit">per_unit</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Amount (₹)</label>
              <input type="number" name="amount" min="0" step="0.01" defaultValue="5" required className={inputCls} />
            </div>
          </div>
          <button type="submit" className={btnCls}>Create fine rule</button>
        </form>
      </section>
    </div>
  );
}

const inputCls = 'rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-full min-h-[40px]';
const btnCls   = 'w-full px-4 py-2.5 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity min-h-[44px]';
