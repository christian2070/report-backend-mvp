import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoUsuario } from '../../../common/domain/enums/tipo-usuario.enum';
import { USUARIO_REPOSITORY } from '../../domain/ports/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../domain/ports/usuario.repository.port';
import { UpdateMeDto } from '../dto/update-me.dto';

@Injectable()
export class UpdateMeUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly repository: UsuarioRepositoryPort,
  ) {}

  async execute(userId: string, dto: UpdateMeDto) {
    const usuario = await this.repository.findById(userId);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    if (dto.bairro !== undefined && usuario.tipo !== TipoUsuario.CIDADAO) {
      throw new BadRequestException(
        'Bairro está disponível apenas para cidadãos',
      );
    }
    if (dto.email !== undefined) {
      const existing = await this.repository.findByEmail(dto.email);
      if (existing && existing.id !== userId)
        throw new ConflictException('E-mail já cadastrado');
    }
    const updated = await this.repository.updateProfile(userId, {
      ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.bairro !== undefined ? { bairro: dto.bairro || null } : {}),
    });
    return {
      id: updated.id,
      nome: updated.nome,
      email: updated.email,
      bairro: updated.bairro,
      tipo: updated.tipo,
    };
  }
}
