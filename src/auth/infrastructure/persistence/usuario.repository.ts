import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../domain/entities/usuario.entity';
import {
  CreateUsuarioData,
  UsuarioRepositoryPort,
} from '../../domain/ports/usuario.repository.port';
import { UsuarioOrmEntity } from './usuario.orm-entity';

@Injectable()
export class UsuarioRepository implements UsuarioRepositoryPort {
  constructor(
    @InjectRepository(UsuarioOrmEntity)
    private readonly repository: Repository<UsuarioOrmEntity>,
  ) {}

  async findByEmail(email: string): Promise<Usuario | null> {
    const entity = await this.repository.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async findById(id: string): Promise<Usuario | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async create(data: CreateUsuarioData): Promise<Usuario> {
    const entity = this.repository.create({
      nome: data.nome,
      email: data.email,
      senha: data.senha,
      tipo: data.tipo,
      bairro: data.bairro ?? null,
    });
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.repository.count({ where: { email } });
    return count > 0;
  }

  private toDomain(entity: UsuarioOrmEntity): Usuario {
    return new Usuario(
      entity.id,
      entity.nome,
      entity.email,
      entity.senha,
      entity.tipo,
      entity.bairro,
      entity.createdAt,
    );
  }

  async updateProfile(
    id: string,
    data: { nome?: string; email?: string; bairro?: string | null },
  ): Promise<Usuario> {
    try {
      if (Object.keys(data).length) await this.repository.update(id, data);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }
    const updated = await this.findById(id);
    if (!updated) throw new NotFoundException('Usuário não encontrado');
    return updated;
  }

  async updatePassword(
    id: string,
    currentHash: string,
    newHash: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { id, senha: currentHash },
      { senha: newHash },
    );
    return (result.affected ?? 0) > 0;
  }
}
