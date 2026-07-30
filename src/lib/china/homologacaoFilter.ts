/**
 * Busca e ordenação da trilha de homologação de documentos.
 *
 * A busca é textual e sem acento/caixa, cobrindo autor, e-mail, decisão,
 * método, origem, parecer e a data formatada (dd/MM/yyyy).
 */
import type { DocAprovacaoAudit } from "@/hooks/useDecisaoDocumentoChina";

export type TrilhaSortKey = "data_desc" | "data_asc" | "autor" | "decisao";

export const TRILHA_SORT_OPTIONS: Array<{ value: TrilhaSortKey; label: string }> = [
  { value: "data_desc", label: "Data (mais recente)" },
  { value: "data_asc", label: "Data (mais antiga)" },
  { value: "autor", label: "Autor (A–Z)" },
  { value: "decisao", label: "Decisão" },
];

export const DECISAO_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
  reaberto: "Reaberto para nova análise",
  em_analise: "Em análise",
  pendente: "Pendente de aprovação",
  ciencia: "Ciência registrada",
};

export function normalizar(v: string | null | undefined): string {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dataBusca(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function trilhaMatch(registro: DocAprovacaoAudit, termo: string): boolean {
  const q = normalizar(termo);
  if (!q) return true;
  const alvo = normalizar(
    [
      registro.decidido_por_nome,
      registro.decidido_por_email,
      registro.decisao,
      DECISAO_LABEL[registro.decisao],
      registro.metodo_confirmacao,
      registro.origem,
      registro.parecer,
      dataBusca(registro.created_at),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return q.split(/\s+/).every((parte) => alvo.includes(parte));
}

export function ordenarTrilha(
  trilha: DocAprovacaoAudit[],
  sort: TrilhaSortKey,
): DocAprovacaoAudit[] {
  const lista = [...trilha];
  switch (sort) {
    case "data_asc":
      return lista.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "autor":
      return lista.sort((a, b) =>
        normalizar(a.decidido_por_nome || a.decidido_por_email).localeCompare(
          normalizar(b.decidido_por_nome || b.decidido_por_email),
        ),
      );
    case "decisao":
      return lista.sort((a, b) => {
        const cmp = normalizar(DECISAO_LABEL[a.decisao] || a.decisao).localeCompare(
          normalizar(DECISAO_LABEL[b.decisao] || b.decisao),
        );
        if (cmp !== 0) return cmp;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    default:
      return lista.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}

/** Aplica busca textual e ordenação sobre a trilha. */
export function filtrarOrdenarTrilha(
  trilha: DocAprovacaoAudit[],
  termo: string,
  sort: TrilhaSortKey,
): DocAprovacaoAudit[] {
  return ordenarTrilha(
    trilha.filter((r) => trilhaMatch(r, termo)),
    sort,
  );
}
