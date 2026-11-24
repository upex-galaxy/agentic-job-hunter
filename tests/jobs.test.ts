import { expect, test } from "bun:test";
import { openDb, listEvents } from "../src/db";
import { run } from "../src/jobs-cli";
process.env.JOBHUNTER_DB = ":memory:"; // el panel no debe tocar el estado real
const { handle } = await import("../src/board");

const api = async (method: string, path: string, body?: unknown) => {
  const res = await handle(new Request(`http://x${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> & Record<string, unknown>[] };
};

test("el CLI agrega, mueve y anota una postulación", () => {
  const db = openDb(":memory:");
  expect(run(["add", "--company", "Acme", "--role", "QA Engineer"], db)).toContain("[recibida]");
  expect(run(["move", "1", "entrevista"], db)).toBe("#1 -> entrevista");
  run(["note", "1", "pidió", "disponibilidad"], db);
  expect(run(["list", "--stage", "entrevista"], db)).toContain("Acme");
  expect(listEvents(db, 1).map((e) => e.kind)).toEqual(["stage", "stage", "note"]);
});

test("rechaza etapas inválidas sin cambiar la tarjeta ni el historial", () => {
  const db = openDb(":memory:");
  run(["add", "--company", "Acme", "--role", "Dev"], db);
  expect(() => run(["move", "1", "volando"], db)).toThrow("etapa inválida");
  expect(() => run(["move", "1", ""], db)).toThrow("etapa inválida");
  expect(() => run(["add", "--company", "Beta", "--role", "QA", "--stage", "volando"], db)).toThrow("etapa inválida");
  expect(() => run(["move", "99", "postulada"], db)).toThrow("no existe");
  expect(run(["list", "--stage", "recibida"], db)).toContain("Acme");
  expect(listEvents(db, 1)).toHaveLength(1);
});

test("note y log guardan el texto con su tipo, y rechazan textos vacíos", () => {
  const db = openDb(":memory:");
  run(["add", "--company", "Acme", "--role", "Dev"], db);
  expect(run(["note", "1", "pide", "inglés", "B2"], db)).toBe("#1 note guardada");
  expect(run(["log", "1", "respondí con el rango"], db)).toBe("#1 log guardada");
  const ev = listEvents(db, 1).slice(1).map((e) => [e.kind, e.body]);
  expect(ev).toEqual([
    ["note", "pide inglés B2"],
    ["log", "respondí con el rango"],
  ]);
  expect(() => run(["note", "1", "  "], db)).toThrow("vacía");
  expect(() => run(["log", "7", "hola"], db)).toThrow("no existe");
  const json = JSON.parse(run(["list", "--json"], db));
  expect(json[0].events.map((e: { kind: string }) => e.kind)).toEqual(["stage", "note", "log"]);
});

test("template devuelve una plantilla y rechaza nombres desconocidos", () => {
  expect(run(["template", "declinar"], openDb(":memory:")).length).toBeGreaterThan(0);
  expect(() => run(["template", "../package"], openDb(":memory:"))).toThrow("plantilla desconocida");
});

test("PATCH /stage cambia la etapa y deja el evento", async () => {
  const created = await api("POST", "/api/applications", { company: "Beta", role: "SDET" });
  expect(created.status).toBe(201);
  const id = created.body.id as number;
  const res = await api("PATCH", `/api/applications/${id}/stage`, { stage: "postulada" });
  expect(res.status).toBe(200);
  expect(res.body.stage).toBe("postulada");
  const all = await api("GET", "/api/applications");
  const card = all.body.find((a) => a.id === id) as { events: { body: string }[] };
  expect(card.events.map((e) => e.body)).toContain("recibida -> postulada");
});

test("PATCH /stage responde 400 con etapa inválida, id inexistente o JSON roto", async () => {
  const { body } = await api("POST", "/api/applications", { company: "Gamma", role: "QA" });
  const bad = await api("PATCH", `/api/applications/${body.id}/stage`, { stage: "volando" });
  expect(bad.status).toBe(400);
  expect(bad.body.error).toContain("etapa inválida");
  expect((await api("PATCH", "/api/applications/9999/stage", { stage: "postulada" })).status).toBe(400);
  const broken = await handle(new Request(`http://x/api/applications/${body.id}/stage`, { method: "PATCH", body: "{" }));
  expect(broken.status).toBe(400);
  const after = await api("GET", "/api/applications");
  expect((after.body.find((a) => a.id === body.id) as { stage: string }).stage).toBe("recibida");
});

test("POST /notes agrega una nota y rechaza vacías", async () => {
  const { body } = await api("POST", "/api/applications", { company: "Delta", role: "QA" });
  expect((await api("POST", `/api/applications/${body.id}/notes`, { body: "llamar el lunes" })).status).toBe(201);
  expect((await api("POST", `/api/applications/${body.id}/notes`, { body: "" })).status).toBe(400);
  const all = await api("GET", "/api/applications");
  const card = all.body.find((a) => a.id === body.id) as { events: { kind: string; body: string }[] };
  expect(card.events.at(-1)).toMatchObject({ kind: "note", body: "llamar el lunes" });
});

test("la API valida altas y responde 404 a rutas desconocidas", async () => {
  expect((await api("POST", "/api/applications", { company: "", role: "QA" })).status).toBe(400);
  expect((await api("GET", "/api/stages")).body).toContain("entrevista");
  expect((await api("GET", "/api/nada")).status).toBe(404);
  expect((await api("DELETE", "/api/applications/1/stage")).status).toBe(404);
});
