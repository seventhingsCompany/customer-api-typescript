import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  DEFAULT_REQUESTS_PER_MINUTE,
  RentalCaseRenterRequiredError,
  RenterType,
  SeventhingsError,
  type CreateRentalCase,
} from '../../src/index.js';
import { created, error, json, ok, setup } from './mock.js';

describe('catalog items', () => {
  const fields = { catalog_object_inventory_name: 'Laptop' };

  it('list encodes options and maps the page', async () => {
    const { client, last } = setup(() =>
      json({
        items: [{ uuid: 'c-1', fields }],
        page: 2,
        per_page: 10,
        total: 11,
        sort: { id: 'DESC' },
      }),
    );
    const res = await client.catalogItems.list({ page: 2, perPage: 10, sort: { id: 'DESC' } });
    expect(last().path).toBe('catalog-items');
    expect(last().query).toBe('page=2&per_page=10&sort[id]=DESC');
    expect(res).toMatchObject({ page: 2, perPage: 10, total: 11, sort: { id: 'DESC' } });
    expect(res.items[0]?.uuid).toBe('c-1');
    expect(res.items[0]?.fields.data).toEqual(fields);
  });

  it('list accepts [] for an empty sort', async () => {
    const { client } = setup(() => json({ items: [], page: 1, per_page: 50, total: 0, sort: [] }));
    expect((await client.catalogItems.list()).sort).toEqual({});
  });

  it('all() walks pages', async () => {
    const { client } = setup((req) =>
      json({ items: req.query.startsWith('page=1&') ? [{ uuid: 'c-1', fields }] : [] }),
    );
    const out: string[] = [];
    for await (const item of client.catalogItems.all({ perPage: 1 })) out.push(item.uuid);
    expect(out).toEqual(['c-1']);
  });

  it('get / create / update / delete', async () => {
    const { client, calls } = setup((req) => {
      if (req.method === 'GET') return json({ uuid: 'c-1', fields });
      if (req.method === 'POST') return created('/catalog-item/other', { 'Location-UUID': 'c-1' });
      return ok();
    });
    const item = await client.catalogItems.get('c-1');
    expect(item.fields.string('catalog_object_inventory_name')).toBe('Laptop');
    expect(await client.catalogItems.create(fields)).toBe('c-1');
    await client.catalogItems.update('c-1', fields);
    await client.catalogItems.delete('c-1');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET catalog-item/c-1',
      'POST catalog-item',
      'PUT catalog-item/c-1',
      'DELETE catalog-item/c-1',
    ]);
    expect(calls[1]?.json()).toEqual({ fields });
    expect(calls[2]?.json()).toEqual({ fields });
  });

  it('create falls back to the Location header', async () => {
    const { client } = setup(() => created('/customer-api/v1/catalog-item/c-2'));
    expect(await client.catalogItems.create({})).toBe('c-2');
  });

  it('surfaces API errors', async () => {
    const { client } = setup(() => error(403));
    await expect(client.catalogItems.list()).rejects.toBeInstanceOf(ApiError);
    await expect(client.catalogItems.get('c-1')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('files.getThumbnailWithSize', () => {
  it('requests the size', async () => {
    const { client, last } = setup(() => new Response('image'));
    const data = await client.files.getThumbnailWithSize('f-1', 320, 240);
    expect(new TextDecoder().decode(data)).toBe('image');
    expect(last().path).toBe('file/f-1/thumbnail');
    expect(last().query).toBe('width=320&height=240');
  });

  it.each([
    [0, 100],
    [100, 0],
    [-1, 100],
    [2001, 100],
    [100, 2001],
    [1.5, 100],
    [Number.NaN, 100],
  ])('rejects %s x %s without a request', async (width, height) => {
    const { client, calls } = setup();
    await expect(client.files.getThumbnailWithSize('f-1', width, height)).rejects.toBeInstanceOf(
      SeventhingsError,
    );
    expect(calls).toHaveLength(0);
  });
});

describe('timed rentals', () => {
  const base = {
    title: 'Loan',
    renter: { type: RenterType.Plain, value: 'Bob' },
    issueDate: '2025-04-23',
    dueDate: '2025-04-23',
    responsibleUserUuid: 'u',
  };

  it('maps is_full_day, issue_at and due_at', async () => {
    const { client } = setup(() =>
      json({
        uuid: 'r-1',
        is_full_day: false,
        issue_at: '2025-04-23T08:00:00+00:00',
        due_at: '2025-04-23T10:00:00+00:00',
      }),
    );
    expect(await client.rentals.get('r-1')).toMatchObject({
      isFullDay: false,
      issueAt: '2025-04-23T08:00:00+00:00',
      dueAt: '2025-04-23T10:00:00+00:00',
    });
  });

  it('sends the kind and times only when set', async () => {
    const { client, calls } = setup(() => created('/rental-management/rental-case/r-1'));
    await client.rentals.create({
      ...base,
      isFullDay: false,
      issueAt: '2025-04-23T08:00:00+00:00',
      dueAt: '2025-04-23T10:00:00+00:00',
    });
    await client.rentals.update('r-1', { ...base, isFullDay: true });
    await client.rentals.update('r-1', base);
    expect(calls[0]?.json()).toMatchObject({
      is_full_day: false,
      issue_at: '2025-04-23T08:00:00+00:00',
      due_at: '2025-04-23T10:00:00+00:00',
    });
    expect(calls[1]?.json()).toMatchObject({ is_full_day: true });
    expect(calls[1]?.json()).not.toHaveProperty('issue_at');
    for (const key of ['is_full_day', 'issue_at', 'due_at']) {
      expect(calls[2]?.json()).not.toHaveProperty(key);
    }
  });

  it('rejects a missing renter before sending', async () => {
    const { client, calls } = setup();
    const input = { ...base, renter: undefined } as unknown as CreateRentalCase;
    await expect(client.rentals.create(input)).rejects.toBeInstanceOf(
      RentalCaseRenterRequiredError,
    );
    await expect(
      client.rentals.update('r-1', { ...input, renter: null } as unknown as CreateRentalCase),
    ).rejects.toBeInstanceOf(RentalCaseRenterRequiredError);
    expect(calls).toHaveLength(0);
  });
});

describe('ApiError.retryAfter', () => {
  const now = new Date(Date.UTC(2026, 9, 17, 12, 0, 0));
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toUTCString();
  const retryAfter = (value: string | string[] | undefined) => {
    const headers = new Headers();
    for (const v of value === undefined ? [] : [value].flat()) headers.append('Retry-After', v);
    return new ApiError(429, 'Too Many Requests', '', headers).retryAfter(now);
  };

  it.each([
    ['seconds', '120', 120_000],
    ['zero', '0', 0],
    ['whitespace', ' 42 \t', 42_000],
    ['future date', at(90_000), 90_000],
    ['past date', at(-3_600_000), 0],
    ['current date', at(0), 0],
    ['RFC 850 date', 'Saturday, 17-Oct-26 12:01:00 GMT', 60_000],
    ['asctime date', 'Sat Oct 17 12:00:30 2026', 30_000],
    ['asctime padded day', 'Fri Oct  2 12:00:00 2026', 0],
  ])('%s', (_, value, want) => {
    expect(retryAfter(value)).toBe(want);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['negative', '-1'],
    ['explicit plus', '+1'],
    ['fractional', '1.5'],
    ['invalid date', 'tomorrow'],
    ['lenient date', '2026-10-17'],
    ['impossible date', 'Sat, 31 Feb 2026 12:00:00 GMT'],
    ['multiple values', '1, 2'],
    ['repeated header', ['1', '2']],
    ['too large', '9007199254740993'],
  ])('%s is invalid', (_, value) => {
    expect(retryAfter(value)).toBeUndefined();
  });

  it('defaults now to the current time', () => {
    const err = new ApiError(429, '', '', new Headers({ 'Retry-After': '5' }));
    expect(err.retryAfter()).toBe(5000);
  });

  it('is not part of the message', () => {
    const err = new ApiError(429, '', 'busy', new Headers({ 'X-Request-Id': 'header-only' }));
    expect(err.message).not.toContain('header-only');
  });

  it('is read from a live 429 without retrying', async () => {
    const { client, calls } = setup(
      () => new Response('slow down', { status: 429, headers: { 'Retry-After': '3' } }),
    );
    const err = (await client.ping().catch((e: unknown) => e)) as ApiError;
    expect(err.isRateLimited()).toBe(true);
    expect(err.retryAfter()).toBe(3000);
    expect(calls).toHaveLength(1);
  });
});

describe('rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const timed = (rateLimit?: number) => {
    const sent: number[] = [];
    const { client, calls } = setup(
      () => {
        sent.push(Date.now());
        return json({ access_token: 't' }, { headers: { Location: '/file/f' } });
      },
      rateLimit === undefined ? { rateLimit: undefined } : { rateLimit },
    );
    return { client, calls, sent };
  };

  it('defaults to 200 requests per minute across request types', async () => {
    expect(DEFAULT_REQUESTS_PER_MINUTE).toBe(200);
    const { client, sent } = timed();
    const run = (async () => {
      await client.objects.list();
      await client.files.getData('f');
      await client.files.upload('a.txt', new Uint8Array([1]));
      await client.auth.login('u', 'p', 'c');
    })();
    await vi.runAllTimersAsync();
    await run;
    expect(sent).toEqual([0, 300, 600, 900]);
  });

  it.each([
    [60, 2000],
    [600, 200],
    [0, 0],
    [-1, 0],
  ])('rateLimit %s spaces three requests over %sms', async (limit, want) => {
    const { client, sent } = timed(limit);
    const run = Promise.all([client.ping(), client.ping(), client.ping()]);
    await vi.runAllTimersAsync();
    await run;
    expect((sent.at(-1) ?? 0) - (sent[0] ?? 0)).toBe(want);
  });

  it('admits concurrent requests in call order', async () => {
    const { client, calls } = timed(60);
    const run = Promise.all(['a', 'b', 'c', 'd'].map((id) => client.objects.get(id)));
    await vi.runAllTimersAsync();
    await run;
    expect(calls.map((c) => c.path)).toEqual(['object/a', 'object/b', 'object/c', 'object/d']);
  });

  it('aborted waiters reject unwrapped and do not consume a slot', async () => {
    const { client, calls, sent } = timed(60);
    await client.ping(); // t=0; next slot at 1000
    const head = new AbortController();
    const queued = new AbortController();
    const a = client.objects.get('a', { signal: head.signal });
    const b = client.objects.get('b', { signal: queued.signal });
    const c = client.objects.get('c');
    const aErr = a.catch((e: unknown) => e);
    const bErr = b.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(500);
    head.abort();
    queued.abort();
    expect(((await aErr) as Error).name).toBe('AbortError');
    expect(((await bErr) as Error).name).toBe('AbortError');
    await vi.advanceTimersByTimeAsync(500);
    await c;
    expect(calls.map((x) => x.path)).toEqual(['', 'object/c']);
    expect(sent).toEqual([0, 1000]);
  });

  it('rejects immediately for an already aborted signal', async () => {
    const { client, calls } = timed();
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(client.ping({ signal: ctrl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(calls).toHaveLength(0);
  });

  it('counts waiting against the timeout', async () => {
    const { client, calls } = timed(60);
    await client.ping();
    const p = client.ping({ timeoutMs: 100 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(((await p) as Error).name).toBe('TimeoutError');
    expect(calls).toHaveLength(1);
  });

  it('does not share a limit between clients', async () => {
    const one = timed(60);
    const two = timed(60);
    await one.client.ping();
    await two.client.ping();
    expect(one.sent).toEqual([0]);
    expect(two.sent).toEqual([0]);
  });
});
