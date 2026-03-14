"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./DataTable";
import { FormModal } from "./FormModal";
import { FiltersPanel } from "./FiltersPanel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UISpec } from "@/lib/spec/types";
import type { CrudAdapter } from "@/lib/adapters";
import type { Capabilities } from "@/lib/compiler/apiir";
import { getCellValue } from "@/lib/utils/getCellValue";
import { Plus, Loader2 } from "lucide-react";
import {
  resolveNavigation,
  normalizeAdapterCapabilities,
  MODE_TABLE,
  MODE_IDENTITY,
  MODE_FORM,
  type RendererMode,
} from "./navigation";
import { RendererInvariantError } from "@/lib/renderer/errors";

interface SchemaRendererProps {
  spec: UISpec;
  initialData?: Record<string, unknown>[];
  adapter?: CrudAdapter;
  /** Full capabilities from ApiIR; used for capability-driven layout. */
  capabilities?: Capabilities;
  /** Path param names for identity lookup; used for IdentityLayout. */
  identityFields?: string[];
  /** When changed, triggers a refetch (e.g. after reset). */
  refreshTrigger?: number;
}

export function SchemaRenderer({
  spec,
  initialData = [],
  adapter,
  capabilities: capabilitiesProp,
  identityFields: identityFieldsProp,
  refreshTrigger,
}: SchemaRendererProps) {
  const identityFields = React.useMemo(
    () => identityFieldsProp ?? [],
    [identityFieldsProp]
  );

  // Capabilities resolution: prop overrides; never merge; never invent
  const capabilities: Capabilities = React.useMemo(() => {
    if (capabilitiesProp) return capabilitiesProp;
    if (adapter?.capabilities)
      return normalizeAdapterCapabilities(adapter.capabilities);
    throw new RendererInvariantError("Missing capabilities");
  }, [capabilitiesProp, adapter?.capabilities]);

  const mode: RendererMode = resolveNavigation(capabilities);

  // Assert: identity mode requires identityFields
  if (mode === MODE_IDENTITY && identityFields.length === 0) {
    throw new RendererInvariantError(
      "Identity mode requires identityFields.length > 0"
    );
  }

  // Guard: identity mode with adapter requires getById
  if (
    mode === MODE_IDENTITY &&
    adapter &&
    typeof adapter.getById !== "function"
  ) {
    throw new RendererInvariantError(
      "Adapter missing getById for identity mode"
    );
  }

  const [data, setData] = React.useState<Record<string, unknown>[]>(initialData);
  const [selectedRecord, setSelectedRecord] = React.useState<Record<string, unknown> | null>(null);
  const [editRecord, setEditRecord] = React.useState<Record<string, unknown> | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [filters, setFilters] = React.useState<Record<string, unknown>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | number | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(!!adapter && !!capabilities.list);
  const [error, setError] = React.useState<string | null>(null);

  // Identity mode state
  const [lookupValues, setLookupValues] = React.useState<Record<string, string>>({});
  const [lookedUpRecord, setLookedUpRecord] = React.useState<Record<string, unknown> | null>(null);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  const idField = spec.idField ?? "id";

  // List fetch: only when adapter && capabilities.list
  React.useEffect(() => {
    if (!adapter || !capabilities.list) return;
    let cancelled = false;
    const startTime = Date.now();
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
        if (!cancelled) {
          const elapsed = Date.now() - startTime;
          const minLoading = 500;
          if (elapsed < minLoading) {
            setTimeout(() => setLoading(false), minLoading - elapsed);
          } else {
            setLoading(false);
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, capabilities.list]);

  // initialData mode: sync when initialData changes (no adapter)
  React.useEffect(() => {
    if (!adapter) {
      setData(initialData);
    }
  }, [adapter, initialData]);

  const refetch = React.useCallback(async () => {
    if (!adapter || !capabilities.list) return;
    setError(null);
    try {
      const records = await adapter.list();
      setData(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, [adapter, capabilities.list]);

  // Refetch when refreshTrigger changes (e.g. after reset)
  React.useEffect(() => {
    if (adapter && capabilities.list && (refreshTrigger ?? 0) > 0) {
      refetch();
    }
  }, [adapter, capabilities.list, refreshTrigger, refetch]);

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
      return (spec.filters ?? []).every((fieldName) => {
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
      const payload = record;
      if (adapter?.create) {
        setError(null);
        try {
          await adapter.create(payload);
          setIsCreateModalOpen(false);
          await refetch();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Create failed");
          throw err;
        }
      } else {
        const id = spec.idField ?? "id";
        if (!payload[id]) {
          const maxId = data.reduce((max, r) => {
            const v = r[id];
            if (typeof v === "number" && v > max) return v;
            return max;
          }, 0);
          payload[id] = maxId + 1;
        }
        setData((prev) => [...prev, payload]);
        setIsCreateModalOpen(false);
      }
    },
    [adapter, data, refetch, spec.idField]
  );

  const handleUpdate = React.useCallback(
    async (id: string | number, record: Record<string, unknown>) => {
      const payload = record;
      if (adapter?.update) {
        setError(null);
        try {
          await adapter.update(id, payload);
          setSelectedRecord(null);
          setEditRecord(null);
          setIsEditModalOpen(false);
          setLookedUpRecord(null);
          await refetch();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Update failed");
          throw err;
        }
      } else {
        setData((prev) =>
          prev.map((item) => {
            const itemId = getRecordId(item);
            return itemId === id ? { ...item, ...payload } : item;
          })
        );
        setSelectedRecord(null);
        setEditRecord(null);
        setIsEditModalOpen(false);
        setLookedUpRecord(null);
      }
    },
    [adapter, getRecordId, refetch]
  );

  const handleDeleteRequest = React.useCallback((id: string | number) => {
    setDeleteTargetId(id);
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (deleteTargetId === null) return;
    const id = deleteTargetId;
    if (adapter?.remove) {
      setError(null);
      setDeleteLoading(true);
      try {
        await adapter.remove(id);
        setDeleteTargetId(null);
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setDeleteLoading(false);
      }
    } else {
      setData((prev) => prev.filter((item) => getRecordId(item) !== id));
      setDeleteTargetId(null);
    }
  }, [adapter, deleteTargetId, getRecordId, refetch]);

  const handleEdit = React.useCallback(
    async (record: Record<string, unknown>) => {
      setSelectedRecord(record);
      setIsEditModalOpen(true);
      if (adapter?.getById) {
        setEditLoading(true);
        setEditRecord(null);
        try {
          const id = getRecordId(record);
          const fresh = await adapter.getById(id);
          setEditRecord(fresh);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load record");
          setEditRecord(record);
        } finally {
          setEditLoading(false);
        }
      } else {
        setEditRecord(record);
      }
    },
    [adapter, getRecordId]
  );

  const handleFilterChange = React.useCallback((newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  }, []);

  // Identity mode: lookup handler
  const handleIdentityLookup = React.useCallback(
    async (action: "view" | "edit") => {
      const idValue = lookupValues[identityFields[0]];
      if (idValue === undefined || idValue === "") return;
      const id = /^\d+$/.test(idValue) ? Number(idValue) : idValue;
      if (!adapter?.getById) return;

      setLookupError(null);
      setLookupLoading(true);
      try {
        const record = await adapter.getById(id);
        setLookedUpRecord(record);
        if (action === "edit" || !spec.detail) {
          setSelectedRecord(record);
          setEditRecord(record);
          setIsEditModalOpen(true);
        }
      } catch (err) {
        setLookupError(err instanceof Error ? err.message : "Failed to load record");
      } finally {
        setLookupLoading(false);
      }
    },
    [adapter, identityFields, lookupValues, spec.detail]
  );

  const handleIdentityLookupChange = React.useCallback(
    (field: string, value: string) => {
      setLookupValues((prev) => ({ ...prev, [field]: value }));
      setLookedUpRecord(null);
      setLookupError(null);
    },
    []
  );

  const closeIdentityEdit = React.useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedRecord(null);
    setEditRecord(null);
    setLookedUpRecord(null);
  }, []);

  const displayError = error ?? lookupError;

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {displayError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {displayError}
        </div>
      )}

      {/* Read-only preview banner (external API) */}
      {adapter?.mode === "external" && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          Read-only preview — external API does not support create, edit, or delete
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{spec.entity} Management</h1>
          <p className="text-muted-foreground">
            {capabilities.create || capabilities.update || capabilities.delete
              ? `Manage ${spec.entity.toLowerCase()} records with full CRUD operations`
              : `View ${spec.entity.toLowerCase()} records`}
          </p>
        </div>
        {capabilities.create && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create {spec.entity}
          </Button>
        )}
      </div>

      {/* Mode-based rendering */}
      {mode === MODE_TABLE && (
        <>
          {/* Filters Panel */}
          {(spec.filters ?? []).length > 0 && (
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
              onDelete={capabilities.delete ? handleDeleteRequest : undefined}
            />
          )}
        </>
      )}

      {mode === MODE_IDENTITY && (
        <>
          {/* IdentityLookup (inline) */}
          <div className="flex flex-wrap items-end gap-2" data-testid="identity-lookup">
            {identityFields.map((field) => {
              const fieldDef = spec.fields.find((f) => f.name === field);
              return (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-sm font-medium">{fieldDef?.label ?? field}</label>
                  <input
                    type="text"
                    className="rounded-md border px-3 py-2 text-sm"
                    value={lookupValues[field] ?? ""}
                    onChange={(e) => handleIdentityLookupChange(field, e.target.value)}
                    placeholder={`Enter ${fieldDef?.label ?? field}`}
                    data-testid={`identity-input-${field}`}
                  />
                </div>
              );
            })}
            <div className="flex gap-2">
              {spec.detail && (
                <Button
                  onClick={() => handleIdentityLookup("view")}
                  disabled={lookupLoading}
                  data-testid="identity-view-btn"
                >
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "View"}
                </Button>
              )}
              {(capabilities.update || !spec.detail) && (
                <Button
                  onClick={() => handleIdentityLookup("edit")}
                  disabled={lookupLoading}
                  data-testid="identity-edit-btn"
                >
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Edit"}
                </Button>
              )}
            </div>
          </div>

          {/* DetailView (inline) when spec.detail exists and record loaded */}
          {spec.detail && lookedUpRecord && !isEditModalOpen && (
            <div className="rounded-md border p-4" data-testid="detail-view">
              {spec.detail.fields.map((fieldName) => {
                const field = spec.fields.find((f) => f.name === fieldName);
                const value = getCellValue(lookedUpRecord, fieldName);
                return (
                  <div key={fieldName} className="flex gap-2 py-1">
                    <span className="font-medium text-muted-foreground">
                      {field?.label ?? fieldName}:
                    </span>
                    <span>{String(value ?? "")}</span>
                  </div>
                );
              })}
              {capabilities.update && (
                <Button
                  className="mt-2"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRecord(lookedUpRecord);
                    setEditRecord(lookedUpRecord);
                    setIsEditModalOpen(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {mode === MODE_FORM && (
        <p className="text-muted-foreground">
          Use the Create button above to add a new {spec.entity.toLowerCase()}.
        </p>
      )}

      {/* Create Modal — when create capability */}
      {capabilities.create && (
        <FormModal
          spec={spec}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreate}
          mode="create"
        />
      )}

      {/* Edit Modal — when update capability (table or identity mode) */}
      {capabilities.update && (
        <FormModal
          spec={spec}
          isOpen={isEditModalOpen}
          onClose={
            mode === MODE_IDENTITY
              ? closeIdentityEdit
              : () => {
                  setIsEditModalOpen(false);
                  setSelectedRecord(null);
                  setEditRecord(null);
                }
          }
          onSubmit={(record: Record<string, unknown>) => {
            const recordForId = editRecord ?? selectedRecord;
            if (recordForId) {
              const id = getRecordId(recordForId);
              return handleUpdate(id, record);
            }
          }}
          initialValues={
            editRecord ?? selectedRecord
              ? (editRecord ?? selectedRecord) as Record<string, unknown>
              : undefined
          }
          mode="edit"
          isLoadingInitialValues={editLoading}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={() => handleDeleteConfirm()}
              data-testid="delete-confirm"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
