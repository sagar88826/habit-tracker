'use server';

import { revalidatePath } from 'next/cache';
import { createFineRule, deactivateFineRule } from '@/cli/services/fineService';

export async function createFineRuleAction(formData: FormData) {
  const activityId = formData.get('activityId') as string;
  const userId     = formData.get('userId') as string;
  const period     = formData.get('period') as 'week' | 'month';
  const limit      = parseFloat(formData.get('limit') as string);
  const limitType  = formData.get('limitType') as 'min' | 'max';
  const fineType   = formData.get('fineType') as 'flat' | 'per_unit';
  const dollars    = parseFloat(formData.get('amount') as string);
  const cents      = Math.round(dollars * 100);
  await createFineRule(activityId, userId, period, limitType, limit, fineType, cents);
  revalidatePath('/fines');
}

export async function deactivateFineRuleAction(formData: FormData) {
  const id = formData.get('id') as string;
  await deactivateFineRule(id);
  revalidatePath('/fines');
}

