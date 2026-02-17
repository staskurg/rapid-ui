/**
 * Centralized OpenAI API metrics tracking.
 *
 * All OpenAI call sites (api route, eval harness) use recordOpenAICall().
 * Uses OpenTelemetry GenAI semantic conventions for attribute names so we can
 * plug in an OTLP exporter later without changing call sites.
 *
 * Phase 1: Console sink only (structured JSON logs).
 * Phase 2: Add DB sink (Vercel Postgres) - see comments below.
 * Future: OTLP exporter - add @opentelemetry/api and push spans to Honeycomb, Jaeger, or Datadog.
 */

/** Source of the OpenAI call: production API or eval harness */
export type OpenAICallSource = "api" | "eval";

/** Success or error status */
export type OpenAICallStatus = "success" | "error";

/**
 * Event payload for each OpenAI API call.
 * Attribute names follow OTel GenAI semantic conventions.
 */
export interface OpenAICallEvent {
  /** ISO timestamp when the call completed */
  timestamp: string;
  /** Model used, e.g. "gpt-4o-mini" */
  model: string;
  /** Latency in milliseconds */
  duration_ms: number;
  /** Input/prompt tokens */
  prompt_tokens: number;
  /** Output/completion tokens */
  completion_tokens: number;
  /** Where the call originated */
  source: OpenAICallSource;
  /** Whether the call succeeded or failed */
  status: OpenAICallStatus;
}

/**
 * Sink interface: receives events for logging, DB storage, or OTLP export.
 * Call sites never change when adding new sinks.
 */
export type MetricsSink = (event: OpenAICallEvent) => void | Promise<void>;

/** Registered sinks. Add dbSink here in Phase 2. */
const sinks: MetricsSink[] = [];

/** ANSI colors for console output */
const C = {
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

/**
 * Console sink: writes structured JSON to stdout.
 * In development: pretty-printed with color. In production: compact JSON for log aggregators.
 */
function consoleSink(event: OpenAICallEvent): void {
  const logEvent = {
    event: "openai_call",
    timestamp: event.timestamp,
    "gen_ai.request.model": event.model,
    "gen_ai.operation.duration_ms": event.duration_ms,
    "gen_ai.usage.input_tokens": event.prompt_tokens,
    "gen_ai.usage.output_tokens": event.completion_tokens,
    "rapidui.source": event.source,
    "gen_ai.response.status": event.status,
  };

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const statusColor = event.status === "success" ? C.green : C.red;
    const json = JSON.stringify(logEvent, null, 2);
    console.log(
      `${C.cyan}[OpenAI]${C.reset} ${statusColor}${event.status}${C.reset}\n${C.dim}${json}${C.reset}`
    );
  } else {
    console.log(JSON.stringify(logEvent));
  }
}

/**
 * Phase 2: DB sink for analytics dashboard.
 * Uncomment and register when Vercel Postgres is set up.
 *
 * 1. Create table via migration or SQL:
 *    CREATE TABLE openai_calls (
 *      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *      timestamp timestamptz NOT NULL,
 *      model text NOT NULL,
 *      duration_ms int NOT NULL,
 *      prompt_tokens int NOT NULL,
 *      completion_tokens int NOT NULL,
 *      source text NOT NULL,
 *      status text NOT NULL
 *    );
 *
 * 2. Add dbSink and register:
 *    import { sql } from "@vercel/postgres";
 *    async function dbSink(event: OpenAICallEvent) {
 *      await sql`INSERT INTO openai_calls (timestamp, model, duration_ms, prompt_tokens, completion_tokens, source, status)
 *        VALUES (${event.timestamp}, ${event.model}, ${event.duration_ms}, ${event.prompt_tokens}, ${event.completion_tokens}, ${event.source}, ${event.status})`;
 *    }
 *    sinks.push(dbSink);
 *
 * 3. Analytics: Add GET /api/admin/analytics and /admin/analytics page.
 *    Query aggregates: calls over time, total tokens, latency (avg/p95), success vs error rate, breakdown by source/model.
 */

// Register default sink
sinks.push(consoleSink);

/**
 * Record an OpenAI API call. Passes the event to all registered sinks.
 * Fire-and-forget: does not await async sinks to avoid blocking callers.
 *
 * Set OPENAI_METRICS_DISABLED=true to disable (e.g. in CI to reduce noise).
 */
export function recordOpenAICall(event: OpenAICallEvent): void {
  if (process.env.OPENAI_METRICS_DISABLED === "true") {
    return;
  }

  const normalized: OpenAICallEvent = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  for (const sink of sinks) {
    try {
      const result = sink(normalized);
      if (result instanceof Promise) {
        result.catch((err) =>
          console.error("[metrics] Sink error:", err)
        );
      }
    } catch (err) {
      console.error("[metrics] Sink error:", err);
    }
  }
}
