// Setup interactivo del usuario. Escribe solo en config/ (ignorado por git) y en ~/.agentic-job-hunter.
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "../src/db";

const root = join(import.meta.dir, "..");
const ask = (q: string, def = ""): string => {
  const a = prompt(def ? `${q} [${def}]` : q);
  return (a ?? "").trim() || def;
};
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

console.log("Job Hunter: setup\n");
for (const t of ["playwright-cli", "jq"]) {
  if (!Bun.which(t)) console.log(`Falta \`${t}\`. Instálalo antes de lanzar el agente (ver README).`);
}

// 1. Preferencias
console.log("\n1) Qué ofertas te sirven (el agente descarta lo que no encaja)");
const min = ask("Salario mínimo mensual (número, vacío = sin mínimo)");
const max = ask("Salario máximo que consideras (vacío = sin tope)");
const prefs = {
  salary: { currency: ask("Moneda (código de 3 letras)", ""), min: min ? Number(min) : null, max: max ? Number(max) : null, period: "month" },
  modality: list(ask("Modalidad aceptada (remote, hybrid, onsite)", "remote")),
  countries: list(ask("Países donde puedes trabajar (separados por coma)")),
  stack: { must: list(ask("Stack imprescindible")), nice: list(ask("Stack deseable")), avoid: list(ask("Stack que evitas")) },
  seniority: ask("Seniority", ""),
  contract_types: ["employee", "contractor"],
  autonomy: "ask_before_send",
  daily_caps: { sends: 33, reads: 40 },
  language: ask("Idioma de las respuestas", "es"),
};

// 2. Autonomía
console.log("\n2) Nivel de autonomía");
console.log("  1 = pedir aprobación antes de enviar o postular (recomendado)");
console.log("  2 = responder solo, pedir aprobación antes de postular o mandar el CV");
console.log("  3 = enviar y postular sin pedir aprobación");
const lvl = ask("Elige", "1");
prefs.autonomy = ({ "1": "ask_before_send", "2": "reply_alone_ask_to_apply", "3": "full_auto" } as Record<string, string>)[lvl] ?? "ask_before_send";
if (prefs.autonomy === "full_auto") console.log("Aviso: con autonomía total el agente actúa en tu nombre sin que lo veas.");

writeFileSync(join(root, "config/preferences.json"), JSON.stringify(prefs, null, 2) + "\n");
console.log("Escrito config/preferences.json");

// 3. Notificaciones (todas opt-in)
console.log("\n3) Notificaciones (opcional). Canales: file, osascript, slack, whatsapp");
const chans = list(ask("Canales a activar (vacío = ninguno)", "file")).filter((c) => ["file", "osascript", "slack", "whatsapp"].includes(c));
if (chans.length) {
  const example = JSON.parse(await Bun.file(join(root, "config/notify.example.json")).text());
  example.enabled = chans;
  writeFileSync(join(root, "config/notify.json"), JSON.stringify(example, null, 2) + "\n");
  if (chans.some((c) => c === "slack" || c === "whatsapp")) console.log("Pon las URLs y tokens en variables de entorno o en .env (nunca en el JSON).");
}

// 4. Carpeta de estado y CV
mkdirSync(join(stateDir(), "inbox"), { recursive: true });
const profile = join(root, "cv/base/profile.json");
if (!existsSync(profile)) copyFileSync(join(root, "cv/base/profile.template.json"), profile);
console.log(`Estado en ${stateDir()}. Completa cv/base/profile.json con tus datos reales (está ignorado por git).`);

// 5. Login de LinkedIn
console.log("\n4) Login de LinkedIn en el perfil del agente");
const profileDir = process.env.JOBHUNTER_PROFILE_DIR ?? join(stateDir(), "playwright-profiles", "linkedin");
if (Bun.which("playwright-cli") && ask("¿Abro el navegador ahora para iniciar sesión? (s/n)", "s").toLowerCase().startsWith("s")) {
  console.log("Se abre Chrome visible. Inicia sesión a mano, resuelve cualquier verificación y vuelve aquí.");
  const p = Bun.spawn(["playwright-cli", "-s=linkedin", "open", "https://www.linkedin.com/login", "--headed", `--profile=${profileDir}`], { stdio: ["inherit", "inherit", "inherit"] });
  await p.exited;
  ask("Pulsa Enter cuando ya veas tu bandeja de LinkedIn");
  Bun.spawnSync(["playwright-cli", "-s=linkedin", "close"]);
} else {
  console.log(`Hazlo después: playwright-cli -s=linkedin open https://www.linkedin.com/login --headed --profile=${profileDir}`);
}

console.log("\nMCPs recomendados: Playwright (imprescindible); Google Calendar y Gmail (opcionales). Ver docs/mcp.md.");
console.log("Listo. Prueba el panel con `bun run board` y lanza el agente con scripts/launch.sh.");
