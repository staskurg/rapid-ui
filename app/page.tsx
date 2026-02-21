"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { OpenApiDropZone } from "@/components/connect/OpenApiDropZone";
import { ProgressPanel } from "@/components/compiler/ProgressPanel";
import type { Step } from "@/components/compiler/ProgressPanel";
import type { CompilerError } from "@/lib/compiler/errors";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { slugify } from "@/lib/utils/slugify";

type CompilerState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "validating" }
  | { status: "compiling" }
  | { status: "success"; id: string; url: string; resourceNames: string[]; specs: Record<string, unknown> }
  | { status: "error"; errors: CompilerError[] };

export default function Home() {
  const [state, setState] = React.useState<CompilerState>({ status: "idle" });
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

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

    setState({ status: "compiling" });
    fetch("/api/compile-openapi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openapi: content }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          const errors = data.errors ?? [{ code: "UISPEC_INVALID", stage: "Lowering" as const, message: "Compilation failed" }];
          setState({ status: "error", errors });
          toast.error("Compilation failed", {
            description: errors[0]?.message ?? "Unknown error",
          });
          return;
        }
        setState({
          status: "success",
          id: data.id,
          url: data.url ?? `/u/${data.id}/${slugify(data.resourceNames?.[0] ?? "resource")}`,
          resourceNames: data.resourceNames ?? [],
          specs: data.specs ?? {},
        });
        toast.success("Compilation complete", {
          description: `View UI for ${data.resourceNames?.length ?? 0} resource(s)`,
        });
      })
      .catch((err) => {
        setState({
          status: "error",
          errors: [{
            code: "UISPEC_INVALID",
            stage: "Lowering",
            message: err instanceof Error ? err.message : "Compilation failed",
          }],
        });
        toast.error("Compilation failed", { description: "Network or server error" });
      });
  }, []);

  const handleDropZoneError = React.useCallback((message: string) => {
    toast.error("Upload failed", { description: message });
  }, []);

  const steps: Step[] = React.useMemo(() => {
    const isError = state.status === "error";
    const err = isError ? state.errors[0] : null;
    const parseErr = err?.stage === "Parse";
    const validateErr = err?.stage === "Subset";
    const compileErr = isError && !parseErr && !validateErr;

    return [
      {
        id: "parse",
        label: "Parse YAML/JSON",
        status:
          state.status === "idle"
            ? "pending"
            : state.status === "parsing"
              ? "running"
              : parseErr ? "error" : "success",
      },
      {
        id: "validate",
        label: "Validate subset",
        status:
          state.status === "idle" || state.status === "parsing"
            ? "pending"
            : state.status === "validating"
              ? "running"
              : validateErr ? "error" : "success",
      },
      {
        id: "compile",
        label: "Compile pipeline",
        status:
          state.status === "idle" || state.status === "parsing" || state.status === "validating"
            ? "pending"
            : state.status === "compiling"
              ? "running"
              : state.status === "success"
                ? "success"
                : compileErr ? "error" : "pending",
      },
    ];
  }, [state]);

  const errors: CompilerError[] =
    state.status === "error" ? state.errors : [];

  const viewUrl = state.status === "success" ? state.url : null;
  const resourceLinks =
    state.status === "success"
      ? state.resourceNames.map((name) => ({
          name,
          href: `/u/${state.id}/${slugify(name)}`,
        }))
      : [];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel: drop zone + UISpec JSON output */}
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
            disabled={state.status === "parsing" || state.status === "validating" || state.status === "compiling"}
          />

          {state.status === "success" && (
            <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold">Output Spec</h2>
                <p className="text-xs text-muted-foreground">
                  UISpec from compiler pipeline
                </p>
              </div>
              <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(state.specs, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </aside>

      {/* Right panel: progress + result link */}
      <main className="flex flex-1 flex-col overflow-y-auto p-6">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
          <ProgressPanel steps={steps} errors={errors} />

          {viewUrl && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-500">
                Success!
              </h4>
              <p className="text-sm text-muted-foreground">
                Generated UI endpoint. Open in a new tab to view.
              </p>
              <div className="space-y-1">
                {resourceLinks.map(({ href }) => {
                  const fullUrl = origin ? `${origin}${href}` : href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-sm text-green-700 dark:text-green-500 underline-offset-4 hover:underline"
                    >
                      {fullUrl}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
