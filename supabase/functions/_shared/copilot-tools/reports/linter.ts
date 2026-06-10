// Modern Report Layout Linter. See RFC v4.0.0 §C4.
//
// Findings carry `owner` indicating who fixes each issue.

export const ALLOWED_CHARTS = new Set([
  "line",
  "bar",
  "area_stacked",
  "funnel",
  "table_short",
]);

export const REQUIRED_SECTIONS = [
  "executive_summary",
  "kpis",
  "drivers",
  "risks",
  "action_plan",
  "appendix",
] as const;

export const MAX_TABLE_ROWS = 10;

export type Severity = "ERROR" | "WARNING";
export type Owner = "wizard" | "metric_owner" | "reports_orchestrator" | "renderer";

export interface LintFinding {
  code: string;
  severity: Severity;
  owner: Owner;
  message: string;
  path?: string;
}

export interface ReportDefinitionLike {
  title?: string;
  question?: string;
  audience?: string;
  frequency?: string;
  expected_action?: string;
  language?: string;
  layout_spec?: {
    sections?: Record<string, unknown>;
    charts?: Array<{ type?: string; topN?: number; axes?: number }>;
    kpis?: Array<{ metricId: string; unit?: string; target?: number; lineage?: unknown; status?: string }>;
    topN?: number;
    colors?: string[];
  };
  metric_refs?: Array<{ metricId: string; unit?: string; lineage?: unknown; status?: string }>;
}

export function lintReportLayout(def: ReportDefinitionLike): LintFinding[] {
  const out: LintFinding[] = [];

  // Purpose fields (wizard owns)
  for (const f of ["question", "audience", "frequency", "expected_action"] as const) {
    if (!def[f] || String(def[f]).trim().length === 0) {
      out.push({
        code: `purpose.${f}.missing`,
        severity: "ERROR",
        owner: "wizard",
        message: `Campo obrigatório "${f}" ausente.`,
        path: f,
      });
    }
  }

  const spec = def.layout_spec ?? {};
  const sections = spec.sections ?? {};
  for (const s of REQUIRED_SECTIONS) {
    const content = (sections as Record<string, unknown>)[s];
    if (!content || (Array.isArray(content) && content.length === 0)) {
      out.push({
        code: `section.${s}.empty`,
        severity: "ERROR",
        owner: "wizard",
        message: `Seção obrigatória "${s}" vazia.`,
        path: `layout_spec.sections.${s}`,
      });
    }
  }

  // KPI contract (metric_owner owns)
  const kpis = spec.kpis ?? [];
  kpis.forEach((k, i) => {
    if (!k.unit) {
      out.push({ code: "kpi.unit.missing", severity: "ERROR", owner: "metric_owner",
        message: `KPI "${k.metricId}" sem unit.`, path: `layout_spec.kpis[${i}].unit` });
    }
    if (k.target === undefined || k.target === null) {
      out.push({ code: "kpi.target.missing", severity: "ERROR", owner: "metric_owner",
        message: `KPI "${k.metricId}" sem target.`, path: `layout_spec.kpis[${i}].target` });
    }
    if (k.status === "draft") {
      out.push({ code: "kpi.draft", severity: "ERROR", owner: "metric_owner",
        message: `KPI "${k.metricId}" em rascunho.`, path: `layout_spec.kpis[${i}].status` });
    }
    if (!k.lineage) {
      out.push({ code: "kpi.lineage.missing", severity: "ERROR", owner: "metric_owner",
        message: `Métrica "${k.metricId}" sem lineage.`, path: `layout_spec.kpis[${i}].lineage` });
    }
  });

  // Chart allowlist (reports_orchestrator owns)
  const charts = spec.charts ?? [];
  charts.forEach((c, i) => {
    if (!c.type || !ALLOWED_CHARTS.has(c.type)) {
      out.push({ code: "chart.type.disallowed", severity: "ERROR", owner: "reports_orchestrator",
        message: `Gráfico tipo "${c.type}" fora da allowlist.`, path: `layout_spec.charts[${i}].type` });
    }
    if (c.axes && c.axes > 1) {
      out.push({ code: "chart.dual_axis", severity: "ERROR", owner: "reports_orchestrator",
        message: "Eixo duplo não permitido.", path: `layout_spec.charts[${i}].axes` });
    }
    if (c.type === "table_short" && (c.topN ?? 10) > MAX_TABLE_ROWS) {
      out.push({ code: "table.too_long", severity: "ERROR", owner: "reports_orchestrator",
        message: `Tabela com mais de ${MAX_TABLE_ROWS} linhas; aplique topN=10 + "Outros".`,
        path: `layout_spec.charts[${i}].topN` });
    }
  });

  if (spec.topN !== undefined && spec.topN > MAX_TABLE_ROWS) {
    out.push({ code: "layout.topN.warn", severity: "WARNING", owner: "reports_orchestrator",
      message: `topN=${spec.topN} > ${MAX_TABLE_ROWS}.`, path: "layout_spec.topN" });
  }

  // Renderer warnings (cores fora de tokens HSL)
  for (const color of spec.colors ?? []) {
    if (!/^hsl\(/i.test(color) && !/^var\(--/.test(color)) {
      out.push({ code: "color.non_token", severity: "WARNING", owner: "renderer",
        message: `Cor "${color}" não é token HSL semântico.` });
    }
  }

  return out;
}

export interface LintReport {
  ok: boolean;
  errors: LintFinding[];
  warnings: LintFinding[];
}

export function summarizeLint(findings: LintFinding[]): LintReport {
  const errors = findings.filter((f) => f.severity === "ERROR");
  const warnings = findings.filter((f) => f.severity === "WARNING");
  return { ok: errors.length === 0, errors, warnings };
}

export function canPublish(findings: LintFinding[]): boolean {
  return summarizeLint(findings).ok;
}
