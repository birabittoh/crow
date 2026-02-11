import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create the join table for many-to-many post <-> media relationship
  await knex.schema.createTable('post_media', (table) => {
    table.uuid('id').primary();
    table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
    table.uuid('media_asset_id').notNullable().references('id').inTable('media_assets').onDelete('CASCADE');
    table.integer('sort_order').notNullable().defaultTo(0);

    table.index(['post_id', 'media_asset_id']);
  });

  // Migrate existing media_assets rows into post_media links
  const existingMedia = await knex('media_assets').whereNotNull('post_id').select('id', 'post_id');
  for (const row of existingMedia) {
    await knex('post_media').insert({
      id: knex.raw("(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))"),
      post_id: row.post_id,
      media_asset_id: row.id,
      sort_order: 0,
    });
  }

  // Add new columns to media_assets
  await knex.schema.alterTable('media_assets', (table) => {
    table.string('file_hash').nullable();
    table.string('original_filename').nullable();
  });

  // Drop NOT NULL on post_id by recreating the column
  // SQLite doesn't support ALTER COLUMN, so we need a workaround
  // We'll keep post_id but stop enforcing it at the app level
  // For PostgreSQL, we can do it properly
  const client = knex.client.config.client;
  if (client === 'pg' || client === 'postgresql') {
    await knex.schema.alterTable('media_assets', (table) => {
      table.uuid('post_id').nullable().alter();
    });
  }
  // For SQLite, we can't easily alter column nullability, but SQLite doesn't
  // enforce FK NOT NULL strictly anyway. We'll handle it at the app level.

  // Add index on file_hash for dedup lookups
  await knex.schema.alterTable('media_assets', (table) => {
    table.index('file_hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('media_assets', (table) => {
    table.dropIndex('file_hash');
    table.dropColumn('file_hash');
    table.dropColumn('original_filename');
  });

  await knex.schema.dropTableIfExists('post_media');
}
