/**
 * Demo API: POST reset
 * Restores session data to seed state.
 * POST /api/demo/[resource]/reset?session={id}&v=1|2|3
 * No body required.
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidResource } from "@/lib/demoStore/resources";
import { resetSession } from "@/lib/demoStore/store";
import type { DemoVersion } from "@/lib/demoStore/seeds";

function parseVersion(v: string | null): DemoVersion {
  const n = v ? parseInt(v, 10) : 1;
  if (n >= 1 && n <= 3) return n as DemoVersion;
  return 1;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource } = await params;
  if (!isValidResource(resource)) {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 404 });
  }
  const sessionId = request.nextUrl.searchParams.get("session") ?? "";
  const version = parseVersion(request.nextUrl.searchParams.get("v"));
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
  }
  resetSession(sessionId, resource, version);
  return new NextResponse(null, { status: 204 });
}
