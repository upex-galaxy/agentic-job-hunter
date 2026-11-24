// Setup del usuario. Escribe solo en config/ (ignorado por git), cv/base/profile.json y ~/.agentic-job-hunter.
// Interactivo por defecto. Modo no interactivo: --yes (o JOBHUNTER_SETUP_YES=1) más flags o variables de entorno.
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { stateDir } from "../src/db";

const AUTONOMY = ["ask_before_send", "reply_alone_ask_to_apply", "full_auto"] as const;
const CHANNELS = ["file", "osascript", "slack", "whatsapp"];

const HELP = `Uso: bun run setup [--yes] [opciones]
  --yes                 no pregunta nada; usa flags, variables JOBHUNTER_SETUP_* o valores por defecto
  --autonomy <valor>    ${AUTONOMY.join(" | ")} (por defecto ask_before_send)
  --currency <XXX>      --min <n>  --max <n>
  --modality <a,b>      remote, hybrid, onsite (por defecto remote)
  --countries <a,b>     --must <a,b>  --nice <a,b>  --avoid <a,b>
  --seniority <texto>   --language <es|en|...> (por defecto es)
  --notify <a,b>        canales: ${CHANNELS.join(", ")} (por defecto file; "none" = ninguno)
  --login               abre el navegador para el login de LinkedIn (en modo --yes no se abre si no lo pides)
  --force               sobrescribe config/preferences.json si ya existe
Cada opción también se lee de JOBHUNTER_SETUP_<NOMBRE> (p. ej. JOBHUNTER_SETUP_AUTONOMY=full_auto).`;

const { values: flags } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    yes: { type: "boolean", short: "y" },
    help: { type: "boolean", short: "h" },
    autonomy: { type: "string" },
    currency: { type: "string" },
    min: { type: "string" },
    max: { type: "string" },
    modality: { type: "string" },
    countries: { type: "string" },
    must: { type: "string" },
    nice: { type: "string" },
    avoid: { type: "string" },
    seniority: { type: "string" },
    language: { type: "string" },
    notify: { type: "string" },
    login: { type: "boolean" },
    force: { type: "boolean" },
  },
});
if (flags.help) {
  console.log(HELP);
  process.exit(0);
}

const env = process.env;
// Sin terminal (CI, cron, tubería) no se puede preguntar: se comporta como --yes y nunca abre el navegador.
const yes = Boolean(flags.yes) || env.JOBHUNTER_SETUP_YES === "1" || !process.stdin.isTTY;
const root = join(import.meta.dir, "..");

// Un valor dado por flag o variable gana; si no, se pregunta (o se usa el valor por defecto con --yes).
const given = (key: string): string | undefined =>
  (flags as Record<string, unknown>)[key] as string | undefined ?? env[`JOBHUNTER_SETUP_${key.toUpperCase()}`];
const ask = (key: string, q: string, def = ""): string => {
  const v = given(key);
  if (v !== undefined) return v.trim();
  if (yes) return def;
  const a = prompt(def ? `${q} [${def}]` : q);
  return (a ?? "").trim() || def;
};
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const num = (s: string, name: string) => {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) fail(`${name} debe ser un número: ${s}`);
  return n;
};
function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

console.log(`Job Hunter: setup${yes ? " (no interactivo)" : ""}\n`);
for (const t of ["playwright-cli", "jq"]) {
  if (!Bun.which(t)) console.log(`Falta \`${t}\`. Instálalo antes de lanzar el agente (ver README).`);
}

// 1. Preferencias
const prefsPath = join(root, "config/preferences.json");
let writePrefs = true;
if (existsSync(prefsPath) && !flags.force) {
  writePrefs = yes ? false : ask("overwrite", "config/preferences.json ya existe. ¿Lo reemplazo? (s/n)", "n").toLowerCase().startsWith("s");
  if (!writePrefs) console.log("Mantengo config/preferences.json (usa --force para reemplazarlo).");
}
if (writePrefs) {
  console.log("1) Qué ofertas te sirven (el agente descarta lo que no encaja)");
  const min = ask("min", "Salario mínimo mensual (número, vacío = sin mínimo)");
  const max = ask("max", "Salario máximo que consideras (vacío = sin tope)");
  const prefs = {
    salary: { currency: ask("currency", "Moneda (código de 3 letras)").toUpperCase(), min: num(min, "--min"), max: num(max, "--max"), period: "month" },
    modality: list(ask("modality", "Modalidad aceptada (remote, hybrid, onsite)", "remote")),
    countries: list(ask("countries", "Países donde puedes trabajar (separados por coma)")),
    stack: {
      must: list(ask("must", "Stack imprescindible")),
      nice: list(ask("nice", "Stack deseable")),
      avoid: list(ask("avoid", "Stack que evitas")),
    },
    seniority: ask("seniority", "Seniority"),
    contract_types: ["employee", "contractor"],
    autonomy: "ask_before_send" as string,
    daily_caps: { sends: 33, reads: 40 },
    language: ask("language", "Idioma de las respuestas", "es"),
  };

  // 2. Autonomía: acepta el nombre o el número del menú.
  if (given("autonomy") === undefined && !yes) {
    console.log("\n2) Nivel de autonomía");
    console.log("  1 = pedir aprobación antes de enviar o postular (recomendado)");
    console.log("  2 = responder solo, pedir aprobación antes de postular o mandar el CV");
    console.log("  3 = enviar y postular sin pedir aprobación");
  }
  const lvl = ask("autonomy", "Elige", "1");
  const byNumber: Record<string, string> = { "1": AUTONOMY[0], "2": AUTONOMY[1], "3": AUTONOMY[2] };
  const autonomy = byNumber[lvl] ?? lvl;
  if (!(AUTONOMY as readonly string[]).includes(autonomy)) fail(`autonomía inválida: ${lvl}. Válidas: ${AUTONOMY.join(", ")}`);
  prefs.autonomy = autonomy;
  if (autonomy === "full_auto") console.log("Aviso: con autonomía total el agente actúa en tu nombre sin que lo veas.");

  mkdirSync(join(root, "config"), { recursive: true });
  writeFileSync(prefsPath, JSON.stringify(prefs, null, 2) + "\n");
  console.log(`Escrito config/preferences.json (autonomy=${autonomy})`);
}

// 3. Notificaciones (todas opt-in)
if (!yes) console.log("\n3) Notificaciones (opcional). Canales: file, osascript, slack, whatsapp");
const rawChans = list(ask("notify", "Canales a activar (vacío = ninguno)", "file"));
const unknown = rawChans.filter((c) => c !== "none" && !CHANNELS.includes(c));
if (unknown.length) fail(`canal desconocido: ${unknown.join(", ")}. Válidos: ${CHANNELS.join(", ")}`);
const chans = rawChans.filter((c) => CHANNELS.includes(c));
if (chans.length) {
  const example = JSON.parse(await Bun.file(join(root, "config/notify.example.json")).text());
  example.enabled = chans;
  writeFileSync(join(root, "config/notify.json"), JSON.stringify(example, null, 2) + "\n");
  console.log(`Escrito config/notify.json (canales: ${chans.join(", ")})`);
  if (chans.some((c) => c === "slack" || c === "whatsapp")) console.log("Pon las URLs y tokens en variables de entorno o en .env (nunca en el JSON).");
}

// 4. Carpeta de estado y CV
mkdirSync(join(stateDir(), "inbox"), { recursive: true });
const profile = join(root, "cv/base/profile.json");
if (!existsSync(profile)) copyFileSync(join(root, "cv/base/profile.template.json"), profile);
console.log(`Estado en ${stateDir()}. Completa cv/base/profile.json con tus datos reales (está ignorado por git).`);

// 5. Login de LinkedIn: siempre lo hace el dueño a mano, en un navegador visible.
const profileDir = process.env.JOBHUNTER_PROFILE_DIR ?? join(stateDir(), "playwright-profiles", "linkedin");
const wantsLogin = yes ? Boolean(flags.login) : ask("login", "\n4) ¿Abro el navegador para iniciar sesión en LinkedIn? (s/n)", "s").toLowerCase().startsWith("s");
if (wantsLogin && Bun.which("playwright-cli")) {
  console.log("Se abre Chrome visible. Inicia sesión a mano, resuelve cualquier verificación y vuelve aquí.");
  const p = Bun.spawn(["playwright-cli", "-s=linkedin", "open", "https://www.linkedin.com/login", "--headed", `--profile=${profileDir}`], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  await p.exited;
  prompt("Pulsa Enter cuando ya veas tu bandeja de LinkedIn");
  Bun.spawnSync(["playwright-cli", "-s=linkedin", "close"]);
} else {
  console.log(`Login de LinkedIn pendiente: playwright-cli -s=linkedin open https://www.linkedin.com/login --headed --profile=${profileDir}`);
}

console.log("\nMCPs recomendados: Playwright (imprescindible); Google Calendar y Gmail (opcionales). Ver docs/mcp.md.");
console.log("Listo. Prueba el panel con `bun run board` y lanza el agente con scripts/launch.sh.");
