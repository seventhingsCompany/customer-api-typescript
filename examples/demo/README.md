# Demo

An end-to-end tour of the SDK against a live seventhings instance: auth, objects
(CRUD, barcode lookup, archive, history), reports, sorting/filtering/iteration,
files, tasks, persons, history and token revocation.

The demo creates, updates and deletes its own records only.

```sh
cp .env.example .env   # fill in real values
set -a; source .env; set +a
npx tsx examples/demo/demo.ts
```

Required variables: `SEVENTHINGS_BASE_URL`, `SEVENTHINGS_USERNAME`,
`SEVENTHINGS_PASSWORD`, `SEVENTHINGS_CLIENT_ID`.
