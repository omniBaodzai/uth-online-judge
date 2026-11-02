import { HttpStatus } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { StudentContestsController } from './student-contests.controller.js';

describe('StudentContestsController', () => {
  it('exposes public reads with optional authentication and registration writes with JWT authentication', () => {
    const prototype = StudentContestsController.prototype;
    const list = Object.getOwnPropertyDescriptor(prototype, 'list')!.value;
    const get = Object.getOwnPropertyDescriptor(prototype, 'get')!.value;
    const register = Object.getOwnPropertyDescriptor(prototype, 'register')!.value;
    const cancel = Object.getOwnPropertyDescriptor(prototype, 'cancel')!.value;
    const submit = Object.getOwnPropertyDescriptor(prototype, 'submit')!.value;
    expect(Reflect.getMetadata(GUARDS_METADATA, list)).toEqual([
      OptionalJwtAuthGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, get)).toEqual([
      OptionalJwtAuthGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, register)).toEqual([
      JwtAuthGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, cancel)).toEqual([
      JwtAuthGuard,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, submit)).toEqual([
      JwtAuthGuard,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, list)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, list)).toBe(0);
    expect(Reflect.getMetadata(PATH_METADATA, register)).toBe(':identifier/registration');
    expect(Reflect.getMetadata(METHOD_METADATA, register)).toBe(1);
    expect(Reflect.getMetadata(METHOD_METADATA, cancel)).toBe(3);
    expect(Reflect.getMetadata(PATH_METADATA, submit)).toBe(':identifier/submissions');
    expect(Reflect.getMetadata(METHOD_METADATA, submit)).toBe(1);
  });

  it('uses 201 for registration and 200 for cancellation', () => {
    const prototype = StudentContestsController.prototype;
    const register = Object.getOwnPropertyDescriptor(prototype, 'register')!.value;
    const cancel = Object.getOwnPropertyDescriptor(prototype, 'cancel')!.value;
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, register))
      .toBe(HttpStatus.CREATED);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, cancel))
      .toBe(HttpStatus.OK);
  });

  it('always derives the participant identity from the authenticated request', async () => {
    const contests = {
      get: vi.fn().mockResolvedValue({ id: 'contest-id' }),
      register: vi.fn().mockResolvedValue({ contestId: 'contest-id' }),
      cancel: vi.fn().mockResolvedValue({ contestId: 'contest-id' }),
    };
    const submissions = { createForContest: vi.fn().mockResolvedValue({ id: 'submission-id' }) };
    const controller = new StudentContestsController(contests as never, submissions as never);

    await controller.get('contest-slug', { user: { id: 'student-id' } } as never);
    await controller.register('contest-slug', {
      user: { id: 'student-id' },
    } as never);
    await controller.cancel('contest-id', { user: { id: 'student-id' } } as never);
    await controller.submit('contest-slug', {
      problemCode: 'UTH001',
      language: 'cpp',
      sourceCode: 'int main() {}',
    }, { user: { id: 'student-id' } } as never);

    expect(contests.get).toHaveBeenCalledWith('contest-slug', 'student-id');
    expect(contests.register).toHaveBeenCalledWith('contest-slug', 'student-id');
    expect(contests.cancel).toHaveBeenCalledWith('contest-id', 'student-id');
    expect(submissions.createForContest).toHaveBeenCalledWith('student-id', 'contest-slug', {
      problemCode: 'UTH001',
      language: 'cpp',
      sourceCode: 'int main() {}',
    });
  });
});
