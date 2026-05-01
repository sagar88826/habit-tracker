import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type User, type NewUser } from '../db/schema';

export async function createUser(name: string, email: string, timezone: string, weekStartDay = 1): Promise<User> {
  const norm = email.toLowerCase().trim();
  const existing = await db.select().from(users).where(eq(users.email, norm)).limit(1);
  if (existing.length > 0) throw new Error(`User with email "${norm}" already exists`);

  const [user] = await db.insert(users).values({ email: norm, name, timezone, weekStartDay }).returning();
  return user;
}

export async function listUsers(): Promise<User[]> {
  return db.select().from(users);
}

export async function getUser(userId: string): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`User "${userId}" not found`);
  return user;
}
