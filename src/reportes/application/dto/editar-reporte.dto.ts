import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';

export class EditarReporteDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  descricao?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(CategoriaReporte)
  categoria?: CategoriaReporte;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  localizacao?: string;
}
