import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const client = knex.client.config.client;

  if (client === 'pg') {
    // PostgreSQL: add value to existing enum type
    // Knex creates enums as check constraints by default, so we alter the check constraint
    await knex.raw(`
      ALTER TABLE post_platform_targets
      DROP CONSTRAINT IF EXISTS post_platform_targets_platform_check
    `);
    await knex.raw(`
      ALTER TABLE post_platform_targets
      ADD CONSTRAINT post_platform_targets_platform_check
      CHECK (platform IN ('twitter', 'telegram', 'instagram'))
    `);
  }
  // SQLite: enum columns are stored as text with no constraint, so no migration needed.
}

export async function down(knex: Knex): Promise<void> {
  const client = knex.client.config.client;

  if (client === 'pg') {
    await knex.raw(`
      ALTER TABLE post_platform_targets
      DROP CONSTRAINT IF EXISTS post_platform_targets_platform_check
    `);
    await knex.raw(`
      ALTER TABLE post_platform_targets
      ADD CONSTRAINT post_platform_targets_platform_check
      CHECK (platform IN ('twitter', 'telegram'))
    `);
  }
}
