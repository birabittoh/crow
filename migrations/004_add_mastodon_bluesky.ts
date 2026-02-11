import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const client = knex.client.config.client;

  if (client === 'pg') {
    await knex.raw(`
      ALTER TABLE post_platform_targets
      DROP CONSTRAINT IF EXISTS post_platform_targets_platform_check
    `);
    await knex.raw(`
      ALTER TABLE post_platform_targets
      ADD CONSTRAINT post_platform_targets_platform_check
      CHECK (platform IN ('twitter', 'telegram', 'instagram', 'facebook', 'mastodon', 'bluesky'))
    `);
  }
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
      CHECK (platform IN ('twitter', 'telegram', 'instagram', 'facebook'))
    `);
  }
}
