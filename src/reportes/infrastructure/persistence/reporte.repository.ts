import { AlertaOrmEntity } from '../../../alertas/infrastructure/persistence/alerta.orm-entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';
import { Reporte, ReporteAutor } from '../../domain/entities/reporte.entity';
import {
  CreateReporteData,
  ListarReportesParams,
  PaginatedReportes,
  ReporteRepositoryPort,
} from '../../domain/ports/reporte.repository.port';
import { ReporteOrmEntity } from './reporte.orm-entity';
import type { UpdateReporteData } from '../../domain/ports/reporte.repository.port';
import { authorizeReporte } from '../../domain/authorize-reporte';
import { PendingFileDeletionOrmEntity } from '../file-storage/pending-file-deletion.orm-entity';

type ReporteWithCount = ReporteOrmEntity & { totalAlertas?: number };

@Injectable()
export class ReporteRepository implements ReporteRepositoryPort {
  constructor(
    @InjectRepository(ReporteOrmEntity)
    private readonly repository: Repository<ReporteOrmEntity>,
  ) {}

  async create(data: CreateReporteData): Promise<Reporte> {
    const entity = this.repository.create({
      foto: data.foto,
      descricao: data.descricao,
      categoria: data.categoria,
      localizacao: data.localizacao,
      autorId: data.autorId,
      status: StatusReporte.ABERTO,
    });
    const saved = await this.repository.save(entity);
    return this.toDomain(saved, 0, false);
  }

  async findById(
    id: string,
    usuarioId?: string | null,
  ): Promise<Reporte | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['autor'],
    });

    if (!entity) {
      return null;
    }

    const withCount = await this.repository
      .createQueryBuilder('reporte')
      .loadRelationCountAndMap('reporte.totalAlertas', 'reporte.alertas')
      .where('reporte.id = :id', { id })
      .getOne();

    const totalAlertas = (withCount as ReporteWithCount)?.totalAlertas ?? 0;
    const jaAlertado = usuarioId ? await this.hasAlerta(usuarioId, id) : false;

    return this.toDomain(entity, totalAlertas, jaAlertado);
  }

  async listar(params: ListarReportesParams): Promise<PaginatedReportes> {
    const countQb = this.repository.createQueryBuilder('reporte');
    this.applyFilters(countQb, params);
    const total = await countQb.getCount();

    const qb = this.repository
      .createQueryBuilder('reporte')
      .leftJoinAndSelect('reporte.autor', 'autor')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(alerta.id)')
          .from(AlertaOrmEntity, 'alerta')
          .where('alerta.reporteId = reporte.id');
      }, 'alertasCount');

    this.applyFilters(qb, params);

    if (params.apenasResolvidos) {
      qb.orderBy('reporte.updatedAt', 'DESC');
    } else if (params.ordenacao === 'recentes') {
      qb.orderBy('reporte.createdAt', 'DESC');
    } else {
      qb.orderBy('alertasCount', 'DESC').addOrderBy(
        'reporte.createdAt',
        'DESC',
      );
    }

    qb.skip((params.page - 1) * params.limit).take(params.limit);

    const { entities, raw } = await qb.getRawAndEntities<{
      alertasCount?: string;
    }>();
    const items: Reporte[] = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const totalAlertas = parseInt(raw[i]?.alertasCount ?? '0', 10);
      const jaAlertado = params.usuarioId
        ? await this.hasAlerta(params.usuarioId, entity.id)
        : false;
      items.push(this.toDomain(entity, totalAlertas, jaAlertado));
    }

    return { items, total };
  }

  async updateStatus(id: string, status: StatusReporte): Promise<Reporte> {
    await this.repository.update(id, { status });
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Reporte não encontrado após atualização');
    }
    return updated;
  }

  async countByStatus(): Promise<Record<StatusReporte, number>> {
    const rows = await this.repository
      .createQueryBuilder('reporte')
      .select('reporte.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('reporte.status')
      .getRawMany<{ status: StatusReporte; count: string }>();

    const result: Record<StatusReporte, number> = {
      [StatusReporte.ABERTO]: 0,
      [StatusReporte.EM_ANDAMENTO]: 0,
      [StatusReporte.RESOLVIDO]: 0,
    };

    for (const row of rows) {
      result[row.status] = parseInt(row.count, 10);
    }

    return result;
  }

  async countByCategoria(): Promise<Record<CategoriaReporte, number>> {
    const rows = await this.repository
      .createQueryBuilder('reporte')
      .select('reporte.categoria', 'categoria')
      .addSelect('COUNT(*)', 'count')
      .groupBy('reporte.categoria')
      .getRawMany<{ categoria: CategoriaReporte; count: string }>();

    const result: Record<CategoriaReporte, number> = {
      [CategoriaReporte.ILUMINACAO]: 0,
      [CategoriaReporte.BURACO_PAVIMENTACAO]: 0,
      [CategoriaReporte.LIXO]: 0,
      [CategoriaReporte.SINALIZACAO]: 0,
      [CategoriaReporte.OUTROS]: 0,
    };

    for (const row of rows) {
      result[row.categoria] = parseInt(row.count, 10);
    }

    return result;
  }

  async countTotal(): Promise<number> {
    return this.repository.count();
  }

  async updateOwned(
    id: string,
    autorId: string,
    data: UpdateReporteData,
  ): Promise<Reporte> {
    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ReporteOrmEntity);
      const current = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      authorizeReporte(current, autorId, true);
      // Explicit allowlist: status, author, confirmations and creation date are immutable here.
      const changes = {
        ...(data.foto !== undefined ? { foto: data.foto } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
        ...(data.categoria !== undefined ? { categoria: data.categoria } : {}),
        ...(data.localizacao !== undefined
          ? { localizacao: data.localizacao }
          : {}),
      };
      if (Object.keys(changes).length) await repository.update(id, changes);
      if (data.foto && data.foto !== current.foto) {
        await manager.insert(PendingFileDeletionOrmEntity, {
          path: current.foto,
        });
      }
      const updated = await repository.findOneOrFail({
        where: { id },
        relations: ['autor'],
      });
      const total = await manager.count(AlertaOrmEntity, {
        where: { reporteId: id },
      });
      const confirmed = await manager.count(AlertaOrmEntity, {
        where: { reporteId: id, usuarioId: autorId },
      });
      return this.toDomain(updated, total, confirmed > 0);
    });
  }

  async deleteOwned(id: string, autorId: string): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      const current = await manager.findOne(ReporteOrmEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      authorizeReporte(current, autorId, false);
      await manager.delete(AlertaOrmEntity, { reporteId: id });
      await manager.delete(ReporteOrmEntity, { id });
      // Defer physical removal until commit; a rollback leaves the original image intact.
      await manager.insert(PendingFileDeletionOrmEntity, {
        path: current.foto,
      });
    });
  }

  private applyFilters(
    qb: SelectQueryBuilder<ReporteOrmEntity>,
    params: ListarReportesParams,
  ) {
    if (params.apenasResolvidos) {
      qb.andWhere('reporte.status = :resolvido', {
        resolvido: StatusReporte.RESOLVIDO,
      });
    } else if (params.status) {
      qb.andWhere('reporte.status = :status', { status: params.status });
    } else if (params.excluirResolvidos) {
      qb.andWhere('reporte.status != :resolvido', {
        resolvido: StatusReporte.RESOLVIDO,
      });
    }

    if (params.categoria) {
      qb.andWhere('reporte.categoria = :categoria', {
        categoria: params.categoria,
      });
    }

    if (params.bairro) {
      qb.andWhere('reporte.localizacao LIKE :bairro', {
        bairro: `%${params.bairro}%`,
      });
    }
  }

  private async hasAlerta(
    usuarioId: string,
    reporteId: string,
  ): Promise<boolean> {
    const count = await this.repository.manager
      .createQueryBuilder()
      .select('1')
      .from('alertas', 'alerta')
      .where('alerta.usuario_id = :usuarioId', { usuarioId })
      .andWhere('alerta.reporte_id = :reporteId', { reporteId })
      .getCount();

    return count > 0;
  }

  private toDomain(
    entity: ReporteOrmEntity,
    totalAlertas: number,
    jaAlertado: boolean,
  ): Reporte {
    const autor = entity.autor
      ? new ReporteAutor(entity.autor.id, entity.autor.nome)
      : undefined;

    return new Reporte(
      entity.id,
      entity.foto,
      entity.descricao,
      entity.categoria,
      entity.localizacao,
      entity.status,
      entity.autorId,
      entity.createdAt,
      entity.updatedAt,
      autor,
      totalAlertas,
      jaAlertado,
    );
  }
}
