const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';

export function getAllowedFrontendOrigins(configuredOrigins: string | undefined): string[] {
  const configured = configuredOrigins?.trim()
    ? configuredOrigins.split(',').map((origin) => origin.trim())
    : [];
  const origins = new Set([DEFAULT_FRONTEND_ORIGIN]);

  for (const candidate of configured) {
    if (!candidate || candidate === '*') {
      throw new Error('FRONTEND_ORIGINS must contain only explicit HTTP(S) origins.');
    }

    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(`Invalid frontend origin in FRONTEND_ORIGINS: ${candidate}`);
    }

    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || url.pathname !== '/'
      || url.search
      || url.hash
    ) {
      throw new Error(`Invalid frontend origin in FRONTEND_ORIGINS: ${candidate}`);
    }
    origins.add(url.origin);
  }

  return [...origins];
}
