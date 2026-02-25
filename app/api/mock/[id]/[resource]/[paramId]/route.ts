import { NextRequest, NextResponse } from "next/server";
import { getCompilation } from "@/lib/compiler/store";
import * as mockStore from "@/lib/compiler/mock/store";
import type { JsonSchema } from "@/lib/compiler/apiir/types";
import type { UISpec } from "@/lib/spec/types";

async function getResourceContext(
  id: string,
  resource: string
): Promise<
  | {
      accountId: string;
      spec: UISpec;
      listSchema: JsonSchema;
      openapiCanonicalHash: string;
    }
  | { error: string; status: number }
> {
  const entry = await getCompilation(id);
  if (!entry) return { error: "Compilation not found", status: 404 };

  const accountId = entry.accountId;
  if (!accountId) return { error: "Compilation has no account", status: 400 };

  const spec = entry.specs[resource];
  if (!spec) return { error: "Resource not found", status: 404 };

  const resourceIr = entry.apiIr.resources.find((r) => r.key === resource);
  if (!resourceIr) return { error: "Resource not found", status: 404 };

  const listOp = resourceIr.operations.find((o) => o.kind === "list");
  const listSchema = listOp?.responseSchema ?? { type: "array", items: { type: "object" } };

  return {
    accountId,
    spec,
    listSchema,
    openapiCanonicalHash: entry.openapiCanonicalHash,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string; paramId: string }> }
) {
  const { id, resource, paramId } = await params;

  const ctx = await getResourceContext(id, resource);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const record = mockStore.getById(
    ctx.accountId,
    id,
    resource,
    ctx.listSchema,
    ctx.spec,
    ctx.openapiCanonicalHash,
    paramId
  );
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string; paramId: string }> }
) {
  const { id, resource, paramId } = await params;

  const ctx = await getResourceContext(id, resource);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = mockStore.updateRecord(
    ctx.accountId,
    id,
    resource,
    ctx.listSchema,
    ctx.spec,
    ctx.openapiCanonicalHash,
    paramId,
    input
  );
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string; paramId: string }> }
) {
  const { id, resource, paramId } = await params;

  const ctx = await getResourceContext(id, resource);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const ok = mockStore.deleteRecord(
    ctx.accountId,
    id,
    resource,
    ctx.listSchema,
    ctx.spec,
    ctx.openapiCanonicalHash,
    paramId
  );
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
