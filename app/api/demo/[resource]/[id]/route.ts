/**
 * Demo API: GET one, PUT update, DELETE
 * GET /api/demo/[resource]/[id]?session={id}&v=1|2|3
 * PUT /api/demo/[resource]/[id]?session={id}&v=1|2|3
 * DELETE /api/demo/[resource]/[id]?session={id}&v=1|2|3
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidResource } from "@/lib/demoStore/resources";
import {
  getRecordById,
  updateRecord,
  deleteRecord,
} from "@/lib/demoStore/store";
import type { DemoVersion } from "@/lib/demoStore/seeds";

function parseVersion(v: string | null): DemoVersion {
  const n = v ? parseInt(v, 10) : 1;
  if (n >= 1 && n <= 3) return n as DemoVersion;
  return 1;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  if (!isValidResource(resource)) {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 404 });
  }
  const sessionId = request.nextUrl.searchParams.get("session") ?? "";
  const version = parseVersion(request.nextUrl.searchParams.get("v"));
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
  }
  const record = getRecordById(sessionId, resource, version, id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
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
  const updated = updateRecord(sessionId, resource, version, id, body);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  if (!isValidResource(resource)) {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 404 });
  }
  const sessionId = request.nextUrl.searchParams.get("session") ?? "";
  const version = parseVersion(request.nextUrl.searchParams.get("v"));
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
  }
  const deleted = deleteRecord(sessionId, resource, version, id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
