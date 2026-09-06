import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';
import type { ReporteRepositoryPort } from '../../domain/ports/reporte.repository.port';
import {
  REPORTE_REPOSITORY,
} from '../../domain/ports/reporte.repository.port';
import { AlterarStatusDto } from '../dto/alterar-status.dto';

const TRANSICOES_VALIDAS: Record<StatusReporte, StatusReporte | null> = {
  [StatusReporte.ABERTO]: StatusReporte.EM_ANDAMENTO,
  [StatusReporte.EM_ANDAMENTO]: StatusReporte.RESOLVIDO,
  [StatusReporte.RESOLVIDO]: null,
};

@Injectable()
export class AlterarStatusUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
  ) {}

  async execute(id: string, dto: AlterarStatusDto) {
    const reporte = await this.reporteRepository.findById(id);

    if (!reporte) {
      throw new NotFoundException('Reporte não encontrado');
    }

    const proximoStatus = TRANSICOES_VALIDAS[reporte.status];

    if (proximoStatus !== dto.status) {
      throw new BadRequestException(
        `Transição inválida de ${reporte.status} para ${dto.status}. Siga a ordem: ABERTO → EM_ANDAMENTO → RESOLVIDO`,
      );
    }

    const atualizado = await this.reporteRepository.updateStatus(id, dto.status);

    return {
      id: atualizado.id,
      status: atualizado.status,
      updatedAt: atualizado.updatedAt,
    };
  }
}
