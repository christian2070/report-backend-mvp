import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtGuard } from './guards/optional-jwt.guard';
import { TipoUsuarioGuard } from './guards/tipo-usuario.guard';

@Module({
  imports: [AuthModule],
  providers: [OptionalJwtGuard, TipoUsuarioGuard],
  exports: [AuthModule, OptionalJwtGuard, TipoUsuarioGuard],
})
export class CommonModule {}
