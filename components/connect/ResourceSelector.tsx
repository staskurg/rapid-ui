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
import { RESOURCES } from "@/lib/demoStore/resources";

interface ResourceSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ResourceSelector({ value, onValueChange, disabled }: ResourceSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="resource-select">Resource</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id="resource-select" className="w-full">
          <SelectValue placeholder="Select a resource" />
        </SelectTrigger>
        <SelectContent>
          {RESOURCES.map((r) => (
            <SelectItem key={r.slug} value={r.slug}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
