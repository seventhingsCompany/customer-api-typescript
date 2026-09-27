import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError, SeventhingsClient } from '../../src/index.js';
import { created, error, json, ok, setup } from './mock.js';

describe('SeventhingsClient transport', () => {
  it('builds the base URL, trimming trailing slashes', () => {
    const c = new SeventhingsClient({ instanceUrl: 'https://x.test///' });
    expect(c.baseUrl).toBe('https://x.test/customer-api/v1');
  });

  it('sends the bearer token and Accept: application/json', async () => {
    const { client, last } = setup(() => json({ items: [] }));
    await client.objects.list();
    expect(last().headers.get('Authorization')).toBe('Bearer test-token');
    expect(last().headers.get('Accept')).toBe('application/json');
    expect(last().headers.get('Content-Type')).toBeNull();
  });

  it('omits Authorization without a token', async () => {
    const { client, last } = setup(() => json({ items: [] }), { token: undefined });
    await client.objects.list();
    expect(last().headers.has('Authorization')).toBe(false);
  });

  it('sets Content-Type only when there is a body', async () => {
    const { client, calls } = setup((req) =>
      req.method === 'POST' ? created('/object/new') : ok(),
    );
    await client.objects.create({ name: 'x' });
    await client.objects.delete('u');
    expect(calls[0]?.headers.get('Content-Type')).toBe('application/json');
    expect(calls[1]?.headers.get('Content-Type')).toBeNull();
  });

  it('sends custom default headers', async () => {
    const { client, last } = setup(() => json({ items: [] }), {
      headers: { 'User-Agent': 'my-app/1.0' },
    });
    await client.objects.list();
    expect(last().headers.get('User-Agent')).toBe('my-app/1.0');
  });

  it('get/setToken', () => {
    const { client } = setup();
    expect(client.token).toBe('test-token');
    client.setToken('other');
    expect(client.token).toBe('other');
  });

  it('turns status >= 400 into ApiError with body and headers', async () => {
    const { client } = setup(
      () =>
        new Response('{"message":"gone"}', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'X-Request-Id': 'r1' },
        }),
    );
    const err = await client.objects.get('u').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.statusCode).toBe(404);
    expect(apiErr.status).toBe('Not Found');
    expect(apiErr.body).toBe('{"message":"gone"}');
    expect(apiErr.headers.get('X-Request-Id')).toBe('r1');
    expect(apiErr.isNotFound()).toBe(true);
  });

  it('wraps transport failures in NetworkError', async () => {
    const { client } = setup(() => {
      throw new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') });
    });
    const err = await client.objects.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).message).toContain('ECONNREFUSED');
    expect((err as NetworkError).cause).toBeInstanceOf(TypeError);
  });

  it('passes the abort signal through and rethrows aborts unwrapped', async () => {
    const controller = new AbortController();
    const { client, last } = setup(
      (req) =>
        new Promise<Response>((_, reject) => {
          req.signal?.addEventListener('abort', () => reject(req.signal?.reason));
        }),
    );
    const p = client.objects.list(undefined, { signal: controller.signal });
    controller.abort();
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
    expect(last().signal).toBeDefined();
  });

  it('applies timeouts', async () => {
    const { client } = setup(
      (req) =>
        new Promise<Response>((_, reject) => {
          req.signal?.addEventListener('abort', () => reject(req.signal?.reason));
        }),
      { timeoutMs: 5 },
    );
    const err = await client.objects.list().catch((e: unknown) => e);
    expect((err as DOMException).name).toBe('TimeoutError');
  });

  it('does not attach a signal when neither signal nor timeout is set', async () => {
    const { client, last } = setup(() => json({ items: [] }));
    await client.objects.list();
    expect(last().signal).toBeUndefined();
  });

  it('ping is unauthenticated and hits the API root', async () => {
    const { client, last } = setup(() => json({ status: 'ok', description: 'up' }));
    expect(await client.ping()).toEqual({ status: 'ok', description: 'up' });
    expect(last().url).toBe('https://example.com/customer-api/v1');
    expect(last().headers.has('Authorization')).toBe(false);
  });

  it('ping surfaces server errors', async () => {
    const { client } = setup(() => error(503));
    await expect(client.ping()).rejects.toBeInstanceOf(ApiError);
  });

  it('request() is a raw escape hatch', async () => {
    const { client, last } = setup(() => json({ hello: 'world' }, { status: 202 }));
    const res = await client.request('POST', '/custom/thing', { query: 'a=1', body: { x: 1 } });
    expect(last().url).toBe('https://example.com/customer-api/v1/custom/thing?a=1');
    expect(last().json()).toEqual({ x: 1 });
    expect(res.status).toBe(202);
    expect(res.json()).toEqual({ hello: 'world' });
    expect(res.text()).toBe('{"hello":"world"}');
  });

  it('withCredentials logs in and stores the token', async () => {
    const fetch = async () => json({ access_token: 'jwt', expires_in: 3600, token_type: 'Bearer' });
    const client = await SeventhingsClient.withCredentials({
      instanceUrl: 'https://example.com',
      username: 'u',
      password: 'p',
      clientId: 'cid',
      fetch: fetch as typeof globalThis.fetch,
    });
    expect(client.token).toBe('jwt');
    expect(client.clientId).toBe('cid');
  });

  it('withCredentials rejects when login fails', async () => {
    await expect(
      SeventhingsClient.withCredentials({
        instanceUrl: 'https://example.com',
        username: 'u',
        password: 'bad',
        clientId: 'cid',
        fetch: (async () => error(401)) as typeof globalThis.fetch,
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
