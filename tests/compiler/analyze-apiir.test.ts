import { describe, it, expect } from 'vitest';
import {
  HTTP_METHOD,
  OPERATION_KIND,
  type ApiIR,
  type OperationIR,
  type ResourceIR,
} from '@/lib/compiler/apiir';
import {
  extractResourceSignature,
  mineComprehensive,
  normalizePattern,
  mineStructuralPatterns,
  formatPatternMiningReportTop10,
} from '@/scripts/corpus-data/analyze-apiir';

function makeResource(overrides: Partial<ResourceIR> = {}): ResourceIR {
  return {
    name: 'Test',
    key: 'test',
    operations: [],
    ...overrides,
  };
}

describe('extractResourceSignature', () => {
  it('returns null for empty operations', () => {
    const res = makeResource({ operations: [] });
    expect(extractResourceSignature(res)).toBeNull();
  });

  it('extracts fields, depth, and operations from list op', () => {
    const res = makeResource({
      operations: [
        {
          id: 'GET:/items',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/items',
          responseSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              count: { type: 'integer' },
            },
          },
        },
      ],
    });
    const sig = extractResourceSignature(res);
    expect(sig).not.toBeNull();
    expect(sig!.fields).toBe(3);
    expect(sig!.depth).toBe(0);
    expect(sig!.operations).toEqual([OPERATION_KIND.list]);
    expect(sig!.listLikeOperationCount).toBe(1);
    expect(sig!.listLikeOpKinds).toEqual([OPERATION_KIND.list]);
    expect(sig!.has_id).toBe(true);
  });

  it('takes max across multiple ops', () => {
    const res = makeResource({
      operations: [
        {
          id: 'GET:/items',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/items',
          responseSchema: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
        },
        {
          id: 'GET:/items/{id}',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.detail,
          path: '/items/{id}',
          responseSchema: {
            type: 'object',
            properties: {
              a: { type: 'string' },
              b: { type: 'string' },
              c: { type: 'string' },
            },
          },
        },
      ],
    });
    const sig = extractResourceSignature(res);
    expect(sig!.fields).toBe(3);
    expect(sig!.operations).toEqual([OPERATION_KIND.list, OPERATION_KIND.detail]);
    expect(sig!.listLikeOperationCount).toBe(1);
    expect(sig!.listLikeOpKinds).toEqual([OPERATION_KIND.list]);
  });

  it('counts list and listScoped as list-like ops with ordered kinds', () => {
    const base = {
      method: HTTP_METHOD.GET,
      responseSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    };
    const res = makeResource({
      operations: [
        {
          id: 'GET:/orgs',
          ...base,
          kind: OPERATION_KIND.list,
          path: '/orgs',
        },
        {
          id: 'GET:/orgs/{id}/widgets',
          ...base,
          kind: OPERATION_KIND.listScoped,
          path: '/orgs/{id}/widgets',
          identifierParam: 'id',
        },
        {
          id: 'GET:/orgs/{id}',
          ...base,
          kind: OPERATION_KIND.detail,
          path: '/orgs/{id}',
          identifierParam: 'id',
        },
      ],
    });
    const sig = extractResourceSignature(res);
    expect(sig!.listLikeOperationCount).toBe(2);
    expect(sig!.listLikeOpKinds).toEqual([OPERATION_KIND.list, OPERATION_KIND.listScoped]);
  });

  it('uses queryParamCount from operations', () => {
    const res = makeResource({
      operations: [
        {
          id: 'GET:/items',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/items',
          queryParamCount: 5,
          responseSchema: { type: 'object', properties: {} },
        },
      ],
    });
    const sig = extractResourceSignature(res);
    expect(sig!.query_params).toBe(5);
  });

  it('defaults queryParamCount to 0 when missing', () => {
    const res = makeResource({
      operations: [
        {
          id: 'GET:/items',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/items',
          responseSchema: { type: 'object', properties: {} },
        },
      ],
    });
    const sig = extractResourceSignature(res);
    expect(sig!.query_params).toBe(0);
  });
});

describe('normalizePattern', () => {
  it('produces bucketed pattern string', () => {
    const sig = {
      fields: 5,
      has_id: true,
      enums: 0,
      arrays: 0,
      nested_objects: 0,
      depth: 0,
      query_params: 0,
      operations: [OPERATION_KIND.list, OPERATION_KIND.detail] as OperationIR['kind'][],
      listLikeOperationCount: 1,
      listLikeOpKinds: [OPERATION_KIND.list] as OperationIR['kind'][],
    };
    expect(normalizePattern(sig)).toBe('fields≤6 depth0 ops:list+detail');
  });

  it('buckets fields correctly', () => {
    expect(normalizePattern({ ...makeSig(), fields: 2 })).toContain('fields≤4');
    expect(normalizePattern({ ...makeSig(), fields: 5 })).toContain('fields≤6');
    expect(normalizePattern({ ...makeSig(), fields: 8 })).toContain('fields≤8');
    expect(normalizePattern({ ...makeSig(), fields: 15 })).toContain('fields>12');
  });

  it('buckets depth correctly', () => {
    expect(normalizePattern({ ...makeSig(), depth: 0 })).toContain('depth0');
    expect(normalizePattern({ ...makeSig(), depth: 1 })).toContain('depth1');
    expect(normalizePattern({ ...makeSig(), depth: 3 })).toContain('depth3+');
  });

  it('includes distinct listScoped in normalized ops string', () => {
    const sig = {
      fields: 3,
      has_id: true,
      enums: 0,
      arrays: 0,
      nested_objects: 0,
      depth: 0,
      query_params: 0,
      operations: [OPERATION_KIND.listScoped, OPERATION_KIND.detail] as OperationIR['kind'][],
      listLikeOperationCount: 1,
      listLikeOpKinds: [OPERATION_KIND.listScoped] as OperationIR['kind'][],
    };
    expect(normalizePattern(sig)).toBe('fields≤4 depth0 ops:listScoped+detail');
  });

  function makeSig() {
    return {
      fields: 1,
      has_id: false,
      enums: 0,
      arrays: 0,
      nested_objects: 0,
      depth: 0,
      query_params: 0,
      operations: [OPERATION_KIND.list] as OperationIR['kind'][],
      listLikeOperationCount: 1,
      listLikeOpKinds: [OPERATION_KIND.list] as OperationIR['kind'][],
    };
  }
});

describe('mineStructuralPatterns', () => {
  it('aggregates patterns across entries', () => {
    const apiIr1: ApiIR = {
      api: { title: 'A', version: '1' },
      resources: [
        makeResource({
          key: 'users',
          operations: [
            {
              id: 'GET:/users',
              method: HTTP_METHOD.GET,
              kind: OPERATION_KIND.list,
              path: '/users',
              responseSchema: {
                type: 'object',
                properties: { id: { type: 'string' }, name: { type: 'string' } },
              },
            },
          ],
        }),
      ],
    };
    const apiIr2: ApiIR = {
      api: { title: 'B', version: '1' },
      resources: [
        makeResource({
          key: 'items',
          operations: [
            {
              id: 'GET:/items',
              method: HTTP_METHOD.GET,
              kind: OPERATION_KIND.list,
              path: '/items',
              responseSchema: {
                type: 'object',
                properties: { id: { type: 'string' }, title: { type: 'string' } },
              },
            },
          ],
        }),
      ],
    };

    const { results, totalResources } = mineStructuralPatterns([
      { apiIr: apiIr1, specPath: 'spec1__openapi.json' },
      { apiIr: apiIr2, specPath: 'spec2__openapi.json' },
    ]);

    expect(totalResources).toBe(2);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const top = results[0]!;
    expect(top.count).toBe(2);
    expect(top.share).toBe(100);
    expect(top.examples.length).toBeLessThanOrEqual(3);
    expect(top.pattern).toContain('fields≤4');
    expect(top.pattern).toContain('depth0');
    expect(top.pattern).toContain('ops:list');
  });
});

describe('mineComprehensive', () => {
  it('aggregates listLikeOpCountsPerResource and resourcesWithMultipleListLikes', () => {
    const apiIr: ApiIR = {
      api: { title: 'T', version: '1' },
      resources: [
        makeResource({
          key: 'a',
          operations: [
            {
              id: 'GET:/a',
              method: HTTP_METHOD.GET,
              kind: OPERATION_KIND.list,
              path: '/a',
              responseSchema: { type: 'object', properties: { x: { type: 'string' } } },
            },
            {
              id: 'GET:/a/{id}/b',
              method: HTTP_METHOD.GET,
              kind: OPERATION_KIND.listScoped,
              path: '/a/{id}/b',
              identifierParam: 'id',
              responseSchema: { type: 'object', properties: { y: { type: 'string' } } },
            },
          ],
        }),
        makeResource({
          key: 'b',
          operations: [
            {
              id: 'GET:/b',
              method: HTTP_METHOD.GET,
              kind: OPERATION_KIND.list,
              path: '/b',
              responseSchema: { type: 'object', properties: { z: { type: 'string' } } },
            },
          ],
        }),
      ],
    };
    const agg = mineComprehensive([{ apiIr }]);
    expect(agg.resourcesWithMultipleListLikes).toBe(1);
    expect(agg.listLikeOpCountsPerResource.sort((a, b) => a - b)).toEqual([1, 2]);
  });
});

describe('formatPatternMiningReportTop10', () => {
  it('formats report with top patterns and optional examples', () => {
    const results = [
      {
        pattern: 'fields≤8 depth0 ops:list+detail',
        count: 10,
        share: 50,
        examples: ['a/users', 'b/items'],
      },
      { pattern: 'fields≤6 depth0 ops:list', count: 5, share: 25, examples: ['c/events'] },
    ];
    const lines = formatPatternMiningReportTop10(results, 20, { includeExamples: true });
    expect(lines.some((l) => l.includes('fields≤8 depth0 ops:list+detail'))).toBe(true);
    expect(lines.some((l) => l.includes('50%'))).toBe(true);
    expect(lines.some((l) => l.includes('examples: a/users, b/items'))).toBe(true);
  });
});
