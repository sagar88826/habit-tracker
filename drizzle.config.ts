import { defineConfig } from 'drizzle-kit';
import { readFileSync, existsSync } from 'fs';

// drizzle-kit doesn't load .env.local automatically — parse it here
if (!process.env.DATABASE_URL) {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) {
      readFileSync(file, 'utf-8').split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length && !process.env[key.trim()])
          process.env[key.trim()] = rest.join('=').trim();
      });
      break;
    }
  }
}

export default defineConfig({
  schema: './cli/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
