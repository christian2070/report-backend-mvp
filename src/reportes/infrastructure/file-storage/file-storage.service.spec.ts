import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileStorageService } from './file-storage.service';

jest.mock('uuid', () => ({ v4: () => 'test-upload-id' }));

describe('FileStorageService safe removal', () => {
  let directory: string;
  let service: FileStorageService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'report-storage-test-'));
    service = new FileStorageService(
      new ConfigService({ UPLOAD_DIR: directory }),
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('removes uploaded files and treats already missing files as success', async () => {
    const path = service.saveFile({
      originalname: 'photo.jpg',
      buffer: Buffer.from('image'),
    } as Express.Multer.File);
    const physical = join(directory, path.split('/').pop()!);
    expect((await readFile(physical)).toString()).toBe('image');
    await service.removeFile(path);
    await expect(readFile(physical)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.removeFile(path)).resolves.toBeUndefined();
  });

  it.each([
    '/uploads/../secret.txt',
    '/uploads/sub/file.jpg',
    'C:\\secret.jpg',
    '/outside/file.jpg',
    '/uploads/..\\secret.jpg',
  ])('rejects paths outside the upload directory: %s', async (path) => {
    await expect(service.removeFile(path)).rejects.toThrow(
      'Caminho de upload inválido',
    );
  });
});
