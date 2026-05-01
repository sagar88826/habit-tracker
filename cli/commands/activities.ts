import type { Command } from 'commander';
import { createActivity, archiveActivity, listActivities } from '../services/activityService';
import { assignActivity } from '../services/subscriptionService';
import { getUser } from '../services/userService';

export function registerActivityCommands(program: Command): void {
  program
    .command('create-activity')
    .description('Create a new activity')
    .requiredOption('--owner <userId>', 'Owner user ID')
    .requiredOption('--name <name>', 'Activity name (unique per user)')
    .requiredOption('--type <type>', 'Activity type: count | boolean')
    .option('--description <desc>', 'Optional description')
    .action(async opts => {
      try {
        if (opts.type !== 'count' && opts.type !== 'boolean')
          throw new Error('--type must be "count" or "boolean"');
        await getUser(opts.owner);
        const activity = await createActivity(opts.owner, opts.name, opts.type as 'count' | 'boolean', opts.description);
        console.log('Activity created:');
        console.log(JSON.stringify(activity, null, 2));
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('assign-activity')
    .description('Assign an activity to a user with permissions')
    .requiredOption('--activity <id>', 'Activity ID')
    .requiredOption('--user <id>', 'User ID')
    .option('--can-log',     'Allow this user to log entries', false)
    .option('--can-view',    'Allow this user to view summaries', false)
    .option('--can-compare', 'Include in comparison KPI', false)
    .option('--mandatory',   'Flag missing entries as incomplete', false)
    .action(async opts => {
      try {
        await getUser(opts.user);
        const sub = await assignActivity(opts.activity, opts.user, {
          canLog: opts.canLog, canView: opts.canView, canCompare: opts.canCompare, mandatory: opts.mandatory,
        });
        console.log('Activity assigned:');
        console.log(JSON.stringify(sub, null, 2));
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('archive-activity')
    .description('Soft-delete an activity (historical data preserved)')
    .requiredOption('--activity <id>', 'Activity ID')
    .action(async opts => {
      try {
        const activity = await archiveActivity(opts.activity);
        console.log(`Activity "${activity.name}" archived.`);
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('list-activities')
    .description('List active activities')
    .option('--owner <userId>', 'Filter by owner user ID')
    .action(async opts => {
      try {
        const activities = await listActivities(opts.owner);
        if (activities.length === 0) { console.log('No active activities found.'); return; }
        console.log(`\n${'ID'.padEnd(38)}  ${'Name'.padEnd(20)}  ${'Type'.padEnd(10)}  Owner`);
        console.log('-'.repeat(100));
        activities.forEach(a => console.log(`${a.id.padEnd(38)}  ${a.name.padEnd(20)}  ${a.type.padEnd(10)}  ${a.ownerId}`));
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });
}
