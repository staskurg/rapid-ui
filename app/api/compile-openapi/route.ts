import { NextResponse } from "next/server";
import { compileOpenAPI } from "@/lib/compiler/pipeline";
import { putCompilation } from "@/lib/compiler/store";
import { clearForCompilation } from "@/lib/compiler/mock/store";

export async function POST(request: Request) {
  let body: { openapi?: string; accountId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errors: [{ code: "OAS_PARSE_ERROR", stage: "Parse", message: "Invalid JSON body" }] },
      { status: 400 }
    );
  }

  const openapi = body.openapi;
  if (typeof openapi !== "string" || !openapi.trim()) {
    return NextResponse.json(
      { errors: [{ code: "OAS_PARSE_ERROR", stage: "Parse", message: "Missing or empty openapi field" }] },
      { status: 400 }
    );
  }

  const accountId = typeof body.accountId === "string" ? body.accountId : undefined;
  if (!accountId) {
    return NextResponse.json(
      { errors: [{ code: "OAS_PARSE_ERROR", stage: "Parse", message: "Missing accountId" }] },
      { status: 400 }
    );
  }

  const result = await compileOpenAPI(openapi, { source: "api" });

  if (!result.success) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }

  const name =
    result.apiIr.api.title || result.resourceNames[0] || "Untitled";

  clearForCompilation(result.id);
  putCompilation(result.id, {
    specs: result.specs,
    resourceNames: result.resourceNames,
    resourceSlugs: result.resourceSlugs,
    apiIr: result.apiIr,
    openapiCanonicalHash: result.openapiCanonicalHash,
    accountId,
    name,
    status: "success",
  });

  const firstResource = result.resourceSlugs[0] ?? "resource";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = base ? `${base}/u/${result.id}/${firstResource}` : `/u/${result.id}/${firstResource}`;

  return NextResponse.json({
    id: result.id,
    url,
    resourceNames: result.resourceNames,
    specs: result.specs,
  });
}
