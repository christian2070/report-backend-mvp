import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type RequestWithUser = {
  headers: { authorization?: string };
  user?: AuthenticatedUser | null;
};

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      request.user = null;
      return true;
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.user = { id: payload.sub, tipo: payload.tipo };
    } catch {
      request.user = null;
    }

    return true;
  }
}
