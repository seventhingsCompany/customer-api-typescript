import { SeventhingsClient, type ClientOptions } from '../../src/index.js';

export interface Recorded {
  method: string;
  /** Full URL as sent, with brackets unencoded. */
  url: string;
  /** Path relative to /customer-api/v1, without the query. */
  path: string;
  /** Raw query string without "?". */
  query: string;
  headers: Headers;
  body: BodyInit | null | undefined;
  signal: AbortSignal | null | undefined;
  /** Parsed JSON body, if the body is a string. */
  json(): unknown;
}

export type Handler = (req: Recorded) => Response | Promise<Response>;

export const BASE = 'https://example.com/customer-api/v1';

/** Builds a client whose fetch records each request and answers with handler. */
export function setup(handler: Handler = () => ok(), options: Partial<ClientOptions> = {}) {
  const calls: Recorded[] = [];
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const [pathAndBase = '', query = ''] = url.split('?', 2);
    const req: Recorded = {
      method: init.method ?? 'GET',
      url,
      path: pathAndBase.slice(BASE.length).replace(/^\//, ''),
      query,
      headers: new Headers(init.headers),
      body: init.body,
      signal: init.signal,
      json: () => JSON.parse(String(init.body)),
    };
    calls.push(req);
    return handler(req);
  };
  const client = new SeventhingsClient({
    instanceUrl: 'https://example.com',
    token: 'test-token',
    fetch: fetch as typeof globalThis.fetch,
    ...options,
  });
  const last = (): Recorded => {
    const c = calls.at(-1);
    if (!c) throw new Error('no request recorded');
    return c;
  };
  return { client, calls, last };
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  });
}

export function ok(status = 204): Response {
  return new Response(null, { status });
}

export function created(location: string, extra: Record<string, string> = {}): Response {
  return new Response(null, { status: 201, headers: { Location: location, ...extra } });
}

export function error(status: number, body = '{"message":"boom"}', statusText = ''): Response {
  return new Response(body, { status, statusText });
}
