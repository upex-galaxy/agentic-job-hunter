import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const STAGES = [
  "recibida",
  "en_revision",
  "postulada",
  "cv_enviado",
  "entrevista",
  "negociacion",
  "oferta",
  "cerrada",
  "descartada",
] as const;
export type Stage = (typeof STAGES)[number];

export function stateDir(): string {
  const raw = process.env.JOBHUNTER_STATE_DIR ?? join(homedir(), ".agentic-job-hunter");
  return raw.startsWith("~") ? join(homedir(), raw.slice(1)) : raw;
}

export function dbPath(): string {
  return process.env.JOBHUNTER_DB ?? join(stateDir(), "jobs.db");
}

export function openDb(path = dbPath()): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      recruiter TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      salary TEXT NOT NULL DEFAULT '',
      modality TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'recibida',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export interface NewApplication {
  company: string;
  role: string;
  recruiter?: string;
  source_url?: string;
  salary?: string;
  modality?: string;
  stage?: string;
}

export function isStage(s: string): s is Stage {
  return (STAGES as readonly string[]).includes(s);
}

export function addApplication(db: Database, a: NewApplication) {
  if (!a.company?.trim() || !a.role?.trim()) throw new Error("company y role son obligatorios");
  const stage = a.stage ?? "recibida";
  if (!isStage(stage)) throw new Error(`etapa inválida: ${stage}`);
  const row = db
    .query(
      `INSERT INTO applications (company, role, recruiter, source_url, salary, modality, stage)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(a.company.trim(), a.role.trim(), a.recruiter ?? "", a.source_url ?? "", a.salary ?? "", a.modality ?? "", stage) as {
    id: number;
  };
  addEvent(db, row.id, "stage", `creada en ${stage}`);
  return getApplication(db, row.id)!;
}

export function getApplication(db: Database, id: number) {
  return db.query("SELECT * FROM applications WHERE id = ?").get(id) as Record<string, unknown> | null;
}

export function listApplications(db: Database, stage?: string) {
  const rows = stage
    ? db.query("SELECT * FROM applications WHERE stage = ? ORDER BY updated_at DESC, id DESC").all(stage)
    : db.query("SELECT * FROM applications ORDER BY updated_at DESC, id DESC").all();
  return rows as Record<string, unknown>[];
}

export function addEvent(db: Database, id: number, kind: string, body: string) {
  db.query("INSERT INTO events (application_id, kind, body) VALUES (?, ?, ?)").run(id, kind, body);
  db.query("UPDATE applications SET updated_at = datetime('now') WHERE id = ?").run(id);
}

export function moveStage(db: Database, id: number, stage: string) {
  if (!isStage(stage)) throw new Error(`etapa inválida: ${stage}. Válidas: ${STAGES.join(", ")}`);
  const cur = getApplication(db, id);
  if (!cur) throw new Error(`no existe la postulación ${id}`);
  db.query("UPDATE applications SET stage = ? WHERE id = ?").run(stage, id);
  addEvent(db, id, "stage", `${cur.stage} -> ${stage}`);
  return getApplication(db, id)!;
}

export function addNote(db: Database, id: number, body: string, kind = "note") {
  if (!getApplication(db, id)) throw new Error(`no existe la postulación ${id}`);
  if (!body.trim()) throw new Error("la nota está vacía");
  addEvent(db, id, kind, body.trim());
}

export function listEvents(db: Database, id: number) {
  return db.query("SELECT * FROM events WHERE application_id = ? ORDER BY id").all(id) as Record<string, unknown>[];
}
