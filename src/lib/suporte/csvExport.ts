// CSV builder para análises do Suporte. BOM UTF-8 + escape estilo Excel pt-BR.
const BOM = "\uFEFF";

function esc(v: unknown, sep: string): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(sep) || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface AnaliseCsvOpts {
  titulo: string;
  periodo: string;
  filtros?: Record<string, string | null | undefined>;
  sep?: string;
}

export function buildAnaliseCsv(
  rows: { label: string; valor: number | null }[],
  opts: AnaliseCsvOpts,
): Blob {
  const sep = opts.sep ?? ",";
  const linhas: (string | number | null)[][] = [
    [`Título: ${opts.titulo}`],
    [`Período: ${opts.periodo}`],
  ];
  if (opts.filtros) {
    for (const [k, v] of Object.entries(opts.filtros)) {
      if (v) linhas.push([`${k}: ${v}`]);
    }
  }
  linhas.push([]);
  linhas.push(["Label", "Valor"]);
  rows.forEach((r) => linhas.push([r.label, r.valor ?? ""]));
  const csv = BOM + linhas.map((r) => r.map((c) => esc(c, sep)).join(sep)).join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}
