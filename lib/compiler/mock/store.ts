/**
 * Per-session mock data store.
 * Key: (compilationId, sessionId, resourceSlug).
 * Seeds initialized from seed-generator on first access.
 */

import { generateSeeds } from "./seed-generator";
import type { JsonSchema } from "../apiir/types";
import type { UISpec } from "@/lib/spec/types";

type SessionKey = string;
type ResourceSlug = string;

interface ResourceData {
  records: Record<string, unknown>[];
  listSchema: JsonSchema;
  idField: string;
}

/** Map: sessionKey -> resourceSlug -> ResourceData */
const sessionStore = new Map<SessionKey, Map<ResourceSlug, ResourceData>>();

function sessionKey(compilationId: string, sessionId: string): SessionKey {
  return `${compilationId}:${sessionId}`;
}

function getOrCreateResource(
  compId: string,
  sessionId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  idField: string
): ResourceData {
  const sk = sessionKey(compId, sessionId);
  let sessionMap = sessionStore.get(sk);
  if (!sessionMap) {
    sessionMap = new Map();
    sessionStore.set(sk, sessionMap);
  }

  let data = sessionMap.get(resourceSlug);
  if (!data) {
    const seeds = generateSeeds(listSchema, idField);
    data = {
      records: [...seeds],
      listSchema,
      idField,
    };
    sessionMap.set(resourceSlug, data);
  }
  return data;
}

export function getRecords(
  compilationId: string,
  sessionId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec
): Record<string, unknown>[] {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    sessionId,
    resourceSlug,
    listSchema,
    idField
  );
  return [...data.records];
}

export function createRecord(
  compilationId: string,
  sessionId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  input: Record<string, unknown>
): Record<string, unknown> {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    sessionId,
    resourceSlug,
    listSchema,
    idField
  );

  const nextId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const record = { ...input, [idField]: nextId };
  data.records.push(record);
  return record;
}

export function getById(
  compilationId: string,
  sessionId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  id: string | number
): Record<string, unknown> | undefined {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    sessionId,
    resourceSlug,
    listSchema,
    idField
  );
  return data.records.find((r) => String(r[idField]) === String(id));
}

export function updateRecord(
  compilationId: string,
  sessionId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  id: string | number,
  input: Record<string, unknown>
): Record<string, unknown> | undefined {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    sessionId,
    resourceSlug,
    listSchema,
    idField
  );

  const idx = data.records.findIndex((r) => String(r[idField]) === String(id));
  if (idx < 0) return undefined;

  const existing = data.records[idx] as Record<string, unknown>;
  const updated = { ...existing, ...input, [idField]: existing[idField] };
  data.records[idx] = updated;
  return updated;
}

export function deleteRecord(
  compilationId: string,
  sessionId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec,
  id: string | number
): boolean {
  const idField = spec.idField ?? "id";
  const data = getOrCreateResource(
    compilationId,
    sessionId,
    resourceSlug,
    listSchema,
    idField
  );

  const idx = data.records.findIndex((r) => String(r[idField]) === String(id));
  if (idx < 0) return false;
  data.records.splice(idx, 1);
  return true;
}

export function reset(
  compilationId: string,
  sessionId: string,
  resourceSlug: string,
  listSchema: JsonSchema,
  spec: UISpec
): void {
  const idField = spec.idField ?? "id";
  const sk = sessionKey(compilationId, sessionId);
  const sessionMap = sessionStore.get(sk);
  if (!sessionMap) return;

  const seeds = generateSeeds(listSchema, idField);
  sessionMap.set(resourceSlug, {
    records: [...seeds],
    listSchema,
    idField,
  });
}
