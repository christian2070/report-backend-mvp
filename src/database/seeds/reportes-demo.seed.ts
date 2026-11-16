import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DataSource, In } from 'typeorm';
import { AlertaOrmEntity } from '../../alertas/infrastructure/persistence/alerta.orm-entity';
import { UsuarioOrmEntity } from '../../auth/infrastructure/persistence/usuario.orm-entity';
import { TipoUsuario } from '../../common/domain/enums/tipo-usuario.enum';
import { StatusReporte } from '../../common/domain/enums/status-reporte.enum';
import { ReporteOrmEntity } from '../../reportes/infrastructure/persistence/reporte.orm-entity';
import { PendingFileDeletionOrmEntity } from '../../reportes/infrastructure/file-storage/pending-file-deletion.orm-entity';
import {
  DemoManifest,
  digest,
  imageCredits,
  inside,
  requireLocalTarget,
  uploadFile,
  validateManifest,
  validatePhoto,
} from './reportes-demo/support';

config({ quiet: true });
const root = resolve(__dirname, '../../..');
const cache = join(root, '.cache/reportes-demo');
const args = process.argv.slice(2);
const day = 86400000;

async function json(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

async function exists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(45000),
      headers: {
        'User-Agent': 'ReportesUrbanosDemo/1.0 (educational local seed)',
      },
      redirect: 'error',
    });
    if (response.ok) {
      if (!response.headers.get('content-type')?.startsWith('image/jpeg'))
        throw new Error('Download não é JPEG.');
      const chunks: Buffer[] = [];
      let length = 0;
      for await (const chunk of response.body!) {
        length += chunk.length;
        if (length > 5 * 1024 * 1024)
          throw new Error('Download excedeu 5 MiB.');
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    if (![429, 503].includes(response.status))
      throw new Error(`Download recusado: HTTP ${response.status}`);
    await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
  }
  throw new Error('Wikimedia indisponível; nenhum dado foi excluído.');
}

async function main() {
  const target = requireLocalTarget(process.env, args);
  process.chdir(root);
  const manifest = JSON.parse(
    await readFile(join(__dirname, 'reportes-demo/manifest.json'), 'utf8'),
  ) as DemoManifest;
  validateManifest(manifest);
  const db = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'cidades_inteligentes',
    entities: [
      UsuarioOrmEntity,
      ReporteOrmEntity,
      AlertaOrmEntity,
      PendingFileDeletionOrmEntity,
    ],
    synchronize: false,
    migrationsRun: false,
    connectTimeout: 10000,
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  let locked = false;
  let journalPath: string | undefined;
  const copied: string[] = [];
  let committed = false;
  const uploadDir = inside(
    root,
    resolve(root, process.env.UPLOAD_DIR ?? 'uploads'),
  );
  try {
    const [identity] = (await runner.query(
      'SELECT DATABASE() AS db, @@hostname AS hostname, @@port AS port',
    )) as { db: string; hostname: string; port: number }[];
    if (identity.db !== (process.env.DB_NAME ?? 'cidades_inteligentes'))
      throw new Error('Banco conectado diverge da configuração.');
    const tables = (await runner.query(
      'SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()',
    )) as { name: string; engine: string }[];
    for (const name of [
      'usuarios',
      'reportes',
      'alertas',
      'pending_file_deletions',
    ]) {
      if (!tables.some((t) => t.name === name && t.engine === 'InnoDB'))
        throw new Error(
          `Tabela ${name} ausente ou não transacional. Execute as migrations documentadas.`,
        );
    }
    const reports = await db
      .getRepository(ReporteOrmEntity)
      .find({ order: { id: 'ASC' } });
    const users = await db
      .getRepository(UsuarioOrmEntity)
      .find({ order: { id: 'ASC' } });
    const alerts = await db
      .getRepository(AlertaOrmEntity)
      .find({ order: { id: 'ASC' } });
    const reportIds = manifest.reports.map((r) => r.id);
    const citizenIds = manifest.citizens.map((c) => c.id);
    const approvedIds = (
      args.find((a) => a.startsWith('--replace-test-ids='))?.split('=')[1] ?? ''
    )
      .split(',')
      .filter(Boolean);
    const unknown = reports.filter((r) => !reportIds.includes(r.id));
    if (
      unknown.some((r) => !approvedIds.includes(r.id)) ||
      approvedIds.some((id) => !unknown.some((r) => r.id === id))
    ) {
      throw new Error(
        'Há reportes fora do seed. Revise os dados de teste e autorize apenas seus IDs com --replace-test-ids=id1,id2.',
      );
    }
    for (const c of manifest.citizens) {
      const existing = users.find((u) => u.id === c.id || u.email === c.email);
      if (
        existing &&
        (existing.id !== c.id ||
          existing.email !== c.email ||
          existing.tipo !== TipoUsuario.CIDADAO)
      )
        throw new Error('Conflito com conta existente: ' + c.email);
    }
    for (const r of reports) uploadFile(uploadDir, r.foto);
    const foreignKeys = (await runner.query(
      'SELECT TABLE_NAME AS name, COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS parent FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE()',
    )) as { name: string; col: string; parent: string }[];
    if (
      foreignKeys.some(
        (k) =>
          k.parent === 'reportes' &&
          !(k.name === 'alertas' && k.col === 'reporte_id'),
      )
    )
      throw new Error(
        'Relacionamento adicional de reportes exige revisão; nenhuma exclusão executada.',
      );
    const canRemoveCitizens = !foreignKeys.some(
      (k) =>
        k.parent === 'usuarios' &&
        !(
          (k.name === 'alertas' && k.col === 'usuario_id') ||
          (k.name === 'reportes' && k.col === 'autor_id')
        ),
    );
    const removable =
      args.includes('--remove-unused-citizens') && canRemoveCitizens
        ? users.filter(
            (u) => u.tipo === TipoUsuario.CIDADAO && !citizenIds.includes(u.id),
          )
        : [];
    console.log(
      JSON.stringify(
        {
          mode: args.includes('--apply') ? 'apply' : 'dry-run',
          target,
          server: identity,
          reportsToReplace: reports.length,
          alertsToRemove: alerts.length,
          citizensToRemove: removable.length,
          citizensToCreate: manifest.citizens.filter(
            (c) => !users.some((u) => u.id === c.id),
          ).length,
          reportsToCreate: 20,
          notice: manifest.notice,
        },
        null,
        2,
      ),
    );
    if (!canRemoveCitizens)
      console.log(
        'Cidadãos antigos preservados: existem outros relacionamentos.',
      );
    if (!args.includes('--apply') && !args.includes('--prepare-images')) return;
    await mkdir(join(cache, 'images'), { recursive: true });
    for (const r of manifest.reports) {
      const path = join(cache, 'images', r.photo.sha256 + '.jpg');
      if (!(await exists(path))) {
        const bytes = await download(r.photo.download);
        validatePhoto(bytes, r.photo);
        await writeFile(path, bytes, { flag: 'wx' });
        await new Promise((r) => setTimeout(r, 1200));
      }
      validatePhoto(await readFile(path), r.photo);
    }
    console.log(
      '20 fotos conferidas: JPEG, SHA-256, tamanho e licença do manifesto.',
    );
    if (!args.includes('--apply')) return;
    await mkdir(uploadDir, { recursive: true });
    if (
      (await realpath(uploadDir)) !== uploadDir ||
      (await lstat(uploadDir)).isSymbolicLink()
    )
      throw new Error('UPLOAD_DIR deve ser uma pasta real dentro do backend.');
    const creditPath = join(uploadDir, 'reportes-demo-creditos.html');
    const credits = imageCredits(manifest);
    if (await exists(creditPath)) {
      if ((await readFile(creditPath, 'utf8')) !== credits)
        throw new Error(
          'Arquivo de créditos existente diverge do manifesto; revise antes de substituí-lo.',
        );
    } else await writeFile(creditPath, credits, { flag: 'wx' });
    const [lock] = (await runner.query('SELECT GET_LOCK(?, 0) AS acquired', [
      'reportes-demo:' + identity.db,
    ])) as { acquired: number }[];
    if (Number(lock.acquired) !== 1)
      throw new Error('Outro seed está em execução.');
    locked = true;
    // Recover only unreferenced, explicitly journaled files after a prior interruption.
    for (const name of (await readdir(cache)).filter((n) =>
      /^run-[a-f0-9-]+\.json$/.test(n),
    )) {
      const path = join(cache, name);
      const journal = JSON.parse(await readFile(path, 'utf8')) as {
        target: string;
        uploadDir: string;
        files: string[];
      };
      if (journal.target !== target || journal.uploadDir !== uploadDir)
        continue;
      for (const file of journal.files) {
        if (
          !(await db.getRepository(ReporteOrmEntity).existsBy({ foto: file }))
        ) {
          await unlink(uploadFile(uploadDir, file)).catch((e) => {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
          });
        }
      }
      await unlink(path);
    }
    const runId = randomUUID();
    const prepared = manifest.reports.map((r) => ({
      ...r,
      foto: `/uploads/${randomUUID()}.jpg`,
    }));
    journalPath = join(cache, `run-${runId}.json`);
    await json(journalPath, {
      target,
      uploadDir,
      files: prepared.map((r) => r.foto),
    });
    // Keep an inventory without copying passwords or real account profiles to disk.
    await json(join(cache, `before-${runId}.json`), {
      target,
      reportIds: reports.map((r) => r.id),
      alertIds: alerts.map((a) => a.id),
      citizenIds: removable.map((u) => u.id),
      prefeituraFingerprint: digest(
        JSON.stringify(users.filter((u) => u.tipo === TipoUsuario.PREFEITURA)),
      ),
    });
    for (const r of prepared) {
      await copyFile(
        join(cache, 'images', r.photo.sha256 + '.jpg'),
        uploadFile(uploadDir, r.foto),
        constants.COPYFILE_EXCL,
      );
      copied.push(r.foto);
    }
    const passwordHashes = new Map<string, string>();
    for (const c of manifest.citizens) {
      const existing = users.find((u) => u.id === c.id);
      if (existing && !(await bcrypt.compare('Testando123!', existing.senha)))
        throw new Error(
          'A senha de uma conta demo foi alterada; revise antes de executar novamente.',
        );
      passwordHashes.set(
        c.id,
        existing?.senha ?? (await bcrypt.hash('Testando123!', 10)),
      );
    }
    await runner.startTransaction('SERIALIZABLE');
    const manager = runner.manager;
    const currentUsers = await manager.find(UsuarioOrmEntity, {
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const currentReports = await manager.find(ReporteOrmEntity, {
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const currentAlerts = await manager.find(AlertaOrmEntity, {
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      JSON.stringify(currentReports) !== JSON.stringify(reports) ||
      JSON.stringify(currentUsers) !== JSON.stringify(users) ||
      JSON.stringify(currentAlerts) !== JSON.stringify(alerts)
    )
      throw new Error(
        'Os dados mudaram durante a preparação; execute novamente após revisar.',
      );
    if (currentReports.length) {
      await manager.delete(AlertaOrmEntity, {
        reporteId: In(currentReports.map((r) => r.id)),
      });
      await manager.delete(ReporteOrmEntity, {
        id: In(currentReports.map((r) => r.id)),
      });
      await manager.insert(
        PendingFileDeletionOrmEntity,
        [...new Set(currentReports.map((r) => r.foto))].map((path) => ({
          path,
        })),
      );
    }
    if (removable.length)
      await manager.delete(UsuarioOrmEntity, {
        id: In(removable.map((u) => u.id)),
        tipo: TipoUsuario.CIDADAO,
      });
    for (const c of manifest.citizens) {
      const existing = currentUsers.find((u) => u.id === c.id);
      if (!existing)
        await manager.insert(UsuarioOrmEntity, {
          ...c,
          tipo: TipoUsuario.CIDADAO,
          senha: passwordHashes.get(c.id)!,
        });
      else if (existing.nome !== c.nome || existing.bairro !== c.bairro)
        throw new Error(
          'Perfil demo alterado; não será sobrescrito automaticamente.',
        );
    }
    const now = new Date();
    for (const r of prepared) {
      const createdAt = new Date(now.getTime() - r.daysAgo * day);
      await manager.insert(ReporteOrmEntity, {
        id: r.id,
        autorId: r.autorId,
        categoria: r.categoria,
        descricao: r.descricao,
        localizacao: r.localizacao,
        foto: r.foto,
        status: StatusReporte.ABERTO,
        createdAt,
        updatedAt: createdAt,
      });
      // Reconstruct the allowed lifecycle ABERTO -> EM_ANDAMENTO -> RESOLVIDO.
      if (r.status !== StatusReporte.ABERTO)
        await manager.update(ReporteOrmEntity, r.id, {
          status: StatusReporte.EM_ANDAMENTO,
          updatedAt: new Date(createdAt.getTime() + day),
        });
      if (r.status === StatusReporte.RESOLVIDO)
        await manager.update(ReporteOrmEntity, r.id, {
          status: StatusReporte.RESOLVIDO,
          updatedAt: new Date(createdAt.getTime() + 3 * day),
        });
    }
    const saved = await manager.find(ReporteOrmEntity);
    const savedCitizens = await manager.find(UsuarioOrmEntity, {
      where: { id: In(citizenIds), tipo: TipoUsuario.CIDADAO },
    });
    if (
      saved.length !== 20 ||
      savedCitizens.length !== 10 ||
      citizenIds.some(
        (id) => saved.filter((r) => r.autorId === id).length !== 2,
      ) ||
      (await manager.count(AlertaOrmEntity)) !== 0
    )
      throw new Error('Contagens finais inválidas; transação revertida.');
    for (const r of manifest.reports) {
      const actual = saved.find((s) => s.id === r.id)!;
      if (
        !actual ||
        actual.status !== r.status ||
        actual.categoria !== r.categoria ||
        actual.updatedAt < actual.createdAt ||
        actual.updatedAt > now
      )
        throw new Error('Reporte final inconsistente.');
      validatePhoto(
        await readFile(uploadFile(uploadDir, actual.foto)),
        r.photo,
      );
    }
    const prefeituraAfter = await manager.find(UsuarioOrmEntity, {
      where: { tipo: TipoUsuario.PREFEITURA },
      order: { id: 'ASC' },
    });
    if (
      JSON.stringify(prefeituraAfter) !==
      JSON.stringify(users.filter((u) => u.tipo === TipoUsuario.PREFEITURA))
    )
      throw new Error('A conta da prefeitura divergiu; transação revertida.');
    if (args.includes('--test-rollback'))
      throw new Error('ROLLBACK_DE_TESTE: falha simulada antes do commit.');
    await runner.commitTransaction();
    committed = true;
    // The existing durable outbox retries failures on the next API startup.
    let pending = 0;
    const oldPaths = new Set(reports.map((r) => r.foto));
    for (const item of (
      await db.getRepository(PendingFileDeletionOrmEntity).find()
    ).filter((item) => oldPaths.has(item.path))) {
      try {
        const path = uploadFile(uploadDir, item.path);
        if (
          await db.getRepository(ReporteOrmEntity).existsBy({ foto: item.path })
        )
          continue;
        await unlink(path).catch((e) => {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        });
        await db.getRepository(PendingFileDeletionOrmEntity).delete(item.id);
      } catch {
        pending++;
      }
    }
    await unlink(journalPath);
    journalPath = undefined;
    const result = {
      completedAt: now.toISOString(),
      target,
      removedReports: reports.length,
      removedAlerts: alerts.length,
      removedCitizens: removable.length,
      createdReports: 20,
      demoCitizens: 10,
      reportsPerCitizen: 2,
      preservedPrefeitura: prefeituraAfter.length,
      pendingFileDeletions: pending,
      byCategory: Object.fromEntries(
        [...new Set(saved.map((r) => r.categoria))].map((c) => [
          c,
          saved.filter((r) => r.categoria === c).length,
        ]),
      ),
      byStatus: Object.fromEntries(
        Object.values(StatusReporte).map((s) => [
          s,
          saved.filter((r) => r.status === s).length,
        ]),
      ),
      reports: saved.map((r) => ({
        id: r.id,
        foto: r.foto,
        categoria: r.categoria,
        descricao: r.descricao,
        localizacao: r.localizacao,
        status: r.status,
        autorId: r.autorId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
    await writeFile(
      join(cache, 'last-result.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log(JSON.stringify(result, null, 2));
    if (pending)
      console.warn(
        'Limpezas pendentes serão repetidas pela API; consulte pending_file_deletions.',
      );
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    if (!committed) {
      let cleanupFailed = false;
      for (const file of copied) {
        try {
          if (
            !(await db.getRepository(ReporteOrmEntity).existsBy({ foto: file }))
          )
            await unlink(uploadFile(uploadDir, file));
        } catch {
          cleanupFailed = true;
        }
      }
      if (journalPath && !cleanupFailed) await unlink(journalPath);
    }
    if (committed)
      console.error(
        'O banco foi confirmado. Uma falha posterior afetou somente o relatório ou a limpeza; consulte a fila antes de repetir.',
      );
    throw error;
  } finally {
    if (locked)
      await runner.query('SELECT RELEASE_LOCK(?)', [
        'reportes-demo:' + (process.env.DB_NAME ?? 'cidades_inteligentes'),
      ]);
    await runner.release();
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha no seed.');
  process.exitCode = 1;
});
