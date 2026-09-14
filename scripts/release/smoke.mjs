const baseUrl = required("SMOKE_BASE_URL").replace(/\/$/, "");
const ownerCookie = required("SMOKE_OWNER_COOKIE");
const otherCookie = required("SMOKE_OTHER_COOKIE");
const resumeId = required("SMOKE_RESUME_ID");
const assetId = required("SMOKE_ASSET_ID");
const variantId = required("SMOKE_VARIANT_ID");
const privateBlobUrl = required("SMOKE_PRIVATE_BLOB_URL");

const targets = [
  ["resume download", `/api/resumes/${encodeURIComponent(resumeId)}/download`],
  ["asset download", `/api/resume-assets/${encodeURIComponent(assetId)}/download`],
  ["legacy variant download", `/api/resume-variants/${encodeURIComponent(variantId)}/download`]
];

let failed = false;

function required(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`[FAIL] ${key} is required (value intentionally not displayed)`);
    process.exit(2);
  }
  return value;
}

function pass(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`[FAIL] ${message}`);
}

async function request(pathname, cookie) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual"
  });
}

async function expectStatus(label, response, expected) {
  if (response.status === expected) pass(`${label}: HTTP ${expected}`);
  else fail(`${label}: expected HTTP ${expected}, got HTTP ${response.status}`);
}

const health = await request("/api/health");
await expectStatus("health", health, 200);
try {
  const body = await health.json();
  if (body.ok === true) pass("health reports ok=true");
  else fail("health response does not report ok=true");
} catch {
  fail("health response is not JSON");
}

const protectedPage = await request("/jobs");
if (protectedPage.status >= 300 && protectedPage.status < 400 && /\/login(?:\?|$)/.test(protectedPage.headers.get("location") || "")) {
  pass("protected page redirects anonymous visitor to login");
} else {
  fail(`protected page should redirect to login, got HTTP ${protectedPage.status}`);
}

for (const [name, pathname] of targets) {
  await expectStatus(`${name} anonymous`, await request(pathname), 401);
  await expectStatus(`${name} cross-user`, await request(pathname, otherCookie), 404);

  const owner = await request(pathname, ownerCookie);
  await expectStatus(`${name} owner`, owner, 200);
  const disposition = owner.headers.get("content-disposition") || "";
  const cacheControl = owner.headers.get("cache-control") || "";
  if (/^(attachment|inline);/i.test(disposition)) pass(`${name} has download disposition`);
  else fail(`${name} is missing a download disposition`);
  if (/private/i.test(cacheControl) && /no-store/i.test(cacheControl)) pass(`${name} is not publicly cacheable`);
  else fail(`${name} lacks private, no-store cache control`);
}

const rawBlob = await fetch(privateBlobUrl, { redirect: "manual" });
await expectStatus("direct private Blob request", rawBlob, 401);

process.exitCode = failed ? 1 : 0;
