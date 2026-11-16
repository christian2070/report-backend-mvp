import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { PendingFileDeletionOrmEntity } from '../reportes/infrastructure/file-storage/pending-file-deletion.orm-entity';
import { AlertaOrmEntity } from '../alertas/infrastructure/persistence/alerta.orm-entity';
import { UsuarioOrmEntity } from '../auth/infrastructure/persistence/usuario.orm-entity';
import { ReporteOrmEntity } from '../reportes/infrastructure/persistence/reporte.orm-entity';

config();

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'cidades_inteligentes',
  entities: [
    UsuarioOrmEntity,
    ReporteOrmEntity,
    AlertaOrmEntity,
    PendingFileDeletionOrmEntity,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
