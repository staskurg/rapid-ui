"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, Trash2, Upload, Loader2, FileText, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { OpenApiDropZone } from "@/components/connect/OpenApiDropZone";
import { ProgressPanel } from "@/components/compiler/ProgressPanel";
import type { Step } from "@/components/compiler/ProgressPanel";
import type { EndpointInfo } from "@/components/compiler/ProgressPanel";
import { parseOpenAPI } from "@/lib/compiler/openapi/parser";
import { validateSubset } from "@/lib/compiler/openapi/subset-validator";
import { getOrCreateAccountId, resetAccountId } from "@/lib/session";
import type { ApiIR } from "@/lib/compiler/apiir/types";
import type { CompilerError } from "@/lib/compiler/errors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = ".yaml,.yml,.json";

/** Demo specs available for download. Keys match API route param. */
const DEMO_SPECS: { id: string; label: string }[] = [
  { id: "golden_openapi_users_tagged_3_0", label: "Golden Users" },
  { id: "golden_openapi_products_path_3_1", label: "Golden Products" },
  { id: "demo_users_tasks_v1", label: "Demo v1 (Users only)" },
  { id: "demo_users_tasks_v2", label: "Demo v2 (Users + Tasks)" },
  { id: "demo_users_tasks_v3", label: "Demo v3 (updated fields)" },
];

/** URL param value during new spec compilation. Replaced with real id when done. */
const COMPILING_SPEC_ID = "__compiling__";

interface CompilationListItem {
  id: string;
  name: string;
  status: "success" | "failed";
}

interface CompilationDetail {
  id: string;
  name: string;
  status: string;
  specs: Record<string, unknown>;
  resourceNames: string[];
  resourceSlugs: string[];
  apiIr: ApiIR;
  diffFromPrevious?: {
    byPage: Array<{
      name: string;
      type: "added" | "removed" | "unchanged";
      addedFields: string[];
      removedFields: string[];
    }>;
  };
  isPredefined?: boolean;
}

type CompileState =
  | { status: "parsing" }
  | { status: "validating" }
  | { status: "compiling" }
  | { status: "success"; id: string; url: string; resourceNames: string[]; specs: Record<string, unknown> }
  | { status: "error"; errors: CompilerError[] };

function apiIrToEndpoints(apiIr: ApiIR): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  for (const resource of apiIr.resources) {
    for (const op of resource.operations) {
      endpoints.push({
        method: op.method,
        path: op.path,
        operationId: op.id,
      });
    }
  }
  return endpoints;
}

function CompilerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const specParam = searchParams.get("spec");

  const [origin, setOrigin] = React.useState("");
  const [items, setItems] = React.useState<CompilationListItem[]>([]);
  const [detail, setDetail] = React.useState<CompilationDetail | null>(null);
  const [listLoading, setListLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [compileState, setCompileState] = React.useState<CompileState | null>(null);
  /** When set, we're updating this spec (don't show Output UISpec during compile) */
  const [compileTargetId, setCompileTargetId] = React.useState<string | null>(null);
  /** Set when compile succeeds and we use replaceState (Next.js may not sync). Cleared on manual navigation. */
  const [completedSpecId, setCompletedSpecId] = React.useState<string | null>(null);
  /** Shown in list when compiling a new spec (before we have the real id) */
  const [compilingNewItem, setCompilingNewItem] = React.useState<{ id: string; name: string } | null>(
    null
  );
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [resetSessionOpen, setResetSessionOpen] = React.useState(false);
  const [demoSpecsOpen, setDemoSpecsOpen] = React.useState(false);
  const updateInputRef = React.useRef<HTMLInputElement>(null);
  const updateTargetIdRef = React.useRef<string | null>(null);

  const [accountId, setAccountId] = React.useState<string | null>(null);

  /** Effective selection: during compile use state; otherwise use URL or completedSpecId. Avoids router.replace during async (prevents full reload). */
  const effectiveSpecParam =
    completedSpecId ??
    (compileState && !compileTargetId
      ? COMPILING_SPEC_ID
      : compileState && compileTargetId
        ? compileTargetId
        : specParam);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      setAccountId(getOrCreateAccountId());
    }
  }, []);

  const ac = accountId;

  const fetchList = React.useCallback(async () => {
    if (!ac) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/compilations?accountId=${encodeURIComponent(ac)}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
      } else {
        toast.error("Failed to load compilations", { description: data.error });
      }
    } catch (err) {
      toast.error("Failed to load compilations", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setListLoading(false);
    }
  }, [ac]);

  const fetchDetail = React.useCallback(
    async (id: string) => {
      if (!ac) return;
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await fetch(
          `/api/compilations/${encodeURIComponent(id)}?accountId=${encodeURIComponent(ac)}`
        );
        const data = await res.json();
        if (res.ok) {
          setDetail({
            id: data.id,
            name: data.name ?? data.id,
            status: data.status ?? "success",
            specs: data.specs ?? {},
            resourceNames: data.resourceNames ?? [],
            resourceSlugs: data.resourceSlugs ?? [],
            apiIr: data.apiIr,
            diffFromPrevious: data.diffFromPrevious,
            isPredefined: data.isPredefined,
          });
        } else if (res.status === 404 || res.status === 403) {
          setDetail(null);
          setCompletedSpecId(null);
          router.replace("/", { scroll: false });
        } else {
          toast.error("Failed to load spec", { description: data.error });
        }
      } catch (err) {
        toast.error("Failed to load spec", {
          description: err instanceof Error ? err.message : "Network error",
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [ac, router]
  );

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  React.useEffect(() => {
    if (compileState) {
      setDetail(null);
      return;
    }
    if (effectiveSpecParam && effectiveSpecParam !== COMPILING_SPEC_ID && ac) {
      const inList = items.some((i) => i.id === effectiveSpecParam);
      if (inList) {
        // Skip fetch if we already have this detail (e.g. just set from compile response)
        if (detail?.id !== effectiveSpecParam) {
          fetchDetail(effectiveSpecParam);
        }
      } else if (!listLoading) {
        setDetail(null);
        setCompletedSpecId(null);
        router.replace("/", { scroll: false });
      }
    } else {
      setDetail(null);
    }
  }, [compileState, effectiveSpecParam, ac, items, listLoading, fetchDetail, router, detail?.id]);

  const handleFile = React.useCallback(
    async (content: string) => {
      if (!ac) return;

      const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

      setCompileTargetId(null);
      setCompilingNewItem({ id: COMPILING_SPEC_ID, name: "Compiling..." });
      setCompileState({ status: "parsing" });
      await yieldToUI();

      const parseResult = parseOpenAPI(content);
      if (!parseResult.success) {
        setCompileState({
          status: "error",
          errors: [{ code: "OAS_PARSE_ERROR", stage: "Parse", message: parseResult.error.message }],
        });
        setCompilingNewItem(null);
        toast.error("Parse failed", { description: parseResult.error.message });
        return;
      }

      setCompileState({ status: "validating" });
      await yieldToUI();

      const validateResult = validateSubset(parseResult.doc);
      if (!validateResult.success) {
        setCompileState({ status: "error", errors: validateResult.errors });
        setCompilingNewItem(null);
        toast.error("Validation failed", {
          description: `${validateResult.errors.length} error(s) found`,
        });
        return;
      }

      setCompileState({ status: "compiling" });

      try {
        const res = await fetch("/api/compile-openapi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openapi: content, accountId: ac }),
        });
        const data = await res.json();

        if (!res.ok) {
          const errors: CompilerError[] =
            data.errors ?? [
              { code: "UISPEC_INVALID", stage: "Lowering", message: "Compilation failed" },
            ];
          setCompileState({ status: "error", errors });
          setCompilingNewItem(null);
          toast.error("Compilation failed", {
            description: errors[0]?.message ?? "Unknown error",
          });
          return;
        }

        setCompilingNewItem(null);
        await fetchList();

        // Set detail from response so we show full view (endpoints + spec) immediately, no intermediate flash
        if (data.apiIr) {
          setDetail({
            id: data.id,
            name: data.name ?? data.id,
            status: "success",
            specs: data.specs ?? {},
            resourceNames: data.resourceNames ?? [],
            resourceSlugs: data.resourceSlugs ?? [],
            apiIr: data.apiIr,
          });
        }

        const newUrl = `/?spec=${encodeURIComponent(data.id)}`;
        window.history.replaceState(null, "", newUrl);
        setCompletedSpecId(data.id);
        setCompileState(null);

        toast.success("Compilation complete", {
          description: `View UI for ${data.resourceNames?.length ?? 0} resource(s)`,
        });
      } catch (err) {
        const errors: CompilerError[] = [
          {
            code: "UISPEC_INVALID",
            stage: "Lowering",
            message: err instanceof Error ? err.message : "Compilation failed",
          },
        ];
        setCompileState({ status: "error", errors });
        setCompilingNewItem(null);
        toast.error("Compilation failed", {
          description: err instanceof Error ? err.message : "Network or server error",
        });
      }
    },
    [ac, fetchList]
  );

  const handleDropZoneError = React.useCallback((message: string) => {
    toast.error("Upload failed", { description: message });
  }, []);

  const handleCompileDemoSpec = React.useCallback(
    async (specId: string) => {
      if (!ac || compileState) return;
      setDemoSpecsOpen(false);
      try {
        const res = await fetch(`/api/demo-specs/${encodeURIComponent(specId)}`);
        if (!res.ok) throw new Error("Failed to fetch spec");
        const content = await res.text();
        await handleFile(content);
      } catch (err) {
        toast.error("Failed to load demo spec", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [ac, compileState, handleFile]
  );

  const handleSpecClick = React.useCallback(
    (id: string) => {
      setCompileState(null);
      setCompileTargetId(null);
      setCompilingNewItem(null);
      setCompletedSpecId(null);
      router.replace(`/?spec=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router]
  );

  const handleDismissError = React.useCallback(() => {
    setCompileState(null);
    setCompileTargetId(null);
    setCompilingNewItem(null);
    if (effectiveSpecParam === COMPILING_SPEC_ID) {
      setCompletedSpecId(null);
      router.replace("/", { scroll: false });
    }
  }, [effectiveSpecParam, router]);

  const handleUpdateSpec = React.useCallback((id: string) => {
    updateTargetIdRef.current = id;
    updateInputRef.current?.click();
  }, []);

  const handleUpdateFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const id = updateTargetIdRef.current;
      updateTargetIdRef.current = null;
      if (!file || !id || !ac) return;

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["yaml", "yml", "json"].includes(ext ?? "")) {
        toast.error("Unsupported file type. Use .yaml, .yml, or .json");
        return;
      }

      let content: string;
      try {
        content = await file.text();
      } catch (err) {
        toast.error("Failed to read file", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        return;
      }

      const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

      setCompileTargetId(id);
      setCompileState({ status: "parsing" });
      await yieldToUI();

      const parseResult = parseOpenAPI(content);
      if (!parseResult.success) {
        setCompileState({
          status: "error",
          errors: [{ code: "OAS_PARSE_ERROR", stage: "Parse", message: parseResult.error.message }],
        });
        setCompileTargetId(null);
        toast.error("Parse failed", { description: parseResult.error.message });
        return;
      }

      setCompileState({ status: "validating" });
      await yieldToUI();

      const validateResult = validateSubset(parseResult.doc);
      if (!validateResult.success) {
        setCompileState({ status: "error", errors: validateResult.errors });
        setCompileTargetId(null);
        toast.error("Validation failed", {
          description: `${validateResult.errors.length} error(s) found`,
        });
        return;
      }

      setCompileState({ status: "compiling" });

      try {
        const res = await fetch(`/api/compilations/${encodeURIComponent(id)}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openapi: content, accountId: ac }),
        });
        const data = await res.json();

        if (!res.ok) {
          const errors: CompilerError[] =
            data.errors ?? [
              { code: "UISPEC_INVALID", stage: "Lowering", message: "Update failed" },
            ];
          setCompileState({ status: "error", errors });
          setCompileTargetId(null);
          toast.error("Update failed", {
            description: errors[0]?.message ?? data.error ?? "Unknown error",
          });
          return;
        }

        await fetchList();

        // Set detail from response to show full view immediately, no intermediate flash
        if (data.apiIr) {
          setDetail({
            id,
            name: data.name ?? id,
            status: "success",
            specs: data.specs ?? {},
            resourceNames: data.resourceNames ?? [],
            resourceSlugs: data.resourceSlugs ?? [],
            apiIr: data.apiIr,
            diffFromPrevious: data.diffFromPrevious,
          });
        }

        toast.success("Spec updated");
        setCompileState(null);
        setCompileTargetId(null);
      } catch (err) {
        const errors: CompilerError[] = [
          {
            code: "UISPEC_INVALID",
            stage: "Lowering",
            message: err instanceof Error ? err.message : "Update failed",
          },
        ];
        setCompileState({ status: "error", errors });
        setCompileTargetId(null);
        toast.error("Update failed", {
          description: err instanceof Error ? err.message : "Network error",
        });
      }
    },
    [ac, fetchList]
  );

  const handleDeleteClick = React.useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTargetId || !ac) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/compilations/${encodeURIComponent(deleteTargetId)}?accountId=${encodeURIComponent(ac)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Spec deleted");
        if (effectiveSpecParam === deleteTargetId) {
          router.replace("/", { scroll: false });
        }
        fetchList();
      } else {
        const data = await res.json();
        toast.error("Delete failed", { description: data.error ?? "Unknown error" });
      }
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, ac, effectiveSpecParam, router, fetchList]);

  const handleResetSession = React.useCallback(() => {
    setResetSessionOpen(false);
    const newId = resetAccountId();
    setAccountId(newId);
    setItems([]);
    setDetail(null);
    setCompletedSpecId(null);
    router.replace("/", { scroll: false });
    toast.success("Session reset", {
      description: "You now have a fresh account. Your previous compilations are still in the database.",
    });
  }, [router]);

  const steps: Step[] = React.useMemo(() => {
    if (compileState) {
      const err = compileState.status === "error" ? compileState.errors[0] : null;
      const parseErr = err?.stage === "Parse";
      const validateErr = err?.stage === "Subset";
      const compileErr = compileState.status === "error" && !parseErr && !validateErr;
      const { status } = compileState;
      return [
        {
          id: "parse",
          label: "Parse YAML/JSON",
          status:
            status === "parsing"
              ? "running"
              : parseErr
                ? "error"
                : status === "validating" || status === "compiling" || status === "success"
                  ? "success"
                  : "pending",
        },
        {
          id: "validate",
          label: "Validate subset",
          status:
            status === "parsing"
              ? "pending"
              : status === "validating"
                ? "running"
                : validateErr
                  ? "error"
                  : status === "compiling" || status === "success"
                    ? "success"
                    : "pending",
        },
        {
          id: "compile",
          label: "Compile pipeline",
          status:
            status === "parsing" || status === "validating"
              ? "pending"
              : status === "compiling"
                ? "running"
                : status === "success"
                  ? "success"
                  : compileErr
                    ? "error"
                    : "pending",
        },
      ];
    }
    if (detail) {
      return [
        { id: "parse", label: "Parse YAML/JSON", status: "success" },
        { id: "validate", label: "Validate subset", status: "success" },
        { id: "compile", label: "Compile pipeline", status: "success" },
      ];
    }
    return [];
  }, [compileState, detail]);

  const endpoints = detail?.apiIr ? apiIrToEndpoints(detail.apiIr) : [];
  const viewUrl = detail ? `/u/${detail.id}` : null;
  const compileSuccessUrl = compileState?.status === "success" ? compileState.url : null;

  if (listLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left panel: drop zone + spec list */}
      <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden border-r border-border bg-muted/30">
        <header className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">RapidUI.dev</h1>
              <p className="wrap-break-word text-xs text-muted-foreground">
                OpenAPI → deterministic schema-driven UI
              </p>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <OpenApiDropZone
            onFile={handleFile}
            onError={handleDropZoneError}
            disabled={compileState !== null}
          />

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2"
            disabled={compileState !== null}
            onClick={() => setDemoSpecsOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Demo specs
          </Button>

          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Your specs</h2>
            {items.length === 0 && !compilingNewItem ? (
              <p className="py-4 text-sm text-muted-foreground">
                No specs yet. Drop an OpenAPI file above to compile.
              </p>
            ) : (
              <ul className="space-y-1">
                {compilingNewItem && (
                  <li key={compilingNewItem.id}>
                    <div
                      className={cn(
                        "group flex items-center justify-between gap-2 rounded-lg border border-primary/50 bg-primary/5 px-3 py-2"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2 truncate text-sm font-medium">
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                        {compilingNewItem.name}
                      </span>
                    </div>
                  </li>
                )}
                {items.map((item) => (
                  <li key={item.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSpecClick(item.id)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleSpecClick(item.id)
                      }
                      className={cn(
                        "group flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                        effectiveSpecParam === item.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {compileTargetId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-70 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(item.id);
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
            disabled={compileState !== null}
            onClick={() => setResetSessionOpen(true)}
          >
            <RefreshCw className="h-4 w-4" />
            Reset session
          </Button>
        </div>
      </aside>

      {/* Right panel: compile flow, empty state, or detail */}
      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Custom specs are in development. Use Golden Users, Golden Products, or Demo (Users + Tasks v1 → v2 → v3).
        </div>
        <div className="flex w-full flex-col gap-6">
          {compileState ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">
                  {compileState.status === "success"
                    ? "Compilation complete"
                    : compileState.status === "error"
                      ? "Compilation failed"
                      : compileTargetId
                        ? "Updating spec..."
                        : "Compiling..."}
                </h2>
                {compileState.status === "error" && (
                  <Button variant="outline" size="sm" onClick={handleDismissError}>
                    Dismiss
                  </Button>
                )}
              </div>
              <ProgressPanel
                steps={steps}
                errors={compileState.status === "error" ? compileState.errors : undefined}
                successUrl={
                  compileState.status === "success" ? compileSuccessUrl ?? undefined : undefined
                }
                origin={origin}
              />
              {compileState.status === "success" &&
                !compileTargetId && (
                  <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                    <h3 className="text-sm font-semibold">Output UISpec</h3>
                    <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(compileState.specs, null, 2)}
                    </pre>
                  </div>
                )}
            </>
          ) : !effectiveSpecParam ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <h3 className="text-sm font-medium">No spec selected</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a spec from the list or upload a new OpenAPI file.
                </p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : detail ? (
            <>
              {detail.isPredefined === false && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  This is a custom spec. Experimental support.
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h2 className="text-lg font-semibold">{detail.name}</h2>
                <input
                  ref={updateInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={handleUpdateFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={compileTargetId === detail.id}
                  onClick={() => handleUpdateSpec(detail.id)}
                >
                  {compileTargetId === detail.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Update spec
                    </>
                  )}
                </Button>
              </div>

              <ProgressPanel
                steps={steps}
                endpoints={endpoints}
                successUrl={viewUrl ?? undefined}
                origin={origin}
              />

              <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold">Output UISpec</h3>
                <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(detail.specs, null, 2)}
                </pre>
              </div>
            </>
          ) : null}
        </div>
      </main>

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete spec</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetSessionOpen} onOpenChange={setResetSessionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset session</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new account ID. Your spec list will appear empty. Your previous
              compilations remain in the database but won&apos;t be visible under this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetSession}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={demoSpecsOpen} onOpenChange={setDemoSpecsOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demo specs</DialogTitle>
            <DialogDescription>
              Download a spec file or compile directly.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 py-2">
            {DEMO_SPECS.map((spec) => (
              <li key={spec.id}>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start gap-2"
                    disabled={compileState !== null}
                    onClick={() => handleCompileDemoSpec(spec.id)}
                  >
                    <Sparkles className="h-4 w-4" />
                    {spec.label}
                  </Button>
                  <a
                    href={`/api/demo-specs/${encodeURIComponent(spec.id)}`}
                    download={`${spec.id}.yaml`}
                    className="shrink-0 rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={`Download ${spec.label}`}
                    aria-label={`Download ${spec.label}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setDemoSpecsOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CompilerPageContent />
    </Suspense>
  );
}
