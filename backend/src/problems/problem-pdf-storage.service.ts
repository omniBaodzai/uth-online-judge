import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export const PROBLEM_PDF_PUBLIC_PREFIX = '/uploads/problem-pdfs/';
export const PROBLEM_PDF_MAX_BYTES = 20 * 1024 * 1024;

// Nhận diện PDF theo nội dung (magic bytes "%PDF-"), không tin MIME type hay tên file của client.
export function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.toString('latin1', 0, 5) === '%PDF-';
}

export function isLocalProblemPdf(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^\/uploads\/problem-pdfs\/[0-9a-f-]{36}\.pdf$/.test(url);
}

@Injectable()
export class ProblemPdfStorageService {
  readonly pdfDir = resolve(process.env.UPLOAD_DIR ?? 'uploads', 'problem-pdfs');

  async save(buffer: Buffer | undefined): Promise<string> {
    if (!buffer || buffer.length === 0 || buffer.length > PROBLEM_PDF_MAX_BYTES) {
      throw new BadRequestException('File PDF phải có dung lượng tối đa 20 MB.');
    }
    if (!isPdf(buffer)) {
      throw new BadRequestException('Chỉ chấp nhận file PDF hợp lệ.');
    }

    await mkdir(this.pdfDir, { recursive: true });
    const fileName = `${randomUUID()}.pdf`;
    await writeFile(resolve(this.pdfDir, fileName), buffer, { flag: 'wx' });
    return `${PROBLEM_PDF_PUBLIC_PREFIX}${fileName}`;
  }

  async remove(url: string | null | undefined): Promise<void> {
    if (!isLocalProblemPdf(url)) return;
    try {
      await unlink(resolve(this.pdfDir, basename(url)));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
  }
}
