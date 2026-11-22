// Detecta qué agentes tienes instalados y aplica la compatibilidad. No instala nada.
import { $ } from "bun";

const agents = [
  { name: "Claude Code", bin: "claude", reads: "CLAUDE.md -> AGENTS.md, .claude/skills -> .agents/skills" },
  { name: "Codex", bin: "codex", reads: "AGENTS.md, .agents/skills" },
  { name: "OpenCode", bin: "opencode", reads: "AGENTS.md (opencode.jsonc), .agents/skills" },
  { name: "Pi", bin: "pi", reads: "AGENTS.md, .agents/skills" },
];

await $`bun ${import.meta.dir}/agent-compat.ts`;
console.log("\nAgentes:");
for (const a of agents) {
  const found = Bun.which(a.bin);
  console.log(`  ${found ? "ok     " : "falta  "} ${a.name.padEnd(12)} ${found ? a.reads : `instala \`${a.bin}\` si quieres usarlo`}`);
}
console.log("\nHerramientas:");
for (const t of ["playwright-cli", "jq"]) console.log(`  ${Bun.which(t) ? "ok     " : "falta  "} ${t}`);
console.log("\nSiguiente paso: bun run setup");
