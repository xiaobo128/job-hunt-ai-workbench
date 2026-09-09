const { PrismaClient, SourceType, ApplicationStage, EventType } = require("@prisma/client");
const { randomBytes, scryptSync } = require("crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  await prisma.session.deleteMany();
  await prisma.event.deleteMany();
  await prisma.resumeTailorRun.deleteMany();
  await prisma.application.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.jobLead.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "demo@jobworkbench.local",
      name: "演示用户",
      passwordHash: hashPassword("demo123456")
    }
  });

  const jobLead = await prisma.jobLead.create({
    data: {
      ownerId: user.id,
      sourceType: SourceType.LINK,
      sourceName: "公司官网",
      sourceUrl: "https://careers.example.com/jobs/pm-ai-platform",
      companyName: "星流智能",
      roleTitle: "AI 产品经理",
      city: "上海",
      seniority: "3-5 年",
      salaryRange: "25k-40k",
      skills: JSON.stringify(["AI 产品设计", "B2C 增长", "数据分析", "Prompt 设计"]),
      responsibilities: JSON.stringify([
        "负责 AI 求职助手产品规划与闭环设计",
        "与设计和工程协作快速迭代 MVP",
        "分析转化漏斗并推动优化"
      ]),
      requirements: JSON.stringify([
        "有 0-1 产品经验",
        "熟悉 LLM 应用场景",
        "具备较强结构化表达能力"
      ]),
      rawContent: "我们正在招聘 AI 产品经理，负责 AI 求职工作台相关产品设计与增长。",
      parsedSummary: "偏 AI 应用方向的产品岗位，强调 0-1 闭环与跨职能推动能力。",
      status: ApplicationStage.READY_TO_APPLY,
      application: {
        create: {
          currentStage: ApplicationStage.READY_TO_APPLY,
          nextAction: "补充作品集中与 AI 相关的项目案例",
          nextActionDueAt: new Date("2026-04-28T12:00:00.000Z"),
          note: "团队方向和个人经历很匹配"
        }
      }
    },
    include: {
      application: true
    }
  });

  const resume = await prisma.resume.create({
    data: {
      ownerId: user.id,
      title: "产品经理-通用版",
      rawText: "3 年互联网产品经验，负责增长与工作流产品，参与 AI 功能探索。",
      fileUrl: "/mock/resume-general.pdf"
    }
  });

  await prisma.resumeTailorRun.create({
    data: {
      resumeId: resume.id,
      jobLeadId: jobLead.id,
      summary: "你的增长与 AI 探索经历契合岗位，但需要更突出 0-1 项目结果。",
      suggestionsJson: JSON.stringify({
        highlights: ["补强 AI 项目指标", "把增长成果前置"],
        keywordGaps: ["Prompt 设计", "跨团队推动"],
        rewriteIdeas: [
          "把负责功能迭代改写为负责从 0 到 1 搭建 AI 求职助手 MVP",
          "在经历中补充量化结果与业务影响"
        ]
      })
    }
  });

  if (jobLead.application) {
    await prisma.event.create({
      data: {
        applicationId: jobLead.application.id,
        eventType: EventType.NOTE,
        title: "初始岗位导入",
        detailsJson: JSON.stringify({
          source: "seed",
          note: "演示数据"
        })
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
