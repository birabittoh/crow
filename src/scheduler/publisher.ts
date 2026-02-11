import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { getPlatformService } from '../platforms/registry';
import { PublishContent } from '../platforms/platform-service';
import { Platform } from '../schemas/platform-target';
import { MediaAsset } from '../schemas/media';
import { config } from '../config';

interface PostWithTargets {
  id: string;
  base_content: string;
  scheduled_at_utc: string;
}

function resolveContent(
  baseContent: string,
  baseMedia: MediaAsset[],
  target: any
): PublishContent {
  const text = target.override_content || baseContent;

  let media = baseMedia;
  if (target.override_media_json) {
    try {
      const overrideMedia = JSON.parse(target.override_media_json);
      // If override media is specified, we'd need to look up those assets
      // For now, use base media if override parsing fails
      if (Array.isArray(overrideMedia) && overrideMedia.length > 0) {
        // Override media references media_asset_ids - would need DB lookup
        // Simplified: use base media
        media = baseMedia;
      }
    } catch {
      media = baseMedia;
    }
  }

  let options: Record<string, unknown> = {};
  if (target.override_options_json) {
    try {
      options = JSON.parse(target.override_options_json);
    } catch {
      options = {};
    }
  }

  return { text, media, options };
}

async function publishToTarget(
  post: PostWithTargets,
  target: any,
  baseMedia: MediaAsset[]
): Promise<{ success: boolean; remotePostId?: string; error?: string; errorCode?: string }> {
  const platform: Platform = target.platform;
  const service = getPlatformService(platform);

  if (!service) {
    return { success: false, error: `Platform ${platform} is not available`, errorCode: 'PLATFORM_UNAVAILABLE' };
  }

  const content = resolveContent(post.base_content, baseMedia, target);

  // Validate before publishing
  const validationErrors = service.validatePost(content);
  if (validationErrors.length > 0) {
    const msg = validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ');
    return { success: false, error: msg, errorCode: 'VALIDATION_FAILED' };
  }

  try {
    // Upload media
    const uploadedMediaIds: string[] = [];
    for (const asset of content.media) {
      const mediaId = await service.uploadMedia(asset);
      uploadedMediaIds.push(mediaId);
    }

    // Publish
    const result = await service.publishPost(content, uploadedMediaIds);
    return { success: true, remotePostId: result.remotePostId };
  } catch (error) {
    const mapped = service.mapError(error);
    return { success: false, error: mapped.message, errorCode: mapped.code };
  }
}

export async function publishPost(postId: string): Promise<void> {
  const targets = await db('post_platform_targets')
    .where('post_id', postId)
    .whereIn('publish_status', ['pending', 'failed']);

  const baseMedia: MediaAsset[] = await db('media_assets').where('post_id', postId);

  const post = await db('posts').where('id', postId).first();
  if (!post) return;

  let successCount = 0;
  let failCount = 0;

  for (const target of targets) {
    // Check retry count
    const attemptCount = await db('publish_attempts')
      .where('post_platform_target_id', target.id)
      .count('id as count')
      .first();

    const attempts = Number(attemptCount?.count || 0);
    if (attempts >= config.schedulerMaxRetries && target.publish_status === 'failed') {
      failCount++;
      continue;
    }

    // Mark target as publishing
    await db('post_platform_targets')
      .where('id', target.id)
      .update({
        publish_status: 'publishing',
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    const result = await publishToTarget(post, target, baseMedia);

    // Record attempt
    await db('publish_attempts').insert({
      id: uuidv4(),
      post_platform_target_id: target.id,
      attempted_at: new Date().toISOString(),
      success: result.success,
      error_message: result.error || null,
      error_code: result.errorCode || null,
    });

    if (result.success) {
      await db('post_platform_targets')
        .where('id', target.id)
        .update({
          publish_status: 'published',
          remote_post_id: result.remotePostId || null,
          updated_at: new Date().toISOString(),
        });
      successCount++;
    } else {
      await db('post_platform_targets')
        .where('id', target.id)
        .update({
          publish_status: 'failed',
          failure_reason: result.error || 'Unknown error',
          updated_at: new Date().toISOString(),
        });
      failCount++;
    }
  }

  // Determine overall post status
  const allTargets = await db('post_platform_targets').where('post_id', postId);
  const allPublished = allTargets.every((t: any) => t.publish_status === 'published');
  const allFailed = allTargets.every((t: any) => t.publish_status === 'failed');

  let postStatus: string;
  if (allPublished) {
    postStatus = 'published';
  } else if (allFailed) {
    postStatus = 'failed';
  } else {
    postStatus = 'partially_published';
  }

  await db('posts')
    .where('id', postId)
    .update({ status: postStatus, updated_at: new Date().toISOString() });
}
