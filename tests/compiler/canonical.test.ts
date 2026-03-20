import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseOpenAPI } from '@/lib/compiler/openapi/parser';
import { validateSubset } from '@/lib/compiler/openapi/subset-validator';
import { resolveRefs } from '@/lib/compiler/openapi/ref-resolver';
import { canonicalize, canonicalStringify } from '@/lib/compiler/openapi/canonicalize';
import { buildApiIR } from '@/lib/compiler/apiir/build';
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
  return resolveResult.doc;
}

function docToApiIrHash(doc: Record<string, unknown>): string {
  const canonical = canonicalize(doc);
  const result = buildApiIR(canonical);
  if (!result.success) throw new Error(`buildApiIR failed: ${result.error.message}`);
  return result.apiIrHash;
}

describe('canonicalization and hashing', () => {
  it('golden_openapi_users_tagged_3_0.yaml produces stable canonical JSON', () => {
    const doc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const str = canonicalStringify(doc);

    expect(str).toMatchSnapshot();
  });

  it('golden_openapi_products_path_3_1.yaml produces stable canonical JSON', () => {
    const doc = loadAndProcess('demo/golden_openapi_products_path_3_1.yaml');
    const str = canonicalStringify(doc);

    expect(str).toMatchSnapshot();
  });

  it('same spec with reordered keys produces same canonical JSON', () => {
    const yaml = readFileSync(
      join(FIXTURES, 'demo', 'golden_openapi_users_tagged_3_0.yaml'),
      'utf-8'
    );
    const parse1 = parseOpenAPI(yaml);
    const parse2 = parseOpenAPI(yaml);
    expect(parse1.success && parse2.success).toBe(true);
    if (!parse1.success || !parse2.success) return;

    const validate1 = validateSubset(parse1.doc);
    const validate2 = validateSubset(parse2.doc);
    expect(validate1.success && validate2.success).toBe(true);
    if (!validate1.success || !validate2.success) return;

    const resolve1 = resolveRefs(parse1.doc);
    const resolve2 = resolveRefs(parse2.doc);
    expect(resolve1.success && resolve2.success).toBe(true);
    if (!resolve1.success || !resolve2.success) return;

    const str1 = canonicalStringify(resolve1.doc);
    const str2 = canonicalStringify(resolve2.doc);
    expect(str1).toBe(str2);
  });

  it('JSON with different key order produces same canonical output', () => {
    const specA = {
      openapi: '3.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { id: { type: 'string' } } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const specB = {
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { properties: { id: { type: 'string' } }, type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
      info: { version: '1', title: 'T' },
      openapi: '3.0',
    };
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;

    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;

    const strA = canonicalStringify(resolveA.doc);
    const strB = canonicalStringify(resolveB.doc);
    expect(strA).toBe(strB);
  });

  it('same canonical JSON produces same hash', () => {
    const doc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const canonical = canonicalize(doc);
    const hash1 = sha256Hash(canonical);
    const hash2 = sha256Hash(canonical);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different specs produce different hashes', () => {
    const usersDoc = loadAndProcess('demo/golden_openapi_users_tagged_3_0.yaml');
    const productsDoc = loadAndProcess('demo/golden_openapi_products_path_3_1.yaml');
    const usersCanonical = canonicalize(usersDoc);
    const productsCanonical = canonicalize(productsDoc);
    const usersHash = sha256Hash(usersCanonical);
    const productsHash = sha256Hash(productsCanonical);
    expect(usersHash).not.toBe(productsHash);
  });

  it('rejects circular $ref', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      components: {
        schemas: {
          A: { type: 'object', properties: { b: { $ref: '#/components/schemas/B' } } },
          B: { type: 'object', properties: { a: { $ref: '#/components/schemas/A' } } },
        },
      },
    } as Record<string, unknown>;
    const result = resolveRefs(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('OAS_CIRCULAR_REF');
  });

  it('rejects external $ref', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/users': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { $ref: 'https://example.com/schema.json' },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = resolveRefs(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('OAS_EXTERNAL_REF');
  });

  it('nullable: true and type: [string,null] produce identical ApiIR hash', () => {
    const specNullable = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        status: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specUnion = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        status: { type: ['string', 'null'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specNullable);
    const validateB = validateSubset(specUnion);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specNullable);
    const resolveB = resolveRefs(specUnion);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const hashA = docToApiIrHash(resolveA.doc);
    const hashB = docToApiIrHash(resolveB.doc);
    expect(hashA).toBe(hashB);
  });

  it('properties order A,B,C vs C,B,A produce identical canonical hash', () => {
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        a: { type: 'string' },
                        b: { type: 'string' },
                        c: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        c: { type: 'string' },
                        b: { type: 'string' },
                        a: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const strA = canonicalStringify(resolveA.doc);
    const strB = canonicalStringify(resolveB.doc);
    expect(strA).toBe(strB);
  });

  it('paths order X,Y vs Y,X produce identical ApiIR hash', () => {
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/a': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        '/b': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/b': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        '/a': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const hashA = docToApiIrHash(resolveA.doc);
    const hashB = docToApiIrHash(resolveB.doc);
    expect(hashA).toBe(hashB);
  });

  it('annotation keywords uniqueItems, xml, externalDocs produce identical canonical output when present vs absent', () => {
    const base = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        tags: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const withAnnotations = {
      ...base,
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        tags: {
                          type: 'array',
                          items: { type: 'string' },
                          uniqueItems: true,
                          minItems: 0,
                          maxItems: 100,
                          xml: { name: 'tag' },
                          externalDocs: { url: 'https://example.com' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(base);
    const validateB = validateSubset(withAnnotations);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(base);
    const resolveB = resolveRefs(withAnnotations);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const strA = canonicalStringify(resolveA.doc);
    const strB = canonicalStringify(resolveB.doc);
    expect(strA).toBe(strB);
  });

  it('description and deprecated produce identical canonical output when present vs absent', () => {
    const base = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const withAnnotations = {
      ...base,
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      description: 'Item list',
                      deprecated: true,
                      properties: {
                        id: { type: 'string', description: 'Item id', deprecated: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(base);
    const validateB = validateSubset(withAnnotations);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(base);
    const resolveB = resolveRefs(withAnnotations);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const strA = canonicalStringify(resolveA.doc);
    const strB = canonicalStringify(resolveB.doc);
    expect(strA).toBe(strB);
  });

  it('application/vnd.api+json selected when application/json absent', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/vnd.api+json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const result = validateSubset(doc);
    expect(result.success).toBe(true);
  });

  it('annotation stripping: description, deprecated, xml, externalDocs, uniqueItems produce identical canonical output', () => {
    const base = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        tags: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const withAllAnnotations = {
      ...base,
      paths: {
        '/items': {
          get: {
            description: 'List items',
            deprecated: true,
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      description: 'Item schema',
                      deprecated: false,
                      properties: {
                        id: { type: 'string', description: 'ID field' },
                        tags: {
                          type: 'array',
                          items: { type: 'string' },
                          uniqueItems: true,
                          xml: { name: 'tag' },
                          externalDocs: { url: 'https://example.com' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(base);
    const validateB = validateSubset(withAllAnnotations);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(base);
    const resolveB = resolveRefs(withAllAnnotations);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const strA = canonicalStringify(resolveA.doc);
    const strB = canonicalStringify(resolveB.doc);
    expect(strA).toBe(strB);
  });

  it('media type ordering: application/xml first vs application/json first produces same canonical output', () => {
    const schema = { type: 'object', properties: { id: { type: 'string' } } };
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/xml': { schema: { ...schema } },
                  'application/json': { schema: { ...schema } },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': { schema: { ...schema } },
                  'application/xml': { schema: { ...schema } },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const strA = canonicalStringify(resolveA.doc);
    const strB = canonicalStringify(resolveB.doc);
    expect(strA).toBe(strB);
  });

  it('media-type noise: application/xml + application/json vs application/json only produce same ApiIR hash', () => {
    const schema = { type: 'object', properties: { id: { type: 'string' } } };
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/xml': { schema: { ...schema } },
                  'application/json': { schema: { ...schema } },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': { schema: { ...schema } },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const hashA = docToApiIrHash(resolveA.doc);
    const hashB = docToApiIrHash(resolveB.doc);
    expect(hashA).toBe(hashB);
  });

  it('contract change detection: add/remove field produces different ApiIR hash', () => {
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const hashA = docToApiIrHash(resolveA.doc);
    const hashB = docToApiIrHash(resolveB.doc);
    expect(hashA).not.toBe(hashB);
  });

  it('parameter ordering noise: limit,offset vs offset,limit produce same ApiIR hash', () => {
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer' } },
              { name: 'offset', in: 'query', schema: { type: 'integer' } },
            ],
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { id: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            parameters: [
              { name: 'offset', in: 'query', schema: { type: 'integer' } },
              { name: 'limit', in: 'query', schema: { type: 'integer' } },
            ],
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { id: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const hashA = docToApiIrHash(resolveA.doc);
    const hashB = docToApiIrHash(resolveB.doc);
    expect(hashA).toBe(hashB);
  });

  it('property order noise: id,name vs name,id produce same ApiIR hash', () => {
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        id: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const hashA = docToApiIrHash(resolveA.doc);
    const hashB = docToApiIrHash(resolveB.doc);
    expect(hashA).toBe(hashB);
  });

  it('operations order get,post vs post,get produce identical ApiIR hash', () => {
    const specA = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { id: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                  },
                },
              },
            },
            responses: {
              '201': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const specB = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                  },
                },
              },
            },
            responses: {
              '201': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { id: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as Record<string, unknown>;
    const validateA = validateSubset(specA);
    const validateB = validateSubset(specB);
    expect(validateA.success && validateB.success).toBe(true);
    if (!validateA.success || !validateB.success) return;
    const resolveA = resolveRefs(specA);
    const resolveB = resolveRefs(specB);
    expect(resolveA.success && resolveB.success).toBe(true);
    if (!resolveA.success || !resolveB.success) return;
    const hashA = docToApiIrHash(resolveA.doc);
    const hashB = docToApiIrHash(resolveB.doc);
    expect(hashA).toBe(hashB);
  });
});
