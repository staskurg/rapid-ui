# ApiIR corpus vNext — handoff and remaining work

This note ties together the **ApiIR corpus reports vNext** plan (`.cursor/plans/apiir_corpus_reports_vnext_*.plan.md`), **pre–Phase 6 archetypes** ([pre-phase-6-archetypes.md](./pre-phase-6-archetypes.md)), and how that connects to **UISpec**, **eval**, and **renderer** work. Use it when closing out this plan and choosing what to do next.

## What the compiler produces

End-to-end pipeline (unchanged):

**OpenAPI → ApiIR → UiPlan (LLM) → lower → UISpec**

The product surface for generated UIs is **UISpec**. The renderer (`SchemaRenderer` / CRUD views) is largely **schema-driven**: it renders what UISpec and the mock adapter provide. Gaps for new behaviors (including **`listScoped`** and the extended golden archetypes) usually show up first as **wrong or incomplete UISpec**, **mock behavior**, or **planner prompts** — not as a separate “listScoped widget” in the renderer.

## LLM is already on the compile path

A normal `compileOpenAPI` run already calls **`llmPlan`** after `buildApiIR`. The **eval** tasks are **regression harnesses** (real API key, golden/fixture coverage), not the first time the LLM runs:

| Script             | Role (high level)                             |
| ------------------ | --------------------------------------------- |
| `npm run eval:llm` | UiPlan-focused eval (`eval/eval-llm-only.ts`) |
| `npm run eval:ai`  | Broader AI eval path (`eval/eval-ai.ts`)      |
| `npm run eval:all` | Combined run                                  |

After **Phase 6** changes prompts or lowering, run **`eval:llm`** (and/or `eval:ai` / `eval:all` per team habit) once and record outcomes in the PR, per the vNext plan.

## Suggested sequence after Phase 6 lands

1. **Phase 6 complete** — Lowering, mock, and UiPlan treat **`list ∪ listScoped`** consistently; **scope id ≠ row id**; tests (and golden archetypes where pinned) cover the risky cases.
2. **Eval pass** — Exercise goldens/fixtures so **UiPlanIR → UISpec** quality is visible and regressions are caught.
3. **Post–Phase 6 hardening** (see §10 in [pre-phase-6-archetypes.md](./pre-phase-6-archetypes.md)) — `inferIdField` policy alignment, optional live E2E smoke; not required to _start_ Phase 6, but before calling a release “done.”
4. ~~**Phase 9**~~ — Done: [ARCHITECTURE.md](../ARCHITECTURE.md) documents Pipeline A vs B, path conventions, `apiIrVersion` / legacy semantics; `corpus:report` appends a Pipeline A/B footer.
5. **Next product work** — Renderer and UX features can proceed **in parallel** with eval where UISpec shape is already sufficient; treat **eval green + trustworthy UISpec on goldens** as the bar for trusting **all** extended archetypes end-to-end.

## Remaining items for this vNext plan (checklist)

Use the plan file’s frontmatter todos as source of truth; this is the semantic grouping:

| Item                       | Status    | Notes                                                                                                                          |
| -------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Phases 1–5, 7, 8           | Done      | Contract, fixtures, mining/readiness, archetypes track A                                                                       |
| **Phase 6**                | Done      | Lowering (`inferIdField` + `getListItemObjectSchema`), mock uses `primaryListLikeOperation`; prompts already list ∪ listScoped |
| **Phase 9**                | Done      | ARCHITECTURE.md pipelines + path conventions; `corpus-report` footer                                                                                         |
| **Post–Phase 6 hardening** | Remaining | `eval:llm`, `inferIdField` follow-up, optional E2E (see pre-phase-6 doc §10)                                                   |

## References

- vNext plan: `.cursor/plans/apiir_corpus_reports_vnext_6b7b5f26.plan.md`
- ListScoped archetypes and Phase 6 linkage: [pre-phase-6-archetypes.md](./pre-phase-6-archetypes.md)
- Golden archetype catalog: [golden-archetypes.md](./golden-archetypes.md)
- System overview: [ARCHITECTURE.md](../ARCHITECTURE.md)
