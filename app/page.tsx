"use client";

import * as React from "react";
import { AdminRenderer } from "@/components/admin/AdminRenderer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, X, FileText, Clipboard } from "lucide-react";
import { toast } from "sonner";
import { generateFallbackSpec } from "@/lib/inference/fallback-generator";
import { parsePayload } from "@/lib/inference/payload-parser";
import { generateSpec } from "@/lib/inference/spec-generator";
import type { UISpec } from "@/lib/spec/types";
import { getRandomExample, getRandomPrompt, findExampleByJson } from "@/lib/examples";

export default function Home() {
  const [jsonInput, setJsonInput] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [inferredSpec, setInferredSpec] = React.useState<UISpec | null>(null);
  const [parsedData, setParsedData] = React.useState<Record<string, unknown>[] | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [specSource, setSpecSource] = React.useState<"ai" | "fallback" | "deterministic" | null>(null);

  const hasGeneratedUI = inferredSpec !== null && parsedData !== null;

  const handlePasteExample = () => {
    const example = getRandomExample();
    setJsonInput(example.json);
    
    // If prompt section is open, auto-add a random prompt
    if (showPrompt) {
      const randomPrompt = getRandomPrompt(example);
      setPrompt(randomPrompt);
    }
  };

  const handlePasteRequirement = () => {
    if (!jsonInput.trim()) {
      toast.info("Please enter a JSON payload first");
      return;
    }
    
    const example = findExampleByJson(jsonInput.trim());
    if (example) {
      const randomPrompt = getRandomPrompt(example);
      setPrompt(randomPrompt);
    } else {
      // If no matching example, use a generic prompt
      const randomExample = getRandomExample();
      const randomPrompt = getRandomPrompt(randomExample);
      setPrompt(randomPrompt);
    }
  };

  const handleParseJSON = () => {
    setIsParsing(true);
    setShowPreview(false);
    setInferredSpec(null);
    setParsedData(null);

    if (!jsonInput.trim()) {
      toast.error("Please enter JSON data");
      setIsParsing(false);
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      
      // Extract data array (handle both single object and array)
      const dataArray = Array.isArray(parsed) ? parsed : [parsed];
      
      // Parse payload and generate spec
      const parsedStructure = parsePayload(parsed);
      const spec = generateSpec(parsedStructure);
      
      // Set both spec and data together to ensure they match
      setParsedData(dataArray as Record<string, unknown>[]);
      setInferredSpec(spec);
      setSpecSource("deterministic");
      setShowPreview(true);
      toast.success("UI generated successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Invalid JSON format";
      toast.error("Invalid JSON format. Please check your input.", {
        description: errorMessage,
      });
      
      // Try fallback generator
      try {
        const fallbackSpec = generateFallbackSpec(jsonInput);
        // For fallback, we still try to parse the data if possible
        try {
          const parsed = JSON.parse(jsonInput);
          const dataArray = Array.isArray(parsed) ? parsed : [parsed];
          setParsedData(dataArray as Record<string, unknown>[]);
        } catch {
          // If data parsing fails, use empty array
          setParsedData([]);
        }
        setInferredSpec(fallbackSpec);
        setSpecSource("fallback");
        setShowPreview(true);
        toast.warning("Using fallback parser", {
          description: "The JSON couldn't be parsed normally, but a fallback spec was created.",
        });
      } catch (fallbackErr) {
        console.error("Fallback generator also failed:", fallbackErr);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleReset = () => {
    setJsonInput("");
    setPrompt("");
    setShowPrompt(false);
    setInferredSpec(null);
    setParsedData(null);
    setShowPreview(false);
    setSpecSource(null);
    toast.info("Input cleared");
  };

  const handleGenerateWithAI = async () => {
    // Hide spec and UI during generation
    setShowPreview(false);
    setInferredSpec(null);
    setParsedData(null);
    setIsGenerating(true);

    if (!jsonInput.trim()) {
      toast.error("Please enter JSON data");
      setIsGenerating(false);
      return;
    }

    try {
      // Parse JSON to validate it
      const parsed = JSON.parse(jsonInput);
      const dataArray = Array.isArray(parsed) ? parsed : [parsed];

      // Call AI API (no loading toast - we'll show loader in UI)
      const response = await fetch("/api/generate-ui", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: parsed,
          intent: prompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate UI";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        toast.error("Failed to generate UI", {
          description: errorMessage,
        });
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const { spec, source } = result;

      // Set both spec and data together
      setParsedData(dataArray as Record<string, unknown>[]);
      setInferredSpec(spec);
      setSpecSource(source);
      setShowPreview(true);
      
      // Show success toast at the end
      if (source === "ai") {
        toast.success("UI generated successfully");
      } else {
        toast.warning("Using fallback parser", {
          description: "Generation failed, but a fallback spec was created.",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate UI";
      toast.error("Generation failed", {
        description: errorMessage,
      });
      console.error("Generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };



  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center space-y-4 mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              AI Admin UI Generator
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Paste backend data → instantly get a usable admin UI
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Generate fully functional CRUD interfaces from JSON payloads. Powered by AI. No coding required.
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="json-input" className="text-base font-semibold">
                  JSON Payload
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePasteExample}
                    className="h-8"
                    type="button"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Try Example
                  </Button>
                  {jsonInput && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="h-8 w-8 p-0"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                id="json-input"
                placeholder='Paste your JSON here, e.g.: [{ "name": "John", "age": 30, "active": true }]'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                disabled={isGenerating || isParsing}
              />
            </div>

            {/* Prompt Section (Collapsible) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt-input" className="text-base font-semibold">
                  Prompt (Optional)
                </Label>
                <div className="flex gap-2">
                  {showPrompt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePasteRequirement}
                      className="h-8"
                      type="button"
                    >
                      <Clipboard className="mr-2 h-4 w-4" />
                      Try Prompt
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (showPrompt) {
                        // Clear prompt when hiding
                        setPrompt("");
                      }
                      setShowPrompt(!showPrompt);
                    }}
                    type="button"
                    className="h-8"
                  >
                    {showPrompt ? "Hide" : "Show"} Prompt
                  </Button>
                </div>
              </div>
              {showPrompt && (
                <Textarea
                  id="prompt-input"
                  placeholder='Describe your prompt, e.g.: "Make name field searchable and hide price field from table"'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[80px] text-sm"
                  disabled={isGenerating || isParsing}
                />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleParseJSON}
              disabled={isGenerating || isParsing || !jsonInput.trim()}
              variant="outline"
            >
              {isParsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                "Parse JSON"
              )}
            </Button>
            <Button 
              onClick={handleGenerateWithAI}
              disabled={isGenerating || isParsing || !jsonInput.trim()}
              variant="default"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>
            {hasGeneratedUI && (
              <Button 
                variant="ghost" 
                onClick={handleReset} 
                disabled={isGenerating || isParsing}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {(isGenerating || isParsing) && (
          <div className="mt-8 flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {isGenerating ? "Generating UI..." : "Parsing JSON..."}
            </p>
          </div>
        )}

        {/* Inferred Spec Preview */}
        {!isGenerating && !isParsing && showPreview && inferredSpec && (
          <div className="mt-6 space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">UI Spec</h2>
                {specSource && (
                  <p className="text-sm text-muted-foreground">
                    Method:{" "}
                    <span className="font-medium">
                      {specSource === "ai"
                        ? "AI-powered generation"
                        : specSource === "fallback"
                        ? "Fallback parser"
                        : "Deterministic parser"}
                    </span>
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
            </div>
            <pre className="overflow-auto rounded-md bg-muted p-4 text-sm max-h-[400px]">
              {JSON.stringify(inferredSpec, null, 2)}
            </pre>
          </div>
        )}

        {/* Generated UI */}
        {!isGenerating && !isParsing && inferredSpec && parsedData && (
          <div className="mt-8 space-y-4">
            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-4">
              <p className="text-sm text-foreground">
                The admin interface below was created from your JSON payload.
              </p>
            </div>
            <ErrorBoundary>
              <AdminRenderer spec={inferredSpec} initialData={parsedData} />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  );
}
