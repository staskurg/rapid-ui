"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataPathSelector } from "./DataPathSelector";
import { GenerateButton } from "./GenerateButton";
import { Link2, X, Clipboard } from "lucide-react";

interface ExternalApiSectionProps {
  url: string;
  dataPath: string;
  prompt: string;
  showPrompt: boolean;
  onUrlChange: (value: string) => void;
  onDataPathChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onShowPromptChange: (show: boolean) => void;
  onTryExample: () => void;
  onTryPrompt: () => void;
  onClear: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function ExternalApiSection({
  url,
  dataPath,
  prompt,
  showPrompt,
  onUrlChange,
  onDataPathChange,
  onPromptChange,
  onShowPromptChange,
  onTryExample,
  onTryPrompt,
  onClear,
  onGenerate,
  isGenerating,
}: ExternalApiSectionProps) {
  const hasValidUrl = url.trim().length > 0;

  return (
    <div className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="external-url">API URL</Label>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onTryExample}
                className="h-7 text-xs"
                type="button"
                disabled={isGenerating}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                Try Example
              </Button>
              {url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className="h-7 w-7 p-0"
                  type="button"
                  disabled={isGenerating}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <Input
            id="external-url"
            type="url"
            placeholder="https://jsonplaceholder.typicode.com/users"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isGenerating}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Public REST API that returns JSON (array or wrapped object)
          </p>
        </div>

        <DataPathSelector
          value={dataPath}
          onValueChange={onDataPathChange}
          disabled={isGenerating}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="external-prompt">Prompt (Optional)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (showPrompt) onPromptChange("");
                onShowPromptChange(!showPrompt);
              }}
              type="button"
              className="h-7 text-xs"
              disabled={isGenerating}
            >
              {showPrompt ? "Hide" : "Show"}
            </Button>
          </div>
          {showPrompt && (
            <>
              <Textarea
                id="external-prompt"
                placeholder='e.g. "Show email and phone in the table"'
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="min-h-[60px] text-sm"
                disabled={isGenerating}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onTryPrompt}
                className="h-7 text-xs"
                type="button"
                disabled={isGenerating}
              >
                <Clipboard className="mr-1.5 h-3.5 w-3.5" />
                Try Prompt
              </Button>
            </>
          )}
        </div>
      </div>

      <GenerateButton
        onClick={onGenerate}
        disabled={!hasValidUrl}
        isLoading={isGenerating}
      />
    </div>
  );
}
