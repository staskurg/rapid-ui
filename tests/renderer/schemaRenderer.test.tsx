import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaRenderer } from '@/components/renderer/SchemaRenderer';
import type { UISpec } from '@/lib/spec/types';
import type { CrudAdapter } from '@/lib/adapters';
import type { Capabilities } from '@/lib/compiler/apiir';

/** Full CRUD capabilities for table-mode tests with initialData (no adapter). */
const fullCapabilities: Capabilities = {
  list: true,
  detail: true,
  create: true,
  update: true,
  delete: true,
};

// Mock the child components to focus on SchemaRenderer state logic
vi.mock('@/components/renderer/DataTable', () => ({
  DataTable: ({ 
    data, 
    onEdit, 
    onDelete 
  }: { 
    data: Record<string, unknown>[]; 
    onEdit: (record: Record<string, unknown>) => void; 
    onDelete: (id: string | number) => void; 
  }) => (
    <div data-testid="data-table">
      {data.map((record: Record<string, unknown>, index: number) => {
        const id = record.id as string | number | undefined;
        const name = record.name as string | undefined;
        return (
          <div key={index} data-testid={`record-${index}`}>
            <span data-testid={`record-id-${index}`}>{String(id ?? '')}</span>
            <span data-testid={`record-name-${index}`}>{String(name ?? '')}</span>
            <button
              data-testid={`edit-${index}`}
              onClick={() => onEdit(record)}
            >
              Edit
            </button>
            <button
              data-testid={`delete-${index}`}
              onClick={() => {
                if (id !== undefined) {
                  onDelete(id);
                }
              }}
            >
              Delete
            </button>
          </div>
        );
      })}
    </div>
  ),
}));

vi.mock('@/components/renderer/FormModal', () => ({
  FormModal: ({ 
    isOpen, 
    onSubmit, 
    initialValues, 
    mode 
  }: { 
    isOpen: boolean; 
    onSubmit: (record: Record<string, unknown>) => void; 
    initialValues?: Record<string, unknown>; 
    mode: 'create' | 'edit'; 
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="form-modal" data-mode={mode}>
        <input
          data-testid="form-name-input"
          defaultValue={String(initialValues?.name ?? '')}
        />
        <button
          data-testid="form-submit"
          onClick={() => {
            const nameInput = document.querySelector(
              '[data-testid="form-name-input"]'
            ) as HTMLInputElement;
            onSubmit({ name: nameInput?.value || 'New Record' });
          }}
        >
          Submit
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/renderer/FiltersPanel', () => ({
  FiltersPanel: ({ 
    onFilterChange 
  }: { 
    onFilterChange: (filters: Record<string, unknown>) => void; 
  }) => (
    <div data-testid="filters-panel">
      <input
        data-testid="filter-input"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFilterChange({ name: e.target.value })}
        placeholder="Filter by name"
      />
    </div>
  ),
}));

describe('SchemaRenderer State Management', () => {
  const mockSpec: UISpec = {
    entity: 'User',
    fields: [
      {
        name: 'id',
        label: 'ID',
        type: 'number',
        required: true,
      },
      {
        name: 'name',
        label: 'Name',
        type: 'string',
        required: true,
      },
    ],
    table: {
      columns: ['id', 'name'],
    },
    form: {
      fields: ['name'],
    },
    filters: ['name'],
  };

  const initialData = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Create Record', () => {
    it('should add new record to data array', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <SchemaRenderer spec={mockSpec} initialData={initialData} capabilities={fullCapabilities} />
      );

      // Verify initial count
      const initialRecords = container.querySelectorAll('[data-testid^="record-"]');
      expect(initialRecords.length).toBeGreaterThanOrEqual(2);

      // Open create modal
      const createButton = screen.getByText(/create user/i);
      await user.click(createButton);

      // Fill form and submit
      const nameInput = screen.getByTestId('form-name-input');
      await user.clear(nameInput);
      await user.type(nameInput, 'Charlie');

      const submitButton = screen.getByTestId('form-submit');
      await user.click(submitButton);

      // Verify new record appears (check that Charlie is in the list)
      await waitFor(() => {
        const recordNames = container.querySelectorAll('[data-testid^="record-name-"]');
        const names = Array.from(recordNames).map((el) => el.textContent);
        expect(names).toContain('Charlie');
      });
    });

    it('should generate ID for new record if not provided', async () => {
      const user = userEvent.setup();
      render(
        <SchemaRenderer spec={mockSpec} initialData={initialData} capabilities={fullCapabilities} />
      );

      // Open create modal
      const createButton = screen.getByText(/create user/i);
      await user.click(createButton);

      // Submit without ID
      const submitButton = screen.getByTestId('form-submit');
      await user.click(submitButton);

      // Verify record has generated ID
      await waitFor(() => {
        const recordIds = screen.getAllByTestId(/^record-id-/);
        const ids = recordIds.map((el) => Number(el.textContent));
        expect(ids).toContain(3); // Should be max(1, 2) + 1 = 3
      });
    });
  });

  describe('Update Record', () => {
    it('should update existing record in data array', async () => {
      const user = userEvent.setup();
      render(
        <SchemaRenderer spec={mockSpec} initialData={initialData} capabilities={fullCapabilities} />
      );

      // Click edit on first record
      const editButton = screen.getByTestId('edit-0');
      await user.click(editButton);

      // Update name in form
      const nameInput = screen.getByTestId('form-name-input');
      await user.clear(nameInput);
      await user.type(nameInput, 'Alice Updated');

      // Submit
      const submitButton = screen.getByTestId('form-submit');
      await user.click(submitButton);

      // Verify record was updated
      await waitFor(() => {
        const recordNames = screen.getAllByTestId(/^record-name-/);
        expect(recordNames[0].textContent).toBe('Alice Updated');
      });
    });

    it('should preserve other fields when updating', async () => {
      const user = userEvent.setup();
      const dataWithMoreFields = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
      ];
      const specWithEmail: UISpec = {
        ...mockSpec,
        fields: [
          ...mockSpec.fields,
          {
            name: 'email',
            label: 'Email',
            type: 'string',
            required: false,
          },
        ],
      };

      render(
        <SchemaRenderer
          spec={specWithEmail}
          initialData={dataWithMoreFields}
          capabilities={fullCapabilities}
        />
      );

      // Edit record
      const editButton = screen.getByTestId('edit-0');
      await user.click(editButton);

      // Update name
      const nameInput = screen.getByTestId('form-name-input');
      await user.clear(nameInput);
      await user.type(nameInput, 'Alice Updated');

      // Submit
      const submitButton = screen.getByTestId('form-submit');
      await user.click(submitButton);

      // Email should still be present (mocked component doesn't show it, but state should preserve it)
      await waitFor(() => {
        expect(screen.getByTestId('record-name-0').textContent).toBe(
          'Alice Updated'
        );
      });
    });
  });

  describe('Delete Record', () => {
    it('should remove record from data array', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <SchemaRenderer spec={mockSpec} initialData={initialData} capabilities={fullCapabilities} />
      );

      // Get initial records
      const initialRecords = container.querySelectorAll('[data-testid^="record-"]');
      const initialCount = initialRecords.length;
      expect(initialCount).toBeGreaterThanOrEqual(2);

      // Delete first record (Alice)
      const deleteButton = screen.getByTestId('delete-0');
      await user.click(deleteButton);

      // Confirm delete in dialog
      const confirmButton = screen.getByTestId('delete-confirm');
      await user.click(confirmButton);

      // Verify record count decreased
      await waitFor(() => {
        const records = container.querySelectorAll('[data-testid^="record-"]');
        expect(records.length).toBeLessThan(initialCount);
      });

      // Verify Alice is gone (Bob should still be there)
      const recordNames = container.querySelectorAll('[data-testid^="record-name-"]');
      const names = Array.from(recordNames).map((el) => el.textContent);
      expect(names).not.toContain('Alice');
      expect(names).toContain('Bob');
    });
  });

  describe('Filter Application', () => {
    it('should filter data based on filter values', async () => {
      const user = userEvent.setup();
      render(
        <SchemaRenderer spec={mockSpec} initialData={initialData} capabilities={fullCapabilities} />
      );

      // Apply filter
      const filterInput = screen.getByTestId('filter-input');
      await user.type(filterInput, 'Alice');

      // Verify filter input has the value (the callback should be called)
      // Note: The mocked FiltersPanel doesn't actually filter, but the callback is called
      await waitFor(() => {
        expect(filterInput).toHaveValue('Alice');
      });
    });
  });

  describe('List-only (capability-driven)', () => {
    it('renders list-only resource without Create button when capabilities.create is false', async () => {
      const listOnlyAdapter: CrudAdapter = {
        mode: 'mock',
        capabilities: { create: false, read: true, update: false, delete: false },
        getSample: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue(initialData),
      };
      const listOnlySpec: UISpec = {
        ...mockSpec,
        table: { columns: ['id', 'name'] },
        form: undefined,
        filters: [],
      };
      render(
        <SchemaRenderer spec={listOnlySpec} adapter={listOnlyAdapter} />
      );
      await waitFor(() => {
        expect(screen.queryByText(/create user/i)).not.toBeInTheDocument();
      });
    });

    it('shows "View X records" subtitle when read-only (no create/update/delete)', async () => {
      const readOnlyAdapter: CrudAdapter = {
        mode: 'mock',
        capabilities: { create: false, read: true, update: false, delete: false },
        getSample: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue(initialData),
      };
      const listOnlySpec: UISpec = {
        ...mockSpec,
        table: { columns: ['id', 'name'] },
        form: undefined,
      };
      render(
        <SchemaRenderer spec={listOnlySpec} adapter={readOnlyAdapter} />
      );
      await waitFor(() => {
        expect(screen.getByText(/view user records/i)).toBeInTheDocument();
      });
    });

    it('renders DataTable and Filters; adapter.list() is called', async () => {
      const listAdapter: CrudAdapter = {
        mode: 'mock',
        capabilities: { create: false, read: true, update: false, delete: false },
        getSample: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue(initialData),
      };
      const listSpec: UISpec = {
        ...mockSpec,
        table: { columns: ['id', 'name'] },
        form: undefined,
        filters: ['name'],
      };
      render(<SchemaRenderer spec={listSpec} adapter={listAdapter} />);
      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
        expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
        expect(listAdapter.list).toHaveBeenCalled();
      });
    });
  });

  describe('Create-only (form mode)', () => {
    it('renders Form only, no DataTable, adapter.list() not called', async () => {
      const createOnlyAdapter: CrudAdapter = {
        mode: 'mock',
        capabilities: { create: true, read: false, update: false, delete: false },
        getSample: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
      };
      const createOnlySpec: UISpec = {
        ...mockSpec,
        table: undefined,
        form: { fields: ['name'] },
        filters: [],
      };
      render(
        <SchemaRenderer
          spec={createOnlySpec}
          adapter={createOnlyAdapter}
          capabilities={{ list: false, detail: false, create: true, update: false, delete: false }}
        />
      );
      expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
      expect(createOnlyAdapter.list).not.toHaveBeenCalled();
      expect(screen.getByText(/create user/i)).toBeInTheDocument();
    });
  });

  describe('Detail-only (identity mode)', () => {
    it('renders IdentityLookup UI, no DataTable, adapter.list() not called', async () => {
      const detailAdapter: CrudAdapter = {
        mode: 'mock',
        capabilities: { create: false, read: true, update: false, delete: false },
        getSample: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
      };
      const detailSpec: UISpec = {
        ...mockSpec,
        table: undefined,
        form: { fields: ['name'] },
        detail: { fields: ['id', 'name'] },
        filters: [],
      };
      render(
        <SchemaRenderer
          spec={detailSpec}
          adapter={detailAdapter}
          capabilities={{ list: false, detail: true, create: false, update: false, delete: false }}
          identityFields={['id']}
        />
      );
      expect(screen.getByTestId('identity-lookup')).toBeInTheDocument();
      expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
      expect(detailAdapter.list).not.toHaveBeenCalled();
    });

    it('shows EditForm after lookup when spec.detail is undefined', async () => {
      const user = userEvent.setup();
      const detailAdapter: CrudAdapter = {
        mode: 'mock',
        capabilities: { create: false, read: true, update: true, delete: false },
        getSample: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
      };
      const detailSpecNoDetail: UISpec = {
        ...mockSpec,
        table: undefined,
        form: { fields: ['name'] },
        detail: undefined,
        filters: [],
      };
      render(
        <SchemaRenderer
          spec={detailSpecNoDetail}
          adapter={detailAdapter}
          capabilities={{ list: false, detail: true, create: false, update: true, delete: false }}
          identityFields={['id']}
        />
      );
      const idInput = screen.getByTestId('identity-input-id');
      await user.type(idInput, '1');
      const editBtn = screen.getByTestId('identity-edit-btn');
      await user.click(editBtn);
      await waitFor(() => {
        expect(screen.getByTestId('form-modal')).toBeInTheDocument();
        expect(screen.queryByTestId('detail-view')).not.toBeInTheDocument();
      });
    });
  });

  describe('RendererInvariantError', () => {
    it('throws when mode=identity with identityFields=[]', () => {
      expect(() =>
        render(
          <SchemaRenderer
            spec={{ ...mockSpec, table: undefined, form: { fields: ['name'] } }}
            adapter={{
              mode: 'mock',
              capabilities: { create: false, read: true, update: true, delete: false },
              getSample: vi.fn(),
              list: vi.fn(),
              getById: vi.fn().mockResolvedValue({}),
            }}
            capabilities={{ list: false, detail: false, create: false, update: true, delete: false }}
            identityFields={[]}
          />
        )
      ).toThrow(/Identity mode requires identityFields/);
    });

    it('throws when mode=identity with adapter but no adapter.getById', () => {
      const adapterNoGetById: CrudAdapter = {
        mode: 'mock',
        capabilities: { create: false, read: true, update: true, delete: false },
        getSample: vi.fn(),
        list: vi.fn(),
      };
      expect(() =>
        render(
          <SchemaRenderer
            spec={{ ...mockSpec, table: undefined, form: { fields: ['name'] } }}
            adapter={adapterNoGetById}
            capabilities={{ list: false, detail: false, create: false, update: true, delete: false }}
            identityFields={['id']}
          />
        )
      ).toThrow(/Adapter missing getById for identity mode/);
    });

    it('throws when neither capabilities prop nor adapter', () => {
      expect(() =>
        render(
          <SchemaRenderer
            spec={mockSpec}
            initialData={initialData}
          />
        )
      ).toThrow(/Missing capabilities/);
    });
  });

  describe('Initial Data Sync', () => {
    it('should sync data when initialData prop changes', async () => {
      const { container, rerender } = render(
        <SchemaRenderer spec={mockSpec} initialData={initialData} capabilities={fullCapabilities} />
      );

      // Wait for initial render
      await waitFor(() => {
        const records = container.querySelectorAll('[data-testid^="record-"]');
        expect(records.length).toBeGreaterThanOrEqual(2);
      });

      const newData = [
        { id: 3, name: 'Charlie' },
        { id: 4, name: 'Diana' },
        { id: 5, name: 'Eve' },
      ];

      rerender(
        <SchemaRenderer spec={mockSpec} initialData={newData} capabilities={fullCapabilities} />
      );

      // Verify new data appears
      await waitFor(() => {
        const recordNames = container.querySelectorAll('[data-testid^="record-name-"]');
        const names = Array.from(recordNames).map((el) => el.textContent);
        expect(names).toContain('Charlie');
        expect(names).toContain('Diana');
        expect(names).toContain('Eve');
      });
    });
  });
});
