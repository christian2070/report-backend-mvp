import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DemoManifest,
  requireLocalTarget,
  uploadFile,
  validateManifest,
  validatePhoto,
} from './support';

const manifest = (): DemoManifest =>
  JSON.parse(
    readFileSync(join(__dirname, 'manifest.json'), 'utf8'),
  ) as DemoManifest;

describe('guardas do seed demonstrativo', () => {
  it('recusa produção, host remoto e destino não confirmado', () => {
    expect(() =>
      requireLocalTarget({ NODE_ENV: 'production', DB_HOST: 'localhost' }, []),
    ).toThrow('NODE_ENV');
    expect(() =>
      requireLocalTarget({ DB_HOST: 'mysql.example.com' }, []),
    ).toThrow('loopback');
    expect(() =>
      requireLocalTarget({ DB_HOST: 'localhost' }, ['--apply']),
    ).toThrow('local-development');
    expect(() =>
      requireLocalTarget({ DB_HOST: 'localhost' }, [
        '--apply',
        '--local-development',
        '--target=localhost:3307/errado',
      ]),
    ).toThrow('destino');
    expect(
      requireLocalTarget(
        {
          DB_HOST: 'localhost',
          DB_PORT: '3307',
          DB_NAME: 'cidades_inteligentes',
        },
        [
          '--apply',
          '--local-development',
          '--target=localhost:3307/cidades_inteligentes',
        ],
      ),
    ).toBe('localhost:3307/cidades_inteligentes');
  });

  it('impede remoção fora de uploads e nomes arbitrários', () => {
    for (const value of [
      '/uploads/../.env',
      '/uploads/x/y.jpg',
      'https://example.com/x.jpg',
      '/uploads/.gitkeep',
      '/uploads/a.jpg?x=1',
    ]) {
      expect(() => uploadFile('/workspace/uploads', value)).toThrow('Caminho');
    }
    expect(uploadFile('/workspace/uploads', '/uploads/abc-123.jpg')).toContain(
      'abc-123.jpg',
    );
  });

  it('valida os dados aprovados e recusa duplicação, licença restrita e autoria incorreta', () => {
    expect(() => validateManifest(manifest())).not.toThrow();
    const duplicate = manifest();
    duplicate.reports[1].photo.sha256 = duplicate.reports[0].photo.sha256;
    expect(() => validateManifest(duplicate)).toThrow('duplicados');
    const restricted = manifest();
    restricted.reports[0].photo.license = 'CC BY-NC';
    expect(() => validateManifest(restricted)).toThrow('Licença');
    const author = manifest();
    author.reports[0].autorId = 'inexistente';
    expect(() => validateManifest(author)).toThrow('2 reportes');
    const longText = manifest();
    longText.reports[0].descricao = 'a'.repeat(301);
    expect(() => validateManifest(longText)).toThrow('Texto');
  });

  it('recusa imagem substituída, vazia ou acima do limite antes de escrever no banco', () => {
    const photo = manifest().reports[0].photo;
    for (const buffer of [
      Buffer.alloc(0),
      Buffer.from('<html>erro</html>'),
      Buffer.alloc(5 * 1024 * 1024 + 1),
    ]) {
      expect(() => validatePhoto(buffer, photo)).toThrow('Imagem inválida');
    }
  });
});
