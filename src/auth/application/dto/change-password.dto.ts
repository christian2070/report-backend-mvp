import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  senhaAtual: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  novaSenha: string;

  @IsString()
  @IsNotEmpty()
  confirmarNovaSenha: string;
}
