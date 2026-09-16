# 求职工作台

把岗位、投递进度、笔试面试通知和下一步行动放在一个地方管理。

## 在线体验

[立即使用求职工作台](https://job-hunt-ai-workbench-3ec5dk9ev-m7826446-7831s-projects.vercel.app/login)


## 它解决什么问题

秋招海投之后，麻烦往往不是投出一个岗位，而是记住每个机会走到了哪里：投了哪些公司、哪家要测评、面试在哪一天、下一步该做什么，以及同一个岗位的通知历史。

求职工作台围绕这条流程工作：

**记录机会 → 跟踪进度 → 管理通知 → 提醒下一步 → 为 Agent 提供上下文。**

它不是一个要求你为每个岗位维护多份简历的工具，而是一个帮助你在高频投递期间不丢上下文的工作台。

## 核心功能

### 岗位工作台

- 导入并集中查看岗位机会。
- 使用列表快速扫读岗位、Base、进度和当前事项。
- 使用看板快速浏览不同阶段，并直接拖动卡片更新阶段。
- 点击岗位进入详情，查看岗位信息、申请进度和完整时间线。

### 通知管理

- 手动导入招聘邮件、聊天通知或附件内容，并关联到对应岗位。
- 按公司和岗位机会聚合通知；同一公司的不同岗位不会混在一起。
- 在通知时间线中查看、修正通知类型和时间信息。
- 记录面试固定时间、测评开放窗口、最终 ddl，以及“收到通知后若干小时内有效”的链接限制。

### 首页提醒

- 查看今天优先需要处理的事项。
- 查看临近截止的岗位、即将到来的笔试/面试和最近事件。
- 已关闭的机会不会继续占据提醒。

### 候选人资料

- 保存当前主简历和必要的候选人资料。
- 从已确认的简历解析结果中维护可复用的事实信息。
- 不要求维护大量历史简历版本。

### Agent 准备

- 在岗位详情中选择准备任务，例如岗位匹配分析、笔试准备、面试准备、项目深挖或面试复盘。
- 生成可复制的岗位上下文和提示词。
- 将内容粘贴到 Windows Codex App 或其他你使用的 Agent 中继续准备。

Agent 目前采用 Copy-to-Agent 方式：不会自动控制本地 App，也不会自动创建对话。

## 3 分钟开始使用

1. 注册或登录账号。
2. 导入第一个岗位，补全公司、岗位和 Base 等基本信息。
3. 在“我的求职”中更新投递进度；列表适合批量处理，看板适合快速移动阶段。
4. 收到测评、笔试或面试通知后，进入“通知管理”导入并关联到对应岗位。
5. 在岗位详情查看时间线和当前事项；重要时间请自行再次确认。
6. 面试或笔试前，点击“用 Agent 准备”，复制上下文到你常用的 Agent。

## 推荐使用方式

### 每天

- 打开首页查看今天要处理的事项和临近 deadline。
- 批量投递后，更新岗位阶段或拖到对应看板列。

### 收到通知后

- 导入通知并关联岗位。
- 检查通知类型、面试时间、测评窗口和 ddl；必要时手动修正。

### 面试前后

- 打开对应岗位，回看 JD、通知历史和当前事项。
- 使用 Agent handoff 准备面试或深挖项目。
- 面试后更新阶段，并记录后续通知。

## 当前边界

- 通知当前主要通过手动导入，尚不自动读取邮箱。
- 某些解析或 AI 辅助能力需要你在账号设置中完成相应配置。
- Agent handoff 当前是复制上下文，不会自动操作本地 Codex App。
- 这是个人 Beta 工具；重要面试时间和 ddl 请始终以招聘方原始通知为准。

## 隐私

- 每个账号的数据按用户隔离。
- 简历文件使用受保护的存储和下载路径，不会公开展示给其他用户。
- 你配置的第三方 AI 服务或密钥仅按你的配置用于相关功能。

## 截图

当前仓库没有适合公开展示的最新截图。建议在正式环境手动截取并加入以下三个文件：

- `docs/screenshots/dashboard.png`：首页，展示今日待办与临近事项。
- `docs/screenshots/jobs.png`：岗位工作台，优先展示看板拖拽或五列表格。
- `docs/screenshots/notifications.png`：通知管理，展示按岗位聚合的通知历史。

## 开发者运行

<details>
<summary>本地运行、数据库迁移与部署说明</summary>

### 技术栈

- Next.js / React / TypeScript
- Prisma + PostgreSQL
- Vercel Blob 私有文件存储

### 安装与开发

```bash
npm install
# 配置 .env.local 中所需的数据库、认证和存储变量
npm run dev
```

### 构建

```bash
npm run build
```

### PostgreSQL migration

对目标数据库使用 direct / non-pooled `DATABASE_URL`，并显式执行：

```bash
npm run prisma:generate:postgres
npm run prisma:migrate:status:postgres
npm run prisma:migrate:deploy:postgres
npm run prisma:migrate:status:postgres
```

应用运行时应使用 pooled `DATABASE_URL`。不要以 `prisma migrate dev` 或 `prisma db push` 作为发布步骤。

### 部署

查看 [DEPLOYMENT.md](DEPLOYMENT.md) 和 [OPS_LAUNCH_AND_DOMAIN_CUTOVER.md](OPS_LAUNCH_AND_DOMAIN_CUTOVER.md)。

</details>
