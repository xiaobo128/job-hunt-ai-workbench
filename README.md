# Job Hunt AI Workbench

> 面向 Agent 操作的 AI 求职工作台 / Agent-operable Job Hunt Workbench

Job Hunt AI Workbench 把外部 AI Agent 作为日常高频交互入口，把 Web 作为事实看板、人工校正与关键操作授权的 Control Plane。Agent 和 Web 不是两套系统：它们共享同一套业务规则、read model、PostgreSQL 数据库与 canonical state。

🌐 **在线体验：[project-iry1g.vercel.app](https://project-iry1g.vercel.app)**

核心原则：**Agent 负责理解和工具调用；Workbench 负责业务规则与事实管理；Human 负责关键写操作授权；PostgreSQL 保存唯一可信状态。**

## Agent-operable 产品理念

当通用 Agent 已经具备自然语言理解、视觉理解、上下文组织与 Tool Calling 能力，用户不必为每个高频操作都进入对应的 GUI 页面。用户可以直接描述目标、提供 JD、截图或招聘通知，由外部 Agent 理解内容、选择 MCP tool，并组织候选操作。

但理解意图不等于拥有写入事实的权限。系统按能力边界分工：

| 参与者 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| External AI Agent | 理解自然语言和用户提供的图片、JD、邮件；组织多段上下文；选择 tool；生成候选操作 | 不直接写数据库，不自行确认关键写操作 |
| Workbench backend | ownership / authorization、schema validation、确定性业务规则、事务、重复与 replay 防护、canonical state persistence | 不把概率性的模型判断直接当作业务事实 |
| Human | 澄清歧义、校正事实、在 authenticated Web session 中授权关键写操作 | 不需要手工完成每一步信息提取和 tool selection |
| PostgreSQL | 保存唯一可信的岗位、申请、事件、简历和 Proposal 状态 | 不由 Agent Memory、聊天记录或上下文窗口替代 |

这不是“给传统 Web 页面加几个 AI 按钮”，而是把稳定的求职业务能力变成 Agent 可发现、可描述、可校验调用的 tools，同时保留 Web 作为可信的人机边界。

## 四个自然语言 Workflow

以下四条链路已经通过真实 MCP + Web E2E 跑通。示例中的自然语言理解与截图理解发生在外部 Agent；Workbench Server 接收结构化 tool input，并执行确定性校验与业务逻辑。

### 1. 求职总览

用户：

> 我今天有什么需要处理的？整体秋招进展怎么样？

```text
External Agent
  → get_job_hunt_overview
  → progress / actionItems / upcomingEvents
  → 自然语言总结
```

`get_job_hunt_overview` 复用 Web Dashboard 的查询和 shared read model，不为 MCP 单独维护第二套 Dashboard 逻辑。因此 Agent 总结与 Web 看板读取的是同一份状态。

### 2. 新增岗位与 Application

用户提供 JD、岗位截图或文字，并说：

> 把这个岗位加到我的求职记录，我已经投了。

```text
External Agent 理解 JD / 截图
  → list_applications 检查明显重复
  → propose_job_application_create
  → JOB_APPLICATION_CREATE / PENDING
  → confirmationUrl
  → 用户在 Web 审查并确认
  → transaction 创建 JobLead + Application
  → EXECUTED
```

用户确认前，系统不会预创建 placeholder `JobLead` 或 `Application`。确认执行时复用正常 Domain Service；如果目标阶段是 `APPLIED`，`appliedAt` 和 `JobLead` / `Application` 状态同步仍遵守既有 domain rule。系统还会阻止明显重复的正式记录或待处理创建 Proposal。

### 3. 修改已有申请状态

用户：

> CVTE 这个岗位已经投了，帮我更新一下。

```text
External Agent 查找唯一 Application
  → propose_application_status_update
  → APPLICATION_STATUS_UPDATE / PENDING
  → confirmationUrl
  → 用户在 Web 审查并确认
  → updateApplicationStatus()
  → Application / JobLead 状态同步
  → EXECUTED
```

如果候选 Application 不唯一，应先请用户澄清，而不是把概率性匹配结果写成事实。

### 4. 录入招聘通知

用户提供邮件或消息正文，并说：

> 帮我把这封在线测评邮件录进去。

```text
External Agent 找到对应 Application
  → propose_recruitment_event
  → APPLICATION_EVENT_APPEND / PENDING
  → confirmationUrl
  → 用户在 Web 审查并确认
  → appendApplicationEvent()
  → Event 写入 Notifications / timeline
  → EXECUTED
```

`Event` 与 `Application.currentStage` 是两个不同的业务事实。新增招聘 Event 不会隐式修改申请阶段；如果通知也意味着阶段变化，Agent 应另外提出一个状态更新 Proposal。

当前 Workbench 不连接邮箱。招聘邮件或消息需要由用户提供给 Agent 或粘贴到 Web。

## 系统架构

```text
User
  │
  ├─ Natural Language / JD / Screenshot / Message
  │        ↓
  │  External AI Agent
  │        ↓ tool discovery + invocation
  │       MCP ───────────────────────┐
  │                                  │
  └─ Web Dashboard / Review /        │
     Confirmation ───────────────────┤
                                     ↓
                    Job Hunt AI Workbench
                  Shared Domain Service / Read Model
                                     ↓
                                 PostgreSQL
                          canonical source of truth
```

两条入口承担不同交互职责，但最终汇入同一套后端：

- Agent 路径适合自然语言交互、非结构化内容理解、tool selection 和跨上下文组织。
- Web 路径适合全局结构化浏览、批量查看、人工校正和关键操作授权。
- 读取能力尽量复用 Web read model；写入能力复用 domain services，而不是为 Agent 复制业务规则。
- PostgreSQL 是唯一事实源。Web 页面、MCP 响应和 Agent 回答都只是事实的不同视图或交互方式。

## Human-in-the-loop：Authorization / Trust Boundary

这里的 HITL 不只是“看一眼 AI 结果”，而是关键写操作的授权边界：

```text
AI decision                 Human authorization          Deterministic execution
Agent + Bearer Token        Authenticated Web Session    Workbench transaction
       │                              │                          │
       └─ create PENDING Proposal ───→ confirm ────────────────→ execute
                │                  confirmationUrl                │
                └────────────────────────────────────────────────→ EXECUTED
                                                                   │
                                                                   └─ canonical fact
```

- Agent 的 Bearer Token 可以读取授权范围内的数据并创建 `PENDING` Proposal。
- Agent 不能把自己的 Proposal 变成 `CONFIRMED`；确认只开放给登录用户的 Web session。
- 用户在 Web 中确认后，Server Action 会立即执行正常业务写入，并把 Proposal 推进到 `EXECUTED`。
- Agent 在用户确认后不应再次调用写执行工具；推荐流程没有“确认后回到 Agent 再执行”这一步。
- 执行使用 Proposal 中已保存且已审查的 payload，不能在执行时替换业务数据。
- ownership 检查、状态机校验、事务 claim 与 replay protection 都由后端确定性执行；已拒绝或已执行的 Proposal 不能再次写入。

因此，三个阶段必须分开理解：

1. **AI decision**：理解用户意图，选择工具，组织候选 payload。
2. **Human authorization**：确认这项候选操作可以成为正式事实。
3. **Deterministic execution**：由后端按 schema、ownership、状态机和事务规则落库。

`AgentProposal` 是“想做什么”的操作意图；`JobLead`、`Application` 和 `Event` 是确认执行后形成的 canonical business facts。`PENDING` Proposal 本身不是已经发生的求职事实。

## Design Decisions

### Why Agent-operable instead of adding AI buttons to every Web page?

自然语言、视觉理解和 Tool Calling 已经由通用 Agent 提供。对“总结今天待办”“把这张岗位截图记下来”“将这封测评通知录入”等高频任务，让用户每次寻找页面、表单和字段并不是唯一合理入口。

Workbench 因此把稳定的查询、Proposal 和受控执行能力暴露为 tools。Agent 可以在对话中组合这些能力，Web 则专注于需要高信息密度或强信任边界的交互。智能能力不绑定某一个页面，业务规则也不迁移到模型 prompt 中。

### Why MCP instead of only REST API?

MCP 并不“比 REST 更高级”，二者服务的接口对象不同：

- REST / Server Action 更偏 application-facing 或 system-facing integration。
- MCP 为 Agent 提供标准化的 tool discovery、description、input schema 和 invocation interface。
- Workbench 内部仍然使用普通查询、Server Action 和 Domain Service；MCP 是外部 Agent 进入这些稳定能力的适配层，而不是新的业务内核。

### Why not let the Agent write the database directly?

LLM 对意图的理解、实体匹配和工具选择具有概率性；ownership、authorization、schema、transaction、state machine、duplicate protection 和 replay protection 是确定性业务约束。

因此 Agent 负责准备 Proposal，Workbench 负责校验并执行存储的 payload。即使 Agent 判断错误，未经用户授权的候选操作也不会直接成为关键业务事实。

### Why PostgreSQL instead of Agent Memory?

岗位、申请阶段、投递时间、招聘事件和简历版本属于需要持久化、可查询、可校正的业务事实。上下文窗口可能截断，聊天记录可能分散，模型记忆也不具备关系约束与事务语义。

**Agent Memory ≠ business source of truth。** Agent 可以使用对话上下文改善交互，但事实必须回到 PostgreSQL，并通过 Workbench 的业务规则读取和修改。

### Why no RAG / Vector DB as the core architecture?

当前核心上下文高度结构化：`JobLead`、`Application`、`Resume` 和 `Event` 都有明确关系，可以通过带 ownership 约束的 deterministic tool query 精确获得。为了展示技术栈而先向量化再检索，会引入额外同步、召回和可解释性问题。

这不表示项目永远不需要 RAG。若未来出现大量非结构化材料的语义检索需求，可以再评估；对当前问题，结构化查询是更直接可靠的选择。

### Why keep the Web?

Agent 减少了高频操作对 GUI 的依赖，但没有消除适合视觉化和人工决策的场景。Web 仍然适合：

- 全局结构化浏览与批量查看；
- 岗位、申请和事件的数据修正；
- Resume 上传、结构化结果 review 与版本管理；
- Proposal 内容和来源证据审查；
- authenticated session 下的 Human authorization。

因此 Web 更像 Control Plane / Dashboard，而不是 Agent 的重复实现，也不是被 Agent 完全替代的旧入口。

### Why Proposal and Event/Application are separate?

Proposal 表达“系统准备做什么”，Event / Application 表达“系统确认已经发生或已经记录的事实”。二者生命周期和信任级别不同：Proposal 可以被拒绝，也需要防止重放；业务事实则参与 Dashboard、timeline、通知和后续 domain rule。

把它们分开，才能保证用户确认前不出现 placeholder 事实，也能让审计、拒绝和执行状态保持清晰。

## MCP Tool 能力

远程 MCP endpoint 为 `/api/mcp`。以下工具表按当前 `lib/mcp/server.ts` 的实际注册内容整理。

### Read tools

| Tool | 当前语义 |
| --- | --- |
| `get_job_hunt_overview` | 返回 `progress`、`actionItems`、`upcomingEvents`；复用 Web Dashboard 的 shared read model |
| `list_applications` | 按阶段或公司筛选并返回申请的紧凑匹配字段 |
| `get_application` | 返回一个申请、对应 JobLead 与 Event timeline |
| `get_resume` | 只返回当前用户已确认的结构化 ResumeDocument |
| `get_today_application_events` | 返回今天出现在 Dashboard 日历中的有效申请事件 |
| `get_upcoming_deadlines` | 返回未来指定天数内活动申请的截止事项 |

### Proposal tools

| Tool | 当前语义 |
| --- | --- |
| `propose_job_application_create` | 检查明显重复后，创建 `JOB_APPLICATION_CREATE` PENDING Proposal；不会预创建 JobLead / Application |
| `propose_application_status_update` | 为明确的 Application 创建阶段更新 Proposal；返回 `confirmationUrl` |
| `propose_recruitment_event` | 为明确的 Application 解析并创建招聘 Event Proposal；不会改变 Application Stage |

三个 Proposal tools 都只创建待确认意图。Agent 的 Bearer Token 无法确认它们；用户必须进入返回的 `confirmationUrl`，使用 authenticated Web session 审查并授权。

### Controlled execution tools

| Tool | 当前语义 |
| --- | --- |
| `update_application_status` | 仅能执行已确认的 `APPLICATION_STATUS_UPDATE` Proposal，并从存储的 Proposal 读取 payload |
| `append_application_event` | 仅能执行已确认的 `APPLICATION_EVENT_APPEND` Proposal，并从存储的 Proposal 读取 payload |

这两个工具是现有兼容/受控执行能力，不是普通用户确认后的推荐主流程。当前 Web confirmation 会立即执行相同的 domain mutation；确认完成后，Agent 不应再调用 execution tool。重复执行会被 replay protection 拒绝。

## Web Control Plane

Web 不再承担所有高频交互，但仍提供 Agent 不适合独立完成的结构化视图和授权操作：

- Dashboard：查看全局进度、今日行动项、日历与近期事件。
- 求职记录：用表格、看板和详情页浏览、筛选和人工校正岗位与申请。
- 通知与 timeline：查看招聘事件，处理状态并保留通知原文和解析结果。
- Resume review：上传文本、PDF、Word 或图片，核对结构化结果，管理版本与申请关联。
- Proposal review：查看候选操作、来源证据和变更内容，确认或拒绝。
- Account / Agent access：创建和撤销 API Token，配置 MCP 客户端与 AI 服务。

Web 中的直接操作和 Agent 发起的操作最终复用同一套 canonical state 与业务规则，不需要在两个系统之间同步。

## 结构化业务模型

| Model | 业务含义 |
| --- | --- |
| `JobLead` | 岗位机会本身：公司、职位、JD、来源、城市、技能与要求等 |
| `Application` | 用户对该岗位的一次申请状态：阶段、投递时间、渠道、下一步、所用简历；当前实现与 JobLead 一对一 |
| `Event` | 招聘过程中独立发生的通知或节点，如测评、笔试、面试、Offer、拒绝和 Deadline；不会自动等同于 Stage |
| `Resume` | 用户的简历版本及其上传资产、解析尝试和已确认结构化文档；MCP 只读取已确认内容 |
| `AgentProposal` | Agent 提出的待授权操作意图，保存类型、payload、来源证据和 `PENDING / CONFIRMED / EXECUTED / REJECTED` 生命周期 |

模型边界让系统能够分别回答“岗位是什么”“申请进展如何”“发生了什么通知”“用了哪份简历”和“Agent 想修改什么”，而不是把所有状态压入一段对话文本。

## Agent 连接方式

当前可以通过远程 MCP 连接支持自定义请求头的 Agent 客户端：

1. 登录 Web，进入「账户中心 → Agent 接入」。
2. 创建一个按用途命名的 API Token，并保存只显示一次的明文。
3. 将部署域名和 Token 配置到 Agent 客户端。
4. 先调用只读工具验证连接，再开始 Proposal workflow。

可直接把下面的配置意图交给支持 MCP 的 Agent：

```text
请帮我连接 Job Hunt Workbench 的远程 MCP 服务，并命名为 job-hunt-workbench。
Server URL：https://project-iry1g.vercel.app/api/mcp
请求头：Authorization: Bearer <YOUR_API_TOKEN>
配置完成后，请先执行 get_job_hunt_overview 验证连接。
关键写操作必须先创建 Proposal，并把 confirmationUrl 交给我在 Web 中确认。
Web 确认会立即执行，不要在确认后再次调用 execution tool。
```

API Token 相当于账户数据访问凭证，只应交给受信任的客户端，不要提交到代码仓库；怀疑泄漏时应立即在账户中心撤销。Token 能创建 Proposal，但不能替代登录用户的 Web confirmation。

项目也保留 application/system-facing 的 Agent API 与 webhook 集成入口；它们不等同于上述推荐的 MCP + Web confirmation 主流程，接入时应按各自权限模型评估。

## 技术实现

- **Web**：Next.js 15、React 19、Server Actions、Tailwind CSS。
- **Data**：PostgreSQL 作为唯一事实源，Prisma 负责关系模型、查询和事务访问。
- **Agent interface**：基于 `@modelcontextprotocol/server` 的远程 MCP endpoint，使用 Bearer Token 识别用户范围。
- **Validation and domain**：Zod / JSON Schema 校验 tool input；Domain Service 负责状态同步、`appliedAt`、事件追加、ownership 和事务规则。
- **Shared reads**：`get_job_hunt_overview` 与 Web Dashboard 共享查询和 overview read model。
- **HITL execution**：Proposal 状态机、authenticated Web confirmation、transactional claim 与 replay protection。
- **AI parsing**：可配置 OpenAI-compatible API，用于 Web 内文本/图片解析和招聘通知结构化；外部 Agent 自身的视觉理解不属于 Workbench Server 能力。
- **Files**：支持本地存储或持久化对象存储配置，用于岗位、通知和简历资产。

## 当前能力边界

当前项目明确**没有**以下能力：

- 不自动登录招聘网站，也不自动投递岗位。
- 不连接或自动读取个人邮箱；招聘邮件需要用户提供给 Agent 或 Web。
- 不提供 Agent Memory；对话上下文不能替代 PostgreSQL 中的业务事实。
- 不以 RAG / Vector DB 作为核心链路；当前优先使用结构化关系查询。
- 不包含 Multi-Agent 编排。
- 不把自动 Application 模糊匹配作为主流程；目标不唯一时需要用户澄清。
- 不进行大规模自主写操作。
- 不允许 Agent 在未经 Web 确认时直接写入关键业务事实。
- 不把外部 Agent 对截图、JD 或邮件的理解描述为 Workbench Server 自带的视觉能力。

当前已验证 overview、status proposal、recruitment event proposal、job/application create proposal 的 MCP + Web E2E 闭环，但项目不声明 accuracy、自动化成功率、benchmark、用户规模或商业客户数据。

## 本地运行 / 配置

### 环境要求

- Node.js 与 npm
- PostgreSQL
- 可选的 OpenAI-compatible API（用于 AI 解析）

在仓库根目录创建 `.env`：

```dotenv
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>"
APP_URL="http://localhost:3000"
STORAGE_PROVIDER="local"

# 岗位、通知和图片解析所需；也可在账户中配置个人模型
OPENAI_API_KEY="<your-api-key>"
OPENAI_MODEL="<text-model>"
OPENAI_VISION_MODEL="<vision-model>"
```

安装依赖、生成 Prisma Client、应用 PostgreSQL migration 并启动：

```bash
npm install
npm run prisma:generate:postgres
npm run prisma:migrate:deploy:postgres
npm run dev
```

打开 `http://localhost:3000` 注册账户。若要测试远程 MCP Proposal workflow，`APP_URL` 必须是 Agent 和浏览器都能访问的绝对 HTTP(S) 地址，否则系统无法生成有效的 `confirmationUrl`。

生产环境应使用持久化 PostgreSQL、HTTPS、持久化文件存储，并妥善管理数据库、AI API 与用户 Token 凭证。
