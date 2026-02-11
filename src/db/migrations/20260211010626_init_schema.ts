import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("posts", (table) => {
    table.uuid("id").primary();
    table.text("content").notNullable();
    table.timestamp("scheduled_at").notNullable();
    table.timestamp("published_at").nullable();
    table.enum("status", ["pending", "published", "failed", "partial"]).defaultTo("pending");
    table.text("error_message").nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable("post_platforms", (table) => {
    table.uuid("id").primary();
    table.uuid("post_id").references("id").inTable("posts").onDelete("CASCADE");
    table.string("platform").notNullable();
    table.string("platform_post_id").nullable();
    table.text("override_content").nullable();
    table.json("metadata").nullable();
    table.enum("status", ["pending", "published", "failed"]).defaultTo("pending");
    table.text("error_message").nullable();
    table.timestamp("published_at").nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("post_platforms");
  await knex.schema.dropTable("posts");
}
