import { Inject, Injectable } from '@nestjs/common';
import type { ReporteRepositoryPort } from '../../../reportes/domain/ports/reporte.repository.port';
import {
  REPORTE_REPOSITORY,
} from '../../../reportes/domain/ports/reporte.repository.port';

@Injectable()
export class GetDashboardResumoUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
  ) {}

  async execute() {
    const [totalReportes, porStatus, porCategoria] = await Promise.all([
      this.reporteRepository.countTotal(),
      this.reporteRepository.countByStatus(),
      this.reporteRepository.countByCategoria(),
    ]);

    return {
      totalReportes,
      porStatus,
      porCategoria,
    };
  }
}
