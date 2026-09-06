import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ReporteRepositoryPort } from '../../domain/ports/reporte.repository.port';
import {
  REPORTE_REPOSITORY,
} from '../../domain/ports/reporte.repository.port';
import { CriarReporteDto } from '../dto/criar-reporte.dto';
import { toReporteResponse } from '../mappers/reporte.mapper';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';

@Injectable()
export class CriarReporteUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepository: ReporteRepositoryPort,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(
    dto: CriarReporteDto,
    autorId: string,
    foto?: Express.Multer.File,
  ) {
    if (!foto) {
      throw new BadRequestException('Foto é obrigatória');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(foto.mimetype)) {
      throw new BadRequestException(
        'Formato de imagem inválido. Use JPEG, PNG ou WebP',
      );
    }

    const fotoUrl = this.fileStorageService.saveFile(foto);

    const reporte = await this.reporteRepository.create({
      foto: fotoUrl,
      descricao: dto.descricao,
      categoria: dto.categoria,
      localizacao: dto.localizacao,
      autorId,
    });

    return toReporteResponse(reporte, true);
  }
}
