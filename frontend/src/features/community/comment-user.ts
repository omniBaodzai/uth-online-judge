const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/

export function isValidCommentUsername(username: string | null | undefined): username is string {
  return typeof username === 'string' && USERNAME_PATTERN.test(username)
}

export function publicCommentProfilePath(username: string | null | undefined): string | null {
  return isValidCommentUsername(username)
    ? `/users/${encodeURIComponent(username)}`
    : null
}
