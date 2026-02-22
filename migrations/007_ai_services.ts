import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ai_services', (table) => {
    table.string('id').primary(); // user-defined identifier
    table.string('name').notNullable(); // display name
    table.string('api_url').notNullable(); // API endpoint URL
    table.string('api_key').notNullable(); // API key / bearer token
    table.string('model').notNullable().defaultTo(''); // model identifier
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Store default AI prompt template as a simple key-value setting
  await knex.schema.createTable('app_settings', (table) => {
    table.string('key').primary();
    table.text('value').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_services');
  await knex.schema.dropTableIfExists('app_settings');
}
