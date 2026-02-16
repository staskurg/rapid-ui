/**
 * CrudAdapter interface for API-backed schema-driven UI.
 * Supports demo API (full CRUD) and external API (read-only).
 */

export type AdapterMode = "demo" | "external";

export interface AdapterCapabilities {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface CrudAdapter {
  mode: AdapterMode;
  capabilities: AdapterCapabilities;

  /** Fetch seed/sample data for spec generation. Never uses live session data. */
  getSample(): Promise<Record<string, unknown>[]>;

  /** Fetch list of records for display. Uses session data for demo; API for external. */
  list(): Promise<Record<string, unknown>[]>;

  /** Fetch a single record by ID. Optional; used for edit form to get fresh data. */
  getById?(id: string | number): Promise<Record<string, unknown>>;

  /** Create a record. Only when capabilities.create is true. */
  create?(input: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Update a record. Only when capabilities.update is true. */
  update?(id: string | number, input: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Delete a record. Only when capabilities.delete is true. */
  remove?(id: string | number): Promise<void>;
}
