import { uuidFromLocation } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import {
  fieldDefinitionFromApi,
  fieldDefinitionToApi,
  isMandatory,
  SYSTEM_MANAGED_FIELD_KEYS,
  type AssetTrackingTemplate,
  type CreateFieldDefinition,
  type FieldDefinition,
  type UpdateFieldDefinition,
} from '../models/field-definitions.js';
import type { Wire } from '../models/wire.js';
import { Service, seg } from './base.js';

const base = (template: AssetTrackingTemplate) => `asset-tracking/${seg(template)}`;

/** Field definitions (the instance-specific schema) of the asset, room and person templates. */
export class FieldDefinitionsService extends Service {
  async list(
    template: AssetTrackingTemplate,
    options?: RequestOptions,
  ): Promise<FieldDefinition[]> {
    const w = await this.http.json<Wire[]>(
      { method: 'GET', path: `${base(template)}/field-definitions` },
      options,
    );
    return (w ?? []).map(fieldDefinitionFromApi);
  }

  async get(
    template: AssetTrackingTemplate,
    uuid: string,
    options?: RequestOptions,
  ): Promise<FieldDefinition> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${base(template)}/field-definition/${seg(uuid)}` },
      options,
    );
    return fieldDefinitionFromApi(w ?? {});
  }

  /** Creates a field definition and returns its UUID. */
  async create(
    template: AssetTrackingTemplate,
    input: CreateFieldDefinition,
    options?: RequestOptions,
  ): Promise<string> {
    const res = await this.http.send(
      {
        method: 'POST',
        path: `${base(template)}/field-definition`,
        body: fieldDefinitionToApi(input),
      },
      options,
    );
    return uuidFromLocation(res.headers);
  }

  /** Replaces the field definition (PUT). */
  async update(
    template: AssetTrackingTemplate,
    uuid: string,
    input: UpdateFieldDefinition,
    options?: RequestOptions,
  ): Promise<void> {
    await this.http.send(
      {
        method: 'PUT',
        path: `${base(template)}/field-definition/${seg(uuid)}`,
        body: fieldDefinitionToApi(input),
      },
      options,
    );
  }

  /** The definitions a caller must supply on create (excluding system-managed keys). */
  async mandatory(
    template: AssetTrackingTemplate,
    options?: RequestOptions,
  ): Promise<FieldDefinition[]> {
    const defs = await this.list(template, options);
    return defs.filter((d) => isMandatory(d) && !SYSTEM_MANAGED_FIELD_KEYS.has(d.fieldKey));
  }

  /**
   * Returns the keys of mandatory fields that are absent or null in `fields`.
   * Use it to validate a record before calling `create`.
   */
  async missingMandatoryFields(
    template: AssetTrackingTemplate,
    fields: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<string[]> {
    const defs = await this.mandatory(template, options);
    return defs.filter((d) => fields[d.fieldKey] == null).map((d) => d.fieldKey);
  }
}
