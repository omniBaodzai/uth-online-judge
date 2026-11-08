export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 64;

export function isValidSlug(value: string): boolean {
  return (
    value.length >= SLUG_MIN_LENGTH && value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value)
  );
}

// Sinh slug URL-safe từ tên tổ chức (bỏ dấu tiếng Việt). Trả null nếu không đủ ký tự hợp lệ.
export function slugify(name: string): string | null {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return isValidSlug(slug) ? slug : null;
}
