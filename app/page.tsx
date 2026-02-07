"use client";

import * as React from "react";
import { AdminRenderer } from "@/components/admin/AdminRenderer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { generateFallbackSpec } from "@/lib/inference/fallback-generator";
import { parsePayload } from "@/lib/inference/payload-parser";
import { generateSpec } from "@/lib/inference/spec-generator";
import type { UISpec } from "@/lib/spec/types";
import { sampleSpec, sampleData } from "@/lib/spec/sample-spec";

export default function Home() {
  const [jsonInput, setJsonInput] = React.useState("");
  const [intent, setIntent] = React.useState("");
  const [showIntent, setShowIntent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inferredSpec, setInferredSpec] = React.useState<UISpec | null>(null);
  const [parsedData, setParsedData] = React.useState<Record<string, unknown>[] | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [useSample, setUseSample] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [specSource, setSpecSource] = React.useState<"ai" | "fallback" | "deterministic" | null>(null);

  // Use sample data by default
  const currentSpec = inferredSpec || sampleSpec;
  const currentData = parsedData || sampleData;

  const handleParseJSON = () => {
    setError(null);
    setShowPreview(false);

    if (!jsonInput.trim()) {
      setError("Please enter JSON data");
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
      setUseSample(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON format");
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
        setShowPreview(true);
        setUseSample(false);
      } catch (fallbackErr) {
        console.error("Fallback generator also failed:", fallbackErr);
      }
    }
  };

  const handleReset = () => {
    setJsonInput("");
    setIntent("");
    setShowIntent(false);
    setError(null);
    setInferredSpec(null);
    setParsedData(null);
    setShowPreview(false);
    setUseSample(true);
    setSpecSource(null);
  };

  const handleGenerateWithAI = async () => {
    setError(null);
    setShowPreview(false);
    setIsGenerating(true);

    if (!jsonInput.trim()) {
      setError("Please enter JSON data");
      setIsGenerating(false);
      return;
    }

    try {
      // Parse JSON to validate it
      const parsed = JSON.parse(jsonInput);
      const dataArray = Array.isArray(parsed) ? parsed : [parsed];

      // Call AI API
      const response = await fetch("/api/generate-ui", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: parsed,
          intent: intent.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate UI spec";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const { spec, source } = result;

      // Set both spec and data together
      setParsedData(dataArray as Record<string, unknown>[]);
      setInferredSpec(spec);
      setSpecSource(source);
      setShowPreview(true);
      setUseSample(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate UI spec");
      console.error("AI generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">AI Admin UI Generator</h1>
        <p className="text-muted-foreground">
          Paste your JSON payload to automatically generate a fully functional admin UI
        </p>
      </div>

      {/* JSON Input Section */}
      <div className="space-y-4 rounded-lg border p-6">
        <div className="space-y-2">
          <Label htmlFor="json-input">JSON Payload</Label>
          <Textarea
            id="json-input"
            placeholder='Paste your JSON here, e.g.: [{ "name": "John", "age": 30, "active": true }]'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
            disabled={isGenerating}
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Intent Section (Collapsible) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="intent-input">Intent (Optional)</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowIntent(!showIntent)}
              type="button"
            >
              {showIntent ? "Hide" : "Show"} Intent
            </Button>
          </div>
          {showIntent && (
            <Textarea
              id="intent-input"
              placeholder='Describe your requirements, e.g.: "Make name field searchable and hide price field from table"'
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="min-h-[80px] text-sm"
              disabled={isGenerating}
            />
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleParseJSON}
            disabled={isGenerating}
          >
            Parse JSON
          </Button>
          <Button 
            onClick={handleGenerateWithAI}
            disabled={isGenerating || !jsonInput.trim()}
            variant="default"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating with AI...
              </>
            ) : (
              "Generate with AI"
            )}
          </Button>
          {(showPreview || !useSample) && (
            <Button variant="outline" onClick={handleReset} disabled={isGenerating}>
              Reset to Sample
            </Button>
          )}
        </div>
      </div>

      {/* Inferred Spec Preview */}
      {showPreview && inferredSpec && (
        <div className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Generated UI Spec</h2>
              {specSource && (
                <p className="text-sm text-muted-foreground">
                  Source:{" "}
                  <span className="font-medium">
                    {specSource === "ai"
                      ? "Generated by AI"
                      : specSource === "fallback"
                      ? "Fallback Parser"
                      : "Deterministic Parser"}
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
          <pre className="overflow-auto rounded-md bg-muted p-4 text-sm">
            {JSON.stringify(inferredSpec, null, 2)}
          </pre>
        </div>
      )}

      {/* Generated UI */}
      {currentSpec && (
        <div className="space-y-4">
          {!useSample && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Generated UI:</strong> The admin interface below was generated from your JSON payload.
                {specSource === "ai" && " ✨ Generated with AI"}
                {specSource === "fallback" && " (Using fallback parser)"}
              </p>
            </div>
          )}
          <AdminRenderer spec={currentSpec} initialData={currentData} />
        </div>
      )}
    </div>
  );
}
