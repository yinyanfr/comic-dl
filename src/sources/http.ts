import { URL } from 'node:url';
import { TransientSourceError } from './source.js';

interface SourceHttpOptions {
  readonly requestHeaders?: Readonly<Record<string, string>>;
  readonly credentialHeaders: Readonly<Record<string, string>>;
  readonly credentialOrigins: readonly string[];
  readonly allowedOrigins?: readonly string[];
}

interface SourceHttpResponse {
  bytes: Uint8Array;
  url: URL;
  contentType: string | null;
}

export class SourceHttpError extends Error {
  constructor(readonly status: number) {
    super(`Source returned HTTP ${status}`);
  }
}

const transientNetworkCodes = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function transientNetworkError(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.some(transientNetworkError);
  }
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    transientNetworkCodes.has(error.code)
  );
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
  requestHeaders,
  credentialHeaders,
  credentialOrigins,
  allowedOrigins,
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
  const anonymousHeaders = requestHeaders && new Headers(requestHeaders);
  const authenticatedHeaders = new Headers(anonymousHeaders);
  for (const [name, value] of new Headers(credentialHeaders)) {
    authenticatedHeaders.set(name, value);
  }

  return async function read(
    input: string | URL,
    signal: AbortSignal,
    authenticated = false,
  ): Promise<SourceHttpResponse> {
    const timeout = AbortSignal.timeout(30_000);
    const requestSignal = AbortSignal.any([signal, timeout]);
    let url = new URL(input);
    let phase = 'requesting';
    try {
      for (let redirects = 0; ; redirects++) {
        validateUrl(url);
        if (allowedOrigins && !allowedOrigins.includes(url.origin)) {
          throw new Error(
            'Source request redirected to an unrecognized origin',
          );
        }
        authenticated &&= origins.has(url.origin);
        phase = 'requesting';
        const response = await fetch(url, {
          redirect: 'manual',
          credentials: 'omit',
          headers: authenticated ? authenticatedHeaders : anonymousHeaders,
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
          throw new SourceHttpError(response.status);
        }
        phase = 'reading response from';
        return {
          bytes: new Uint8Array(await response.arrayBuffer()),
          url,
          contentType: response.headers.get('content-type'),
        };
      }
    } catch (cause) {
      signal.throwIfAborted();
      if (timeout.aborted) {
        throw new TransientSourceError(`Timed out ${phase} ${url.origin}`, {
          cause,
        });
      }
      if (cause instanceof TypeError && cause.cause) {
        const ErrorType = transientNetworkError(cause.cause)
          ? TransientSourceError
          : Error;
        throw new ErrorType(`Network error ${phase} ${url.origin}`, { cause });
      }
      throw cause;
    }
  };
}
