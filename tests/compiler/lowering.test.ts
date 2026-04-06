/**
 * Lowering tests — UiPlanIR + ApiIR → UISpec.
 * Uses fixtures; no LLM.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseOpenAPI } from '@/lib/compiler/openapi/parser';
import { validateSubset } from '@/lib/compiler/openapi/subset-validator';
import { resolveRefs } from '@/lib/compiler/openapi/ref-resolver';
import { canonicalize } from '@/lib/compiler/openapi/canonicalize';
import { buildApiIR } from '@/lib/compiler/apiir';
import { normalizeUiPlanIR } from '@/lib/compiler/uiplan';
import { lower } from '@/lib/compiler/lowering/lower';
import type { ApiIR } from '@/lib/compiler/apiir';
import type { UiPlanIR } from '@/lib/compiler/uiplan';
import { UISpecSchema } from '@/lib/spec/schema';
import stringify from 'fast-json-stable-stringify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

function loadApiIr(specPath: string): ApiIR {
  const yaml = readFileSync(join(FIXTURES, specPath), 'utf-8');
  const parseResult = parseOpenAPI(yaml);
  if (!parseResult.success) throw new Error(`Parse failed: ${parseResult.error.message}`);
  const validateResult = validateSubset(parseResult.doc);
  if (!validateResult.success) throw new Error(`Validation failed`);
  const resolveResult = resolveRefs(parseResult.doc);
  if (!resolveResult.success) throw new Error(`Ref resolve failed`);
  const doc = canonicalize(resolveResult.doc) as Record<string, unknown>;
  const buildResult = buildApiIR(doc);
  if (!buildResult.success) throw new Error(`Build failed: ${buildResult.error.message}`);
  return buildResult.apiIr;
}

/** UiPlanIR with paths matching Users schema (id, email, status, profile.*). */
function usersUiPlan(apiIr: ApiIR): UiPlanIR {
  const r = apiIr.resources.find((x) => x.name === 'Users');
  if (!r) throw new Error('Users resource not found');
  return {
    resources: [
      {
        name: 'Users',
        views: {
          list: {
            fields: [
              { path: 'id', label: 'ID', order: 0 },
              { path: 'email', label: 'Email', order: 1 },
              { path: 'status', label: 'Status', order: 2 },
              { path: 'profile.firstName', label: 'First Name', order: 3 },
              { path: 'profile.lastName', label: 'Last Name', order: 4 },
            ],
          },
          detail: {
            fields: [
              { path: 'id' },
              { path: 'email' },
              { path: 'status' },
              { path: 'profile.firstName' },
              { path: 'profile.lastName' },
            ],
          },
          create: {
            fields: [
              { path: 'email' },
              { path: 'status' },
              { path: 'profile.firstName' },
              { path: 'profile.lastName' },
            ],
          },
          edit: {
            fields: [
              { path: 'email' },
              { path: 'status' },
              { path: 'profile.firstName' },
              { path: 'profile.lastName' },
            ],
          },
        },
      },
    ],
  };
}

/** UiPlanIR with paths matching Products schema. */
function productsUiPlan(apiIr: ApiIR): UiPlanIR {
  if (!apiIr.resources.some((r) => r.name === 'Products')) {
    throw new Error('Products resource not found');
  }
  return {
    resources: [
      {
        name: 'Products',
        views: {
          list: {
            fields: [
              { path: 'sku', label: 'SKU', order: 0 },
              { path: 'name', label: 'Name', order: 1 },
              { path: 'status', label: 'Status', order: 2 },
              { path: 'price.amount', label: 'Price', order: 3 },
              { path: 'inventory.quantity', label: 'Quantity', order: 4 },
            ],
          },
          detail: {
            fields: [
              { path: 'sku' },
              { path: 'name' },
              { path: 'status' },
              { path: 'price.amount' },
              { path: 'inventory.quantity' },
            ],
          },
          create: {
            fields: [
              { path: 'sku' },
              { path: 'name' },
              { path: 'status' },
              { path: 'price.amount' },
              { path: 'price.currency' },
              { path: 'inventory.warehouseId' },
              { path: 'inventory.quantity' },
            ],
          },
          edit: {
            fields: [
              { path: 'name' },
              { path: 'status' },
              { path: 'price.amount' },
              { path: 'inventory.quantity' },
            ],
          },
        },
      },
    ],
  };
}

describe('lower', () => {
  it('golden Users: UiPlanIR + ApiIR → valid UISpec', () => {
    const apiIr = loadApiIr('demo/golden_openapi_users_tagged_3_0.yaml');
    const uiPlan = normalizeUiPlanIR(usersUiPlan(apiIr));
    const result = lower(uiPlan, apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.users).toBeDefined();
    const spec = result.specs.users;
    expect(spec.entity).toBe('Users');
    expect(spec.fields.length).toBeGreaterThan(0);
    expect(spec.table.columns.length).toBeGreaterThan(0);
    expect(spec.form.fields.length).toBeGreaterThan(0);
    expect(spec.idField).toBe('id');
    UISpecSchema.parse(spec);
  });

  it('golden Products: UiPlanIR + ApiIR → valid UISpec', () => {
    const apiIr = loadApiIr('demo/golden_openapi_products_path_3_1.yaml');
    const uiPlan = normalizeUiPlanIR(productsUiPlan(apiIr));
    const result = lower(uiPlan, apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.products).toBeDefined();
    const spec = result.specs.products;
    expect(spec.entity).toBe('Products');
    expect(spec.idField).toBe('sku');
    UISpecSchema.parse(spec);
  });

  it('same UiPlanIR + ApiIR → byte-identical UISpec (determinism)', () => {
    const apiIr = loadApiIr('demo/golden_openapi_users_tagged_3_0.yaml');
    const uiPlan = normalizeUiPlanIR(usersUiPlan(apiIr));
    const r1 = lower(uiPlan, apiIr);
    const r2 = lower(uiPlan, apiIr);
    expect(r1.success && r2.success).toBe(true);
    if (!r1.success || !r2.success) return;
    expect(stringify(r1.specs)).toBe(stringify(r2.specs));
  });

  it('snapshot: Users UISpec', () => {
    const apiIr = loadApiIr('demo/golden_openapi_users_tagged_3_0.yaml');
    const uiPlan = normalizeUiPlanIR(usersUiPlan(apiIr));
    const result = lower(uiPlan, apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(stringify(result.specs)).toMatchSnapshot();
  });

  it('snapshot: Products UISpec', () => {
    const apiIr = loadApiIr('demo/golden_openapi_products_path_3_1.yaml');
    const uiPlan = normalizeUiPlanIR(productsUiPlan(apiIr));
    const result = lower(uiPlan, apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(stringify(result.specs)).toMatchSnapshot();
  });

  it('listScoped + detail infers idField from list response item, not scope param', () => {
    const apiIr: ApiIR = {
      api: { title: 'Scoped + detail', version: '1' },
      resources: [
        {
          name: 'Orders',
          key: 'orders',
          operations: [
            {
              id: 'GET:/accounts/{accountId}/orders',
              method: 'GET',
              kind: 'listScoped',
              path: '/accounts/{accountId}/orders',
              identifierParam: 'accountId',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    total: { type: 'number' },
                  },
                },
              },
            },
            {
              id: 'GET:/orders/{orderId}',
              method: 'GET',
              kind: 'detail',
              path: '/orders/{orderId}',
              identifierParam: 'orderId',
              responseSchema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  total: { type: 'number' },
                },
              },
            },
          ],
        },
      ],
    };
    const uiPlan = normalizeUiPlanIR({
      resources: [
        {
          name: 'Orders',
          views: {
            list: { fields: [{ path: 'id' }, { path: 'total' }] },
            detail: { fields: [{ path: 'id' }, { path: 'total' }] },
          },
        },
      ],
    });
    const result = lower(uiPlan, apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.orders?.idField).toBe('id');
    expect(result.specs.orders?.idField).not.toBe('accountId');
  });

  it('listScoped-only resource infers idField from list item when id is present', () => {
    const apiIr: ApiIR = {
      api: { title: 'Scoped list ids', version: '1' },
      resources: [
        {
          name: 'Rows',
          key: 'rows',
          operations: [
            {
              id: 'GET:/orgs/{orgId}/rows',
              method: 'GET',
              kind: 'listScoped',
              path: '/orgs/{orgId}/rows',
              identifierParam: 'orgId',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const uiPlan = normalizeUiPlanIR({
      resources: [
        {
          name: 'Rows',
          views: {
            list: { fields: [{ path: 'label' }] },
          },
        },
      ],
    });
    const result = lower(uiPlan, apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.rows?.idField).toBe('id');
  });

  it('listScoped-only resource can lower without idField', () => {
    const apiIr: ApiIR = {
      api: { title: 'Scoped only', version: '1' },
      resources: [
        {
          name: 'Reports',
          key: 'reports',
          operations: [
            {
              id: 'GET:/orgs/{orgId}/reports',
              method: 'GET',
              kind: 'listScoped',
              path: '/orgs/{orgId}/reports',
              identifierParam: 'orgId',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    status: { type: 'string' },
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const uiPlan = normalizeUiPlanIR({
      resources: [
        {
          name: 'Reports',
          views: {
            list: { fields: [{ path: 'title' }, { path: 'status' }] },
          },
        },
      ],
    });
    const result = lower(uiPlan, apiIr);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.specs.reports).toBeDefined();
    expect(result.specs.reports?.idField).toBeUndefined();
  });
});
