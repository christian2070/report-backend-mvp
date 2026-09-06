import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';

export class ListarReportesQueryDto {
  @IsOptional()
  @IsIn(['alertas', 'recentes'])
  ordenacao?: 'alertas' | 'recentes';

  @IsOptional()
  @IsEnum(CategoriaReporte)
  categoria?: CategoriaReporte;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsEnum(StatusReporte)
  status?: StatusReporte;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
