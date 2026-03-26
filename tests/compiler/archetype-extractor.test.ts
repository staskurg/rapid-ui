import { describe, it, expect } from 'vitest';
import {
  getObjectSchema,
  deriveOperationPattern,
  extractResourceMetrics,
  aggregateSpecMetrics,
  computeSpecComplexityScore,
  classifyResourceArchetypes,
  classifySpecArchetypes,
  ARCHETYPES,
  OPERATION_PATTERN,
} from '@/scripts/corpus-data/archetype-extractor';
import {
  HTTP_METHOD,
  OPERATION_KIND,
  type OperationKind,
  type ResourceIR,
} from '@/lib/compiler/apiir';

describe('getObjectSchema', () => {
  it('returns object schema for type: object', () => {
    const schema = { type: 'object', properties: { foo: { type: 'string' } } };
    expect(getObjectSchema(schema)).toBe(schema);
  });

  it('returns items schema for array with items.type: object', () => {
    const items = { type: 'object', properties: { id: { type: 'string' } } };
    const schema = { type: 'array', items };
    expect(getObjectSchema(schema)).toBe(items);
  });

  it('returns null for array with items.type: string', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(getObjectSchema(schema)).toBeNull();
  });

  it('returns null for primitive types', () => {
    expect(getObjectSchema({ type: 'string' })).toBeNull();
    expect(getObjectSchema({ type: 'number' })).toBeNull();
    expect(getObjectSchema({ type: 'boolean' })).toBeNull();
  });

  it('returns null for array without items', () => {
    const schema = { type: 'array' };
    expect(getObjectSchema(schema)).toBeNull();
  });
});

describe('deriveOperationPattern', () => {
  const op = (kind: OperationKind) => ({
    id: kind,
    method: HTTP_METHOD.GET,
    kind,
    path: '/',
    responseSchema: { type: 'object' },
  });

  it('returns create_only when only create', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.create)])).toBe(OPERATION_PATTERN.CREATE_ONLY);
  });

  it('returns list_only when only list', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.list)])).toBe(OPERATION_PATTERN.LIST_ONLY);
  });

  it('returns list_only when only listScoped', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.listScoped)])).toBe(
      OPERATION_PATTERN.LIST_ONLY
    );
  });

  it('returns detail_only when only detail', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.detail)])).toBe(OPERATION_PATTERN.DETAIL_ONLY);
  });

  it('returns list_create when list and create', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.list), op(OPERATION_KIND.create)])).toBe(
      OPERATION_PATTERN.LIST_CREATE
    );
  });

  it('returns list_detail when list and detail', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.list), op(OPERATION_KIND.detail)])).toBe(
      OPERATION_PATTERN.LIST_DETAIL
    );
  });

  it('returns list_detail when listScoped and detail (list-like ∪ detail)', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.listScoped), op(OPERATION_KIND.detail)])).toBe(
      OPERATION_PATTERN.LIST_DETAIL
    );
  });

  it('returns list_detail_create when list, detail, and create', () => {
    expect(
      deriveOperationPattern([
        op(OPERATION_KIND.list),
        op(OPERATION_KIND.detail),
        op(OPERATION_KIND.create),
      ])
    ).toBe(OPERATION_PATTERN.LIST_DETAIL_CREATE);
  });

  it('returns crud when all five operations', () => {
    expect(
      deriveOperationPattern([
        op(OPERATION_KIND.list),
        op(OPERATION_KIND.detail),
        op(OPERATION_KIND.create),
        op(OPERATION_KIND.update),
        op(OPERATION_KIND.delete),
      ])
    ).toBe(OPERATION_PATTERN.CRUD);
  });

  it('returns crud when listScoped replaces list in the full quintet', () => {
    expect(
      deriveOperationPattern([
        op(OPERATION_KIND.listScoped),
        op(OPERATION_KIND.detail),
        op(OPERATION_KIND.create),
        op(OPERATION_KIND.update),
        op(OPERATION_KIND.delete),
      ])
    ).toBe(OPERATION_PATTERN.CRUD);
  });

  it('returns other when mixed non-standard combo', () => {
    expect(deriveOperationPattern([op(OPERATION_KIND.list), op(OPERATION_KIND.update)])).toBe(
      OPERATION_PATTERN.OTHER
    );
  });
});

describe('extractResourceMetrics', () => {
  it('extracts metrics from minimal create-only resource', () => {
    const resource: ResourceIR = {
      name: 'Tasks',
      key: 'tasks',
      operations: [
        {
          id: 'POST:/tasks',
          method: HTTP_METHOD.POST,
          kind: OPERATION_KIND.create,
          path: '/tasks',
          requestSchema: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string' },
              done: { type: 'boolean' },
            },
          },
          responseSchema: { type: 'object' },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    expect(m.fieldCount).toBe(2);
    expect(m.requiredCount).toBe(1);
    expect(m.optionalCount).toBe(1);
    expect(m.operationPattern).toBe(OPERATION_PATTERN.CREATE_ONLY);
    expect(m.operationCount).toBe(1);
    expect(m.listResponseShape).toBe('unknown');
    expect(m.hasListScoped).toBe(false);
    expect(m.hasListScopedWithDetail).toBe(false);
    expect(m.hasListScopedOnly).toBe(false);
    expect(m.hasRequiredQueryOnListLike).toBe(false);
  });

  it('computes depth: User { address { city } } → depth = 1', () => {
    const resource: ResourceIR = {
      name: 'Users',
      key: 'users',
      operations: [
        {
          id: 'GET:/users',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/users',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                address: {
                  type: 'object',
                  properties: {
                    city: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    expect(m.maxDepth).toBe(1);
  });

  it('computes depth: User { address { country { code } } } → depth = 2', () => {
    const resource: ResourceIR = {
      name: 'Users',
      key: 'users',
      operations: [
        {
          id: 'GET:/users',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/users',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                address: {
                  type: 'object',
                  properties: {
                    country: {
                      type: 'object',
                      properties: { code: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    expect(m.maxDepth).toBe(2);
  });

  it('listResponseShape: array_root when list returns array', () => {
    const resource: ResourceIR = {
      name: 'Items',
      key: 'items',
      operations: [
        {
          id: 'GET:/items',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/items',
          responseSchema: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    expect(m.listResponseShape).toBe('array_root');
  });

  it('listResponseShape: object_wrapped when list returns { data: [...] }', () => {
    const resource: ResourceIR = {
      name: 'Items',
      key: 'items',
      operations: [
        {
          id: 'GET:/items',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/items',
          responseSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { type: 'object', properties: { id: { type: 'string' } } },
              },
            },
          },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    expect(m.listResponseShape).toBe('object_wrapped');
  });

  it('listResponseShape: unknown when no list op or primitive array', () => {
    const resourceNoList: ResourceIR = {
      name: 'Tasks',
      key: 'tasks',
      operations: [
        {
          id: 'POST:/tasks',
          method: HTTP_METHOD.POST,
          kind: OPERATION_KIND.create,
          path: '/tasks',
          requestSchema: { type: 'object', properties: {} },
          responseSchema: { type: 'object' },
        },
      ],
    };
    expect(extractResourceMetrics(resourceNoList).listResponseShape).toBe('unknown');

    const resourcePrimitiveArray: ResourceIR = {
      name: 'Ids',
      key: 'ids',
      operations: [
        {
          id: 'GET:/ids',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/ids',
          responseSchema: {
            type: 'object',
            properties: {
              ids: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      ],
    };
    expect(extractResourceMetrics(resourcePrimitiveArray).listResponseShape).toBe('unknown');
  });

  it('extracts listScoped + required-list-query metrics', () => {
    const resource: ResourceIR = {
      name: 'Orders',
      key: 'orders',
      operations: [
        {
          id: 'GET:/accounts/{accountId}/orders',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.listScoped,
          path: '/accounts/{accountId}/orders',
          identifierParam: 'accountId',
          parameters: [
            { in: 'path', name: 'accountId', schema: { type: 'string' } },
            { in: 'query', name: 'status', schema: { type: 'string' }, required: true },
          ],
          responseSchema: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
        {
          id: 'GET:/orders/{id}',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.detail,
          path: '/orders/{id}',
          identifierParam: 'id',
          responseSchema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    expect(m.hasListScoped).toBe(true);
    expect(m.hasListScopedWithDetail).toBe(true);
    expect(m.hasListScopedOnly).toBe(false);
    expect(m.hasRequiredQueryOnListLike).toBe(true);
  });
});

describe('aggregateSpecMetrics', () => {
  it('aggregates resource metrics into spec metrics', () => {
    const r1 = extractResourceMetrics({
      name: 'A',
      key: 'a',
      operations: [
        {
          id: '1',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/',
          responseSchema: {
            type: 'array',
            items: { type: 'object', properties: { x: { type: 'string' } } },
          },
        },
      ],
    });
    const r2 = extractResourceMetrics({
      name: 'B',
      key: 'b',
      operations: [
        {
          id: '2',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                a: { type: 'string' },
                b: { type: 'string' },
                c: { type: 'string' },
                d: { type: 'string' },
                e: { type: 'string' },
              },
            },
          },
        },
      ],
    });
    const spec = aggregateSpecMetrics([r1, r2]);
    expect(spec.resourceCount).toBe(2);
    expect(spec.operationCount).toBe(2);
    expect(spec.maxFieldsPerResource).toBe(5);
  });
});

describe('computeSpecComplexityScore', () => {
  it('computes score from spec metrics', () => {
    const score = computeSpecComplexityScore({
      resourceCount: 2,
      operationCount: 5,
      maxFieldsPerResource: 4,
      maxDepth: 0,
      maxArrayOfObjects: 0,
    });
    expect(score).toBe(2 * 5 + 5 * 1 + 0 * 10 + 4 * 2 + 0 * 3);
    expect(score).toBe(23);
  });
});

describe('classifyResourceArchetypes', () => {
  const emptySpec: {
    resourceCount: number;
    operationCount: number;
    maxFieldsPerResource: number;
    maxDepth: number;
    maxArrayOfObjects: number;
  } = {
    resourceCount: 1,
    operationCount: 1,
    maxFieldsPerResource: 4,
    maxDepth: 0,
    maxArrayOfObjects: 0,
  };

  it('simple_create: fields≤4, depth=0, create_only', () => {
    const resource: ResourceIR = {
      name: 'Tasks',
      key: 'tasks',
      operations: [
        {
          id: 'POST:/tasks',
          method: HTTP_METHOD.POST,
          kind: OPERATION_KIND.create,
          path: '/tasks',
          requestSchema: {
            type: 'object',
            required: ['title'],
            properties: { title: { type: 'string' }, done: { type: 'boolean' } },
          },
          responseSchema: { type: 'object' },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    const archetypes = classifyResourceArchetypes(m, emptySpec);
    expect(archetypes).toContain(ARCHETYPES.SIMPLE_CREATE);
  });

  it('optional_heavy: required≤2, optional≥5', () => {
    const resource: ResourceIR = {
      name: 'Items',
      key: 'items',
      operations: [
        {
          id: 'POST:/items',
          method: HTTP_METHOD.POST,
          kind: OPERATION_KIND.create,
          path: '/items',
          requestSchema: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              a: { type: 'string' },
              b: { type: 'string' },
              c: { type: 'string' },
              d: { type: 'string' },
              e: { type: 'string' },
            },
          },
          responseSchema: { type: 'object' },
        },
      ],
    };
    const m = extractResourceMetrics(resource);
    const archetypes = classifyResourceArchetypes(m, emptySpec);
    expect(archetypes).toContain(ARCHETYPES.OPTIONAL_HEAVY);
  });

  it.each([
    ['simple_list', { fields: 2, pattern: OPERATION_PATTERN.LIST_ONLY }],
    ['list_detail', { fields: 3, pattern: OPERATION_PATTERN.LIST_DETAIL }],
    ['list_create', { fields: 3, pattern: OPERATION_PATTERN.LIST_CREATE }],
    ['full_crud', { fields: 4, pattern: OPERATION_PATTERN.CRUD }],
    ['enum_heavy', { enums: 2 }],
    ['array_of_objects', { arrayOfObjects: 1 }],
    ['nested_depth_1', { depth: 1 }],
    ['nested_depth_2', { depth: 2 }],
    ['map_schema', { map: true }],
    ['large_resource', { fields: 15 }],
    ['array_heavy', { arrayOfObjects: 2 }],
    ['deep_schema', { depth: 3 }],
    ['many_enum_values', { maxEnumValues: 10 }],
    ['nullable_fields', { nullable: 2 }],
    ['mixed_schema_types', { enum: 1, arrayOfObjects: 1, nestedObject: 1 }],
    ['array_root_list', { listShape: 'array_root' as const }],
    ['wrapped_list_response', { listShape: 'object_wrapped' as const }],
    ['list_scoped', { kinds: [OPERATION_KIND.listScoped] as OperationKind[] }],
    [
      'list_scoped_with_detail',
      { kinds: [OPERATION_KIND.listScoped, OPERATION_KIND.detail] as OperationKind[] },
    ],
    ['list_scoped_only', { kinds: [OPERATION_KIND.listScoped] as OperationKind[] }],
    ['required_query_list_like', { requiredListQuery: true }],
  ])('classifies %s', (archetype, config) => {
    const op = (kind: OperationKind) => ({
      id: kind,
      method: HTTP_METHOD.GET,
      kind,
      path: '/',
      responseSchema: { type: 'object' },
    });

    let resource: ResourceIR;
    if ('pattern' in config) {
      const kinds: OperationKind[] =
        config.pattern === OPERATION_PATTERN.LIST_ONLY
          ? [OPERATION_KIND.list]
          : config.pattern === OPERATION_PATTERN.LIST_DETAIL
            ? [OPERATION_KIND.list, OPERATION_KIND.detail]
            : config.pattern === OPERATION_PATTERN.LIST_CREATE
              ? [OPERATION_KIND.list, OPERATION_KIND.create]
              : [
                  OPERATION_KIND.list,
                  OPERATION_KIND.detail,
                  OPERATION_KIND.create,
                  OPERATION_KIND.update,
                  OPERATION_KIND.delete,
                ];
      resource = {
        name: 'R',
        key: 'r',
        operations: kinds.map((k) => op(k)),
      };
    } else if ('kinds' in config) {
      resource = {
        name: 'R',
        key: 'r',
        operations: config.kinds.map((k) => ({
          ...op(k),
          parameters:
            k === OPERATION_KIND.listScoped
              ? [{ in: 'path', name: 'scopeId', schema: { type: 'string' } }]
              : undefined,
        })),
      };
    } else {
      resource = { name: 'R', key: 'r', operations: [op(OPERATION_KIND.list)] };
    }

    const props: Record<string, unknown> = {};
    if ('fields' in config) {
      for (let i = 0; i < config.fields; i++) props[`f${i}`] = { type: 'string' };
    }
    if ('enums' in config) {
      for (let i = 0; i < config.enums; i++) props[`e${i}`] = { type: 'string', enum: ['a', 'b'] };
    }
    if ('arrayOfObjects' in config) {
      for (let i = 0; i < config.arrayOfObjects; i++) {
        props[`arr${i}`] = {
          type: 'array',
          items: { type: 'object', properties: { x: { type: 'string' } } },
        };
      }
    }
    if ('depth' in config) {
      let nested: Record<string, unknown> = { x: { type: 'string' } };
      for (let i = 1; i < config.depth; i++) {
        nested = { inner: { type: 'object', properties: nested } };
      }
      props.nested = { type: 'object', properties: nested };
    }
    if ('map' in config && config.map) {
      props.extra = { type: 'object', additionalProperties: { type: 'string' } };
    }
    if ('nullable' in config) {
      for (let i = 0; i < config.nullable; i++) props[`n${i}`] = { type: 'string', nullable: true };
    }
    if ('maxEnumValues' in config) {
      props.bigEnum = {
        type: 'string',
        enum: Array.from({ length: config.maxEnumValues }, (_, i) => `v${i}`),
      };
    }
    if ('enum' in config && 'arrayOfObjects' in config && 'nestedObject' in config) {
      props.e = { type: 'string', enum: ['a'] };
      props.arr = {
        type: 'array',
        items: { type: 'object', properties: { x: { type: 'string' } } },
      };
      props.obj = { type: 'object', properties: { y: { type: 'string' } } };
    }
    if ('listShape' in config) {
      resource.operations[0] = {
        ...resource.operations[0],
        kind: OPERATION_KIND.list,
        responseSchema:
          config.listShape === 'array_root'
            ? { type: 'array', items: { type: 'object', properties: props } }
            : {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { type: 'object', properties: props } },
                },
              },
      };
    } else if (Object.keys(props).length > 0) {
      resource.operations[0] = {
        ...resource.operations[0],
        responseSchema: { type: 'array', items: { type: 'object', properties: props } },
      };
    }
    if ('requiredListQuery' in config && config.requiredListQuery) {
      resource.operations[0] = {
        ...resource.operations[0],
        kind: OPERATION_KIND.listScoped,
        parameters: [
          { in: 'path', name: 'scopeId', schema: { type: 'string' } },
          { in: 'query', name: 'search', schema: { type: 'string' }, required: true },
        ],
        responseSchema: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' } } },
        },
      };
    }

    const m = extractResourceMetrics(resource);
    const archetypes = classifyResourceArchetypes(m, emptySpec);
    expect(archetypes).toContain(archetype);
  });
});

describe('classifySpecArchetypes', () => {
  it('mixed_operations: spec has ≥1 create_only AND ≥1 list_only AND ≥1 detail_only', () => {
    const createOnly = extractResourceMetrics({
      name: 'A',
      key: 'a',
      operations: [
        {
          id: '1',
          method: HTTP_METHOD.POST,
          kind: OPERATION_KIND.create,
          path: '/',
          requestSchema: { type: 'object' },
          responseSchema: { type: 'object' },
        },
      ],
    });
    const listOnly = extractResourceMetrics({
      name: 'B',
      key: 'b',
      operations: [
        {
          id: '2',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.list,
          path: '/',
          responseSchema: { type: 'array', items: { type: 'object' } },
        },
      ],
    });
    const detailOnly = extractResourceMetrics({
      name: 'C',
      key: 'c',
      operations: [
        {
          id: '3',
          method: HTTP_METHOD.GET,
          kind: OPERATION_KIND.detail,
          path: '/:id',
          identifierParam: 'id',
          responseSchema: { type: 'object' },
        },
      ],
    });
    const spec = aggregateSpecMetrics([createOnly, listOnly, detailOnly]);
    const archetypes = classifySpecArchetypes(spec, [createOnly, listOnly, detailOnly]);
    expect(archetypes).toContain(ARCHETYPES.MIXED_OPERATIONS);
  });

  it('multi_resource: resourceCount ≥ 3', () => {
    const resources = [
      extractResourceMetrics({
        name: 'A',
        key: 'a',
        operations: [
          {
            id: '1',
            method: HTTP_METHOD.GET,
            kind: OPERATION_KIND.list,
            path: '/',
            responseSchema: { type: 'object' },
          },
        ],
      }),
      extractResourceMetrics({
        name: 'B',
        key: 'b',
        operations: [
          {
            id: '2',
            method: HTTP_METHOD.GET,
            kind: OPERATION_KIND.list,
            path: '/',
            responseSchema: { type: 'object' },
          },
        ],
      }),
      extractResourceMetrics({
        name: 'C',
        key: 'c',
        operations: [
          {
            id: '3',
            method: HTTP_METHOD.GET,
            kind: OPERATION_KIND.list,
            path: '/',
            responseSchema: { type: 'object' },
          },
        ],
      }),
    ];
    const spec = aggregateSpecMetrics(resources);
    const archetypes = classifySpecArchetypes(spec, resources);
    expect(archetypes).toContain(ARCHETYPES.MULTI_RESOURCE);
  });

  it('large_api: resourceCount ≥ 10', () => {
    const resources = Array.from({ length: 10 }, (_, i) =>
      extractResourceMetrics({
        name: `R${i}`,
        key: `r${i}`,
        operations: [
          {
            id: String(i),
            method: HTTP_METHOD.GET,
            kind: OPERATION_KIND.list,
            path: '/',
            responseSchema: { type: 'object' },
          },
        ],
      })
    );
    const spec = aggregateSpecMetrics(resources);
    const archetypes = classifySpecArchetypes(spec, resources);
    expect(archetypes).toContain(ARCHETYPES.LARGE_API);
  });
});
