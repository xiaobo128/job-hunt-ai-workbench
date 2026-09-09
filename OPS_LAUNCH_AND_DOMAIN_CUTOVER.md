# Launch And Domain Cutover

## 1. Current Confirmed State

Confirmed from local repo and project linkage on 2026-05-16:

- Current public entry in handover: `https://project-iry1g.vercel.app`
- Linked Vercel project: `job-hunt-ai-workbench`
- Linked project id: `prj_pwjFFllQEAwLayKUcVDLsYKdo6YC`
- Linked team id: `team_MQ8CyyuvuWiKB8S6asHF1P7V`
- Framework: Next.js
- Vercel build command in repo: `npm run prisma:generate:postgres && next build`
- Vercel local project metadata still shows default cloud build command: `next build`
- Production env variable names exist locally for:
  - `DATABASE_URL`
  - `APP_URL`
  - `STORAGE_PROVIDER`
  - `BLOB_READ_WRITE_TOKEN`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_VISION_MODEL`
- Runtime health endpoint exists: `/api/health`
- Database helper already includes transient retry logic for Prisma connection failures
- Storage already supports `vercel-blob`

Current blind spot:

- Live Vercel project inspection through the connected Vercel app returned `403 Forbidden` under the current scope, so production dashboard state, active domains, deployment history, and dashboard-side env bindings still need one manual verification pass in Vercel.

## 2. Main Production Risks

### Risk A: `vercel.app` is still the main entry

Impact:

- Mainland China access may be unstable
- Brand trust is weaker than a first-party domain
- DNS and certificate cutover has not been rehearsed

Recommended minimum:

- Keep Vercel as origin platform
- Keep Cloudflare as DNS provider only for the first cutover
- Add apex domain to Vercel and point it with external DNS records
- Add `www` and redirect it to the apex or the other way around

Why this is the minimum:

- Vercel explicitly does not recommend putting Cloudflare reverse proxy in front of Vercel
- Cloudflare documentation also shows that third-party verification CNAMEs should stay DNS-only during verification

### Risk B: database connection still has burst failure risk

Confirmed in code:

- `lib/db.ts` retries transient Prisma failures up to 2 times
- The retry only covers a narrow set of connection errors

Remaining risk:

- No warmup or dedicated connection pooling signal is exposed in docs
- No explicit production checklist item verifies pooled connection string vs direct connection string
- Health endpoint only returns `ok` / `500`, without enough detail for first-response triage

Minimum mitigation:

- Use pooled Postgres connection string in Vercel production env when your DB vendor provides it
- Keep direct connection string only where Prisma schema push / migrations require it
- Verify `/api/health` after each production deploy
- Check Vercel runtime logs for `P1001` and connection reset errors in the first 10 minutes after release

### Risk C: no true server-side error collection loop

Confirmed in code before this patch:

- `app/error.tsx` only used `console.error` in the browser
- `app/global-error.tsx` showed fallback UI but did not report anything
- No `instrumentation.ts`
- No Sentry / Datadog / Vercel Analytics / Speed Insights dependency

Minimum mitigation added in this branch:

- `instrumentation.ts` registers process-level error hooks
- `lib/monitoring.ts` writes structured error logs to Vercel Runtime Logs
- Optional `MONITORING_WEBHOOK_URL` can fan out errors to Slack webhook, serverless collector, or other endpoint
- Client error boundaries now report to `/api/monitoring/client-error`

## 3. Cloudflare + Custom Domain Minimum Plan

Recommended topology:

- Vercel = application hosting and TLS termination
- Cloudflare = external DNS only for phase 1
- Do not enable orange-cloud proxy in the first switch

Recommended records:

1. Apex domain:
   - Type: `A`
   - Name: `@`
   - Value: Vercel-recommended apex IP from the domain setup flow
   - Safe default from Vercel docs: `76.76.21.21`
   - Proxy status in Cloudflare: `DNS only`
2. `www` subdomain:
   - Type: `CNAME`
   - Name: `www`
   - Value: Vercel-recommended CNAME from the domain setup flow
   - Safe default from Vercel docs: `cname.vercel-dns-0.com`
   - Proxy status in Cloudflare: `DNS only`

Recommended routing decision:

- Option A: `yourdomain.com` as canonical, `www` -> redirect to apex
- Option B: `www.yourdomain.com` as canonical, apex -> redirect to `www`

Choose one canonical host before cutover and make `APP_URL` match it exactly.

Why DNS-only first:

- Vercel guidance says Cloudflare reverse proxy in front of Vercel adds latency, cache complexity, and weaker platform visibility
- Cloudflare guidance says service verification CNAMEs should stay DNS-only during verification

Phase 2, only after stability:

- Re-evaluate whether Cloudflare proxy is needed at all
- If proxy must be enabled, do it as a separate controlled change after custom domain stability is proven on DNS-only

## 4. Manual Vercel Verification Checklist

Because project API access is currently blocked by `403`, verify these items in the Vercel dashboard before release:

1. Project Settings -> General
   - Confirm framework is Next.js
   - Confirm install command is `npm install`
   - Confirm build command is `npm run prisma:generate:postgres && next build`
   - Confirm Node.js version is pinned to the team-approved version
2. Project Settings -> Environment Variables
   - Confirm all production env vars exist
   - Confirm `APP_URL` is the final custom domain, not `vercel.app`
   - Confirm `STORAGE_PROVIDER=vercel-blob`
3. Project -> Domains
   - Confirm apex and `www` are both attached
   - Confirm one host is the production primary
   - Confirm SSL certificate is issued
4. Deployments
   - Confirm the latest production deployment is healthy
   - Check build logs for Prisma generate step
5. Runtime Logs
   - Search for `P1001`, `Can't reach database server`, `terminating connection due to administrator command`
6. Observability
   - If on Pro or above, confirm whether a Log Drain exists
   - If on Hobby, at minimum confirm dashboard log access and an owner rotation for checking logs after deploy

## 5. Launch Checklist

### A. Before domain cutover

1. Confirm Vercel production deploy is green
2. Confirm `/api/health` returns `ok: true`
3. Confirm `DATABASE_URL` is PostgreSQL, not SQLite
4. Confirm `APP_URL` is updated to the final canonical domain
5. Confirm `STORAGE_PROVIDER=vercel-blob`
6. Confirm `BLOB_READ_WRITE_TOKEN` is present
7. Confirm OpenAI variables are present for production behavior you expect
8. Run `npm run predeploy:check` locally against production env template
9. Confirm latest build uses `npm run prisma:generate:postgres && next build`
10. Confirm error logging path works:
   - Trigger a handled test error in preview or staging
   - Confirm Vercel Runtime Logs receive a structured error line
11. If using webhook fan-out:
   - Set `MONITORING_WEBHOOK_URL`
   - Send one test event and confirm delivery

### B. Release-day checks

1. Freeze schema-changing work
2. Merge only low-risk deployment/stability changes
3. Deploy production
4. Open:
   - `/`
   - `/jobs`
   - `/resumes`
   - `/tailor`
   - `/api/health`
5. Upload one resume asset
6. Verify one download path
7. Watch runtime logs for 10 minutes

### C. First-hour checks

1. Search runtime logs for database reconnect noise
2. Search runtime logs for `client.error_boundary`
3. Search runtime logs for `process.unhandledRejection`
4. Confirm no unexpected 500s on key pages
5. Confirm Blob uploads and reads still work

## 6. Domain Cutover Checklist

### Preparation

1. Pick canonical domain
2. Add both apex and `www` to the Vercel project
3. Copy Vercel-recommended DNS targets from the domain setup screen
4. In Cloudflare, lower TTL ahead of cutover if you want faster rollback

### DNS change

1. Add apex `A` record to Vercel target
2. Add `www` `CNAME` to Vercel target
3. Keep both records `DNS only`
4. Remove conflicting old records

### Verification

1. Wait for Vercel domain verification to pass
2. Confirm TLS certificate issuance
3. Confirm the canonical domain serves the app
4. Confirm the non-canonical host redirects correctly
5. Confirm `/api/health` under the custom domain is healthy
6. Confirm file uploads still resolve under the new domain

### Post-cutover

1. Update `APP_URL` if it still points at `vercel.app`
2. Redeploy if env change requires it
3. Test key login and upload flows again
4. Announce the new canonical URL internally

## 7. Rollback Checklist

Use rollback if any of these happen within the first hour:

- sustained 5xx errors
- repeated database connection failures
- domain verification stalls
- TLS issuance failure
- upload/download flow breaks under the new host

Rollback steps:

1. Point traffic back to the previous known-good hostname
2. Revert `APP_URL` if it was changed prematurely
3. Re-deploy only if env rollback requires it
4. Keep Cloudflare records in DNS-only while investigating
5. Export the relevant Vercel runtime logs before making more changes

## 8. Minimal Monitoring Runbook

Current minimum in repo after this patch:

- Server startup catches `unhandledRejection` and `uncaughtException`
- Client error boundaries report back to the server
- All monitoring events are structured JSON in Vercel logs
- Optional webhook fan-out exists via `MONITORING_WEBHOOK_URL`

Suggested next step after launch:

1. Short term:
   - Use Vercel Runtime Logs as the source of truth
   - Route `MONITORING_WEBHOOK_URL` to Slack or a small internal collector
2. Medium term:
   - Add Vercel Web Analytics and Speed Insights
   - Add Vercel Log Drain if the plan supports it
3. Later:
   - Add Sentry or Datadog only when the team is ready to own the extra operational surface

## 9. Source Notes

Operational recommendations in this file are based on:

- local repo inspection on 2026-05-16
- Vercel docs for custom domain setup and external DNS
- Vercel guidance against putting Cloudflare reverse proxy in front of Vercel
- Cloudflare docs recommending DNS-only for third-party verification CNAME flows
