'use client';

import { useState } from 'react';
import { addEntryAction, deleteEntryAction } from './actions';

type Activity = { id: string; name: string; type: 'count' | 'boolean' };

const inputCls = 'rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-full min-h-[40px]';
const btnCls   = 'w-full px-4 py-2.5 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity min-h-[44px]';

export function AddEntryForm({
  userId,
  activities,
  defaultDate,
}: {
  userId: string;
  activities: Activity[];
  defaultDate: string;
}) {
  const [selectedId, setSelectedId] = useState(activities[0]?.id ?? '');
  const selected = activities.find(a => a.id === selectedId) ?? activities[0];

  return (
    <form action={addEntryAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      {/* Pass actual type of the currently-selected activity */}
      <input type="hidden" name="activityType" value={selected?.type ?? 'count'} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Activity</label>
          <select
            name="activityId"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className={inputCls}
          >
            {activities.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Date</label>
          <input type="date" name="date" defaultValue={defaultDate} required className={inputCls} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Value</label>
          {/* Dynamically switches based on the selected activity type */}
          {selected?.type === 'boolean' ? (
            <select name="value" className={inputCls}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input type="number" name="value" min="0" defaultValue="1" required className={inputCls} />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Notes (optional)</label>
          <input type="text" name="notes" placeholder="optional note" className={inputCls} />
        </div>
      </div>

      <button type="submit" className={btnCls}>Log entry</button>
    </form>
  );
}

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  return (
    <form action={deleteEntryAction}>
      <input type="hidden" name="id" value={entryId} />
      <button type="submit" className="text-xs text-red-500 hover:text-red-700 underline min-h-[36px]">
        del
      </button>
    </form>
  );
}
