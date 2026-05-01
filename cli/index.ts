#!/usr/bin/env bun
import { Command } from 'commander';
import { registerUserCommands } from './commands/users';
import { registerActivityCommands } from './commands/activities';
import { registerEntryCommands } from './commands/entries';
import { registerSummaryCommands } from './commands/summaries';
import { registerKPICommands } from './commands/kpi';
import { registerFineCommands } from './commands/fines';

const program = new Command();

program
  .name('habit-tracker')
  .description('Multi-user habit, activity, KPI, and penalty tracker')
  .version('0.1.0');

registerUserCommands(program);
registerActivityCommands(program);
registerEntryCommands(program);
registerSummaryCommands(program);
registerKPICommands(program);
registerFineCommands(program);

program.parse(process.argv);
