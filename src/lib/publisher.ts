import db from "@/db";
import { getPlatform } from "@/integrations";

export async function processScheduledPosts() {
  const now = new Date().toISOString();

  // Find posts that are scheduled for now or in the past and are still pending or partial
  const posts = await db("posts")
    .where("scheduled_at", "<=", now)
    .whereIn("status", ["pending", "partial"]);

  for (const post of posts) {
    await publishPost(post.id);
  }
}

export async function publishPost(postId: string) {
  const post = await db("posts").where({ id: postId }).first();
  if (!post) return;

  const platforms = await db("post_platforms")
    .where({ post_id: postId })
    .where("status", "pending");

  let successCount = 0;
  let failCount = 0;

  for (const pp of platforms) {
    const integration = getPlatform(pp.platform);
    if (!integration) {
      await db("post_platforms")
        .where({ id: pp.id })
        .update({
          status: "failed",
          error_message: "Platform integration not found or disabled",
          updated_at: db.fn.now(),
        });
      failCount++;
      continue;
    }

    const content = pp.override_content || post.content;
    const result = await integration.publish(content);

    if (result.success) {
      await db("post_platforms")
        .where({ id: pp.id })
        .update({
          status: "published",
          platform_post_id: result.platformPostId,
          metadata: result.metadata ? JSON.stringify(result.metadata) : null,
          published_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
      successCount++;
    } else {
      await db("post_platforms")
        .where({ id: pp.id })
        .update({
          status: "failed",
          error_message: result.errorMessage,
          updated_at: db.fn.now(),
        });
      failCount++;
    }
  }

  // Update main post status
  const allPlatforms = await db("post_platforms").where({ post_id: postId });
  const allFinished = allPlatforms.every(p => p.status !== "pending");
  const anySuccess = allPlatforms.some(p => p.status === "published");
  const anyFailed = allPlatforms.some(p => p.status === "failed");

  let status = post.status;
  if (allFinished) {
    if (anySuccess && !anyFailed) status = "published";
    else if (anySuccess && anyFailed) status = "partial";
    else status = "failed";
  } else if (anySuccess || anyFailed) {
    status = "partial";
  }

  await db("posts")
    .where({ id: postId })
    .update({
      status,
      published_at: status === "published" ? db.fn.now() : post.published_at,
      error_message: anyFailed ? "Some or all platforms failed to publish" : null,
      updated_at: db.fn.now(),
    });
}
