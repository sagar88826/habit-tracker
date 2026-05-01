import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Cache the database connection to prevent hot-reload connection leaks in development.
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// Use a smaller connection pool in serverless/production to avoid exhausting the DB.
const conn = globalForDb.conn ?? postgres(connectionString, { 
  max: process.env.NODE_ENV === 'production' ? 5 : 1,
  idle_timeout: 20 
});

if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export type DB = typeof db;
