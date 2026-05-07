import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { ApiException } from '../exceptions/api.exception';

@Injectable()
export class ImageProcessingService {
  async saveImageAsWebp(file: Express.Multer.File, folder: string, prefix: string, quality = 95) {
    if (!file.mimetype.startsWith('image/')) {
      throw new ApiException(`Unsupported file type. Only images are allowed for ${prefix}.`, 400);
    }

    const filename = `${prefix}-${uuidv4()}-${Date.now()}.webp`;
    await sharp(file.buffer).toFormat('webp').webp({ quality }).toFile(`uploads/${folder}/${filename}`);
    return filename;
  }

  async saveManyImagesAsWebp(files: Express.Multer.File[], folder: string, prefix: string, quality = 95) {
    return Promise.all(files.map((file, index) => this.saveImageAsWebp(file, folder, `${prefix}-${index + 1}`, quality)));
  }
}
