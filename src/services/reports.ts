import type { RequestOptions } from '../http.js';
import {
  reportTemplateFromApi,
  type CreateReport,
  type ReportTemplate,
} from '../models/reports.js';
import type { Wire } from '../models/wire.js';
import { Service } from './base.js';

/** PDF reports. */
export class ReportsService extends Service {
  async listTemplates(options?: RequestOptions): Promise<ReportTemplate[]> {
    const w = await this.http.json<Wire[]>({ method: 'GET', path: 'report-template' }, options);
    return (w ?? []).map(reportTemplateFromApi);
  }

  /** Renders the objects with the template and returns the PDF bytes. */
  async create(input: CreateReport, options?: RequestOptions): Promise<Uint8Array> {
    const res = await this.http.send(
      {
        method: 'POST',
        path: 'report',
        accept: 'application/pdf',
        body: { report_template_uuid: input.reportTemplateUuid, object_uuids: input.objectUuids },
      },
      options,
    );
    return res.body;
  }
}
