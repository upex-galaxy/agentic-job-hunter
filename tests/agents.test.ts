// agents:compat sobre una copia mínima del repo: crea las rutas de Claude Code y OpenCode y `--check` las valida.
import { afterAll, expect, test } from "bun:test";
import { cpSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "jobhunter-agents-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
for (const p of ["AGENTS.md", ".agents", "scripts/agent-compat.ts"]) cpSync(join(root, p), join(dir, p), { recursive: true });
const compat = (...a: string[]) => Bun.spawnSync(["bun", join(dir, "scripts/agent-compat.ts"), ...a]).exitCode;

test("--check falla en una copia sin preparar y pasa tras aplicar", () => {
  expect(compat("--check")).toBe(1);
  expect(compat()).toBe(0);
  expect(compat()).toBe(0); // idempotente
  expect(compat("--check")).toBe(0);
});

test("las cuatro rutas ven AGENTS.md y las cuatro skills", () => {
  expect(readFileSync(join(dir, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
  expect(lstatSync(join(dir, ".claude/skills")).isSymbolicLink()).toBe(true);
  expect(readlinkSync(join(dir, ".claude/skills"))).toBe("../.agents/skills");
  expect(JSON.parse(readFileSync(join(dir, "opencode.jsonc"), "utf8")).instructions).toEqual(["AGENTS.md"]);
  const skills = ["cv-tuning", "interview-scheduling", "linkedin-browser", "recruiter-attention"];
  expect(readdirSync(join(dir, ".claude/skills")).sort()).toEqual(skills);
  expect(readdirSync(join(dir, ".agents/skills")).sort()).toEqual(skills); // Codex, OpenCode y Pi
});
