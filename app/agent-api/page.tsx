import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { getRuntimeConfig } from "@/lib/env";
import { requireSessionUser } from "@/lib/session";

export default async function AgentApiPage() {
  await requireSessionUser();
  const runtime = getRuntimeConfig();
  const baseUrl = runtime.appUrl || "http://127.0.0.1:3000";

  return (
    <PageShell
      title="自动化接口文档"
      description="通过这些接口，你可以让自己的 Agent 或工作流把岗位、状态更新、简历版本、通知和微调结果写回工作台。"
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/api/agent/openapi" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
            打开 OpenAPI JSON
          </Link>
          <Link href="/account" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
            返回账户中心
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        <Panel title="认证方式" subtitle="每个账户使用独立的 API Token。">
          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <p>
              先在账户中心创建一个 Token，然后在每次请求里通过下面这个头部带上它：
              <span className="ml-2 rounded-lg bg-panel px-2 py-1 font-mono text-xs text-ink">
                Authorization: Bearer &lt;YOUR_API_TOKEN&gt;
              </span>
            </p>
            <p>
              每个 Token 都只属于它的创建者。外部工作流只能读写这个用户自己的数据。
            </p>
          </div>
        </Panel>

        <Panel title="返回格式" subtitle="所有入站 Agent 接口都遵循同一套顶层返回结构。">
          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <p>写入成功时会返回 `ok: true`，并附带本次接口创建或更新的核心对象。</p>
            <p>参数校验失败或服务端异常时会返回 `ok: false`，以及稳定的 `error` 代码；如果有可读提示，也会带上 `message`。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-ink">成功示例</div>
              <pre className="overflow-x-auto rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
{`{
  "ok": true,
  "jobLead": {
    "id": "clx...",
    "companyName": "ByteDance",
    "roleTitle": "AI Product Manager",
    "status": "READY_TO_APPLY"
  },
  "application": {
    "id": "clx...",
    "currentStage": "READY_TO_APPLY"
  }
}`}
              </pre>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-ink">错误示例</div>
              <pre className="overflow-x-auto rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
{`{
  "ok": false,
  "error": "bad_request",
  "message": "\`companyName\`, \`roleTitle\`, and \`rawContent\` are required."
}`}
              </pre>
            </div>
          </div>
        </Panel>

        <Panel title="机器可读文档" subtitle="提供 OpenAPI JSON 文档供自动化工具读取。">
          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <p>
              如果你的工作流工具支持读取 OpenAPI 风格的文档，建议直接使用下面这个 JSON 入口，而不是手工从本页复制字段。
            </p>
            <div className="rounded-2xl bg-panel px-4 py-3 font-mono text-xs text-ink">{`${baseUrl}/api/agent/openapi`}</div>
            <p>
              文档覆盖入站接口的认证方式、请求体结构、返回格式和常见错误 payload。
            </p>
          </div>
        </Panel>

        <Panel title="快速开始" subtitle="这是验证接入链路是否可用的最快方式。">
          <ol className="space-y-2 text-sm leading-6 text-slate-700">
            <li>1. 在账户中心创建一个 API Token。</li>
            <li>2. 先发一条 `POST /api/agent/jobs` 测试请求。</li>
            <li>3. 确认新岗位已经出现在岗位工作台里。</li>
            <li>4. 回到账户中心，用 webhook 测试按钮验证出站触发。</li>
            <li>5. 查看最近 Agent 运行记录，确认成功和失败状态都被记录下来。</li>
          </ol>
        </Panel>

        <Panel title="接口总览" subtitle="用于写入岗位、申请、事件和自动化结果。">
          <div className="grid gap-3">
            <EndpointCard
              method="POST"
              path="/api/agent/jobs"
              summary="创建一条岗位记录，并同时生成关联的申请记录。"
              fields="companyName, roleTitle, city, sourceName, sourceUrl, rawContent, skills, requirements, responsibilities, initialStage"
              statuses="200, 400, 401, 500"
            />
            <EndpointCard
              method="PATCH"
              path="/api/agent/applications/:id"
              summary="更新申请阶段和备注，并同步关联岗位状态。"
              fields="currentStage, note"
              statuses="200, 400, 401, 404, 500"
            />
            <EndpointCard
              method="POST"
              path="/api/agent/resume-variants"
              summary="登记一份导入或生成后的简历版本。"
              fields="resumeId, jobLeadId, sourceType, title, note, fileUrl, artifactName, artifactMimeType, draftText"
              statuses="200, 400, 401, 404, 500"
            />
            <EndpointCard
              method="POST"
              path="/api/agent/events"
              summary="写入一条事件或通知记录，并可选地推进申请阶段。"
              fields="applicationId, eventType, title, eventTime, content, requirements, artifactUrl"
              statuses="200, 400, 401, 404, 500"
            />
            <EndpointCard
              method="POST"
              path="/api/agent/tailor-runs"
              summary="写回外部简历 Agent 生成的建议结果或草稿结果。"
              fields="resumeId, jobLeadId, provider, summary, suggestionsJson, draftTitle, draftText"
              statuses="200, 400, 401, 404, 500"
            />
          </div>
        </Panel>

        <Panel title="字段说明" subtitle="接外部工作流时，有几条规则尤其重要。">
          <ul className="space-y-2 text-sm leading-6 text-slate-700">
            <li>- `rawContent` 应尽量包含原始 JD 正文，而不只是一个链接。</li>
            <li>- `initialStage` 和 `currentStage` 必须使用应用当前已经采用的枚举字符串。</li>
            <li>- `fileUrl` 需要是可访问的文件链接。</li>
            <li>- `suggestionsJson` 可以是任意结构化对象，但如果 key 稳定，UI 会更容易阅读。</li>
            <li>- `eventType` 会驱动面试、测评、录用和拒绝等事件的自动阶段同步。</li>
          </ul>
        </Panel>

        <Panel title="示例：创建岗位" subtitle="这是最适合先用 curl、Postman 或 n8n 验证的一个入口。">
          <pre className="overflow-x-auto rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
{`curl -X POST ${baseUrl}/api/agent/jobs \\
  -H "Authorization: Bearer <YOUR_API_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "companyName": "ByteDance",
    "roleTitle": "AI Product Manager",
    "city": "Beijing",
    "sourceName": "Boss Zhipin",
    "sourceUrl": "https://example.com/job/123",
    "rawContent": "Paste the original JD text here.",
    "skills": ["Prompt", "Analytics"],
    "requirements": ["Drive product planning", "Understand AI applications"],
    "responsibilities": ["Turn requirements into shipped features"],
    "initialStage": "READY_TO_APPLY"
  }'`}
          </pre>
        </Panel>

        <Panel
          title="示例：写回外部微调结果"
          subtitle="当外部简历技能或 Agent 生成完建议或草稿后，可以用这个接口写回。"
        >
          <pre className="overflow-x-auto rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
{`curl -X POST ${baseUrl}/api/agent/tailor-runs \\
  -H "Authorization: Bearer <YOUR_API_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "resumeId": "<RESUME_ID>",
    "jobLeadId": "<JOB_ID>",
    "provider": "external-agent",
    "summary": "External agent finished tailoring the resume for this job.",
    "draftTitle": "AI Product Manager Tailored Draft",
    "draftText": "Paste the generated draft text here.",
    "suggestionsJson": {
      "highlights": ["Strengthen AI product ownership"],
      "keywordGaps": ["A/B testing"],
      "rewriteIdeas": ["Move the growth project higher"]
    }
  }'`}
          </pre>
        </Panel>

        <Panel title="出站 Webhook" subtitle="站点也可以把上下文主动推送到你自己的工作流。">
          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <p>账户中心目前支持 3 条 webhook URL：</p>
            <ul className="space-y-2">
              <li>- 简历微调 webhook：从简历微调页触发。</li>
              <li>- 状态同步 webhook：从岗位详情页触发。</li>
              <li>- 通知同步 webhook：从通知管理页触发。</li>
            </ul>
            <p>
              每次出站触发都会生成一条 Agent Run 记录，方便用户在站内回看成功、失败和 payload 时间点。
            </p>
          </div>
        </Panel>

        <Panel title="出站 Payload 示例" subtitle="这里展示站点发往你自己 webhook URL 的主要 payload 结构。">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-ink">简历微调 Webhook</div>
              <pre className="overflow-x-auto rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
{`{
  "type": "TAILOR_REQUEST",
  "job": {
    "id": "<JOB_ID>",
    "companyName": "ByteDance",
    "roleTitle": "AI Product Manager",
    "city": "Beijing",
    "sourceName": "Boss Zhipin",
    "sourceUrl": "https://example.com/job/123",
    "status": "READY_TO_APPLY",
    "rawContent": "Original JD text..."
  },
  "resume": {
    "id": "<RESUME_ID>",
    "title": "Product Base Resume",
    "rawText": "Original resume text...",
    "assets": [
      {
        "kind": "DOCX",
        "artifactName": "product-base.docx",
        "fileUrl": "https://...",
        "isPreviewSource": false,
        "isEditingSource": true,
        "extractedText": "..."
      }
    ]
  },
  "customInstructions": "Optional user instructions"
}`}
              </pre>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-ink">状态同步 Webhook</div>
              <pre className="overflow-x-auto rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
{`{
  "type": "STATUS_SYNC",
  "job": {
    "id": "<JOB_ID>",
    "companyName": "ByteDance",
    "roleTitle": "AI Product Manager",
    "city": "Beijing",
    "sourceName": "Boss Zhipin",
    "sourceUrl": "https://example.com/job/123",
    "status": "FIRST_INTERVIEW"
  },
  "application": {
    "id": "<APPLICATION_ID>",
    "currentStage": "FIRST_INTERVIEW",
    "note": "User notes...",
    "events": [
      {
        "id": "<EVENT_ID>",
        "eventType": "INTERVIEW",
        "title": "First-round interview",
        "eventTime": "2026-05-06T10:00:00.000Z",
        "aiProvider": "openai"
      }
    ]
  }
}`}
              </pre>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-ink">通知同步 Webhook</div>
              <pre className="overflow-x-auto rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
{`{
  "type": "NOTIFICATION_IMPORT",
  "event": {
    "id": "<EVENT_ID>",
    "eventType": "INTERVIEW",
    "title": "Interview invitation",
    "eventTime": "2026-05-06T10:00:00.000Z",
    "artifactName": "invite.pdf",
    "artifactUrl": "https://...",
    "aiProvider": "openai",
    "aiNote": "Parsed from imported notice.",
    "content": "Full notice text...",
    "requirements": ["Confirm attendance", "Bring ID"]
  },
  "application": {
    "id": "<APPLICATION_ID>",
    "currentStage": "FIRST_INTERVIEW",
    "note": "User notes..."
  },
  "job": {
    "id": "<JOB_ID>",
    "companyName": "ByteDance",
    "roleTitle": "AI Product Manager",
    "city": "Beijing",
    "sourceName": "Boss Zhipin",
    "sourceUrl": "https://example.com/job/123",
    "status": "FIRST_INTERVIEW"
  }
}`}
              </pre>
            </div>
          </div>
        </Panel>

        <Panel title="接口范围" subtitle="使用接口前，请确认下列支持范围。">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-panel p-4">
              <div className="text-sm font-medium text-ink">支持内容</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>- 写回岗位、阶段、事件、微调结果和简历版本。</li>
                <li>- 从站内把简历、状态和通知上下文推送到外部 webhook。</li>
                <li>- 每用户独立 bearer token，以及 Agent Run 审计日志。</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-panel p-4">
              <div className="text-sm font-medium text-ink">使用限制</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>- OAuth 和第三方授权页面。</li>
                <li>- 内置浏览器自动投递执行器。</li>
                <li>- 大文件直传；外部系统仍应先提供可访问文件 URL。</li>
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="使用说明" subtitle="请在接入前确认以下事项。">
          <ul className="space-y-2 text-sm leading-6 text-slate-700">
            <li>- OpenAPI JSON 可用于自动化工具读取接口结构。</li>
            <li>- Agent 运行记录可用于查看执行状态。</li>
            <li>- 外部附件请提供可访问的文件 URL。</li>
            <li>- 出站 webhook 使用账户中配置的地址和校验字段。</li>
          </ul>
        </Panel>
      </div>
    </PageShell>
  );
}

function EndpointCard({
  method,
  path,
  summary,
  fields,
  statuses
}: {
  method: string;
  path: string;
  summary: string;
  fields: string;
  statuses: string;
}) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-ink px-3 py-1 text-xs font-medium text-white">{method}</span>
        <span className="font-mono text-sm text-ink">{path}</span>
      </div>
      <div className="mt-2 text-sm text-slate-700">{summary}</div>
      <div className="mt-2 text-xs text-slate-500">常用字段：{fields}</div>
      <div className="mt-1 text-xs text-slate-500">典型状态码：{statuses}</div>
    </div>
  );
}
