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
    /** Response headers, including Retry-After when sent. Not part of the message. */
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

  /**
   * Parses the standard Retry-After header (delay-seconds or an HTTP date
   * relative to `now`) and returns the delay in milliseconds. Past dates return
   * 0. Returns undefined when the header is missing, repeated, invalid or too
   * large. Does not wait or retry; callers decide whether to resend.
   */
  retryAfter(now: Date = new Date()): number | undefined {
    return parseRetryAfter(this.headers.get('Retry-After'), now);
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)';
const LONG_DAY = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
const MONTH = `(${MONTHS.join('|')})`;
const TIME = '(\\d{2}):(\\d{2}):(\\d{2})';
// The three HTTP-date formats of RFC 9110 §5.6.7: IMF-fixdate, RFC 850, asctime.
const IMF_FIXDATE = new RegExp(`^${DAY}, (\\d{2}) ${MONTH} (\\d{4}) ${TIME} GMT$`);
const RFC850 = new RegExp(`^${LONG_DAY}, (\\d{2})-${MONTH}-(\\d{2}) ${TIME} GMT$`);
const ASCTIME = new RegExp(`^${DAY} ${MONTH} ([ \\d]\\d) ${TIME} (\\d{4})$`);

/** @internal Parses a Retry-After value into milliseconds. */
export function parseRetryAfter(header: string | null, now: Date): number | undefined {
  // Headers joins repeated values with ", ", which matches neither format.
  const value = header?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    const ms = Number(value) * 1000;
    return Number.isSafeInteger(ms) ? ms : undefined;
  }
  const date = parseHttpDate(value);
  if (date === undefined) return undefined;
  return Math.max(0, date - now.getTime());
}

function parseHttpDate(value: string): number | undefined {
  let day: string, month: string, year: number, h: string, mi: string, sec: string;
  let m: RegExpExecArray | null;
  if ((m = IMF_FIXDATE.exec(value))) {
    [, day = '', month = '', , h = '', mi = '', sec = ''] = m;
    year = Number(m[3]);
  } else if ((m = RFC850.exec(value))) {
    [, day = '', month = '', , h = '', mi = '', sec = ''] = m;
    const yy = Number(m[3]);
    year = yy < 69 ? 2000 + yy : 1900 + yy;
  } else if ((m = ASCTIME.exec(value))) {
    [, month = '', day = '', h = '', mi = '', sec = ''] = m;
    year = Number(m[6]);
  } else {
    return undefined;
  }
  const mo = MONTHS.indexOf(month);
  const d = Number(day.trim());
  const date = new Date(Date.UTC(2000, mo, d, Number(h), Number(mi), Number(sec)));
  date.setUTCFullYear(year, mo, d); // Date.UTC maps years 0-99 to 1900-1999.
  // Reject out-of-range parts such as 31 Feb or 25:00:00.
  if (
    date.getUTCDate() !== d ||
    date.getUTCHours() !== Number(h) ||
    date.getUTCMinutes() !== Number(mi) ||
    date.getUTCSeconds() !== Number(sec)
  ) {
    return undefined;
  }
  return date.getTime();
}

/**
 * Thrown before sending a rental case create or update without a renter.
 * Although the API description marks the renter optional, the server rejects
 * null and fails with HTTP 500 when it is omitted.
 */
export class RentalCaseRenterRequiredError extends SeventhingsError {
  override name = 'RentalCaseRenterRequiredError';

  constructor() {
    super(
      'rental case renter is required: provide a renter with type and value; the current API fails when renter is omitted',
    );
  }
}
