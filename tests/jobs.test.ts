import { expect, test } from "bun:test";
import { openDb, listEvents } from "../src/db";
import { run } from "../src/jobs-cli";
process.env.JOBHUNTER_DB = ":memory:"; // el panel no debe tocar el estado real
const { handle } = await import("../src/board");

test("el CLI agrega, mueve y anota una postulación", () => {
  const db = openDb(":memory:");
  expect(run(["add", "--company", "Acme", "--role", "QA Engineer"], db)).toContain("[recibida]");
  expect(run(["move", "1", "entrevista"], db)).toBe("#1 -> entrevista");
  run(["note", "1", "pidió", "disponibilidad"], db);
  expect(run(["list", "--stage", "entrevista"], db)).toContain("Acme");
  expect(listEvents(db, 1).map((e) => e.kind)).toEqual(["stage", "stage", "note"]);
});

test("rechaza etapas inválidas", () => {
  const db = openDb(":memory:");
  run(["add", "--company", "Acme", "--role", "Dev"], db);
  expect(() => run(["move", "1", "volando"], db)).toThrow("etapa inválida");
});

test("la API cambia la etapa", async () => {
  const created = await handle(
    new Request("http://x/api/applications", { method: "POST", body: JSON.stringify({ company: "Beta", role: "SDET" }) }),
  );
  const { id } = (await created.json()) as { id: number };
  const res = await handle(
    new Request(`http://x/api/applications/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage: "postulada" }) }),
  );
  expect(((await res.json()) as { stage: string }).stage).toBe("postulada");
});
