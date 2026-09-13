import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const ENDPOINT = "https://api.textin.com/ai/service/v3/entity_extraction";
const REQUEST_TIMEOUT_MS = 120_000;
const fixtureDirectory = new URL("../test-fixtures/resume-smoke/", import.meta.url);

const resumeSchema = {
  type: "object",
  properties: {
    "姓名": { type: "string", description: "候选人的姓名" },
    "联系方式": {
      type: "object",
      description: "候选人的联系方式",
      properties: {
        "电话": { type: "string" },
        "邮箱": { type: "string" },
      },
    },
    "教育经历": {
      type: "array",
      description: "按原简历阅读顺序拆分的教育经历；不要合并不同学校或学位。",
      items: {
        type: "object",
        properties: {
          "学校": { type: "string" },
          "专业或学位": { type: "string" },
          "日期": { type: "string" },
        },
      },
    },
    "实习工作经历": {
      type: "array",
      description: "只包含实习或工作，不包含项目；每段经历单独一项并保留日期。",
      items: {
        type: "object",
        properties: {
          "公司": { type: "string" },
          "职位": { type: "string" },
          "日期": { type: "string" },
          "内容": { type: "string" },
        },
      },
    },
    "项目经历": {
      type: "array",
      description: "只包含项目，不包含实习或工作；每个项目单独一项并保留日期。",
      items: {
        type: "object",
        properties: {
          "项目": { type: "string" },
          "角色": { type: "string" },
          "日期": { type: "string" },
          "内容": { type: "string" },
        },
      },
    },
    "技能": {
      type: "array",
      description: "简历中明确列出的技能，逐项输出。",
      items: { type: "string" },
    },
  },
  required: ["姓名", "联系方式", "教育经历", "实习工作经历", "项目经历", "技能"],
};

const requiredFields = Object.keys(resumeSchema.properties);

function valueIsPresent(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && typeof value === "object" && Object.keys(value).length > 0;
}

function stringsWithin(value, result = []) {
  if (typeof value === "string") result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsWithin(item, result));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => stringsWithin(item, result));
  return result;
}

function objectEntriesComplete(entries, expectedKeys) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  return entries.every((entry) => entry && typeof entry === "object" && expectedKeys.every((key) => valueIsPresent(entry[key])));
}

function extractedSummary(extracted) {
  const values = stringsWithin(extracted);
  const combined = values.join("\n");
  const garbledCharacterCount = (combined.match(/�/g) ?? []).length;
  const likelyMojibakeTokenCount = (combined.match(/[ÃÂÐÑ]{2,}/g) ?? []).length;
  const bulletMarkerCount = (combined.match(/[•●▪◦·]/g) ?? []).length;
  const dateTokenCount = (combined.match(/(?:19|20)\d{2}\s*[./年-]\s*\d{1,2}/g) ?? []).length;

  return {
    fieldsPresent: Object.fromEntries(requiredFields.map((field) => [field, valueIsPresent(extracted?.[field])])),
    itemCounts: {
      education: Array.isArray(extracted?.["教育经历"]) ? extracted["教育经历"].length : 0,
      employment: Array.isArray(extracted?.["实习工作经历"]) ? extracted["实习工作经历"].length : 0,
      projects: Array.isArray(extracted?.["项目经历"]) ? extracted["项目经历"].length : 0,
      skills: Array.isArray(extracted?.["技能"]) ? extracted["技能"].length : 0,
    },
    entryCompleteness: {
      education: objectEntriesComplete(extracted?.["教育经历"], ["学校", "专业或学位", "日期"]),
      employment: objectEntriesComplete(extracted?.["实习工作经历"], ["公司", "职位", "日期", "内容"]),
      projects: objectEntriesComplete(extracted?.["项目经历"], ["项目", "日期", "内容"]),
    },
    textIntegrity: {
      stringValueCount: values.length,
      garbledCharacterCount,
      likelyMojibakeTokenCount,
      bulletMarkerCount,
      dateTokenCount,
      noObviousEncodingCorruption: garbledCharacterCount === 0 && likelyMojibakeTokenCount === 0,
    },
    separationSignals: {
      employmentAndProjectsAreSeparateNonemptyArrays:
        Array.isArray(extracted?.["实习工作经历"]) && extracted["实习工作经历"].length > 0 &&
        Array.isArray(extracted?.["项目经历"]) && extracted["项目经历"].length > 0,
      sourceOrderRequestedInSchema: true,
      note: "脱敏自动检查只能验证数组拆分、日期和字段完整性；不能单独证明视觉多栏阅读顺序。",
    },
  };
}

function responseShape(body) {
  return {
    rootFieldsPresent: Object.fromEntries(
      ["code", "message", "version", "duration", "x_request_id", "status", "result"].map((field) => [field, Object.hasOwn(body, field)]),
    ),
    resultFieldsPresent: body?.result && typeof body.result === "object"
      ? Object.fromEntries(["success_count", "extracted_schema"].map((field) => [field, Object.hasOwn(body.result, field)]))
      : {},
    requestIdLocation: Object.hasOwn(body, "x_request_id") ? "response.x_request_id" : "not present",
  };
}

async function postJson(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ti-app-id": process.env.TEXTIN_APP_ID,
        "x-ti-secret-code": process.env.TEXTIN_SECRET_CODE,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return { httpStatus: response.status, elapsedMs: Math.round(performance.now() - started), json: false, body: null };
    }
    return { httpStatus: response.status, elapsedMs: Math.round(performance.now() - started), json: true, body };
  } catch (error) {
    return {
      httpStatus: null,
      elapsedMs: Math.round(performance.now() - started),
      json: false,
      body: null,
      transportError: error?.name === "AbortError" ? "request timed out" : "network request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runDocument(fileName) {
  const bytes = await readFile(new URL(fileName, fixtureDirectory));
  const response = await postJson({
    file: { file_base64: bytes.toString("base64"), file_name: fileName },
    schema: resumeSchema,
  });
  const shape = response.body ? responseShape(response.body) : null;
  const extracted = response.body?.result?.extracted_schema;
  const quality = extracted && typeof extracted === "object" ? extractedSummary(extracted) : null;
  const successful = response.httpStatus >= 200 && response.httpStatus < 300 && response.body?.code === 200 && response.body?.status === "finished";
  return {
    file: fileName,
    httpStatus: response.httpStatus,
    apiCode: typeof response.body?.code === "number" ? response.body.code : null,
    apiStatus: typeof response.body?.status === "string" ? response.body.status : null,
    elapsedMs: response.elapsedMs,
    serviceDurationMs: typeof response.body?.duration === "number" ? response.body.duration : null,
    responseIsJson: response.json,
    transportError: response.transportError ?? null,
    successful,
    shape,
    quality,
  };
}

async function runErrorProbe() {
  const response = await postJson({ schema: { type: "object" } });
  return {
    httpStatus: response.httpStatus,
    apiCode: typeof response.body?.code === "number" ? response.body.code : null,
    responseIsJson: response.json,
    capturedWithoutThrowing: Boolean(response.json || response.transportError),
    containsStructuredErrorFields: Boolean(response.body && Object.hasOwn(response.body, "code") && Object.hasOwn(response.body, "message")),
    requestIdLocation: response.body && Object.hasOwn(response.body, "x_request_id") ? "response.x_request_id" : "not present",
    transportError: response.transportError ?? null,
  };
}

if (!process.env.TEXTIN_APP_ID || !process.env.TEXTIN_SECRET_CODE) {
  console.error(JSON.stringify({ error: "Required TextIn environment variables are not available." }));
  process.exitCode = 1;
} else {
  const [pdf, docx, errorProbe] = await Promise.all([
    runDocument("resume_test.pdf"),
    runDocument("resume_test.docx"),
    runErrorProbe(),
  ]);
  console.log(JSON.stringify({
    phase: "TextIn v3 Phase 0 smoke test",
    clientTimeoutMs: REQUEST_TIMEOUT_MS,
    documents: [pdf, docx],
    errorProbe,
    rawResponsesPersisted: false,
    credentialsLogged: false,
    personalDataLogged: false,
  }, null, 2));
}
