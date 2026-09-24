import { NextResponse } from "next/server";
import { z, type ZodTypeAny } from "zod";
import { authenticateAgentRequest } from "@/lib/agent-auth";

export async function requireAgentAuth() {
  const apiToken = await authenticateAgentRequest();

  if (!apiToken) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    };
  }

  return {
    ok: true as const,
    apiToken,
    user: apiToken.user
  };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: "bad_request",
      message,
      details
    },
    { status: 400 }
  );
}

export function zodBadRequest(error: z.ZodError) {
  return badRequest("Request validation failed.", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code
    }))
  });
}

export function serverError(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "server_error",
      message
    },
    { status: 500 }
  );
}

export async function parseAgentJson<TSchema extends ZodTypeAny>(request: Request, schema: TSchema) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false as const,
      response: badRequest("Request body must be valid JSON.")
    };
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false as const,
      response: zodBadRequest(parsed.error)
    };
  }

  return {
    ok: true as const,
    data: parsed.data
  };
}
