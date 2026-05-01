import { cookies } from 'next/headers';
import { listActivities } from '@/cli/services/activityService';
import { listUsers } from '@/cli/services/userService';
import { getUserSubscriptions } from '@/cli/services/subscriptionService';
import { createActivityAction, archiveActivityAction, assignActivityAction } from './actions';

export default async function ActivitiesPage() {
  const store      = await cookies();
  const userId     = store.get('active_user_id')?.value ?? null;
  const users      = await listUsers();
  const active     = users.find(u => u.id === userId) ?? users[0] ?? null;
  const activities = await listActivities();
  const subs       = active ? await getUserSubscriptions(active.id) : [];
  const subSet     = new Set(subs.map(s => s.activityId));

  return (
    <div className="space-y-6">
      <h1 className="text-lg sm:text-xl font-semibold">Activities</h1>

      {activities.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[340px]">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Type</th>
                <th className="px-3 sm:px-4 py-2.5 font-medium text-center">Sub&apos;d</th>
                <th className="px-3 sm:px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {activities.map(a => (
                <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-3 sm:px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-3 sm:px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${a.type === 'count' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 text-center text-xs text-zinc-500">
                    {subSet.has(a.id) ? '✓' : '–'}
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 text-right">
                    <form action={archiveActivityAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline min-h-[36px] px-1">archive</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-4">
          <h2 className="font-medium">Create activity</h2>
          <form action={createActivityAction} className="space-y-3">
            <input type="hidden" name="ownerId" value={active?.id ?? ''} />
            <Field name="name" label="Name" placeholder="Burgers eaten" required />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Type</label>
              <select name="type" className={inputCls}>
                <option value="count">count</option>
                <option value="boolean">boolean</option>
              </select>
            </div>
            <Field name="description" label="Description (optional)" placeholder="How many per week?" />
            <button type="submit" className={btnCls}>Create</button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-4">
          <h2 className="font-medium">Assign to user</h2>
          <form action={assignActivityAction} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Activity</label>
              <select name="activityId" className={inputCls}>
                {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">User</label>
              <select name="userId" className={inputCls}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Checkbox name="canLog"     label="Can log" />
              <Checkbox name="canView"    label="Can view" />
              <Checkbox name="canCompare" label="Can compare" />
              <Checkbox name="mandatory"  label="Mandatory" />
            </div>
            <button type="submit" className={btnCls}>Assign</button>
          </form>
        </section>
      </div>
    </div>
  );
}

const inputCls = 'rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-full min-h-[40px]';
const btnCls   = 'w-full px-4 py-2.5 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity min-h-[44px]';

function Field({ name, label, placeholder, required = false }: { name: string; label: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs text-zinc-500 font-medium">{label}</label>
      <input id={name} name={name} placeholder={placeholder} required={required} className={inputCls} />
    </div>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
      <input type="checkbox" name={name} defaultChecked className="w-4 h-4 rounded" />
      {label}
    </label>
  );
}
