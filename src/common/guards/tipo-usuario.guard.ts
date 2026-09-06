import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_TIPO_KEY } from '../decorators/require-tipo.decorator';
import { TipoUsuario } from '../domain/enums/tipo-usuario.enum';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TipoUsuarioGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTipos = this.reflector.getAllAndOverride<TipoUsuario[]>(
      REQUIRE_TIPO_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredTipos?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !requiredTipos.includes(user.tipo)) {
      throw new ForbiddenException('Acesso negado para este tipo de usuário');
    }

    return true;
  }
}
