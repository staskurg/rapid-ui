/**
 * In-memory demo store with session-scoped data.
 * Per-session data = mutable copy, initialized from seeds on first access.
 * Each version is isolated — no shared records.
 */

import { getResourceBySlug } from "./resources";
import { getSeedSample, type DemoVersion } from "./seeds";

type RecordData = Record<string, unknown>;

const sessionStore = new Map<string, RecordData[]>();

function storeKey(sessionId: string, resource: string, version: DemoVersion): string {
  return `${sessionId}:${resource}:v${version}`;
}

function ensureSessionData(sessionId: string, resource: string, version: DemoVersion): RecordData[] {
  const key = storeKey(sessionId, resource, version);
  let data = sessionStore.get(key);
  if (!data) {
    data = getSeedSample(resource, version).map((r) => ({ ...r }));
    sessionStore.set(key, data);
  }
  return data;
}

function isNumericId(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value);
}

function generateNumericId(records: RecordData[], idField: string): number {
  const max = records.reduce<number>((maxVal, r) => {
    const id = r[idField];
    if (typeof id === "number" && id > maxVal) return id;
    return maxVal;
  }, 0);
  return max + 1;
}

function generateStringId(records: RecordData[], idField: string, resource: string): string {
  const prefix = resource === "orders" ? "ORD" : resource === "inventory" ? "SKU" : "rec";
  const existing = new Set(records.map((r) => String(r[idField] ?? "")));
  for (let i = 1; i < 10000; i++) {
    const candidate = `${prefix}-${String(i).padStart(3, "0")}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${prefix}-${Date.now()}`;
}

export function getRecords(
  sessionId: string,
  resource: string,
  version: DemoVersion
): RecordData[] {
  const def = getResourceBySlug(resource);
  if (!def) return [];
  const data = ensureSessionData(sessionId, resource, version);
  return data.map((r) => ({ ...r }));
}

export function getRecordById(
  sessionId: string,
  resource: string,
  version: DemoVersion,
  id: string | number
): RecordData | undefined {
  const def = getResourceBySlug(resource);
  if (!def) return undefined;
  const data = ensureSessionData(sessionId, resource, version);
  const idStr = String(id);
  return data.find((r) => String(r[def.idField]) === idStr) ?? undefined;
}

export function createRecord(
  sessionId: string,
  resource: string,
  version: DemoVersion,
  input: RecordData
): RecordData {
  const def = getResourceBySlug(resource);
  if (!def) throw new Error(`Unknown resource: ${resource}`);
  const data = ensureSessionData(sessionId, resource, version);
  const record = { ...input };
  if (record[def.idField] === undefined || record[def.idField] === null) {
    const firstSeed = getSeedSample(resource, version)[0];
    const sampleId = firstSeed?.[def.idField];
    if (isNumericId(sampleId)) {
      record[def.idField] = generateNumericId(data, def.idField);
    } else {
      record[def.idField] = generateStringId(data, def.idField, resource);
    }
  }
  data.push(record);
  return { ...record };
}

export function updateRecord(
  sessionId: string,
  resource: string,
  version: DemoVersion,
  id: string | number,
  input: RecordData
): RecordData | null {
  const def = getResourceBySlug(resource);
  if (!def) return null;
  const data = ensureSessionData(sessionId, resource, version);
  const idStr = String(id);
  const idx = data.findIndex((r) => String(r[def.idField]) === idStr);
  if (idx < 0) return null;
  const updated = { ...data[idx], ...input, [def.idField]: data[idx][def.idField] };
  data[idx] = updated;
  return { ...updated };
}

export function deleteRecord(
  sessionId: string,
  resource: string,
  version: DemoVersion,
  id: string | number
): boolean {
  const def = getResourceBySlug(resource);
  if (!def) return false;
  const data = ensureSessionData(sessionId, resource, version);
  const idStr = String(id);
  const idx = data.findIndex((r) => String(r[def.idField]) === idStr);
  if (idx < 0) return false;
  data.splice(idx, 1);
  return true;
}

export function resetSession(
  sessionId: string,
  resource: string,
  version: DemoVersion
): void {
  const key = storeKey(sessionId, resource, version);
  const fresh = getSeedSample(resource, version).map((r) => ({ ...r }));
  sessionStore.set(key, fresh);
}
