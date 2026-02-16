"use client";

import * as React from "react";
import { SchemaRenderer } from "@/components/renderer/SchemaRenderer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, X, FileText, Clipboard, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { UISpec } from "@/lib/spec/types";
import { getRandomExample, getRandomPrompt, findExampleByJson } from "@/lib/examples";
import { createSessionId } from "@/lib/session";
import { createDemoAdapter } from "@/lib/adapters";
import { getResourceBySlug } from "@/lib/demoStore/resources";
import type { DemoVersion } from "@/lib/demoStore/seeds";
import { ConnectSection } from "@/components/connect/ConnectSection";

type DataSource = "connect" | "paste";

export default function Home() {
  const [dataSource, setDataSource] = React.useState<DataSource>("connect");
  const [sessionId] = React.useState(() => createSessionId());

  // Connect state
  const [resource, setResource] = React.useState("users");
  const [version, setVersion] = React.useState<DemoVersion>(1);
  const [connectPrompt, setConnectPrompt] = React.useState("");

  // Paste JSON state
  const [jsonInput, setJsonInput] = React.useState("");
  const [pastePrompt, setPastePrompt] = React.useState("");
  const [showPastePrompt, setShowPastePrompt] = React.useState(false);

  // Generated UI state
  const [inferredSpec, setInferredSpec] = React.useState<UISpec | null>(null);
  const [parsedData, setParsedData] = React.useState<Record<string, unknown>[] | null>(null);
  const [adapter, setAdapter] = React.useState<ReturnType<typeof createDemoAdapter> | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [specSource, setSpecSource] = React.useState<"ai" | "fallback" | "deterministic" | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const hasGeneratedUI = inferredSpec !== null && (parsedData !== null || adapter !== null);
  const isConnectMode = adapter !== null;

  const handlePasteExample = () => {
    const example = getRandomExample();
    setJsonInput(example.json);
    if (showPastePrompt) {
      const randomPrompt = getRandomPrompt(example);
      setPastePrompt(randomPrompt);
    }
  };

  const handlePasteRequirement = () => {
    if (!jsonInput.trim()) {
      toast.info("Please enter a JSON payload first");
      return;
    }
    const example = findExampleByJson(jsonInput.trim());
    if (example) {
      setPastePrompt(getRandomPrompt(example));
    } else {
      setPastePrompt(getRandomPrompt(getRandomExample()));
    }
  };

  const handleReset = () => {
    setInferredSpec(null);
    setParsedData(null);
    setAdapter(null);
    setSpecSource(null);
    setJsonInput("");
    setPastePrompt("");
    setShowPastePrompt(false);
    setConnectPrompt("");
    toast.info("Input cleared");
  };

  const handleConnectGenerate = async (versionOverride?: DemoVersion) => {
    const v = versionOverride ?? version;
    setInferredSpec(null);
    setParsedData(null);
    setAdapter(null);
    setIsGenerating(true);

    try {
      const demoAdapter = createDemoAdapter(resource, sessionId, v);
      const sample = await demoAdapter.getSample();

      if (!sample || sample.length === 0) {
        toast.error("API returned no data", {
          description: "Cannot generate UI from empty sample.",
        });
        setIsGenerating(false);
        return;
      }

      const response = await fetch("/api/generate-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: sample,
          intent: connectPrompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = (err as { error?: string }).error ?? `Failed: ${response.status}`;
        toast.error("Failed to generate UI", { description: msg });
        throw new Error(msg);
      }

      const result = await response.json();
      const { spec, source } = result;

      const resourceDef = getResourceBySlug(resource);
      const specWithIdField: UISpec = {
        ...spec,
        idField: resourceDef?.idField ?? spec.idField ?? "id",
      };

      setInferredSpec(specWithIdField);
      setVersion(v);
      setAdapter(demoAdapter);
      setSpecSource(source);

      if (source === "ai") {
        toast.success("UI generated successfully");
      } else {
        toast.warning("Using fallback parser", {
          description: "Generation failed, but a fallback spec was created.",
        });
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Failed")) {
        toast.error("Generation failed", { description: err.message });
      }
      console.error("Connect generate error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetData = async () => {
    if (!adapter || !resource) return;
    try {
      const url = `/api/demo/${resource}/reset?session=${sessionId}&v=${version}`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      setRefreshTrigger((t) => t + 1);
      toast.success("Data reset to seed state");
    } catch {
      toast.error("Failed to reset data");
    }
  };

  const handlePasteGenerate = async () => {
    setInferredSpec(null);
    setParsedData(null);
    setAdapter(null);
    setIsGenerating(true);

    if (!jsonInput.trim()) {
      toast.error("Please enter JSON data");
      setIsGenerating(false);
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      const dataArray = Array.isArray(parsed) ? parsed : [parsed];

      const response = await fetch("/api/generate-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: parsed,
          intent: pastePrompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate UI";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        toast.error("Failed to generate UI", { description: errorMessage });
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const { spec, source } = result;

      setParsedData(dataArray as Record<string, unknown>[]);
      setInferredSpec(spec);
      setSpecSource(source);

      if (source === "ai") {
        toast.success("UI generated successfully");
      } else {
        toast.warning("Using fallback parser", {
          description: "Generation failed, but a fallback spec was created.",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate UI";
      toast.error("Generation failed", { description: errorMessage });
      console.error("Generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConnectVersionChange = (v: DemoVersion) => {
    setVersion(v);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left side panel: Generate UI + UI Spec (20–30%) */}
      <aside className="w-[28%] min-w-[320px] max-w-[420px] shrink-0 flex flex-col border-r border-border bg-muted/30">
        {/* Compact header */}
        <header className="shrink-0 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">RapidUI.dev</h1>
              <p className="text-xs text-muted-foreground truncate">
                Connect or paste JSON → get a schema-driven UI
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Connect / Paste JSON Toggle */}
          <Tabs
            value={dataSource}
            onValueChange={(v) => setDataSource(v as DataSource)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connect">Connect</TabsTrigger>
              <TabsTrigger value="paste">Paste JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="connect" className="mt-4">
              <ConnectSection
                resource={resource}
                version={version}
                prompt={connectPrompt}
                onResourceChange={setResource}
                onVersionChange={handleConnectVersionChange}
                onPromptChange={setConnectPrompt}
                onGenerate={() => handleConnectGenerate()}
                isGenerating={isGenerating}
              />
            </TabsContent>

            <TabsContent value="paste" className="mt-4">
              <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="json-input" className="text-sm font-semibold">
                        JSON Payload
                      </Label>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePasteExample}
                          className="h-7 text-xs"
                          type="button"
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          Example
                        </Button>
                        {jsonInput && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="h-7 w-7 p-0"
                            type="button"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      id="json-input"
                      placeholder='Paste JSON: [{ "name": "John", "age": 30 }]'
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      className="min-h-[140px] font-mono text-xs"
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="prompt-input" className="text-sm font-semibold">
                        Prompt (Optional)
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (showPastePrompt) setPastePrompt("");
                          setShowPastePrompt(!showPastePrompt);
                        }}
                        type="button"
                        className="h-7 text-xs"
                      >
                        {showPastePrompt ? "Hide" : "Show"}
                      </Button>
                    </div>
                    {showPastePrompt && (
                      <>
                        <Textarea
                          id="prompt-input"
                          placeholder='e.g. "Make name searchable"'
                          value={pastePrompt}
                          onChange={(e) => setPastePrompt(e.target.value)}
                          className="min-h-[60px] text-xs"
                          disabled={isGenerating}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePasteRequirement}
                          className="h-7 text-xs"
                          type="button"
                        >
                          <Clipboard className="mr-1.5 h-3.5 w-3.5" />
                          Try Prompt
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handlePasteGenerate}
                    disabled={isGenerating || !jsonInput.trim()}
                    variant="default"
                    size="sm"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Generate
                      </>
                    )}
                  </Button>
                  {hasGeneratedUI && !isConnectMode && (
                    <Button variant="ghost" size="sm" onClick={handleReset} disabled={isGenerating}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Inferred Spec Preview — persistent once generated */}
          {inferredSpec && (
            <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold">UI Spec</h2>
                {specSource && (
                  <p className="text-xs text-muted-foreground">
                    {specSource === "ai"
                      ? "AI-powered"
                      : specSource === "fallback"
                      ? "Fallback parser"
                      : "Deterministic"}
                  </p>
                )}
              </div>
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs max-h-[280px]">
                {JSON.stringify(inferredSpec, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </aside>

      {/* Right side: Generated UI (70–80%) — "page within a page" */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex flex-col p-6 min-h-0">
          {/* Toolbar: actions for the generated UI — only when we have one */}
          {hasGeneratedUI && (
            <div className="shrink-0 flex items-center justify-between gap-3 mb-4">
              <div className="rounded-md bg-primary/5 dark:bg-primary/10 border border-primary/20 px-3 py-2">
                <p className="text-xs text-foreground">
                  {isConnectMode
                    ? "API-backed. CRUD persists in your session."
                    : "Generated from your backend schema."}
                </p>
              </div>
              <div className="flex gap-2">
                {isConnectMode && (
                  <Button variant="outline" size="sm" onClick={handleResetData}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset Data
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Embedded preview container — always visible */}
          <div className="flex-1 min-h-0 rounded-xl border-2 border-border bg-card shadow-lg overflow-hidden flex flex-col [box-shadow:0_0_0_1px_hsl(var(--border))]">
            <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/50 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                Generated UI
              </span>
            </div>
            <div className="flex-1 overflow-auto bg-background p-4 md:p-6 min-h-[200px] flex flex-col">
              {isGenerating ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Generating</p>
                  </div>
                </div>
              ) : !inferredSpec ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-sm space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
                      <Sparkles className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Connect to the demo API or paste JSON in the panel to generate a UI from your backend schema.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ErrorBoundary>
                {isConnectMode && adapter ? (
                    <SchemaRenderer
                      spec={inferredSpec}
                      adapter={adapter}
                      refreshTrigger={refreshTrigger}
                    />
                  ) : (
                    <SchemaRenderer
                      spec={inferredSpec}
                      initialData={parsedData ?? []}
                    />
                  )}
                  </ErrorBoundary>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
