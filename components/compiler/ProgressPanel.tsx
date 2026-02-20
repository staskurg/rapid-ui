"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Loader2, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompilerError } from "@/lib/compiler/errors";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

/** Decode JSON Pointer for display: ~1 → /, ~0 → ~, collapse double slashes */
function decodeJsonPointer(ptr: string): string {
  return ptr.replace(/~1/g, "/").replace(/~0/g, "~").replace(/\/+/g, "/");
}

/** Parse jsonPointer into method + path for display (aligned with ApiIR: method, path as separate fields) */
function parseLocationForDisplay(ptr: string): { method?: string; path?: string; subPath?: string } | null {
  const decoded = decodeJsonPointer(ptr);
  if (!decoded.startsWith("/paths/")) return null;
  const segments = decoded.slice(7).split("/").filter(Boolean); // after "/paths/"
  if (segments.length === 0) return null;

  const methodIdx = segments.findIndex((s) => HTTP_METHODS.includes(s.toLowerCase()));

  if (methodIdx >= 0) {
    const method = segments[methodIdx].toUpperCase();
    const pathSegments = segments.slice(0, methodIdx);
    const path = pathSegments.length > 0 ? "/" + pathSegments.join("/") : undefined;
    const subPath = segments.length > methodIdx + 1 ? segments.slice(methodIdx + 1).join("/") : undefined;
    return { method, path, subPath };
  }

  // Path-level only (e.g. OAS_MULTIPLE_PATH_PARAMS)
  const path = "/" + segments.join("/");
  return { path };
}

export type StepStatus = "pending" | "running" | "success" | "error";

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

export interface EndpointInfo {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
}

export interface ProgressPanelProps {
  steps: Step[];
  errors?: CompilerError[];
  endpoints?: EndpointInfo[];
  className?: string;
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    default:
      return (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
      );
  }
}

export function ProgressPanel({
  steps,
  errors = [],
  endpoints = [],
  className,
}: ProgressPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-lg border bg-card p-4 shadow-sm",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold">Compilation Progress</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Validation steps and errors
        </p>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2",
              step.status === "error" && "bg-destructive/5"
            )}
          >
            <StepIcon status={step.status} />
            <span
              className={cn(
                "text-sm",
                step.status === "pending" && "text-muted-foreground",
                step.status === "success" && "text-foreground",
                step.status === "error" && "text-destructive font-medium"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Errors ({errors.length})
          </h4>
          <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {errors.map((err, i) => (
              <li
                key={i}
                className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs"
              >
                <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-destructive/90">
                  {err.code}
                </div>
                <div className="mt-1.5 wrap-break-word text-muted-foreground">
                  {err.message}
                </div>
                {err.jsonPointer && (() => {
                  const loc = parseLocationForDisplay(err.jsonPointer);
                  if (loc && (loc.method || loc.path)) {
                    return (
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground/80" title={decodeJsonPointer(err.jsonPointer)}>
                        {loc.method && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold uppercase">
                            {loc.method}
                          </span>
                        )}
                        {loc.path && <span className="break-all">{loc.path}</span>}
                        {loc.subPath && (
                          <span className="text-muted-foreground/60">→ {loc.subPath}</span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="mt-1.5 break-all font-mono text-[11px] text-muted-foreground/80" title={decodeJsonPointer(err.jsonPointer)}>
                      {decodeJsonPointer(err.jsonPointer)}
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {endpoints.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-500">
            <Zap className="h-4 w-4 shrink-0" />
            Endpoints ({endpoints.length})
          </h4>
          <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {endpoints.map((ep, i) => (
              <li
                key={i}
                className="rounded-md border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/50 px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="rounded bg-green-200/80 dark:bg-green-900/60 px-1.5 py-0.5 font-mono font-semibold uppercase text-green-800 dark:text-green-300">
                    {ep.method}
                  </span>
                  <span className="break-all font-mono text-green-900/90 dark:text-green-200/90">
                    {ep.path}
                  </span>
                </div>
                {(ep.summary || ep.operationId) && (
                  <div className="mt-1.5 text-green-700/80 dark:text-green-400/80">
                    {ep.summary ?? ep.operationId}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
