import type { Command } from 'commander';
import { getPersonalKPI, compareUsers } from '../services/kpiService';
import { getUser } from '../services/userService';
import { getWeekLabel } from '../utils/dateUtils';

const TREND_ICON: Record<string, string> = {
  improved:  '↑ improved',
  declined:  '↓ declined',
  same:      '→ same',
  'no-data': '— no data',
};

export function registerKPICommands(program: Command): void {
  program
    .command('get-kpi')
    .description('Personal week-over-week KPI for a user')
    .requiredOption('--user <id>', 'User ID')
    .requiredOption('--date <YYYY-MM-DD>', 'Any date within the target week')
    .action(async opts => {
      try {
        const user = await getUser(opts.user);
        const kpi = await getPersonalKPI(opts.user, opts.date);
        const weekDate = new Date(kpi.weekStart + 'T00:00:00Z');
        console.log(`\n── Personal KPI for ${user.name} (${getWeekLabel(weekDate)}) ──\n`);
        console.log(`Overall trend: ${TREND_ICON[kpi.overallTrend]}\n`);
        if (kpi.activities.length === 0) { console.log('  No data for this week.'); return; }
        console.log(`${'Activity'.padEnd(24)}  ${'This week'.padStart(10)}  ${'Last week'.padStart(10)}  Trend`);
        console.log('-'.repeat(70));
        kpi.activities.forEach(a => {
          const prev = a.prevWeek !== null ? String(a.prevWeek) : 'N/A';
          console.log(`${a.activityName.padEnd(24)}  ${String(a.thisWeek).padStart(10)}  ${prev.padStart(10)}  ${TREND_ICON[a.trend]}  ${a.isComplete ? '' : '[MISSING]'}`);
        });
      } catch (err) { console.error('Error:', (err as Error).message); process.exit(1); }
    });

  program
    .command('compare-users')
    .description('Head-to-head KPI comparison between two users (shared activities only)')
    .requiredOption('--user1 <id>', 'First user ID')
    .requiredOption('--user2 <id>', 'Second user ID')
    .requiredOption('--date <YYYY-MM-DD>', 'Any date within the target week')
    .action(async opts => {
      try {
        const u1 = await getUser(opts.user1);
        const u2 = await getUser(opts.user2);
        const result = await compareUsers(opts.user1, opts.user2, opts.date);
        const weekDate = new Date(result.weekStart + 'T00:00:00Z');
        console.log(`\n── Comparison: ${u1.name} vs ${u2.name} (${getWeekLabel(weekDate)}) ──\n`);
        if (result.rows.length === 0) { console.log('  No shared comparable activities found.'); return; }
        const col = 14;
        console.log(`${'Activity'.padEnd(24)}  ${u1.name.padStart(col)}  ${u2.name.padStart(col)}  Winner`);
        console.log('-'.repeat(80));
        result.rows.forEach(row => {
          const v1 = String(row.values[opts.user1] ?? 0).padStart(col);
          const v2 = String(row.values[opts.user2] ?? 0).padStart(col);
          let label = row.winner;
          if (row.winner === opts.user1) label = result.user1;
          else if (row.winner === opts.user2) label = result.user2;
          console.log(`${row.activityName.padEnd(24)}  ${v1}  ${v2}  ${label}`);
        });
      } catch (err) { console.error('Error:', (err as Error).message); process.exit(1); }
    });
}
