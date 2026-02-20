"use client";

import * as React from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".yaml,.yml,.json";

export interface OpenApiDropZoneProps {
  onFile: (content: string, filename: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export function OpenApiDropZone({
  onFile,
  onError,
  disabled,
  className,
}: OpenApiDropZoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const readFile = React.useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["yaml", "yml", "json"].includes(ext ?? "")) {
        onError?.(`Unsupported file type. Use .yaml, .yml, or .json`);
        return;
      }
      try {
        const text = await file.text();
        onFile(text, file.name);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Failed to read file");
      }
    },
    [onFile, onError]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (!file) return;
      readFile(file);
    },
    [disabled, readFile]
  );

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

  const handleClick = React.useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) readFile(file);
      e.target.value = "";
    },
    [readFile]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
        "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
        isDragOver && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Upload className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">
            Drop OpenAPI spec here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Accepts .yaml, .yml, .json
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-4 w-4" />
          OpenAPI 3.0.x or 3.1.x
        </div>
      </div>
    </div>
  );
}
