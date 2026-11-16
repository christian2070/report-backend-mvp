import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { AlertaOrmEntity } from '../../../alertas/infrastructure/persistence/alerta.orm-entity';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';
import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import { PendingFileDeletionOrmEntity } from '../file-storage/pending-file-deletion.orm-entity';
import { ReporteOrmEntity } from './reporte.orm-entity';
import { ReporteRepository } from './reporte.repository';

describe('ReporteRepository transactional mutations', () => {
  const photo = '/uploads/original.jpg';
  let current: Partial<ReporteOrmEntity> | null;
  const transactionalRepository = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    count: jest.fn(),
  };
  const transaction = jest.fn();
  let repository: ReporteRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    current = {
      id: 'report',
      autorId: 'owner',
      status: StatusReporte.ABERTO,
      foto: photo,
      descricao: 'Texto',
      categoria: CategoriaReporte.LIXO,
      localizacao: 'Rua A',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    manager.getRepository.mockReturnValue(transactionalRepository);
    manager.findOne.mockImplementation(() => Promise.resolve(current));
    transactionalRepository.findOne.mockImplementation(() =>
      Promise.resolve(current),
    );
    transactionalRepository.findOneOrFail.mockImplementation(() =>
      Promise.resolve(current),
    );
    manager.count.mockResolvedValue(0);
    transaction.mockImplementation(
      (callback: (value: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    );
    repository = new ReporteRepository({
      manager: { transaction },
    } as unknown as Repository<ReporteOrmEntity>);
  });

  it('deletes confirmations, report and schedules image cleanup in one transaction', async () => {
    await repository.deleteOwned('report', 'owner');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenCalledWith(ReporteOrmEntity, {
      where: { id: 'report' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.delete.mock.calls).toEqual([
      [AlertaOrmEntity, { reporteId: 'report' }],
      [ReporteOrmEntity, { id: 'report' }],
    ]);
    expect(manager.insert).toHaveBeenCalledWith(PendingFileDeletionOrmEntity, {
      path: photo,
    });
    expect(manager.delete.mock.invocationCallOrder[1]).toBeLessThan(
      manager.insert.mock.invocationCallOrder[0],
    );
  });

  it('propagates a queue failure to roll back the database transaction', async () => {
    manager.insert.mockRejectedValueOnce(new Error('queue failure'));
    await expect(repository.deleteOwned('report', 'owner')).rejects.toThrow(
      'queue failure',
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it.each(['deleteOwned', 'updateOwned'] as const)(
    'rechecks ownership under lock for %s',
    async (method) => {
      await expect(
        repository[method]('report', 'other', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(manager.delete).not.toHaveBeenCalled();
      expect(transactionalRepository.update).not.toHaveBeenCalled();
    },
  );

  it('returns 404 without deleting anything when the row is missing', async () => {
    current = null;
    await expect(
      repository.deleteOwned('missing', 'owner'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('rechecks resolved status under lock before editing', async () => {
    current!.status = StatusReporte.RESOLVIDO;
    await expect(
      repository.updateOwned('report', 'owner', { descricao: 'Novo texto' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionalRepository.update).not.toHaveBeenCalled();
  });

  it('persists only allowed fields and queues the old photo within the transaction', async () => {
    await repository.updateOwned('report', 'owner', {
      foto: '/uploads/new.jpg',
      descricao: 'Novo texto',
      status: StatusReporte.RESOLVIDO,
      autorId: 'other',
    } as Parameters<ReporteRepository['updateOwned']>[2]);
    expect(transactionalRepository.update).toHaveBeenCalledWith('report', {
      foto: '/uploads/new.jpg',
      descricao: 'Novo texto',
    });
    expect(manager.insert).toHaveBeenCalledWith(PendingFileDeletionOrmEntity, {
      path: photo,
    });
  });

  it('keeps the photo without scheduling deletion when it is not replaced', async () => {
    await repository.updateOwned('report', 'owner', {
      descricao: 'Novo texto',
    });
    expect(manager.insert).not.toHaveBeenCalled();
  });
});
