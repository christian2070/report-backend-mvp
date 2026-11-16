import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { USUARIO_REPOSITORY } from '../../domain/ports/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../domain/ports/usuario.repository.port';
import { ChangePasswordDto } from '../dto/change-password.dto';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly repository: UsuarioRepositoryPort,
  ) {}

  async execute(userId: string, dto: ChangePasswordDto) {
    if (dto.novaSenha !== dto.confirmarNovaSenha)
      throw new BadRequestException('As senhas não coincidem');
    const usuario = await this.repository.findById(userId);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    if (!(await bcrypt.compare(dto.senhaAtual, usuario.senha))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    const hash = await bcrypt.hash(dto.novaSenha, 10);
    const changed = await this.repository.updatePassword(
      userId,
      usuario.senha,
      hash,
    );
    if (!changed)
      throw new BadRequestException(
        'A senha foi alterada. Informe a senha atual e tente novamente',
      );
    return { message: 'Senha alterada com sucesso' };
  }
}
