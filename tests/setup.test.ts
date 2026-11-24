// `bun run setup` en modo no interactivo, sobre una copia del repo y con HOME temporal.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
let dir: string;
let repo: string;
let home: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "jobhunter-setup-"));
  repo = join(dir, "repo");
  home = join(dir, "home");
  mkdirSync(home);
  for (const d of ["scripts", "src", "config", "cv"]) cpSync(join(root, d), join(repo, d), { recursive: true });
  for (const f of ["preferences.json", "notify.json"]) rmSync(join(repo, "config", f), { force: true });
  rmSync(join(repo, "cv/base/profile.json"), { force: true });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function setup(args: string[], extra: Record<string, string> = {}) {
  const env: Record<string, string | undefined> = { ...process.env, HOME: home, ...extra };
  delete env.JOBHUNTER_STATE_DIR;
  delete env.JOBHUNTER_PROFILE_DIR;
  const p = Bun.spawnSync(["bun", join(repo, "scripts/setup.ts"), ...args], { cwd: repo, env, stdin: "ignore" });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}
const prefs = () => JSON.parse(readFileSync(join(repo, "config/preferences.json"), "utf8"));

test("--yes escribe preferencias, notificaciones, estado y perfil sin abrir el navegador", () => {
  const r = setup(["--yes", "--autonomy", "reply_alone_ask_to_apply", "--currency", "eur", "--min", "1000", "--must", "playwright, typescript", "--notify", "file"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("Login de LinkedIn pendiente");
  expect(prefs()).toMatchObject({
    autonomy: "reply_alone_ask_to_apply",
    salary: { currency: "EUR", min: 1000, max: null },
    stack: { must: ["playwright", "typescript"] },
    modality: ["remote"],
    daily_caps: { sends: 33, reads: 40 },
  });
  expect(JSON.parse(readFileSync(join(repo, "config/notify.json"), "utf8")).enabled).toEqual(["file"]);
  expect(existsSync(join(home, ".agentic-job-hunter/inbox"))).toBe(true);
  expect(existsSync(join(repo, "cv/base/profile.json"))).toBe(true);
});

test("sin --force conserva las preferencias existentes", () => {
  expect(setup(["--yes", "--autonomy", "full_auto"]).out).toContain("Mantengo config/preferences.json");
  expect(prefs().autonomy).toBe("reply_alone_ask_to_apply");
});

test("las variables JOBHUNTER_SETUP_* sirven igual que los flags", () => {
  const r = setup(["--force"], { JOBHUNTER_SETUP_YES: "1", JOBHUNTER_SETUP_AUTONOMY: "3", JOBHUNTER_SETUP_NOTIFY: "none" });
  expect(r.code).toBe(0);
  expect(prefs().autonomy).toBe("full_auto");
});

test("sin terminal se comporta como --yes y usa los valores por defecto", () => {
  expect(setup(["--force"]).code).toBe(0);
  expect(prefs()).toMatchObject({ autonomy: "ask_before_send", language: "es" });
});

test("rechaza una autonomía o un canal desconocidos", () => {
  expect(setup(["--yes", "--force", "--autonomy", "yolo"]).code).toBe(1);
  expect(setup(["--yes", "--force", "--notify", "telegram"]).code).toBe(1);
  expect(setup(["--yes", "--force", "--min", "mucho"]).code).toBe(1);
});
