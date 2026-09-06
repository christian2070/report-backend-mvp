import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertaOrmEntity } from '../alertas/infrastructure/persistence/alerta.orm-entity';
import { ALERTA_REPOSITORY } from '../alertas/domain/ports/alerta.repository.port';
import { AlertaRepository } from '../alertas/infrastructure/persistence/alerta.repository';
import {
  CriarAlertaUseCase,
  RemoverAlertaUseCase,
} from '../alertas/application/use-cases/alerta.use-cases';
import { CommonModule } from '../common/common.module';
import { REPORTE_REPOSITORY } from './domain/ports/reporte.repository.port';
import { AlterarStatusUseCase } from './application/use-cases/alterar-status.use-case';
import { CriarReporteUseCase } from './application/use-cases/criar-reporte.use-case';
import {
  GetReporteUseCase,
  ListarReportesUseCase,
  ListarResolvidosUseCase,
} from './application/use-cases/listar-reportes.use-case';
import { FileStorageService } from './infrastructure/file-storage/file-storage.service';
import { ReporteOrmEntity } from './infrastructure/persistence/reporte.orm-entity';
import { ReporteRepository } from './infrastructure/persistence/reporte.repository';
import { ReportesController } from './presentation/reportes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReporteOrmEntity, AlertaOrmEntity]),
    CommonModule,
  ],
  controllers: [ReportesController],
  providers: [
    CriarReporteUseCase,
    ListarReportesUseCase,
    ListarResolvidosUseCase,
    GetReporteUseCase,
    AlterarStatusUseCase,
    CriarAlertaUseCase,
    RemoverAlertaUseCase,
    FileStorageService,
    {
      provide: REPORTE_REPOSITORY,
      useClass: ReporteRepository,
    },
    {
      provide: ALERTA_REPOSITORY,
      useClass: AlertaRepository,
    },
  ],
  exports: [REPORTE_REPOSITORY],
})
export class ReportesModule {}
