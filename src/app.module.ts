import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertaOrmEntity } from './alertas/infrastructure/persistence/alerta.orm-entity';
import { AuthModule } from './auth/auth.module';
import { UsuarioOrmEntity } from './auth/infrastructure/persistence/usuario.orm-entity';
import databaseConfig from './config/database.config';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReporteOrmEntity } from './reportes/infrastructure/persistence/reporte.orm-entity';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [UsuarioOrmEntity, ReporteOrmEntity, AlertaOrmEntity],
        synchronize: configService.get<boolean>('database.synchronize'),
      }),
    }),
    AuthModule,
    ReportesModule,
    DashboardModule,
  ],
})
export class AppModule {}
