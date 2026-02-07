"use client";

import * as React from "react";
import { AdminRenderer } from "@/components/admin/AdminRenderer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { generateFallbackSpec } from "@/lib/inference/fallback-generator";
import { parsePayload } from "@/lib/inference/payload-parser";
import { generateSpec } from "@/lib/inference/spec-generator";
import type { UISpec } from "@/lib/spec/types";
import { sampleSpec, sampleData } from "@/lib/spec/sample-spec";

export default function Home() {
  const [jsonInput, setJsonInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [inferredSpec, setInferredSpec] = React.useState<UISpec | null>(null);
  const [parsedData, setParsedData] = React.useState<Record<string, unknown>[] | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [useSample, setUseSample] = React.useState(true);

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
    setError(null);
    setInferredSpec(null);
    setParsedData(null);
    setShowPreview(false);
    setUseSample(true);
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
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleParseJSON}>Parse JSON</Button>
          {(showPreview || !useSample) && (
            <Button variant="outline" onClick={handleReset}>
              Reset to Sample
            </Button>
          )}
        </div>
      </div>

      {/* Inferred Spec Preview */}
      {showPreview && inferredSpec && (
        <div className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Inferred UI Spec</h2>
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
              </p>
            </div>
          )}
          <AdminRenderer spec={currentSpec} initialData={currentData} />
        </div>
      )}
    </div>
  );
}
