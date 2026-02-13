/**
 * Demo API: GET list, POST create
 * GET /api/demo/[resource]?session={id}&v=1|2|3
 * POST /api/demo/[resource]?session={id}&v=1|2|3
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidResource } from "@/lib/demoStore/resources";
import {
  getRecords,
  createRecord,
} from "@/lib/demoStore/store";
import type { DemoVersion } from "@/lib/demoStore/seeds";

function parseVersion(v: string | null): DemoVersion {
  const n = v ? parseInt(v, 10) : 1;
  if (n >= 1 && n <= 3) return n as DemoVersion;
  return 1;
}

export async function GET(
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
  const records = getRecords(sessionId, resource, version);
  return NextResponse.json(records);
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
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const created = createRecord(sessionId, resource, version, body);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 500 }
    );
  }
}
