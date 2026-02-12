import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('platform_credentials', (table) => {
    table.string('platform').primary(); // one row per platform
    table.text('credentials_json').notNullable(); // encrypted/stored credentials
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('platform_credentials');
}
