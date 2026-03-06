#!/usr/bin/env tsx
/**
 * Test script for GitHub Code Search API.
 * Reports result count for each query from the corpus-github-crawl plan.
 *
 * Run: npm run test:github-search
 * Requires: GITHUB_TOKEN in .env.local
 */

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

const QUERIES: { group: string; name: string; q: string }[] = [
  // Group A — Generic (stars removed — not supported for code search)
  // YAML: "paths:" filters out specs with no endpoints
  { group: "generic", name: "openapi.yaml", q: 'filename:openapi.yaml "openapi: 3" "paths:" size:5000..200000' },
  { group: "generic", name: "openapi.yml", q: 'filename:openapi.yml "openapi: 3" "paths:" size:5000..200000' },
  // JSON: "\"openapi\": \"3" ensures OpenAPI 3.x only (excludes 2.0, etc.)
  { group: "generic", name: "openapi.json", q: 'filename:openapi.json "\\"openapi\\": \\"3" size:5000..200000' },
  // Group B — Frameworks (OpenAPI 3 enforced)
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
  for (const r of results) {
    if (r.count >= 0) {
      byGroup.set(r.group, (byGroup.get(r.group) ?? 0) + r.count);
    }
  }
  for (const [group, total] of [...byGroup.entries()].sort()) {
    console.log(`  ${group}: ${total} total (sum of query counts, may have overlap)`);
  }
}

main();
