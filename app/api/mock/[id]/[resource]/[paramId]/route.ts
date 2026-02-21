import { NextRequest, NextResponse } from "next/server";
import { getCompilation } from "@/lib/compiler/store";
import * as mockStore from "@/lib/compiler/mock/store";
import type { JsonSchema } from "@/lib/compiler/apiir/types";
import type { UISpec } from "@/lib/spec/types";

function getResourceContext(
  id: string,
  resource: string
): { spec: UISpec; listSchema: JsonSchema } | { error: string; status: number } {
  const entry = getCompilation(id);
  if (!entry) return { error: "Compilation not found", status: 404 };

  const spec = entry.specs[resource];
  if (!spec) return { error: "Resource not found", status: 404 };

  const resourceIr = entry.apiIr.resources.find((r) => r.key === resource);
  if (!resourceIr) return { error: "Resource not found", status: 404 };

  const listOp = resourceIr.operations.find((o) => o.kind === "list");
  const listSchema = listOp?.responseSchema ?? { type: "array", items: { type: "object" } };

  return { spec, listSchema };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string; paramId: string }> }
) {
  const { id, resource, paramId } = await params;
  const sessionId = request.nextUrl.searchParams.get("session") ?? "default";

  const ctx = getResourceContext(id, resource);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const record = mockStore.getById(id, sessionId, resource, ctx.listSchema, ctx.spec, paramId);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string; paramId: string }> }
) {
  const { id, resource, paramId } = await params;
  const sessionId = request.nextUrl.searchParams.get("session") ?? "default";

  const ctx = getResourceContext(id, resource);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = mockStore.updateRecord(id, sessionId, resource, ctx.listSchema, ctx.spec, paramId, input);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string; paramId: string }> }
) {
  const { id, resource, paramId } = await params;
  const sessionId = request.nextUrl.searchParams.get("session") ?? "default";

  const ctx = getResourceContext(id, resource);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const ok = mockStore.deleteRecord(id, sessionId, resource, ctx.listSchema, ctx.spec, paramId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
