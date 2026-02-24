import { NextResponse } from "next/server";
import { getCompilation, putCompilation } from "@/lib/compiler/store";
import { clearForCompilation } from "@/lib/compiler/mock/store";
import { compileOpenAPI } from "@/lib/compiler/pipeline";
import { computeMultiSpecDiff } from "@/lib/spec/diff";
import { formatMultiSpecDiffForDisplay } from "@/lib/spec/diffFormatters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: { openapi?: string; accountId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errors: [{ code: "PARSE_ERROR", message: "Invalid JSON body" }] },
      { status: 400 }
    );
  }

  const openapi = body.openapi;
  if (typeof openapi !== "string" || !openapi.trim()) {
    return NextResponse.json(
      {
        errors: [
          {
            code: "OAS_PARSE_ERROR",
            stage: "Parse",
            message: "Missing or empty openapi field",
          },
        ],
      },
      { status: 400 }
    );
  }

  const accountId =
    typeof body.accountId === "string" ? body.accountId.trim() : undefined;
  if (!accountId) {
    return NextResponse.json(
      {
        errors: [
          {
            code: "OAS_PARSE_ERROR",
            stage: "Parse",
            message: "Missing accountId",
          },
        ],
      },
      { status: 400 }
    );
  }

  const { id } = await params;
  const entry = getCompilation(id);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.accountId !== accountId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await compileOpenAPI(openapi, {
    source: "api",
    id,
  });

  if (!result.success) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }

  const multiDiff = computeMultiSpecDiff(entry.specs, result.specs);
  const diffFromPrevious = formatMultiSpecDiffForDisplay(
    multiDiff,
    entry.specs,
    result.specs
  );

  const name =
    result.apiIr.api.title || result.resourceNames[0] || "Untitled";

  clearForCompilation(id);
  putCompilation(id, {
    specs: result.specs,
    resourceNames: result.resourceNames,
    resourceSlugs: result.resourceSlugs,
    apiIr: result.apiIr,
    openapiCanonicalHash: result.openapiCanonicalHash,
    accountId,
    name,
    status: "success",
    diffFromPrevious,
  });

  return NextResponse.json({
    id,
    specs: result.specs,
    resourceNames: result.resourceNames,
    resourceSlugs: result.resourceSlugs,
    diffFromPrevious,
  });
}
