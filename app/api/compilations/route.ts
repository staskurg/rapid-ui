import { NextResponse } from "next/server";
import { listCompilationsByAccount } from "@/lib/compiler/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId || typeof accountId !== "string" || !accountId.trim()) {
    return NextResponse.json(
      { error: "Missing accountId" },
      { status: 400 }
    );
  }

  const items = await listCompilationsByAccount(accountId);
  return NextResponse.json({ items });
}
