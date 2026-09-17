# 求职工作台

把岗位、投递进度、招聘通知、近期任务和候选人资料放在一个地方管理。

这是面向秋招高频投递场景的个人求职工作台：从记录岗位开始，持续跟踪投递阶段、安排和通知，并在需要时整理好可交给 Agent 的上下文。

## 在线体验

[立即使用求职工作台](https://project-iry1g.vercel.app/)

## 求职工作流

**记录岗位 → 跟踪投递阶段 → 管理招聘通知 → 安排近期任务 → 维护候选人资料 → 为 Agent 准备上下文**

### 首页 / 秋招工作流

- 在“近期任务”查看待处理与已完成事项。
- 用月历集中查看面试、测评和 deadline 等时间。
- 查看待投递、已投递、测评、面试和 Offer 的求职进度统计。
- 通知的处理状态会与首页任务同步，避免已完成或已忽略的事项反复出现。

### 我的求职

- 用列表或看板管理岗位机会。
- 在看板中拖拽卡片更新投递阶段。
- 双击编辑岗位的当前事项；阶段列内容过多时可在列内滚动查看。
- 导出岗位数据为 Excel。
- 点击岗位进入详情，查看岗位信息、阶段、通知历史和后续准备入口。

### 通知管理

- 以“公司 + 岗位”的求职机会为单位展示通知，条形机会卡片支持拖拽排序，并显示历史通知计数。
- 导入招聘邮件、聊天通知或附件内容后，查看按收到邮件时间排序的通知历史。
- 解析出的通知类型、时间和要求默认展示；原始邮件可通过“查看全文”弹窗核对。
- 通知可标记为“待处理”“已完成”或“已忽略”，并同步到首页。
- 支持笔试、AI 面、一面、二面、三面等细化通知类型。
- 支持面试固定时间、测评时间窗、deadline，以及“收到通知后若干小时/天内有效”的时间限制。

### 候选人资料

- 管理当前主简历并进行 Resume parsing。
- 人工确认结构化字段：左侧查看原文件/PDF，右侧校对结构化内容。
- 已确认的候选人事实可作为后续 Agent / AI 准备的可靠资料来源。

### Agent 准备

- 从岗位详情生成可复制的岗位、进度、通知和候选人资料上下文。
- 支持岗位匹配、笔试准备、面试准备、项目深挖和面试复盘。
- 当前采用 Copy-first handoff：复制 Prompt、JSON 或 Markdown 后粘贴到你使用的 Agent 中继续准备。

## 3 分钟开始使用

1. 注册或登录。
2. 导入第一个岗位。
3. 在“我的求职”更新投递阶段，或直接拖动看板中的岗位卡片。
4. 收到招聘邮件后，在“通知管理”导入通知并关联对应岗位。
5. 检查解析出的通知类型和时间，尤其是收到时间、面试时间与 ddl。
6. 回到首页查看近期任务和月历安排。
7. 完成事项后将通知标记为“已完成”或“已忽略”。
8. 面试前打开岗位详情，复制 Agent 准备上下文。

## 推荐使用方式

### 每天

- 查看近期任务。
- 查看月历中的面试、测评和 deadline。
- 更新投递阶段。

### 收到邮件后

- 导入通知。
- 检查收到时间、面试时间和 ddl，必要时修正。
- 处理完毕后标记为已完成；不再需要的事项标记为已忽略。

### 面试前

- 打开对应岗位。
- 回看通知历史。
- 使用 Agent 准备生成并复制上下文。

### 面试后

- 更新岗位阶段。
- 记录新收到的通知和下一步安排。

## 当前边界

- 通知当前主要还是手动导入，尚未自动连接邮箱。
- Agent 当前是 Copy-first handoff，不会自动控制本地 Codex App。
- 重要面试时间和 ddl 仍应以招聘方原始通知为准。
- 当前主要面向个人 Beta 与小范围朋友试用。

## 隐私

- 每个账号的数据按用户隔离。
- 简历文件使用受保护的存储和下载路径，不会公开展示给其他用户。

## 截图

当前仓库尚未包含以下最新截图；可在准备好后加入对应路径：

- `docs/screenshots/dashboard.png`：首页近期任务、月历与求职进度。
- `docs/screenshots/jobs.png`：我的求职看板。
- `docs/screenshots/notifications.png`：通知管理的机会列表或通知详情。

## 开发者运行

<details>
<summary>本地运行、数据库迁移与部署说明</summary>

### 技术栈

- Next.js / React / TypeScript
- Prisma / PostgreSQL
- Vercel（部署与私有文件存储）

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
