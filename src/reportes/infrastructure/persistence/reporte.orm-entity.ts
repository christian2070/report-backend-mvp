import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AlertaOrmEntity } from '../../../alertas/infrastructure/persistence/alerta.orm-entity';
import { UsuarioOrmEntity } from '../../../auth/infrastructure/persistence/usuario.orm-entity';
import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';

@Entity('reportes')
export class ReporteOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 500 })
  foto: string;

  @Column({ type: 'text' })
  descricao: string;

  @Column({ type: 'enum', enum: CategoriaReporte })
  categoria: CategoriaReporte;

  @Column({ length: 500 })
  localizacao: string;

  @Column({ type: 'enum', enum: StatusReporte, default: StatusReporte.ABERTO })
  status: StatusReporte;

  @Column({ name: 'autor_id' })
  autorId: string;

  @ManyToOne(() => UsuarioOrmEntity, (usuario) => usuario.reportes)
  @JoinColumn({ name: 'autor_id' })
  autor: UsuarioOrmEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => AlertaOrmEntity, (alerta) => alerta.reporte)
  alertas: AlertaOrmEntity[];
}
