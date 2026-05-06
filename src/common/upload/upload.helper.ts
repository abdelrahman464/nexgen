import multer, { FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { ApiException } from '../exceptions/api.exception';

const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function createMulterOptions() {
  const maxFileSize = Number(process.env.MAX_UPLOAD_FILE_SIZE) || 20 * 1024 * 1024;
  return {
    storage: multer.memoryStorage(),
    fileFilter: (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
      if (allowedTypes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(new ApiException('Unsupported file type.', 400));
      }
    },
    limits: { fileSize: maxFileSize },
  };
}
