// Genera un CV con build_cv.py y lo vuelve a abrir. Requiere el venv local (.venv con python-docx); sin él, se salta.
import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const py = join(root, ".venv/bin/python");
const script = join(root, ".agents/skills/cv-tuning/scripts/build_cv.py");
const out = mkdtempSync(join(tmpdir(), "jobhunter-cv-"));
afterAll(() => rmSync(out, { recursive: true, force: true }));
const hasVenv = existsSync(py) && Bun.spawnSync([py, "-c", "import docx"]).exitCode === 0;

const build = (...args: string[]) => {
  const p = Bun.spawnSync([py, script, ...args]);
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
};
const paragraphs = (file: string) =>
  JSON.parse(Bun.spawnSync([py, "-c", `import docx,json,sys; print(json.dumps([p.text for p in docx.Document(sys.argv[1]).paragraphs]))`, file]).stdout.toString());

test.skipIf(!hasVenv)("desde la plantilla vacía genera un .docx válido y avisa que falta el nombre", () => {
  const r = build("--profile", join(root, "cv/base/profile.template.json"), "--out", join(out, "template"));
  expect(r.code).toBe(0);
  expect(r.err).toContain("no tiene nombre");
  expect(paragraphs(join(out, "template.docx"))).toEqual(["Nombre"]);
});

test.skipIf(!hasVenv)("con perfil y oferta elige los bullets por etiqueta, sin inventar", () => {
  const r = build("--profile", join(root, "tests/fixtures/profile.example.json"), "--offer", join(root, "tests/fixtures/offer.example.json"), "--out", join(out, "ejemplo"));
  expect(r.code).toBe(0);
  const text: string[] = paragraphs(join(out, "ejemplo.docx"));
  expect(text[0]).toBe("Ana Ejemplo");
  expect(text).toContain("Automaticé pruebas end to end con Playwright.");
  expect(text).toContain("Diseñé pruebas de API con Postman.");
  expect(text).not.toContain("Documenté casos manuales."); // max_bullets=2
});

test.skipIf(!hasVenv)("se detiene si el perfil contiene un dato de never_include", () => {
  const profile = join(out, "bad.json");
  writeFileSync(profile, JSON.stringify({ name: "Ana", summary: "DNI 123", never_include: ["DNI"] }));
  const r = build("--profile", profile, "--out", join(out, "bad"));
  expect(r.code).not.toBe(0);
  expect(r.err).toContain("never_include");
});
