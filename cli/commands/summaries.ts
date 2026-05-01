import type { Command } from 'commander';
import type { Summary } from '../db/schema';
import { getDailySummary, getWeeklySummary, getMonthlySummary } from '../services/summaryService';
import { getActivity } from '../services/activityService';
import { getUser } from '../services/userService';
import { toDateStr, getWeekBounds, getWeekLabel } from '../utils/dateUtils';

async function printSummaryTable(summaries: Summary[], label: string): Promise<void> {
  console.log(`\n── ${label} ──`);
  if (summaries.length === 0) { console.log('  No data.'); return; }
  console.log(`${'Activity'.padEnd(24)}  ${'Total'.padStart(8)}  ${'Entries'.padStart(8)}  Complete`);
  console.log('-'.repeat(60));
  for (const s of summaries) {
    let name = s.activityId;
    try { name = (await getActivity(s.activityId)).name; } catch { /* archived */ }
    console.log(`${name.padEnd(24)}  ${String(s.totalValue).padStart(8)}  ${String(s.totalEntries).padStart(8)}  ${s.isComplete ? '✓' : '✗'}`);
  }
}

export function registerSummaryCommands(program: Command): void {
  program
    .command('get-daily-summary')
    .description('Get daily activity summary for a user')
    .requiredOption('--user <id>', 'User ID')
    .requiredOption('--date <YYYY-MM-DD>', 'Date')
    .action(async opts => {
      try {
        const user = await getUser(opts.user);
        const data = await getDailySummary(opts.user, opts.date);
        await printSummaryTable(data, `Daily summary for ${user.name} on ${opts.date}`);
      } catch (err) { console.error('Error:', (err as Error).message); process.exit(1); }
    });

  program
    .command('get-weekly-summary')
    .description('Get weekly activity summary for a user')
    .requiredOption('--user <id>', 'User ID')
    .requiredOption('--date <YYYY-MM-DD>', 'Any date within the target week')
    .action(async opts => {
      try {
        const user = await getUser(opts.user);
        const { start } = getWeekBounds(new Date(opts.date + 'T00:00:00Z'), user.weekStartDay ?? 1);
        const data = await getWeeklySummary(opts.user, toDateStr(start), user.weekStartDay ?? 1);
        await printSummaryTable(data, `Weekly summary for ${user.name} (${getWeekLabel(start)})`);
      } catch (err) { console.error('Error:', (err as Error).message); process.exit(1); }
    });

  program
    .command('get-monthly-summary')
    .description('Get monthly activity summary for a user')
    .requiredOption('--user <id>', 'User ID')
    .requiredOption('--year <num>', 'Year, e.g. 2026')
    .requiredOption('--month <num>', 'Month number 1–12')
    .action(async opts => {
      try {
        const user = await getUser(opts.user);
        const data = await getMonthlySummary(opts.user, parseInt(opts.year, 10), parseInt(opts.month, 10));
        await printSummaryTable(data, `Monthly summary for ${user.name} (${opts.year}-${String(opts.month).padStart(2, '0')})`);
      } catch (err) { console.error('Error:', (err as Error).message); process.exit(1); }
    });
}
