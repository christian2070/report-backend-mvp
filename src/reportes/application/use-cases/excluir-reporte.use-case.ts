import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import { requireCidadao } from '../../domain/authorize-reporte';
import { REPORTE_REPOSITORY } from '../../domain/ports/reporte.repository.port';
import type { ReporteRepositoryPort } from '../../domain/ports/reporte.repository.port';
import { FileCleanupService } from '../../infrastructure/file-storage/file-cleanup.service';

@Injectable()
export class ExcluirReporteUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly repository: ReporteRepositoryPort,
    private readonly cleanup: FileCleanupService,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    requireCidadao(user);
    await this.repository.deleteOwned(id, user.id);
    await this.cleanup.flush();
  }
}
