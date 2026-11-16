import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { Server } from 'http';
import { AuthController } from './auth/presentation/auth.controller';
import { JwtStrategy } from './auth/infrastructure/jwt/jwt.strategy';
import {
  USUARIO_REPOSITORY,
  UsuarioRepositoryPort,
} from './auth/domain/ports/usuario.repository.port';
import { Usuario } from './auth/domain/entities/usuario.entity';
import { RegisterCidadaoUseCase } from './auth/application/use-cases/register-cidadao.use-case';
import { LoginUseCase } from './auth/application/use-cases/login.use-case';
import { GetMeUseCase } from './auth/application/use-cases/get-me.use-case';
import { UpdateMeUseCase } from './auth/application/use-cases/update-me.use-case';
import { ChangePasswordUseCase } from './auth/application/use-cases/change-password.use-case';
import { TipoUsuario } from './common/domain/enums/tipo-usuario.enum';
import { StatusReporte } from './common/domain/enums/status-reporte.enum';
import { CategoriaReporte } from './common/domain/enums/categoria-reporte.enum';
import { TipoUsuarioGuard } from './common/guards/tipo-usuario.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ReportesController } from './reportes/presentation/reportes.controller';
import {
  REPORTE_REPOSITORY,
  ReporteRepositoryPort,
} from './reportes/domain/ports/reporte.repository.port';
import {
  Reporte,
  ReporteAutor,
} from './reportes/domain/entities/reporte.entity';
import { authorizeReporte } from './reportes/domain/authorize-reporte';
import { EditarReporteUseCase } from './reportes/application/use-cases/editar-reporte.use-case';
import { ExcluirReporteUseCase } from './reportes/application/use-cases/excluir-reporte.use-case';
import { CriarReporteUseCase } from './reportes/application/use-cases/criar-reporte.use-case';
import { AlterarStatusUseCase } from './reportes/application/use-cases/alterar-status.use-case';
import {
  GetReporteUseCase,
  ListarReportesUseCase,
  ListarResolvidosUseCase,
} from './reportes/application/use-cases/listar-reportes.use-case';
import {
  CriarAlertaUseCase,
  RemoverAlertaUseCase,
} from './alertas/application/use-cases/alerta.use-cases';
import { FileStorageService } from './reportes/infrastructure/file-storage/file-storage.service';
import { FileCleanupService } from './reportes/infrastructure/file-storage/file-cleanup.service';

jest.mock('uuid', () => ({ v4: () => 'test-upload-id' }));

describe('Feature endpoints (HTTP, JWT, validation and use cases)', () => {
  let app: INestApplication<Server>;
  let jwt: JwtService;
  let users: Map<string, Usuario>;
  let report: Reporte | null;
  let repository: jest.Mocked<ReporteRepositoryPort>;
  let userRepository: jest.Mocked<UsuarioRepositoryPort>;
  const storage = { saveFile: jest.fn(() => '/uploads/new.jpg') };
  const cleanup = { flush: jest.fn(), discardUncommitted: jest.fn() };
  const owner = { id: 'owner', tipo: TipoUsuario.CIDADAO };
  const city = { id: 'city', tipo: TipoUsuario.PREFEITURA };

  const token = (user = owner) => jwt.sign({ sub: user.id, tipo: user.tipo });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    userRepository = {
      findById: jest.fn((id) => Promise.resolve(users.get(id) ?? null)),
      findByEmail: jest.fn((email) =>
        Promise.resolve(
          [...users.values()].find((user) => user.email === email) ?? null,
        ),
      ),
      existsByEmail: jest.fn((email) =>
        Promise.resolve(
          [...users.values()].some((user) => user.email === email),
        ),
      ),
      create: jest.fn(),
      updateProfile: jest.fn((id, data) => {
        const updated = Object.assign(
          Object.create(Usuario.prototype) as Usuario,
          users.get(id),
          data,
        );
        users.set(id, updated);
        return Promise.resolve(updated);
      }),
      updatePassword: jest.fn((id, current, hash) => {
        const user = users.get(id);
        if (!user || user.senha !== current) return Promise.resolve(false);
        users.set(
          id,
          new Usuario(
            user.id,
            user.nome,
            user.email,
            hash,
            user.tipo,
            user.bairro,
            user.createdAt,
          ),
        );
        return Promise.resolve(true);
      }),
    };
    repository = {
      create: jest.fn(),
      findById: jest.fn<
        ReturnType<ReporteRepositoryPort['findById']>,
        Parameters<ReporteRepositoryPort['findById']>
      >(() => Promise.resolve(report)),
      listar: jest.fn(),
      updateStatus: jest.fn(),
      countByStatus: jest.fn(),
      countByCategoria: jest.fn(),
      countTotal: jest.fn(),
      updateOwned: jest.fn((_, id, data) => {
        authorizeReporte(report, id, true);
        report = Object.assign(
          Object.create(Reporte.prototype) as Reporte,
          report,
          Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          ),
        );
        return Promise.resolve(report);
      }),
      deleteOwned: jest.fn((_, id) => {
        authorizeReporte(report, id, false);
        report = null;
        return Promise.resolve();
      }),
    };
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: 'test-only-secret' }),
      ],
      controllers: [AuthController, ReportesController],
      providers: [
        JwtStrategy,
        TipoUsuarioGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: 'test-only-secret' }),
        },
        { provide: USUARIO_REPOSITORY, useValue: userRepository },
        { provide: REPORTE_REPOSITORY, useValue: repository },
        { provide: FileStorageService, useValue: storage },
        { provide: FileCleanupService, useValue: cleanup },
        RegisterCidadaoUseCase,
        LoginUseCase,
        GetMeUseCase,
        UpdateMeUseCase,
        ChangePasswordUseCase,
        EditarReporteUseCase,
        ExcluirReporteUseCase,
        CriarReporteUseCase,
        AlterarStatusUseCase,
        GetReporteUseCase,
        { provide: ListarReportesUseCase, useValue: {} },
        { provide: ListarResolvidosUseCase, useValue: {} },
        { provide: CriarAlertaUseCase, useValue: {} },
        { provide: RemoverAlertaUseCase, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    jwt = module.get(JwtService);
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const hash = await bcrypt.hash('current123', 4);
    users = new Map([
      [
        'owner',
        new Usuario(
          'owner',
          'Ana',
          'ana@example.com',
          hash,
          TipoUsuario.CIDADAO,
          'Centro',
          new Date(),
        ),
      ],
      [
        'city',
        new Usuario(
          'city',
          'Prefeitura',
          'city@example.com',
          hash,
          TipoUsuario.PREFEITURA,
          null,
          new Date(),
        ),
      ],
    ]);
    report = new Reporte(
      'report',
      '/uploads/old.jpg',
      'Lâmpada apagada',
      CategoriaReporte.ILUMINACAO,
      'Rua A',
      StatusReporte.ABERTO,
      'owner',
      new Date(),
      new Date(),
      new ReporteAutor('owner', 'Ana'),
      7,
      false,
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(['/api/auth/me', '/api/auth/me/password', '/api/reportes/report'])(
    'rejects unauthenticated PATCH %s',
    async (path) => {
      await http().patch(path).send({}).expect(401);
    },
  );

  it('rejects unauthenticated DELETE', async () => {
    await http().delete('/api/reportes/report').expect(401);
  });

  it.each([owner, city])(
    'updates only the JWT owner profile for $tipo and keeps the session',
    async (user) => {
      const response = await http()
        .patch('/api/auth/me')
        .auth(token(user), { type: 'bearer' })
        .send({
          nome: 'Novo nome',
          email: 'new@example.com',
          ...(user.tipo === TipoUsuario.CIDADAO ? { bairro: '' } : {}),
        })
        .expect(200);
      expect(response.body).toEqual({
        id: user.id,
        nome: 'Novo nome',
        email: 'new@example.com',
        bairro: null,
        tipo: user.tipo,
      });
      expect(response.body).not.toHaveProperty('senha');
      await http()
        .get('/api/auth/me')
        .auth(token(user), { type: 'bearer' })
        .expect(200);
      expect(users.get(user.id === 'owner' ? 'city' : 'owner')?.nome).not.toBe(
        'Novo nome',
      );
    },
  );

  it('returns 409 for another user email and permits keeping own email', async () => {
    await http()
      .patch('/api/auth/me')
      .auth(token(), { type: 'bearer' })
      .send({ email: 'city@example.com' })
      .expect(409);
    await http()
      .patch('/api/auth/me')
      .auth(token(), { type: 'bearer' })
      .send({ email: 'ana@example.com' })
      .expect(200);
  });

  it.each(['id', 'tipo', 'senha', 'createdAt'])(
    'rejects protected profile field %s',
    async (field) => {
      await http()
        .patch('/api/auth/me')
        .auth(token(), { type: 'bearer' })
        .send({ [field]: 'alterado' })
        .expect(400);
      expect(userRepository.updateProfile.mock.calls).toHaveLength(0);
    },
  );

  it.each([
    { nome: ' ' },
    { email: 'invalid' },
    { bairro: null },
    { nome: null },
  ])('rejects invalid profile data %j', async (data) => {
    await http()
      .patch('/api/auth/me')
      .auth(token(), { type: 'bearer' })
      .send(data)
      .expect(400);
  });

  it('rejects neighborhood changes for prefeitura', async () => {
    await http()
      .patch('/api/auth/me')
      .auth(token(city), { type: 'bearer' })
      .send({ bairro: 'Centro' })
      .expect(400);
  });

  it.each([owner, city])(
    'changes password with bcrypt for $tipo and preserves JWT',
    async (user) => {
      const auth = token(user);
      const response = await http()
        .patch('/api/auth/me/password')
        .auth(auth, { type: 'bearer' })
        .send({
          senhaAtual: 'current123',
          novaSenha: 'new123456',
          confirmarNovaSenha: 'new123456',
        })
        .expect(200);
      expect(response.body).toEqual({ message: 'Senha alterada com sucesso' });
      const hash = users.get(user.id)!.senha;
      expect(hash).not.toBe('new123456');
      expect(await bcrypt.compare('new123456', hash)).toBe(true);
      expect(await bcrypt.compare('current123', hash)).toBe(false);
      await http()
        .get('/api/auth/me')
        .auth(auth, { type: 'bearer' })
        .expect(200);
      await http()
        .post('/api/auth/login')
        .send({ email: users.get(user.id)!.email, senha: 'new123456' })
        .expect(201);
      await http()
        .post('/api/auth/login')
        .send({ email: users.get(user.id)!.email, senha: 'current123' })
        .expect(401);
    },
  );

  it.each([
    {
      senhaAtual: 'wrong',
      novaSenha: 'new123456',
      confirmarNovaSenha: 'new123456',
    },
    {
      senhaAtual: 'current123',
      novaSenha: 'new123456',
      confirmarNovaSenha: 'mismatch',
    },
    { senhaAtual: 'current123', novaSenha: '123', confirmarNovaSenha: '123' },
    { novaSenha: 'new123456', confirmarNovaSenha: 'new123456' },
  ])('rejects invalid password request without changing hash', async (data) => {
    await http()
      .patch('/api/auth/me/password')
      .auth(token(), { type: 'bearer' })
      .send(data)
      .expect(400);
    expect(userRepository.updatePassword.mock.calls).toHaveLength(0);
  });

  it('updates a report without replacing photo and preserves protected fields', async () => {
    const original = report!;
    const response = await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .send({
        descricao: 'Nova descrição',
        categoria: CategoriaReporte.LIXO,
        localizacao: 'Rua B',
      })
      .expect(200);
    expect(response.body).toMatchObject({
      descricao: 'Nova descrição',
      foto: original.foto,
      status: original.status,
      totalAlertas: 7,
      autor: { id: 'owner' },
      createdAt: original.createdAt.toISOString(),
    });
    expect(storage.saveFile).not.toHaveBeenCalled();
  });

  it('optionally replaces the report photo', async () => {
    await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .field('descricao', 'Nova descrição')
      .attach('foto', Buffer.from('image'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(200);
    expect(report?.foto).toBe('/uploads/new.jpg');
    expect(cleanup.flush).toHaveBeenCalled();
  });

  it.each([city, { id: 'other', tipo: TipoUsuario.CIDADAO }])(
    'rejects edit and delete by $id',
    async (user) => {
      await http()
        .patch('/api/reportes/report')
        .auth(token(user), { type: 'bearer' })
        .send({ descricao: 'Texto' })
        .expect(403);
      await http()
        .delete('/api/reportes/report')
        .auth(token(user), { type: 'bearer' })
        .expect(403);
      expect(storage.saveFile).not.toHaveBeenCalled();
      expect(report).not.toBeNull();
    },
  );

  it('blocks edits of resolved reports while permitting owner deletion', async () => {
    report = Object.assign(
      Object.create(Reporte.prototype) as Reporte,
      report,
      { status: StatusReporte.RESOLVIDO },
    );
    await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .send({ descricao: 'Texto' })
      .expect(400);
    await http()
      .delete('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .expect(204);
    expect(report).toBeNull();
    await http().get('/api/reportes/report').expect(404);
  });

  it('returns 404 for missing reports', async () => {
    report = null;
    await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .send({ descricao: 'Texto' })
      .expect(404);
    await http()
      .delete('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .expect(404);
  });

  it.each([
    { descricao: ' ' },
    { descricao: 'a'.repeat(301) },
    { localizacao: '' },
    { categoria: 'INVALID' },
    { status: 'RESOLVIDO' },
    { autorId: 'other' },
    { descricao: null },
  ])('rejects invalid or protected report fields %j', async (data) => {
    await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .send(data)
      .expect(400);
    expect(repository.updateOwned.mock.calls).toHaveLength(0);
  });

  it('rejects invalid or oversized photo uploads', async () => {
    await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .attach('foto', Buffer.from('text'), {
        filename: 'photo.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .attach('foto', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);
  });

  it('discards a new upload when persistence fails', async () => {
    repository.updateOwned.mockRejectedValueOnce(new Error('db failure'));
    await http()
      .patch('/api/reportes/report')
      .auth(token(), { type: 'bearer' })
      .attach('foto', Buffer.from('image'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(500);
    expect(cleanup.discardUncommitted).toHaveBeenCalledWith('/uploads/new.jpg');
    expect(report?.foto).toBe('/uploads/old.jpg');
  });
});
