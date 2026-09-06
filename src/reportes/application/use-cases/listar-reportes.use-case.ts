import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ReporteRepositoryPort } from '../../domain/ports/reporte.repository.port';
import {
  REPORTE_REPOSITORY,
} from '../../domain/ports/reporte.repository.port';
import { ListarReportesQueryDto } from '../dto/listar-reportes-query.dto';
import {
  toPaginatedResponse,
  toReporteResponse,
} from '../mappers/reporte.mapper';

@Injectable()
export class ListarReportesUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
  ) {}

  async execute(query: ListarReportesQueryDto, usuarioId?: string | null) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const { items, total } = await this.reporteRepository.listar({
      page,
      limit,
      ordenacao: query.ordenacao ?? 'alertas',
      categoria: query.categoria,
      bairro: query.bairro,
      status: query.status,
      excluirResolvidos: !query.status,
      usuarioId,
    });

    return toPaginatedResponse(items, page, limit, total);
  }
}

@Injectable()
export class GetReporteUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
  ) {}

  async execute(id: string, usuarioId?: string | null) {
    const reporte = await this.reporteRepository.findById(id, usuarioId);

    if (!reporte) {
      throw new NotFoundException('Reporte não encontrado');
    }

    return toReporteResponse(reporte);
  }
}

@Injectable()
export class ListarResolvidosUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
  ) {}

  async execute(query: ListarReportesQueryDto, usuarioId?: string | null) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const { items, total } = await this.reporteRepository.listar({
      page,
      limit,
      ordenacao: 'recentes',
      categoria: query.categoria,
      bairro: query.bairro,
      apenasResolvidos: true,
      usuarioId,
    });

    return toPaginatedResponse(items, page, limit, total);
  }
}
