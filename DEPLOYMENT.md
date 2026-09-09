# Deployment Guide

## Recommended production stack

- PostgreSQL: Neon
- Object storage: Vercel Blob
- App hosting: Vercel

This project keeps the business flow simple and uses thin infrastructure adapters, so we can prepare production deployment without rewriting the MVP.

## Vercel CLI note

This repository includes a committed `vercel.json`:

```json
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "next build"
}
```

This matters when deploying from the Vercel CLI instead of Git integration.
Without a committed `vercel.json`, the cloud-side `vercel build` step may not see your local `.vercel/project.json` and can fall back to an empty deployment that returns `404`.

## 1. Database switch

The project currently keeps two Prisma schemas:

- `prisma/schema.prisma`
  Used for local SQLite development.
- `prisma/schema.postgres.prisma`
  Used for PostgreSQL deployment.

### Local SQLite

```bash
npm run prisma:generate
npm run prisma:db:push
npm run prisma:seed
```

### PostgreSQL

After replacing `DATABASE_URL` with your Neon connection string:

```bash
npm run prisma:generate:postgres
npm run prisma:db:push:postgres
npm run prisma:seed
```

Recommended PostgreSQL platforms:

- Neon
- Vercel Postgres
- Supabase Postgres
- Railway Postgres

## 2. Storage switch

Uploads already go through `lib/storage.ts`.

Supported storage providers in the current code:

- `local`
- `vercel-blob`

Local development can keep:

```env
STORAGE_PROVIDER="local"
```

For production, switch to:

```env
STORAGE_PROVIDER="vercel-blob"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

The current implementation still writes a temporary local copy into `.tmp/uploads/...` so downstream parsing can continue using an absolute file path when needed.

## 3. Environment variables

Minimum recommended production variables:

```env
DATABASE_URL="postgresql://..."
APP_URL="https://your-domain.com"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"
OPENAI_VISION_MODEL="gpt-4.1-mini"
STORAGE_PROVIDER="vercel-blob"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

You can start from:

- `.env.example`
- `.env.neon.example`
- `.env.production.example`

To create a production-specific local template without touching your current `.env`:

```bash
npm run prepare:env:production
```

This creates:

```text
.env.production.local
```

Next.js will prioritize that file for production builds, so it is a safer place to keep Neon, Vercel Blob, and OpenAI credentials.

## 4. Predeploy validation

Run this before deployment:

```bash
npm run predeploy:check
```

The script checks:

- required app environment variables
- whether `DATABASE_URL` still points to SQLite
- whether `APP_URL` still points to localhost
- whether Vercel Blob credentials are present when enabled
- whether AI credentials are configured or will fall back locally

The runtime health endpoint also exposes the current deployment posture:

```text
/api/health
```

It now returns:

- database provider and whether it is production-ready
- storage provider and whether the current storage config is production-ready
- whether OpenAI is configured
- whether the app URL is localhost or HTTPS

## 5. Suggested deployment flow

1. Create a Neon project and copy the PostgreSQL connection string.
2. Create a Vercel Blob store and copy the read/write token.
3. Fill `.env` based on `.env.neon.example`.
   Recommended: create and edit `.env.production.local` instead of replacing your local dev `.env`.
4. Run `npm run prisma:generate:postgres`.
5. Run `npm run prisma:db:push:postgres`.
6. Optionally run `npm run prisma:seed`.
7. Run `npm run predeploy:check`.
8. Run `npm run build`.
9. Deploy the Next.js app.
10. Verify `/api/health` after release.

## 6. Current limits

- We have prepared the deployment path, but cannot apply a real Neon URL or Vercel Blob token without your cloud credentials.
- `vercel-blob` is the first production provider wired in; S3 and R2 can be added later through the same adapter.
- Local parsing still depends on temporary files for some flows, which is intentional for this MVP stage.
