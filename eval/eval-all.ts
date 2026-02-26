#!/usr/bin/env tsx
/**
 * Run eval:ai and eval:llm in parallel.
 * Exit 0 only if both pass.
 * Forwards: --parallel, --runs, --quick, --fixture, --output-dir, --json
 */

import { spawn } from "child_process";

const SCRIPT_AI = "eval/eval-ai.ts";
const SCRIPT_LLM = "eval/eval-llm-only.ts";

function main() {
  const args = process.argv.slice(2);

  const p1 = spawn(
    "npx",
    ["tsx", "--env-file-if-exists=.env.local", SCRIPT_AI, ...args],
    { stdio: "inherit", cwd: process.cwd() }
  );

  const p2 = spawn(
    "npx",
    ["tsx", "--env-file-if-exists=.env.local", SCRIPT_LLM, ...args],
    { stdio: "inherit", cwd: process.cwd() }
  );

  Promise.all([
    new Promise<number>((resolve) => p1.on("close", (code) => resolve(code ?? 0))),
    new Promise<number>((resolve) => p2.on("close", (code) => resolve(code ?? 0))),
  ]).then(([code1, code2]) => {
    const failed = code1 !== 0 || code2 !== 0;
    process.exit(failed ? 1 : 0);
  });
}

main();
