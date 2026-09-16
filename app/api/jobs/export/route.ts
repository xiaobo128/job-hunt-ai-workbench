import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getStageDisplayLabel } from "@/lib/constants";
import { getCurrentJobItem } from "@/lib/job-current-item";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";

const headers = ["序号", "公司", "岗位", "Base", "来源", "当前进度", "当前事项", "投递时间", "最近事件", "最近事件时间", "历史通知数", "备注"];

export async function GET() {
  const user = await requireSessionUser();
  const applications = await prisma.application.findMany({
    where: { jobLead: { ownerId: user.id } },
    select: {
      currentStage: true,
      appliedAt: true,
      nextAction: true,
      note: true,
      createdAt: true,
      jobLead: { select: { companyName: true, roleTitle: true, city: true, sourceName: true } },
      events: {
        select: { eventType: true, title: true, eventTime: true, createdAt: true },
        orderBy: [{ eventTime: "desc" }, { createdAt: "desc" }]
      },
      _count: { select: { events: true } }
    },
    orderBy: { createdAt: "asc" }
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("求职记录", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [8, 22, 30, 16, 20, 14, 32, 20, 32, 20, 14, 32].map((width) => ({ width }));

  applications.forEach((application, index) => {
    const latestEvent = application.events[0];
    sheet.addRow([
      index + 1,
      application.jobLead.companyName,
      application.jobLead.roleTitle,
      application.jobLead.city ?? "",
      application.jobLead.sourceName ?? "",
      getStageDisplayLabel(application.currentStage),
      getCurrentJobItem(application).text,
      formatDateTime(application.appliedAt),
      latestEvent?.title.trim() ?? "",
      formatDateTime(latestEvent?.eventTime ?? latestEvent?.createdAt ?? null),
      application._count.events,
      application.note?.trim() ?? ""
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `我的求职记录_${formatFileDate(new Date())}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store"
    }
  });
}

function formatDateTime(value: Date | null) {
  if (!value) return "";
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatFileDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
