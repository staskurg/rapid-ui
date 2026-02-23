import { NextRequest, NextResponse } from "next/server";
import { getCompilation } from "@/lib/compiler/store";
import * as mockStore from "@/lib/compiler/mock/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string }> }
) {
  const { id, resource } = await params;

  const entry = getCompilation(id);
  if (!entry) {
    return NextResponse.json({ error: "Compilation not found" }, { status: 404 });
  }

  const spec = entry.specs[resource];
  if (!spec) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const resourceIr = entry.apiIr.resources.find((r) => r.key === resource);
  if (!resourceIr) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const listOp = resourceIr.operations.find((o) => o.kind === "list");
  const listSchema = listOp?.responseSchema ?? { type: "array", items: { type: "object" } };

  const records = mockStore.getRecords(
    id,
    resource,
    listSchema,
    spec,
    entry.openapiCanonicalHash
  );
  return NextResponse.json(records);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string }> }
) {
  const { id, resource } = await params;

  const entry = getCompilation(id);
  if (!entry) {
    return NextResponse.json({ error: "Compilation not found" }, { status: 404 });
  }

  const spec = entry.specs[resource];
  if (!spec) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const resourceIr = entry.apiIr.resources.find((r) => r.key === resource);
  if (!resourceIr) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const listOp = resourceIr.operations.find((o) => o.kind === "list");
  const listSchema = listOp?.responseSchema ?? { type: "array", items: { type: "object" } };

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = mockStore.createRecord(
    id,
    resource,
    listSchema,
    spec,
    entry.openapiCanonicalHash,
    input
  );
  return NextResponse.json(record);
}
