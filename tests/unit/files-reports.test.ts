import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/index.js';
import { created, error, json, setup } from './mock.js';

const FILE = {
  uuid: 'f-1',
  name: 'a.png',
  type: 'image/png',
  size: 3,
  creator_id: 1,
  created_at: 'c',
  data_uri: '/d',
  thumbnail_uri: '/t',
};

describe('files', () => {
  it('list / get map metadata', async () => {
    const { client, calls } = setup((req) =>
      req.path === 'files' ? json({ items: [FILE] }) : json(FILE),
    );
    const [f] = await client.files.list();
    expect(f).toEqual({
      uuid: 'f-1',
      name: 'a.png',
      type: 'image/png',
      size: 3,
      creatorId: 1,
      createdAt: 'c',
      dataUri: '/d',
      thumbnailUri: '/t',
    });
    await client.files.get('f-1');
    expect(calls[1]?.path).toBe('file/f-1');
  });

  it('upload sends multipart field "data" and returns the UUID', async () => {
    const { client, last } = setup(() =>
      created('/file/from-location', { 'Location-UUID': 'f-9' }),
    );
    const uuid = await client.files.upload('hello.txt', new TextEncoder().encode('hello'), {
      contentType: 'text/plain',
    });
    expect(uuid).toBe('f-9');
    expect(last().method).toBe('POST');
    expect(last().path).toBe('file');
    expect(last().headers.has('Content-Type')).toBe(false);
    expect(last().headers.has('Accept')).toBe(false);
    expect(last().headers.get('Authorization')).toBe('Bearer test-token');
    const form = last().body as FormData;
    const part = form.get('data') as File;
    expect(part.name).toBe('hello.txt');
    expect(part.type).toBe('text/plain');
    expect(await part.text()).toBe('hello');
  });

  it('upload accepts Blobs, ArrayBuffers and streams', async () => {
    const { client, calls } = setup(() => created('/file/f-1'));
    await client.files.upload('a.bin', new Blob(['blob'], { type: 'image/png' }));
    await client.files.upload('b.bin', new TextEncoder().encode('buf').buffer);
    await client.files.upload('c.bin', new Blob(['stream']).stream());
    const parts = calls.map((c) => (c.body as FormData).get('data') as File);
    expect(parts[0]?.type).toBe('image/png');
    expect(parts[1]?.type).toBe('application/octet-stream');
    expect(await parts[1]?.text()).toBe('buf');
    expect(await parts[2]?.text()).toBe('stream');
  });

  it('upload falls back to Location', async () => {
    const { client } = setup(() => created('/file/f-2'));
    expect(await client.files.upload('a', new Uint8Array([1]))).toBe('f-2');
  });

  it('getData / getThumbnail return bytes without an Accept header', async () => {
    const { client, calls } = setup(() => new Response(new Uint8Array([1, 2, 3])));
    expect(await client.files.getData('f-1')).toEqual(new Uint8Array([1, 2, 3]));
    await client.files.getThumbnail('f-1');
    expect(calls.map((c) => c.path)).toEqual(['file/f-1/data', 'file/f-1/thumbnail']);
    expect(calls[0]?.headers.has('Accept')).toBe(false);
  });

  it('surfaces errors', async () => {
    const { client } = setup(() => error(500));
    await expect(client.files.upload('a', new Uint8Array())).rejects.toBeInstanceOf(ApiError);
    await expect(client.files.getData('x')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('reports', () => {
  it('listTemplates', async () => {
    const { client, last } = setup(() => json([{ uuid: 't', name: 'Label' }]));
    expect(await client.reports.listTemplates()).toEqual([{ uuid: 't', name: 'Label' }]);
    expect(last().path).toBe('report-template');
  });

  it('create requests a PDF and returns bytes', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7');
    const { client, last } = setup(
      () => new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }),
    );
    const out = await client.reports.create({ reportTemplateUuid: 't', objectUuids: ['a', 'b'] });
    expect(new TextDecoder().decode(out)).toBe('%PDF-1.7');
    expect(last().headers.get('Accept')).toBe('application/pdf');
    expect(last().json()).toEqual({ report_template_uuid: 't', object_uuids: ['a', 'b'] });
  });

  it('surfaces errors', async () => {
    const { client } = setup(() => error(422));
    await expect(
      client.reports.create({ reportTemplateUuid: 't', objectUuids: [] }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
