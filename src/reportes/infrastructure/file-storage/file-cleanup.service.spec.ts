import type { Repository } from 'typeorm';
import { FileCleanupService } from './file-cleanup.service';
import { FileStorageService } from './file-storage.service';
import { PendingFileDeletionOrmEntity } from './pending-file-deletion.orm-entity';

describe('FileCleanupService', () => {
  const pending = {
    id: 'pending',
    path: '/uploads/old.jpg',
    createdAt: new Date(),
  };
  const repository = {
    find: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const storage = { removeFile: jest.fn() };
  let service: FileCleanupService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository.find.mockResolvedValue([pending]);
    repository.create.mockImplementation((data: unknown) => data);
    service = new FileCleanupService(
      repository as unknown as Repository<PendingFileDeletionOrmEntity>,
      storage as unknown as FileStorageService,
    );
  });

  it('keeps failed cleanup queued and retries successfully', async () => {
    storage.removeFile.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(service.flush()).resolves.toBeUndefined();
    expect(repository.delete).not.toHaveBeenCalled();
    await service.flush();
    expect(storage.removeFile).toHaveBeenCalledTimes(2);
    expect(repository.delete).toHaveBeenCalledWith('pending');
  });

  it('keeps cleanup queued if deleting its queue entry fails', async () => {
    repository.delete.mockRejectedValueOnce(new Error('db unavailable'));
    await expect(service.flush()).resolves.toBeUndefined();
    await service.flush();
    expect(storage.removeFile).toHaveBeenCalledTimes(2);
  });

  it('does not report a committed operation as failed if the cleanup table is unavailable', async () => {
    repository.find.mockRejectedValueOnce(new Error('db unavailable'));
    await expect(service.flush()).resolves.toBeUndefined();
  });

  it('queues a new uncommitted upload if immediate cleanup fails', async () => {
    storage.removeFile.mockRejectedValueOnce(new Error('disk unavailable'));
    await service.discardUncommitted('/uploads/new.jpg');
    expect(repository.save).toHaveBeenCalledWith({ path: '/uploads/new.jpg' });
  });
});
