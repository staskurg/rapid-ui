import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/** Allowed demo spec filenames (whitelist for security). */
const ALLOWED_NAMES = new Set([
  "golden_openapi_users_tagged_3_0",
  "golden_openapi_products_path_3_1",
  "demo_users_tasks_v1",
  "demo_users_tasks_v2",
  "demo_users_tasks_v3",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const base = name.replace(/\.(yaml|yml|json)$/i, "");
  if (!ALLOWED_NAMES.has(base)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `${base}.yaml`;
  const filepath = join(process.cwd(), "tests", "compiler", "fixtures", filename);

  try {
    const content = await readFile(filepath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/x-yaml",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
