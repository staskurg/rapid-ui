import { NextResponse } from "next/server";
import { getCompilation } from "@/lib/compiler/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = getCompilation(id);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    specs: entry.specs,
    resourceNames: entry.resourceNames,
    resourceSlugs: entry.resourceSlugs,
  });
}
