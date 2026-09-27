import { describe, expect, it } from 'vitest';
import { ApiError, Fields, Filter } from '../../src/index.js';
import { created, error, json, ok, setup } from './mock.js';

describe('objects', () => {
  it('list encodes options and returns items', async () => {
    const { client, last } = setup(() => json({ items: [{ uuid: 'a' }, { uuid: 'b' }] }));
    const items = await client.objects.list({
      page: 2,
      perPage: 10,
      sort: { name: 'ASC' },
      filters: [Filter.in('status', 'x', 'y')],
    });
    expect(items).toEqual([{ uuid: 'a' }, { uuid: 'b' }]);
    expect(last().method).toBe('GET');
    expect(last().path).toBe('objects');
    expect(last().query).toBe(
      'page=2&per_page=10&sort[name]=ASC&filter[status][in][]=x&filter[status][in][]=y',
    );
  });

  it('count', async () => {
    const { client, last } = setup(() => json({ count: 42 }));
    expect(await client.objects.count({ filters: [Filter.eq('a', 'b')] })).toBe(42);
    expect(last().path).toBe('objects/count');
    expect(last().query).toBe('filter[a][eq]=b');
  });

  it('create returns the UUID from Location', async () => {
    const { client, last } = setup(() => created('/customer-api/v1/object/new-uuid'));
    expect(await client.objects.create({ name: 'Laptop' })).toBe('new-uuid');
    expect(last().path).toBe('object');
    expect(last().json()).toEqual({ name: 'Laptop' });
  });

  it('get / getByBarcode (escaped)', async () => {
    const { client, calls } = setup(() => json({ uuid: 'u', name: 'n' }));
    expect(await client.objects.get('u')).toEqual({ uuid: 'u', name: 'n' });
    await client.objects.getByBarcode('A/B 1');
    expect(calls[0]?.path).toBe('object/u');
    expect(calls[1]?.path).toBe('object/by-barcode/A%2FB%201');
  });

  it('patch / delete / archive / unarchive', async () => {
    const { client, calls } = setup(() => ok());
    await client.objects.patch('u', { name: 'new' });
    await client.objects.delete('u');
    await client.objects.archive('u');
    await client.objects.unarchive('u');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'PATCH object/u',
      'DELETE object/u',
      'POST object/u/archive',
      'POST object/u/unarchive',
    ]);
    expect(calls[0]?.json()).toEqual({ name: 'new' });
    expect(calls[2]?.body).toBeUndefined();
  });

  it('addFiles / removeFiles send kebab-case keys and return status', async () => {
    const { client, calls } = setup((req) =>
      req.path.endsWith('add-file') ? json({ results: [] }, { status: 207 }) : ok(200),
    );
    const res = await client.objects.addFiles('u', [{ fieldKey: 'docs', fileUuid: 'f1' }]);
    expect(res).toEqual({ status: 207, body: { results: [] } });
    expect(calls[0]?.json()).toEqual([{ 'field-key': 'docs', 'file-uuid': 'f1' }]);
    const removed = await client.objects.removeFiles('u', [{ fieldKey: 'docs', fileUuid: 'f1' }]);
    expect(removed.status).toBe(200);
    expect(calls[1]?.path).toBe('object/u/remove-file');
  });

  it.each([
    ['list', (c: ReturnType<typeof setup>['client']) => c.objects.list()],
    ['count', (c: ReturnType<typeof setup>['client']) => c.objects.count()],
    ['create', (c: ReturnType<typeof setup>['client']) => c.objects.create({})],
    ['patch', (c: ReturnType<typeof setup>['client']) => c.objects.patch('u', {})],
  ])('%s surfaces 500 as ApiError', async (_, call) => {
    const { client } = setup(() => error(500));
    await expect(call(client)).rejects.toBeInstanceOf(ApiError);
  });

  it('create fails without a Location header', async () => {
    const { client } = setup(() => ok(201));
    await expect(client.objects.create({})).rejects.toThrow(/missing Location/);
  });

  describe('all()', () => {
    it('walks every page and yields Fields', async () => {
      const { client, calls } = setup((req) => {
        const page = Number(new URLSearchParams(req.query).get('page'));
        return json({ items: page < 3 ? [{ uuid: `${page}a` }, { uuid: `${page}b` }] : [] });
      });
      const uuids: string[] = [];
      for await (const obj of client.objects.all({ perPage: 2, filters: [Filter.eq('a', 1)] })) {
        expect(obj).toBeInstanceOf(Fields);
        uuids.push(obj.uuid);
      }
      expect(uuids).toEqual(['1a', '1b', '2a', '2b']);
      expect(calls.map((c) => c.query)).toEqual([
        'page=1&per_page=2&filter[a][eq]=1',
        'page=2&per_page=2&filter[a][eq]=1',
        'page=3&per_page=2&filter[a][eq]=1',
      ]);
    });

    it('defaults to 100 per page and ignores opts.page', async () => {
      const { client, last } = setup(() => json({ items: [] }));
      for await (const _ of client.objects.all({ page: 9 })) void _;
      expect(last().query).toBe('page=1&per_page=100');
    });

    it('stops fetching on break', async () => {
      const { client, calls } = setup(() => json({ items: [{ uuid: 'x' }] }));
      for await (const _ of client.objects.all({ perPage: 1 })) {
        void _;
        if (calls.length === 2) break;
      }
      expect(calls).toHaveLength(2);
    });

    it('propagates errors', async () => {
      const { client } = setup(() => error(500));
      const consume = async () => {
        for await (const _ of client.objects.all()) void _;
      };
      await expect(consume()).rejects.toBeInstanceOf(ApiError);
    });
  });
});

describe.each([
  ['rooms', 'room'],
  ['locations', 'location'],
] as const)('%s', (service, singular) => {
  it('list unwraps enveloped and flat items', async () => {
    const { client, last } = setup(() =>
      json({
        items: [
          { uuid: 'r1', fields: { name: 'A' } },
          { uuid: 'r2', name: 'B' },
        ],
      }),
    );
    expect(await client[service].list({ page: 1 })).toEqual([
      { uuid: 'r1', name: 'A' },
      { uuid: 'r2', name: 'B' },
    ]);
    expect(last().path).toBe(`${singular}s`);
  });

  it('get unwraps envelopes', async () => {
    const { client, last } = setup(() => json({ uuid: 'r1', fields: { name: 'A' } }));
    expect(await client[service].get('r1')).toEqual({ uuid: 'r1', name: 'A' });
    expect(last().path).toBe(`${singular}/r1`);
  });

  it('patch returns the updated, unwrapped record', async () => {
    const { client, last } = setup(() => json({ uuid: 'r1', fields: { name: 'New' } }));
    expect(await client[service].patch('r1', { name: 'New' })).toEqual({
      uuid: 'r1',
      name: 'New',
    });
    expect(last().method).toBe('PATCH');
    expect(last().json()).toEqual({ name: 'New' });
  });

  it('create / count / delete', async () => {
    const { client, calls } = setup((req) =>
      req.method === 'POST'
        ? created(`/${singular}/new`)
        : req.method === 'GET'
          ? json({ count: 3 })
          : ok(),
    );
    expect(await client[service].create({ name: 'x' })).toBe('new');
    expect(await client[service].count()).toBe(3);
    await client[service].delete('r1');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `POST ${singular}`,
      `GET ${singular}s/count`,
      `DELETE ${singular}/r1`,
    ]);
  });

  it('all() yields unwrapped Fields', async () => {
    const { client } = setup(() => json({ items: [{ uuid: 'r1', fields: { name: 'A' } }] }));
    const names: string[] = [];
    for await (const r of client[service].all()) names.push(r.name);
    expect(names).toEqual(['A']);
  });
});

describe('API quirks seen on live instances', () => {
  it('patch re-reads the record when the API answers {}', async () => {
    const { client, calls } = setup((req) =>
      req.method === 'PATCH' ? json({}) : json({ location_uuid: 'l1', name: 'New' }),
    );
    expect(await client.locations.patch('l1', { name: 'New' })).toEqual({
      location_uuid: 'l1',
      name: 'New',
    });
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'GET']);
  });

  it('Fields.uuid falls back to resource-specific keys', () => {
    expect(new Fields({ asset_uuid: 'a' }).uuid).toBe('a');
    expect(new Fields({ location_uuid: 'l' }).uuid).toBe('l');
    expect(new Fields({ uuid: 'u', asset_uuid: 'a' }).uuid).toBe('u');
  });
});
