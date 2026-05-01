import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Cache the database connection to prevent hot-reload connection leaks in development.
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// Use exactly 1 connection per serverless function to avoid exhausting Aiven database limits.
// Add aggressive timeouts to ensure dangling Vercel lambdas release connections quickly.
const conn = globalForDb.conn ?? postgres(connectionString, { 
  max: 1, 
  idle_timeout: 5,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export type DB = typeof db;
