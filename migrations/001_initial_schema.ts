import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('posts', (table) => {
    table.uuid('id').primary();
    table.text('base_content').notNullable();
    table.timestamp('scheduled_at_utc').notNullable();
    table
      .enum('status', ['scheduled', 'publishing', 'partially_published', 'published', 'failed'])
      .notNullable()
      .defaultTo('scheduled');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index('scheduled_at_utc');
    table.index('status');
  });

  await knex.schema.createTable('media_assets', (table) => {
    table.uuid('id').primary();
    table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
    table.enum('type', ['image', 'video']).notNullable();
    table.string('storage_path').notNullable();
    table.string('mime_type').notNullable();
    table.integer('size_bytes').notNullable();
    table.float('duration_seconds').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('post_id');
  });

  await knex.schema.createTable('post_platform_targets', (table) => {
    table.uuid('id').primary();
    table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
    table.enum('platform', ['twitter', 'telegram']).notNullable();
    table.text('override_content').nullable();
    table.json('override_media_json').nullable();
    table.json('override_options_json').nullable();
    table
      .enum('publish_status', ['pending', 'publishing', 'published', 'failed'])
      .notNullable()
      .defaultTo('pending');
    table.string('remote_post_id').nullable();
    table.text('failure_reason').nullable();
    table.timestamp('last_attempt_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['post_id', 'platform']);
  });

  await knex.schema.createTable('publish_attempts', (table) => {
    table.uuid('id').primary();
    table
      .uuid('post_platform_target_id')
      .notNullable()
      .references('id')
      .inTable('post_platform_targets')
      .onDelete('CASCADE');
    table.timestamp('attempted_at').notNullable().defaultTo(knex.fn.now());
    table.boolean('success').notNullable();
    table.text('error_message').nullable();
    table.string('error_code').nullable();

    table.index('post_platform_target_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('publish_attempts');
  await knex.schema.dropTableIfExists('post_platform_targets');
  await knex.schema.dropTableIfExists('media_assets');
  await knex.schema.dropTableIfExists('posts');
}
