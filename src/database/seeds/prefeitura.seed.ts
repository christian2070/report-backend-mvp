import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AlertaOrmEntity } from '../../alertas/infrastructure/persistence/alerta.orm-entity';
import { UsuarioOrmEntity } from '../../auth/infrastructure/persistence/usuario.orm-entity';
import { TipoUsuario } from '../../common/domain/enums/tipo-usuario.enum';
import { ReporteOrmEntity } from '../../reportes/infrastructure/persistence/reporte.orm-entity';

config();

async function seed() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'cidades_inteligentes',
    entities: [UsuarioOrmEntity, ReporteOrmEntity, AlertaOrmEntity],
    synchronize: false,
  });

  await dataSource.initialize();

  const usuarioRepo = dataSource.getRepository(UsuarioOrmEntity);

  const email = process.env.PREFEITURA_EMAIL ?? 'prefeitura@cidades.gov.br';
  const existing = await usuarioRepo.findOne({ where: { email } });

  if (existing) {
    console.log('Conta da prefeitura já existe. Seed ignorado.');
    await dataSource.destroy();
    return;
  }

  const senha = process.env.PREFEITURA_SENHA ?? 'admin123';
  const hashedPassword = await bcrypt.hash(senha, 10);

  await usuarioRepo.save({
    nome: process.env.PREFEITURA_NOME ?? 'Prefeitura Municipal',
    email,
    senha: hashedPassword,
    tipo: TipoUsuario.PREFEITURA,
    bairro: null,
  });

  console.log('Conta da prefeitura criada com sucesso.');
  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Erro ao executar seed:', error);
  process.exit(1);
});
