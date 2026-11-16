import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileStorageService } from './file-storage.service';
import { PendingFileDeletionOrmEntity } from './pending-file-deletion.orm-entity';

@Injectable()
export class FileCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @InjectRepository(PendingFileDeletionOrmEntity)
    private readonly repository: Repository<PendingFileDeletionOrmEntity>,
    private readonly storage: FileStorageService,
  ) {}

  onModuleInit() {
    void this.flush();
    this.timer = setInterval(() => {
      void this.flush();
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // Database commits must never be reported as failures because file cleanup failed.
  async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.repository.find({
        order: { createdAt: 'ASC' },
        take: 100,
      });
      for (const item of pending) {
        try {
          await this.storage.removeFile(item.path);
          await this.repository.delete(item.id);
        } catch {
          this.logger.warn(`Limpeza de arquivo pendente: ${item.id}`);
        }
      }
    } catch {
      this.logger.warn(
        'Não foi possível consultar a fila de limpeza de arquivos',
      );
    } finally {
      this.running = false;
    }
  }

  async discardUncommitted(path: string): Promise<void> {
    try {
      await this.storage.removeFile(path);
    } catch {
      try {
        await this.repository.save(this.repository.create({ path }));
      } catch {
        this.logger.error(
          'Falha ao registrar limpeza de upload não persistido',
        );
      }
    }
  }
}
