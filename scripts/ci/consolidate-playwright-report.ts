/**
 * Gera um relatório consolidado (Markdown) a partir do `results.json` do Playwright,
 * apontando falhas por teste com **links diretos** para screenshots e traces
 * publicados como artefatos do GitHub Actions.
 *
 * Uso:
 *   bun run scripts/ci/consolidate-playwright-report.ts \
 *     --results playwright-report/results.json \
 *     --out playwright-report/CONSOLIDATED.md \
 *     --role vendedor \
 *     --run-url https://github.com/<org>/<repo>/actions/runs/<id> \
 *     --artifact-name playwright-test-results-<role>-<run_id>
 *
 * O Markdown é direcionado ao GitHub Step Summary e ao comentário do PR.
 * Como artefatos do GitHub não expõem URL direta para arquivos individuais,
 * cada falha lista (a) o caminho relativo dentro do artefato e (b) o link
 * direto para baixar o ZIP do artefato. O leitor extrai e abre o arquivo
 * apontado.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";

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

interface PwAttachment {
  name: string;
  contentType: string;
  path?: string;
}
interface PwResult {
  status: string;
  duration?: number;
  error?: { message?: string; stack?: string };
  attachments?: PwAttachment[];
}
interface PwTest {
  results?: PwResult[];
}
interface PwSpec {
  title: string;
  file: string;
  tests?: PwTest[];
}
interface PwSuite {
  title?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  suites?: PwSuite[];
  stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number };
}

const args = parseArgs();
const resultsPath = args.results ?? "playwright-report/results.json";
const outPath = args.out ?? "playwright-report/CONSOLIDATED.md";
const role = args.role ?? "default";
const runUrl = args["run-url"] ?? "";
const artifactName = args["artifact-name"] ?? "";
const artifactDownloadUrl = args["artifact-url"] ?? "";

if (!existsSync(resultsPath)) {
  const md = `# E2E Aprovações — ${role}\n\n_results.json ausente em \`${resultsPath}\`._\n`;
  writeFileSync(outPath, md);
  console.log(md);
  process.exit(0);
}

const report = JSON.parse(readFileSync(resultsPath, "utf8")) as PwReport;

interface Failure {
  title: string;
  file: string;
  status: string;
  errorFirstLine: string;
  attachments: PwAttachment[];
}
const failures: Failure[] = [];
const allTests: { title: string; status: string; file: string }[] = [];

function walk(suites?: PwSuite[]) {
  for (const s of suites ?? []) {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        if (!last) continue;
        allTests.push({ title: spec.title, status: last.status, file: spec.file });
        if (last.status !== "passed" && last.status !== "skipped") {
          failures.push({
            title: spec.title,
            file: spec.file,
            status: last.status,
            errorFirstLine: (last.error?.message ?? "").split("\n")[0] || "—",
            attachments: last.attachments ?? [],
          });
        }
      }
    }
    walk(s.suites);
  }
}
walk(report.suites);

const repoRoot = resolve(process.cwd());
function relPath(p?: string): string {
  if (!p) return "—";
  try {
    return relative(repoRoot, p) || p;
  } catch {
    return p;
  }
}

const stats = report.stats ?? {};
const total = allTests.length;
const passed = allTests.filter((t) => t.status === "passed").length;
const skipped = allTests.filter((t) => t.status === "skipped").length;

const lines: string[] = [];
lines.push(`# E2E Aprovações — papel: \`${role}\``);
lines.push("");
lines.push(
  `**Resumo:** ${passed}/${total} passou · ${failures.length} falha(s) · ${skipped} pulado(s)` +
    (stats.flaky ? ` · ${stats.flaky} flaky` : ""),
);
lines.push("");

if (runUrl) lines.push(`- Run: ${runUrl}`);
if (artifactName) {
  if (artifactDownloadUrl) {
    lines.push(`- Artefato com screenshots/vídeos/traces: [\`${artifactName}\`](${artifactDownloadUrl})`);
  } else {
    lines.push(
      `- Artefato com screenshots/vídeos/traces: \`${artifactName}\` (baixar na aba **Artifacts** do run acima)`,
    );
  }
}
lines.push("");

if (failures.length === 0) {
  lines.push("Tudo verde. Nenhuma falha a reportar.");
} else {
  lines.push("## Falhas");
  lines.push("");
  for (const f of failures) {
    lines.push(`### ${f.title} — \`${f.status}\``);
    lines.push("");
    lines.push(`- Spec: \`${f.file}\``);
    lines.push(`- Erro: ${f.errorFirstLine}`);

    const screenshots = f.attachments.filter((a) => a.contentType?.startsWith("image/"));
    const videos = f.attachments.filter((a) => a.contentType?.startsWith("video/"));
    const traces = f.attachments.filter(
      (a) => a.name === "trace" || a.path?.endsWith(".zip"),
    );
    const others = f.attachments.filter(
      (a) => !screenshots.includes(a) && !videos.includes(a) && !traces.includes(a),
    );

    if (screenshots.length) {
      lines.push("- Screenshots:");
      for (const a of screenshots) lines.push(`  - \`${relPath(a.path)}\` (${a.name})`);
    }
    if (videos.length) {
      lines.push("- Vídeos:");
      for (const a of videos) lines.push(`  - \`${relPath(a.path)}\``);
    }
    if (traces.length) {
      lines.push("- Traces (abrir com `bunx playwright show-trace <arquivo>`):");
      for (const a of traces) lines.push(`  - \`${relPath(a.path)}\``);
    }
    if (others.length) {
      lines.push("- Outros anexos:");
      for (const a of others)
        lines.push(`  - \`${relPath(a.path)}\` (${a.name}, ${a.contentType})`);
    }
    lines.push("");
  }

  lines.push("> Caminhos são relativos à raiz do artefato. Baixe o ZIP acima,");
  lines.push("> extraia e abra o arquivo indicado.");
}

const md = lines.join("\n") + "\n";
writeFileSync(outPath, md);
console.log(md);
