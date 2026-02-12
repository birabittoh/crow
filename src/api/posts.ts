import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { CreatePostSchema, UpdatePostSchema } from '../schemas/post';
import { getAvailablePlatforms } from '../platforms/registry';

export const postsRouter = Router();

async function getPostMedia(postId: string | string[]) {
  return db('media_assets')
    .join('post_media', 'media_assets.id', 'post_media.media_asset_id')
    .where('post_media.post_id', postId)
    .orderBy('post_media.sort_order', 'asc')
    .select('media_assets.*');
}

async function setPostMedia(trx: any, postId: string | string[], mediaIds: string[]) {
  await trx('post_media').where('post_id', postId).delete();
  for (let i = 0; i < mediaIds.length; i++) {
    await trx('post_media').insert({
      id: uuidv4(),
      post_id: postId,
      media_asset_id: mediaIds[i],
      sort_order: i,
    });
  }
}

// List all posts
postsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const posts = await db('posts').orderBy('scheduled_at_utc', 'desc');

    const postsWithTargets = await Promise.all(
      posts.map(async (post: any) => {
        const targets = await db('post_platform_targets').where('post_id', post.id);
        const media = await getPostMedia(post.id);
        return { ...post, platform_targets: targets, media };
      })
    );

    res.json(postsWithTargets);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single post
postsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const post = await db('posts').where('id', req.params.id).first();
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const targets = await db('post_platform_targets').where('post_id', post.id);
    const media = await getPostMedia(post.id);

    res.json({ ...post, platform_targets: targets, media });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create post
postsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreatePostSchema.parse(req.body);
    const availablePlatforms = await getAvailablePlatforms();

    // Validate all target platforms are configured
    for (const target of data.platform_targets) {
      if (!availablePlatforms.includes(target.platform)) {
        res.status(400).json({
          error: `Platform '${target.platform}' is not configured. Configured: ${availablePlatforms.join(', ') || 'none'}`,
        });
        return;
      }
    }

    const postId = uuidv4();

    await db.transaction(async (trx) => {
      await trx('posts').insert({
        id: postId,
        base_content: data.base_content,
        scheduled_at_utc: data.scheduled_at_utc,
        status: 'scheduled',
      });

      for (const target of data.platform_targets) {
        await trx('post_platform_targets').insert({
          id: uuidv4(),
          post_id: postId,
          platform: target.platform,
          override_content: target.override_content || null,
          override_media_json: target.override_media_json
            ? JSON.stringify(target.override_media_json)
            : null,
          override_options_json: target.override_options_json
            ? JSON.stringify(target.override_options_json)
            : null,
          publish_status: 'pending',
        });
      }

      // Link media assets to post
      if (data.media_ids && data.media_ids.length > 0) {
        await setPostMedia(trx, postId, data.media_ids);
      }
    });

    const post = await db('posts').where('id', postId).first();
    const targets = await db('post_platform_targets').where('post_id', postId);
    const media = await getPostMedia(postId);

    res.status(201).json({ ...post, platform_targets: targets, media });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update post
postsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = UpdatePostSchema.parse(req.body);
    const post = await db('posts').where('id', req.params.id).first();

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.status !== 'scheduled') {
      res.status(400).json({ error: 'Cannot update a post that is not in scheduled status' });
      return;
    }

    await db.transaction(async (trx) => {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.base_content !== undefined) updates.base_content = data.base_content;
      if (data.scheduled_at_utc !== undefined) updates.scheduled_at_utc = data.scheduled_at_utc;

      await trx('posts').where('id', req.params.id).update(updates);

      if (data.platform_targets) {
        await trx('post_platform_targets').where('post_id', req.params.id).delete();

        for (const target of data.platform_targets) {
          await trx('post_platform_targets').insert({
            id: uuidv4(),
            post_id: req.params.id,
            platform: target.platform,
            override_content: target.override_content || null,
            override_media_json: target.override_media_json
              ? JSON.stringify(target.override_media_json)
              : null,
            override_options_json: target.override_options_json
              ? JSON.stringify(target.override_options_json)
              : null,
            publish_status: 'pending',
          });
        }
      }

      // Update media links
      if (data.media_ids !== undefined) {
        await setPostMedia(trx, req.params.id, data.media_ids);
      }
    });

    const updated = await db('posts').where('id', req.params.id).first();
    const targets = await db('post_platform_targets').where('post_id', req.params.id);
    const media = await getPostMedia(req.params.id);

    res.json({ ...updated, platform_targets: targets, media });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete post (media stays in library, only links are removed)
postsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const post = await db('posts').where('id', req.params.id).first();

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Cascade deletes handle post_media and post_platform_targets cleanup
    // Media files stay in the library
    await db('posts').where('id', req.params.id).delete();

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
