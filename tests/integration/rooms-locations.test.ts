import { describe, expect, it } from 'vitest';
import { isNotFound } from '../../src/index.js';
import { cleanup, client, fillMandatory, missingEnv, unique } from './env.js';

describe.skipIf(missingEnv)('locations and rooms', () => {
  it('location CRUD', async () => {
    const c = await client();
    const name = `ts-int-loc-${unique()}`;
    const uuid = await c.locations.create({ name });
    cleanup(() => c.locations.delete(uuid));

    expect((await c.locations.get(uuid)).name).toBe(name);
    const patched = await c.locations.patch(uuid, { name: `${name}-u` });
    expect(patched.name).toBe(`${name}-u`);
    expect(await c.locations.count()).toBeGreaterThan(0);

    await c.locations.delete(uuid);
    await expect(c.locations.get(uuid)).rejects.toSatisfy(isNotFound);
  });

  it('room CRUD', async (ctx) => {
    const c = await client();
    const [location] = await c.locations.list({ page: 1, perPage: 1 });
    if (!location) return ctx.skip('no locations (rooms require a building_id)');

    const fields = await fillMandatory(c, 'room', {
      name: `ts-int-room-${unique()}`,
      number: `TR-${unique()}`,
      building_id: location.id,
    });
    if (!fields) return ctx.skip('room has mandatory fields that cannot be auto-filled');

    const uuid = await c.rooms.create(fields);
    cleanup(() => c.rooms.delete(uuid));

    expect((await c.rooms.get(uuid)).name).toBe(fields.name);
    const patched = await c.rooms.patch(uuid, { name: `${String(fields.name)}-u` });
    expect(patched.name).toBe(`${String(fields.name)}-u`);
    expect((await c.rooms.list({ perPage: 1 })).length).toBeGreaterThan(0);

    await c.rooms.delete(uuid);
    await expect(c.rooms.get(uuid)).rejects.toSatisfy(isNotFound);
  });
});
