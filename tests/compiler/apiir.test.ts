import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseOpenAPI } from '@/lib/compiler/openapi/parser';
import { validateSubset } from '@/lib/compiler/openapi/subset-validator';
import { resolveRefs } from '@/lib/compiler/openapi/ref-resolver';
import { canonicalize } from '@/lib/compiler/openapi/canonicalize';
import { buildApiIR, apiIrStringify } from '@/lib/compiler/apiir/build';
import {
  compareOperationKind,
  CURRENT_API_IR_VERSION,
  getListItemObjectSchema,
  HTTP_METHOD,
  isListShapedResponseSchema,
  listLikeOperationKinds,
  OPERATION_KIND,
  PARAMETER_IN,
  primaryListLikeOperation,
  type OperationIR,
  type OperationKind,
} from '@/lib/compiler/apiir';
import { sha256Hash } from '@/lib/compiler/hash';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

function loadAndProcess(specPath: string) {
  const yaml = readFileSync(join(FIXTURES, specPath), 'utf-8');
  const parseResult = parseOpenAPI(yaml);
  if (!parseResult.success) throw new Error(`Parse failed: ${parseResult.error.message}`);
  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) throw new Error(`Validation failed`);
  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) throw new Error(`Ref resolve failed: ${resolveResult.error.message}`);
  return canonicalize(resolveResult.doc) as Record<string, unknown>;
}

describe('ApiIR build', () => {
  it('sets apiIrVersion to CURRENT_API_IR_VERSION', () => {
    const doc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.apiIr.apiIrVersion).toBe(CURRENT_API_IR_VERSION);
  });

  it('derives queryParamCount from parameters (query) for list op', () => {
    const doc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const listOp = result.apiIr.resources[0]?.operations.find((o) => o.id === 'listUsers');
    expect(listOp).toBeDefined();
    const qFromParams = listOp!.parameters?.filter((p) => p.in === PARAMETER_IN.query).length ?? 0;
    expect(listOp!.queryParamCount).toBe(qFromParams);
    expect(qFromParams).toBe(2);
  });

  it('golden_openapi_users_tagged_3_0.yaml produces expected ApiIR', () => {
    const doc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const str = apiIrStringify(result.apiIr);
    expect(str).toMatchSnapshot();
  });

  it('golden_openapi_products_path_3_1.yaml produces expected ApiIR', () => {
    const doc = loadAndProcess('demo/golden_openapi_products_path_3_1.yaml');
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const str = apiIrStringify(result.apiIr);
    expect(str).toMatchSnapshot();
  });

  it('ApiIR JSON is byte-stable (same input → same output)', () => {
    const doc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const r1 = buildApiIR(doc);
    const r2 = buildApiIR(doc);
    expect(r1.success && r2.success).toBe(true);
    if (!r1.success || !r2.success) return;
    expect(apiIrStringify(r1.apiIr)).toBe(apiIrStringify(r2.apiIr));
    expect(r1.apiIrHash).toBe(r2.apiIrHash);
  });

  it('same ApiIR produces same hash', () => {
    const doc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const hash1 = sha256Hash(result.apiIr);
    const hash2 = result.apiIrHash;
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different specs produce different ApiIR and hashes', () => {
    const usersDoc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const productsDoc = loadAndProcess('demo/golden_openapi_products_path_3_1.yaml');
    const usersResult = buildApiIR(usersDoc);
    const productsResult = buildApiIR(productsDoc);
    expect(usersResult.success && productsResult.success).toBe(true);
    if (!usersResult.success || !productsResult.success) return;
    expect(usersResult.apiIrHash).not.toBe(productsResult.apiIrHash);
    expect(apiIrStringify(usersResult.apiIr)).not.toBe(apiIrStringify(productsResult.apiIr));
  });

  it('fails when no paths', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Empty', version: '1.0' },
      paths: {},
    } as Record<string, unknown>;
    const result = buildApiIR(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('OAS_AMBIGUOUS_RESOURCE_GROUPING');
  });

  it('fails with mixed grouping (some tagged, some not)', () => {
    const doc = loadAndProcess(
      'invalid/golden_openapi_invalid_mixed_grouping_expected_failure.yaml'
    );
    const result = buildApiIR(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('OAS_AMBIGUOUS_RESOURCE_GROUPING');
    expect(result.error.message).toContain('Mixed resource grouping');
  });

  it('fails when paths is missing', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'No Paths', version: '1.0' },
    } as Record<string, unknown>;
    const result = buildApiIR(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('IR_INVALID');
  });

  it('classifies list-shaped success bodies (shared list-shape module)', () => {
    expect(isListShapedResponseSchema({ type: 'array', items: { type: 'object' } })).toBe(true);
    expect(
      isListShapedResponseSchema({
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
      })
    ).toBe(true);
    expect(
      isListShapedResponseSchema({
        type: 'object',
        properties: {
          sku: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      })
    ).toBe(false);
  });

  it('GET with one path param and envelope list body is listScoped', () => {
    const yaml = `
openapi: 3.0.3
info:
  title: Scoped list
  version: '1'
paths:
  /orgs/{orgId}/widgets:
    get:
      operationId: listWidgetsForOrg
      parameters:
        - name: orgId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
`;
    const parseResult = parseOpenAPI(yaml);
    if (!parseResult.success) throw new Error(parseResult.error.message);
    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) throw new Error('validate');
    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) throw new Error(resolveResult.error.message);
    const doc = canonicalize(resolveResult.doc) as Record<string, unknown>;
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const op = result.apiIr.resources[0]?.operations[0];
    expect(op?.kind).toBe('listScoped');
    expect(op?.identifierParam).toBe('orgId');
  });

  it('GET with one path param and non-list body stays detail', () => {
    const yaml = `
openapi: 3.0.3
info:
  title: Detail not scoped list
  version: '1'
paths:
  /orgs/{orgId}/summary:
    get:
      operationId: getOrgSummary
      parameters:
        - name: orgId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  total:
                    type: integer
`;
    const parseResult = parseOpenAPI(yaml);
    if (!parseResult.success) throw new Error(parseResult.error.message);
    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) throw new Error('validate');
    const resolveResult = resolveRefs(parseResult.doc);
    if (!resolveResult.success) throw new Error(resolveResult.error.message);
    const doc = canonicalize(resolveResult.doc) as Record<string, unknown>;
    const result = buildApiIR(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const op = result.apiIr.resources[0]?.operations[0];
    expect(op?.kind).toBe(OPERATION_KIND.detail);
    expect(op?.identifierParam).toBe('orgId');
  });

  it('rejects specs when success response is only 204 (no 200/201 JSON schema)', () => {
    const yaml = `
openapi: 3.0.3
info:
  title: No json success
  version: '1'
paths:
  /items:
    get:
      responses:
        '204':
          description: No content
`;
    const parseResult = parseOpenAPI(yaml);
    if (!parseResult.success) throw new Error(parseResult.error.message);
    const validateResult = validateSubset(parseResult.doc);
    expect(validateResult.success).toBe(false);
  });

  it('rejects specs when 200 response exists but has no application/json schema', () => {
    const yaml = `
openapi: 3.0.3
info:
  title: 200 without json content
  version: '1'
paths:
  /items:
    get:
      responses:
        '200':
          description: OK
`;
    const parseResult = parseOpenAPI(yaml);
    if (!parseResult.success) throw new Error(parseResult.error.message);
    const validateResult = validateSubset(parseResult.doc);
    expect(validateResult.success).toBe(false);
  });
});

describe('getListItemObjectSchema', () => {
  it('returns array items object schema for array root', () => {
    const items = getListItemObjectSchema({
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' } } },
    });
    expect(items).not.toBeNull();
    const props = items!.properties as Record<string, unknown> | undefined;
    expect(Object.keys(props ?? {})).toContain('id');
  });

  it('resolves preferred envelope keys to item object schema', () => {
    const items = getListItemObjectSchema({
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    });
    expect(items).not.toBeNull();
    const props = items!.properties as Record<string, unknown> | undefined;
    expect(Object.keys(props ?? {})).toContain('id');
  });
});

describe('list-like helpers', () => {
  const op = (kind: OperationKind, path: string): OperationIR => ({
    id: path,
    method: HTTP_METHOD.GET,
    kind,
    path,
    responseSchema: { type: 'object', properties: {} },
  });

  it('primaryListLikeOperation picks the first list-like in operation order', () => {
    expect(
      primaryListLikeOperation([
        op(OPERATION_KIND.detail, '/x/{id}'),
        op(OPERATION_KIND.list, '/x'),
      ])?.kind
    ).toBe(OPERATION_KIND.list);
  });

  it('listLikeOperationKinds returns distinct kinds in compareOperationKind order', () => {
    expect(
      listLikeOperationKinds([
        op(OPERATION_KIND.listScoped, '/a/{id}/w'),
        op(OPERATION_KIND.list, '/a'),
      ])
    ).toEqual([OPERATION_KIND.list, OPERATION_KIND.listScoped]);
  });

  it('after build-style sort, primary list-like is list before listScoped', () => {
    const unsorted = [op(OPERATION_KIND.listScoped, '/a/{id}/w'), op(OPERATION_KIND.list, '/a')];
    const sorted = [...unsorted].sort((a, b) => compareOperationKind(a.kind, b.kind));
    expect(primaryListLikeOperation(sorted)?.kind).toBe(OPERATION_KIND.list);
  });
});
