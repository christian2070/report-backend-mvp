import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';
import { Reporte } from '../entities/reporte.entity';

export interface CreateReporteData {
  foto: string;
  descricao: string;
  categoria: CategoriaReporte;
  localizacao: string;
  autorId: string;
}

export interface ListarReportesParams {
  page: number;
  limit: number;
  ordenacao: 'alertas' | 'recentes';
  categoria?: CategoriaReporte;
  bairro?: string;
  status?: StatusReporte;
  excluirResolvidos?: boolean;
  apenasResolvidos?: boolean;
  usuarioId?: string | null;
}

export interface UpdateReporteData {
  foto?: string;
  descricao?: string;
  categoria?: CategoriaReporte;
  localizacao?: string;
}

export interface PaginatedReportes {
  items: Reporte[];
  total: number;
}

export interface ReporteRepositoryPort {
  create(data: CreateReporteData): Promise<Reporte>;
  findById(id: string, usuarioId?: string | null): Promise<Reporte | null>;
  listar(params: ListarReportesParams): Promise<PaginatedReportes>;
  updateStatus(id: string, status: StatusReporte): Promise<Reporte>;
  updateOwned(
    id: string,
    autorId: string,
    data: UpdateReporteData,
  ): Promise<Reporte>;
  deleteOwned(id: string, autorId: string): Promise<void>;
  countByStatus(): Promise<Record<StatusReporte, number>>;
  countByCategoria(): Promise<Record<CategoriaReporte, number>>;
  countTotal(): Promise<number>;
}

export const REPORTE_REPOSITORY = Symbol('REPORTE_REPOSITORY');
