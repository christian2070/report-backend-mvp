import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioRepositoryPort } from '../../domain/ports/usuario.repository.port';
import {
  USUARIO_REPOSITORY,
} from '../../domain/ports/usuario.repository.port';

@Injectable()
export class GetMeUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepositoryPort,
  ) {}

  async execute(userId: string) {
    const usuario = await this.usuarioRepository.findById(userId);

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      bairro: usuario.bairro,
    };
  }
}
