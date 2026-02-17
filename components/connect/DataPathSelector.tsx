"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const DATA_PATH_OPTIONS = [
  { value: "", label: "Auto" },
  { value: "data", label: "data" },
  { value: "results", label: "results" },
  { value: "items", label: "items" },
  { value: "records", label: "records" },
  { value: "users", label: "users" },
] as const;

interface DataPathSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function DataPathSelector({ value, onValueChange, disabled }: DataPathSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="data-path-select">Data path</Label>
      <Select value={value || "auto"} onValueChange={(v) => onValueChange(v === "auto" ? "" : v)} disabled={disabled}>
        <SelectTrigger id="data-path-select" className="w-full">
          <SelectValue placeholder="Auto-detect" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto</SelectItem>
          {DATA_PATH_OPTIONS.filter((o) => o.value).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Use when API wraps array in an object (e.g. DummyJSON uses <code className="rounded bg-muted px-1">users</code>)
      </p>
    </div>
  );
}
