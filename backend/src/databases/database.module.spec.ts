import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PoolLifecycle } from './database.module.js';

describe('PoolLifecycle', () => {
  it('logs idle-client failures and closes the shared pool on shutdown', async () => {
    const emitter = new EventEmitter();
    const poolEnd = vi.fn().mockResolvedValue(undefined);
    const pool = Object.assign(emitter, {
      totalCount: 2,
      idleCount: 1,
      waitingCount: 0,
      end: poolEnd,
    }) as unknown as Pool;
    const loggerLog = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const lifecycle = new PoolLifecycle(pool);
    const error = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });

    expect(() => {
      emitter.emit('connect', {});
      emitter.emit('error', error, {});
    }).not.toThrow();
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('code=ECONNRESET'),
      error.stack,
    );

    await lifecycle.onApplicationShutdown();
    expect(poolEnd).toHaveBeenCalledOnce();
    loggerLog.mockRestore();
    loggerError.mockRestore();
  });
});
