import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';
import type { AlertaRepositoryPort } from '../../domain/ports/alerta.repository.port';
import {
  ALERTA_REPOSITORY,
} from '../../domain/ports/alerta.repository.port';
import type { ReporteRepositoryPort } from '../../../reportes/domain/ports/reporte.repository.port';
import {
  REPORTE_REPOSITORY,
} from '../../../reportes/domain/ports/reporte.repository.port';

@Injectable()
export class CriarAlertaUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
    @Inject(ALERTA_REPOSITORY)
    private readonly alertaRepository: AlertaRepositoryPort,
  ) {}

  async execute(reporteId: string, usuarioId: string) {
    const reporte = await this.reporteRepository.findById(reporteId);

    if (!reporte) {
      throw new NotFoundException('Reporte não encontrado');
    }

    if (reporte.autorId === usuarioId) {
      throw new ForbiddenException('Você não pode alertar o próprio reporte');
    }

    if (reporte.status === StatusReporte.RESOLVIDO) {
      throw new BadRequestException(
        'Não é permitido alertar reportes resolvidos',
      );
    }

    await this.alertaRepository.create(usuarioId, reporteId);
    const totalAlertas = await this.alertaRepository.countByReporte(reporteId);

    return { reporteId, totalAlertas };
  }
}

@Injectable()
export class RemoverAlertaUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
    @Inject(ALERTA_REPOSITORY)
    private readonly alertaRepository: AlertaRepositoryPort,
  ) {}

  async execute(reporteId: string, usuarioId: string) {
    const reporte = await this.reporteRepository.findById(reporteId);

    if (!reporte) {
      throw new NotFoundException('Reporte não encontrado');
    }

    if (reporte.status === StatusReporte.RESOLVIDO) {
      throw new BadRequestException(
        'Não é permitido remover alerta de reportes resolvidos',
      );
    }

    const removed = await this.alertaRepository.delete(usuarioId, reporteId);

    if (!removed) {
      throw new NotFoundException('Alerta não encontrado');
    }

    const totalAlertas = await this.alertaRepository.countByReporte(reporteId);

    return { reporteId, totalAlertas };
  }
}
