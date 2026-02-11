import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { CreatePostSchema, UpdatePostSchema } from '../schemas/post';
import { getAvailablePlatforms, getPlatformService } from '../platforms/registry';
import { deleteFile } from '../storage/local';

export const postsRouter = Router();

// List all posts
postsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const posts = await db('posts').orderBy('scheduled_at_utc', 'desc');

    const postsWithTargets = await Promise.all(
      posts.map(async (post: any) => {
        const targets = await db('post_platform_targets').where('post_id', post.id);
        const media = await db('media_assets').where('post_id', post.id);
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
    const media = await db('media_assets').where('post_id', post.id);

    res.json({ ...post, platform_targets: targets, media });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create post
postsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreatePostSchema.parse(req.body);
    const availablePlatforms = getAvailablePlatforms();

    // Validate all target platforms are available
    for (const target of data.platform_targets) {
      if (!availablePlatforms.includes(target.platform)) {
        res.status(400).json({
          error: `Platform '${target.platform}' is not available. Available: ${availablePlatforms.join(', ')}`,
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
    });

    const post = await db('posts').where('id', postId).first();
    const targets = await db('post_platform_targets').where('post_id', postId);
    const media = await db('media_assets').where('post_id', postId);

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
    });

    const updated = await db('posts').where('id', req.params.id).first();
    const targets = await db('post_platform_targets').where('post_id', req.params.id);
    const media = await db('media_assets').where('post_id', req.params.id);

    res.json({ ...updated, platform_targets: targets, media });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete post
postsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const post = await db('posts').where('id', req.params.id).first();

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Delete associated media files
    const mediaAssets = await db('media_assets').where('post_id', req.params.id);
    for (const asset of mediaAssets) {
      deleteFile(asset.storage_path);
    }

    // Cascade deletes handle DB cleanup
    await db('posts').where('id', req.params.id).delete();

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
