/**
 * Linha do tempo / versões da homologação de um documento da China.
 *
 * Converte a trilha imutável (`china_doc_aprovacoes_audit`) numa sequência de
 * etapas comparáveis: cada etapa mostra a decisão anterior, a decisão daquela
 * etapa (diferença de status), autor, motivo/parecer e o intervalo desde a
 * etapa anterior. A etapa mais recente é marcada como atual.
 */
import type { DocAprovacaoAudit } from "@/hooks/useDecisaoDocumentoChina";

export interface EtapaHomologacao {
  id: string;
  ordem: number;
  versao: string;
  atual: boolean;
  de: string | null;
  para: string;
  mudou: boolean;
  autor: string;
  motivo: string | null;
  metodo: string;
  origem: string | null;
  createdAt: string;
  horasDesdeAnterior: number | null;
}

function autorDe(r: DocAprovacaoAudit): string {
  return r.decidido_por_nome || r.decidido_por_email || "Usuário";
}

function ts(iso: string | null | undefined): number {
  const t = new Date(iso || "").getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Retorna as etapas da mais recente para a mais antiga.
 */
export function construirLinhaDoTempo(trilha: DocAprovacaoAudit[]): EtapaHomologacao[] {
  const asc = [...trilha].sort((a, b) => ts(a.created_at) - ts(b.created_at));
  const etapas: EtapaHomologacao[] = asc.map((r, i) => {
    const anterior = i > 0 ? asc[i - 1] : null;
    const horas = anterior
      ? Math.max(0, Math.round(((ts(r.created_at) - ts(anterior.created_at)) / 36e5) * 10) / 10)
      : null;
    return {
      id: r.id,
      ordem: i + 1,
      versao: `v${i + 1}`,
      atual: i === asc.length - 1,
      de: anterior ? anterior.decisao : null,
      para: r.decisao,
      mudou: !anterior || anterior.decisao !== r.decisao,
      autor: autorDe(r),
      motivo: r.parecer?.trim() || null,
      metodo: r.metodo_confirmacao,
      origem: r.origem,
      createdAt: r.created_at,
      horasDesdeAnterior: horas,
    };
  });
  return etapas.reverse();
}

/** Rótulo curto do intervalo entre etapas ("3 h depois", "2 d depois"). */
export function intervaloLabel(horas: number | null): string | null {
  if (horas == null) return null;
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min depois`;
  if (horas < 48) return `${Math.round(horas)} h depois`;
  return `${Math.round(horas / 24)} d depois`;
}
