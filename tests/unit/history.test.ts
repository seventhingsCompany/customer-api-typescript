import { describe, expect, it } from 'vitest';
import { json, setup } from './mock.js';

const entry = (key: string) => ({
  [key]: 'subject',
  user_uuid: 'u',
  occurred_at: '2025-01-01 10:00:00',
  event_name: 'updated',
  description: 'd',
  details: '{"a":1}',
});

type Client = ReturnType<typeof setup>['client'];

describe('history', () => {
  it.each([
    [
      'room',
      'room/s/history',
      'room_uuid',
      'roomUuid',
      (c: Client) => c.rooms.history('s', { page: 2, perPage: 20 }),
    ],
    [
      'location',
      'location/s/history',
      'location_uuid',
      'locationUuid',
      (c: Client) => c.locations.history('s', { page: 2, perPage: 20 }),
    ],
    [
      'person',
      'person/s/history',
      'person_uuid',
      'personUuid',
      (c: Client) => c.persons.history('s', { page: 2, perPage: 20 }),
    ],
    [
      'task',
      'task-management/task/s/history',
      'task_uuid',
      'taskUuid',
      (c: Client) => c.tasks.history('s', { page: 2, perPage: 20 }),
    ],
    [
      'rental case',
      'rental-management/rental-case/s/history',
      'rental_case_uuid',
      'rentalCaseUuid',
      (c: Client) => c.rentals.history('s', { page: 2, perPage: 20 }),
    ],
  ])('%s history', async (_, path, key, prop, call) => {
    const { client, last } = setup(() =>
      json({ items: [entry(key)], page: 2, per_page: 20, total: 21 }),
    );
    const res = await call(client);
    expect(last().path).toBe(path);
    expect(last().query).toBe('page=2&per_page=20');
    expect(res).toEqual({
      items: [
        {
          [prop]: 'subject',
          userUuid: 'u',
          occurredAt: '2025-01-01 10:00:00',
          eventName: 'updated',
          description: 'd',
          details: '{"a":1}',
        },
      ],
      page: 2,
      perPage: 20,
      total: 21,
    });
  });

  it('object history keeps raw entries', async () => {
    const raw = { type: 'object_merge', user_id: 1, absorbedObjectData: { a: 1 } };
    const { client, last } = setup(() => json({ items: [raw], page: 1, per_page: 50, total: 1 }));
    const res = await client.objects.history('o/1');
    expect(last().path).toBe('object/o%2F1/history');
    expect(last().query).toBe('');
    expect(res.items).toEqual([raw]);
  });
});
