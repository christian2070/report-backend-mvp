import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatusReporte } from '../../common/domain/enums/status-reporte.enum';
import { TipoUsuario } from '../../common/domain/enums/tipo-usuario.enum';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

export function requireCidadao(user: AuthenticatedUser): void {
  if (user.tipo !== TipoUsuario.CIDADAO)
    throw new ForbiddenException('Apenas cidadãos podem alterar seus reportes');
}

export function authorizeReporte<
  T extends { autorId: string; status: StatusReporte },
>(reporte: T | null, autorId: string, editing: boolean): asserts reporte is T {
  if (!reporte) throw new NotFoundException('Reporte não encontrado');
  if (reporte.autorId !== autorId)
    throw new ForbiddenException('Apenas o autor pode alterar este reporte');
  if (editing && reporte.status === StatusReporte.RESOLVIDO)
    throw new BadRequestException('Reportes resolvidos não podem ser editados');
}
