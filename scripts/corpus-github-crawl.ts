#!/usr/bin/env tsx
/**
 * GitHub OpenAPI Spec Crawler
 *
 * Searches GitHub for OpenAPI specs, fetches content, deduplicates, and stores
 * in corpus-github for the corpus pipeline.
 *
 * Run: npm run corpus:github-crawl [--limit N]
 * Requires: GITHUB_TOKEN in .env.local
 * Use --limit N to cap each group at N specs (for quick testing)
 *
 * See .cursor/plans/github_spec_crawler_25fb9b0e.plan.md Phase 2.
 */

import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const GITHUB_API = "https://api.github.com";
const SEARCH_THROTTLE_MS = 7000; // 9 req/min → ~7s between search requests
const CONTENT_DELAY_MS = 100; // Small delay between content fetches
const MAX_SPECS_PER_REPO = 5;
const FETCH_TIMEOUT_MS = 30000; // 30s per request (avoids connect timeout)
const FETCH_MAX_RETRIES = 3;

const CORPUS_GITHUB = join(process.cwd(), "scripts/corpus-data/corpus-github");

// Query groups — same as test-github-search.ts (source of truth)
interface QueryDef {
  group: string;
  name: string;
  q: string;
}

const QUERIES: QueryDef[] = [
  // Group A — Generic
  { group: "generic", name: "openapi.yaml", q: 'filename:openapi.yaml "openapi: 3" "paths:" size:5000..200000' },
  { group: "generic", name: "openapi.yml", q: 'filename:openapi.yml "openapi: 3" "paths:" size:5000..200000' },
  { group: "generic", name: "openapi.json", q: 'filename:openapi.json "\\"openapi\\": \\"3" size:5000..200000' },
  // Group B — Frameworks
  { group: "frameworks", name: "fastapi", q: 'filename:openapi.yaml fastapi "openapi: 3" "paths:"' },
  { group: "frameworks", name: "nestjs", q: 'filename:openapi.json nestjs "\\"openapi\\": \\"3"' },
  { group: "frameworks", name: "springdoc", q: 'filename:openapi.yaml springdoc "openapi: 3" "paths:"' },
  { group: "frameworks", name: "drf-spectacular", q: 'filename:openapi.yaml drf-spectacular "openapi: 3" "paths:"' },
  { group: "frameworks", name: "laravel", q: 'filename:openapi.yaml laravel "openapi: 3" "paths:"' },
  { group: "frameworks", name: "rswag", q: 'filename:openapi.yaml rswag "openapi: 3" "paths:"' },
  { group: "frameworks", name: "tsoa", q: 'filename:openapi.json tsoa "\\"openapi\\": \\"3"' },
  { group: "frameworks", name: "micronaut", q: 'filename:openapi.yaml micronaut "openapi: 3" "paths:"' },
  { group: "frameworks", name: "ktor", q: 'filename:openapi.yaml ktor "openapi: 3" "paths:"' },
  // Group C — Vendors
  { group: "vendors", name: "stripe", q: 'filename:openapi.yaml stripe "openapi"' },
  { group: "vendors", name: "plaid", q: 'filename:openapi.yaml plaid "openapi"' },
  { group: "vendors", name: "adyen", q: 'filename:openapi.yaml adyen "openapi"' },
  { group: "vendors", name: "twilio", q: 'filename:openapi.yaml twilio "openapi"' },
  { group: "vendors", name: "sendgrid", q: 'filename:openapi.yaml sendgrid "openapi"' },
  { group: "vendors", name: "mailgun", q: 'filename:openapi.yaml mailgun "openapi"' },
  { group: "vendors", name: "slack", q: 'filename:openapi.yaml slack "openapi"' },
  { group: "vendors", name: "notion", q: 'filename:openapi.yaml notion "openapi"' },
  { group: "vendors", name: "linear", q: 'filename:openapi.yaml linear "openapi"' },
  { group: "vendors", name: "asana", q: 'filename:openapi.yaml asana "openapi"' },
  { group: "vendors", name: "github", q: 'filename:openapi.yaml github "openapi"' },
  { group: "vendors", name: "gitlab", q: 'filename:openapi.yaml gitlab "openapi"' },
  { group: "vendors", name: "circleci", q: 'filename:openapi.yaml circleci "openapi"' },
  { group: "vendors", name: "vercel", q: 'filename:openapi.yaml vercel "openapi"' },
  { group: "vendors", name: "digitalocean", q: 'filename:openapi.yaml digitalocean "openapi"' },
  { group: "vendors", name: "cloudflare", q: 'filename:openapi.yaml cloudflare "openapi"' },
  { group: "vendors", name: "datadog", q: 'filename:openapi.yaml datadog "openapi"' },
  { group: "vendors", name: "openai", q: 'filename:openapi.yaml openai "openapi"' },
  { group: "vendors", name: "anthropic", q: 'filename:openapi.yaml anthropic "openapi"' },
  { group: "vendors", name: "postman", q: 'filename:openapi.yaml postman "openapi"' },
  { group: "vendors", name: "rapidapi", q: 'filename:openapi.yaml rapidapi "openapi"' },
  // Group D — Optional
  { group: "platforms", name: "postgrest", q: 'filename:openapi.yaml postgrest "openapi"' },
  { group: "platforms", name: "supabase", q: 'filename:openapi.yaml supabase "openapi"' },
  { group: "platforms", name: "hasura", q: 'filename:openapi.yaml hasura "openapi"' },
  { group: "cloud", name: "aws", q: 'filename:openapi.yaml aws "openapi"' },
  { group: "cloud", name: "googleapis", q: 'filename:openapi.yaml googleapis "openapi"' },
  { group: "cloud", name: "azure", q: 'filename:openapi.yaml azure "openapi"' },
  { group: "api-docs", name: "redoc", q: 'filename:openapi.yaml redoc "openapi"' },
  { group: "api-docs", name: "openapi-generator", q: 'filename:openapi.yaml openapi-generator "openapi"' },
];

// Per-group caps
const GROUP_CAPS: Record<string, number> = {
  generic: 200,
  frameworks: 100, // per framework subdir
  vendors: 20, // per vendor, ~200 total across 21 vendors
  platforms: 15,
  cloud: 15,
  "api-docs": 15,
};

interface SearchItem {
  name: string;
  path: string;
  repository: { full_name: string };
}

interface SearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: SearchItem[];
}

async function searchCode(
  token: string,
  q: string,
  page: number,
  perPage: number
): Promise<SearchResponse> {
  const url = new URL(`${GITHUB_API}/search/code`);
  url.searchParams.set("q", q);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const res = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
    console.log(`Rate limited. Waiting ${waitMs / 1000}s...`);
    await sleep(waitMs);
    return searchCode(token, q, page, perPage);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  return res.json();
}

async function fetchRawContent(token: string, owner: string, repo: string, path: string): Promise<string> {
  // Use GitHub Contents API (base64) — more reliable than raw URL with HEAD
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetchWithRetry(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch ${res.status}: ${url}`);
  }
  const data = (await res.json()) as { content?: string; encoding?: string };
  const content = data.content;
  if (!content) throw new Error("No content in response");
  if (data.encoding === "base64") {
    return Buffer.from(content, "base64").toString("utf8");
  }
  return content;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function isOpenAPI3(content: string): boolean {
  const trimmed = content.trim().slice(0, 500);
  return /openapi:\s*["']?3\./i.test(trimmed) || /"openapi"\s*:\s*["']?3\./i.test(trimmed);
}

function safeFilename(owner: string, repo: string, path: string): string {
  const pathPart = path.replace(/\//g, "__");
  return `${owner}__${repo}__${pathPart}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = FETCH_MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt < retries) {
        const waitMs = 2000 * Math.pow(2, attempt);
        console.warn(`  Fetch failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${waitMs / 1000}s...`);
        await sleep(waitMs);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is required. Set it in .env.local or environment.");
    console.error("Create a token at https://github.com/settings/tokens");
    process.exit(1);
  }

  // --limit N: cap each group at N specs (for quick testing)
  let limitOverride: number | null = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limitOverride = parseInt(args[++i], 10);
      break;
    }
  }

  console.log("GitHub OpenAPI Spec Crawler\n");
  console.log(`Output: ${CORPUS_GITHUB}`);
  if (limitOverride != null) console.log(`[TEST MODE] --limit ${limitOverride} per group\n`);
  console.log(`Search rate limit: 9 req/min (throttle ${SEARCH_THROTTLE_MS / 1000}s)\n`);

  const repoSpecCount: Record<string, number> = {};
  const contentHashes = new Set<string>();
  let genericTotal = 0;
  let vendorsTotal = 0;
  const VENDORS_GROUP_CAP = 200;
  const manifest: {
    startedAt: string;
    finishedAt?: string;
    groups: Record<
      string,
      { queries: string[]; downloaded: number; skippedRepo: number; skippedDup: number; repos: string[] }
    >;
  } = {
    startedAt: new Date().toISOString(),
    groups: {},
  };

  for (const { group, name, q } of QUERIES) {
    const groupKey = group === "frameworks" || group === "vendors" ? `${group}/${name}` : group;
    if (!manifest.groups[groupKey]) {
      manifest.groups[groupKey] = { queries: [], downloaded: 0, skippedRepo: 0, skippedDup: 0, repos: [] };
    }
    manifest.groups[groupKey].queries.push(q);

    // Generic: 200 total across all 3 queries; vendors: 200 total across all vendor queries
    if (group === "generic" && genericTotal >= GROUP_CAPS.generic) continue;
    if (group === "vendors" && vendorsTotal >= VENDORS_GROUP_CAP) continue;

    let cap =
      group === "generic"
        ? GROUP_CAPS.generic - genericTotal
        : group === "frameworks" || group === "vendors"
          ? Math.min(GROUP_CAPS[group] ?? 100, group === "vendors" ? VENDORS_GROUP_CAP - vendorsTotal : 999)
          : GROUP_CAPS[group] ?? 200;
    if (limitOverride != null) cap = Math.min(cap, limitOverride);
    if (cap <= 0) continue;
    const storageDir =
      group === "frameworks"
        ? join(CORPUS_GITHUB, "group-frameworks", name)
        : group === "vendors"
          ? join(CORPUS_GITHUB, "group-vendors")
          : group === "platforms"
            ? join(CORPUS_GITHUB, "group-platforms")
            : group === "cloud"
              ? join(CORPUS_GITHUB, "group-cloud")
              : group === "api-docs"
                ? join(CORPUS_GITHUB, "group-api-docs")
                : join(CORPUS_GITHUB, "group-generic");

    mkdirSync(storageDir, { recursive: true });

    let downloaded = 0;
    let skippedRepo = 0;
    let skippedDup = 0;
    let page = 1;
    const seenInThisQuery = new Set<string>(); // repo+path for this query

    console.log(`\n--- ${groupKey} (cap ${cap}) ---`);

    while (downloaded < cap) {
      const data = await searchCode(token, q, page, 100);
      const items = data.items ?? [];

      if (items.length === 0) break;

      for (const item of items) {
        if (downloaded >= cap) break;

        const fullName = item.repository?.full_name ?? "";
        const path = item.path ?? item.name ?? "";
        if (!fullName || !path) continue;

        // Only accept .yaml, .yml, .json (GitHub search can return .yaml.txt etc.)
        const ext = path.toLowerCase().slice(path.lastIndexOf("."));
        if (![".yaml", ".yml", ".json"].includes(ext)) continue;

        const [owner, repo] = fullName.split("/");
        if (!owner || !repo) continue;

        const key = `${fullName}:${path}`;
        if (seenInThisQuery.has(key)) continue;
        seenInThisQuery.add(key);

        if ((repoSpecCount[fullName] ?? 0) >= MAX_SPECS_PER_REPO) {
          skippedRepo++;
          continue;
        }

        try {
          await sleep(CONTENT_DELAY_MS);
          const content = await fetchRawContent(token, owner, repo, path);
          const hash = sha256(content);

          if (contentHashes.has(hash)) {
            skippedDup++;
            continue;
          }

          if (!isOpenAPI3(content)) {
            continue; // Skip Swagger 2.0 etc.
          }

          contentHashes.add(hash);
          repoSpecCount[fullName] = (repoSpecCount[fullName] ?? 0) + 1;

          const filename = safeFilename(owner, repo, path);
          const filepath = join(storageDir, filename);
          writeFileSync(filepath, content, "utf8");
          downloaded++;

          if (!manifest.groups[groupKey].repos.includes(fullName)) {
            manifest.groups[groupKey].repos.push(fullName);
          }

          if (downloaded % 10 === 0 || downloaded === cap) {
            process.stdout.write(`  ${downloaded}/${cap}\r`);
          }
        } catch {
          // Skip failed fetches
        }
      }

      if (items.length < 100) break;
      page++;
      await sleep(SEARCH_THROTTLE_MS);
    }

    manifest.groups[groupKey].downloaded += downloaded;
    manifest.groups[groupKey].skippedRepo += skippedRepo;
    manifest.groups[groupKey].skippedDup += skippedDup;
    if (group === "generic") genericTotal += downloaded;
    if (group === "vendors") vendorsTotal += downloaded;

    console.log(`  Downloaded: ${downloaded}, skipped (repo limit): ${skippedRepo}, skipped (dup): ${skippedDup}`);

    await sleep(SEARCH_THROTTLE_MS);
  }

  manifest.finishedAt = new Date().toISOString();

  const manifestPath = join(CORPUS_GITHUB, "corpus-github-manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`\nManifest: ${manifestPath}`);
  console.log("Done.");
}

main();
