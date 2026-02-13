/**
 * Demo API: GET seed sample (no session)
 * Used for spec generation only. Returns immutable seed data.
 * GET /api/demo/[resource]/sample?v=1|2|3
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidResource } from "@/lib/demoStore/resources";
import { getSeedSample } from "@/lib/demoStore/seeds";
import type { DemoVersion } from "@/lib/demoStore/seeds";

function parseVersion(v: string | null): DemoVersion {
  const n = v ? parseInt(v, 10) : 1;
  if (n >= 1 && n <= 3) return n as DemoVersion;
  return 1;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource } = await params;
  if (!isValidResource(resource)) {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 404 });
  }
  const version = parseVersion(request.nextUrl.searchParams.get("v"));
  const sample = getSeedSample(resource, version);
  return NextResponse.json(sample);
}
