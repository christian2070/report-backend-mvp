import { Reporte } from '../../domain/entities/reporte.entity';
import type { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import type { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';

export interface ReporteResponse {
  id: string;
  foto: string;
  descricao: string;
  categoria: CategoriaReporte;
  localizacao: string;
  status: StatusReporte;
  totalAlertas: number;
  createdAt: Date;
  updatedAt: Date;
  autorId?: string;
  autor?: { id: string; nome: string };
  jaAlertado?: boolean;
}

export function toReporteResponse(reporte: Reporte, includeAutorId = false) {
  const base: ReporteResponse = {
    id: reporte.id,
    foto: reporte.foto,
    descricao: reporte.descricao,
    categoria: reporte.categoria,
    localizacao: reporte.localizacao,
    status: reporte.status,
    totalAlertas: reporte.totalAlertas ?? 0,
    createdAt: reporte.createdAt,
    updatedAt: reporte.updatedAt,
  };

  if (includeAutorId) {
    base.autorId = reporte.autorId;
    base.totalAlertas = reporte.totalAlertas ?? 0;
  } else {
    base.jaAlertado = reporte.jaAlertado ?? false;
    base.autor = reporte.autor
      ? { id: reporte.autor.id, nome: reporte.autor.nome }
      : undefined;
  }

  return base;
}

export function toPaginatedResponse(
  items: Reporte[],
  page: number,
  limit: number,
  total: number,
) {
  return {
    data: items.map((item) => toReporteResponse(item)),
    page,
    totalPages: Math.ceil(total / limit) || 1,
    totalItems: total,
  };
}
