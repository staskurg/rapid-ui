"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./DataTable";
import { FormModal } from "./FormModal";
import { FiltersPanel } from "./FiltersPanel";
import type { UISpec } from "@/lib/spec/types";
import type { CrudAdapter } from "@/lib/adapters";
import { getCellValue } from "@/lib/utils/getCellValue";
import { Plus, Loader2 } from "lucide-react";

interface SchemaRendererProps {
  spec: UISpec;
  initialData?: Record<string, unknown>[];
  adapter?: CrudAdapter;
  /** When changed, triggers a refetch (e.g. after reset). */
  refreshTrigger?: number;
}

export function SchemaRenderer({ spec, initialData = [], adapter, refreshTrigger }: SchemaRendererProps) {
  const [data, setData] = React.useState<Record<string, unknown>[]>(initialData);
  const [selectedRecord, setSelectedRecord] = React.useState<Record<string, unknown> | null>(null);
  const [filters, setFilters] = React.useState<Record<string, unknown>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(!!adapter);
  const [error, setError] = React.useState<string | null>(null);

  const idField = spec.idField ?? "id";
  const capabilities = adapter?.capabilities ?? {
    create: true,
    read: true,
    update: true,
    delete: true,
  };

  // Adapter mode: fetch list on mount and when adapter changes
  React.useEffect(() => {
    if (!adapter) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    adapter
      .list()
      .then((records) => {
        if (!cancelled) {
          setData(records);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  // initialData mode: sync when initialData changes
  React.useEffect(() => {
    if (!adapter) {
      setData(initialData);
    }
  }, [adapter, initialData]);

  const refetch = React.useCallback(async () => {
    if (!adapter) return;
    setError(null);
    try {
      const records = await adapter.list();
      setData(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, [adapter]);

  // Refetch when refreshTrigger changes (e.g. after reset)
  React.useEffect(() => {
    if (adapter && (refreshTrigger ?? 0) > 0) {
      refetch();
    }
  }, [adapter, refreshTrigger, refetch]);

  // Get record ID
  const getRecordId = React.useCallback(
    (record: Record<string, unknown>): string | number => {
      const id = record[idField];
      if (typeof id === "string" || typeof id === "number") {
        return id;
      }
      return data.indexOf(record);
    },
    [idField, data]
  );

  // Filter data based on current filters
  const filteredData = React.useMemo(() => {
    if (Object.keys(filters).length === 0) {
      return data;
    }

    return data.filter((record) => {
      return spec.filters.every((fieldName) => {
        const filterValue = filters[fieldName];
        if (filterValue === undefined || filterValue === null || filterValue === "") {
          return true; // No filter applied for this field
        }

        const field = spec.fields.find((f) => f.name === fieldName);
        if (!field) return true;

        const recordValue = getCellValue(record, fieldName);

        switch (field.type) {
          case "string":
            // String search (case-insensitive)
            const searchStr = String(filterValue).toLowerCase();
            return String(recordValue || "").toLowerCase().includes(searchStr);
          
          case "number":
            // Number range filter
            if (typeof filterValue === "object" && filterValue !== null) {
              const range = filterValue as { min?: number; max?: number };
              const numValue = Number(recordValue);
              if (range.min !== undefined && numValue < range.min) return false;
              if (range.max !== undefined && numValue > range.max) return false;
              return true;
            }
            return true;
          
          case "boolean":
            // Boolean exact match
            return recordValue === filterValue;
          
          case "enum":
            // Enum exact match
            return recordValue === filterValue;
          
          default:
            return true;
        }
      });
    });
  }, [data, filters, spec]);

  // CRUD handlers
  const handleCreate = React.useCallback(
    async (record: Record<string, unknown>) => {
      if (adapter?.create) {
        setError(null);
        try {
          await adapter.create(record);
          setIsCreateModalOpen(false);
          await refetch();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Create failed");
        }
      } else {
        const id = spec.idField ?? "id";
        if (!record[id]) {
          const maxId = data.reduce((max, r) => {
            const v = r[id];
            if (typeof v === "number" && v > max) return v;
            return max;
          }, 0);
          record[id] = maxId + 1;
        }
        setData((prev) => [...prev, record]);
        setIsCreateModalOpen(false);
      }
    },
    [adapter, data, refetch, spec.idField]
  );

  const handleUpdate = React.useCallback(
    async (id: string | number, record: Record<string, unknown>) => {
      if (adapter?.update) {
        setError(null);
        try {
          await adapter.update(id, record);
          setSelectedRecord(null);
          setIsEditModalOpen(false);
          await refetch();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Update failed");
        }
      } else {
        setData((prev) =>
          prev.map((item) => {
            const itemId = getRecordId(item);
            return itemId === id ? { ...item, ...record } : item;
          })
        );
        setSelectedRecord(null);
        setIsEditModalOpen(false);
      }
    },
    [adapter, getRecordId, refetch]
  );

  const handleDelete = React.useCallback(
    async (id: string | number) => {
      if (adapter?.remove) {
        setError(null);
        try {
          await adapter.remove(id);
          await refetch();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Delete failed");
        }
      } else {
        setData((prev) => prev.filter((item) => getRecordId(item) !== id));
      }
    },
    [adapter, getRecordId, refetch]
  );

  const handleEdit = React.useCallback((record: Record<string, unknown>) => {
    setSelectedRecord(record);
    setIsEditModalOpen(true);
  }, []);

  const handleFilterChange = React.useCallback((newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{spec.entity} Management</h1>
          <p className="text-muted-foreground">
            Manage {spec.entity.toLowerCase()} records with full CRUD operations
          </p>
        </div>
        {capabilities.create && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create {spec.entity}
          </Button>
        )}
      </div>

      {/* Filters Panel */}
      {spec.filters.length > 0 && (
        <FiltersPanel spec={spec} filters={filters} onFilterChange={handleFilterChange} />
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center rounded-md border py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={filteredData}
          spec={spec}
          onEdit={capabilities.update ? handleEdit : undefined}
          onDelete={capabilities.delete ? handleDelete : undefined}
        />
      )}

      {/* Create Modal */}
      <FormModal
        spec={spec}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreate}
        mode="create"
      />

      {/* Edit Modal */}
      <FormModal
        spec={spec}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedRecord(null);
        }}
        onSubmit={(record: Record<string, unknown>) => {
          if (selectedRecord) {
            const id = getRecordId(selectedRecord);
            handleUpdate(id, record);
          }
        }}
        initialValues={selectedRecord || undefined}
        mode="edit"
      />
    </div>
  );
}
