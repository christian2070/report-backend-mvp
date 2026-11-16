import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { AlertaOrmEntity } from '../src/alertas/infrastructure/persistence/alerta.orm-entity';
import { UsuarioOrmEntity } from '../src/auth/infrastructure/persistence/usuario.orm-entity';
import { UsuarioRepository } from '../src/auth/infrastructure/persistence/usuario.repository';
import { UpdateMeUseCase } from '../src/auth/application/use-cases/update-me.use-case';
import { CategoriaReporte } from '../src/common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../src/common/domain/enums/status-reporte.enum';
import { TipoUsuario } from '../src/common/domain/enums/tipo-usuario.enum';
import { InitialSchema1730000000000 } from '../src/database/migrations/1730000000000-InitialSchema';
import { PendingFileDeletions1794860000000 } from '../src/database/migrations/1794860000000-PendingFileDeletions';
import { EditarReporteUseCase } from '../src/reportes/application/use-cases/editar-reporte.use-case';
import { ExcluirReporteUseCase } from '../src/reportes/application/use-cases/excluir-reporte.use-case';
import { FileCleanupService } from '../src/reportes/infrastructure/file-storage/file-cleanup.service';
import { FileStorageService } from '../src/reportes/infrastructure/file-storage/file-storage.service';
import { PendingFileDeletionOrmEntity } from '../src/reportes/infrastructure/file-storage/pending-file-deletion.orm-entity';
import { ReporteOrmEntity } from '../src/reportes/infrastructure/persistence/reporte.orm-entity';
import { ReporteRepository } from '../src/reportes/infrastructure/persistence/reporte.repository';

// Opt-in suite: creates and drops only a uniquely named test database. Never uses DB_NAME.
describe('MySQL migrations, referential integrity and file lifecycle', () => {
  const database = `report_features_test_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const owner = { id: randomUUID(), tipo: TipoUsuario.CIDADAO };
  const other = { id: randomUUID(), tipo: TipoUsuario.CIDADAO };
  let admin: DataSource;
  let source: DataSource;
  let directory: string;
  let storage: FileStorageService;
  let cleanup: FileCleanupService;
  let repository: ReporteRepository;
  let edit: EditarReporteUseCase;
  let remove: ExcluirReporteUseCase;
  let reportId: string;
  let originalPhoto: string;

  const upload = (): Express.Multer.File =>
    ({
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 5,
      buffer: Buffer.from('image'),
    }) as Express.Multer.File;
  const physical = (url: string) => join(directory, url.split('/').pop()!);

  beforeAll(async () => {
    config({ path: join(__dirname, '..', '.env'), quiet: true });
    const connection = {
      type: 'mysql' as const,
      host: process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 3306),
      username: process.env.TEST_DB_USER ?? process.env.DB_USER ?? 'root',
      password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    };
    admin = await new DataSource(connection).initialize();
    await admin.query(`CREATE DATABASE \`${database}\``);
    source = await new DataSource({
      ...connection,
      database,
      synchronize: false,
      entities: [
        UsuarioOrmEntity,
        ReporteOrmEntity,
        AlertaOrmEntity,
        PendingFileDeletionOrmEntity,
      ],
      migrations: [
        InitialSchema1730000000000,
        PendingFileDeletions1794860000000,
      ],
    }).initialize();
    const migrations = await source.runMigrations();
    expect(migrations).toHaveLength(2);
    directory = await mkdtemp(join(tmpdir(), 'report-mysql-test-'));
    storage = new FileStorageService(
      new ConfigService({ UPLOAD_DIR: directory }),
    );
    repository = new ReporteRepository(source.getRepository(ReporteOrmEntity));
    cleanup = new FileCleanupService(
      source.getRepository(PendingFileDeletionOrmEntity),
      storage,
    );
    edit = new EditarReporteUseCase(repository, storage, cleanup);
    remove = new ExcluirReporteUseCase(repository, cleanup);
    await source.getRepository(UsuarioOrmEntity).save([
      {
        id: owner.id,
        nome: 'Ana',
        email: 'ana@example.com',
        senha: 'unused-hash',
        tipo: TipoUsuario.CIDADAO,
        bairro: null,
      },
      {
        id: other.id,
        nome: 'Bia',
        email: 'bia@example.com',
        senha: 'unused-hash',
        tipo: TipoUsuario.CIDADAO,
        bairro: null,
      },
    ]);
  }, 30000);

  beforeEach(async () => {
    jest.restoreAllMocks();
    await source.createQueryBuilder().delete().from(AlertaOrmEntity).execute();
    await source.createQueryBuilder().delete().from(ReporteOrmEntity).execute();
    await source
      .createQueryBuilder()
      .delete()
      .from(PendingFileDeletionOrmEntity)
      .execute();
    originalPhoto = storage.saveFile(upload());
    const report = await repository.create({
      foto: originalPhoto,
      descricao: 'Reporte original',
      categoria: CategoriaReporte.LIXO,
      localizacao: 'Rua A',
      autorId: owner.id,
    });
    reportId = report.id;
    await source
      .getRepository(AlertaOrmEntity)
      .save({ usuarioId: other.id, reporteId: reportId });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (source?.isInitialized) await source.destroy();
    if (admin?.isInitialized) {
      if (!/^report_features_test_\d+_\d+$/.test(database))
        throw new Error('Invalid test database name');
      try {
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
      } finally {
        await admin.destroy();
      }
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('permanently deletes the report, confirmations and photo', async () => {
    await remove.execute(reportId, owner);
    expect(await source.getRepository(ReporteOrmEntity).count()).toBe(0);
    expect(await source.getRepository(AlertaOrmEntity).count()).toBe(0);
    expect(
      await source.getRepository(PendingFileDeletionOrmEntity).count(),
    ).toBe(0);
    await expect(readFile(physical(originalPhoto))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rolls back report, confirmation and cleanup queue together and preserves the photo', async () => {
    const actualTransaction = source.manager.transaction.bind(source.manager);
    jest.spyOn(source.manager, 'transaction').mockImplementationOnce((async (
      callback: (manager: EntityManager) => Promise<unknown>,
    ) => {
      return actualTransaction(async (manager) => {
        await callback(manager);
        throw new Error('failure before commit');
      });
    }) as unknown as typeof source.manager.transaction);
    await expect(remove.execute(reportId, owner)).rejects.toThrow(
      'failure before commit',
    );
    expect(await source.getRepository(ReporteOrmEntity).count()).toBe(1);
    expect(await source.getRepository(AlertaOrmEntity).count()).toBe(1);
    expect(
      await source.getRepository(PendingFileDeletionOrmEntity).count(),
    ).toBe(0);
    expect((await readFile(physical(originalPhoto))).toString()).toBe('image');
  });

  it('replaces photo while preserving author, status, creation date and confirmations', async () => {
    const before = await repository.findById(reportId);
    const updated = await edit.execute(
      reportId,
      { descricao: 'Texto alterado', localizacao: 'Rua B' },
      owner,
      upload(),
    );
    const after = await repository.findById(reportId);
    expect(after).toMatchObject({
      descricao: 'Texto alterado',
      localizacao: 'Rua B',
      autorId: before!.autorId,
      createdAt: before!.createdAt,
      status: before!.status,
      totalAlertas: 1,
    });
    expect(updated.foto).not.toBe(originalPhoto);
    expect((await readFile(physical(after!.foto))).toString()).toBe('image');
    await expect(readFile(physical(originalPhoto))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rechecks a concurrent resolution under the transaction lock and discards the new upload', async () => {
    const findById = repository.findById.bind(repository);
    jest.spyOn(repository, 'findById').mockImplementationOnce(async (id) => {
      const snapshot = await findById(id);
      await source
        .getRepository(ReporteOrmEntity)
        .update(id, { status: StatusReporte.RESOLVIDO });
      return snapshot;
    });
    const discard = jest.spyOn(cleanup, 'discardUncommitted');
    await expect(
      edit.execute(reportId, { descricao: 'Não deve salvar' }, owner, upload()),
    ).rejects.toMatchObject({ status: 400 });
    const after = await findById(reportId);
    expect(after).toMatchObject({
      descricao: 'Reporte original',
      foto: originalPhoto,
      status: StatusReporte.RESOLVIDO,
    });
    expect(discard).toHaveBeenCalledTimes(1);
    await expect(
      readFile(physical(discard.mock.calls[0][0])),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await readFile(physical(originalPhoto))).toString()).toBe('image');
  });

  it('keeps a durable cleanup job after disk failure and retries it', async () => {
    jest
      .spyOn(storage, 'removeFile')
      .mockRejectedValueOnce(new Error('disk unavailable'));
    await remove.execute(reportId, owner);
    expect(await source.getRepository(ReporteOrmEntity).count()).toBe(0);
    expect(
      await source.getRepository(PendingFileDeletionOrmEntity).count(),
    ).toBe(1);
    expect((await readFile(physical(originalPhoto))).toString()).toBe('image');
    await cleanup.flush();
    expect(
      await source.getRepository(PendingFileDeletionOrmEntity).count(),
    ).toBe(0);
    await expect(readFile(physical(originalPhoto))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects other authors and prefeitura without removing database rows or photos', async () => {
    await expect(
      edit.execute(reportId, { descricao: 'Texto' }, other),
    ).rejects.toMatchObject({ status: 403 });
    await expect(remove.execute(reportId, other)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      remove.execute(reportId, { ...owner, tipo: TipoUsuario.PREFEITURA }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await source.getRepository(ReporteOrmEntity).count()).toBe(1);
    expect(await source.getRepository(AlertaOrmEntity).count()).toBe(1);
    expect((await readFile(physical(originalPhoto))).toString()).toBe('image');
  });

  it('returns 409 for a duplicate email from the database unique constraint', async () => {
    const userRepository = new UsuarioRepository(
      source.getRepository(UsuarioOrmEntity),
    );
    await expect(
      userRepository.updateProfile(owner.id, { email: 'bia@example.com' }),
    ).rejects.toMatchObject({ status: 409 });
    const profile = await new UpdateMeUseCase(userRepository).execute(
      owner.id,
      { nome: 'Ana atualizada', bairro: '' },
    );
    expect(profile).toMatchObject({
      id: owner.id,
      nome: 'Ana atualizada',
      email: 'ana@example.com',
      bairro: null,
      tipo: TipoUsuario.CIDADAO,
    });
    expect(profile).not.toHaveProperty('senha');
  });
});
