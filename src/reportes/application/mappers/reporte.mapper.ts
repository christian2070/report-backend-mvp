import { Reporte } from '../../domain/entities/reporte.entity';

export function toReporteResponse(reporte: Reporte, includeAutorId = false) {
  const base: Record<string, unknown> = {
    id: reporte.id,
    foto: reporte.foto,
    descricao: reporte.descricao,
    categoria: reporte.categoria,
    localizacao: reporte.localizacao,
    status: reporte.status,
    totalAlertas: reporte.totalAlertas ?? 0,
    createdAt: reporte.createdAt,
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
