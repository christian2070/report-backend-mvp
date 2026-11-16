import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('pending_file_deletions')
export class PendingFileDeletionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 500 })
  path: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
