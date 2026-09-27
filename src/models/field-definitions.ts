import { arr, str, strOrNull, type Wire } from './wire.js';

/** Template a field definition belongs to. */
export const AssetTrackingTemplate = {
  Asset: 'asset',
  Room: 'room',
  Person: 'person',
} as const;
export type AssetTrackingTemplate =
  (typeof AssetTrackingTemplate)[keyof typeof AssetTrackingTemplate];

export const FieldTypeName = {
  Attachment: 'ATTACHMENT',
  Barcode: 'BARCODE',
  Boolean: 'BOOLEAN',
  Date: 'DATE',
  Datetime: 'DATETIME',
  Decimal: 'DECIMAL',
  Dropdown: 'DROPDOWN',
  FieldValueComparison: 'FIELD_VALUE_COMPARISON',
  Link: 'LINK',
  LinkedAssets: 'LINKED_ASSETS',
  LinkedLocation: 'LINKED_LOCATION',
  LinkedPerson: 'LINKED_PERSON',
  LinkedRoom: 'LINKED_ROOM',
  LinkedUser: 'LINKED_USER',
  LongText: 'LONG_TEXT',
  Money: 'MONEY',
  Number: 'NUMBER',
  Reminder: 'REMINDER',
  Text: 'TEXT',
} as const;
export type FieldTypeName = (typeof FieldTypeName)[keyof typeof FieldTypeName];

/** Attribute type marking a field as required on create. Its value is "yes" when mandatory. */
export const FIELD_ATTRIBUTE_MANDATORY = 'mandatory';

/** Constraint type listing the permitted values of a constrained field (e.g. a DROPDOWN). */
export const CONSTRAINT_ALLOWED_VALUES = 'allowed_values';

/**
 * Field keys the server manages itself. They may be reported as mandatory by
 * the field-definitions endpoint but must not be sent when creating a resource.
 */
export const SYSTEM_MANAGED_FIELD_KEYS: ReadonlySet<string> = new Set([
  'id',
  'uuid',
  'person_uuid',
  'user_uuid',
  'created_at',
  'updated_at',
  'updated_by_user_id',
  'imported_by_user_id',
  'imported_with_template_id',
  'imported_at',
  'created_on_import_with_template_id',
]);

/** A constraint on a field's value. `value` is a string, number or string[] depending on `type`. */
export interface FieldValueConstraint {
  type: string;
  value: unknown;
}

/** An attribute of a field definition. `value` is a string or number depending on `type`. */
export interface FieldAttribute {
  type: string;
  value: unknown;
}

export interface FieldRelation {
  type: string;
  fieldUuid: string;
  comparisonValues?: unknown[] | undefined;
}

export interface FieldDefinitionFieldType {
  name: FieldTypeName;
  constraints?: FieldValueConstraint[] | undefined;
}

export interface FieldDefinition {
  uuid: string;
  fieldKey: string;
  fieldType: FieldDefinitionFieldType;
  label: string;
  attributes: FieldAttribute[];
  relations: FieldRelation[];
  comment: string | null;
  defaultValue: unknown;
  possibleValues: unknown[];
}

export interface CreateFieldDefinition {
  fieldType: FieldDefinitionFieldType;
  label: string;
  attributes?: FieldAttribute[] | undefined;
  relations?: FieldRelation[] | undefined;
  comment?: string | null | undefined;
  defaultValue?: unknown | undefined;
  possibleValues?: unknown[] | undefined;
}

/** The PUT endpoint requires uuid and fieldKey in addition to the creation fields. */
export interface UpdateFieldDefinition extends CreateFieldDefinition {
  uuid: string;
  fieldKey: string;
}

/** Returns the value of the named attribute, or undefined if absent. */
export function fieldAttribute(def: FieldDefinition, type: string): unknown {
  return def.attributes.find((a) => a.type === type)?.value;
}

/**
 * Reports whether the field must be supplied when creating a resource of the
 * definition's template (unless it is in {@link SYSTEM_MANAGED_FIELD_KEYS}).
 */
export function isMandatory(def: FieldDefinition): boolean {
  return fieldAttribute(def, FIELD_ATTRIBUTE_MANDATORY) === 'yes';
}

/** The permitted values of a constrained field, or undefined if unconstrained. */
export function allowedValues(fieldType: FieldDefinitionFieldType): unknown[] | undefined {
  const c = fieldType.constraints?.find(
    (c) => c.type === CONSTRAINT_ALLOWED_VALUES && Array.isArray(c.value),
  );
  return c ? (c.value as unknown[]) : undefined;
}

const typeValue = (w: Wire) => ({ type: str(w.type), value: w.value ?? null });

/** @internal */
export function fieldDefinitionFromApi(w: Wire): FieldDefinition {
  const ft: Wire = w.field_type ?? {};
  return {
    uuid: str(w.uuid),
    fieldKey: str(w.field_key),
    fieldType: { name: ft.name, constraints: arr(ft.constraints, typeValue) },
    label: str(w.label),
    attributes: arr(w.attributes, typeValue),
    relations: arr(w.relations, (r) => {
      const rel: FieldRelation = { type: str(r.type), fieldUuid: str(r.field_uuid) };
      if (Array.isArray(r.comparison_values)) rel.comparisonValues = r.comparison_values;
      return rel;
    }),
    comment: strOrNull(w.comment),
    defaultValue: w.default_value ?? null,
    possibleValues: Array.isArray(w.possible_values) ? w.possible_values : [],
  };
}

/** @internal */
export function fieldDefinitionToApi(d: CreateFieldDefinition | UpdateFieldDefinition): Wire {
  const body: Wire = {};
  if ('uuid' in d) {
    body.uuid = d.uuid;
    body.field_key = d.fieldKey;
  }
  Object.assign(body, {
    field_type: { name: d.fieldType.name, constraints: d.fieldType.constraints ?? [] },
    label: d.label,
    attributes: d.attributes ?? [],
    relations: (d.relations ?? []).map((r) => {
      const rel: Wire = { type: r.type, field_uuid: r.fieldUuid };
      if (r.comparisonValues) rel.comparison_values = r.comparisonValues;
      return rel;
    }),
    comment: d.comment ?? null,
    default_value: d.defaultValue ?? null,
    possible_values: d.possibleValues ?? [],
  });
  return body;
}
