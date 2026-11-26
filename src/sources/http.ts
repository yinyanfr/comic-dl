import { TransientSourceError } from './source.js';

interface SourceHttpOptions {
  readonly credentialHeaders: Readonly<Record<string, string>>;
  readonly credentialOrigins: readonly string[];
}

function validateUrl(url: URL) {
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Source request requires an HTTP(S) URL without credentials',
    );
  }
}

/**
 * Adapter-owned HTTP session. Requests such as page reads are anonymous unless
 * the adapter explicitly opts in and the destination origin is allowed.
 */
export function createSourceHttp({
  credentialHeaders,
  credentialOrigins,
}: SourceHttpOptions) {
  const origins = new Set(
    credentialOrigins.map((origin) => {
      const url = new URL(origin);
      validateUrl(url);
      if (url.pathname !== '/' || url.search || url.hash) {
        throw new Error('Source credential scope must be an Origin');
      }
      return url.origin;
    }),
  );
  const headers = new Headers(credentialHeaders);

  return async function read(
    input: string | URL,
    signal: AbortSignal,
    authenticated = false,
  ): Promise<Uint8Array> {
    const timeout = AbortSignal.timeout(30_000);
    const requestSignal = AbortSignal.any([signal, timeout]);
    let url = new URL(input);
    try {
      for (let redirects = 0; ; redirects++) {
        validateUrl(url);
        authenticated &&= origins.has(url.origin);
        const response = await fetch(url, {
          redirect: 'manual',
          credentials: 'omit',
          headers: authenticated ? headers : undefined,
          signal: requestSignal,
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel();
          const location = response.headers.get('location');
          if (!location || redirects >= 5) {
            throw new Error('Invalid source redirect or too many redirects');
          }
          const next = new URL(location, url);
          // An origin change strips credentials for the rest of the chain.
          authenticated &&= next.origin === url.origin;
          url = next;
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          const message = `Source returned HTTP ${response.status}`;
          if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
            throw new TransientSourceError(message);
          }
          throw new Error(message);
        }
        return new Uint8Array(await response.arrayBuffer());
      }
    } catch (cause) {
      signal.throwIfAborted();
      if (timeout.aborted) {
        throw new TransientSourceError('Source request timed out', { cause });
      }
      throw cause;
    }
  };
}
