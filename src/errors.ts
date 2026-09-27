/** Base class for every error thrown by the SDK. */
export class SeventhingsError extends Error {
  override name = 'SeventhingsError';
}

const FEATURE_INACTIVE_MESSAGE = 'The required feature for this endpoint is not active';

/** An error response (HTTP status >= 400) from the seventhings API. */
export class ApiError extends SeventhingsError {
  override name = 'ApiError';

  constructor(
    /** HTTP status code, e.g. 404. */
    readonly statusCode: number,
    /** HTTP reason phrase, e.g. "Not Found". May be empty over HTTP/2. */
    readonly status: string,
    /** Raw response body. */
    readonly body: string,
    /** Response headers. */
    readonly headers: Headers = new Headers(),
  ) {
    super(`seventhings API error ${statusCode} (${status}): ${body}`);
  }

  /** Parses the body as JSON. Returns undefined if the body is not valid JSON. */
  json<T = unknown>(): T | undefined {
    try {
      return JSON.parse(this.body) as T;
    } catch {
      return undefined;
    }
  }

  isStatusCode(code: number): boolean {
    return this.statusCode === code;
  }

  /** 404 Not Found. */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /** 401 Unauthorized. */
  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  /** 403 Forbidden. */
  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /** 409 Conflict. */
  isConflict(): boolean {
    return this.statusCode === 409;
  }

  /** 429 Too Many Requests. */
  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  /** Any 5xx status. */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /** A 403 because the module behind the endpoint (e.g. rentals) is not enabled on the instance. */
  isFeatureInactive(): boolean {
    if (!this.isForbidden()) return false;
    const payload = this.json<{ message?: unknown }>();
    return (
      typeof payload === 'object' &&
      payload !== null &&
      payload.message === FEATURE_INACTIVE_MESSAGE
    );
  }
}

/**
 * The request never produced an HTTP response (DNS failure, connection refused,
 * TLS error, ...). The underlying error is available as `cause`. Aborts and
 * timeouts are not wrapped: they surface as the runtime's native `AbortError` /
 * `TimeoutError`.
 */
export class NetworkError extends SeventhingsError {
  override name = 'NetworkError';
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Reports whether err is an {@link ApiError} with status 404. */
export const isNotFound = (err: unknown): boolean => isApiError(err) && err.isNotFound();
/** Reports whether err is an {@link ApiError} with status 401. */
export const isUnauthorized = (err: unknown): boolean => isApiError(err) && err.isUnauthorized();
/** Reports whether err is an {@link ApiError} with status 403. */
export const isForbidden = (err: unknown): boolean => isApiError(err) && err.isForbidden();
/** Reports whether err is an {@link ApiError} with status 409. */
export const isConflict = (err: unknown): boolean => isApiError(err) && err.isConflict();
/** Reports whether err is an {@link ApiError} with status 429. */
export const isRateLimited = (err: unknown): boolean => isApiError(err) && err.isRateLimited();
/** Reports whether err is an {@link ApiError} with a 5xx status. */
export const isServerError = (err: unknown): boolean => isApiError(err) && err.isServerError();
/** Reports whether err is an {@link ApiError} for an inactive instance feature. */
export const isFeatureInactive = (err: unknown): boolean =>
  isApiError(err) && err.isFeatureInactive();
