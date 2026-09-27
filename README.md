# seventhings TypeScript SDK

TypeScript client for the seventhings Customer API (`{instance}/customer-api/v1`).
It has no runtime dependencies and is built on the standard `fetch` API, so it runs
on Node.js 22+, Bun, Deno, browsers and edge runtimes. It ships ESM, CommonJS and
type declarations.

## Installation

```sh
npm install @seventhingscompany/customer-api
```

## Quick Start

### Password Authentication

```ts
import { SeventhingsClient } from '@seventhingscompany/customer-api';

const client = await SeventhingsClient.withCredentials({
  instanceUrl: 'https://example.seventhings.com',
  username: 'user@example.com',
  password: 'secret',
  clientId: 'your-client-id',
});
```

### Pre-existing Token

```ts
const client = new SeventhingsClient({
  instanceUrl: 'https://example.seventhings.com',
  token: 'eyJ...',
});
```

### Manual Login and Refresh

```ts
const client = new SeventhingsClient({ instanceUrl: 'https://example.seventhings.com' });
const tok = await client.auth.login('user@example.com', 'secret', 'your-client-id');
// tok.accessToken is stored on the client; refresh before tok.expiresIn elapses:
await client.auth.refresh(tok.refreshToken);
await client.auth.revokeTokens();
```

### SSO Authentication

```ts
import { SSOAppTarget, SSOProviderName } from '@seventhingscompany/customer-api';

await client.auth.loginSSO(SSOProviderName.Azure, authCode, 'your-client-id', SSOAppTarget.Web);
```

## Usage

The client groups endpoints by area: `auth`, `objects`, `rooms`, `locations`,
`persons`, `users`, `tasks`, `rentals`, `fieldDefinitions`, `files`, `reports`
and `circularityHub`. Every method takes an optional final
[`RequestOptions`](#cancellation--timeouts) argument.

### Ping

```ts
const { status, description } = await client.ping(); // no authentication needed
```

### Objects

Objects, rooms, locations and CircularityHub items have instance-defined
fields. The SDK returns them as plain records (`Record<string, unknown>`) keyed
by field key. To read values without casts, wrap a record in `Fields`:

```ts
import { Fields } from '@seventhingscompany/customer-api';

const uuid = await client.objects.create({ inventory_name: 'Laptop', barcode: 'LT-001' });
const obj = new Fields(await client.objects.get(uuid));
obj.string('inventory_name'); // 'Laptop'
obj.int('id'); // number | undefined
obj.time('purchase_date'); // Date | undefined

await client.objects.patch(uuid, { inventory_name: 'Laptop (IT)' });
await client.objects.getByBarcode('LT-001');
await client.objects.archive(uuid);
await client.objects.unarchive(uuid);
await client.objects.count();
await client.objects.delete(uuid);
```

Use `fieldDefinitions.missingMandatoryFields` to check a record before creating it:

```ts
const missing = await client.fieldDefinitions.missingMandatoryFields('asset', {
  inventory_name: 'Laptop',
});
```

### History

Objects, rooms, locations, persons, tasks and rental cases have a paged change
history, newest first. The API returns 50 entries per page by default and at
most 200.

```ts
const page = await client.objects.history(uuid, { page: 1, perPage: 20 });
page.items; // object entries are kept as returned by the API
const tasks = await client.tasks.history(taskUuid); // typed entries: eventName, occurredAt, ...
```

### PDF Reports

```ts
const [template] = await client.reports.listTemplates();
const pdf: Uint8Array = await client.reports.create({
  reportTemplateUuid: template.uuid,
  objectUuids: [uuid],
});
```

### Files

```ts
// Accepts Blob, Uint8Array, ArrayBuffer or ReadableStream.
const fileUuid = await client.files.upload('manual.pdf', blob, { contentType: 'application/pdf' });
await client.objects.addFiles(uuid, [{ fieldKey: 'documents', fileUuid }]); // { status: 200 | 207, body }
await client.objects.removeFiles(uuid, [{ fieldKey: 'documents', fileUuid }]);

const meta = await client.files.get(fileUuid);
const bytes = await client.files.getData(fileUuid);
const thumb = await client.files.getThumbnail(fileUuid);
```

### Tasks

```ts
import { TaskStatus } from '@seventhingscompany/customer-api';

const taskUuid = await client.tasks.create({
  title: 'Annual inspection',
  deadline: '2026-12-31',
  assignees: [userUuid],
  references: [{ type: 'asset', uuid }],
  reminders: [{ unit: 'days', value: 7 }],
});
await client.tasks.updateStatus(taskUuid, TaskStatus.Closed);
const open = await client.tasks.list({ status: TaskStatus.Open, assignee: userUuid });
```

`tasks.update` and `rentals.update` are PUTs: send the complete record, not
only the changed fields.

### Rental Cases

```ts
const rentalUuid = await client.rentals.create({
  title: 'Drill for site B',
  renter: { type: 'plain', value: 'Jane Doe' },
  references: [{ type: 'asset', uuid }],
  issueDate: '2026-01-10',
  dueDate: '2026-01-20',
  dueDateReminder: { unit: 'days', value: 1 },
  responsibleUserUuid: userUuid,
});
```

If the rental module is not enabled on the instance, calls throw an `ApiError`
whose `isFeatureInactive()` returns true.

### Locations and Rooms

```ts
const locationUuid = await client.locations.create({ name: 'HQ' });
const roomUuid = await client.rooms.create({ name: 'Server room', number: 'B-12', building_id: 1 });
const room = await client.rooms.patch(roomUuid, { name: 'Server room 2' }); // returns the updated room
```

### Persons and Users

Persons are records managed in asset tracking. Users are login accounts and are
read-only through this API.

```ts
const personUuid = await client.persons.create({
  email: 'a@b.c',
  first_name: 'Ada',
  last_name: 'Lovelace',
});
const person = await client.persons.get(personUuid);
person.firstName; // typed common fields
person.fields.string('badge_no'); // every field, including custom ones
await client.persons.patch(personUuid, { department: 'IT' });
await client.persons.createUser({ filter: { email: { like: ['@example.com'] } } });

const users = await client.users.list({ sortBy: 'email', order: 'asc' });
const me = await client.users.getById(tok.userId);
```

### Field Definitions

```ts
import { allowedValues, isMandatory } from '@seventhingscompany/customer-api';

const defs = await client.fieldDefinitions.list('asset'); // 'asset' | 'room' | 'person'
defs.filter(isMandatory);
allowedValues(defs[0].fieldType); // dropdown options, if constrained
```

### CircularityHub

CircularityHub items and orders use numeric IDs instead of UUIDs.

```ts
const categories = await client.circularityHub.suggestCategory({
  filter: { status: { eq: 'active' } },
}); // Record<objectUuid, category> | null
const prices = categories && (await client.circularityHub.suggestRestPrice(categories));
await client.circularityHub.addObjects({ [uuid]: { category: 'Chairs', price: '25.00' } });

const orderId = await client.circularityHub.createOrder([1, 2]);
const order = await client.circularityHub.getOrder(orderId);
```

### Raw Requests

For endpoints the SDK does not wrap yet:

```ts
const res = await client.request('GET', 'some/new-endpoint', { query: 'page=1' });
res.status;
res.json();
```

## Filtering & Sorting

`list`, `count` and `all` on objects, rooms, locations, rentals and CircularityHub
take `ListOptions`:

```ts
import { Filter, SortDirection } from '@seventhingscompany/customer-api';

const items = await client.objects.list({
  page: 1,
  perPage: 50,
  sort: { updated_at: SortDirection.Desc }, // or [['a', 'ASC'], ['b', 'DESC']] for several keys
  filters: [
    Filter.eq('status', 'active'),
    Filter.in('category', 'IT', 'Furniture'),
    Filter.gteOrNull('purchase_date', '2024-01-01'),
  ],
});
```

The options are encoded as deep-object query parameters with literal brackets,
for example `sort[updated_at]=DESC&filter[category][in][]=IT`.

### Available Filter Operators

| Helper                                                  | Operator            | Meaning                              |
| ------------------------------------------------------- | ------------------- | ------------------------------------ |
| `Filter.eq` / `Filter.neq`                              | `eq` / `neq`        | equal / not equal                    |
| `Filter.gt` / `Filter.gte`                              | `gt` / `gte`        | greater than (or equal)              |
| `Filter.lt` / `Filter.lte`                              | `lt` / `lte`        | less than (or equal)                 |
| `Filter.gtOrNull`, `gteOrNull`, `ltOrNull`, `lteOrNull` | `*_or_null`         | as above, or the value is null       |
| `Filter.like` / `Filter.notLike`                        | `like` / `not_like` | contains (not) any of the substrings |
| `Filter.in` / `Filter.nin`                              | `in` / `nin`        | (not) in the set                     |

Users and persons take `{ page, perPage, sortBy, order }` instead. Tasks take
filters (`status`, `deadlineFrom`, `deadlineTo`, `assignee`, `author`,
`referenceType`) and are not paginated.

## Pagination

`list()` returns a single page. `all()` iterates across every page:

```ts
for await (const obj of client.objects.all({
  perPage: 100,
  filters: [Filter.eq('status', 'active')],
})) {
  console.log(obj.uuid, obj.string('inventory_name')); // obj is a Fields
  if (done) break; // stops fetching further pages
}
```

`all()` is available on objects, rooms, locations, persons, users and rentals,
and as `allItems()` on CircularityHub. It ignores `page`, uses `perPage`
(default 100) as the page size, and stops at the first page with fewer than
`perPage` items. Files (at most 20) and tasks (up to 10,000) are not paginated.

## Error Handling

Responses with status 400 or higher throw an `ApiError`:

```ts
import { ApiError, isNotFound } from '@seventhingscompany/customer-api';

try {
  await client.objects.get(uuid);
} catch (err) {
  if (isNotFound(err)) {
    // ...
  } else if (err instanceof ApiError) {
    console.log(err.statusCode, err.status, err.body, err.json());
  }
  throw err;
}
```

Predicates are available as methods (`err.isNotFound()`) and as standalone
functions: `isNotFound`, `isUnauthorized`, `isForbidden`, `isConflict`,
`isRateLimited`, `isServerError` and `isFeatureInactive`. A denied login is a 403
whose `err.json()` is `{ detail: LoginDeniedReason }`.

Other errors:

- `NetworkError` is thrown when no response was received (DNS, connection or TLS failure). The original error is in `err.cause`.
- Aborts and timeouts reject with the runtime's native `AbortError` / `TimeoutError`.

All SDK errors extend `SeventhingsError`.

## Cancellation & Timeouts

```ts
const client = new SeventhingsClient({ instanceUrl, token, timeoutMs: 30_000 }); // default for every call

await client.objects.list(undefined, { signal: controller.signal });
await client.reports.create(input, { timeoutMs: 120_000 }); // per-call override
```

## Custom fetch and Headers

```ts
const client = new SeventhingsClient({
  instanceUrl,
  token,
  fetch: myInstrumentedFetch,
  headers: { 'User-Agent': 'my-app/1.0' },
});
```

## Scope & Limitations

- **No automatic token refresh.** Call `client.auth.refresh(refreshToken)` yourself before the access token expires.
- **No automatic retry.** Add your own retry logic for transient failures.
- **No rate limiting.** The client does not throttle requests.
- **CircularityHub uses integer IDs**; every other module uses UUID strings.
- **Dates are strings** as returned by the API (`YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss`, UTC). Use `Fields.time()` to parse one.

## Testing

### Unit Tests

```sh
npm test
```

Unit tests inject a recording `fetch` (see `tests/unit/mock.ts`). They do not
need network access.

### Integration Tests

Integration tests run against a live instance. They create, modify and delete
their own records.

```sh
cp .env.example .env   # fill in real values
scripts/run-integration.sh
scripts/run-integration.sh persons   # only files matching "persons"
```

Tests are skipped when `SEVENTHINGS_BASE_URL`, `SEVENTHINGS_USERNAME`,
`SEVENTHINGS_PASSWORD` or `SEVENTHINGS_CLIENT_ID` is unset. They also skip
modules that are not enabled on the instance (rentals, CircularityHub).

### Demo

See [`examples/demo`](examples/demo/README.md).

## Development

```sh
npm run typecheck
npm run lint
npm run build          # dist/ (ESM + CJS + .d.ts)
npm run check:package  # publint + are-the-types-wrong
```

## Releasing

Releases are published to npm by `.github/workflows/release.yml` using npm
trusted publishing, which attaches provenance automatically. To release:

```sh
npm version 1.4.0 -m "chore: release %s"   # bumps package.json and creates tag v1.4.0
git push --follow-tags
```

The workflow runs every check and then publishes. It fails if the tag does not
match the version in `package.json`.

## License

MIT
