import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ReportesModule } from '../reportes/reportes.module';
import { GetDashboardResumoUseCase } from './application/use-cases/get-dashboard-resumo.use-case';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  imports: [ReportesModule, CommonModule],
  controllers: [DashboardController],
  providers: [GetDashboardResumoUseCase],
})
export class DashboardModule {}
