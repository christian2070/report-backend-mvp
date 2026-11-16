import { Module } from '@nestjs/common';
import { UpdateMeUseCase } from './application/use-cases/update-me.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { USUARIO_REPOSITORY } from './domain/ports/usuario.repository.port';
import { RegisterCidadaoUseCase } from './application/use-cases/register-cidadao.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { UsuarioOrmEntity } from './infrastructure/persistence/usuario.orm-entity';
import { UsuarioRepository } from './infrastructure/persistence/usuario.repository';
import { JwtStrategy } from './infrastructure/jwt/jwt.strategy';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsuarioOrmEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'change-me',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            '7d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterCidadaoUseCase,
    LoginUseCase,
    GetMeUseCase,
    UpdateMeUseCase,
    ChangePasswordUseCase,
    JwtStrategy,
    {
      provide: USUARIO_REPOSITORY,
      useClass: UsuarioRepository,
    },
  ],
  exports: [USUARIO_REPOSITORY, JwtModule],
})
export class AuthModule {}
