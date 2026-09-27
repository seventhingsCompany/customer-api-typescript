import { describe, expect, it } from 'vitest';
import {
  allowedValues,
  AssetTrackingTemplate,
  fieldAttribute,
  FieldTypeName,
  isMandatory,
  SYSTEM_MANAGED_FIELD_KEYS,
  type FieldDefinition,
} from '../../src/index.js';
import { created, json, ok, setup } from './mock.js';

const def = (key: string, mandatory: boolean) => ({
  uuid: `d-${key}`,
  field_key: key,
  field_type: {
    name: 'DROPDOWN',
    constraints: [{ type: 'allowed_values', value: ['a', 'b'] }],
  },
  label: key,
  attributes: mandatory ? [{ type: 'mandatory', value: 'yes' }] : [],
  relations: [{ type: 'visible_if', field_uuid: 'x', comparison_values: [1] }],
  comment: null,
  default_value: null,
  possible_values: ['a', 'b'],
});

describe('fieldDefinitions', () => {
  it('list maps definitions', async () => {
    const { client, last } = setup(() => json([def('name', true)]));
    const [d] = await client.fieldDefinitions.list(AssetTrackingTemplate.Asset);
    expect(last().path).toBe('asset-tracking/asset/field-definitions');
    expect(d).toEqual({
      uuid: 'd-name',
      fieldKey: 'name',
      fieldType: { name: 'DROPDOWN', constraints: [{ type: 'allowed_values', value: ['a', 'b'] }] },
      label: 'name',
      attributes: [{ type: 'mandatory', value: 'yes' }],
      relations: [{ type: 'visible_if', fieldUuid: 'x', comparisonValues: [1] }],
      comment: null,
      defaultValue: null,
      possibleValues: ['a', 'b'],
    });
  });

  it('get / create / update', async () => {
    const { client, calls } = setup((req) =>
      req.method === 'GET'
        ? json(def('x', false))
        : req.method === 'POST'
          ? created('/asset-tracking/room/field-definition/d-new')
          : ok(),
    );
    await client.fieldDefinitions.get('room', 'd-x');
    const uuid = await client.fieldDefinitions.create('room', {
      fieldType: { name: FieldTypeName.Text },
      label: 'Color',
    });
    await client.fieldDefinitions.update('room', 'd-new', {
      uuid: 'd-new',
      fieldKey: 'color',
      fieldType: { name: FieldTypeName.Text },
      label: 'Colour',
      relations: [{ type: 't', fieldUuid: 'f' }],
    });
    expect(uuid).toBe('d-new');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET asset-tracking/room/field-definition/d-x',
      'POST asset-tracking/room/field-definition',
      'PUT asset-tracking/room/field-definition/d-new',
    ]);
    expect(calls[1]?.json()).toEqual({
      field_type: { name: 'TEXT', constraints: [] },
      label: 'Color',
      attributes: [],
      relations: [],
      comment: null,
      default_value: null,
      possible_values: [],
    });
    expect(calls[2]?.json()).toEqual({
      uuid: 'd-new',
      field_key: 'color',
      field_type: { name: 'TEXT', constraints: [] },
      label: 'Colour',
      attributes: [],
      relations: [{ type: 't', field_uuid: 'f' }],
      comment: null,
      default_value: null,
      possible_values: [],
    });
  });

  it('tolerates nulls in the response', async () => {
    const { client } = setup(() =>
      json([{ uuid: 'd', field_key: 'k', field_type: { name: 'TEXT' }, attributes: null }]),
    );
    const [d] = await client.fieldDefinitions.list('person');
    expect(d?.attributes).toEqual([]);
    expect(d?.relations).toEqual([]);
    expect(d?.fieldType.constraints).toEqual([]);
  });

  it('mandatory skips system-managed keys; missingMandatoryFields', async () => {
    const { client } = setup(() =>
      json([def('name', true), def('id', true), def('serial', true), def('note', false)]),
    );
    const mandatory = await client.fieldDefinitions.mandatory('asset');
    expect(mandatory.map((d) => d.fieldKey)).toEqual(['name', 'serial']);
    expect(
      await client.fieldDefinitions.missingMandatoryFields('asset', { name: 'x', serial: null }),
    ).toEqual(['serial']);
  });
});

describe('field definition helpers', () => {
  const d = {
    attributes: [{ type: 'mandatory', value: 'yes' }],
    fieldType: { name: 'DROPDOWN', constraints: [{ type: 'allowed_values', value: ['a'] }] },
  } as FieldDefinition;

  it('fieldAttribute / isMandatory', () => {
    expect(fieldAttribute(d, 'mandatory')).toBe('yes');
    expect(fieldAttribute(d, 'other')).toBeUndefined();
    expect(isMandatory(d)).toBe(true);
    expect(isMandatory({ ...d, attributes: [{ type: 'mandatory', value: 'no' }] })).toBe(false);
  });

  it('allowedValues', () => {
    expect(allowedValues(d.fieldType)).toEqual(['a']);
    expect(allowedValues({ name: 'TEXT' })).toBeUndefined();
  });

  it('SYSTEM_MANAGED_FIELD_KEYS', () => {
    expect(SYSTEM_MANAGED_FIELD_KEYS.has('uuid')).toBe(true);
    expect(SYSTEM_MANAGED_FIELD_KEYS.has('name')).toBe(false);
  });
});
