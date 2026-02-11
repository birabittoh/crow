import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { MediaUploadMetadataSchema, ALL_ALLOWED_MIMES, MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES } from '../schemas/media';
import { getStoragePath } from '../storage/local';

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

export const mediaRouter = Router();

mediaRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const metadata = MediaUploadMetadataSchema.parse(req.body);
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Validate file size based on type
    const isImage = file.mimetype.startsWith('image/');
    const maxSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      res.status(400).json({ error: `File too large. Max size: ${maxSize} bytes` });
      return;
    }

    // Verify post exists
    const post = await db('posts').where('id', metadata.post_id).first();
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const id = uuidv4();
    const mediaType = isImage ? 'image' : 'video';

    await db('media_assets').insert({
      id,
      post_id: metadata.post_id,
      type: mediaType,
      storage_path: file.path,
      mime_type: file.mimetype,
      size_bytes: file.size,
      duration_seconds: null,
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
