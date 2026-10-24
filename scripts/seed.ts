/**
 * Creates the demo destination catalogue using the configured database.
 * Seeding is idempotent and is refused outside simulation mode.
 */
import knex = require('../src/db/knex');
import config = require('../src/config');
import { runMigrations } from '../src/db/migrate';
import { seedDemoDestinations } from '../src/modules/seed/demo';

async function main(): Promise<void> {
  try {
    await runMigrations(knex);
    if (!config.SIMULATION_MODE) {
      process.stdout.write('Demo seed skipped: SIMULATION_MODE is disabled.\n');
      return;
    }
    const count = await seedDemoDestinations(
      knex,
      config,
      `http://127.0.0.1:${config.PORT}/mock`
    );
    process.stdout.write(`Demo destinations seeded: ${count}.\n`);
  } finally {
    await knex.destroy();
  }
}

if (require.main === module) {
  main().catch((error: any) => {
    process.stderr.write(`Demo seed failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
