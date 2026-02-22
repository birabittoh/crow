import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ai_services', (table) => {
    // 'openai' = OpenAI-compatible chat completions API
    // 'gemini' = Google Gemini native API
    table.string('type').notNullable().defaultTo('openai');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ai_services', (table) => {
    table.dropColumn('type');
  });
}
