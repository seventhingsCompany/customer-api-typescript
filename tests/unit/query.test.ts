import { describe, expect, it } from 'vitest';
import { Filter, FilterOperator, SortDirection } from '../../src/index.js';
import { encodeListOptions, encodeParams } from '../../src/query.js';

describe('encodeListOptions', () => {
  it('returns "" for undefined and empty options', () => {
    expect(encodeListOptions(undefined)).toBe('');
    expect(encodeListOptions({})).toBe('');
  });

  it('encodes pagination', () => {
    expect(encodeListOptions({ page: 2 })).toBe('page=2');
    expect(encodeListOptions({ perPage: 50 })).toBe('per_page=50');
    expect(encodeListOptions({ page: 3, perPage: 25 })).toBe('page=3&per_page=25');
  });

  it('encodes sort with literal brackets, keeping order', () => {
    expect(encodeListOptions({ sort: { name: SortDirection.Asc } })).toBe('sort[name]=ASC');
    expect(
      encodeListOptions({
        sort: [
          ['b', 'DESC'],
          ['a', 'ASC'],
        ],
      }),
    ).toBe('sort[b]=DESC&sort[a]=ASC');
  });

  it('encodes single-value filters', () => {
    expect(encodeListOptions({ filters: [Filter.eq('status', 'active')] })).toBe(
      'filter[status][eq]=active',
    );
    expect(encodeListOptions({ filters: [Filter.gt('price', 10), Filter.lt('price', 100)] })).toBe(
      'filter[price][gt]=10&filter[price][lt]=100',
    );
  });

  it('encodes multi-value filters with []', () => {
    expect(encodeListOptions({ filters: [Filter.in('tag', 'a', 'b')] })).toBe(
      'filter[tag][in][]=a&filter[tag][in][]=b',
    );
    expect(encodeListOptions({ filters: [Filter.nin('color', 'red', 'blue')] })).toBe(
      'filter[color][nin][]=red&filter[color][nin][]=blue',
    );
    expect(encodeListOptions({ filters: [Filter.like('name', 'foo')] })).toBe(
      'filter[name][like][]=foo',
    );
    expect(encodeListOptions({ filters: [Filter.notLike('name', 'foo')] })).toBe(
      'filter[name][not_like][]=foo',
    );
  });

  it('encodes the *_or_null operators', () => {
    expect(
      encodeListOptions({
        filters: [Filter.gtOrNull('date', '2024-01-01'), Filter.lteOrNull('date', '2024-12-31')],
      }),
    ).toBe('filter[date][gt_or_null]=2024-01-01&filter[date][lte_or_null]=2024-12-31');
    expect(
      encodeListOptions({ filters: [Filter.gteOrNull('a', 1), Filter.ltOrNull('b', 2)] }),
    ).toBe('filter[a][gte_or_null]=1&filter[b][lt_or_null]=2');
  });

  it('escapes values', () => {
    expect(encodeListOptions({ filters: [Filter.eq('name', 'hello world&more=yes')] })).toBe(
      'filter[name][eq]=hello%20world%26more%3Dyes',
    );
  });

  it('stringifies numbers and booleans', () => {
    expect(encodeListOptions({ filters: [Filter.eq('active', true), Filter.neq('n', 0)] })).toBe(
      'filter[active][eq]=true&filter[n][neq]=0',
    );
  });

  it('encodes everything combined', () => {
    expect(
      encodeListOptions({
        page: 1,
        perPage: 10,
        sort: { created_at: 'DESC' },
        filters: [Filter.eq('status', 'active'), Filter.in('tag', 'x', 'y')],
      }),
    ).toBe(
      'page=1&per_page=10&sort[created_at]=DESC&filter[status][eq]=active&filter[tag][in][]=x&filter[tag][in][]=y',
    );
  });

  it('Filter constructors set operator and values', () => {
    expect(Filter.eq('f', 'v')).toEqual({ field: 'f', operator: FilterOperator.Eq, values: ['v'] });
    expect(Filter.gte('f', 'v').operator).toBe('gte');
    expect(Filter.lte('f', 'v').operator).toBe('lte');
    expect(Filter.in('f', 'a', 'b').values).toEqual(['a', 'b']);
  });
});

describe('encodeParams', () => {
  it('skips undefined and null, escapes values', () => {
    expect(encodeParams({ a: 1, b: undefined, c: null, d: 'x y' })).toBe('a=1&d=x%20y');
  });
});
