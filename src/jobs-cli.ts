import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STAGES, addApplication, addNote, listApplications, listEvents, moveStage, openDb } from "./db";

const USAGE = `Uso: bun run jobs <comando>
  add --company X --role Y [--recruiter R] [--url U] [--salary S] [--modality M] [--stage E]
  move <id> <etapa>
  note <id> <texto>
  log <id> <texto>        mensaje enviado o recibido, queda en el historial
  list [--stage E] [--json]
  template <nombre>       plantillas: ${["primer-contacto", "pedir-detalles", "declinar", "confirmar-entrevista"].join(", ")}
Etapas: ${STAGES.join(", ")}`;

const here = dirname(fileURLToPath(import.meta.url));

export function run(argv: string[], db = openDb()): string {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "add": {
      const { values } = parseArgs({
        args: rest,
        options: {
          company: { type: "string" },
          role: { type: "string" },
          recruiter: { type: "string" },
          url: { type: "string" },
          salary: { type: "string" },
          modality: { type: "string" },
          stage: { type: "string" },
        },
      });
      const a = addApplication(db, {
        company: values.company ?? "",
        role: values.role ?? "",
        recruiter: values.recruiter,
        source_url: values.url,
        salary: values.salary,
        modality: values.modality,
        stage: values.stage,
      });
      return `#${a.id} ${a.company} / ${a.role} [${a.stage}]`;
    }
    case "move": {
      const a = moveStage(db, Number(rest[0]), rest[1] ?? "");
      return `#${a.id} -> ${a.stage}`;
    }
    case "note":
    case "log": {
      const id = Number(rest[0]);
      addNote(db, id, rest.slice(1).join(" "), cmd);
      return `#${id} ${cmd} guardada`;
    }
    case "list": {
      const { values } = parseArgs({ args: rest, options: { stage: { type: "string" }, json: { type: "boolean" } } });
      const rows = listApplications(db, values.stage);
      if (values.json) return JSON.stringify(rows.map((r) => ({ ...r, events: listEvents(db, r.id as number) })), null, 2);
      return rows.map((r) => `#${r.id}\t${r.stage}\t${r.company}\t${r.role}`).join("\n") || "(vacío)";
    }
    case "template": {
      const name = (rest[0] ?? "").replace(/[^a-z-]/g, "");
      try {
        return readFileSync(join(here, "..", "templates", `${name}.md`), "utf8");
      } catch {
        throw new Error(`plantilla desconocida: ${rest[0] ?? ""}`);
      }
    }
    default:
      return USAGE;
  }
}

if (import.meta.main) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}
