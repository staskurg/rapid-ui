"use client";

import * as React from "react";
import { SchemaRenderer } from "@/components/renderer/SchemaRenderer";
import { CompiledUISidebar } from "./CompiledUISidebar";
import { createMockAdapter } from "@/lib/adapters";
import type { UISpec } from "@/lib/spec/types";

interface CompiledUIContentProps {
  id: string;
  resource: string;
  spec: UISpec;
  resourceNames: string[];
  resourceSlugs: string[];
}

export function CompiledUIContent({
  id,
  resource,
  spec,
  resourceNames,
  resourceSlugs,
}: CompiledUIContentProps) {
  const adapter = React.useMemo(
    () => createMockAdapter(id, resource),
    [id, resource]
  );

  return (
    <div className="flex min-h-screen bg-background">
      <CompiledUISidebar
        id={id}
        currentResource={resource}
        resourceNames={resourceNames}
        resourceSlugs={resourceSlugs}
      />
      <main className="flex-1 overflow-auto p-6">
        <SchemaRenderer spec={spec} adapter={adapter} />
      </main>
    </div>
  );
}
