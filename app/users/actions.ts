'use server';

import { revalidatePath } from 'next/cache';
import { createUser } from '@/cli/services/userService';

export async function createUserAction(formData: FormData) {
  const name      = (formData.get('name') as string).trim();
  const email     = (formData.get('email') as string).trim();
  const timezone  = (formData.get('timezone') as string).trim() || 'UTC';
  const wsd       = parseInt(formData.get('weekStartDay') as string, 10);
  const weekStartDay = isNaN(wsd) ? 1 : wsd;

  try {
    await createUser(name, email, timezone, weekStartDay);
  } catch (err) {
    throw new Error((err as Error).message);
  }
  revalidatePath('/users');
}
