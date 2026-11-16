import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EditarReporteDto } from '../application/dto/editar-reporte.dto';
import { EditarReporteUseCase } from '../application/use-cases/editar-reporte.use-case';
import { ExcluirReporteUseCase } from '../application/use-cases/excluir-reporte.use-case';
import {
  CriarAlertaUseCase,
  RemoverAlertaUseCase,
} from '../../alertas/application/use-cases/alerta.use-cases';
import { RequireTipo } from '../../common/decorators/require-tipo.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TipoUsuario } from '../../common/domain/enums/tipo-usuario.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { TipoUsuarioGuard } from '../../common/guards/tipo-usuario.guard';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AlterarStatusDto } from '../application/dto/alterar-status.dto';
import { CriarReporteDto } from '../application/dto/criar-reporte.dto';
import { ListarReportesQueryDto } from '../application/dto/listar-reportes-query.dto';
import { AlterarStatusUseCase } from '../application/use-cases/alterar-status.use-case';
import { CriarReporteUseCase } from '../application/use-cases/criar-reporte.use-case';
import {
  GetReporteUseCase,
  ListarReportesUseCase,
  ListarResolvidosUseCase,
} from '../application/use-cases/listar-reportes.use-case';

@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly criarReporteUseCase: CriarReporteUseCase,
    private readonly listarReportesUseCase: ListarReportesUseCase,
    private readonly listarResolvidosUseCase: ListarResolvidosUseCase,
    private readonly getReporteUseCase: GetReporteUseCase,
    private readonly alterarStatusUseCase: AlterarStatusUseCase,
    private readonly criarAlertaUseCase: CriarAlertaUseCase,
    private readonly removerAlertaUseCase: RemoverAlertaUseCase,
    private readonly editarReporteUseCase: EditarReporteUseCase,
    private readonly excluirReporteUseCase: ExcluirReporteUseCase,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, TipoUsuarioGuard)
  @RequireTipo(TipoUsuario.CIDADAO)
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  criar(
    @Body() dto: CriarReporteDto,
    @UploadedFile() foto: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.criarReporteUseCase.execute(dto, user.id, foto);
  }

  @Get()
  @UseGuards(OptionalJwtGuard)
  listar(
    @Query() query: ListarReportesQueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.listarReportesUseCase.execute(query, user?.id ?? null);
  }

  @Get('resolvidos')
  @UseGuards(OptionalJwtGuard)
  listarResolvidos(
    @Query() query: ListarReportesQueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.listarResolvidosUseCase.execute(query, user?.id ?? null);
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  detalhe(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.getReporteUseCase.execute(id, user?.id ?? null);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, TipoUsuarioGuard)
  @RequireTipo(TipoUsuario.PREFEITURA)
  alterarStatus(@Param('id') id: string, @Body() dto: AlterarStatusDto) {
    return this.alterarStatusUseCase.execute(id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TipoUsuarioGuard)
  @RequireTipo(TipoUsuario.CIDADAO)
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  editar(
    @Param('id') id: string,
    @Body() dto: EditarReporteDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.editarReporteUseCase.execute(id, dto, user, foto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, TipoUsuarioGuard)
  @RequireTipo(TipoUsuario.CIDADAO)
  excluir(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.excluirReporteUseCase.execute(id, user);
  }

  @Post(':id/alertas')
  @UseGuards(JwtAuthGuard, TipoUsuarioGuard)
  @RequireTipo(TipoUsuario.CIDADAO)
  criarAlerta(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.criarAlertaUseCase.execute(id, user.id);
  }

  @Delete(':id/alertas')
  @UseGuards(JwtAuthGuard, TipoUsuarioGuard)
  @RequireTipo(TipoUsuario.CIDADAO)
  removerAlerta(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.removerAlertaUseCase.execute(id, user.id);
  }
}
