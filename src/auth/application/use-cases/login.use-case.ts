import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import type { UsuarioRepositoryPort } from '../../domain/ports/usuario.repository.port';
import {
  USUARIO_REPOSITORY,
} from '../../domain/ports/usuario.repository.port';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginDto) {
    const usuario = await this.usuarioRepository.findByEmail(dto.email);

    if (!usuario) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const payload: JwtPayload = { sub: usuario.id, tipo: usuario.tipo };
    const token = this.jwtService.sign(payload);

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        tipo: usuario.tipo,
      },
    };
  }
}
