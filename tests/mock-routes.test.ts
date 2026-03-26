import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompilationEntry } from '@/lib/db/compilations';

const { getCompilationMock, getRecordsMock, getByIdMock } = vi.hoisted(() => ({
  getCompilationMock: vi.fn(),
  getRecordsMock: vi.fn(),
  getByIdMock: vi.fn(),
}));

vi.mock('@/lib/compiler/store', () => ({
  getCompilation: getCompilationMock,
}));

vi.mock('@/lib/compiler/mock/store', () => ({
  getRecords: getRecordsMock,
  getById: getByIdMock,
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
}));

import { GET as getCollectionRoute } from '@/app/api/mock/[id]/[resource]/route';
import { GET as getItemRoute } from '@/app/api/mock/[id]/[resource]/[paramId]/route';

function makeCompilationEntry(): CompilationEntry {
  return {
    accountId: 'acct-1',
    openapiCanonicalHash: 'hash-1',
    resourceNames: ['Orders'],
    resourceSlugs: ['orders'],
    specs: {
      orders: {
        entity: 'Orders',
        fields: [
          { name: 'id', label: 'ID', type: 'string', required: true },
          { name: 'total', label: 'Total', type: 'number', required: false },
        ],
        table: { columns: ['id', 'total'] },
        form: { fields: ['total'] },
        filters: [],
        idField: 'id',
      },
    },
    apiIr: {
      apiIrVersion: 1,
      api: { title: 'T', version: '1' },
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
          ],
        },
      ],
    },
  };
}

describe('mock routes phase-6 scope vs row behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collection route uses listScoped schema for records', async () => {
    const entry = makeCompilationEntry();
    getCompilationMock.mockResolvedValue(entry);
    getRecordsMock.mockReturnValue([{ id: 'row-1', total: 42 }]);

    const response = await getCollectionRoute(new Request('http://local/mock') as never, {
      params: Promise.resolve({ id: 'comp-1', resource: 'orders' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 'row-1', total: 42 }]);
    expect(getRecordsMock).toHaveBeenCalledTimes(1);
    expect(getRecordsMock.mock.calls[0]?.[0]).toBe('acct-1');
    expect(getRecordsMock.mock.calls[0]?.[1]).toBe('comp-1');
    expect(getRecordsMock.mock.calls[0]?.[2]).toBe('orders');
    expect(getRecordsMock.mock.calls[0]?.[3]).toEqual(
      entry.apiIr.resources[0]?.operations[0]?.responseSchema
    );
  });

  it('item route returns 404 for listScoped-only when row is missing', async () => {
    const entry = makeCompilationEntry();
    getCompilationMock.mockResolvedValue(entry);
    getByIdMock.mockReturnValue(undefined);

    const response = await getItemRoute(new Request('http://local/mock') as never, {
      params: Promise.resolve({
        id: 'comp-1',
        resource: 'orders',
        paramId: 'scope-123',
      }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock.mock.calls[0]?.[6]).toBe('scope-123');
  });
});
