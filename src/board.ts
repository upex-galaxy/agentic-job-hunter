import { join } from "node:path";
import { addApplication, addNote, getApplication, listApplications, listEvents, moveStage, openDb, STAGES } from "./db";

const port = Number(process.env.JOBHUNTER_BOARD_PORT ?? 4747);
const db = openDb();
const json = (data: unknown, status = 200) => Response.json(data, { status });

export function handle(req: Request): Promise<Response> | Response {
  const url = new URL(req.url);
  const path = url.pathname;
  try {
    if (req.method === "GET" && path === "/") return new Response(Bun.file(join(import.meta.dir, "..", "board", "index.html")));
    if (req.method === "GET" && path === "/api/stages") return json(STAGES);
    if (path === "/api/applications") {
      if (req.method === "GET") {
        return json(listApplications(db).map((a) => ({ ...a, events: listEvents(db, a.id as number) })));
      }
      if (req.method === "POST") {
        return req.json().then((b) => json(addApplication(db, b), 201)).catch((e: Error) => json({ error: e.message }, 400));
      }
    }
    let m = path.match(/^\/api\/applications\/(\d+)\/stage$/);
    if (m && req.method === "PATCH") {
      return req.json().then((b) => json(moveStage(db, Number(m![1]), b.stage))).catch((e: Error) => json({ error: e.message }, 400));
    }
    m = path.match(/^\/api\/applications\/(\d+)\/notes$/);
    if (m && req.method === "POST") {
      return req
        .json()
        .then((b) => {
          addNote(db, Number(m![1]), b.body ?? "");
          return json(getApplication(db, Number(m![1])), 201);
        })
        .catch((e: Error) => json({ error: e.message }, 400));
    }
    return json({ error: "no encontrado" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}

if (import.meta.main) {
  // Solo localhost: el panel guarda datos de terceros y no tiene autenticación.
  Bun.serve({ hostname: "127.0.0.1", port, fetch: handle });
  console.log(`Panel en http://localhost:${port}`);
}
