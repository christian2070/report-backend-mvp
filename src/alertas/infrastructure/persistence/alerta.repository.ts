import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '../../domain/entities/alerta.entity';
import { AlertaRepositoryPort } from '../../domain/ports/alerta.repository.port';
import { AlertaOrmEntity } from './alerta.orm-entity';

@Injectable()
export class AlertaRepository implements AlertaRepositoryPort {
  constructor(
    @InjectRepository(AlertaOrmEntity)
    private readonly repository: Repository<AlertaOrmEntity>,
  ) {}

  async create(usuarioId: string, reporteId: string): Promise<Alerta> {
    try {
      const entity = this.repository.create({ usuarioId, reporteId });
      const saved = await this.repository.save(entity);
      return this.toDomain(saved);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException('Você já alertou este reporte');
      }
      throw error;
    }
  }

  async delete(usuarioId: string, reporteId: string): Promise<boolean> {
    const result = await this.repository.delete({ usuarioId, reporteId });
    return (result.affected ?? 0) > 0;
  }

  async exists(usuarioId: string, reporteId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { usuarioId, reporteId },
    });
    return count > 0;
  }

  async countByReporte(reporteId: string): Promise<number> {
    return this.repository.count({ where: { reporteId } });
  }

  private toDomain(entity: AlertaOrmEntity): Alerta {
    return new Alerta(
      entity.id,
      entity.usuarioId,
      entity.reporteId,
      entity.createdAt,
    );
  }
}
