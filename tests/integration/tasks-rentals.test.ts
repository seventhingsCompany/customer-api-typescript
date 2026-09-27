import { describe, expect, it } from 'vitest';
import { isNotFound, TaskStatus } from '../../src/index.js';
import { cleanup, client, ifFeatureActive, missingEnv, tempObject } from './env.js';

async function someUserUuid() {
  const c = await client();
  const { items } = await c.users.list({ perPage: 1 });
  if (!items[0]) throw new Error('instance has no users');
  return items[0].uuid;
}

describe.skipIf(missingEnv)('tasks', () => {
  it('lifecycle', async () => {
    const c = await client();
    const userUuid = await someUserUuid();
    const refUuid = await tempObject(c, 'task-ref');

    const input = {
      title: 'ts-int-task',
      deadline: '2099-12-31',
      assignees: [userUuid],
      references: [{ type: 'asset' as const, uuid: refUuid }],
      reminders: [{ unit: 'days' as const, value: 1 }],
    };
    const uuid = await c.tasks.create(input);
    cleanup(() => c.tasks.delete(uuid));

    const task = await c.tasks.get(uuid);
    expect(task.title).toBe('ts-int-task');
    expect(task.status).toBe(TaskStatus.Open);
    expect(task.references[0]?.uuid).toBe(refUuid);

    await c.tasks.update(uuid, { ...input, title: 'ts-int-task-updated' });
    expect((await c.tasks.get(uuid)).title).toBe('ts-int-task-updated');

    await c.tasks.updateStatus(uuid, TaskStatus.Closed);
    expect((await c.tasks.get(uuid)).status).toBe(TaskStatus.Closed);

    const closed = await c.tasks.list({ status: TaskStatus.Closed, assignee: userUuid });
    expect(closed.some((t) => t.uuid === uuid)).toBe(true);

    await c.tasks.delete(uuid);
    await expect(c.tasks.get(uuid)).rejects.toSatisfy(isNotFound);
  });
});

describe.skipIf(missingEnv)('rentals', () => {
  it('lifecycle (skipped when the rental module is inactive)', async (ctx) => {
    const c = await client();
    const listed = await ifFeatureActive(() => c.rentals.list({ perPage: 1 }));
    if (!listed) return ctx.skip('rental module not active');

    const userUuid = await someUserUuid();
    const refUuid = await tempObject(c, 'rental-ref');
    const input = {
      title: 'ts-int-rental',
      renter: { type: 'plain' as const, value: 'Integration Tester' },
      references: [{ type: 'asset' as const, uuid: refUuid }],
      issueDate: '2099-01-01',
      dueDate: '2099-06-01',
      comment: 'ts integration',
      responsibleUserUuid: userUuid,
    };
    const uuid = await c.rentals.create(input);
    cleanup(() => c.rentals.delete(uuid));

    const rental = await c.rentals.get(uuid);
    expect(rental.title).toBe('ts-int-rental');
    expect(rental.renter).toEqual({ type: 'plain', value: 'Integration Tester' });

    await c.rentals.update(uuid, { ...input, title: 'ts-int-rental-updated' });
    expect((await c.rentals.get(uuid)).title).toBe('ts-int-rental-updated');

    await c.rentals.delete(uuid);
    await expect(c.rentals.get(uuid)).rejects.toSatisfy(isNotFound);
  });
});
