import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UsuarioOrmEntity } from '../../../auth/infrastructure/persistence/usuario.orm-entity';
import { ReporteOrmEntity } from '../../../reportes/infrastructure/persistence/reporte.orm-entity';

@Entity('alertas')
@Unique(['usuarioId', 'reporteId'])
export class AlertaOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @Column({ name: 'reporte_id' })
  reporteId: string;

  @ManyToOne(() => UsuarioOrmEntity, (usuario) => usuario.alertas)
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioOrmEntity;

  @ManyToOne(() => ReporteOrmEntity, (reporte) => reporte.alertas)
  @JoinColumn({ name: 'reporte_id' })
  reporte: ReporteOrmEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
