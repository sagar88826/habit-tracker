import type { Command } from 'commander';
import { addEntry, editEntry, deleteEntry } from '../services/entryService';
import { recalculate } from '../services/summaryService';
import { getUser } from '../services/userService';

function parseValue(raw: string): number | boolean {
  if (raw === 'true')  return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (isNaN(n)) throw new Error(`Invalid value "${raw}". Use a non-negative integer or true/false.`);
  return n;
}

export function registerEntryCommands(program: Command): void {
  program
    .command('add-entry')
    .description('Log an activity entry for a user')
    .requiredOption('--user <id>', 'User ID')
    .requiredOption('--activity <id>', 'Activity ID')
    .requiredOption('--date <YYYY-MM-DD>', 'Date of the entry')
    .requiredOption('--value <val>', 'Value: integer (count) or true/false (boolean)')
    .option('--notes <text>', 'Optional notes')
    .action(async opts => {
      try {
        const value = parseValue(opts.value);
        const user  = await getUser(opts.user);
        const { entry, affectedDate } = await addEntry(opts.user, opts.activity, opts.date, value, opts.notes);
        await recalculate(opts.user, opts.activity, affectedDate, user.weekStartDay ?? 1);
        console.log('Entry added:');
        console.log(JSON.stringify(entry, null, 2));
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('edit-entry')
    .description('Edit an existing entry')
    .requiredOption('--entry <id>', 'Entry ID')
    .option('--value <val>', 'New value')
    .option('--notes <text>', 'New notes')
    .action(async opts => {
      try {
        const value = opts.value !== undefined ? parseValue(opts.value) : undefined;
        const { entry, affectedDate } = await editEntry(opts.entry, value, opts.notes);
        const user = await getUser(entry.userId);
        await recalculate(entry.userId, entry.activityId, affectedDate, user.weekStartDay ?? 1);
        console.log('Entry updated:');
        console.log(JSON.stringify(entry, null, 2));
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('delete-entry')
    .description('Delete an entry and recalculate affected summaries')
    .requiredOption('--entry <id>', 'Entry ID')
    .action(async opts => {
      try {
        const { userId, activityId, affectedDate } = await deleteEntry(opts.entry);
        const user = await getUser(userId);
        await recalculate(userId, activityId, affectedDate, user.weekStartDay ?? 1);
        console.log(`Entry "${opts.entry}" deleted and summaries recalculated.`);
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });
}
