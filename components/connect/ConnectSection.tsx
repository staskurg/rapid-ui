"use client";

import * as React from "react";
import { ResourceSelector } from "./ResourceSelector";
import { VersionSelector } from "./VersionSelector";
import { GenerateButton } from "./GenerateButton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RESOURCES } from "@/lib/demoStore/resources";
import type { DemoVersion } from "@/lib/demoStore/seeds";

interface ConnectSectionProps {
  resource: string;
  version: DemoVersion;
  prompt: string;
  onResourceChange: (value: string) => void;
  onVersionChange: (value: DemoVersion) => void;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function ConnectSection({
  resource,
  version,
  prompt,
  onResourceChange,
  onVersionChange,
  onPromptChange,
  onGenerate,
  isGenerating,
}: ConnectSectionProps) {
  const hasValidResource = resource && RESOURCES.some((r) => r.slug === resource);

  return (
    <div className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <ResourceSelector
            value={resource}
            onValueChange={onResourceChange}
            disabled={isGenerating}
          />
          <VersionSelector
            value={version}
            onValueChange={onVersionChange}
            disabled={isGenerating}
          />
        </div>

        {/* Optional prompt field */}
        <div className="space-y-2">
          <Label htmlFor="connect-prompt">Prompt (Optional)</Label>
          <Textarea
            id="connect-prompt"
            placeholder='e.g. "Make name field searchable and hide price from table"'
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="min-h-[80px] text-sm"
            disabled={isGenerating}
          />
        </div>
      </div>

      <GenerateButton
        onClick={onGenerate}
        disabled={!hasValidResource}
        isLoading={isGenerating}
      />
    </div>
  );
}
