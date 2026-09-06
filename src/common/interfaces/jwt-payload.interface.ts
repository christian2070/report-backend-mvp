import { TipoUsuario } from '../domain/enums/tipo-usuario.enum';

export interface JwtPayload {
  sub: string;
  tipo: TipoUsuario;
}

export interface AuthenticatedUser {
  id: string;
  tipo: TipoUsuario;
}
