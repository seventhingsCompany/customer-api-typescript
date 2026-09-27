/**
 * End-to-end tour of the SDK against a live instance. Creates, updates and
 * deletes its own records; leaves existing data untouched.
 *
 *   SEVENTHINGS_BASE_URL=... SEVENTHINGS_USERNAME=... \
 *   SEVENTHINGS_PASSWORD=... SEVENTHINGS_CLIENT_ID=... npx tsx examples/demo/demo.ts
 */
import {
  AssetTrackingTemplate,
  Fields,
  Filter,
  isFeatureInactive,
  isNotFound,
  SeventhingsClient,
  SortDirection,
  SortOrder,
  TaskStatus,
  type HistoryResponse,
  type ResourceRecord,
} from '../../src/index.js';

const log = (section: string, msg: string) => console.log(`[${section}] ${msg}`);
const section = (name: string, msg: string) => console.log(`\n=== ${name} ===\n[${name}] ${msg}`);

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`missing environment variable ${key}`);
    process.exit(1);
  }
  return v;
}

function printHistory<T>(resource: string, page: HistoryResponse<T>) {
  log(
    'History',
    `${resource} — ${page.items.length} entries, page=${page.page} per_page=${page.perPage} total=${page.total}`,
  );
}

function resourceUuid(r: ResourceRecord, key: string): string {
  const f = new Fields(r);
  return f.string(key) || f.uuid;
}

async function expectGone(section: string, fetch: () => Promise<unknown>) {
  try {
    await fetch();
  } catch (err) {
    if (isNotFound(err)) return log(section, 'Confirmed deletion (404)');
    throw err;
  }
  throw new Error(`[${section}] expected 404 after deletion`);
}

async function main() {
  const baseUrl = requireEnv('SEVENTHINGS_BASE_URL');
  const username = requireEnv('SEVENTHINGS_USERNAME');
  const password = requireEnv('SEVENTHINGS_PASSWORD');
  const clientId = requireEnv('SEVENTHINGS_CLIENT_ID');
  const ts = Date.now();
  const historyOpts = { page: 1, perPage: 5 };

  // --- Auth -----------------------------------------------------------------
  section('Auth', 'Logging in…');
  const c = new SeventhingsClient({ instanceUrl: baseUrl });
  const tok = await c.auth.login(username, password, clientId);
  log('Auth', `Logged in — user_id=${tok.userId}, token=${tok.accessToken.slice(0, 20)}…`);

  // --- Objects --------------------------------------------------------------
  section('Objects', 'Listing objects…');
  const objs = await c.objects.list({ page: 1, perPage: 5 });
  log('Objects', `Listed ${objs.length} object(s) (first page, max 5)`);

  const newObj = { inventory_name: 'SDK Demo Object', barcode: `SDK-DEMO-${ts}` };
  const missing = await c.fieldDefinitions.missingMandatoryFields(
    AssetTrackingTemplate.Asset,
    newObj,
  );
  log(
    'Objects',
    missing.length
      ? `Heads up — instance requires unset mandatory field(s): ${missing.join(', ')}`
      : 'Payload satisfies all mandatory asset fields',
  );

  const objUuid = await c.objects.create(newObj);
  log('Objects', `Created object ${objUuid}`);

  const byBarcode = await c.objects.getByBarcode(newObj.barcode);
  log(
    'Objects',
    `Found by barcode ${newObj.barcode} — inventory_name=${String(byBarcode.inventory_name)}`,
  );

  await c.objects.patch(objUuid, { inventory_name: 'SDK Demo Object (updated)' });
  const updated = await c.objects.get(objUuid);
  log('Objects', `Patched object — inventory_name=${String(updated.inventory_name)}`);

  await c.objects.archive(objUuid);
  log('Objects', `Archived object ${objUuid}`);
  await c.objects.unarchive(objUuid);
  log('Objects', `Unarchived object ${objUuid}`);

  const objectHistory = await c.objects.history(objUuid, historyOpts);
  printHistory('Objects', objectHistory);
  for (const entry of objectHistory.items) {
    log('History', `Object event: type=${String(entry.type)} date=${String(entry.date)}`);
  }

  // --- Reports --------------------------------------------------------------
  section('Reports', 'Listing PDF templates…');
  const templates = await c.reports.listTemplates();
  log('Reports', `Found ${templates.length} template(s)`);
  const [template] = templates;
  if (template) {
    const pdf = await c.reports.create({
      reportTemplateUuid: template.uuid,
      objectUuids: [objUuid],
    });
    log('Reports', `Rendered template "${template.name}" — ${pdf.byteLength} PDF bytes`);
  } else {
    log('Reports', 'Skipping generation: no PDF templates configured');
  }

  await c.objects.delete(objUuid);
  log('Objects', `Deleted object ${objUuid}`);
  await expectGone('Objects', () => c.objects.get(objUuid));

  // --- Sorting, filtering, iterating -----------------------------------------
  section('Objects', 'Fetching last 5 changed assets (sorted)…');
  const recent = await c.objects.list({
    page: 1,
    perPage: 5,
    sort: { updated_at: SortDirection.Desc },
  });
  recent.forEach((obj, i) => {
    const f = new Fields(obj);
    log(
      'Objects',
      `  ${i + 1}. ${f.string('inventory_name')} (updated_at=${f.string('updated_at')})`,
    );
  });

  section('Objects', 'Filtering assets by name containing "SDK"…');
  const filtered = await c.objects.list({
    perPage: 5,
    filters: [Filter.like('inventory_name', 'SDK')],
  });
  log('Objects', `Got ${filtered.length} asset(s) matching filter`);

  section('Objects', 'Iterating all assets with objects.all() (capped at 10)…');
  let seen = 0;
  for await (const obj of c.objects.all({ perPage: 50 })) {
    log('Objects', `  • ${obj.string('inventory_name')} (${obj.uuid})`);
    if (++seen >= 10) break;
  }
  log('Objects', `Iterated ${seen} asset(s) before stopping`);

  // --- Files ----------------------------------------------------------------
  section('Files', 'Uploading file…');
  const content = 'Hello from the seventhings TypeScript SDK demo!\n';
  const fileUuid = await c.files.upload('demo.txt', new Blob([content], { type: 'text/plain' }));
  const meta = await c.files.get(fileUuid);
  log('Files', `Uploaded ${fileUuid} — name=${meta.name}, type=${meta.type}, size=${meta.size}`);

  const hostUuid = await c.objects.create({
    inventory_name: 'SDK Demo File Host',
    barcode: `SDK-FILE-${ts}`,
  });
  const attachment = [{ fieldKey: 'documents', fileUuid }];
  const added = await c.objects.addFiles(hostUuid, attachment);
  log('Files', `Attached file to object ${hostUuid} (HTTP ${added.status})`);
  await c.objects.removeFiles(hostUuid, attachment);
  log('Files', `Removed file from object ${hostUuid}`);
  await c.objects.delete(hostUuid);
  log('Files', `Deleted temp object ${hostUuid}`);

  // --- Tasks ----------------------------------------------------------------
  section('Tasks', 'Creating task…');
  const me = await c.users.getById(tok.userId);
  const taskObjUuid = await c.objects.create({
    inventory_name: 'SDK Demo Task Target',
    barcode: `SDK-TASK-${ts}`,
  });
  const taskUuid = await c.tasks.create({
    title: 'SDK Demo Task',
    deadline: `${new Date().getUTCFullYear() + 1}-12-31`,
    assignees: [me.uuid],
    references: [{ type: 'asset', uuid: taskObjUuid }],
    reminders: [{ unit: 'days', value: 1 }],
  });
  log('Tasks', `Created task ${taskUuid} referencing object ${taskObjUuid}`);

  await c.tasks.updateStatus(taskUuid, TaskStatus.Closed);
  log('Tasks', 'Updated task status to closed');
  printHistory('Tasks', await c.tasks.history(taskUuid, historyOpts));

  await c.tasks.delete(taskUuid);
  await expectGone('Tasks', () => c.tasks.get(taskUuid));
  await c.objects.delete(taskObjUuid);

  // --- Persons --------------------------------------------------------------
  section('Persons', 'Counting and listing persons…');
  log('Persons', `persons.count() → ${await c.persons.count()} person(s)`);
  const persons = await c.persons.list({ page: 1, perPage: 5, sortBy: 'id', order: SortOrder.Asc });
  persons.items.forEach((p, i) => {
    log('Persons', `  ${i + 1}. id=${p.id} ${p.firstName ?? ''} ${p.lastName ?? ''} <${p.email}>`);
  });
  const [firstPerson] = persons.items;
  if (firstPerson) {
    const byId = await c.persons.getById(firstPerson.id);
    log('Persons', `persons.getById(${firstPerson.id}) → uuid=${byId.uuid}`);
  }

  const required = await c.fieldDefinitions.mandatory(AssetTrackingTemplate.Person);
  log(
    'Persons',
    required.length
      ? `Instance-required person field(s): ${required.map((d) => d.fieldKey).join(', ')}`
      : 'No custom mandatory person fields configured',
  );

  const email = `sdk.demo+${ts}@example.com`;
  const personUuid = await c.persons.create({ email, first_name: 'SDK', last_name: 'Demo' });
  log('Persons', `Created person ${personUuid} <${email}>`);
  await c.persons.patch(personUuid, { department: 'IT' });
  log('Persons', 'Patched person (department=IT)');
  const personHistory = await c.persons.history(personUuid, historyOpts);
  printHistory('Persons', personHistory);
  for (const entry of personHistory.items) {
    log('History', `Person event: ${entry.eventName} at ${entry.occurredAt}`);
  }
  await c.persons.delete(personUuid);
  await expectGone('Persons', () => c.persons.get(personUuid));

  // --- History of existing resources -------------------------------------------
  section('History', 'Reading history for existing resources…');
  const [room] = await c.rooms.list({ perPage: 1 });
  if (room)
    printHistory('Rooms', await c.rooms.history(resourceUuid(room, 'room_uuid'), historyOpts));
  const [location] = await c.locations.list({ perPage: 1 });
  if (location) {
    const uuid = resourceUuid(location, 'location_uuid');
    printHistory('Locations', await c.locations.history(uuid, historyOpts));
  }
  try {
    const [rental] = await c.rentals.list({ perPage: 1 });
    if (rental) printHistory('Rentals', await c.rentals.history(rental.uuid, historyOpts));
  } catch (err) {
    if (!isFeatureInactive(err)) throw err;
    log('History', 'Skipping rental history: rental module not active');
  }

  // --- Revoke -----------------------------------------------------------------
  section('Auth', 'Revoking tokens…');
  await c.auth.revokeTokens();
  log('Auth', 'Tokens revoked');
  console.log('\nDone — all steps completed successfully.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
