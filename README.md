# Job Hunt AI Workbench

> 一个 agent-ready 的 AI 求职工作台：用结构化数据管理完整求职生命周期，并让 LLM Agent 将非结构化招聘通知转化为可确认、可追踪的求职事件。

Job Hunt AI Workbench 不是一个替用户“自动找工作”的聊天助手，而是一套面向个人求职流程的数据与 Agent 工作台。系统以岗位线索、申请、事件和简历为核心对象，把散落在招聘网站、邮件、聊天记录和文件中的信息整理为可查询、可审计的状态。

传统 Excel 能记录静态字段，简单任务工具能维护待办，但复杂求职流程同时包含一对一对象关系、阶段状态、时间窗口、历史事件、简历版本和来源证据。它们很难稳定回答“这条通知属于哪次申请”“当前阶段为什么发生变化”“当时使用了哪份简历”等问题。本项目因此聚焦三件事：

- **Job application lifecycle management**：以 `JobLead → Application → ApplicationEvent` 管理从岗位线索到申请阶段和事件时间线。
- **Structured personal career data system**：将简历、岗位、申请和招聘事件保存为结构化、可复用的数据，而不是仅保留聊天上下文。
- **Human-in-the-loop AI workflow**：LLM 负责抽取与生成提案，用户负责确认，核心记录只通过受控业务逻辑变更。

## Core Features

### Application Management

- **JobLead**：保存公司、岗位、地点、行业、JD、来源和原始内容，保留结构化信息与来源事实。
- **Application**：每条岗位线索对应一条申请记录，记录当前阶段、投递时间、所用简历、下一步行动和备注。
- **Application stage tracking**：覆盖待投递、已投递、测评、笔试、各轮面试、谈薪、Offer、拒绝和关闭等阶段，并支持列表与看板管理。
- **Application timeline**：将笔试、测评、面试、截止时间、Offer 和拒绝等事件关联到具体申请，保留事件状态、时间点或时间窗口及通知详情。

### Resume Intelligence

- **Resume asset management**：管理 PDF、DOCX 等原始简历资产，区分预览源、编辑源和文件匹配状态。
- **Structured resume schema**：使用版本化的 `ResumeDocument` schema 表达基础信息、教育经历、实习、工作、项目和技能。
- **Resume parsing pipeline**：上传资产后创建解析任务，经外部解析服务抽取、schema 规范化、质量检查和人工审核，再形成可被 AI 与 MCP 使用的确认版本。
- **Resume version management**：支持多份简历、主简历、解析历史和岗位定制版本；新版本不会覆盖既有资产或历史解析记录。

### Recruitment Event Agent

Recruitment Event Agent 是当前 Phase 3 的核心工作流。它接收用户粘贴的招聘邮件或通知文本，将非结构化内容转换为一个有来源证据、待用户确认的事件提案：

```text
Notification text
        ↓
LLM structured extraction
        ↓
Application matching
        ↓
Human confirmation
        ↓
Application event timeline update
```

当前能力包括：

- **招聘通知解析**：抽取公司、岗位、事件类型、通知意图、线上/线下方式、地址、链接、行动项、要求和摘要。
- **公司与岗位实体匹配**：在当前用户的活跃申请中，根据公司、岗位及地点证据计算候选分数。
- **时间语义理解**：区分固定时间（`FIXED_TIME`）、有效时间窗（`TIME_WINDOW`）和截止时间（`DEADLINE`），并将完整中文日期时间规范为带时区的 ISO-8601 值。
- **Confirmation workflow**：Agent 只创建包含原始证据和精确变更内容的 `AgentProposal`；用户可查看、确认或拒绝。招聘事件提案只有在确认后才写入申请时间线。

事件抽取覆盖以下主要场景：

- Written test
- Interview（包括 AI 面与多轮面试）
- Assessment
- Deadline

匹配不是一次模糊字符串查找。系统先规范化实体，再结合多个信号评分：

- **Company normalization**：移除常见公司后缀，并将已知别名归一。例如 `腾讯`、`腾讯云`、`腾讯云与智慧产业事业群（CSIG）` 和 `CSIG` 可归一到 `腾讯`。
- **Role normalization**：清理业务群或公司前缀，再比较岗位 token。例如 `CSIG 技术产品商务培训生` 与 `技术产品商务培训生` 可匹配到同一岗位语义。
- **Confidence-based matching**：仅当存在唯一的 `HIGH` confidence 候选时创建待确认 Proposal；没有高置信度候选时不建立关联，出现多个高置信度候选时按歧义处理，保留候选而不擅自选择。

当 OpenAI 调用失败或未配置时，系统会降级到本地规则抽取；规则结果仍需经过同一匹配与确认边界。

## Agent Architecture

本项目将 Agent 与核心数据写入明确隔离：

```text
Agent
  ↓
Proposal (payload + source evidence)
  ↓
Human confirmation
  ↓
Validated domain service
  ↓
Database mutation
```

AI 不直接修改申请阶段或事件时间线。Agent 生成的 Proposal 会保存目标申请、变更 payload、来源类型和原始证据；确认操作仅对当前登录用户开放，执行时再次校验所有权、提案类型、状态和 payload，并在事务中防止重复执行。

采用 Human-in-the-loop 的原因很直接：招聘通知可能缺少完整公司名、岗位名或时间上下文，LLM 抽取和实体匹配也可能产生歧义。将模型输出先变成可审查的 Proposal，可以避免错误更新用户的求职记录，同时保留 Agent 自动化所需的标准接口。

## MCP-ready Architecture

项目提供基于 Streamable HTTP 的 MCP endpoint，并通过用户级 API token 隔离数据。当前用于 Agent 上下文读取的 MCP tools 为：

| Tool | 能力 |
| --- | --- |
| `list_applications` | 按阶段或公司筛选申请，返回匹配所需的紧凑字段 |
| `get_application` | 获取单个申请、岗位详情和事件时间线 |
| `get_resume` | 仅返回已由用户确认的结构化 `ResumeDocument` |
| `get_today_application_events` | 获取当天处于活跃申请中的非忽略事件 |
| `get_upcoming_deadlines` | 获取未来指定天数内的活跃截止事件 |

MCP 读取接口不会返回其他用户的数据，也不会把未经确认的简历解析结果作为事实。代码中还存在两条受 `AgentProposal` 和用户确认门控的有限执行工具，用于更新申请状态和追加申请事件；它们只能执行服务端已保存的 payload，不能由 Agent 临时改写业务参数。这不等同于开放的 Agent 自治写权限。

后续可在相同边界上扩展：

- Email ingestion：经用户授权接入邮件来源，替代手工粘贴通知。
- Agent write actions：扩充可提案、可确认、可审计的写操作范围。
- Daily review：基于已确认数据生成每日申请回顾与待办建议。

## Technical Architecture

| Layer | Stack | Responsibility |
| --- | --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS | 工作台界面、看板、审核与确认交互 |
| Backend | Next.js Server Actions / Route Handlers, Prisma | 认证、业务规则、事务与 API 边界 |
| Database | PostgreSQL | 用户、岗位、申请、事件、简历、解析和 Proposal 持久化 |
| AI | OpenAI-compatible API, Zod structured extraction, local fallback rules | 结构化抽取、简历与岗位分析、Agent 提案输入 |
| Agent interface | Model Context Protocol | 用户级上下文读取与受确认约束的执行接口 |
| Infrastructure | Vercel, Neon PostgreSQL, Vercel Blob | 应用部署、生产数据库与文件存储 |

生产环境使用 PostgreSQL schema 与显式 Prisma migrations；仓库中的 SQLite schema 和数据库仅用于本地开发。

## Data Model

核心关系可以简化为：

```text
JobLead
   │ 1:1
Application
   │ 1:N
ApplicationEvent (Event)

Resume
   │ 1:N
ResumeDocument source (ResumeAsset)
   │ 1:N
ResumeParse ──> confirmed structured ResumeDocument

AgentProposal
   │ user confirmation
   ▼
Confirmed Event / Application update
```

- `JobLead` 保存岗位事实和来源；`Application` 保存用户针对该岗位的流程状态。
- `Event` 构成申请时间线，能够表达固定时间、时间窗口、截止时间和事件处理状态。
- `ResumeAsset` 是原始文件，`ResumeParse` 是一次解析尝试，`ResumeDocument` 是经过 schema 校验并由用户确认的结构化内容。
- `AgentProposal` 是 AI 与核心写操作之间的审计边界；Proposal 本身不是已生效的业务事实。

## Project Status

### Completed

- Application management：岗位线索、申请阶段、列表/看板和事件时间线
- Resume pipeline：资产管理、结构化 schema、解析审核、确认状态和版本管理
- Recruitment Event Agent：通知抽取、时间语义解析和本地规则降级
- Matching system：公司/岗位归一、候选评分、唯一高置信度门槛和多候选保护
- Human confirmation workflow：Proposal 查看、确认/拒绝、事务化执行和防重复写入
- MCP integration：五个用户隔离的读取工具，以及受确认 Proposal 约束的有限执行路径

### Future roadmap

- Email connector：从用户授权的邮箱接收招聘通知
- Broader agent write tools：在 Proposal + confirmation 约束下扩展更多写操作
- Resume–JD matching：基于已确认简历和结构化 JD 的匹配分析
- Daily application review：汇总近期事件、截止时间和待跟进申请

## Engineering Boundaries

- 不自动跨招聘平台投递，也不承诺“自动拿 Offer”。
- 不读取招聘平台或社交平台的私有数据接口。
- 不把 LLM 输出直接当作用户事实；关键结构化结果需要确认或经过受控规则校验。
- 不在信息缺失时推断公司、岗位、时间、会议地址或材料要求。
- Agent 自动化围绕可追踪的数据模型和可审计的 Proposal 展开，而不是绕过业务层直接写数据库。
