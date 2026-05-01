import { setActiveUser } from '@/app/actions';

export function UserTabs({
  users,
  activeUserId,
}: {
  users: { id: string; name: string }[];
  activeUserId: string | null;
}) {
  if (users.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar items-center pb-2">
      <span className="text-xs text-zinc-500 mr-2 shrink-0">Users:</span>
      {users.map(u => {
        const isActive = u.id === activeUserId;
        return (
          <form key={u.id} action={setActiveUser} className="shrink-0">
            <input type="hidden" name="userId" value={u.id} />
            <button
              type="submit"
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              {u.name}
            </button>
          </form>
        );
      })}
    </div>
  );
}
