import { Injectable } from '@nestjs/common';
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
}
