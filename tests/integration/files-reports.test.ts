import { describe, expect, it } from 'vitest';
import { client, missingEnv, tempObject } from './env.js';

describe.skipIf(missingEnv)('files', () => {
  it('upload, get and download', async () => {
    const c = await client();
    const content = `ts integration ${Date.now()}`;
    const uuid = await c.files.upload('ts-int.txt', new Blob([content], { type: 'text/plain' }));
    const info = await c.files.get(uuid);
    expect(info.name).toBe('ts-int.txt');
    expect(new TextDecoder().decode(await c.files.getData(uuid))).toBe(content);
    expect(Array.isArray(await c.files.list())).toBe(true);
  });
});

describe.skipIf(missingEnv)('reports', () => {
  it('renders a PDF', async (ctx) => {
    const c = await client();
    const [template] = await c.reports.listTemplates();
    if (!template) return ctx.skip('instance has no report templates');
    const objectUuid = await tempObject(c, 'report');
    const pdf = await c.reports.create({
      reportTemplateUuid: template.uuid,
      objectUuids: [objectUuid],
    });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });
});

describe.skipIf(missingEnv)('field definitions', () => {
  it.each(['asset', 'room', 'person'] as const)('lists %s definitions', async (template) => {
    const c = await client();
    const defs = await c.fieldDefinitions.list(template);
    expect(defs.length).toBeGreaterThan(0);
    const first = defs[0]!;
    expect((await c.fieldDefinitions.get(template, first.uuid)).fieldKey).toBe(first.fieldKey);
  });

  it('reports missing mandatory fields', async () => {
    const c = await client();
    const mandatory = await c.fieldDefinitions.mandatory('asset');
    const missing = await c.fieldDefinitions.missingMandatoryFields('asset', {});
    expect(missing).toEqual(mandatory.map((d) => d.fieldKey));
  });
});
