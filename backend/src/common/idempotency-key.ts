import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export function validateIdempotencyKey(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  const key = value.trim();
  if (!isUUID(key, '4')) {
    throw new BadRequestException('Idempotency-Key phải là UUID v4.');
  }
  return key;
}
