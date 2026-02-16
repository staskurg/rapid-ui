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
import type { DemoVersion } from "@/lib/demoStore/seeds";

const VERSIONS: { value: DemoVersion; label: string }[] = [
  { value: 1, label: "v1" },
  { value: 2, label: "v2" },
  { value: 3, label: "v3" },
];

interface VersionSelectorProps {
  value: DemoVersion;
  onValueChange: (value: DemoVersion) => void;
  disabled?: boolean;
}

export function VersionSelector({ value, onValueChange, disabled }: VersionSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="version-select">Version</Label>
      <Select
        value={String(value)}
        onValueChange={(v) => onValueChange(Number(v) as DemoVersion)}
        disabled={disabled}
      >
        <SelectTrigger id="version-select" className="w-full">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {VERSIONS.map((v) => (
            <SelectItem key={v.value} value={String(v.value)}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
