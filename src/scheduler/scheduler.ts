import { db } from '../db';
import { config } from '../config';
import { publishPost } from './publisher';

let intervalHandle: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Atomically claim due posts by updating status from 'scheduled' to 'publishing'
    // Also pick up 'partially_published' posts for retry
    const duePosts = await db('posts')
      .whereIn('status', ['scheduled', 'partially_published'])
      .where('scheduled_at_utc', '<=', now)
      .select('id');

    for (const post of duePosts) {
      // Atomic claim: only proceed if we can transition the status
      const updated = await db('posts')
        .where('id', post.id)
        .whereIn('status', ['scheduled', 'partially_published'])
        .update({ status: 'publishing', updated_at: new Date().toISOString() });

      if (updated > 0) {
        try {
          await publishPost(post.id);
        } catch (error) {
          console.error(`Failed to publish post ${post.id}:`, error);
          await db('posts')
            .where('id', post.id)
            .update({ status: 'failed', updated_at: new Date().toISOString() });
        }
      }
    }
  } catch (error) {
    console.error('Scheduler tick error:', error);
  }
}

export function startScheduler(): void {
  if (intervalHandle) return;

  console.log(`Scheduler started (poll interval: ${config.schedulerPollIntervalMs}ms)`);
  intervalHandle = setInterval(tick, config.schedulerPollIntervalMs);

  // Run immediately on start
  tick();
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('Scheduler stopped');
  }
}
