import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/env";
import { reportError } from "@/lib/monitoring";

export async function GET() {
  const runtime = getRuntimeConfig();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "job-hunt-ai-workbench",
      timestamp: new Date().toISOString(),
      runtime: {
        database: runtime.database,
        storage: runtime.storage,
        ai: runtime.ai,
        deployment: runtime.deployment
      }
    });
  } catch (error) {
    await reportError(error, "health.check_failed", {
      route: "/api/health"
    });

    return NextResponse.json(
      {
        ok: false,
        service: "job-hunt-ai-workbench",
        timestamp: new Date().toISOString(),
        runtime: {
          database: runtime.database,
          storage: runtime.storage,
          ai: runtime.ai,
          deployment: runtime.deployment
        }
      },
      { status: 500 }
    );
  }
}
