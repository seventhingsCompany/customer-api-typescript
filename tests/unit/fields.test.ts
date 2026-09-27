import { describe, expect, it } from 'vitest';
import { Fields } from '../../src/index.js';

const f = new Fields({
  uuid: 'u-1',
  name: 'Laptop',
  count: 3,
  price: 9.5,
  active: true,
  nothing: null,
  date: '2024-03-15',
  datetime: '2024-03-15 10:20:30',
  rfc: '2024-03-15T10:20:30+02:00',
  bad: '2024-02-31',
  text: 'not a date',
});

describe('Fields', () => {
  it('reads strings', () => {
    expect(f.string('name')).toBe('Laptop');
    expect(f.string('count')).toBeUndefined();
    expect(f.string('missing')).toBeUndefined();
  });

  it('reads numbers and ints', () => {
    expect(f.number('price')).toBe(9.5);
    expect(f.int('count')).toBe(3);
    expect(f.int('price')).toBeUndefined();
    expect(f.number('name')).toBeUndefined();
  });

  it('reads booleans', () => {
    expect(f.bool('active')).toBe(true);
    expect(f.bool('name')).toBeUndefined();
  });

  it('parses dates as UTC', () => {
    expect(f.time('date')?.toISOString()).toBe('2024-03-15T00:00:00.000Z');
    expect(f.time('datetime')?.toISOString()).toBe('2024-03-15T10:20:30.000Z');
    expect(f.time('rfc')?.toISOString()).toBe('2024-03-15T08:20:30.000Z');
  });

  it('rejects invalid dates', () => {
    expect(f.time('bad')).toBeUndefined();
    expect(f.time('text')).toBeUndefined();
    expect(f.time('count')).toBeUndefined();
    expect(f.time('missing')).toBeUndefined();
  });

  it('has / raw', () => {
    expect(f.has('name')).toBe(true);
    expect(f.has('nothing')).toBe(false);
    expect(f.has('missing')).toBe(false);
    expect(f.raw('nothing')).toBeNull();
    expect(f.raw('missing')).toBeUndefined();
  });

  it('uuid / name shortcuts', () => {
    expect(f.uuid).toBe('u-1');
    expect(f.name).toBe('Laptop');
    expect(new Fields({}).uuid).toBe('');
  });

  it('serializes to the underlying record', () => {
    expect(JSON.parse(JSON.stringify(new Fields({ a: 1 })))).toEqual({ a: 1 });
  });
});
