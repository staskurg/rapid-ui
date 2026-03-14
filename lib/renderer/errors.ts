/**
 * Renderer invariant errors — fail loudly when pipeline is miswired.
 * Never invent fallbacks; boring and trustworthy > flexible.
 */

export class RendererInvariantError extends Error {
  constructor(message: string) {
    super(`[RendererInvariant] ${message}`);
    this.name = "RendererInvariantError";
    Object.setPrototypeOf(this, RendererInvariantError.prototype);
  }
}
