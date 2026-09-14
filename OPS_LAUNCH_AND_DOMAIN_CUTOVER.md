# Operations launch and domain cutover

Use this checklist after the Preview smoke is green and before changing the Production alias or DNS. It is an operator runbook; no command in this document is run automatically by the repository.

## Pre-launch checklist

- [ ] `npm run release:static-check` passes with no credentials or external services.
- [ ] `npm run predeploy:check` passes in the approved target environment and output contains no values.
- [ ] Production `DATABASE_URL` is Neon pooled runtime URL; the direct Neon URL exists only in the migration operator/CI shell.
- [ ] `npm run prisma:migrate:status:postgres`, `npm run prisma:migrate:deploy:postgres`, then status again have been run against the direct Production database URL; no migrations are pending.
- [ ] Production Vercel build command remains `npm run prisma:generate:postgres && next build`; it does not run `db push`, `migrate dev`, or `migrate deploy`.
- [ ] `APP_URL` is the exact planned canonical HTTPS host.
- [ ] `STORAGE_PROVIDER=vercel-blob` plus general and private-resume Blob variables are set in the correct environment.
- [ ] Two smoke accounts and disposable owner-owned Resume, ResumeAsset, and ResumeVariant downloads are ready in both Preview and Production.
- [ ] The Preview deployment URL and its Preview-specific smoke inputs are available only to the release operator/CI secret store.

## Preview approval

- [ ] Create/identify the Preview deployment for this release commit.
- [ ] Verify `/api/health` returns 200 with `ok: true`.
- [ ] Run `npm run release:smoke` with the Preview URL and Preview secret inputs.
- [ ] Confirm anonymous download requests are 401, cross-user requests are 404, and owner requests succeed for Resume, ResumeAsset, and legacy ResumeVariant routes.
- [ ] Confirm direct anonymous access to the private Blob URL is 401; a private Blob URL must never be published as a user-facing download link.
- [ ] Confirm the unauthenticated `/jobs` request redirects to `/login`.
- [ ] Record the Preview deployment URL/ID and smoke result in the release record without recording secrets.

## Production promotion

- [ ] Verify Production database migrations first, using the explicit direct-URL process in `DEPLOYMENT.md`.
- [ ] Confirm the exact tested Preview artifact is selected.
- [ ] Promote it with `vercel promote <preview-url-or-id>`; do not substitute a new build.
- [ ] Run the Production smoke template using Production-only accounts, cookies, IDs, and private Blob URL.
- [ ] Check `/api/health`, Vercel runtime logs, and HTTP error rate for at least 10 minutes.

## Domain cutover

- [ ] Pick one canonical hostname and make `APP_URL` exactly match it.
- [ ] Attach apex and `www` to Vercel, set DNS records using the targets Vercel supplies, and use DNS-only mode for the initial Cloudflare setup.
- [ ] Wait for domain verification and certificate issuance.
- [ ] Confirm canonical host serves the promoted deployment and non-canonical host redirects to it.
- [ ] Run the Production smoke again using the canonical domain (not merely the `vercel.app` URL).
- [ ] Ensure the raw private Blob URL was not linked, redirected to, logged in a release artifact, or exposed by an application route.

## Rollback triggers and response

Rollback immediately for failed health, unexpected 5xxs, database connection failures, incorrect auth redirects, a public Blob response, or failed owner/private-download checks.

1. Re-point Production to the previously verified Vercel deployment/alias.
2. If domain changes caused the issue, restore the previous DNS target; retain DNS-only mode while investigating.
3. Preserve deployment and runtime logs, omitting credentials and private URLs.
4. Do not roll back database migrations automatically. Investigate compatibility and make a separately reviewed forward migration if needed.
