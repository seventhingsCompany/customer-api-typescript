import { describe, expect, it } from 'vitest';
import { SeventhingsError } from '../../src/index.js';
import {
  intFromLocationId,
  paginate,
  unwrapResourceFields,
  uuidFromFileUpload,
  uuidFromLocation,
} from '../../src/helpers.js';

const h = (init: Record<string, string>) => new Headers(init);

describe('uuidFromLocation', () => {
  it('returns the last path segment', () => {
    expect(uuidFromLocation(h({ Location: '/customer-api/v1/object/abc-123' }))).toBe('abc-123');
    expect(uuidFromLocation(h({ Location: 'https://x.test/object/abc/' }))).toBe('abc');
    expect(uuidFromLocation(h({ Location: 'https://x.test/object/abc?x=1' }))).toBe('abc');
  });

  it('throws when missing or empty', () => {
    expect(() => uuidFromLocation(h({}))).toThrow(SeventhingsError);
    expect(() => uuidFromLocation(h({ Location: '/' }))).toThrow(/empty path/);
  });

  it('prefers Location-UUID for uploads', () => {
    expect(uuidFromFileUpload(h({ 'Location-UUID': 'f-1', Location: '/file/other' }))).toBe('f-1');
    expect(uuidFromFileUpload(h({ Location: '/file/f-2' }))).toBe('f-2');
  });
});

describe('intFromLocationId', () => {
  it('parses the header', () => {
    expect(intFromLocationId(h({ 'Location-Id': '42' }))).toBe(42);
  });
  it('throws when missing or invalid', () => {
    expect(() => intFromLocationId(h({}))).toThrow(/missing Location-Id/);
    expect(() => intFromLocationId(h({ 'Location-Id': 'abc' }))).toThrow(/invalid Location-Id/);
    expect(() => intFromLocationId(h({ 'Location-Id': '4.5' }))).toThrow(/invalid Location-Id/);
  });
});

describe('unwrapResourceFields', () => {
  it('passes flat maps through', () => {
    const flat = { uuid: 'r', name: 'Room' };
    expect(unwrapResourceFields(flat)).toBe(flat);
  });
  it('unwraps envelopes and copies the uuid', () => {
    expect(unwrapResourceFields({ uuid: 'r', fields: { name: 'Room' } })).toEqual({
      uuid: 'r',
      name: 'Room',
    });
  });
  it('does not overwrite an inner uuid', () => {
    expect(unwrapResourceFields({ uuid: 'outer', fields: { uuid: 'inner' } })).toEqual({
      uuid: 'inner',
    });
  });
  it('requires both uuid and fields', () => {
    const noUuid = { fields: { name: 'x' } };
    expect(unwrapResourceFields(noUuid)).toBe(noUuid);
  });
});

describe('paginate', () => {
  it('walks pages until a short page', async () => {
    const pages: number[] = [];
    const out: number[] = [];
    for await (const n of paginate(2, async (page, perPage) => {
      pages.push(page);
      expect(perPage).toBe(2);
      return page < 3 ? [page * 10, page * 10 + 1] : [99];
    })) {
      out.push(n);
    }
    expect(pages).toEqual([1, 2, 3]);
    expect(out).toEqual([10, 11, 20, 21, 99]);
  });

  it('defaults to 100 per page and stops on an empty page', async () => {
    const sizes: number[] = [];
    let calls = 0;
    for await (const _ of paginate(undefined, async (_page, perPage) => {
      sizes.push(perPage);
      calls++;
      return calls === 1 ? Array.from({ length: 100 }, (_, i) => i) : [];
    })) {
      void _;
    }
    expect(sizes).toEqual([100, 100]);
  });

  it('stops fetching when the consumer breaks', async () => {
    let calls = 0;
    for await (const n of paginate(1, async (page) => {
      calls++;
      return [page];
    })) {
      if (n === 2) break;
    }
    expect(calls).toBe(2);
  });

  it('propagates errors', async () => {
    const it = paginate(1, async (page) => {
      if (page === 2) throw new Error('boom');
      return [page];
    });
    await expect(
      (async () => {
        for await (const _ of it) void _;
      })(),
    ).rejects.toThrow('boom');
  });
});
