import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FilePlus2, FileText, Send, ShieldCheck, ShoppingCart, Factory,
  Ship, Compass, FileCheck2, PackageCheck, ChevronDown, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { StageCard, type StageStatus } from "@/components/shared/timeline/StageCard";
import { DataRow } from "@/components/shared/timeline/DataRow";
import { useOCTimeline } from "@/hooks/useOCTimeline";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChinaTimelineSla } from "@/hooks/useChinaTimelineSla";
import { computeStageDeadlines, type StageDeadline } from "@/lib/china/timelineSlaCompute";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import {
  computeExpectedChecklist,
  type ChecklistCustomCategory,
  type ChecklistCustomItem,
  type ChecklistHiddenItem,
} from "@/lib/china/mergeChecklist";
import {
  summarizeChecklistResumo,
  validateChecklistResumo,
} from "@/lib/china/checklistResumo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";


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
  /** Notifica o pai com a lista de etapas (para exportar em PDF, por exemplo). */
  onStagesComputed?: (stages: import("@/lib/china/exportTimelinePdf").JourneyStageRow[]) => void;
}

const fmtDate = (d: string | null | undefined): string => {
  const parsed = parseLocalDate(d || null);
  if (!parsed) return "—";
  return format(parsed, "dd MMM yyyy", { locale: ptBR });
};
const fmtNum = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n || 0);

interface DocRow {
  id: string;
  tipo_documento: string;
  status: string;
  nome_arquivo: string | null;
  arquivo_url: string | null;
  updated_at: string | null;
  created_at: string;
}

interface DocSummary {
  total: number;
  pendentes: number;
  aprovados: number;
  rejeitados: number;
  enviados: number; // total que efetivamente saiu da China para o Brasil
  ultimoStatus: string | null;
  ultimoEm: string | null;
  rows: DocRow[];
}

const SENT_STATUSES = ["enviado", "contestado", "aprovado", "rejeitado", "em_revisao"];

function useDocsResumo(submissaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-submissao-docs-resumo", submissaoId],
    enabled: !!submissaoId,
    staleTime: 30_000,
    queryFn: async (): Promise<DocSummary> => {
      // 1) Documentos efetivamente anexados a esta submissão.
      // 2) Customizações de checklist (mesma fonte usada pela Caixa de Entrada
      //    e pelo drawer de pendências) — garante que os contadores
      //    mostrados na linha do tempo sejam idênticos aos do checklist:
      //    total ESPERADO (denominador), pendentes (sem anexo + status pending),
      //    enviados, aprovados e rejeitados.
      const [docsRes, ccRes, ciRes, hRes] = await Promise.all([
        (supabase as any)
          .from("china_produto_documentos")
          .select("id, tipo_documento, status, nome_arquivo, arquivo_url, updated_at, created_at")
          .eq("submissao_id", submissaoId)
          .order("updated_at", { ascending: false }),
        (supabase as any)
          .from("china_checklist_custom_categorias")
          .select("id, submissao_id, fluxo, label_pt, label_cn, ordem")
          .eq("submissao_id", submissaoId),
        (supabase as any)
          .from("china_checklist_custom_itens")
          .select("id, submissao_id, tipo_key, label_pt, label_cn, categoria_default_key, categoria_custom_id")
          .eq("submissao_id", submissaoId),
        (supabase as any)
          .from("china_checklist_itens_ocultos")
          .select("submissao_id, tipo_key")
          .eq("submissao_id", submissaoId),
      ]);

      const rows = (docsRes.data || []) as DocRow[];
      const expected = computeExpectedChecklist(
        (ccRes.data || []) as ChecklistCustomCategory[],
        (ciRes.data || []) as ChecklistCustomItem[],
        (hRes.data || []) as ChecklistHiddenItem[],
      );

      // Resumo via função PURA compartilhada — mesma classificação de
      // `groupMailboxItems.classifyForProgress` (Caixa de Entrada). Garante
      // que total/pendentes/enviados/aprovados/rejeitados batam exatamente
      // entre a linha do tempo e a Caixa.
      const resumo = summarizeChecklistResumo(rows, expected);

      // Validação defensiva — em produção apenas avisa no console; em testes
      // (`vitest`) explode caso algum dia a invariante seja violada.
      const inconsistencia = validateChecklistResumo(resumo);
      if (inconsistencia) {
        // eslint-disable-next-line no-console
        console.warn(`[timeline] resumo inconsistente para ${submissaoId}: ${inconsistencia}`);
      }

      return {
        total: resumo.total,
        pendentes: resumo.pendentes,
        aprovados: resumo.aprovados,
        rejeitados: resumo.rejeitados,
        enviados: resumo.enviados,
        ultimoStatus: rows[0]?.status ?? null,
        ultimoEm: rows[0]?.updated_at ?? rows[0]?.created_at ?? null,
        rows,
      };
    },
  });
}

function ProgressBlock({
  label, current, total, tone,
}: {
  label: string;
  current: number;
  total: number;
  tone: "emerald" | "amber" | "rose";
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const colorClass = {
    emerald: "[&>div]:bg-emerald-500",
    amber: "[&>div]:bg-amber-500",
    rose: "[&>div]:bg-rose-500",
  }[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {current}/{total} <span className="text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <Progress value={pct} className={cn("h-1.5", colorClass)} />
    </div>
  );
}

function statusToneClass(status: string): string {
  if (status === "aprovado") return "border-emerald-500/40 text-emerald-400";
  if (status === "rejeitado") return "border-rose-500/40 text-rose-400";
  if (status === "em_revisao" || status === "contestado") return "border-amber-500/40 text-amber-400";
  if (status === "enviado") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

function ExpandableDocList({
  rows,
  filter,
  emptyText,
  label,
  defaultOpen = false,
}: {
  rows: DocRow[];
  filter: (r: DocRow) => boolean;
  emptyText: string;
  label?: string;
  defaultOpen?: boolean;
}) {
  const { t } = useChinaI18n();
  const [open, setOpen] = useState(defaultOpen);
  const filtered = rows.filter(filter);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? t("timeline.common.ocultarDetalhamento") : `${label ?? t("timeline.common.verDetalhamento")} (${filtered.length})`}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 border-l border-border/60 pl-2">
          {filtered.length === 0 ? (
            <li className="text-[11px] italic text-muted-foreground">{emptyText}</li>
          ) : (
            filtered.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-foreground/90">{r.tipo_documento}</span>
                <Badge variant="outline" className={cn("h-4 px-1 text-[9px] uppercase shrink-0", statusToneClass(r.status))}>
                  {r.status}
                </Badge>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function GroupedSentDocList({ rows }: { rows: DocRow[] }) {
  const { t } = useChinaI18n();
  const [open, setOpen] = useState(false);
  const sent = rows.filter((r) => SENT_STATUSES.includes(r.status));
  const aprovados = sent.filter((r) => r.status === "aprovado");
  const rejeitados = sent.filter((r) => r.status === "rejeitado");
  const aguardando = sent.filter((r) => r.status !== "aprovado" && r.status !== "rejeitado");
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open
          ? t("timeline.common.ocultarDetalhamento")
          : t("timeline.stage4.verDetalhamento", { enviados: sent.length, aprovados: aprovados.length, rejeitados: rejeitados.length })}
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 border-l border-border/60 pl-2">
          {[
            { title: t("timeline.stage4.grupoAprovados"), items: aprovados, tone: "border-emerald-500/40 text-emerald-400" },
            { title: t("timeline.stage4.grupoAguardando"), items: aguardando, tone: "border-amber-500/40 text-amber-400" },
            { title: t("timeline.stage4.grupoRejeitados"), items: rejeitados, tone: "border-rose-500/40 text-rose-400" },
          ].map((grp) => (
            <div key={grp.title} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>{grp.title}</span>
                <span className="tabular-nums">{grp.items.length}</span>
              </div>
              {grp.items.length === 0 ? (
                <p className="text-[11px] italic text-muted-foreground/70">{t("timeline.stage4.nenhumItem")}</p>
              ) : (
                <ul className="space-y-1">
                  {grp.items.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-foreground/90">{r.tipo_documento}</span>
                      <Badge variant="outline" className={cn("h-4 px-1 text-[9px] uppercase shrink-0", grp.tone)}>
                        {r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UnifiedSubmissionTimeline({ submissao, ocId, onlyChinaStages, className, onStagesComputed }: Props) {
  const { t } = useChinaI18n();
  const qc = useQueryClient();
  const { data: docs } = useDocsResumo(submissao.submissao_id);
  const { data: ocTimeline } = useOCTimeline(ocId || null);
  const oc = ocTimeline?.oc as any;
  const embarque = ocTimeline?.embarques?.[0] as any;

  // Realtime: invalida cache local quando docs ou submissão mudam.
  useEffect(() => {
    const sid = submissao.submissao_id;
    if (!sid) return;
    // Helper: invalida TUDO que depende dos contadores do checklist desta
    // submissão — resumo da timeline, dataset da Caixa de Entrada e qualquer
    // query "china-mailbox*" — para garantir tempo real ponta-a-ponta.
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["china-submissao-docs-resumo", sid] });
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      qc.invalidateQueries({ queryKey: ["china-mailbox"] });
    };
    const channel = supabase
      .channel(`unified-timeline-${sid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_produto_documentos", filter: `submissao_id=eq.${sid}` },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_produto_submissoes", filter: `id=eq.${sid}` },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_checklist_custom_categorias", filter: `submissao_id=eq.${sid}` },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_checklist_custom_itens", filter: `submissao_id=eq.${sid}` },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_checklist_itens_ocultos", filter: `submissao_id=eq.${sid}` },
        invalidateAll,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [submissao.submissao_id, qc]);

  // ---------- China (1–4) ----------
  const stSubmissao: StageStatus = "done";

  const stDocs: StageStatus = useMemo(() => {
    if (!docs || docs.total === 0) return "neutral";
    if (docs.rejeitados > 0) return "atrasado";
    if (docs.pendentes > 0) return "pending";
    return "done";
  }, [docs]);

  const submStatus = submissao.submissao_status || "";
  const enviadaParaBrasil = ["enviado", "enviado_brasil", "em_revisao", "aprovado", "rejeitado"]
    .includes(submStatus);

  // Stage 3: só fica "done" quando TODOS os documentos do checklist tiverem
  // sido enviados ao Brasil. Envio parcial vira "pending" e exibe progresso.
  const totalDocs = docs?.total ?? 0;
  const enviadosDocs = docs?.enviados ?? 0;
  const allSent = totalDocs > 0 && enviadosDocs >= totalDocs;
  const stEnviada: StageStatus = !enviadaParaBrasil && totalDocs === 0
    ? (submStatus === "rascunho" ? "neutral" : "pending")
    : allSent
    ? "done"
    : enviadosDocs > 0
    ? "pending"
    : submStatus === "rascunho"
    ? "neutral"
    : "pending";

  // Stage 4: comparar documentos enviados vs aprovados pelo Brasil.
  const aprovDocs = docs?.aprovados ?? 0;
  const rejDocs = docs?.rejeitados ?? 0;
  const fullyApproved = enviadosDocs > 0 && aprovDocs >= enviadosDocs;
  const stAprovBrasil: StageStatus =
    submissao.aprovado_em || (fullyApproved && submStatus === "aprovado")
      ? "done"
      : rejDocs > 0 || submStatus === "rejeitado"
      ? "atrasado"
      : enviadosDocs > 0
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

  // ---------- Deadlines (SLA) ----------
  const { data: slaData } = useChinaTimelineSla(submissao.submissao_id);
  const baseDate = parseLocalDate(submissao.created_at || null);
  const deadlines: StageDeadline[] = useMemo(() => {
    const sla = slaData?.effective ?? null;
    if (!sla) return [];
    const stagesArr = [
      { stage: 1, st: stSubmissao, doneAt: submissao.created_at },
      { stage: 2, st: stDocs, doneAt: docs?.ultimoEm ?? null },
      { stage: 3, st: stEnviada, doneAt: docs?.ultimoEm ?? null },
      { stage: 4, st: stAprovBrasil, doneAt: submissao.aprovado_em ?? null },
      { stage: 5, st: stPedido, doneAt: oc?.data_emissao ?? null },
      { stage: 6, st: stProducao, doneAt: oc?.data_producao_concluida ?? null },
      { stage: 7, st: stEmbarque, doneAt: embarque?.data_embarque ?? null },
      { stage: 8, st: stTransito, doneAt: oc?.data_chegada_porto ?? null },
      { stage: 9, st: stDesemb, doneAt: oc?.data_desembaraco ?? null },
      { stage: 10, st: stReceb, doneAt: oc?.data_recebimento_cd ?? null },
    ];
    return computeStageDeadlines({
      base: baseDate,
      sla,
      stageState: stagesArr.map((s) => ({
        stage: s.stage,
        done: s.st === "done",
        concluidaEm: s.doneAt ? (parseLocalDate(s.doneAt) ?? new Date(s.doneAt)) : null,
      })),
    });
  }, [slaData, baseDate, stSubmissao, stDocs, stEnviada, stAprovBrasil, stPedido, stProducao, stEmbarque, stTransito, stDesemb, stReceb, docs?.ultimoEm, submissao.aprovado_em, submissao.created_at, oc, embarque]);
  const dl = (n: number): StageDeadline | undefined => deadlines.find((d) => d.stage === n);

  // Notifica o pai com o snapshot atual das etapas (para exportar PDF).
  useEffect(() => {
    if (!onStagesComputed) return;
    const stages: import("@/lib/china/exportTimelinePdf").JourneyStageRow[] = [
      { numero: 1, titulo: "Submissão criada", status: stSubmissao,
        detalhe: `Status atual: ${submStatus || "—"}` },
      { numero: 2, titulo: "Documentos & parecer", status: stDocs,
        detalhe: `${docs?.aprovados ?? 0} aprovados · ${docs?.pendentes ?? 0} pendentes · ${docs?.rejeitados ?? 0} rejeitados (total ${docs?.total ?? 0})` },
      { numero: 3, titulo: "Enviada ao Brasil", status: stEnviada,
        detalhe: totalDocs > 0 ? `${enviadosDocs}/${totalDocs} itens enviados` : (enviadaParaBrasil ? "Em poder do Brasil" : "Aguardando envio") },
      { numero: 4, titulo: "Aprovação Brasil", status: stAprovBrasil,
        detalhe: enviadosDocs > 0 ? `${aprovDocs}/${enviadosDocs} aprovados${rejDocs > 0 ? ` · ${rejDocs} rejeitados` : ""}` : "Aguardando envio ao Brasil" },
    ];
    if (!onlyChinaStages) {
      stages.push(
        { numero: 5, titulo: "Pedido (OC)", status: stPedido, detalhe: ocLoaded ? `OC ${oc.numero_oc || submissao.numero_ordem || "—"}` : "OC não emitida" },
        { numero: 6, titulo: "Produção", status: stProducao, detalhe: ocLoaded ? `${qtyProduzida}/${qtyPedida} apontado` : "—" },
        { numero: 7, titulo: "Embarque", status: stEmbarque, detalhe: embarque ? `${embarque.modalidade || "—"} · container ${embarque.numero_container || "—"}` : "Sem embarque" },
        { numero: 8, titulo: "Trânsito", status: stTransito, detalhe: `${embarque?.porto_origem || "—"} → ${embarque?.porto_destino || "—"}` },
        { numero: 9, titulo: "Desembaraço", status: stDesemb, detalhe: oc?.data_desembaraco ? `Desembaraço em ${fmtDate(oc.data_desembaraco)}` : "Aguardando" },
        { numero: 10, titulo: "Recebido no CD", status: stReceb, detalhe: ocLoaded ? `Recebido ${qtyRecebida} · saldo ${saldoAberto}` : "Aguardando OC" },
      );
    }
    onStagesComputed(stages);
  }, [
    onStagesComputed, onlyChinaStages, submStatus, docs, totalDocs, enviadosDocs,
    enviadaParaBrasil, aprovDocs, rejDocs, ocLoaded, oc, embarque, qtyProduzida,
    qtyPedida, qtyRecebida, saldoAberto, stSubmissao, stDocs, stEnviada,
    stAprovBrasil, stPedido, stProducao, stEmbarque, stTransito, stDesemb,
    stReceb, submissao.numero_ordem,
  ]);

  return (
    <TooltipProvider delayDuration={150}>
    <div className={className}>
      <div className="space-y-2">
        <StageCard icon={FilePlus2} title={t("timeline.stages.1")} status={stSubmissao} deadline={dl(1)}>
          <DataRow label={t("timeline.common.criadaEm")} value={submissao.created_at ? fmtDate(submissao.created_at) : "—"} />
          <DataRow label={t("timeline.common.statusAtual")} value={submStatus || "—"} />
          {submissao.numero_ordem && <DataRow label={t("timeline.common.ocVinculada")} value={submissao.numero_ordem} />}
        </StageCard>

        <StageCard
          icon={FileText}
          title={t("timeline.stages.2")}
          status={stDocs}
          deadline={dl(2)}
          headerExtra={
            <RuleHint text="Total esperado é o checklist mesclado (itens padrão + customizados − ocultos), idêntico ao da Caixa de Entrada. Pendentes = itens sem documento anexado ou em status rascunho." />
          }
        >
          <DataRow label={t("timeline.common.documentos")} value={docs?.total ?? 0} />
          <DataRow label={t("timeline.common.aprovados")} value={docs?.aprovados ?? 0} />
          <DataRow label={t("timeline.common.pendentes")} value={docs?.pendentes ?? 0} />
          {(docs?.rejeitados ?? 0) > 0 && (
            <DataRow label={t("timeline.common.rejeitados")} value={docs?.rejeitados ?? 0} />
          )}
        </StageCard>

        <StageCard
          icon={Send}
          title={t("timeline.stages.3")}
          status={stEnviada}
          deadline={dl(3)}
          headerExtra={
            <RuleHint text="Conta como ENVIADO ao Brasil qualquer documento já anexado fora de rascunho — inclusive em status pendente, enviado, em revisão, contestado, aprovado ou rejeitado. Apenas itens sem anexo (ou em rascunho) ficam como pendentes." />
          }
        >
          <DataRow
            label={t("timeline.common.estado")}
            value={
              totalDocs === 0
                ? (enviadaParaBrasil ? t("timeline.stage3.estadoEmPoderBrasil") : t("timeline.stage3.estadoSemDocs"))
                : allSent
                ? t("timeline.stage3.estadoCompleto")
                : enviadosDocs > 0
                ? t("timeline.stage3.estadoParcial")
                : t("timeline.stage3.estadoAguardando")
            }
          />
          {totalDocs > 0 && (
            <ProgressBlock
              label={t("timeline.stage3.progressoLabel")}
              current={enviadosDocs}
              total={totalDocs}
              tone={allSent ? "emerald" : "amber"}
            />
          )}
          {docs?.ultimoEm && enviadosDocs > 0 && (
            <DataRow label={t("timeline.common.ultimaAtividade")} value={fmtDate(docs.ultimoEm)} />
          )}
          {totalDocs > 0 && (
            <ExpandableDocList
              rows={docs?.rows ?? []}
              filter={(r) => !SENT_STATUSES.includes(r.status)}
              emptyText={t("timeline.stage3.panelTodosEnviados")}
              label={allSent ? t("timeline.stage3.panelLabelPendentes") : t("timeline.stage3.panelLabelFaltam")}
            />
          )}
        </StageCard>

        <StageCard icon={ShieldCheck} title={t("timeline.stages.4")} status={stAprovBrasil} deadline={dl(4)}>
          {enviadosDocs > 0 ? (
            <>
              <ProgressBlock
                label={t("timeline.stage4.progressoLabel")}
                current={aprovDocs}
                total={enviadosDocs}
                tone={fullyApproved ? "emerald" : rejDocs > 0 ? "rose" : "amber"}
              />
              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                <div className="rounded border border-border/60 px-1.5 py-1 text-center">
                  <div className="text-muted-foreground text-[10px]">{t("timeline.stage4.kpiEnviados")}</div>
                  <div className="font-semibold tabular-nums">{enviadosDocs}</div>
                </div>
                <div className="rounded border border-emerald-500/30 px-1.5 py-1 text-center">
                  <div className="text-muted-foreground text-[10px]">{t("timeline.stage4.kpiAprovados")}</div>
                  <div className="font-semibold tabular-nums text-emerald-400">{aprovDocs}</div>
                </div>
                <div className="rounded border border-rose-500/30 px-1.5 py-1 text-center">
                  <div className="text-muted-foreground text-[10px]">{t("timeline.stage4.kpiRejeitados")}</div>
                  <div className="font-semibold tabular-nums text-rose-400">{rejDocs}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground italic">{t("timeline.stage4.aguardandoEnvio")}</p>
          )}
          {submissao.aprovado_em && (
            <DataRow label={t("timeline.common.aprovadaEm")} value={fmtDate(submissao.aprovado_em)} />
          )}
          {enviadosDocs > 0 && (
            <GroupedSentDocList rows={docs?.rows ?? []} />
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

            <StageCard icon={ShoppingCart} title="5. Pedido (OC)" status={stPedido} deadline={dl(5)}>
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

            <StageCard icon={Factory} title="6. Produção" status={stProducao} deadline={dl(6)}>
              {ocLoaded ? (
                <>
                  <DataRow label="Apontado" value={`${fmtNum(qtyProduzida)} un.`} />
                  <DataRow label="Apontamentos" value={ocTimeline?.apontamentos?.length || 0} />
                </>
              ) : (
                <p className="text-muted-foreground italic">Sem produção registrada.</p>
              )}
            </StageCard>

            <StageCard icon={Ship} title="7. Embarque" status={stEmbarque} deadline={dl(7)}>
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

            <StageCard icon={Compass} title="8. Trânsito" status={stTransito} deadline={dl(8)}>
              <DataRow label="Origem" value={embarque?.porto_origem || "—"} />
              <DataRow label="Destino" value={embarque?.porto_destino || "—"} />
              <DataRow label="Chegada porto" value={fmtDate(oc?.data_chegada_porto)} />
            </StageCard>

            <StageCard icon={FileCheck2} title="9. Desembaraço" status={stDesemb} deadline={dl(9)}>
              <DataRow label="Chegada porto" value={fmtDate(oc?.data_chegada_porto)} />
              <DataRow label="Desembaraço" value={fmtDate(oc?.data_desembaraco)} />
            </StageCard>

            <StageCard icon={PackageCheck} title="10. Recebido no CD" status={stReceb} deadline={dl(10)}>
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
