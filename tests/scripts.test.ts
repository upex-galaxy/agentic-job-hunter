// Prueba los scripts de bash con una bandeja simulada (JOBHUNTER_FAKE_INBOX), una hora fija
// (JOBHUNTER_FAKE_HOUR) y una carpeta de estado temporal. No abre navegador ni lanza agentes reales.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const scripts = join(root, "scripts");
let dir: string;
let state: string;
let inbox: string;

const FAST_SCHEDULE = `START_HOUR=7
END_HOUR=21
POLL_MIN_SECONDS=0
POLL_MAX_SECONDS=0
MAX_WAIT_SECONDS=30
BEAT_GRACE=180
WORK_GRACE=1800
STARTUP_GRACE=900
WORKING_SLEEP=0
PAUSE_SLEEP=0
CLOSE_WAIT=0
AGENT_CMD='true "{PROMPT}"'
AGENT_PROCESS_PATTERN='jobhunter-test-agent-that-does-not-exist'
`;

function env(extra: Record<string, string> = {}) {
  return {
    ...process.env,
    HOME: dir,
    JOBHUNTER_STATE_DIR: state,
    JOBHUNTER_SCHEDULE: join(dir, "schedule.conf"),
    JOBHUNTER_FAKE_INBOX: join(dir, "inbox.json"),
    JOBHUNTER_FAKE_HOUR: "10",
    JOBHUNTER_SESSION: "jobhunter-test-session", // nunca la sesión real de playwright-cli
    ...extra,
  };
}

function sh(script: string, args: string[] = [], extra: Record<string, string> = {}) {
  const p = Bun.spawnSync(["bash", join(scripts, script), ...args], { env: env(extra), timeout: 20_000 });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

function watch(extra: Record<string, string> = {}) {
  const { out } = sh("wait-inbox.sh", [], extra);
  const line = out.trim().split("\n").find((l) => l.startsWith("VERDICT "));
  if (!line) throw new Error(`sin VERDICT: ${out}`);
  return JSON.parse(line.slice("VERDICT ".length)) as Record<string, unknown>;
}

const setInbox = (items: unknown) => writeFileSync(join(dir, "inbox.json"), JSON.stringify(items));
const thread = (id: string, snippet: string, unread = true) => ({ id, name: "Reclutadora Ejemplo", snippet, unread });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jobhunter-test-"));
  state = join(dir, "state");
  inbox = join(state, "inbox");
  writeFileSync(join(dir, "schedule.conf"), FAST_SCHEDULE);
  writeFileSync(join(dir, "beat.conf"), FAST_SCHEDULE.replace("MAX_WAIT_SECONDS=30", "MAX_WAIT_SECONDS=0"));
  setInbox([]);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("wait-inbox.sh con bandeja simulada", () => {
  test("MENSAJE por un hilo no leído, y no repite tras mark-handled", () => {
    setInbox([thread("t1", "hola, tengo una oferta"), thread("t0", "viejo", false)]);
    const v = watch();
    expect(v).toMatchObject({ verdict: "MENSAJE", id: "t1", snippet: "hola, tengo una oferta" });
    expect(existsSync(join(inbox, "watcher.alive"))).toBe(false);
    expect(sh("mark-handled.sh", ["t1", "hola, tengo una oferta"]).code).toBe(0);
    expect(watch({ JOBHUNTER_SCHEDULE: join(dir, "beat.conf") }).verdict).not.toBe("MENSAJE");
  });

  test("MENSAJE otra vez si el hilo atendido trae un mensaje nuevo", () => {
    sh("mark-handled.sh", ["t1", "primer mensaje"]);
    setInbox([thread("t1", "segundo mensaje")]);
    expect(watch()).toMatchObject({ verdict: "MENSAJE", id: "t1" });
  });

  test("PENDIENTE una vez por hora con hilos en espera", () => {
    sh("mark-pending.sh", ["t2", "aprobar borrador"]);
    expect(watch()).toEqual({ verdict: "PENDIENTE", pending: [{ thread: "t2", waiting: "aprobar borrador" }] });
    expect(watch({ JOBHUNTER_SCHEDULE: join(dir, "beat.conf") }).verdict).toBe("LATIDO");
    sh("mark-pending.sh", ["--clear", "t2"]);
    expect(JSON.parse(readFileSync(join(inbox, "pending.json"), "utf8"))).toEqual([]);
  });

  test("RELOJ cuando vence un reloj y lo consume", () => {
    expect(sh("add-timer.sh", ["t3", "0", "pedir rango"]).code).toBe(0);
    expect(sh("add-timer.sh", ["t4", "48", "más tarde"]).code).toBe(0);
    expect(watch()).toMatchObject({ verdict: "RELOJ", thread: "t3", reason: "pedir rango" });
    const left = JSON.parse(readFileSync(join(inbox, "timers.json"), "utf8"));
    expect(left.map((t: { thread: string }) => t.thread)).toEqual(["t4"]);
  });

  test("LATIDO al cumplirse la espera máxima sin novedades", () => {
    writeFileSync(join(dir, "schedule.conf"), FAST_SCHEDULE.replace("MAX_WAIT_SECONDS=30", "MAX_WAIT_SECONDS=0"));
    expect(watch()).toEqual({ verdict: "LATIDO" });
  });

  test("LATIDO también durante la pausa de 7 días, sin leer la bandeja", () => {
    writeFileSync(join(dir, "schedule.conf"), FAST_SCHEDULE.replace("MAX_WAIT_SECONDS=30", "MAX_WAIT_SECONDS=0"));
    sh("begin-work.sh"); // crea la carpeta de estado
    sh("end-work.sh");
    writeFileSync(join(inbox, "paused.until"), String(Math.floor(Date.now() / 1000) + 604800));
    setInbox([thread("t1", "no debería verse")]);
    expect(watch()).toEqual({ verdict: "LATIDO" });
  });

  test("FIN_DEL_DIA a partir de END_HOUR", () => {
    expect(watch({ JOBHUNTER_FAKE_HOUR: "21" })).toEqual({ verdict: "FIN_DEL_DIA" });
  });

  test("SESION_PERDIDA si working lleva más de WORK_GRACE", () => {
    sh("begin-work.sh");
    const old = Date.now() / 1000 - 3600;
    utimesSync(join(inbox, "working"), old, old);
    expect(watch()).toMatchObject({ verdict: "SESION_PERDIDA", reason: "working vencido" });
  });

  test("con working reciente no lee la bandeja", () => {
    writeFileSync(join(dir, "schedule.conf"), FAST_SCHEDULE.replace("MAX_WAIT_SECONDS=30", "MAX_WAIT_SECONDS=0"));
    sh("begin-work.sh");
    setInbox([thread("t1", "no debería verse")]);
    expect(watch().verdict).toBe("LATIDO");
    sh("end-work.sh");
    expect(existsSync(join(inbox, "working"))).toBe(false);
  });

  test("ERROR tras tres lecturas fallidas", () => {
    rmSync(join(dir, "inbox.json"));
    expect(watch()).toMatchObject({ verdict: "ERROR" });
    writeFileSync(join(dir, "inbox.json"), "<html>no es json</html>");
    expect(watch()).toMatchObject({ verdict: "ERROR" });
  });

  test("ERROR inmediato si LinkedIn pide login", () => {
    writeFileSync(join(dir, "inbox.json"), "null");
    expect(watch()).toMatchObject({ verdict: "ERROR", reason: expect.stringContaining("login") });
  });

  test("ERROR por vigilante duplicado, sin borrar el latido ajeno", () => {
    sh("begin-work.sh");
    sh("end-work.sh");
    writeFileSync(join(inbox, "watcher.alive"), "");
    expect(watch()).toMatchObject({ verdict: "ERROR", reason: expect.stringContaining("duplicado") });
    expect(existsSync(join(inbox, "watcher.alive"))).toBe(true);
  });
});

describe("launch.sh y close.sh", () => {
  test("fuera de horario no lanza", () => {
    const r = sh("launch.sh", ["--scheduled", "--dry-run"], { JOBHUNTER_FAKE_HOUR: "5" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("fuera de horario");
  });

  test("--dry-run muestra el comando con el prompt y no lanza nada", () => {
    const r = sh("launch.sh", ["--watchdog", "--dry-run"]);
    expect(r.out).toContain('dry-run: lanzaría: true "jobhunter-session:');
    expect(existsSync(join(inbox, "launched.at"))).toBe(false);
  });

  test("argumento desconocido falla", () => {
    expect(sh("launch.sh", ["--otro"]).code).toBe(2);
  });

  test("lanza un agente de prueba y no duplica mientras sigue vivo", async () => {
    const marker = join(dir, "agent-ran");
    const agent = join(dir, "fake-agent.sh");
    writeFileSync(agent, `#!/usr/bin/env bash\necho "$@" > "${marker}"\nsleep 30\n`);
    chmodSync(agent, 0o755);
    const cfg = FAST_SCHEDULE.replace(`AGENT_CMD='true "{PROMPT}"'`, `AGENT_CMD='${agent} "{PROMPT}"'`).replace(
      "AGENT_PROCESS_PATTERN='jobhunter-test-agent-that-does-not-exist'",
      "AGENT_PROCESS_PATTERN='fake-agent.sh'",
    );
    writeFileSync(join(dir, "schedule.conf"), cfg);
    const first = Bun.spawn(["bash", join(scripts, "launch.sh"), "--scheduled"], { env: env(), stdout: "ignore", stderr: "ignore" });
    try {
      for (let i = 0; i < 50 && !existsSync(marker); i++) await Bun.sleep(100);
      expect(readFileSync(marker, "utf8")).toContain("jobhunter-session:");
      expect(existsSync(join(inbox, "launched.at"))).toBe(true);
      const second = sh("launch.sh", ["--watchdog"]);
      expect(second.out).toContain("sesión viva, no hago nada");
      const closed = sh("close.sh", ["--dry-run"]);
      expect(closed.out).toContain("dry-run: pkill -f fake-agent.sh.*jobhunter-session");
      expect(closed.out).toMatch(/dry-run: kill \d+/); // el keepalive de esta carpeta de estado, por PID
      expect(sh("close.sh").code).toBe(0);
      expect(await first.exited).not.toBe(0); // close.sh mató al agente de prueba
      expect(existsSync(join(inbox, "launched.at"))).toBe(false);
    } finally {
      first.kill();
    }
  });
});

describe("notify.sh", () => {
  test("sin config no hace nada", () => {
    expect(sh("notify.sh", ["hola"], { JOBHUNTER_NOTIFY_CONFIG: join(dir, "no-existe.json") }).code).toBe(0);
  });

  test("canal file escribe una línea", () => {
    const log = join(dir, "notifications.log");
    writeFileSync(join(dir, "notify.json"), JSON.stringify({ enabled: ["file"], file: { path: log } }));
    expect(sh("notify.sh", ["borrador listo"], { JOBHUNTER_NOTIFY_CONFIG: join(dir, "notify.json") }).code).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("borrador listo");
  });
});

describe("lectura real de la bandeja (playwright-cli simulado)", () => {
  // Un playwright-cli falso guarda el JS que recibiría el navegador; se ejecuta contra un DOM mínimo.
  function capturedJs() {
    const bin = join(dir, "bin");
    Bun.spawnSync(["mkdir", "-p", bin]);
    const fake = join(bin, "playwright-cli");
    writeFileSync(fake, `#!/usr/bin/env bash\nfor a in "$@"; do last="$a"; done\ncase "$*" in *" eval "*) printf '%s' "$last" > "${dir}/eval.js"; echo '[]';; esac\n`);
    chmodSync(fake, 0o755);
    writeFileSync(join(dir, "schedule.conf"), FAST_SCHEDULE.replace("MAX_WAIT_SECONDS=30", "MAX_WAIT_SECONDS=0"));
    const e = env({ PATH: `${bin}:${process.env.PATH}` });
    delete (e as Record<string, string | undefined>).JOBHUNTER_FAKE_INBOX;
    const p = Bun.spawnSync(["bash", join(scripts, "wait-inbox.sh")], { env: e, timeout: 20_000 });
    expect(p.stdout.toString()).toContain('"verdict":"LATIDO"');
    return readFileSync(join(dir, "eval.js"), "utf8");
  }

  function fakeDom(pathname: string) {
    const sel = JSON.parse(readFileSync(join(root, "config/selectors.json"), "utf8"));
    const li = (href: string, name: string, snippet: string, unread: boolean) => ({
      querySelector: (q: string) =>
        q === sel.thread_link ? { href } : q === sel.participant_name ? { innerText: name } : q === sel.message_snippet ? { innerText: ` ${snippet} ` } : q === sel.unread_badge && unread ? {} : null,
    });
    return {
      location: { pathname },
      document: {
        querySelectorAll: (q: string) => (q === sel.conversation_item ? [li("https://www.linkedin.com/messaging/thread/1/", "Reclutadora", "hola", true)] : []),
      },
    };
  }

  test("el JS generado desde config/selectors.json extrae los hilos", () => {
    const js = capturedJs();
    const { location, document } = fakeDom("/messaging/");
    const out = new Function("location", "document", `return ${js}`)(location, document);
    expect(JSON.parse(out)).toEqual([{ id: "https://www.linkedin.com/messaging/thread/1/", name: "Reclutadora", snippet: "hola", unread: true }]);
  });

  test("el JS devuelve null en la pantalla de login", () => {
    const js = capturedJs();
    const { location, document } = fakeDom("/login");
    expect(new Function("location", "document", `return ${js}`)(location, document)).toBe("null");
  });
});
