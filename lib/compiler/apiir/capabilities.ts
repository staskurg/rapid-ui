/**
 * Capability derivation: derive per-resource { list, detail, create, update, delete }
 * from ResourceIR.operations. Embed in ApiIR for lowering and renderer.
 */

import type { ApiIR, ResourceIR, Capabilities } from "./types";

export type { Capabilities } from "./types";

const EMPTY_CAPABILITIES: Capabilities = {
  list: false,
  detail: false,
  create: false,
  update: false,
  delete: false,
};

/**
 * Derive capabilities from a resource's operations.
 * Each capability is true iff an operation of that kind exists.
 */
export function deriveCapabilitiesForResource(resource: ResourceIR): Capabilities {
  const caps = { ...EMPTY_CAPABILITIES };
  for (const op of resource.operations) {
    if (op.kind in caps) {
      (caps as Record<string, boolean>)[op.kind] = true;
    }
  }
  return caps;
}

/**
 * Derive capabilities for all resources and embed in apiIr.resources[].capabilities.
 * Mutates apiIr in place. Call once after buildApiIR.
 */
export function deriveCapabilities(apiIr: ApiIR): void {
  for (const resource of apiIr.resources) {
    resource.capabilities = deriveCapabilitiesForResource(resource);
  }
}
