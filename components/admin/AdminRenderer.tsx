"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./DataTable";
import { FormModal } from "./FormModal";
import { FiltersPanel } from "./FiltersPanel";
import type { UISpec } from "@/lib/spec/types";
import { Plus } from "lucide-react";

interface AdminRendererProps {
  spec: UISpec;
  initialData?: Record<string, unknown>[];
}

export function AdminRenderer({ spec, initialData = [] }: AdminRendererProps) {
  const [data, setData] = React.useState<Record<string, unknown>[]>(initialData);
  const [selectedRecord, setSelectedRecord] = React.useState<Record<string, unknown> | null>(null);
  const [filters, setFilters] = React.useState<Record<string, unknown>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  // Sync internal data state when initialData changes
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Find ID field for record identification
  const getIdField = React.useCallback(() => {
    return spec.fields.find((f) => f.name === "id" || f.name === "_id")?.name || "id";
  }, [spec]);

  // Get record ID
  const getRecordId = React.useCallback((record: Record<string, unknown>): string | number => {
    const idField = getIdField();
    const id = record[idField];
    if (typeof id === "string" || typeof id === "number") {
      return id;
    }
    // Fallback: use index if no valid ID found
    return data.indexOf(record);
  }, [getIdField, data]);

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

        const recordValue = record[fieldName];

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
  const handleCreate = React.useCallback((record: Record<string, unknown>) => {
    const idField = getIdField();
    // Generate ID if not provided
    if (!record[idField]) {
      const maxId = data.reduce((max, r) => {
        const id = r[idField];
        if (typeof id === "number" && id > max) return id;
        return max;
      }, 0);
      record[idField] = maxId + 1;
    }
    setData((prev) => [...prev, record]);
    setIsCreateModalOpen(false);
  }, [data, getIdField]);

  const handleUpdate = React.useCallback((id: string | number, record: Record<string, unknown>) => {
    setData((prev) =>
      prev.map((item) => {
        const itemId = getRecordId(item);
        return itemId === id ? { ...item, ...record } : item;
      })
    );
    setSelectedRecord(null);
    setIsEditModalOpen(false);
  }, [getRecordId]);

  const handleDelete = React.useCallback((id: string | number) => {
    setData((prev) => prev.filter((item) => getRecordId(item) !== id));
  }, [getRecordId]);

  const handleEdit = React.useCallback((record: Record<string, unknown>) => {
    setSelectedRecord(record);
    setIsEditModalOpen(true);
  }, []);

  const handleFilterChange = React.useCallback((newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{spec.entity} Management</h1>
          <p className="text-muted-foreground">
            Manage {spec.entity.toLowerCase()} records with full CRUD operations
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create {spec.entity}
        </Button>
      </div>

      {/* Filters Panel */}
      {spec.filters.length > 0 && (
        <FiltersPanel spec={spec} filters={filters} onFilterChange={handleFilterChange} />
      )}

      {/* Data Table */}
      <DataTable
        data={filteredData}
        spec={spec}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

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
