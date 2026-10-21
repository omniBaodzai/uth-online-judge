import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DATABASE_POOL } from './databases/database.module.js';

describe('AppController', () => {
  let appController: AppController;
  const database = {
    query: vi.fn().mockResolvedValue({
      rows: [{ database_time: new Date('2026-01-01T00:00:00.000Z') }],
    }),
  };

  beforeEach(async () => {
    database.query.mockClear();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DATABASE_POOL, useValue: database }],
    })
      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns database health information', async () => {
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        database: 'connected',
        databaseTime: new Date('2026-01-01T00:00:00.000Z'),
      });
      expect(database.query).toHaveBeenCalledWith('SELECT NOW() AS database_time');
    });
  });
});
