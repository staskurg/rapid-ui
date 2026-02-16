"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UISpec, Field } from "@/lib/spec/types";
import { getCellValue } from "@/lib/utils/getCellValue";
import { Pencil, Trash2 } from "lucide-react";

interface DataTableProps {
  data: Record<string, unknown>[];
  spec: UISpec;
  onEdit?: (record: Record<string, unknown>) => void;
  onDelete?: (id: string | number) => void;
}

export function DataTable({ data, spec, onEdit, onDelete }: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Generate columns from spec
  const columns = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const fieldMap = new Map(spec.fields.map((f) => [f.name, f]));

    const cols: ColumnDef<Record<string, unknown>>[] = spec.table.columns.map(
      (fieldName) => {
        const field = fieldMap.get(fieldName);
        const accessor = {
          id: fieldName,
          accessorFn: (row: Record<string, unknown>) =>
            getCellValue(row, fieldName),
        };

        if (!field) {
          return {
            ...accessor,
            header: fieldName,
            cell: ({ getValue }: { getValue: () => unknown }) =>
              String(getValue() ?? ""),
          };
        }

        return {
          ...accessor,
          header: field.label,
          cell: ({ getValue }: { getValue: () => unknown }) => {
            const value = getValue();
            return renderCell(value, field);
          },
        };
      }
    );

    // Add actions column only when onEdit or onDelete is provided
    if (onEdit !== undefined || onDelete !== undefined) {
      const idFieldName = spec.idField ?? "id";
      cols.push({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const record = row.original;
          const recordId: string | number =
            (record[idFieldName] as string | number | undefined) ?? row.index;

          return (
            <div className="flex items-center gap-2">
              {onEdit !== undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(record)}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete !== undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(recordId)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      });
    }

    return cols;
  }, [spec, onEdit, onDelete]);

  // TanStack Table's useReactTable() returns functions that cannot be safely memoized.
  // This is a known limitation of the library API and does not affect functionality.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No records.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Render a cell value based on field type
 */
function renderCell(value: unknown, field: Field): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (typeof value === "object" && !Array.isArray(value) && value !== null) {
    const obj = value as Record<string, unknown>;
    const parts = Object.entries(obj)
      .filter(([, v]) => v != null && v !== "")
      .map(([, v]) => String(v));
    return <span>{parts.join(" · ")}</span>;
  }

  switch (field.type) {
    case "string":
      return <span>{String(value)}</span>;
    case "number":
      return <span>{Number(value).toLocaleString()}</span>;
    case "boolean":
      return (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Active" : "Inactive"}
        </Badge>
      );
    case "enum":
      return <Badge variant="outline">{String(value)}</Badge>;
    default:
      return <span>{String(value)}</span>;
  }
}
