import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        tipo ENUM('CIDADAO', 'PREFEITURA') NOT NULL DEFAULT 'CIDADAO',
        bairro VARCHAR(255) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reportes (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        foto VARCHAR(500) NOT NULL,
        descricao TEXT NOT NULL,
        categoria ENUM('ILUMINACAO', 'BURACO_PAVIMENTACAO', 'LIXO', 'SINALIZACAO', 'OUTROS') NOT NULL,
        localizacao VARCHAR(500) NOT NULL,
        status ENUM('ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO') NOT NULL DEFAULT 'ABERTO',
        autor_id VARCHAR(36) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_reportes_autor FOREIGN KEY (autor_id) REFERENCES usuarios(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alertas (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        usuario_id VARCHAR(36) NOT NULL,
        reporte_id VARCHAR(36) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_alertas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        CONSTRAINT fk_alertas_reporte FOREIGN KEY (reporte_id) REFERENCES reportes(id),
        CONSTRAINT uq_alertas_usuario_reporte UNIQUE (usuario_id, reporte_id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS alertas');
    await queryRunner.query('DROP TABLE IF EXISTS reportes');
    await queryRunner.query('DROP TABLE IF EXISTS usuarios');
  }
}
