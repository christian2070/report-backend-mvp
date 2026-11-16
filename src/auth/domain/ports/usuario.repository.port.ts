import { TipoUsuario } from '../../../common/domain/enums/tipo-usuario.enum';
import { Usuario } from '../entities/usuario.entity';

export interface CreateUsuarioData {
  nome: string;
  email: string;
  senha: string;
  tipo: TipoUsuario;
  bairro?: string | null;
}

export interface UsuarioRepositoryPort {
  findByEmail(email: string): Promise<Usuario | null>;
  findById(id: string): Promise<Usuario | null>;
  create(data: CreateUsuarioData): Promise<Usuario>;
  existsByEmail(email: string): Promise<boolean>;
  updateProfile(
    id: string,
    data: { nome?: string; email?: string; bairro?: string | null },
  ): Promise<Usuario>;
  updatePassword(
    id: string,
    currentHash: string,
    newHash: string,
  ): Promise<boolean>;
}

export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
