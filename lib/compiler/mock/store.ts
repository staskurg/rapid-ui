/**
 * Shared mock data store per compilation+resource.
 * Key: (compilationId, resourceSlug). No session — URLs are shareable.
 * Uses predefined fixtures for golden specs only.
 */

import { getPredefinedData } from "./fixtures";
import { getObjectSchema } from "../lowering/schema-to-field";
import type { JsonSchema } from "../apiir/types";
import type { UISpec } from "@/lib/spec/types";

/** Collect dot paths for createdAt/updatedAt from schema (top-level and nested). */
function collectTimestampPaths(
  schema: JsonSchema,
  prefix = ""
): { createdAt: string[]; updatedAt: string[] } {
  const createdAt: string[] = [];
  const updatedAt: string[] = [];
  const objSchema = getObjectSchema(schema);
  if (!objSchema?.properties || typeof objSchema.properties !== "object") {
    return { createdAt, updatedAt };
  }
  for (const [key, prop] of Object.entries(objSchema.properties)) {
    if (!prop || typeof prop !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const lower = key.toLowerCase();
    if (lower === "createdat") createdAt.push(path);
    else if (lower === "updatedat") updatedAt.push(path);
    else if (prop.type === "object" && prop.properties) {
      const nested = collectTimestampPaths(
        { type: "object", properties: prop.properties } as JsonSchema,
        path
      );
      createdAt.push(...nested.createdAt);
      updatedAt.push(...nested.updatedAt);
    }
  }
  return { createdAt, updatedAt };
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  const leaf = parts.pop()!;
  let cur: Record<string, unknown> = obj;
  for (const p of parts) {
    if (!(p in cur) || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[leaf] = value;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

interface ResourceData {
  records: Record<string, unknown>[];
  listSchema: JsonSchema;
  idField: string;
}

/** Map: compilationId:resourceSlug -> ResourceData */
const dataStore = new Map<string, ResourceData>();

function storeKey(compilationId: string, resourceSlug: string): string {
  return `${compilationId}:${resourceSlug}`;
}

function getOrCreateResource(
  compId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  idField: string,
  openapiCanonicalHash: string
): ResourceData {
  const key = storeKey(compId, resourceSlug);
  let data = dataStore.get(key);
  if (!data) {
    const predefined = getPredefinedData(openapiCanonicalHash, resourceSlug);
    const records = predefined ?? [];
    data = {
      records: [...records],
      listSchema,
      idField,
    };
    dataStore.set(key, data);
  }
  return data;
}

export function getRecords(
  compilationId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  openapiCanonicalHash: string
): Record<string, unknown>[] {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    resourceSlug,
    listSchema,
    idField,
    openapiCanonicalHash
  );
  return [...data.records];
}

export function createRecord(
  compilationId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  openapiCanonicalHash: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    resourceSlug,
    listSchema,
    idField,
    openapiCanonicalHash
  );

  const nextId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const record = { ...input, [idField]: nextId };

  const now = new Date().toISOString();
  const { createdAt, updatedAt } = collectTimestampPaths(listSchema);
  for (const path of createdAt) {
    if (getByPath(record, path) === undefined) setByPath(record, path, now);
  }
  for (const path of updatedAt) {
    if (getByPath(record, path) === undefined) setByPath(record, path, now);
  }

  data.records.push(record);
  return record;
}

export function getById(
  compilationId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  openapiCanonicalHash: string,
  id: string | number
): Record<string, unknown> | undefined {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    resourceSlug,
    listSchema,
    idField,
    openapiCanonicalHash
  );
  return data.records.find((r) => String(r[idField]) === String(id));
}

export function updateRecord(
  compilationId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  openapiCanonicalHash: string,
  id: string | number,
  input: Record<string, unknown>
): Record<string, unknown> | undefined {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    resourceSlug,
    listSchema,
    idField,
    openapiCanonicalHash
  );

  const idx = data.records.findIndex((r) => String(r[idField]) === String(id));
  if (idx < 0) return undefined;

  const existing = data.records[idx] as Record<string, unknown>;
  const updated = { ...existing, ...input, [idField]: existing[idField] };

  const now = new Date().toISOString();
  const { updatedAt } = collectTimestampPaths(listSchema);
  for (const path of updatedAt) {
    setByPath(updated, path, now);
  }

  data.records[idx] = updated;
  return updated;
}

export function deleteRecord(
  compilationId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  openapiCanonicalHash: string,
  id: string | number
): boolean {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    resourceSlug,
    listSchema,
    idField,
    openapiCanonicalHash
  );

  const idx = data.records.findIndex((r) => String(r[idField]) === String(id));
  if (idx < 0) return false;
  data.records.splice(idx, 1);
  return true;
}

/** Clear all mock data for a compilation (used on re-compile). */
export function clearForCompilation(compilationId: string): void {
  const keysToDelete: string[] = [];
  for (const key of dataStore.keys()) {
    if (key.startsWith(`${compilationId}:`)) keysToDelete.push(key);
  }
  for (const k of keysToDelete) dataStore.delete(k);
}
