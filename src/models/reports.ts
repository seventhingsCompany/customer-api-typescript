import { str, type Wire } from './wire.js';

/** A PDF report template available on the instance. */
export interface ReportTemplate {
  uuid: string;
  name: string;
}

/** Selects a template and at least one object to render, in order. */
export interface CreateReport {
  reportTemplateUuid: string;
  objectUuids: string[];
}

/** @internal */
export function reportTemplateFromApi(w: Wire): ReportTemplate {
  return { uuid: str(w.uuid), name: str(w.name) };
}
