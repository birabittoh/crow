import fs from 'fs';
import path from 'path';
import { config } from '../config';

const storagePath = path.resolve(config.mediaStoragePath);

export function ensureStorageDir(): void {
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
}

export function getStoragePath(filename: string): string {
  return path.join(storagePath, filename);
}

export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

ensureStorageDir();
