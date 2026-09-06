import {
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TipoUsuario } from '../../../common/domain/enums/tipo-usuario.enum';
import type { UsuarioRepositoryPort } from '../../domain/ports/usuario.repository.port';
import {
  USUARIO_REPOSITORY,
} from '../../domain/ports/usuario.repository.port';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class RegisterCidadaoUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepositoryPort,
  ) {}

  async execute(dto: RegisterDto) {
    const exists = await this.usuarioRepository.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(dto.senha, 10);

    const usuario = await this.usuarioRepository.create({
      nome: dto.nome,
      email: dto.email,
      senha: hashedPassword,
      tipo: TipoUsuario.CIDADAO,
      bairro: dto.bairro ?? null,
    });

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      bairro: usuario.bairro,
      createdAt: usuario.createdAt,
    };
  }
}
