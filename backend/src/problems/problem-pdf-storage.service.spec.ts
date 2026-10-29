import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ProblemPdfStorageService, isLocalProblemPdf, isPdf } from './problem-pdf-storage.service.js';

describe('Problem PDF storage', () => {
  it('detects PDFs by content', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n'))).toBe(true);
    expect(isPdf(Buffer.from('<html></html>'))).toBe(false);
  });

  it('only recognizes generated local URLs', () => {
    expect(isLocalProblemPdf('/uploads/problem-pdfs/123e4567-e89b-12d3-a456-426614174000.pdf')).toBe(true);
    expect(isLocalProblemPdf('/uploads/problem-pdfs/../x.pdf')).toBe(false);
    expect(isLocalProblemPdf(null)).toBe(false);
  });

  it('rejects empty and non-PDF uploads', async () => {
    const storage = new ProblemPdfStorageService();
    await expect(storage.save(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(storage.save(Buffer.from('not a pdf'))).rejects.toBeInstanceOf(BadRequestException);
  });
});
