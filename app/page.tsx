"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { OpenApiDropZone } from "@/components/connect/OpenApiDropZone";
import { ProgressPanel } from "@/components/compiler/ProgressPanel";
import type { Step } from "@/components/compiler/ProgressPanel";
import type { CompilerError } from "@/lib/compiler/errors";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";

type CompilerState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "validating" }
  | { status: "success"; doc: Record<string, unknown>; version: string }
  | { status: "error"; errors: CompilerError[] };

export default function Home() {
  const [state, setState] = React.useState<CompilerState>({ status: "idle" });

  const handleFile = React.useCallback((content: string) => {
    setState({ status: "parsing" });

    const parseResult = parseOpenAPI(content);
    if (!parseResult.success) {
      setState({
        status: "error",
        errors: [parseResult.error],
      });
      toast.error("Parse failed", { description: parseResult.error.message });
      return;
    }

    setState({ status: "validating" });
    const validateResult = validateSubset(parseResult.doc);
    if (!validateResult.success) {
      setState({
        status: "error",
        errors: validateResult.errors,
      });
      toast.error("Validation failed", {
        description: `${validateResult.errors.length} error(s) found`,
      });
      return;
    }

    setState({
      status: "success",
      doc: parseResult.doc,
      version: parseResult.version,
    });
    toast.success("Validation passed", {
      description: `OpenAPI ${parseResult.version} — ready for compilation`,
    });
  }, []);

  const handleDropZoneError = React.useCallback((message: string) => {
    toast.error("Upload failed", { description: message });
  }, []);

  const steps: Step[] = React.useMemo(() => {
    const s: Step[] = [
      {
        id: "parse",
        label: "Parse YAML/JSON",
        status:
          state.status === "idle"
            ? "pending"
            : state.status === "parsing"
              ? "running"
              : state.status === "error" && state.errors[0]?.stage === "Parse"
                ? "error"
                : "success",
      },
      {
        id: "validate",
        label: "Validate subset",
        status:
          state.status === "idle" || state.status === "parsing"
            ? "pending"
            : state.status === "validating"
              ? "running"
              : state.status === "error"
                ? "error"
                : "success",
      },
    ];
    return s;
  }, [state]);

  const errors: CompilerError[] =
    state.status === "error" ? state.errors : [];

  const endpoints = React.useMemo(() => {
    if (state.status !== "success") return undefined;
    const paths = state.doc.paths as Record<string, Record<string, unknown>> | undefined;
    if (!paths || typeof paths !== "object") return undefined;
    const methods = ["get", "post", "put", "patch", "delete"];
    const list: { method: string; path: string; operationId?: string; summary?: string }[] = [];
    for (const pathKey of Object.keys(paths).sort()) {
      const pathItem = paths[pathKey];
      if (!pathItem || typeof pathItem !== "object") continue;
      for (const method of methods) {
        const op = pathItem[method] as Record<string, unknown> | undefined;
        if (!op || typeof op !== "object") continue;
        list.push({
          method: method.toUpperCase(),
          path: pathKey,
          operationId: typeof op.operationId === "string" ? op.operationId : undefined,
          summary: typeof op.summary === "string" ? op.summary : undefined,
        });
      }
    }
    return list;
  }, [state]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel: drop zone + output spec */}
      <aside className="flex w-[40%] min-w-[360px] max-w-[520px] shrink-0 flex-col border-r border-border bg-muted/30">
        <header className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">RapidUI.dev</h1>
              <p className="truncate text-xs text-muted-foreground">
                OpenAPI → deterministic schema-driven UI
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <OpenApiDropZone
            onFile={handleFile}
            onError={handleDropZoneError}
            disabled={state.status === "parsing" || state.status === "validating"}
          />

          {state.status === "success" && (
            <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold">Output Spec</h2>
                <p className="text-xs text-muted-foreground">
                  Parsed OpenAPI — full compilation in Phase 2+
                </p>
              </div>
              <pre className="max-h-[280px] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(state.doc, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </aside>

      {/* Right panel: progress */}
      <main className="flex flex-1 flex-col overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-lg">
          <ProgressPanel
            steps={steps}
            errors={errors}
            endpoints={endpoints}
          />
        </div>
      </main>
    </div>
  );
}
