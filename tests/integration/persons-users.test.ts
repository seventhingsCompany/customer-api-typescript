import { describe, expect, it } from 'vitest';
import { isNotFound, SortOrder, UserSortBy } from '../../src/index.js';
import { cleanup, client, fillMandatory, missingEnv, unique } from './env.js';

describe.skipIf(missingEnv)('users', () => {
  it('list, sort and get', async () => {
    const c = await client();
    const res = await c.users.list({ perPage: 2, sortBy: UserSortBy.Email, order: SortOrder.Asc });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.perPage).toBe(2);
    const first = res.items[0]!;
    expect((await c.users.get(first.uuid)).email).toBe(first.email);
    expect((await c.users.getById(first.id)).uuid).toBe(first.uuid);
  });

  it('all() yields users', async () => {
    const c = await client();
    let n = 0;
    for await (const u of c.users.all({ perPage: 1 })) {
      expect(u.uuid).not.toBe('');
      if (++n === 2) break;
    }
    expect(n).toBeGreaterThan(0);
  });
});

describe.skipIf(missingEnv)('persons', () => {
  it('list, count and get', async (ctx) => {
    const c = await client();
    const res = await c.persons.list({ perPage: 1 });
    expect(await c.persons.count()).toBeGreaterThanOrEqual(res.items.length);
    const first = res.items[0];
    if (!first) return ctx.skip('instance has no persons');
    expect((await c.persons.get(first.uuid)).uuid).toBe(first.uuid);
    expect((await c.persons.getById(first.id)).uuid).toBe(first.uuid);
  });

  it('create, patch, delete', async (ctx) => {
    const c = await client();
    const suffix = unique();
    const email = `ts-int-${suffix}@example.test`;
    const fields = await fillMandatory(c, 'person', {
      email,
      first_name: 'SDK',
      last_name: `Integration ${suffix}`,
    });
    if (!fields) return ctx.skip('person has mandatory fields that cannot be auto-filled');

    const uuid = await c.persons.create(fields);
    cleanup(() => c.persons.delete(uuid));
    expect((await c.persons.get(uuid)).email).toBe(email);

    await c.persons.patch(uuid, { last_name: `Patched ${suffix}` });
    const patched = await c.persons.get(uuid);
    expect(patched.lastName).toBe(`Patched ${suffix}`);
    expect(patched.fields.string('last_name')).toBe(`Patched ${suffix}`);

    await c.persons.delete(uuid);
    await expect(c.persons.get(uuid)).rejects.toSatisfy(isNotFound);
  });
});
