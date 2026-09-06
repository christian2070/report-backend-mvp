import { IsEnum } from 'class-validator';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';

export class AlterarStatusDto {
  @IsEnum(StatusReporte, {
    message: 'Status inválido. Valores aceitos: ABERTO, EM_ANDAMENTO, RESOLVIDO',
  })
  status: StatusReporte;
}
