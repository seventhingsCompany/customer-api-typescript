import { describe, expect, it } from 'vitest';
import { client, ifFeatureActive, missingEnv, tempObject } from './env.js';

describe.skipIf(missingEnv)('history', () => {
  it('object history pages', async () => {
    const c = await client();
    const uuid = await tempObject(c, 'history');
    await c.objects.patch(uuid, { inventory_name: 'ts-int-history-updated' });
    const res = await c.objects.history(uuid, { page: 1, perPage: 1 });
    expect(res.page).toBe(1);
    expect(res.perPage).toBe(1);
    expect(res.total).toBeGreaterThanOrEqual(res.items.length);
  });

  it('room, location, person and task history', async () => {
    const c = await client();
    const [room] = await c.rooms.list({ perPage: 1 });
    if (room) expect((await c.rooms.history(String(room.room_uuid ?? room.uuid))).page).toBe(1);
    const [location] = await c.locations.list({ perPage: 1 });
    if (location) {
      const uuid = String(location.location_uuid ?? location.uuid);
      expect((await c.locations.history(uuid)).page).toBe(1);
    }
    const { items: persons } = await c.persons.list({ perPage: 1 });
    if (persons[0]) expect((await c.persons.history(persons[0].uuid)).page).toBe(1);
    const [task] = await c.tasks.list();
    if (task) expect((await c.tasks.history(task.uuid)).page).toBe(1);
    const rentals = await ifFeatureActive(() => c.rentals.list({ perPage: 1 }));
    if (rentals?.[0]) expect((await c.rentals.history(rentals[0].uuid)).page).toBe(1);
  });
});

describe.skipIf(missingEnv)('circularity hub', () => {
  it('lists items and orders (skipped when the module is inactive)', async (ctx) => {
    const c = await client();
    const items = await ifFeatureActive(() => c.circularityHub.listItems({ perPage: 1 }));
    if (!items) return ctx.skip('CircularityHub module not active');
    expect(Array.isArray(await c.circularityHub.listOrders({ perPage: 1 }))).toBe(true);
    if (items[0]) {
      const id = Number(items[0].id);
      expect((await c.circularityHub.getItem(id)).id).toBe(id);
    }
  });
});
