# Release deployment guide

This is the MVP release path: build one Preview deployment, run the smoke suite against that exact URL, then promote that verified deployment to Production. It does not deploy, change Vercel settings, run migrations, or change credentials by itself.

## Current database state

Production uses `prisma/schema.postgres.prisma`, whose datasource is PostgreSQL and whose only connection variable is `DATABASE_URL`. The committed PostgreSQL migration history is authoritative:

1. `20260911000000_baseline` creates the initial application tables, enums, indexes, and foreign keys.
2. `20260911000001_add_resume_parse` adds the `ResumeParse` table, `ResumeParseStatus` enum, indexes, and foreign keys.

`prisma/schema.prisma` and the checked-in SQLite database are development-only. Do not run `prisma db push` as a release step; it bypasses migration history. The Vercel build intentionally generates the PostgreSQL client only and does not run a schema mutation.

## Database connections and migrations

Set Vercel Preview and Production `DATABASE_URL` to Neon’s **pooled runtime** connection string (normally the hostname containing `-pooler`). This is the only database URL the deployed application uses.

Run migrations explicitly from a controlled operator or CI job, never from the Vercel build. Prisma’s current schema has no `directUrl` field, so use the following short-lived shell pattern for that one command: set `DATABASE_URL` to Neon’s **direct/non-pooled** connection string, run the command, then discard that shell environment. Do not put the direct URL into Vercel runtime variables.

```bash
# Operator/CI only. DATABASE_URL is the direct Neon URL in this shell.
npm run prisma:generate:postgres
npm run prisma:migrate:status:postgres
npm run prisma:migrate:deploy:postgres
npm run prisma:migrate:status:postgres
```

The last status must show no pending migrations. Do this once per target database before the associated Preview or Production application deployment. Seed data is optional and is not a production-release default.

## Required environment shape

Set these in the matching Vercel environment; use values from the secret manager/dashboard, never commit them.

```text
DATABASE_URL                  # Neon pooled runtime URL
APP_URL                       # exact HTTPS URL for this environment
STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN         # general Blob store token
RESUME_BLOB_READ_WRITE_TOKEN  # private resume Blob store token
RESUME_BLOB_STORE_ID          # private resume Blob store id
OPENAI_API_KEY                # only if the deployed workflow requires AI
OPENAI_MODEL                  # optional override
OPENAI_VISION_MODEL           # optional override
```

Private resumes and variants are written with private Blob access. Their stored URLs are read server-side and exposed only by authenticated download routes; do not add a public Blob URL or Blob listing endpoint to release checks.

## Credential-free static gate

These checks read local source and configuration only. They do not contact Vercel, Neon, Blob, or print variable values.

```bash
npm run release:static-check
```

`predeploy:check` is a separate environment-presence check. It reports only presence and safe posture, never an environment value; run it with the target environment loaded only on an approved operator machine or CI runner.

## Preview → Production runbook

1. Freeze schema changes for the release and inspect `git diff`.
2. Run the credential-free static gate above, `npm run predeploy:check` with the approved target environment, and the normal build/test gate required by the repository.
3. In the target database, run the explicit direct-URL migration sequence above and record the migration status output without connection strings.
4. Create a Preview deployment using the Vercel Git integration or `vercel deploy`; capture its immutable deployment URL. Do not use a production alias as the smoke target.
5. Confirm the Preview deployment has the Preview-scoped pooled `DATABASE_URL`, matching `APP_URL`, and the three Blob variables.
6. Provision or select two dedicated smoke users and three disposable records owned by the first user: one legacy `Resume` with a file, one `ResumeAsset`, and one `ResumeVariant`. Keep their raw private Blob URL only in the CI secret input.
7. Run the credentialed smoke template below against the Preview URL. Resolve every failure before promotion.
8. Promote the exact verified Preview deployment with `vercel promote <preview-url-or-id>`. This aliases the tested build; it does not rebuild it. Make sure Production migrations have already been applied to the Production database.
9. Run the same credentialed smoke against the canonical Production URL with Production-only smoke users, IDs, cookies, and Blob URL.
10. Watch health and runtime logs for 10 minutes. Roll back the alias if health, auth, or private-download checks fail.

## Credentialed smoke template

The smoke runner makes only GET requests. It never uploads, deletes, creates data, or displays cookies, IDs, Blob URLs, or secrets. `SMOKE_OWNER_COOKIE` and `SMOKE_OTHER_COOKIE` must be complete `Cookie` header values for different users. All three IDs must name records owned by the owner cookie, and the raw Blob URL must be the private URL for one of them.

```bash
SMOKE_BASE_URL="https://preview.example.com" \
SMOKE_OWNER_COOKIE="session=..." \
SMOKE_OTHER_COOKIE="session=..." \
SMOKE_RESUME_ID="..." \
SMOKE_ASSET_ID="..." \
SMOKE_VARIANT_ID="..." \
SMOKE_PRIVATE_BLOB_URL="https://...private.blob.vercel-storage.com/..." \
npm run release:smoke
```

It verifies:

- `/api/health` returns HTTP 200 and `ok: true` (database is queried by the endpoint).
- an anonymous protected page redirects to `/login`.
- anonymous requests to resume, asset, and legacy variant downloads return 401.
- a different authenticated user receives 404 for those same IDs.
- the owner receives each download with a disposition and `Cache-Control: private, no-store`.
- an anonymous direct request to the private Blob URL returns 401, proving there is no public Blob download entrance.

## Vercel configuration

The committed `vercel.json` pins Next.js, `npm install`, and `npm run prisma:generate:postgres && next build`. Leave migrations out of the build command. In Vercel, configure the production branch and Preview branch policy, scope environment variables by environment, and require the Preview smoke job to pass before an operator promotes a deployment.

For a CLI-based pipeline, `vercel deploy` creates the Preview URL and `vercel promote <verified-preview-url>` promotes that same artifact. Keep `VERCEL_TOKEN`, org ID, project ID, database URLs, Blob tokens, and smoke inputs in the CI secret store; none belong in this repository.
