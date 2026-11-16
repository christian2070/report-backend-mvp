import 'reflect-metadata';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../app.module';
import dataSource from '../../config/typeorm.config';
import { UsuarioOrmEntity } from '../../auth/infrastructure/persistence/usuario.orm-entity';
import { ReporteOrmEntity } from '../../reportes/infrastructure/persistence/reporte.orm-entity';
import { TipoUsuario } from '../../common/domain/enums/tipo-usuario.enum';
import { CategoriaReporte } from '../../common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../../common/domain/enums/status-reporte.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { FileCleanupService } from '../../reportes/infrastructure/file-storage/file-cleanup.service';
import {
  DemoManifest,
  digest,
  requireLocalTarget,
  validateManifest,
  validatePhoto,
  uploadFile,
} from './reportes-demo/support';

config({ quiet: true });

interface ApiReport {
  id: string;
  status: StatusReporte;
  categoria: CategoriaReporte;
  localizacao: string;
  foto: string;
  descricao: string;
  autor?: { id: string };
}
interface Page {
  totalItems: number;
  data: ApiReport[];
}
interface Login {
  token: string;
  usuario: { id: string; tipo: string };
}

async function main() {
  requireLocalTarget(process.env, []);
  const root = resolve(__dirname, '../../..');
  process.chdir(root);
  process.env.DB_SYNCHRONIZE = 'false';
  const manifest = JSON.parse(
    await readFile(join(__dirname, 'reportes-demo/manifest.json'), 'utf8'),
  ) as DemoManifest;
  validateManifest(manifest);
  await dataSource.initialize();
  const prefeituraBefore = await dataSource
    .getRepository(UsuarioOrmEntity)
    .find({ where: { tipo: TipoUsuario.PREFEITURA }, order: { id: 'ASC' } });
  const reportsBefore = await dataSource
    .getRepository(ReporteOrmEntity)
    .find({ order: { id: 'ASC' } });
  assert.equal(
    reportsBefore.length,
    20,
    'Execute o seed antes da verificação.',
  );
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error'],
  });
  let temporaryId: string | undefined;
  let ownerToken: string | undefined;
  const checks: string[] = [];
  try {
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useStaticAssets(resolve(root, process.env.UPLOAD_DIR ?? 'uploads'), {
      prefix: '/uploads',
    });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function api<T>(
      path: string,
      options: RequestInit = {},
      status = 200,
    ): Promise<T> {
      const response = await fetch(base + path, options);
      assert.equal(
        response.status,
        status,
        `${options.method ?? 'GET'} ${path}: HTTP ${response.status}`,
      );
      return (status === 204 ? undefined : await response.json()) as T;
    }
    const authorization = (token: string) => ({
      Authorization: 'Bearer ' + token,
    });
    const tokens: string[] = [];
    for (const citizen of manifest.citizens) {
      const login = await api<Login>(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: citizen.email, senha: 'Testando123!' }),
        },
        201,
      );
      assert.equal(login.usuario.id, citizen.id);
      assert.equal(login.usuario.tipo, 'CIDADAO');
      await api('/api/auth/me', { headers: authorization(login.token) });
      assert.equal(
        reportsBefore.filter((r) => r.autorId === citizen.id).length,
        2,
      );
      tokens.push(login.token);
    }
    ownerToken = tokens[0];
    checks.push(
      '10 logins HTTP com Testando123!, perfis CIDADAO e 2 reportes por cidadão',
    );
    const active = await api<Page>('/api/reportes?limit=50');
    const resolved = await api<Page>('/api/reportes/resolvidos?limit=50');
    assert.equal(active.totalItems, 17);
    assert.equal(resolved.totalItems, 3);
    assert(active.data.every((r) => r.status !== StatusReporte.RESOLVIDO));
    assert(resolved.data.every((r) => r.status === StatusReporte.RESOLVIDO));
    checks.push('Feed ativo com 17 reportes e feed resolvido com 3');
    for (const category of [
      ...new Set(manifest.reports.map((r) => r.categoria)),
    ]) {
      const a = await api<Page>('/api/reportes?limit=50&categoria=' + category);
      const b = await api<Page>(
        '/api/reportes/resolvidos?limit=50&categoria=' + category,
      );
      assert.equal(a.totalItems + b.totalItems, 4);
      assert([...a.data, ...b.data].every((r) => r.categoria === category));
    }
    for (const r of manifest.reports) {
      const path =
        r.status === StatusReporte.RESOLVIDO
          ? '/api/reportes/resolvidos'
          : '/api/reportes';
      const filtered = await api<Page>(
        path +
          '?bairro=' +
          encodeURIComponent(r.bairro) +
          '&categoria=' +
          r.categoria,
      );
      assert.equal(filtered.totalItems, 1);
      assert.equal(filtered.data[0].id, r.id);
    }
    checks.push(
      'Filtros HTTP das 5 categorias e dos 20 bairros, incluindo filtros combinados',
    );
    const uploadDir = resolve(root, process.env.UPLOAD_DIR ?? 'uploads');
    for (const r of [...active.data, ...resolved.data]) {
      const expected = manifest.reports.find((x) => x.id === r.id)!;
      const response = await fetch(base + r.foto);
      assert.equal(response.status, 200);
      assert(response.headers.get('content-type')?.startsWith('image/jpeg'));
      validatePhoto(Buffer.from(await response.arrayBuffer()), expected.photo);
      const detail = await api<ApiReport>('/api/reportes/' + r.id, {
        headers: authorization(
          tokens[manifest.citizens.findIndex((c) => c.id === expected.autorId)],
        ),
      });
      assert.equal(detail.autor?.id, expected.autorId);
    }
    assert.equal(
      (await fetch(base + '/uploads/reportes-demo-creditos.html')).status,
      200,
    );
    checks.push(
      '20 imagens HTTP 200 com hash correto, detalhes acessíveis pelos autores e créditos públicos',
    );
    const prefeituraLogin = await api<Login>(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: process.env.PREFEITURA_EMAIL ?? 'prefeitura@cidades.gov.br',
          senha: process.env.PREFEITURA_SENHA ?? 'admin123',
        }),
      },
      201,
    );
    const dashboard = await api<{
      totalReportes: number;
      porStatus: Record<string, number>;
      porCategoria: Record<string, number>;
    }>('/api/dashboard/resumo', {
      headers: authorization(prefeituraLogin.token),
    });
    assert.equal(dashboard.totalReportes, 20);
    assert.deepEqual(dashboard.porStatus, {
      ABERTO: 12,
      EM_ANDAMENTO: 5,
      RESOLVIDO: 3,
    });
    assert(Object.values(dashboard.porCategoria).every((n) => n === 4));
    await api(
      '/api/dashboard/resumo',
      { headers: authorization(tokens[0]) },
      403,
    );
    checks.push(
      'Dashboard HTTP com 20 reportes, categorias 4/4/4/4/4, status 12/5/3 e autorização preservada',
    );
    // Exercise ownership using a disposable report, never deleting a seeded report.
    const file = await readFile(uploadFile(uploadDir, reportsBefore[0].foto));
    const form = new FormData();
    form.set(
      'foto',
      new Blob([new Uint8Array(file)], { type: 'image/jpeg' }),
      'teste.jpg',
    );
    form.set('descricao', 'Verificação temporária do seed demonstrativo.');
    form.set('categoria', 'OUTROS');
    form.set('localizacao', 'Sorocaba - SP (verificação temporária)');
    const temporary = await api<{ id: string }>(
      '/api/reportes',
      { method: 'POST', headers: authorization(tokens[0]), body: form },
      201,
    );
    temporaryId = temporary.id;
    await api(
      '/api/reportes/' + temporaryId,
      {
        method: 'PATCH',
        headers: {
          ...authorization(tokens[1]),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ descricao: 'Alteração não autorizada.' }),
      },
      403,
    );
    await api(
      '/api/reportes/' + temporaryId,
      { method: 'DELETE', headers: authorization(tokens[1]) },
      403,
    );
    const edit = new FormData();
    edit.set(
      'descricao',
      'Verificação temporária: edição pelo próprio cidadão.',
    );
    await api('/api/reportes/' + temporaryId, {
      method: 'PATCH',
      headers: authorization(tokens[0]),
      body: edit,
    });
    await api(
      '/api/reportes/' + temporaryId,
      { method: 'DELETE', headers: authorization(tokens[0]) },
      204,
    );
    temporaryId = undefined;
    await app.get(FileCleanupService).flush();
    checks.push(
      'Criação, edição e exclusão HTTP pelo proprietário; outro cidadão recebe 403; reporte temporário removido',
    );
    const reportsAfter = await dataSource
      .getRepository(ReporteOrmEntity)
      .find({ order: { id: 'ASC' } });
    const prefeituraAfter = await dataSource
      .getRepository(UsuarioOrmEntity)
      .find({ where: { tipo: TipoUsuario.PREFEITURA }, order: { id: 'ASC' } });
    assert.deepEqual(reportsAfter, reportsBefore);
    assert.deepEqual(prefeituraAfter, prefeituraBefore);
    const inventories = (
      await readdir(join(root, '.cache/reportes-demo'))
    ).filter((n) => n.startsWith('before-'));
    for (const name of inventories) {
      const inventory = JSON.parse(
        await readFile(join(root, '.cache/reportes-demo', name), 'utf8'),
      ) as { prefeituraFingerprint: string };
      assert.equal(
        digest(JSON.stringify(prefeituraAfter)),
        inventory.prefeituraFingerprint,
      );
    }
    const [integrity] = await dataSource.query<
      Record<string, number | string>[]
    >(`SELECT
      (SELECT COUNT(*) FROM reportes r LEFT JOIN usuarios u ON u.id=r.autor_id WHERE u.id IS NULL OR u.tipo <> 'CIDADAO') AS invalidAuthors,
      (SELECT COUNT(*) FROM alertas a LEFT JOIN reportes r ON r.id=a.reporte_id LEFT JOIN usuarios u ON u.id=a.usuario_id WHERE r.id IS NULL OR u.id IS NULL) AS orphanAlerts,
      (SELECT COUNT(*) FROM pending_file_deletions) AS pending,
      (SELECT COUNT(*) FROM alertas) AS alerts`);
    assert(Object.values(integrity).every((n) => Number(n) === 0));
    const images = (await readdir(uploadDir)).filter((n) =>
      /\.(jpg|jpeg|png|webp)$/i.test(n),
    );
    assert.equal(images.length, 20);
    assert(
      images.every((n) => reportsAfter.some((r) => r.foto === '/uploads/' + n)),
    );
    checks.push(
      '20 arquivos de imagem referenciados; nenhum arquivo órfão, alerta antigo ou limpeza pendente',
    );
    checks.push(
      'Prefeitura idêntica ao inventário anterior ao seed, incluindo hash de senha, perfil e permissões',
    );
    const result = {
      verifiedAt: new Date().toISOString(),
      checks,
      citizens: manifest.citizens.length,
      reports: reportsAfter.length,
      integrity,
    };
    await writeFile(
      join(root, '.cache/reportes-demo/verification.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (temporaryId && ownerToken) {
      const base = await app.getUrl();
      const response = await fetch(base + '/api/reportes/' + temporaryId, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + ownerToken },
      });
      if (response.status !== 204)
        console.error('Reporte de verificação pendente: ' + temporaryId);
      await app.get(FileCleanupService).flush();
    }
    await app.close();
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Falha na verificação.',
  );
  process.exitCode = 1;
});
