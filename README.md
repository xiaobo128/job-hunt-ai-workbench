# AI 求职工作台 / AI 求职 CRM

一个面向求职者的 AI 工作台原型，用来把分散的岗位信息、简历版本、申请进度和通知事件统一管理起来。

## 当前阶段

当前版本严格围绕 MVP 推进，闭环是：

`岗位导入 -> JD 解析 -> 简历微调 -> 申请看板 -> 通知补录`

已实现：

- 多来源岗位导入：链接、文本、截图、PDF、手动补录
- 导入后的确认流：新岗位默认进入“待确认解析”
- JD 结构化结果展示与人工修正
- 简历管理与岗位定向微调
- 定制简历草稿生成与“另存为新简历”
- 申请看板与阶段流转
- 通知解析基础版
- 多用户账号体系：注册、登录、登出、会话管理
- 用户数据隔离
- OpenAI 可选接入和本地降级

暂未实现：

- 强 OCR
- 完整 PDF / 图片简历解析
- 自动投递
- 邮箱 OAuth、浏览器插件、日历同步

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 准备环境变量

复制 `.env.example` 为 `.env`。

本地开发默认使用 SQLite 和本地上传目录。

3. 初始化数据库

```bash
npm run prisma:db:push
npm run prisma:seed
```

4. 启动开发环境

```bash
npm run dev
```

5. 访问应用

- App: [http://localhost:3000](http://localhost:3000)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)
  Health 响应里会带上数据库、存储、AI、部署就绪度的运行时摘要。

## 演示账号

- 邮箱：`demo@jobworkbench.local`
- 密码：`demo123456`

## 生产化建议

推荐部署组合：

- PostgreSQL: Neon
- Object Storage: Vercel Blob
- Hosting: Vercel

项目已经准备了：

- `prisma/schema.postgres.prisma`
- `lib/storage.ts` 中的 `vercel-blob` provider
- `.env.neon.example`
- `.env.production.example`
- `npm run predeploy:check`
- `npm run prepare:env:production`

## 常用命令

```bash
npm run dev
npm run build
npm run prisma:db:push
npm run prisma:generate:postgres
npm run prisma:db:push:postgres
npm run prisma:seed
npm run predeploy:check
npm run prepare:env:production
```

## 目录结构

```text
app/                Next.js App Router 页面与 server actions
components/         布局与通用组件
lib/                数据库、会话、AI、上传、存储等基础能力
prisma/             Prisma schema 与 seed
scripts/            预部署检查脚本
public/uploads/     本地存储 provider 的上传目录
.tmp/uploads/       解析流程使用的临时文件目录
```

## 部署说明

更完整的生产部署与 Neon / Vercel Blob 配置说明见：

- [DEPLOYMENT.md](/e:/code/job-hunt-ai-workbench/DEPLOYMENT.md)
- [.env.neon.example](/e:/code/job-hunt-ai-workbench/.env.neon.example)
