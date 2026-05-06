// Helpers para exportar CSV do Monitor de Recebimentos OC
// Sempre prefixa BOM UTF-8 para abrir corretamente no Excel pt-BR.

const BOM = "\uFEFF";

function esc(v: unknown, sep: string): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(sep) || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function build(rows: (string | number | null | undefined)[][], sep = ","): Blob {
  const csv = BOM + rows.map((r) => r.map((c) => esc(c, sep)).join(sep)).join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Escopo OC (resumo)
export function buildOCResumoCsv(kpis: any[], sep = ","): Blob {
  const header = [
    "OC", "Produto código", "Produto", "Status",
    "Pedida", "Embarcada", "Recebida", "Avariada", "Faltante", "Cancelada", "Saldo",
    "Emissão", "Entrega prevista", "Chegada porto", "Desembaraço", "Recebido CD", "SLA porto→CD (dias)",
  ];
  const rows = kpis.map((k) => [
    k.numero_oc, k.produto_codigo, k.produto_nome, k.oc_status,
    k.qty_pedida, k.qty_embarcada, k.qty_recebida, k.qty_avariada, k.qty_faltante, k.qty_cancelada, k.saldo_aberto,
    k.data_emissao || "", k.data_entrega_prevista || "", k.data_chegada_porto || "",
    k.data_desembaraco || "", k.data_recebimento_cd || "", k.sla_porto_cd_dias ?? "",
  ]);
  return build([header, ...rows], sep);
}

// Escopo OPs vinculadas
export function buildOPsCsv(rows: any[], sep = ","): Blob {
  const header = [
    "OC", "OP", "Status", "Lote", "Qty planejada", "Qty produzida", "Qty alocada",
    "Eficiência (%)", "Data início", "Data prevista", "Data fim",
  ];
  const data = rows.map((r) => [
    r.numero_oc, r.numero, r.status, r.lote || "",
    r.quantidade_planejada, r.quantidade_produzida ?? 0, r.qty_alocada,
    r.eficiencia_percentual ?? "", r.data_inicio || "", r.data_prevista || "", r.data_fim || "",
  ]);
  return build([header, ...data], sep);
}

// Escopo divergências (NCs)
export function buildDivergenciasCsv(ncs: any[], sep = ","): Blob {
  const header = [
    "NC", "OC", "Produto", "Tipo", "Severidade", "Status", "Qty envolvida",
    "Descrição", "Aberta em", "Resolvida em", "Resolução",
  ];
  const data = ncs.map((n) => [
    n.numero_nc, n.oc?.numero_oc || "", n.oc?.produto_codigo || "",
    n.tipo, n.severidade, n.status, n.qty_envolvida ?? 0,
    n.descricao || "", n.created_at || "", n.resolvida_em || "", n.resolucao || "",
  ]);
  return build([header, ...data], sep);
}
