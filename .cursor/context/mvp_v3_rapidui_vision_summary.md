# RapidUI — Product Vision (v3, Compiler-Aligned)

## What We Are Building

RapidUI is a **compiler** that transforms an **OpenAPI contract** into a deterministic, fully functional user interface.

The UI is not designed, configured, or maintained by humans.
It is a **compiled artifact** of the backend contract.

When the OpenAPI contract changes, the UI is **fully recompiled**.

This is not:
- An admin UI builder
- A no-code tool
- A frontend framework
- An AI UI generator

It is infrastructure.

---

## The Core Problem

Backend APIs evolve constantly.
Internal and operational UIs do not.

This mismatch creates a permanent tax on engineering teams:
- UIs drift as APIs change
- Frontend code becomes an obligation, not leverage
- Internal tools quietly break
- No-code tools still require configuration and upkeep
- AI-generated UIs are fast but untrustworthy

APIs already describe the system.
The UI should not be a second system to maintain.

---

## The Core Insight

The **OpenAPI contract** is already the most complete and authoritative description of a backend system.

If the UI is **compiled directly from that contract**:
- Drift becomes impossible
- Regeneration becomes predictable
- Manual UI work disappears
- Trust increases as the backend evolves

The UI should be **derived**, not authored.

---

## The Invariant Contract

There is a strict and deliberate contract between the user and RapidUI.

### User responsibility
- Define and evolve the OpenAPI contract
- Own backend correctness

### RapidUI responsibility
- Compile a correct UI from the OpenAPI contract
- Recompile it deterministically on every contract change
- Never require manual UI maintenance
- Never introduce ambiguity or hidden state

As long as this contract holds, the product scales naturally.

---

## How This Is Different

Most tools are UI-first:
- Visual builders
- Manual configuration
- Partial regeneration
- Drift over time

RapidUI is contract-first:
- OpenAPI as the single source of truth
- Deterministic compilation
- Full regeneration by default
- No manual overrides
- No configuration surfaces

The UI is regenerated, not edited.
That rule is non-negotiable.

---

## Role of AI (Explicit)

AI does not design the UI.

AI is used as a **constrained compiler stage** to classify semantics that already exist in the OpenAPI contract.

AI output is:
- Fully validated
- Normalized
- Deterministic
- Never trusted without verification

The same OpenAPI input always produces the same UI output.

---

## How the Product Behaves

From the user’s perspective:
- Upload an OpenAPI file
- Get a working UI
- Change the contract
- The UI updates automatically

There are:
- No SDKs
- No frontend code
- No UI configuration
- No manual upgrades

From RapidUI’s perspective:
- The compiler evolves
- The renderer improves
- Internal versions exist but are invisible
- Users move forward automatically

This is a service, not a package.

---

## Why This Is Infrastructure

RapidUI removes **ongoing engineering cost**, not just one-time effort.

As the backend grows:
- The UI remains correct
- The value compounds
- Removal becomes increasingly costly

When teams stop maintaining internal UIs entirely, the product has crossed into infrastructure.

---

## Product Anchor

**RapidUI is a continuously compiled interface layer between OpenAPI contracts and humans.**

That is the abstraction.
