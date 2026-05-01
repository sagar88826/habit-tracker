import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { cookies } from 'next/headers';
import Link from 'next/link';
import './globals.css';
import Nav from './ui/nav';
import { UserTabs } from './ui/UserTabs';
import { listUsers } from '@/cli/services/userService';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Habit Tracker',
  viewport: 'width=device-width, initial-scale=1',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store  = await cookies();
  const userId = store.get('active_user_id')?.value ?? null;
  const users  = await listUsers();
  const active = users.find(u => u.id === userId) ?? users[0] ?? null;

  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">

        {/* ── Top header ────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 h-12 flex items-center justify-between gap-3">

            {/* Logo */}
            <Link href="/dashboard" className="font-semibold text-sm tracking-tight shrink-0">
              Habit Tracker
            </Link>

            {/* Desktop nav — MobileNav renders itself fixed at bottom */}
            <Nav />

          </div>
        </header>

        {/* ── User tabs ─────────────────────────────────────────────────── */}
        {users.length > 0 && (
          <div className="mx-auto max-w-5xl px-4 pt-4 w-full">
            <UserTabs users={users} activeUserId={active?.id ?? null} />
          </div>
        )}

        {/* ── Page content ──────────────────────────────────────────────── */}
        {/* pb-20 on mobile so content clears the 56px bottom nav bar */}
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:pb-8">
          {children}
        </main>

      </body>
    </html>
  );
}
