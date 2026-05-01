'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function setActiveUser(formData: FormData) {
  const userId = formData.get('userId') as string;
  if (!userId) return;
  const store = await cookies();
  store.set('active_user_id', userId, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/dashboard');
}
