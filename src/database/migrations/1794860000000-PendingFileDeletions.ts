import { MigrationInterface, QueryRunner } from 'typeorm';

export class PendingFileDeletions1794860000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE pending_file_deletions (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      path VARCHAR(500) NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE pending_file_deletions');
  }
}
