import { listUsers } from '@/cli/services/userService';
import { setActiveUser } from '@/app/actions';
import { createUserAction } from './actions';
import { cookies } from 'next/headers';

export default async function UsersPage() {
  const users  = await listUsers();
  const store  = await cookies();
  const active = store.get('active_user_id')?.value ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-lg sm:text-xl font-semibold">Users</h1>

      {/* ── User list ── */}
      {users.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[340px]">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left px-3 sm:px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-3 sm:px-4 py-2.5 font-medium hidden sm:table-cell">Email</th>
                <th className="text-left px-3 sm:px-4 py-2.5 font-medium hidden md:table-cell">Timezone</th>
                <th className="px-3 sm:px-4 py-2.5 font-medium text-center">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-3 sm:px-4 py-2.5 font-medium">
                    <div>{u.name}</div>
                    {/* Email visible inline on mobile since column is hidden */}
                    <div className="text-xs text-zinc-400 sm:hidden">{u.email}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 text-zinc-500 hidden sm:table-cell">{u.email}</td>
                  <td className="px-3 sm:px-4 py-2.5 text-zinc-500 hidden md:table-cell">{u.timezone}</td>
                  <td className="px-3 sm:px-4 py-2.5 text-center">
                    {u.id === active ? (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">active</span>
                    ) : (
                      <form action={setActiveUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline min-h-[36px]">
                          switch
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create user form ── */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-4">
        <h2 className="font-medium">Create user</h2>
        <form action={createUserAction} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field name="name"     label="Name"     placeholder="Sagar"            required />
            <Field name="email"    label="Email"    placeholder="sagar@example.com" type="email" required />
            <Field name="timezone" label="Timezone" placeholder="Asia/Kolkata" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Week starts on</label>
              <select name="weekStartDay" className={inputCls}>
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
              </select>
            </div>
          </div>
          <button type="submit" className={btnCls}>Create user</button>
        </form>
      </section>
    </div>
  );
}

const inputCls = 'rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-full min-h-[40px]';
const btnCls   = 'w-full px-4 py-2.5 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity min-h-[44px]';

function Field({ name, label, placeholder, type = 'text', required = false }: {
  name: string; label: string; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs text-zinc-500 font-medium">{label}</label>
      <input id={name} name={name} type={type} placeholder={placeholder} required={required} className={inputCls} />
    </div>
  );
}
