/**
 * Proxy API for external API preview.
 * POST { url, dataPath? } — fetches URL and returns extracted array.
 * Security: URL validation, SSRF protection, 10s timeout, 30 req/min per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractArrayFromResponse } from "@/lib/utils/extractDataPath";
import { validateProxyUrl } from "@/lib/utils/urlValidation";

const TIMEOUT_MS = 10_000;
const RATE_LIMIT_PER_MIN = 30;

// In-memory rate limit: IP -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) {
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: { url?: string; dataPath?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json(
      { error: "Missing url in request body" },
      { status: 400 }
    );
  }

  const validation = validateProxyUrl(url);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error ?? "Invalid URL" },
      { status: 400 }
    );
  }

  const dataPath =
    typeof body.dataPath === "string" && body.dataPath.trim()
      ? body.dataPath.trim()
      : undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "RapidUI/1.0 (https://rapidui.dev)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Upstream did not return JSON" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const array = extractArrayFromResponse(data, dataPath);

    return NextResponse.json(array);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timed out" },
          { status: 504 }
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to fetch external URL" },
      { status: 502 }
    );
  }
}
