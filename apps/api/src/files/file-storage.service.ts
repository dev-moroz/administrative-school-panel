import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

@Injectable()
export class FileStorageService {
  constructor(private readonly config: ConfigService) {}

  // Paths are built only from a folder constant, a database uuid and an extension taken from a fixed list.
  private path(folder: string, name: string) {
    return join(this.config.get<string>('UPLOADS_DIR') ?? './uploads', folder, name);
  }

  async save(folder: string, name: string, data: Buffer) {
    const target = this.path(folder, name);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
  }

  async open(folder: string, name: string) {
    const target = this.path(folder, name);
    try {
      if (!(await stat(target)).isFile()) return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    return createReadStream(target);
  }

  async remove(folder: string, name: string) {
    await rm(this.path(folder, name), { force: true });
  }
}
