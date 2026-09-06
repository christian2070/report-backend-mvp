import { TipoUsuario } from '../../../common/domain/enums/tipo-usuario.enum';

export class Usuario {
  constructor(
    public readonly id: string,
    public readonly nome: string,
    public readonly email: string,
    public readonly senha: string,
    public readonly tipo: TipoUsuario,
    public readonly bairro: string | null,
    public readonly createdAt: Date,
  ) {}
}
