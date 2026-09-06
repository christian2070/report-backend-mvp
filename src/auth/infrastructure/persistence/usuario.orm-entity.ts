import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AlertaOrmEntity } from '../../../alertas/infrastructure/persistence/alerta.orm-entity';
import { TipoUsuario } from '../../../common/domain/enums/tipo-usuario.enum';
import { ReporteOrmEntity } from '../../../reportes/infrastructure/persistence/reporte.orm-entity';

@Entity('usuarios')
export class UsuarioOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  senha: string;

  @Column({ type: 'enum', enum: TipoUsuario, default: TipoUsuario.CIDADAO })
  tipo: TipoUsuario;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bairro: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ReporteOrmEntity, (reporte) => reporte.autor)
  reportes: ReporteOrmEntity[];

  @OneToMany(() => AlertaOrmEntity, (alerta) => alerta.usuario)
  alertas: AlertaOrmEntity[];
}
