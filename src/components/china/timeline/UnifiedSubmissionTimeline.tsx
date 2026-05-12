import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FilePlus2, FileText, Send, ShieldCheck, ShoppingCart, Factory,
  Ship, Compass, FileCheck2, PackageCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { StageCard, type StageStatus } from "@/components/shared/timeline/StageCard";
import { DataRow } from "@/components/shared/timeline/DataRow";
import { useOCTimeline } from "@/hooks/useOCTimeline";


interface SubmissaoLite {
  submissao_id: string;
  submissao_status?: string | null;
  aprovado_em?: string | null;
  created_at?: string | null;
  numero_ordem?: string | null;
}

interface Props {
  submissao: SubmissaoLite;
  /** Quando a OC já existir, passamos o id para hidratar etapas 5–10. */
  ocId?: string | null;
  /** Se true, mostra somente etapas 1–4 (uso embutido em outras telas). */
  onlyChinaStages?: boolean;
  className?: string;
}

const fmtDate = (d: string | null | undefined): string => {
  const parsed = parseLocalDate(d || null);
  if (!parsed) return "—";
  return format(parsed, "dd MMM yyyy", { locale: ptBR });
};
const fmtNum = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n || 0);

interface DocSummary {
  total: number;
  pendentes: number;
  aprovados: number;
  rejeitados: number;
  ultimoStatus: string | null;
  ultimoEm: string | null;
}

function useDocsResumo(submissaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-submissao-docs-resumo", submissaoId],
    enabled: !!submissaoId,
    staleTime: 60_000,
    queryFn: async (): Promise<DocSummary> => {
      const { data } = await (supabase as any)
        .from("china_produto_documentos")
        .select("status, updated_at, created_at")
        .eq("submissao_id", submissaoId)
        .order("updated_at", { ascending: false });
      const rows = (data || []) as Array<{ status: string; updated_at: string | null; created_at: string }>;
      let pendentes = 0, aprovados = 0, rejeitados = 0;
      for (const r of rows) {
        if (r.status === "aprovado") aprovados += 1;
        else if (r.status === "rejeitado") rejeitados += 1;
        else pendentes += 1;
      }
      return {
        total: rows.length,
        pendentes,
        aprovados,
        rejeitados,
        ultimoStatus: rows[0]?.status ?? null,
        ultimoEm: rows[0]?.updated_at ?? rows[0]?.created_at ?? null,
      };
    },
  });
}

export function UnifiedSubmissionTimeline({ submissao, ocId, onlyChinaStages, className }: Props) {
  const { data: docs } = useDocsResumo(submissao.submissao_id);
  const { data: ocTimeline } = useOCTimeline(ocId || null);
  const oc = ocTimeline?.oc as any;
  const embarque = ocTimeline?.embarques?.[0] as any;

  // ---------- China (1–4) ----------
  const stSubmissao: StageStatus = "done";

  const stDocs: StageStatus = useMemo(() => {
    if (!docs || docs.total === 0) return "neutral";
    if (docs.rejeitados > 0) return "atrasado";
    if (docs.pendentes > 0) return "pending";
    return "done";
  }, [docs]);

  const enviadaParaBrasil = ["enviado", "enviado_brasil", "em_revisao", "aprovado", "rejeitado"]
    .includes(submissao.submissao_status);
  const stEnviada: StageStatus = enviadaParaBrasil
    ? "done"
    : submissao.submissao_status === "rascunho"
    ? "neutral"
    : "pending";

  const stAprovBrasil: StageStatus = submissao.submissao_status === "aprovado"
    ? "done"
    : submissao.submissao_status === "rejeitado"
    ? "atrasado"
    : enviadaParaBrasil
    ? "pending"
    : "neutral";

  // ---------- Brasil/OC (5–10) ----------
  const totalApontado = (ocTimeline?.apontamentos || [])
    .reduce((acc: number, a: any) => acc + (a.quantidade || 0), 0);

  const ocLoaded = !!oc;
  const qtyPedida = Number(oc?.quantidade ?? oc?.qty_pedida ?? 0);
  const qtyProduzida = Number(oc?.qty_produzida ?? totalApontado ?? 0);
  const qtyEmbarcada = Number(oc?.qty_embarcada ?? 0);
  const qtyRecebida = Number(oc?.qty_recebida ?? 0);
  const saldoAberto = Number(oc?.saldo_aberto ?? Math.max(0, qtyPedida - qtyRecebida));

  const stPedido: StageStatus = ocLoaded
    ? oc.status && oc.status !== "rascunho" ? "done" : "pending"
    : "neutral";
  const stProducao: StageStatus = !ocLoaded
    ? "neutral"
    : qtyPedida && qtyProduzida >= qtyPedida ? "done" : qtyProduzida > 0 ? "pending" : "neutral";
  const stEmbarque: StageStatus = !ocLoaded
    ? "neutral"
    : qtyPedida && qtyEmbarcada >= qtyPedida ? "done" : qtyEmbarcada > 0 ? "pending" : "neutral";
  const stTransito: StageStatus = !ocLoaded
    ? "neutral"
    : oc.data_chegada_porto ? "done" : embarque?.data_eta ? "pending" : "neutral";
  const stDesemb: StageStatus = !ocLoaded
    ? "neutral"
    : oc.data_desembaraco ? "done" : oc.data_chegada_porto ? "pending" : "neutral";
  const stReceb: StageStatus = !ocLoaded
    ? "neutral"
    : saldoAberto <= 0 && qtyPedida > 0 ? "done" : qtyRecebida > 0 ? "pending" : "neutral";

  return (
    <div className={className}>
      <div className="space-y-2">
        <StageCard icon={FilePlus2} title="1. Submissão criada" status={stSubmissao}>
          <DataRow label="Criada em" value={submissao.created_at ? fmtDate(submissao.created_at) : "—"} />
          <DataRow label="Status atual" value={submissao.submissao_status} />
          {submissao.numero_ordem && <DataRow label="OC vinculada" value={submissao.numero_ordem} />}
        </StageCard>

        <StageCard icon={FileText} title="2. Documentos & parecer" status={stDocs}>
          <DataRow label="Documentos" value={docs?.total ?? 0} />
          <DataRow label="Aprovados" value={docs?.aprovados ?? 0} />
          <DataRow label="Pendentes" value={docs?.pendentes ?? 0} />
          {(docs?.rejeitados ?? 0) > 0 && (
            <DataRow label="Rejeitados" value={docs?.rejeitados ?? 0} />
          )}
        </StageCard>

        <StageCard icon={Send} title="3. Enviada ao Brasil" status={stEnviada}>
          <DataRow
            label="Estado"
            value={enviadaParaBrasil ? "Em poder do Brasil" : "Aguardando envio (rascunho)"}
          />
          {docs?.ultimoEm && enviadaParaBrasil && (
            <DataRow label="Última atividade" value={fmtDate(docs.ultimoEm)} />
          )}
        </StageCard>

        <StageCard icon={ShieldCheck} title="4. Aprovação Brasil" status={stAprovBrasil}>
          {submissao.aprovado_em ? (
            <DataRow label="Aprovada em" value={fmtDate(submissao.aprovado_em)} />
          ) : submissao.submissao_status === "rejeitado" ? (
            <p className="text-muted-foreground italic">Submissão rejeitada — aguardando correção.</p>
          ) : enviadaParaBrasil ? (
            <p className="text-muted-foreground italic">Em análise pelo Brasil.</p>
          ) : (
            <p className="text-muted-foreground italic">Aguardando envio ao Brasil.</p>
          )}
        </StageCard>

        {!onlyChinaStages && (
          <>
            {!ocLoaded && (
              <p className="text-[11px] text-muted-foreground italic px-1 pt-1">
                Aguardando aprovação do Brasil para gerar a Ordem de Compra. As etapas
                abaixo serão preenchidas automaticamente conforme o pedido avançar.
              </p>
            )}

            <StageCard icon={ShoppingCart} title="5. Pedido (OC)" status={stPedido}>
              {ocLoaded ? (
                <>
                  <DataRow label="OC" value={oc.numero_oc || submissao.numero_ordem || "—"} />
                  <DataRow label="Emissão" value={fmtDate(oc.data_emissao)} />
                  <DataRow label="Entrega prevista" value={fmtDate(oc.data_entrega_prevista)} />
                  <DataRow label="Quantidade" value={fmtNum(qtyPedida)} />
                </>
              ) : (
                <p className="text-muted-foreground italic">OC ainda não emitida.</p>
              )}
            </StageCard>

            <StageCard icon={Factory} title="6. Produção" status={stProducao}>
              {ocLoaded ? (
                <>
                  <DataRow label="Apontado" value={`${fmtNum(qtyProduzida)} un.`} />
                  <DataRow label="Apontamentos" value={ocTimeline?.apontamentos?.length || 0} />
                </>
              ) : (
                <p className="text-muted-foreground italic">Sem produção registrada.</p>
              )}
            </StageCard>

            <StageCard icon={Ship} title="7. Embarque" status={stEmbarque}>
              {embarque ? (
                <>
                  <DataRow label="Modalidade" value={`${embarque.modalidade || "—"} · ${embarque.tipo_embarque || "—"}`} />
                  <DataRow label="Container" value={embarque.numero_container || "—"} />
                  <DataRow label="ETD" value={fmtDate(embarque.data_embarque)} />
                  <DataRow label="ETA" value={fmtDate(embarque.data_eta)} />
                </>
              ) : (
                <p className="text-muted-foreground italic">Nenhum embarque registrado.</p>
              )}
            </StageCard>

            <StageCard icon={Compass} title="8. Trânsito" status={stTransito}>
              <DataRow label="Origem" value={embarque?.porto_origem || "—"} />
              <DataRow label="Destino" value={embarque?.porto_destino || "—"} />
              <DataRow label="Chegada porto" value={fmtDate(oc?.data_chegada_porto)} />
            </StageCard>

            <StageCard icon={FileCheck2} title="9. Desembaraço" status={stDesemb}>
              <DataRow label="Chegada porto" value={fmtDate(oc?.data_chegada_porto)} />
              <DataRow label="Desembaraço" value={fmtDate(oc?.data_desembaraco)} />
            </StageCard>

            <StageCard icon={PackageCheck} title="10. Recebido no CD" status={stReceb}>
              {ocLoaded ? (
                <>
                  <DataRow label="Recebido CD" value={fmtDate(oc?.data_recebimento_cd)} />
                  <DataRow label="Recebido" value={fmtNum(qtyRecebida)} />
                  <DataRow label="Saldo aberto" value={fmtNum(saldoAberto)} />
                </>
              ) : (
                <p className="text-muted-foreground italic">Aguardando OC.</p>
              )}
            </StageCard>
          </>
        )}
      </div>
    </div>
  );
}
