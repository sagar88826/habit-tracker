'use server';

import { revalidatePath } from 'next/cache';
import { createActivity, archiveActivity } from '@/cli/services/activityService';
import { assignActivity } from '@/cli/services/subscriptionService';

export async function createActivityAction(formData: FormData) {
  const ownerId     = (formData.get('ownerId') as string).trim();
  const name        = (formData.get('name') as string).trim();
  const type        = formData.get('type') as 'count' | 'boolean';
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  await createActivity(ownerId, name, type, description);
  revalidatePath('/activities');
}

export async function archiveActivityAction(formData: FormData) {
  const id = formData.get('id') as string;
  await archiveActivity(id);
  revalidatePath('/activities');
}

export async function assignActivityAction(formData: FormData) {
  const activityId  = formData.get('activityId') as string;
  const userId      = formData.get('userId') as string;
  const canLog      = formData.get('canLog') === 'on';
  const canView     = formData.get('canView') === 'on';
  const canCompare  = formData.get('canCompare') === 'on';
  const mandatory   = formData.get('mandatory') === 'on';
  await assignActivity(activityId, userId, { canLog, canView, canCompare, mandatory });
  revalidatePath('/activities');
}
