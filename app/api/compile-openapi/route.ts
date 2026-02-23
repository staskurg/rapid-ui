import { NextResponse } from "next/server";
import { compileOpenAPI } from "@/lib/compiler/pipeline";
import { putCompilation } from "@/lib/compiler/store";
import { isGoldenSpec } from "@/lib/compiler/mock/fixtures";
import { clearForCompilation } from "@/lib/compiler/mock/store";

export async function POST(request: Request) {
  let body: { openapi?: string; sessionId?: string };
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

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
  const result = await compileOpenAPI(openapi, { source: "api", sessionId });

  if (!result.success) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }

  if (!isGoldenSpec(result.openapiCanonicalHash)) {
    return NextResponse.json(
      {
        errors: [
          {
            code: "UNSUPPORTED_SPEC",
            stage: "Compile",
            message:
              "Only demo specs supported. Use golden_openapi_users_tagged_3_0.yaml or golden_openapi_products_path_3_1.yaml.",
          },
        ],
      },
      { status: 422 }
    );
  }

  clearForCompilation(result.id);
  putCompilation(result.id, {
    specs: result.specs,
    resourceNames: result.resourceNames,
    resourceSlugs: result.resourceSlugs,
    apiIr: result.apiIr,
    openapiCanonicalHash: result.openapiCanonicalHash,
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
