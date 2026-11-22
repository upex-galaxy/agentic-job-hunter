// Deja un solo cuerpo de instrucciones (AGENTS.md) y un solo store de skills (.agents/skills)
// visibles para Claude Code, Codex, OpenCode y Pi. Idempotente. `--check` no escribe y falla si algo difiere.
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const check = process.argv.includes("--check");
const problems: string[] = [];

function ensureFile(rel: string, content: string) {
  const p = join(root, rel);
  const ok = existsSync(p) && readFileSync(p, "utf8") === content;
  if (ok) return;
  if (check) return void problems.push(`${rel} no coincide con lo esperado`);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, content);
  console.log(`escrito ${rel}`);
}

function ensureLink(rel: string, target: string) {
  const p = join(root, rel);
  const ok = existsSync(p) && lstatSync(p).isSymbolicLink() && readlinkSync(p) === target;
  if (ok) return;
  if (check) return void problems.push(`${rel} debe ser un symlink a ${target}`);
  mkdirSync(join(p, ".."), { recursive: true });
  if (lstatSync(p, { throwIfNoEntry: false })) throw new Error(`${rel} existe y no es el symlink esperado; muévelo a mano`);
  symlinkSync(target, p);
  console.log(`enlazado ${rel} -> ${target}`);
}

// Claude Code: CLAUDE.md importa AGENTS.md; sus skills salen del store único.
ensureFile("CLAUDE.md", "@AGENTS.md\n");
ensureLink(".claude/skills", "../.agents/skills");
// OpenCode: lee AGENTS.md y .agents/skills; el archivo solo fija el esquema y las instrucciones.
ensureFile(
  "opencode.jsonc",
  `{\n  "$schema": "https://opencode.ai/config.json",\n  "instructions": ["AGENTS.md"]\n}\n`,
);
// Codex y Pi leen AGENTS.md y .agents/skills sin configuración extra.

if (!existsSync(join(root, "AGENTS.md"))) problems.push("falta AGENTS.md");
if (!existsSync(join(root, ".agents/skills"))) problems.push("falta .agents/skills");
if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(check ? "compatibilidad al día" : "compatibilidad lista");
