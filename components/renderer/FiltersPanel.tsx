"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { UISpec, Field } from "@/lib/spec/types";
import { X } from "lucide-react";

interface FiltersPanelProps {
  spec: UISpec;
  filters: Record<string, unknown>;
  onFilterChange: (filters: Record<string, unknown>) => void;
}

export function FiltersPanel({
  spec,
  filters,
  onFilterChange,
}: FiltersPanelProps) {
  const fieldMap = new Map(spec.fields.map((f) => [f.name, f]));

  const handleFilterChange = (fieldName: string, value: unknown) => {
    const newFilters = { ...filters };
    if (value === "" || value === null || value === undefined) {
      delete newFilters[fieldName];
    } else {
      newFilters[fieldName] = value;
    }
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  if (spec.filters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {spec.filters.map((fieldName) => {
          const field = fieldMap.get(fieldName);
          if (!field) return null;

          return (
            <div key={fieldName} className="space-y-2">
              <Label htmlFor={`filter-${fieldName}`}>{field.label}</Label>
              {renderFilterInput(field, filters[fieldName], (value) =>
                handleFilterChange(fieldName, value)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderFilterInput(
  field: Field,
  value: unknown,
  onChange: (value: unknown) => void
) {
  switch (field.type) {
    case "string":
      return (
        <Input
          id={`filter-${field.name}`}
          type="text"
          placeholder={`Search ${field.label.toLowerCase()}...`}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      const numberValue = value && typeof value === "object" && "min" in value && "max" in value
        ? value as { min?: number; max?: number }
        : { min: undefined, max: undefined };
      return (
        <div className="flex gap-2">
          <Input
            id={`filter-${field.name}-min`}
            type="number"
            placeholder="Min"
            value={numberValue.min ?? ""}
            onChange={(e) =>
              onChange({
                ...numberValue,
                min: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
          <Input
            id={`filter-${field.name}-max`}
            type="number"
            placeholder="Max"
            value={numberValue.max ?? ""}
            onChange={(e) =>
              onChange({
                ...numberValue,
                max: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      );
    case "boolean":
      return (
        <Select
          value={value === undefined ? "all" : String(value)}
          onValueChange={(val) => {
            if (val === "all") {
              onChange(undefined);
            } else {
              onChange(val === "true");
            }
          }}
        >
          <SelectTrigger id={`filter-${field.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      );
    case "enum":
      return (
        <Select
          value={typeof value === "string" ? value : "all"}
          onValueChange={(val) => onChange(val === "all" ? undefined : val)}
        >
          <SelectTrigger id={`filter-${field.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return (
        <Input
          id={`filter-${field.name}`}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
