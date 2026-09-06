import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireTipo } from '../../common/decorators/require-tipo.decorator';
import { TipoUsuario } from '../../common/domain/enums/tipo-usuario.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TipoUsuarioGuard } from '../../common/guards/tipo-usuario.guard';
import { GetDashboardResumoUseCase } from '../application/use-cases/get-dashboard-resumo.use-case';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly getDashboardResumoUseCase: GetDashboardResumoUseCase,
  ) {}

  @Get('resumo')
  @UseGuards(JwtAuthGuard, TipoUsuarioGuard)
  @RequireTipo(TipoUsuario.PREFEITURA)
  resumo() {
    return this.getDashboardResumoUseCase.execute();
  }
}
