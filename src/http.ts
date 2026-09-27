import { ApiError, NetworkError } from './errors.js';

/** Per-call options accepted by every SDK method. */
export interface RequestOptions {
  /** Aborts the request when signalled. */
  signal?: AbortSignal | undefined;
  /** Aborts the request after this many milliseconds. Overrides the client default. */
  timeoutMs?: number | undefined;
}

/** A successful (status < 400) HTTP response with the body fully read. */
export interface ApiResponse {
  status: number;
  headers: Headers;
  body: Uint8Array;
  /** Decodes the body as UTF-8 text. */
  text(): string;
  /** Parses the body as JSON. Returns undefined for an empty body. */
  json<T = unknown>(): T;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Mutable auth state shared by the client and its services. */
export interface Session {
  token: string | undefined;
  clientId: string | undefined;
}

export interface HttpClientConfig {
  baseUrl: string;
  session: Session;
  fetch?: typeof fetch | undefined;
  headers?: Record<string, string> | undefined;
  timeoutMs?: number | undefined;
}

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  /** Pre-encoded query string without the leading "?". */
  query?: string | undefined;
  /** JSON-serialized when set. Mutually exclusive with `form`. */
  body?: unknown;
  /** Multipart body; the runtime sets the Content-Type boundary. */
  form?: FormData | undefined;
  /** Accept header. Defaults to application/json; null omits the header. */
  accept?: string | null | undefined;
  /** Send the bearer token when one is set. Defaults to true. */
  authenticated?: boolean | undefined;
}

const decoder = new TextDecoder();

/** @internal Low-level transport shared by all services. */
export class HttpClient {
  readonly baseUrl: string;
  readonly session: Session;
  readonly #fetch: typeof fetch;
  readonly #headers: Record<string, string>;
  readonly #timeoutMs: number | undefined;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.session = config.session;
    // Bind so runtimes that require `this === globalThis` (browsers) accept the call.
    this.#fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.#headers = config.headers ?? {};
    this.#timeoutMs = config.timeoutMs;
  }

  url(path: string, query?: string): string {
    let url = this.baseUrl;
    if (path !== '') url += '/' + path.replace(/^\/+/, '');
    if (query) url += '?' + query;
    return url;
  }

  async send(req: HttpRequest, options: RequestOptions = {}): Promise<ApiResponse> {
    const headers = new Headers(this.#headers);
    const accept = req.accept === undefined ? 'application/json' : req.accept;
    if (accept !== null) headers.set('Accept', accept);

    let body: BodyInit | undefined;
    if (req.form !== undefined) {
      body = req.form;
    } else if (req.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(req.body);
    }

    const token = this.session.token;
    if (req.authenticated !== false && token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const init: RequestInit = { method: req.method, headers };
    if (body !== undefined) init.body = body;
    const signal = combineSignals(options.signal, options.timeoutMs ?? this.#timeoutMs);
    if (signal) init.signal = signal;

    let res: Response;
    let bytes: Uint8Array;
    try {
      res = await this.#fetch(this.url(req.path, req.query), init);
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      if (isAbort(err)) throw err;
      throw new NetworkError(`seventhings request failed: ${describe(err)}`, { cause: err });
    }

    if (res.status >= 400) {
      throw new ApiError(res.status, res.statusText, decoder.decode(bytes), res.headers);
    }
    return toApiResponse(res.status, res.headers, bytes);
  }

  /** Sends the request and parses the JSON response body. */
  async json<T>(req: HttpRequest, options?: RequestOptions): Promise<T> {
    const res = await this.send(req, options);
    return res.json<T>();
  }
}

function toApiResponse(status: number, headers: Headers, body: Uint8Array): ApiResponse {
  return {
    status,
    headers,
    body,
    text: () => decoder.decode(body),
    json: <T>() => {
      const text = decoder.decode(body);
      return (text.trim() === '' ? undefined : JSON.parse(text)) as T;
    },
  };
}

function combineSignals(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): AbortSignal | undefined {
  const timeout =
    timeoutMs !== undefined && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
  if (signal && timeout) return AbortSignal.any([signal, timeout]);
  return signal ?? timeout;
}

function isAbort(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err.name === 'AbortError' || err.name === 'TimeoutError')
  );
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? `: ${err.cause.message}` : '';
    return err.message + cause;
  }
  return String(err);
}
