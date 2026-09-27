import { describe, expect, it } from 'vitest';
import { FieldTypeName, Fields, Filter, isNotFound, SortDirection } from '../../src/index.js';
import { client, missingEnv, tempObject, unique } from './env.js';

describe.skipIf(missingEnv)('objects', () => {
  it('CRUD round trip', async () => {
    const c = await client();
    const name = `ts-int-${unique()}`;
    const uuid = await c.objects.create({ inventory_name: name, barcode: `TS-INT-${unique()}` });

    expect((await c.objects.get(uuid)).inventory_name).toBe(name);
    expect((await c.objects.list({ perPage: 1 })).length).toBeGreaterThan(0);

    await c.objects.patch(uuid, { inventory_name: `${name}-updated` });
    expect((await c.objects.get(uuid)).inventory_name).toBe(`${name}-updated`);

    await c.objects.delete(uuid);
    await expect(c.objects.get(uuid)).rejects.toSatisfy(isNotFound);
  });

  it('filters, sorts and counts', async () => {
    const c = await client();
    const barcode = `TS-INT-FILTER-${unique()}`;
    const uuid = await c.objects.create({ inventory_name: 'ts-int-filter', barcode });
    try {
      const filters = [Filter.eq('barcode', barcode)];
      const found = await c.objects.list({ filters, sort: { created_at: SortDirection.Desc } });
      expect(found.map((o) => new Fields(o).uuid)).toEqual([uuid]);
      expect(await c.objects.count({ filters })).toBe(1);
      expect(await c.objects.count()).toBeGreaterThanOrEqual(1);
      expect(new Fields(await c.objects.getByBarcode(barcode)).uuid).toBe(uuid);
    } finally {
      await c.objects.delete(uuid);
    }
  });

  it('archive / unarchive', async () => {
    const c = await client();
    const uuid = await tempObject(c, 'archive');
    await c.objects.archive(uuid);
    await c.objects.unarchive(uuid);
  });

  it('all() iterates with a small page size', async () => {
    const c = await client();
    await tempObject(c, 'all-1');
    await tempObject(c, 'all-2');
    let n = 0;
    for await (const obj of c.objects.all({ perPage: 1 })) {
      expect(obj.uuid).not.toBe('');
      if (++n === 2) break;
    }
    expect(n).toBe(2);
  });

  it('attaches and detaches files', async (ctx) => {
    const c = await client();
    const defs = await c.fieldDefinitions.list('asset');
    const field = defs.find((d) => d.fieldType.name === FieldTypeName.Attachment);
    if (!field) return ctx.skip('no ATTACHMENT field on the asset template');

    const objUuid = await tempObject(c, 'files');
    const fileUuid = await c.files.upload('test.txt', new TextEncoder().encode('ts integration'), {
      contentType: 'text/plain',
    });
    const attachment = { fieldKey: field.fieldKey, fileUuid };
    expect((await c.objects.addFiles(objUuid, [attachment])).status).toBeLessThan(300);
    expect((await c.objects.removeFiles(objUuid, [attachment])).status).toBeLessThan(300);
  });
});
