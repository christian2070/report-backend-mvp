import { SetMetadata } from '@nestjs/common';
import { TipoUsuario } from '../domain/enums/tipo-usuario.enum';

export const REQUIRE_TIPO_KEY = 'requireTipo';

export const RequireTipo = (...tipos: TipoUsuario[]) =>
  SetMetadata(REQUIRE_TIPO_KEY, tipos);
