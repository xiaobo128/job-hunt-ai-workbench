# AI 求职工作台

> 把岗位、投递进度、招聘通知和简历集中放在一个地方，
> 然后直接用 AI Agent 帮你查、整理和更新。

Job Hunt AI Workbench 是一个可以直接和 AI Agent 对话使用的求职工作台。

连接 Agent 后，大多数日常操作都可以直接聊天完成；想整体看看求职进度、检查数据或确认修改时，再打开 Web。

🌐 **在线使用：[project-iry1g.vercel.app](https://project-iry1g.vercel.app)**

## 你可以直接这样和 Agent 说

> 我今天有什么要处理的？

> 把这个岗位加进去，我已经投了。

> CVTE 这个岗位我已经投递了，帮我更新一下。

> 帮我把这封测评邮件录进去。

> 帮我看看下周有哪些笔试和面试。

> 阿里云这个岗位现在进展到哪了？

你可以发送文字，也可以把 JD、招聘邮件或截图一起发给 Agent。Agent 会帮你理解内容、查询工作台，并准备需要的操作。

## 它能帮你做什么？

### 1. 看看今天该做什么

你问：

> 我今天求职上有什么需要处理的？

Agent 可以根据工作台里的记录告诉你：

- 目前有多少待投递、已投递、测评和面试；
- 今天有哪些事项；
- 接下来有哪些笔试、测评、面试和截止时间。

### 2. 新增一个岗位

你把 JD 文字或截图发给 Agent，然后说：

> 把这个岗位加到我的求职里，我已经投了。

Agent 会整理公司、岗位、地点、JD 和当前状态，并给你一个确认链接。你检查无误并确认后，它才会真正出现在岗位列表里。

### 3. 更新投递状态

你说：

> CVTE 这个岗位我已经投递了，帮我更新一下。

Agent 找到对应岗位后，会准备这次修改，例如：

```text
准备投递 → 已投递
```

你点确认后，新的状态才会生效。如果有多个同名或相似岗位，Agent 会先请你确认是哪一个。

### 4. 录入招聘通知

把招聘邮件、消息文字或截图发给 Agent，然后说：

> 帮我把这个通知录进去。

Agent 可以帮你整理：

- 这是笔试、测评还是面试；
- 截止时间或面试时间；
- 参加链接和地点；
- 需要提前准备的内容。

确认后，通知会进入工作台，并显示在通知列表和时间线里。

### 5. 查看某个岗位的完整情况

你说：

> 帮我看看阿里云这个岗位现在进展到哪了。

Agent 可以读取这个岗位的 JD、当前申请阶段、投递时间、历史招聘通知、下一步行动和关联简历，再帮你快速梳理现状。

### 6. 准备面试

你可以继续对 Agent 说：

> 我要面这个岗位，帮我整理一下需要准备什么。

Workbench 会提供岗位、申请进度、招聘通知和简历等结构化信息；分析岗位重点、组织面试准备计划，则由你连接的 Agent 完成。

## 平时怎么用？

日常使用可以很简单：

```text
查询、记录、更新 → 直接和 Agent 聊天
总览、检查、确认 → 打开 Web
```

Agent 适合处理高频、零散的操作，比如查今天的安排、从截图整理 JD、更新投递状态或记录一封通知。Web 适合一次看全局、浏览详细数据、手动修正内容、管理简历，以及确认 Agent 准备的修改。

Agent 和 Web 读取的是同一份求职记录，不需要在两边重复维护。

## 修改数据前，我需要做什么？

**Agent 不会悄悄改你的求职记录。**

如果只是查询，Agent 可以直接读取你的工作台。涉及下面这些操作时：

- 新增岗位；
- 修改投递状态；
- 新增招聘通知；

Agent 会先准备一份变更内容，并给你一个确认页面。你可以检查它准备修改什么，然后选择：

```text
[确认并执行]  [拒绝]
```

只有确认后，修改才会真正写入。这样既可以用自然语言快速操作，也不用担心 AI 自己随意更改重要信息。

## 打开 Web 后可以看到什么？

### 首页

- 当前求职进度；
- 今天要处理的事项；
- 近期测评、面试和截止时间；
- 日历。

### 我的求职

- 所有岗位和当前阶段；
- JD、投递时间和申请详情；
- 备注和下一步行动。

### 通知管理

- 笔试、测评和面试；
- Offer 与拒绝通知；
- 截止提醒和历史通知。

### 我的简历

- 管理不同的简历版本；
- 查看和校正结构化简历；
- 将简历与具体申请关联。

Web 也支持手动新增和修正数据。即使暂时没有连接 Agent，也可以把它当作普通的求职进度管理工具使用。

## 怎么开始使用？

1. 打开[在线工作台](https://project-iry1g.vercel.app)并注册或登录。
2. 在 Web 中整理已有岗位、通知和简历，或者直接连接自己的 Agent。
3. 以后可以优先通过对话处理日常事项，需要总览、检查或确认时再回到 Web。

## 怎么连接自己的 AI Agent？

只要你的 Agent 支持 MCP 和自定义请求头，就可以连接这个工作台。

1. 打开「账户中心 → Agent 接入」。
2. 创建一个 API Token，并保存好只显示一次的 Token。
3. 把下面这段话发给支持 MCP 的 Agent：

```text
请帮我连接 Job Hunt Workbench。

Server URL：
https://project-iry1g.vercel.app/api/mcp

Authorization：
Bearer <YOUR_API_TOKEN>

连接后请先读取我的求职总览，确认是否成功。
如果操作会新增或修改数据，请先把确认链接发给我。
```

API Token 相当于工作台的数据访问凭证，只应交给你信任的 Agent 或客户端，不要把它提交到代码仓库。怀疑泄漏时，可以随时回到账户中心撤销。

## 当前能力与边界

为了避免误解，目前的 Workbench：

- 可以管理岗位、申请进度、招聘通知和简历；
- 可以让外部 Agent 通过 MCP 查询信息、准备新增或修改操作；
- 可以在 Web 中检查并确认 Agent 准备的修改；
- 不会自动登录招聘网站，也不会自动投递岗位；
- 不会连接或自动读取个人邮箱，邮件或消息需要由你提供给 Agent 或粘贴到 Web；
- 不会在未经 Web 确认时，让 Agent 直接写入重要数据；
- 不包含一套独立的“面试智能 Agent”，分析和内容生成能力来自你连接的外部 Agent。

## 技术实现

下面是面向开发者和希望深入了解接入方式的说明。

### 工作方式

```text
你 ──自然语言 / JD / 截图 / 消息──→ 外部 AI Agent
                                      │
                                      │ MCP
                                      ▼
                             Job Hunt AI Workbench
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
             Web 查看与确认                       PostgreSQL 数据
```

- 外部 Agent 负责理解自然语言、图片和上下文，并选择合适的工具。
- Workbench 负责数据校验、权限检查、业务规则和持久化。
- Web 与 Agent 共用同一套查询和业务逻辑。
- PostgreSQL 保存岗位、申请、通知、简历和待确认操作。

### MCP 工具

远程 MCP endpoint 为 `/api/mcp`。

#### 查询工具

| Tool | 用途 |
| --- | --- |
| `get_job_hunt_overview` | 获取求职进度、今日事项和近期事件 |
| `list_applications` | 按阶段或公司查找申请 |
| `get_application` | 获取一个申请、对应岗位和事件时间线 |
| `get_resume` | 获取用户已确认的结构化简历 |
| `get_today_application_events` | 获取今天的申请事件 |
| `get_upcoming_deadlines` | 获取未来指定天数内的截止事项 |

#### 待确认操作

| Tool | 用途 |
| --- | --- |
| `propose_job_application_create` | 准备新增岗位和申请，不会直接创建记录 |
| `propose_application_status_update` | 准备修改申请阶段 |
| `propose_recruitment_event` | 准备新增招聘通知，不会同时改变申请阶段 |
| `propose_recruitment_event_update` | 准备修改已有招聘通知；可由服务端根据接收时间和有效期推导截止时间 |

这些工具会返回 `confirmationUrl`。登录用户在 Web 中确认后，系统会立即执行对应修改；Agent 不需要在确认后再次调用执行工具。

项目仍保留 `update_application_status` 和 `append_application_event` 两个受控执行工具用于兼容现有流程。它们只能执行已经确认的操作，不能替换已确认的内容，也不能重复执行。

### 数据模型

| Model | 保存的内容 |
| --- | --- |
| `JobLead` | 公司、岗位、JD、地点、来源和要求 |
| `Application` | 申请阶段、投递时间、渠道、下一步和关联简历 |
| `Event` | 测评、笔试、面试、Offer、拒绝和 Deadline 等独立事件 |
| `Resume` | 简历版本、上传文件和已确认的结构化内容 |
| `AgentProposal` | Agent 准备执行、等待用户确认的操作 |

招聘通知和申请阶段是两个不同的事实。比如收到面试通知并不一定意味着系统应该自动修改申请阶段；如果两者都需要更新，Agent 会分别准备操作，交给用户确认。

### 技术栈

- **Web**：Next.js 15、React 19、Server Actions、Tailwind CSS
- **Data**：PostgreSQL、Prisma
- **Agent interface**：远程 MCP endpoint、Bearer Token
- **Validation and domain**：Zod / JSON Schema、Domain Service
- **AI parsing**：可配置 OpenAI-compatible API，用于 Web 内的文本、图片和招聘通知解析
- **Files**：支持本地存储或持久化对象存储

## 本地运行

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

打开 `http://localhost:3000` 注册账户。

如果要测试 MCP 的确认流程，`APP_URL` 必须是 Agent 和浏览器都能访问的绝对 HTTP(S) 地址，否则系统无法生成有效的确认链接。

生产环境应使用持久化 PostgreSQL、HTTPS 和持久化文件存储，并妥善保管数据库、AI API 与用户 Token 凭证。
