# Demo

An end-to-end tour of the SDK against a live seventhings instance: auth, objects
(CRUD, barcode lookup, archive, history), reports, sorting/filtering/iteration,
files and custom thumbnail sizes, the product catalog, tasks with optional
reminders, timed and full-day rentals, persons, history and token revocation.

The demo creates, updates and deletes its own records only. Uploaded files
remain, because the API has no file-delete endpoint. Catalog and rental steps
are skipped when the instance lacks the feature.

```sh
cp .env.example .env   # fill in real values
set -a; source .env; set +a
npx tsx examples/demo/demo.ts
```

Required variables: `SEVENTHINGS_BASE_URL`, `SEVENTHINGS_USERNAME`,
`SEVENTHINGS_PASSWORD`, `SEVENTHINGS_CLIENT_ID`.

Optional:

- `SEVENTHINGS_RATE_LIMIT`: requests per minute (default 200, `0` disables).
- `SEVENTHINGS_AUTH_CODE`, `SEVENTHINGS_CODE_VERIFIER`, `SEVENTHINGS_REDIRECT_URI`:
  log in with a fresh, single-use authorization code + PKCE instead of the password.
