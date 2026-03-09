#!/usr/bin/env tsx
/**
 * GitHub OpenAPI Spec Crawler
 *
 * Searches GitHub for OpenAPI specs, fetches content, deduplicates, and stores
 * in scripts/corpus-data/specs/github for the corpus pipeline.
 *
 * Run: npm run corpus:github-crawl [--limit N] [--group NAME]
 * Requires: GITHUB_TOKEN in .env.local
 * Use --limit N to cap each group at N specs (for quick testing)
 * Use --group NAME to run only a specific group (e.g. frameworks, frameworks/laravel, generic, crud)
 *
 * See .cursor/plans/github_spec_crawler_25fb9b0e.plan.md Phase 2.
 */

import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { QUERIES } from "./corpus-github-queries";

const GITHUB_API = "https://api.github.com";
const SEARCH_THROTTLE_MS = 7000; // 9 req/min → ~7s between search requests
const CONTENT_DELAY_MS = 100; // Small delay between content fetches
const MAX_SPECS_PER_REPO = 5;
const FETCH_TIMEOUT_MS = 30000; // 30s per request (avoids connect timeout)
const FETCH_MAX_RETRIES = 3;

const SPECS_OUTPUT = join(process.cwd(), "scripts/corpus-data/specs/github");

// Per-query caps — each query contributes up to cap; increases diversity across path/version/format
const PER_QUERY_CAPS: Record<string, number> = {
  generic: 400, // 21 queries × 400 = 8400; yaml/yml/json, path splits, 3.0/3.1
  frameworks: 400, // 4 frameworks × 400 = 1600; fastapi, springdoc, laravel, ktor
  crud: 400, // 5 queries × 400 = 2000; users, orders, projects, products, tasks
  vendors: 50, // 21 vendors × 50 = 1050; stripe, github, openai, etc.
  platforms: 50, // 3 × 50 = 150; postgrest, supabase, hasura
  cloud: 50, // 3 × 50 = 150; aws, googleapis, azure
  "api-docs": 50, // 2 × 50 = 100; redoc, openapi-generator
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

  // GitHub code search returns max 1000 results; pagination beyond page 10 returns 422.
  // We handle this gracefully: log, return empty items (we already have up to 1000 from prior pages), continue crawling.
  if (res.status === 422) {
    const body = await res.text();
    if (body.includes("Cannot access beyond the first 1000 results")) {
      console.log(`  [Hit 1000-result limit, stopping pagination for this query]`);
      return { total_count: 1000, incomplete_results: true, items: [] };
    }
    throw new Error(`GitHub API ${res.status}: ${body}`);
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

/** CRUD operation score: post + put + delete. Read-only APIs have crudScore 0. Handles YAML (post:) and JSON ("post":). */
function detectCrudScore(content: string): { get: number; post: number; put: number; delete: number; crudScore: number } {
  const lower = content.toLowerCase();
  const count = (yaml: RegExp, json: RegExp) =>
    (lower.match(yaml) || []).length + (lower.match(json) || []).length;
  const score = {
    get: count(/\bget:\s/g, /"get"\s*:/g),
    post: count(/\bpost:\s/g, /"post"\s*:/g),
    put: count(/\bput:\s/g, /"put"\s*:/g),
    delete: count(/\bdelete:\s/g, /"delete"\s*:/g),
  };
  return {
    ...score,
    crudScore: score.post + score.put + score.delete,
  };
}

/** Detect list + detail pattern: /resource with get: and /resource/{id} with get: */
function detectResourcePattern(content: string): boolean {
  return /\/[a-z0-9-]+:\s*\n\s+get:/i.test(content) && /\/[a-z0-9-]+\/\{[^}]+\}:/i.test(content);
}

const MIN_CRUD_SCORE = 2; // Require at least 2 write ops (post/put/delete) to filter read-only APIs

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
  // --no-crud-filter: skip CRUD score filter (saves read-only APIs too)
  // --group NAME: run only queries for this group (e.g. frameworks, frameworks/laravel)
  let limitOverride: number | null = null;
  let crudFilterEnabled = true;
  let groupFilter: string | null = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limitOverride = parseInt(args[++i], 10);
    } else if (args[i] === "--no-crud-filter") {
      crudFilterEnabled = false;
    } else if (args[i] === "--group" && args[i + 1]) {
      groupFilter = args[++i];
    }
  }

  console.log("GitHub OpenAPI Spec Crawler\n");
  console.log(`Output: ${SPECS_OUTPUT}`);
  if (limitOverride != null) console.log(`[TEST MODE] --limit ${limitOverride} per group\n`);
  if (groupFilter) console.log(`[GROUP FILTER] --group ${groupFilter}\n`);
  if (!crudFilterEnabled) console.log(`[CRUD filter disabled] --no-crud-filter\n`);
  console.log(`Search rate limit: 9 req/min (throttle ${SEARCH_THROTTLE_MS / 1000}s)\n`);

  const repoSpecCount: Record<string, number> = {};
  const contentHashes = new Set<string>();
  const manifest: {
    startedAt: string;
    finishedAt?: string;
    groups: Record<
      string,
      { queries: string[]; downloaded: number; skippedRepo: number; skippedDup: number; skippedCrud: number; repos: string[] }
    >;
  } = {
    startedAt: new Date().toISOString(),
    groups: {},
  };

  const queriesToRun = groupFilter
    ? QUERIES.filter(({ group, name }) => {
        const groupKey = group === "frameworks" || group === "vendors" || group === "crud" ? `${group}/${name}` : group;
        return groupKey === groupFilter || group === groupFilter;
      })
    : QUERIES;

  if (groupFilter && queriesToRun.length === 0) {
    console.error(`No queries match --group ${groupFilter}. Valid groups: frameworks, frameworks/laravel, generic, crud, vendors, etc.`);
    process.exit(1);
  }

  for (const { group, name, q } of queriesToRun) {
    const groupKey = group === "frameworks" || group === "vendors" || group === "crud" ? `${group}/${name}` : group;
    if (!manifest.groups[groupKey]) {
      manifest.groups[groupKey] = { queries: [], downloaded: 0, skippedRepo: 0, skippedDup: 0, skippedCrud: 0, repos: [] };
    }
    manifest.groups[groupKey].queries.push(q);

    const applyCrudFilter = group === "generic" || group === "frameworks" || group === "crud";

    // All groups use per-query caps from PER_QUERY_CAPS
    const baseCap = PER_QUERY_CAPS[group] ?? 100;
    const cap = limitOverride != null ? Math.min(baseCap, limitOverride) : baseCap;
    if (cap <= 0) continue;
    const storageDir =
      group === "frameworks"
        ? join(SPECS_OUTPUT, "group-frameworks", name)
        : group === "crud"
          ? join(SPECS_OUTPUT, "group-crud")
          : group === "vendors"
            ? join(SPECS_OUTPUT, "group-vendors")
            : group === "platforms"
              ? join(SPECS_OUTPUT, "group-platforms")
              : group === "cloud"
                ? join(SPECS_OUTPUT, "group-cloud")
                : group === "api-docs"
                  ? join(SPECS_OUTPUT, "group-api-docs")
                  : join(SPECS_OUTPUT, "group-generic");

    mkdirSync(storageDir, { recursive: true });

    let downloaded = 0;
    let skippedRepo = 0;
    let skippedDup = 0;
    let page = 1;
    const seenInThisQuery = new Set<string>(); // repo+path for this query

    const queryLabel = groupKey !== name ? `${groupKey}/${name}` : groupKey;
    console.log(`\n--- ${queryLabel} (cap ${cap}) ---`);

    while (downloaded < cap) {
      console.log(`  [${name}] Searching page ${page}...`);
      const data = await searchCode(token, q, page, 100);
      const items = data.items ?? [];
      console.log(`  [${name}] Got ${items.length} items`);

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

          if (applyCrudFilter) {
            const { crudScore } = detectCrudScore(content);
            const hasResourcePattern = detectResourcePattern(content);
            // Require crudScore >= 2, or crudScore >= 1 with list+detail path pattern
            const passesCrudFilter =
              crudScore >= MIN_CRUD_SCORE || (crudScore >= 1 && hasResourcePattern);
            if (!passesCrudFilter) {
              manifest.groups[groupKey].skippedCrud++;
              continue; // Filter out read-only APIs
            }
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
    const skippedCrud = manifest.groups[groupKey].skippedCrud ?? 0;

    console.log(`  Downloaded: ${downloaded}, skipped (repo limit): ${skippedRepo}, skipped (dup): ${skippedDup}${applyCrudFilter ? `, skipped (low CRUD): ${skippedCrud}` : ""}`);

    await sleep(SEARCH_THROTTLE_MS);
  }

  manifest.finishedAt = new Date().toISOString();

  const manifestPath = join(SPECS_OUTPUT, "corpus-github-manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`\nManifest: ${manifestPath}`);
  console.log("Done.");
}

main();
