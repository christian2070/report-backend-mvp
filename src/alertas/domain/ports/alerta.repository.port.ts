import { Alerta } from '../entities/alerta.entity';

export interface AlertaRepositoryPort {
  create(usuarioId: string, reporteId: string): Promise<Alerta>;
  delete(usuarioId: string, reporteId: string): Promise<boolean>;
  exists(usuarioId: string, reporteId: string): Promise<boolean>;
  countByReporte(reporteId: string): Promise<number>;
}

export const ALERTA_REPOSITORY = Symbol('ALERTA_REPOSITORY');
