import { describe, expect, it } from 'vitest';
import { ApiError, SortOrder, UserSortBy } from '../../src/index.js';
import { created, error, json, ok, setup } from './mock.js';

const FLAT_PERSON = {
  person_uuid: 'p-1',
  id: 5,
  user_uuid: 'usr',
  email: 'a@b.c',
  first_name: 'Ada',
  last_name: 'Lovelace',
  department: null,
  custom_badge: 'X-1',
};

describe('persons', () => {
  it('list encodes sort_by/order and maps the response', async () => {
    const { client, last } = setup(() =>
      json({
        items: [FLAT_PERSON],
        page: 1,
        per_page: 10,
        sort_by: 'email',
        order: 'asc',
        total: 1,
      }),
    );
    const res = await client.persons.list({
      page: 1,
      perPage: 10,
      sortBy: 'email',
      order: SortOrder.Asc,
    });
    expect(last().path).toBe('persons');
    expect(last().query).toBe('page=1&per_page=10&sort_by=email&order=asc');
    expect(res.total).toBe(1);
    expect(res.perPage).toBe(10);
    expect(res.sortBy).toBe('email');
    expect(res.items[0]?.firstName).toBe('Ada');
  });

  it('maps a flat person and keeps custom fields', async () => {
    const { client } = setup(() => json(FLAT_PERSON));
    const p = await client.persons.get('p-1');
    expect(p).toMatchObject({
      uuid: 'p-1',
      id: 5,
      userUuid: 'usr',
      email: 'a@b.c',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: null,
      updatedAt: null,
    });
    expect(p.fields.string('custom_badge')).toBe('X-1');
  });

  it('accepts the {uuid, fields} envelope', async () => {
    const { client } = setup(() =>
      json({ uuid: 'p-2', fields: { id: 6, first_name: 'Grace', custom: true } }),
    );
    const p = await client.persons.get('p-2');
    expect(p.uuid).toBe('p-2');
    expect(p.id).toBe(6);
    expect(p.firstName).toBe('Grace');
    expect(p.fields.bool('custom')).toBe(true);
    expect(p.fields.has('uuid')).toBe(false);
  });

  it('prefers person_uuid over uuid', async () => {
    const { client } = setup(() => json({ uuid: 'new', person_uuid: 'legacy' }));
    expect((await client.persons.get('x')).uuid).toBe('legacy');
  });

  it('falls back to uuid when person_uuid is missing', async () => {
    const { client } = setup(() => json({ uuid: 'new', email: 'e' }));
    expect((await client.persons.get('x')).uuid).toBe('new');
  });

  it('tolerates mistyped identifiers', async () => {
    const { client } = setup(() => json({ person_uuid: 123, uuid: false }));
    expect((await client.persons.get('x')).uuid).toBe('');
  });

  it('getById / count', async () => {
    const { client, calls } = setup((req) =>
      req.path.endsWith('count') ? json({ count: 9 }) : json(FLAT_PERSON),
    );
    await client.persons.getById(5);
    expect(await client.persons.count()).toBe(9);
    expect(calls.map((c) => c.path)).toEqual(['person/by-id/5', 'persons/count']);
  });

  it('create wraps fields', async () => {
    const { client, last } = setup(() => created('/person/p-9'));
    expect(await client.persons.create({ first_name: 'A' })).toBe('p-9');
    expect(last().json()).toEqual({ fields: { first_name: 'A' } });
  });

  it('patch sends flat fields; delete', async () => {
    const { client, calls } = setup(() => ok());
    await client.persons.patch('p', { first_name: 'B' });
    await client.persons.delete('p');
    expect(calls[0]?.json()).toEqual({ first_name: 'B' });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'PATCH person/p',
      'DELETE person/p',
    ]);
  });

  it('createUser sends only the filter', async () => {
    const { client, last } = setup(() => ok());
    await client.persons.createUser({
      filter: { email: { like: ['@corp'] } },
      sort: { id: 'ASC' },
    });
    expect(last().path).toBe('persons/create-user');
    expect(last().json()).toEqual({ filter: { email: { like: ['@corp'] } } });
  });

  it('all() walks pages', async () => {
    const { client, calls } = setup((req) => {
      const page = Number(new URLSearchParams(req.query).get('page'));
      return json({ items: page === 1 ? [FLAT_PERSON, FLAT_PERSON] : [FLAT_PERSON] });
    });
    const out = [];
    for await (const p of client.persons.all({ perPage: 2, sortBy: 'id' })) out.push(p);
    expect(out).toHaveLength(3);
    expect(calls[1]?.query).toBe('page=2&per_page=2&sort_by=id');
  });

  it('surfaces 404', async () => {
    const { client } = setup(() => error(404));
    await expect(client.persons.get('x')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('users', () => {
  const USER = {
    uuid: 'u-1',
    id: 1,
    email: 'a@b.c',
    firstname: 'Ada',
    lastname: null,
    display_name: 'Ada',
  };

  it('list encodes options and maps users', async () => {
    const { client, last } = setup(() =>
      json({ items: [USER], page: 2, per_page: 5, sort_by: 'email', order: 'desc', total: 6 }),
    );
    const res = await client.users.list({
      page: 2,
      perPage: 5,
      sortBy: UserSortBy.Email,
      order: SortOrder.Desc,
    });
    expect(last().query).toBe('page=2&per_page=5&sort_by=email&order=desc');
    expect(res.items[0]).toEqual({
      uuid: 'u-1',
      id: 1,
      email: 'a@b.c',
      firstName: 'Ada',
      lastName: null,
      displayName: 'Ada',
    });
  });

  it('list without options sends no query', async () => {
    const { client, last } = setup(() => json({ items: [] }));
    await client.users.list();
    expect(last().url).toBe('https://example.com/customer-api/v1/users');
  });

  it('get / getById', async () => {
    const { client, calls } = setup(() => json(USER));
    await client.users.get('u-1');
    await client.users.getById(1);
    expect(calls.map((c) => c.path)).toEqual(['user/u-1', 'user/by-id/1']);
  });

  it('all() walks pages', async () => {
    const { client } = setup((req) => json({ items: req.query.includes('page=1&') ? [USER] : [] }));
    const out = [];
    for await (const u of client.users.all({ perPage: 1 })) out.push(u.uuid);
    expect(out).toEqual(['u-1']);
  });
});
