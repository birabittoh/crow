import db from "@/db";
import { v4 as uuidv4 } from "uuid";

export interface Post {
  id: string;
  content: string;
  scheduled_at: string;
  published_at?: string | null;
  status: "pending" | "published" | "failed" | "partial";
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  platforms?: PostPlatform[];
}

export interface PostPlatform {
  id: string;
  post_id: string;
  platform: string;
  override_content?: string | null;
  metadata?: any;
  status: "pending" | "published" | "failed";
  error_message?: string | null;
  published_at?: string | null;
}

export async function getPosts(startDate: string, endDate: string): Promise<Post[]> {
  const posts = await db("posts")
    .whereBetween("scheduled_at", [startDate, endDate])
    .orderBy("scheduled_at", "asc");

  const postIds = posts.map((p) => p.id);
  const platforms = await db("post_platforms").whereIn("post_id", postIds);

  return posts.map((post) => ({
    ...post,
    platforms: platforms.filter((p) => p.post_id === post.id),
  }));
}

export async function getPostById(id: string): Promise<Post | null> {
  const post = await db("posts").where({ id }).first();
  if (!post) return null;

  const platforms = await db("post_platforms").where({ post_id: id });
  return { ...post, platforms };
}

export async function createPost(data: {
  content: string;
  scheduled_at: string;
  platforms: { platform: string; override_content?: string }[];
}): Promise<Post> {
  const postId = uuidv4();

  await db.transaction(async (trx) => {
    await trx("posts").insert({
      id: postId,
      content: data.content,
      scheduled_at: data.scheduled_at,
      status: "pending",
    });

    if (data.platforms.length > 0) {
      await trx("post_platforms").insert(
        data.platforms.map((p) => ({
          id: uuidv4(),
          post_id: postId,
          platform: p.platform,
          override_content: p.override_content || null,
          status: "pending",
        }))
      );
    }
  });

  return (await getPostById(postId))!;
}

export async function updatePost(
  id: string,
  data: {
    content?: string;
    scheduled_at?: string;
    platforms?: { platform: string; override_content?: string }[];
  }
): Promise<Post | null> {
  await db.transaction(async (trx) => {
    if (data.content !== undefined || data.scheduled_at !== undefined) {
      await trx("posts")
        .where({ id })
        .update({
          ...(data.content !== undefined && { content: data.content }),
          ...(data.scheduled_at !== undefined && { scheduled_at: data.scheduled_at }),
          updated_at: db.fn.now(),
        });
    }

    if (data.platforms !== undefined) {
      // For simplicity, replace all platforms
      await trx("post_platforms").where({ post_id: id }).delete();
      if (data.platforms.length > 0) {
        await trx("post_platforms").insert(
          data.platforms.map((p) => ({
            id: uuidv4(),
            post_id: id,
            platform: p.platform,
            override_content: p.override_content || null,
            status: "pending",
          }))
        );
      }
    }
  });

  return getPostById(id);
}

export async function deletePost(id: string): Promise<boolean> {
  const deletedCount = await db("posts").where({ id }).delete();
  return deletedCount > 0;
}
