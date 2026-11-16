import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { unlink } from 'fs/promises';

@Injectable()
export class FileStorageService {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') ?? 'uploads';
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  saveFile(file: Express.Multer.File): string {
    const extension = extname(file.originalname) || '.jpg';
    const filename = `${uuidv4()}${extension}`;
    const filepath = join(this.uploadDir, filename);

    writeFileSync(filepath, file.buffer);

    return `/uploads/${filename}`;
  }

  async removeFile(url: string): Promise<void> {
    // Only files directly within our upload directory may be removed.
    if (!/^\/uploads\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(url)) {
      throw new Error('Caminho de upload inválido');
    }
    try {
      await unlink(join(this.uploadDir, url.slice('/uploads/'.length)));
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return;
      throw error;
    }
  }
}
