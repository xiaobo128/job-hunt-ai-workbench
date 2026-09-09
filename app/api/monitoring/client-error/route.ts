import { NextResponse } from "next/server";
import { reportError } from "@/lib/monitoring";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      digest?: string;
      stack?: string;
      pathname?: string;
      source?: string;
    };

    await reportError(
      {
        name: "ClientError",
        message: body.message || "Unknown client error",
        stack: body.stack,
        digest: body.digest
      },
      "client.error_boundary",
      {
        route: body.pathname || null,
        source: body.source || "unknown",
        requestId: request.headers.get("x-vercel-id")
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, "client.error_boundary_report_failed", {
      requestId: request.headers.get("x-vercel-id")
    });

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
