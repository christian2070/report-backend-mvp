import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';

export class ReporteAutor {
  constructor(
    public readonly id: string,
    public readonly nome: string,
  ) {}
}

export class Reporte {
  constructor(
    public readonly id: string,
    public readonly foto: string,
    public readonly descricao: string,
    public readonly categoria: CategoriaReporte,
    public readonly localizacao: string,
    public readonly status: StatusReporte,
    public readonly autorId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly autor?: ReporteAutor,
    public readonly totalAlertas?: number,
    public readonly jaAlertado?: boolean,
  ) {}
}
