import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UpdateMeDto } from '../application/dto/update-me.dto';
import { ChangePasswordDto } from '../application/dto/change-password.dto';
import { UpdateMeUseCase } from '../application/use-cases/update-me.use-case';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { LoginDto } from '../application/dto/login.dto';
import { RegisterDto } from '../application/dto/register.dto';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RegisterCidadaoUseCase } from '../application/use-cases/register-cidadao.use-case';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerCidadaoUseCase: RegisterCidadaoUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly updateMeUseCase: UpdateMeUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerCidadaoUseCase.execute(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.getMeUseCase.execute(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.updateMeUseCase.execute(user.id, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.changePasswordUseCase.execute(user.id, dto);
  }
}
