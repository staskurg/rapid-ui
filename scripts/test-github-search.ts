#!/usr/bin/env tsx
/**
 * Test script for GitHub Code Search API.
 * Reports result count for each query from corpus-github-queries.ts.
 *
 * Use this to validate queries before running the crawler. Queries hitting 1000
 * are capped by GitHub; path-based splits provide granularity to get more.
 *
 * Run: npm run test:github-search
 * Requires: GITHUB_TOKEN in .env.local
 */

import { QUERIES } from "./corpus-github-queries";

const GITHUB_API = "https://api.github.com";
const THROTTLE_MS = 7000; // 9 req/min → ~7s between requests

async function searchCode(
  token: string,
  q: string,
  page = 1,
  perPage = 1
): Promise<{ total_count: number; incomplete_results: boolean }> {
  const url = new URL(`${GITHUB_API}/search/code`);
  url.searchParams.set("q", q);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return { total_count: data.total_count, incomplete_results: data.incomplete_results };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is required. Set it in .env.local");
    process.exit(1);
  }

  console.log("GitHub Code Search — result counts per query\n");
  console.log(`Rate limit: 9 req/min. Throttling ${THROTTLE_MS / 1000}s between requests.\n`);

  const results: { group: string; name: string; count: number; incomplete: boolean; error?: string }[] = [];

  for (let i = 0; i < QUERIES.length; i++) {
    const { group, name, q } = QUERIES[i];
    const progress = `[${i + 1}/${QUERIES.length}]`;

    try {
      const data = await searchCode(token, q, 1, 1);
      results.push({ group, name, count: data.total_count, incomplete: data.incomplete_results });
      console.log(`${progress} ${group}/${name}: ${data.total_count}${data.incomplete_results ? " (incomplete)" : ""}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ group, name, count: -1, incomplete: false, error: msg });
      console.log(`${progress} ${group}/${name}: ERROR ${msg}`);
    }

    if (i < QUERIES.length - 1) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }
  }

  // Summary by group
  console.log("\n--- Summary by group ---");
  const byGroup = new Map<string, number>();
  const hitLimit = results.filter((r) => r.count >= 1000 || r.incomplete);
  for (const r of results) {
    if (r.count >= 0) {
      byGroup.set(r.group, (byGroup.get(r.group) ?? 0) + r.count);
    }
  }
  for (const [group, total] of [...byGroup.entries()].sort()) {
    console.log(`  ${group}: ${total} total (sum of query counts, may have overlap)`);
  }
  if (hitLimit.length > 0) {
    console.log(`\n--- Queries at 1000 limit (${hitLimit.length}) ---`);
    for (const r of hitLimit) {
      console.log(`  ${r.group}/${r.name}: ${r.count}${r.incomplete ? " (incomplete)" : ""}`);
    }
  }
}

main();
