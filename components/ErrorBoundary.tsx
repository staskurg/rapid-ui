"use client";

import type { ReactNode, ComponentType, ErrorInfo } from "react";
import { 
  ErrorBoundary as ReactErrorBoundary, 
  type FallbackProps,
} from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 rounded-lg border border-destructive/50 bg-destructive/5 p-8">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-destructive">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {errorMessage || "An unexpected error occurred"}
        </p>
      </div>
      <Button onClick={resetErrorBoundary} variant="outline">
        Try Again
      </Button>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<FallbackProps>;
  onError?: (error: unknown, errorInfo: ErrorInfo) => void;
}

/**
 * Error Boundary component for catching React rendering errors.
 * 
 * Uses react-error-boundary library which provides a cleaner API while
 * still using class components under the hood (required by React).
 */
export function ErrorBoundary({
  children,
  fallback,
  onError,
}: ErrorBoundaryProps) {
  const FallbackComponent = fallback || ErrorFallback;

  return (
    <ReactErrorBoundary
      FallbackComponent={FallbackComponent}
      onError={onError}
    >
      {children}
    </ReactErrorBoundary>
  );
}
