"use client";

import * as React from "react";
import { SchemaRenderer } from "@/components/renderer/SchemaRenderer";
import { CompiledUISidebar } from "./CompiledUISidebar";
import { createMockAdapter } from "@/lib/adapters";
import type { UISpec } from "@/lib/spec/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const DIFF_DISMISSED_KEY = "rapidui_diff_dismissed";

type DiffPageEntry = {
  name: string;
  type: "added" | "removed" | "unchanged";
  addedFields: string[];
  removedFields: string[];
};

type DiffFromPrevious = { byPage: DiffPageEntry[] };

interface CompiledUIContentProps {
  id: string;
  resource: string;
  spec: UISpec;
  resourceNames: string[];
  resourceSlugs: string[];
  diffFromPrevious?: DiffFromPrevious;
  updatedAt?: string;
}

function hasDiff(diff?: DiffFromPrevious): boolean {
  if (!diff?.byPage?.length) return false;
  return diff.byPage.some(
    (p) =>
      p.type === "added" ||
      p.type === "removed" ||
      p.addedFields.length > 0 ||
      p.removedFields.length > 0
  );
}

export function CompiledUIContent({
  id,
  resource,
  spec,
  resourceNames,
  resourceSlugs,
  diffFromPrevious,
  updatedAt,
}: CompiledUIContentProps) {
  const adapter = React.useMemo(
    () => createMockAdapter(id, resource),
    [id, resource]
  );

  const [diffDialogOpen, setDiffDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!hasDiff(diffFromPrevious)) return;
    const key = `${DIFF_DISMISSED_KEY}_${id}_${updatedAt ?? ""}`;
    try {
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        setDiffDialogOpen(true);
      }
    } catch {
      // sessionStorage may be unavailable
    }
  }, [id, diffFromPrevious, updatedAt]);

  const handleDiffDialogClose = React.useCallback(
    (open: boolean) => {
      setDiffDialogOpen(open);
      if (!open && hasDiff(diffFromPrevious)) {
        try {
          sessionStorage.setItem(`${DIFF_DISMISSED_KEY}_${id}_${updatedAt ?? ""}`, "1");
        } catch {
          // ignore
        }
      }
    },
    [id, diffFromPrevious, updatedAt]
  );

  return (
    <div className="flex min-h-screen bg-background">
      <CompiledUISidebar
        id={id}
        currentResource={resource}
        resourceNames={resourceNames}
        resourceSlugs={resourceSlugs}
        onViewChanges={
          hasDiff(diffFromPrevious)
            ? () => setDiffDialogOpen(true)
            : undefined
        }
      />
      <main className="flex-1 overflow-auto p-6">
        <SchemaRenderer spec={spec} adapter={adapter} />
      </main>

      {hasDiff(diffFromPrevious) && (
        <Dialog open={diffDialogOpen} onOpenChange={handleDiffDialogClose}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>What changed</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm">
              {diffFromPrevious!.byPage.map((page, i) => (
                <div key={`${page.name}-${i}`} className="space-y-1.5">
                  <p
                    className={cn(
                      "font-medium",
                      page.type === "added" && "text-green-600 dark:text-green-500",
                      page.type === "removed" && "text-red-600 dark:text-red-500",
                      page.type === "unchanged" && "text-muted-foreground"
                    )}
                  >
                    {page.type === "added" && "++ "}
                    {page.type === "removed" && "-- "}
                    {page.name}
                  </p>
                  <ul className="space-y-1 pl-4">
                    {page.addedFields.map((item) => (
                      <li
                        key={`add-${item}`}
                        className="text-green-600 dark:text-green-500"
                      >
                        ++ {item}
                      </li>
                    ))}
                    {page.removedFields.map((item) => (
                      <li
                        key={`rem-${item}`}
                        className="text-red-600 dark:text-red-500"
                      >
                        -- {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
