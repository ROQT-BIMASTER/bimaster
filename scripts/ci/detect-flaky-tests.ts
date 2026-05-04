/**
 * Detector de testes flaky (intermitentes) para a suíte E2E de Aprovações.
 *
 * Lê o `results.json` do run atual e, se disponível, o histórico das N
 * execuções anteriores (mesmo papel) para identificar specs que alternam
 * entre `passed` e `failed`/`timedOut`.
 *
 * Histórico:
 *   - Cada run salva um snapshot enxuto em `playwright-history/<role>/<run_id>.json`
 *     com {spec, status} por teste.
 *   - O CI faz cache desse diretório por papel (actions/cache) para preservar
 *     histórico entre runs sem precisar de storage externo.
 *
 * Saída:
 *   - `playwright-report/FLAKY.md` com a lista de specs flaky e a sequência
 *     observada (ex.: pass, fail, pass, pass, fail).
 *   - Exit 0 sempre — flakies não devem quebrar o CI; servem para visibilidade.
 *
 * Uso:
 *   bun run scripts/ci/detect-flaky-tests.ts \
 *     --results playwright-report/results.json \
 *     --history playwright-history/<role> \
 *     --role <role> \
 *     --run-id <run_id> \
 *     --keep 20
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

type Args = Record<string, string>;
function parseArgs(): Args {
  const out: Args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i]?.replace(/^--/, "");
    const v = process.argv[i + 1];
    if (k && v !== undefined) out[k] = v;
  }
  return out;
}

interface Snapshot {
  runId: string;
  role: string;
  ts: string;
  tests: { key: string; status: string }[];
}

interface PwSpec {
  title: string;
  file: string;
  tests?: { results?: { status: string }[] }[];
}
interface PwSuite {
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  suites?: PwSuite[];
}

const args = parseArgs();
const resultsPath = args.results ?? "playwright-report/results.json";
const historyDir = args.history ?? "playwright-history/default";
const role = args.role ?? "default";
const runId = args["run-id"] ?? String(Date.now());
// Precedência: --keep > FLAKY_KEEP env > default 30.
const keep = Number(args.keep ?? process.env.FLAKY_KEEP ?? 30);
const outPath = args.out ?? "playwright-report/FLAKY.md";

// Garante diretórios de saída antes de qualquer escrita — necessário para
// o upload do artefato funcionar mesmo quando o smoke falhou e a pasta
// `playwright-report/` ainda não existe.
mkdirSync(historyDir, { recursive: true });
mkdirSync(outPath.replace(/\/[^/]+$/, "") || ".", { recursive: true });

if (!existsSync(resultsPath)) {
  writeFileSync(
    outPath,
    `# Flaky Detection — ${role}\n\n_results.json ausente (suíte não chegou a rodar). ` +
      `Histórico preservado em \`${historyDir}\` para o próximo run._\n`,
  );
  process.exit(0);
}

const report = JSON.parse(readFileSync(resultsPath, "utf8")) as PwReport;
const current: { key: string; status: string }[] = [];

function walk(suites?: PwSuite[]) {
  for (const s of suites ?? []) {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        if (!last) continue;
        current.push({
          key: `${spec.file} :: ${spec.title}`,
          status: last.status,
        });
      }
    }
    walk(s.suites);
  }
}
walk(report.suites);

// Persistir snapshot do run atual.
mkdirSync(historyDir, { recursive: true });
const snapPath = join(historyDir, `${runId}.json`);
const snapshot: Snapshot = {
  runId,
  role,
  ts: new Date().toISOString(),
  tests: current,
};
writeFileSync(snapPath, JSON.stringify(snapshot));

// Manter apenas os `keep` mais recentes.
const files = readdirSync(historyDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ f, t: statSync(join(historyDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
for (const old of files.slice(keep)) {
  try {
    unlinkSync(join(historyDir, old.f));
  } catch {
    /* ignore */
  }
}

// Carregar histórico (mais recente → mais antigo).
const history: Snapshot[] = files
  .slice(0, keep)
  .map(({ f }) => JSON.parse(readFileSync(join(historyDir, f), "utf8")) as Snapshot);

// Para cada teste, montar a sequência de status (mais recente primeiro).
const sequence = new Map<string, string[]>();
for (const snap of history) {
  for (const t of snap.tests) {
    if (!sequence.has(t.key)) sequence.set(t.key, []);
    sequence.get(t.key)!.push(t.status);
  }
}

function isFailure(s: string) {
  return s !== "passed" && s !== "skipped";
}

interface Flaky {
  key: string;
  history: string[];
  passes: number;
  fails: number;
}
const flaky: Flaky[] = [];
for (const [key, hist] of sequence) {
  if (hist.length < 2) continue;
  const passes = hist.filter((s) => s === "passed").length;
  const fails = hist.filter(isFailure).length;
  // Flaky = ao menos 1 pass e 1 fail nas últimas N execuções.
  if (passes > 0 && fails > 0) {
    flaky.push({ key, history: hist, passes, fails });
  }
}
flaky.sort((a, b) => b.fails - a.fails);

const lines: string[] = [];
lines.push(`# Flaky Detection — papel: \`${role}\``);
lines.push("");
lines.push(
  `Histórico analisado: **${history.length}** execução(ões) · Specs únicos: **${sequence.size}**`,
);
lines.push("");

if (flaky.length === 0) {
  lines.push("Nenhum teste flaky detectado nas últimas execuções.");
} else {
  lines.push(`## ${flaky.length} teste(s) flaky`);
  lines.push("");
  lines.push("| Spec | Pass | Fail | Sequência (recente → antiga) |");
  lines.push("|---|---:|---:|---|");
  for (const f of flaky) {
    const seq = f.history
      .map((s) => (s === "passed" ? "✓" : isFailure(s) ? "✗" : "·"))
      .join(" ");
    lines.push(`| \`${f.key}\` | ${f.passes} | ${f.fails} | ${seq} |`);
  }
  lines.push("");
  lines.push(
    "> Specs com `✓` e `✗` intercalados nas últimas execuções. " +
      "Investigue antes de adicionar `test.retry()` indiscriminado.",
  );
}

writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`[flaky] Relatório gerado em ${outPath}. Snapshot: ${snapPath}`);
