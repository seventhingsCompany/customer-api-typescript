import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  Filter,
  isForbidden,
  isNotFound,
  RentalCaseRenterRequiredError,
  SeventhingsClient,
  type CreateRentalCase,
  type CreateTask,
} from '../../src/index.js';
import { cleanup, client, env, ifFeatureActive, missingEnv, tempObject, unique } from './env.js';

async function someUserUuid(c: SeventhingsClient): Promise<string> {
  const { items } = await c.users.list({ perPage: 1 });
  if (!items[0]) throw new Error('instance has no users');
  return items[0].uuid;
}

describe.skipIf(missingEnv)('catalog items', () => {
  it('read (read-only; skipped without the product catalog)', async (ctx) => {
    const c = await client();
    const page = await c.catalogItems.list({ page: 1, perPage: 1 }).catch((err: unknown) => {
      if (isForbidden(err)) return undefined;
      throw err;
    });
    if (!page) return ctx.skip('product catalog feature or read permission unavailable');
    expect(page).toMatchObject({ page: 1, perPage: 1 });
    const first = page.items[0];
    if (!first) return;
    const detail = await c.catalogItems.get(first.uuid);
    expect(detail.uuid).toBe(first.uuid);
  });

  it('lifecycle (skipped without the product catalog)', async (ctx) => {
    const c = await client();
    const name = `ts-int-catalog-${unique()}`;
    const uuid = await c.catalogItems
      .create({ catalog_object_inventory_name: name })
      .catch((err: unknown) => {
        if (isForbidden(err)) return undefined;
        throw err;
      });
    if (!uuid) return ctx.skip('product catalog feature or create permission unavailable');
    cleanup(() => c.catalogItems.delete(uuid));

    const item = await c.catalogItems.get(uuid);
    expect(item.uuid).toBe(uuid);
    expect(item.fields.string('catalog_object_inventory_name')).toBe(name);

    await c.catalogItems.update(uuid, {
      ...item.fields.data,
      catalog_object_inventory_name: `${name}-updated`,
    });
    const updated = await c.catalogItems.get(uuid);
    expect(updated.fields.string('catalog_object_inventory_name')).toBe(`${name}-updated`);

    const filtered = await c.catalogItems.list({
      perPage: 10,
      filters: [Filter.eq('catalog_object_inventory_name', `${name}-updated`)],
    });
    expect(filtered.items.map((i) => i.uuid)).toEqual([uuid]);

    await c.catalogItems.delete(uuid);
    await expect(c.catalogItems.get(uuid)).rejects.toSatisfy(isNotFound);
  });
});

describe.skipIf(missingEnv)('timed rentals', () => {
  it('create, update and convert to full-day (skipped when the rental module is inactive)', async (ctx) => {
    const c = await client();
    await expect(c.rentals.create({} as CreateRentalCase)).rejects.toBeInstanceOf(
      RentalCaseRenterRequiredError,
    );
    if (!(await ifFeatureActive(() => c.rentals.list({ perPage: 1 })))) {
      return ctx.skip('rental module not active');
    }

    const refUuid = await tempObject(c, 'timed-rental');
    const issueAt = '2099-01-01T10:00:00+02:00';
    const dueAt = '2099-01-01T12:00:00+02:00';
    const input: CreateRentalCase = {
      title: `ts-int-timed-rental-${unique()}`,
      renter: { type: 'plain', value: 'Integration Tester' },
      references: [{ type: 'asset', uuid: refUuid }],
      isFullDay: false,
      issueAt,
      dueAt,
      issueDate: '2099-01-01',
      dueDate: '2099-01-01',
      responsibleUserUuid: await someUserUuid(c),
    };
    const uuid = await c.rentals.create(input);
    cleanup(() => c.rentals.delete(uuid));

    const same = (a: string | null, b: string) => a !== null && Date.parse(a) === Date.parse(b);
    let rental = await c.rentals.get(uuid);
    expect(rental.isFullDay).toBe(false);
    expect(same(rental.issueAt, issueAt) && same(rental.dueAt, dueAt)).toBe(true);

    await expect(
      c.rentals.update(uuid, { ...input, renter: undefined } as unknown as CreateRentalCase),
    ).rejects.toBeInstanceOf(RentalCaseRenterRequiredError);

    const newDue = '2099-01-01T13:00:00+02:00';
    await c.rentals.update(uuid, { ...input, title: 'updated timed rental', dueAt: newDue });
    rental = await c.rentals.get(uuid);
    expect(same(rental.dueAt, newDue)).toBe(true);

    await c.rentals.update(uuid, {
      ...input,
      isFullDay: true,
      issueAt: undefined,
      dueAt: undefined,
      dueDate: '2099-01-02',
    });
    rental = await c.rentals.get(uuid);
    expect(rental).toMatchObject({ isFullDay: true, issueAt: null, dueAt: null });
  });
});

describe.skipIf(missingEnv)('files', () => {
  it('custom thumbnail size is created and cached', async () => {
    const c = await client();
    const uuid = await c.files.upload(`ts-int-thumb-${unique()}.png`, solidPng(640, 480), {
      contentType: 'image/png',
    });
    // The API has no file-delete endpoint, so the fixture remains.
    const data = await c.files.getThumbnailWithSize(uuid, 320, 240);
    expect(imageSize(data)).toEqual({ width: 320, height: 240 });
    expect(await c.files.getThumbnailWithSize(uuid, 320, 240)).toEqual(data);
  });
});

describe.skipIf(missingEnv)('tasks', () => {
  it('reminders are optional', async () => {
    const c = await client();
    const input: CreateTask = {
      title: 'ts-int-optional-reminders',
      deadline: '2099-12-31',
      assignees: [await someUserUuid(c)],
      references: [{ type: 'asset', uuid: await tempObject(c, 'reminders') }],
      notify: false,
    };
    const uuid = await c.tasks.create(input);
    cleanup(() => c.tasks.delete(uuid));

    const onDeadline = [{ unit: 'days' as const, value: 0 }];
    await c.tasks.update(uuid, { ...input, reminders: onDeadline });
    expect((await c.tasks.get(uuid)).reminders).toEqual(onDeadline);
    await c.tasks.update(uuid, { ...input, reminders: [] });
    expect((await c.tasks.get(uuid)).reminders).toEqual([]);
    await c.tasks.update(uuid, input);
  });
});

describe.skipIf(missingEnv)('errors and pacing', () => {
  it('keeps live error headers', async () => {
    const c = await client();
    const err = (await c.objects
      .get('00000000-0000-4000-8000-000000000000')
      .catch((e: unknown) => e)) as ApiError;
    expect(err.isNotFound()).toBe(true);
    expect([...err.headers.keys()].length).toBeGreaterThan(0);
  });

  it.each([
    [undefined, 300],
    [400, 150],
  ])('rateLimit %s spaces requests by %sms', async (rateLimit, interval) => {
    const starts: number[] = [];
    const c = new SeventhingsClient({
      instanceUrl: env.baseUrl,
      rateLimit,
      fetch: (input, init) => {
        starts.push(performance.now());
        return fetch(input, init);
      },
    });
    await Promise.all([c.ping(), c.ping(), c.ping()]);
    expect(starts).toHaveLength(3);
    for (let i = 1; i < starts.length; i++) {
      expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThanOrEqual(interval - 2);
    }
  });
});

/** An RGB PNG of a single colour. */
function solidPng(width: number, height: number): Uint8Array {
  const row = new Uint8Array(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([80, 140, 200], 1 + x * 3);
  const raw = new Uint8Array(row.length * height);
  for (let y = 0; y < height; y++) raw.set(row, y * row.length);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return concat(
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  );
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Reads the dimensions of a PNG or baseline/progressive JPEG. */
function imageSize(data: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data[0] === 0x89 && data[1] === 0x50) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  for (let i = 2; i + 9 < data.length;) {
    if (data[i] !== 0xff) return undefined;
    const marker = data[i + 1] ?? 0;
    if (marker >= 0xc0 && marker <= 0xc2) {
      return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
    }
    i += 2 + view.getUint16(i + 2);
  }
  return undefined;
}
