'use server';

import { revalidatePath } from 'next/cache';
import { addEntry, deleteEntry } from '@/cli/services/entryService';

export async function addEntryAction(formData: FormData) {
  const userId     = formData.get('userId') as string;
  const activityId = formData.get('activityId') as string;
  const dateStr    = formData.get('date') as string;
  const rawValue   = formData.get('value') as string;
  const actType    = formData.get('activityType') as 'count' | 'boolean';
  const notes      = (formData.get('notes') as string | null)?.trim() || undefined;

  const value = actType === 'boolean' ? rawValue === 'true' : parseInt(rawValue, 10);

  // recalculate() is now called inside addEntry — no need to call it here
  await addEntry(userId, activityId, dateStr, value, notes);

  revalidatePath('/entries');
  revalidatePath('/dashboard');
}

export async function deleteEntryAction(formData: FormData) {
  const id = formData.get('id') as string;

  // recalculate() is now called inside deleteEntry — no need to call it here
  await deleteEntry(id);

  revalidatePath('/entries');
  revalidatePath('/dashboard');
}
