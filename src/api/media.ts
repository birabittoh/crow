import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { ALL_ALLOWED_MIMES, MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES } from '../schemas/media';
import { deleteFile } from '../storage/local';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const storagePath = path.resolve(process.env.MEDIA_STORAGE_PATH || './uploads');
      cb(null, storagePath);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_VIDEO_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if ((ALL_ALLOWED_MIMES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export const mediaRouter = Router();

// Upload media to library (with dedup)
mediaRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Validate file size based on type
    const isImage = file.mimetype.startsWith('image/');
    const maxSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      deleteFile(file.path);
      res.status(400).json({ error: `File too large. Max size: ${maxSize} bytes` });
      return;
    }

    // Compute hash for deduplication
    const fileHash = await computeFileHash(file.path);

    // Check for existing file with same hash
    const existing = await db('media_assets').where('file_hash', fileHash).first();
    if (existing) {
      // Duplicate found — remove the just-uploaded file and return existing asset
      deleteFile(file.path);
      res.status(200).json(existing);
      return;
    }

    const id = uuidv4();
    const mediaType = isImage ? 'image' : 'video';

    await db('media_assets').insert({
      id,
      post_id: null,
      type: mediaType,
      storage_path: file.path,
      mime_type: file.mimetype,
      size_bytes: file.size,
      duration_seconds: null,
      file_hash: fileHash,
      original_filename: file.originalname,
    });

    const asset = await db('media_assets').where('id', id).first();
    res.status(201).json(asset);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List all media assets
mediaRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { filter } = req.query;

    let query = db('media_assets')
      .select('media_assets.*')
      .orderBy('media_assets.created_at', 'desc');

    if (filter === 'unused') {
      // Media not linked to any post
      query = query
        .leftJoin('post_media', 'media_assets.id', 'post_media.media_asset_id')
        .whereNull('post_media.id');
    } else if (filter === 'scheduled') {
      // Media linked to at least one post that is still scheduled/publishing
      query = query
        .whereExists(function () {
          this.select(db.raw(1))
            .from('post_media')
            .join('posts', 'posts.id', 'post_media.post_id')
            .whereRaw('post_media.media_asset_id = media_assets.id')
            .whereIn('posts.status', ['scheduled', 'publishing']);
        });
    } else if (filter === 'posted') {
      // Media linked to at least one post, but NOT linked to any scheduled/publishing post
      query = query
        .whereExists(function () {
          this.select(db.raw(1))
            .from('post_media')
            .whereRaw('post_media.media_asset_id = media_assets.id');
        })
        .whereNotExists(function () {
          this.select(db.raw(1))
            .from('post_media')
            .join('posts', 'posts.id', 'post_media.post_id')
            .whereRaw('post_media.media_asset_id = media_assets.id')
            .whereIn('posts.status', ['scheduled', 'publishing']);
        });
    }

    const assets = await query;

    // Add usage count
    const assetsWithUsage = await Promise.all(
      assets.map(async (asset: any) => {
        const usage = await db('post_media')
          .where('media_asset_id', asset.id)
          .count('id as count')
          .first();
        return { ...asset, usage_count: Number(usage?.count || 0) };
      })
    );

    res.json(assetsWithUsage);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Bulk delete media assets (POST because DELETE with body is unreliable)
mediaRouter.post('/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }

    const assets = await db('media_assets').whereIn('id', ids);
    for (const asset of assets) {
      deleteFile(asset.storage_path);
    }

    await db('media_assets').whereIn('id', ids).delete();

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete single media asset
mediaRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const asset = await db('media_assets').where('id', req.params.id).first();
    if (!asset) {
      res.status(404).json({ error: 'Media asset not found' });
      return;
    }

    // Delete file from disk
    deleteFile(asset.storage_path);

    // Cascade deletes handle post_media links
    await db('media_assets').where('id', req.params.id).delete();

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
