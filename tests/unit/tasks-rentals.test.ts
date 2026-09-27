import { describe, expect, it } from 'vitest';
import { ApiError, RenterType, TaskStatus, TimeIntervalUnit } from '../../src/index.js';
import { created, error, json, ok, setup } from './mock.js';

const TASK = {
  uuid: 't-1',
  title: 'Check',
  status: 'open',
  deadline: '2025-01-01',
  assignees: ['u1'],
  author: 'u2',
  references: [{ type: 'asset', uuid: 'o1', name: 'Laptop', id: 3, status: 'open' }],
  reminders: [{ unit: 'days', value: 1 }],
  recurring_schedule: null,
  comment: null,
  attachments: [
    {
      uuid: 'f',
      name: 'a.pdf',
      type: 'application/pdf',
      size: 10,
      data_uri: '/d',
      thumbnail_uri: '/t',
    },
  ],
  created_at: 'c',
  updated_at: 'u',
};

describe('tasks', () => {
  it('list encodes filters and maps the bare array', async () => {
    const { client, last } = setup(() => json([TASK]));
    const tasks = await client.tasks.list({
      status: TaskStatus.Open,
      deadlineFrom: '2025-01-01',
      deadlineTo: '2025-12-31',
      assignee: 'u1',
      author: 'u 2',
      referenceType: 'asset',
    });
    expect(last().path).toBe('task-management/tasks');
    expect(last().query).toBe(
      'status=open&deadline_from=2025-01-01&deadline_to=2025-12-31&assignee=u1&author=u%202&reference_type=asset',
    );
    expect(tasks[0]).toEqual({
      uuid: 't-1',
      title: 'Check',
      status: 'open',
      deadline: '2025-01-01',
      assignees: ['u1'],
      author: 'u2',
      references: [{ type: 'asset', uuid: 'o1', name: 'Laptop', id: 3, status: 'open' }],
      reminders: [{ unit: 'days', value: 1 }],
      recurringSchedule: null,
      comment: null,
      attachments: [
        {
          uuid: 'f',
          name: 'a.pdf',
          type: 'application/pdf',
          size: 10,
          dataUri: '/d',
          thumbnailUri: '/t',
        },
      ],
      createdAt: 'c',
      updatedAt: 'u',
    });
  });

  it('create sends snake_case with defaults and omits unset optionals', async () => {
    const { client, last } = setup(() => created('/task-management/task/t-9'));
    expect(await client.tasks.create({ title: 'T' })).toBe('t-9');
    expect(last().path).toBe('task-management/task');
    expect(last().json()).toEqual({
      title: 'T',
      deadline: null,
      assignees: [],
      references: [],
      reminders: [],
      recurring_schedule: null,
    });
  });

  it('create sends every field', async () => {
    const { client, last } = setup(() => created('/task-management/task/t-9'));
    await client.tasks.create({
      title: 'T',
      deadline: '2025-02-01',
      assignees: ['u'],
      references: [{ type: 'asset', uuid: 'o' }],
      reminders: [{ unit: TimeIntervalUnit.Weeks, value: 1 }],
      recurringSchedule: { unit: 'months', value: 3 },
      comment: 'c',
      attachments: ['f'],
      notify: false,
    });
    expect(last().json()).toEqual({
      title: 'T',
      deadline: '2025-02-01',
      assignees: ['u'],
      references: [{ type: 'asset', uuid: 'o' }],
      reminders: [{ unit: 'weeks', value: 1 }],
      recurring_schedule: { unit: 'months', value: 3 },
      comment: 'c',
      attachments: ['f'],
      notify: false,
    });
  });

  it('get / update / delete / updateStatus', async () => {
    const { client, calls } = setup((req) => (req.method === 'GET' ? json(TASK) : ok()));
    expect((await client.tasks.get('t-1')).title).toBe('Check');
    await client.tasks.update('t-1', { title: 'New' });
    await client.tasks.delete('t-1');
    await client.tasks.updateStatus('t-1', TaskStatus.Closed);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET task-management/task/t-1',
      'PUT task-management/task/t-1',
      'DELETE task-management/task/t-1',
      'PUT task-management/task/t-1/status',
    ]);
    expect(calls[3]?.json()).toEqual({ status: 'closed' });
  });

  it('surfaces errors', async () => {
    const { client } = setup(() => error(500));
    await expect(client.tasks.list()).rejects.toBeInstanceOf(ApiError);
  });
});

const RENTAL = {
  uuid: 'r-1',
  status: 'borrowed',
  title: 'Loan',
  renter: { type: 'plain', value: 'Bob' },
  references: [{ type: 'asset', uuid: 'o', name: 'Drill', id: 2 }],
  issue_date: '2025-01-01',
  issue_date_reminder: { unit: 'days', value: 1 },
  due_date: '2025-02-01',
  due_date_reminder: null,
  comment: 'c',
  responsible_user_uuid: 'u',
  author: 'a',
  attachments: [],
  created_at: 'c',
  updated_at: 'u',
};

describe('rentals', () => {
  it('list maps items and encodes options', async () => {
    const { client, last } = setup(() => json({ items: [RENTAL] }));
    const [r] = await client.rentals.list({ perPage: 5 });
    expect(last().path).toBe('rental-management/rental-cases');
    expect(last().query).toBe('per_page=5');
    expect(r).toMatchObject({
      uuid: 'r-1',
      renter: { type: 'plain', value: 'Bob' },
      issueDateReminder: { unit: 'days', value: 1 },
      dueDateReminder: null,
      responsibleUserUuid: 'u',
    });
  });

  it('maps a null renter', async () => {
    const { client } = setup(() => json({ ...RENTAL, renter: null }));
    expect((await client.rentals.get('r-1')).renter).toBeNull();
  });

  it('create sends snake_case and omits unset reminders', async () => {
    const { client, last } = setup(() => created('/rental-management/rental-case/r-9'));
    const uuid = await client.rentals.create({
      title: 'Loan',
      renter: { type: RenterType.User, value: 'u-1' },
      references: [{ type: 'asset', uuid: 'o' }],
      issueDate: '2025-01-01',
      dueDate: '2025-02-01',
      responsibleUserUuid: 'u',
    });
    expect(uuid).toBe('r-9');
    expect(last().json()).toEqual({
      title: 'Loan',
      renter: { type: 'user', value: 'u-1' },
      references: [{ type: 'asset', uuid: 'o' }],
      issue_date: '2025-01-01',
      due_date: '2025-02-01',
      comment: '',
      responsible_user_uuid: 'u',
      attachments: [],
    });
  });

  it('update / delete', async () => {
    const { client, calls } = setup(() => ok());
    await client.rentals.update('r-1', {
      title: 'x',
      issueDate: 'a',
      dueDate: 'b',
      responsibleUserUuid: 'u',
      dueDateReminder: { unit: 'weeks', value: 1 },
    });
    await client.rentals.delete('r-1');
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.json()).toMatchObject({ due_date_reminder: { unit: 'weeks', value: 1 } });
    expect(calls[1]?.path).toBe('rental-management/rental-case/r-1');
  });

  it('all() walks pages', async () => {
    const { client } = setup((req) =>
      json({ items: req.query.startsWith('page=1&') ? [RENTAL] : [] }),
    );
    const out = [];
    for await (const r of client.rentals.all({ perPage: 1 })) out.push(r.uuid);
    expect(out).toEqual(['r-1']);
  });

  it('reports inactive features', async () => {
    const { client } = setup(() =>
      error(403, '{"message":"The required feature for this endpoint is not active"}'),
    );
    const err = (await client.rentals.list().catch((e: unknown) => e)) as ApiError;
    expect(err.isFeatureInactive()).toBe(true);
  });
});
