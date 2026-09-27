# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript SDK for the seventhings Customer API (`@seventhings/customer-api`). It is a port of the Go SDK (`../customer-api-go`, the reference implementation) and the PHP SDK (`../customer-api-php`). It has zero runtime dependencies and uses only `fetch`, `FormData`, `Blob` and `AbortSignal`, so it must keep running on Node 22+, Bun, Deno, browsers and edge runtimes. Don't use Node-only APIs in `src/`; ESLint forbids `Buffer`, `process` and `require` there.

## Commands

```sh
npm test                              # unit tests (vitest)
npx vitest run tests/unit/auth.test.ts -t "refresh"   # single test
npm run typecheck && npm run lint     # tsc + eslint + prettier --check
npm run format                        # prettier --write
npm run build                         # tsup → dist/ (ESM + CJS + d.ts)
npm run check:package                 # build + publint + attw
scripts/run-integration.sh            # integration tests; needs .env (see .env.example)
npx tsx examples/demo/demo.ts         # live demo; needs SEVENTHINGS_* env vars
```

## Architecture

- `src/client.ts`: `SeventhingsClient` exposes one service per area (`client.objects`, `client.tasks`, ...), plus `ping()` and the raw `request()` escape hatch.
- `src/http.ts`: `HttpClient` (internal) builds URLs, sets headers (`Accept`, and `Content-Type` only when there is a JSON body), handles bearer auth, merges signal and timeout, and maps errors. It reads bodies fully into memory. Auth state lives in the shared `Session` object.
- `src/services/*.ts`: one class per area, all extending `Service`. `ResourceService` provides list, all, count, create, get and delete for the schema-free objects, rooms and locations.
- `src/models/*.ts`: public camelCase types, `as const` enums, and internal `*FromApi` / `*ToApi` mappers that convert to and from the API's snake_case. The mappers use the zero-value helpers in `models/wire.ts`. `src/index.ts` exports types and enums explicitly and never exports the mappers.
- `src/query.ts`: deep-object query encoding (`filter[f][op]=v`; `[]` suffix for like, not_like, in and nin).
- `src/helpers.ts`: Location, Location-UUID and Location-Id parsing, room/location `{uuid, fields}` envelope unwrapping, and the `paginate` async generator.

### Key Patterns

- Create endpoints return the new UUID from the `Location` header. File upload prefers `Location-UUID`. CircularityHub returns an int from `Location-Id`.
- Schema-free resources are returned as `ResourceRecord` (`Record<string, unknown>`). `all()` yields `Fields` wrappers.
- Persons accept both the flat shape and the `{uuid, fields}` envelope, and both `person_uuid` and `uuid`. The full field map is kept in `person.fields`.
- Status ≥ 400 throws `ApiError`. Transport failures throw `NetworkError`. Aborts and timeouts propagate unwrapped.
- The unit-test helper `tests/unit/mock.ts` (`setup(handler)`) returns `{ client, calls, last }` with the recorded requests.
- When adding an endpoint, check the Go SDK first and keep behaviour in parity.
