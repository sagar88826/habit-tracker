import type { Command } from 'commander';
import { createFineRule, getWeeklyFines, getMonthlyFines } from '../services/fineService';
import { getUser } from '../services/userService';
import { getActivity } from '../services/activityService';
import { formatMoney, toDateStr, getWeekBounds, getWeekLabel } from '../utils/dateUtils';

export function registerFineCommands(program: Command): void {
  program
    .command('add-fine-rule')
    .description('Configure a fine rule for a user + activity')
    .requiredOption('--activity <id>', 'Activity ID')
    .requiredOption('--user <id>', 'User ID')
    .requiredOption('--period <week|month>', 'Enforcement period: week or month')
    .option('--limit-type <min|max>', 'Limit type: min or max (default: max)', 'max')
    .requiredOption('--limit <num>', 'Max allowed value before fine kicks in')
    .requiredOption('--type <flat|per_unit>', 'Fine type: flat or per_unit')
    .requiredOption('--amount <num>', 'Fine amount in Rupees (e.g. 5 = ₹5.00)')
    .action(async opts => {
      try {
        if (opts.period !== 'week' && opts.period !== 'month') throw new Error('--period must be "week" or "month"');
        if (opts.limitType !== 'min' && opts.limitType !== 'max') throw new Error('--limit-type must be "min" or "max"');
        if (opts.type !== 'flat' && opts.type !== 'per_unit') throw new Error('--type must be "flat" or "per_unit"');
        await getUser(opts.user);
        await getActivity(opts.activity);
        const cents = Math.round(parseFloat(opts.amount) * 100);
        const rule  = await createFineRule(opts.activity, opts.user, opts.period as 'week' | 'month', opts.limitType as 'min' | 'max', parseFloat(opts.limit), opts.type as 'flat' | 'per_unit', cents);
        console.log('Fine rule created:');
        console.log(JSON.stringify({ ...rule, fineAmount: formatMoney(rule.fineAmount) }, null, 2));
      } catch (err) { console.error('Error:', (err as Error).message); process.exit(1); }
    });

  program
    .command('get-fines')
    .description('Get fines for a user in a given week or month')
    .requiredOption('--user <id>', 'User ID')
    .requiredOption('--date <YYYY-MM-DD>', 'Any date within the target period')
    .option('--period <week|month>', 'Period type (default: week)', 'week')
    .action(async opts => {
      try {
        const user = await getUser(opts.user);
        const date = new Date(opts.date + 'T00:00:00Z');
        let fines; let label: string;
        if (opts.period === 'month') {
          fines = await getMonthlyFines(opts.user, date.getUTCFullYear(), date.getUTCMonth() + 1);
          label = `Monthly fines for ${user.name} (${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')})`;
        } else {
          fines = await getWeeklyFines(opts.user, opts.date, user.weekStartDay ?? 1);
          const { start } = getWeekBounds(date, user.weekStartDay ?? 1);
          label = `Weekly fines for ${user.name} (${getWeekLabel(start)})`;
        }
        console.log(`\n── ${label} ──`);
        if (fines.length === 0) { console.log('  No fines. ✓'); return; }
        let total = 0;
        console.log(`${'Activity'.padEnd(24)}  ${'Limit'.padStart(8)}  ${'Actual'.padStart(8)}  ${'Over'.padStart(8)}  ${'Fine'.padStart(10)}`);
        console.log('-'.repeat(70));
        for (const f of fines) {
          let name = f.activityId;
          try { name = (await getActivity(f.activityId)).name; } catch { /* archived */ }
          console.log(`${name.padEnd(24)}  ${String(f.limit).padStart(8)}  ${String(f.actual).padStart(8)}  ${String(f.overage).padStart(8)}  ${formatMoney(f.totalFine).padStart(10)}`);
          total += f.totalFine;
        }
        console.log('-'.repeat(70));
        console.log(`${'TOTAL'.padEnd(60)}  ${formatMoney(total).padStart(10)}`);
      } catch (err) { console.error('Error:', (err as Error).message); process.exit(1); }
    });
}
