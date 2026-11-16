import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UsuarioRepository } from './usuario.repository';
import { UsuarioOrmEntity } from './usuario.orm-entity';

describe('UsuarioRepository updates', () => {
  const orm = { update: jest.fn(), findOne: jest.fn() };
  const repository = new UsuarioRepository(
    orm as unknown as Repository<UsuarioOrmEntity>,
  );

  beforeEach(() => jest.resetAllMocks());

  it('maps a concurrent unique-email violation to 409', async () => {
    orm.update.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });
    await expect(
      repository.updateProfile('owner', { email: 'used@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('changes password only when the previously verified hash still matches', async () => {
    orm.update.mockResolvedValueOnce({ affected: 1 });
    await expect(
      repository.updatePassword('owner', 'old-hash', 'new-hash'),
    ).resolves.toBe(true);
    expect(orm.update).toHaveBeenCalledWith(
      { id: 'owner', senha: 'old-hash' },
      { senha: 'new-hash' },
    );
    orm.update.mockResolvedValueOnce({ affected: 0 });
    await expect(
      repository.updatePassword('owner', 'old-hash', 'new-hash'),
    ).resolves.toBe(false);
  });
});
