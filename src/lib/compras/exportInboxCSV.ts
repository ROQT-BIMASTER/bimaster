import type { InboxOC } from "@/hooks/useCompradorInboxOCs";

const HEADERS = [
  "OC",
  "Produto",
  "Codigo",
  "Marca",
  "OPs",
  "Status",
  "Emissao",
  "ETA",
  "Pedido",
  "Produzido",
  "Nao produzido",
  "Embarcado",
  "Container",
  "Recebido",
  "Saldo",
  "Avaria",
  "Faltante",
  "Cancelada",
  "OC ID",
];

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildInboxCSV(items: InboxOC[]): string {
  const rows = items.map((o) => [
    o.numero_oc,
    o.produto_nome,
    o.produto_codigo,
    o.marca || "",
    o.ops_numeros?.join(" | ") || "",
    o.oc_status,
    o.data_emissao || "",
    o.data_entrega_prevista || "",
    o.qty_pedida,
    o.qty_produzida,
    Math.max(0, (o.qty_pedida || 0) - (o.qty_produzida || 0)),
    o.qty_embarcada,
    o.embarque_container || "",
    o.qty_recebida,
    o.saldo_aberto,
    o.qty_avariada,
    o.qty_faltante,
    o.qty_cancelada,
    o.ordem_compra_id,
  ]);
  const lines = [HEADERS, ...rows].map((r) => r.map(esc).join(";"));
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadInboxCSV(items: InboxOC[]) {
  const csv = buildInboxCSV(items);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `inbox-comprador-ocs-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
