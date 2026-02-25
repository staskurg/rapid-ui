import { NextResponse } from "next/server";
import { getCompilation, deleteCompilation } from "@/lib/compiler/store";
import { clearForCompilation } from "@/lib/compiler/mock/store";
import { isPredefinedSpec } from "@/lib/compiler/mock/fixtures";

function getAccountId(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  return accountId && typeof accountId === "string" && accountId.trim()
    ? accountId.trim()
    : null;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accountId = getAccountId(request);
  if (!accountId) {
    return badRequest("Missing accountId");
  }

  const { id } = await params;
  const entry = getCompilation(id);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.accountId !== accountId) {
    return forbidden();
  }

  return NextResponse.json({
    id,
    specs: entry.specs,
    resourceNames: entry.resourceNames,
    resourceSlugs: entry.resourceSlugs,
    apiIr: entry.apiIr,
    name: entry.name,
    status: entry.status ?? "success",
    diffFromPrevious: entry.diffFromPrevious,
    isPredefined: isPredefinedSpec(entry.openapiCanonicalHash),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accountId = getAccountId(request);
  if (!accountId) {
    return badRequest("Missing accountId");
  }

  const { id } = await params;
  const entry = getCompilation(id);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.accountId !== accountId) {
    return forbidden();
  }

  clearForCompilation(accountId, id, entry.openapiCanonicalHash);
  deleteCompilation(id);
  return new Response(null, { status: 204 });
}
