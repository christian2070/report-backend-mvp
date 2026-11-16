import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import {
  authorizeReporte,
  requireCidadao,
} from '../../domain/authorize-reporte';
import { REPORTE_REPOSITORY } from '../../domain/ports/reporte.repository.port';
import type { ReporteRepositoryPort } from '../../domain/ports/reporte.repository.port';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';
import { FileCleanupService } from '../../infrastructure/file-storage/file-cleanup.service';
import { EditarReporteDto } from '../dto/editar-reporte.dto';
import { toReporteResponse } from '../mappers/reporte.mapper';
import type { Reporte } from '../../domain/entities/reporte.entity';

@Injectable()
export class EditarReporteUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly repository: ReporteRepositoryPort,
    private readonly storage: FileStorageService,
    private readonly cleanup: FileCleanupService,
  ) {}

  async execute(
    id: string,
    dto: EditarReporteDto,
    user: AuthenticatedUser,
    foto?: Express.Multer.File,
  ) {
    requireCidadao(user);
    const current = await this.repository.findById(id, user.id);
    authorizeReporte(current, user.id, true);
    if (
      foto &&
      (!['image/jpeg', 'image/png', 'image/webp'].includes(foto.mimetype) ||
        foto.size > 5 * 1024 * 1024)
    ) {
      throw new BadRequestException(
        'Use uma imagem JPEG, PNG ou WebP de até 5 MB',
      );
    }
    const newPhoto = foto ? this.storage.saveFile(foto) : undefined;
    let updated: Reporte;
    try {
      updated = await this.repository.updateOwned(id, user.id, {
        descricao: dto.descricao,
        categoria: dto.categoria,
        localizacao: dto.localizacao,
        ...(newPhoto ? { foto: newPhoto } : {}),
      });
    } catch (error: unknown) {
      if (newPhoto) await this.cleanup.discardUncommitted(newPhoto);
      throw error;
    }
    await this.cleanup.flush();
    return toReporteResponse(updated);
  }
}
