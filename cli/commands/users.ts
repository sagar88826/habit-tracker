import type { Command } from 'commander';
import { createUser, listUsers } from '../services/userService';

export function registerUserCommands(program: Command): void {
  program
    .command('create-user')
    .description('Create a new user')
    .requiredOption('--name <name>', 'Display name')
    .requiredOption('--email <email>', 'Email address (unique)')
    .requiredOption('--timezone <tz>', 'IANA timezone, e.g. "Asia/Kolkata"')
    .option('--week-start <day>', 'Week start day: 0=Sunday, 1=Monday (default: 1)', '1')
    .action(async opts => {
      try {
        const user = await createUser(opts.name, opts.email, opts.timezone, parseInt(opts.weekStart, 10));
        console.log('User created:');
        console.log(JSON.stringify(user, null, 2));
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('list-users')
    .description('List all users')
    .action(async () => {
      try {
        const users = await listUsers();
        if (users.length === 0) { console.log('No users found.'); return; }
        console.log(`\n${'ID'.padEnd(38)}  ${'Name'.padEnd(20)}  ${'Email'.padEnd(30)}  Timezone`);
        console.log('-'.repeat(110));
        users.forEach(u => console.log(`${u.id.padEnd(38)}  ${u.name.padEnd(20)}  ${u.email.padEnd(30)}  ${u.timezone}`));
        console.log(`\nTotal: ${users.length} user(s)`);
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });
}
