/**
 * Shared GitHub Code Search queries for OpenAPI spec discovery.
 *
 * Source of truth for both test-github-search.ts and corpus-github-crawl.ts.
 *
 * Design:
 * - Targets OpenAPI 3.0.x and 3.1.x (RUS-v1 compatible)
 * - CRUD signals (post/put/delete) favor internal backends over read-only APIs
 * - Path-based splits bypass GitHub's 1000-result limit per query
 * - Size filter (5KB–200KB) excludes tiny stubs and huge generated specs
 */

export interface QueryDef {
  group: string;
  name: string;
  q: string;
}

/** Common path prefixes for OpenAPI specs — used to split high-volume queries beyond 1000 results. */
const PATH_PREFIXES = ['api/', 'docs/', 'spec/', 'specs/', 'openapi/'] as const;

/** Base query fragments (CRUD signals for RapidUI fit). */
const OPENAPI3_YAML = '"openapi: 3" "paths:"';
const CRUD_POST = '"post:"';
const CRUD_PUT = '"put:"';
const SIZE_RANGE = 'size:5000..200000';

/** Version-specific fragments for 3.0.x vs 3.1.x — bypasses 1000 limit and balances version diversity. */
const OPENAPI30_YAML = '"openapi: 3.0" "paths:"';
const OPENAPI31_YAML = '"openapi: 3.1" "paths:"';
const OPENAPI30_JSON = '"\\"openapi\\": \\"3.0"';

function buildGenericQueries(): QueryDef[] {
  const queries: QueryDef[] = [];

  // YAML/yml: path splits + version splits (json excluded — returns 0–6 per query in test run)
  const yamlFormats = [
    {
      ext: 'yaml',
      openapi: OPENAPI3_YAML,
      openapi30: OPENAPI30_YAML,
      openapi31: OPENAPI31_YAML,
      crud: CRUD_POST,
    },
    {
      ext: 'yml',
      openapi: OPENAPI3_YAML,
      openapi30: OPENAPI30_YAML,
      openapi31: OPENAPI31_YAML,
      crud: CRUD_PUT,
    },
  ] as const;

  for (const fmt of yamlFormats) {
    for (const pathPrefix of PATH_PREFIXES) {
      queries.push({
        group: 'generic',
        name: `openapi.${fmt.ext}-path-${pathPrefix.replace('/', '')}`,
        q: `filename:openapi.${fmt.ext} path:${pathPrefix} ${fmt.openapi} ${fmt.crud} ${SIZE_RANGE}`,
      });
    }
    queries.push({
      group: 'generic',
      name: `openapi.${fmt.ext}-3.0`,
      q: `filename:openapi.${fmt.ext} ${fmt.openapi30} ${fmt.crud} ${SIZE_RANGE}`,
    });
    queries.push({
      group: 'generic',
      name: `openapi.${fmt.ext}-3.1`,
      q: `filename:openapi.${fmt.ext} ${fmt.openapi31} ${fmt.crud} ${SIZE_RANGE}`,
    });
  }

  // JSON: only 3.0 (78 results); path splits and 3.1 return 0–6
  queries.push({
    group: 'generic',
    name: 'openapi.json-3.0',
    q: `filename:openapi.json ${OPENAPI30_JSON} ${CRUD_POST} ${SIZE_RANGE}`,
  });

  return queries;
}

function buildFrameworkQueries(): QueryDef[] {
  // Excluded (0–5 results in test): nestjs, tsoa, drf-spectacular, rswag, micronaut
  return [
    {
      group: 'frameworks',
      name: 'fastapi',
      q: `filename:openapi.yaml fastapi ${OPENAPI3_YAML} ${CRUD_POST}`,
    },
    {
      group: 'frameworks',
      name: 'springdoc',
      q: `filename:openapi.yaml springdoc ${OPENAPI3_YAML} ${CRUD_POST}`,
    },
    {
      group: 'frameworks',
      name: 'laravel',
      q: `filename:openapi.yaml laravel ${OPENAPI3_YAML} ${CRUD_POST}`,
    },
    {
      group: 'frameworks',
      name: 'ktor',
      q: `filename:openapi.yaml ktor ${OPENAPI3_YAML} ${CRUD_POST}`,
    },
  ];
}

function buildCrudQueries(): QueryDef[] {
  const resources = ['users', 'orders', 'projects', 'products', 'tasks'] as const;
  return resources.map((r) => ({
    group: 'crud',
    name: `${r}-api`,
    q: `filename:openapi.yaml "${r}:" ${CRUD_POST} "paths:" "openapi: 3"`,
  }));
}

function buildVendorQueries(): QueryDef[] {
  const vendors = [
    'stripe',
    'plaid',
    'adyen',
    'twilio',
    'sendgrid',
    'mailgun',
    'slack',
    'notion',
    'linear',
    'asana',
    'github',
    'gitlab',
    'circleci',
    'vercel',
    'digitalocean',
    'cloudflare',
    'datadog',
    'openai',
    'anthropic',
    'postman',
    'rapidapi',
  ] as const;
  return vendors.map((v) => ({
    group: 'vendors',
    name: v,
    q: `filename:openapi.yaml ${v} "openapi"`,
  }));
}

function buildOptionalQueries(): QueryDef[] {
  return [
    { group: 'platforms', name: 'postgrest', q: 'filename:openapi.yaml postgrest "openapi"' },
    { group: 'platforms', name: 'supabase', q: 'filename:openapi.yaml supabase "openapi"' },
    { group: 'platforms', name: 'hasura', q: 'filename:openapi.yaml hasura "openapi"' },
    { group: 'cloud', name: 'aws', q: 'filename:openapi.yaml aws "openapi"' },
    { group: 'cloud', name: 'googleapis', q: 'filename:openapi.yaml googleapis "openapi"' },
    { group: 'cloud', name: 'azure', q: 'filename:openapi.yaml azure "openapi"' },
    { group: 'api-docs', name: 'redoc', q: 'filename:openapi.yaml redoc "openapi"' },
    {
      group: 'api-docs',
      name: 'openapi-generator',
      q: 'filename:openapi.yaml openapi-generator "openapi"',
    },
  ];
}

/** All queries — run test:github-search to validate counts before crawling. */
export const QUERIES: QueryDef[] = [
  ...buildGenericQueries(),
  ...buildFrameworkQueries(),
  ...buildCrudQueries(),
  ...buildVendorQueries(),
  ...buildOptionalQueries(),
];
