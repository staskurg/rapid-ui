"use client";

import * as React from "react";

interface GenerationSuccessToastProps {
  added: string[];
  removed: string[];
  context?: string;
}

/**
 * Diff content for generation success toast. Renders added (green +) and removed (red -).
 * Used as description of toast.success() for standard Sonner styling.
 */
export function GenerationSuccessToast({
  added,
  removed,
  context,
}: GenerationSuccessToastProps) {
  const hasChanges = added.length > 0 || removed.length > 0;

  return (
    <div className="flex flex-col gap-1.5 min-w-[260px] max-w-[340px]">
      {context && (
        <p className="text-xs text-muted-foreground">{context}</p>
      )}
      {hasChanges && (
        <ul className="text-xs space-y-0.5 font-mono">
          {added.map((item, i) => (
            <li key={`a-${i}`} className="text-green-600 dark:text-green-500">
              + {item}
            </li>
          ))}
          {removed.map((item, i) => (
            <li key={`r-${i}`} className="text-red-600 dark:text-red-500">
              - {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
