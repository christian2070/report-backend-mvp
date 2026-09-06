import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';

export class CriarReporteDto {
  @IsString()
  descricao: string;

  @IsEnum(CategoriaReporte, {
    message:
      'Categoria inválida. Valores aceitos: ILUMINACAO, BURACO_PAVIMENTACAO, LIXO, SINALIZACAO, OUTROS',
  })
  categoria: CategoriaReporte;

  @IsString()
  localizacao: string;
}
