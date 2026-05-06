import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShoppingCart, Factory, Ship, Compass, FileCheck2, PackageCheck,
  Link2, AlertOctagon, History, Inbox, ExternalLink, CheckCircle2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { useOCTimeline } from "@/hooks/useOCTimeline";
import { VincularBrasilDialog } from "@/components/compras/VincularBrasilDialog";
import { HistoricoRecebimentosInternacionalSheet } from "@/components/compras/HistoricoRecebimentosInternacionalSheet";
import { AbrirNCDialog } from "@/components/china/divergencias/AbrirNCDialog";
import { useNavigate } from "react-router-dom";
import type { InboxOC } from "@/hooks/useCompradorInboxOCs";

interface InboxOCReaderProps {
  oc: InboxOC | null;
}

const fmtNum = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n || 0);

function fmtDate(d: string | null | undefined): string {
  const parsed = parseLocalDate(d || null);
  if (!parsed) return "—";
  return format(parsed, "dd MMM yyyy", { locale: ptBR });
}

function StageCard({ icon: Icon, title, status, children }: { icon: any; title: string; status: "done" | "pending" | "atrasado" | "neutral"; children: React.ReactNode }) {
  const tone = {
    done: "border-l-emerald-500/60",
    pending: "border-l-amber-500/60",
    atrasado: "border-l-destructive",
    neutral: "border-l-border",
  }[status];
  const StatusIcon = status === "done" ? CheckCircle2 : Clock;
  const statusColor = {
    done: "text-emerald-500",
    pending: "text-amber-500",
    atrasado: "text-destructive",
    neutral: "text-muted-foreground",
  }[status];

  return (
    <Card className={cn("border-l-4 p-3 space-y-2", tone)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold flex-1">{title}</h4>
        <StatusIcon className={cn("h-4 w-4", statusColor)} />
      </div>
      <div className="text-xs space-y-1">{children}</div>
    </Card>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}

export function InboxOCReader({ oc }: InboxOCReaderProps) {
  const navigate = useNavigate();
  const [vincOpen, setVincOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [ncOpen, setNcOpen] = useState(false);
  const { data: timeline, isLoading } = useOCTimeline(oc?.ordem_compra_id || null);

  if (!oc) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={Inbox}
          title="Selecione uma OC"
          description="Escolha uma ordem na lista para ver os detalhes do pedido, produção, embarque e desembaraço."
        />
      </div>
    );
  }

  const totalApontado = (timeline?.apontamentos || []).reduce((acc, a) => acc + (a.quantidade || 0), 0);
  const embarque = timeline?.embarques?.[0];
  const recebimento = timeline?.recebimentos?.[0];
  const today = new Date().toISOString().slice(0, 10);

  const stPedido: "done" | "pending" = oc.oc_status !== "rascunho" ? "done" : "pending";
  const stProducao = oc.qty_produzida >= oc.qty_pedida ? "done" : oc.qty_produzida > 0 ? "pending" : "neutral";
  const stEmbarque = oc.qty_embarcada >= oc.qty_pedida ? "done" : oc.qty_embarcada > 0 ? "pending" : "neutral";
  const stTransito: any = oc.data_chegada_porto ? "done" : embarque?.data_eta ? "pending" : "neutral";
  const stDesemb = oc.data_desembaraco ? "done" : oc.data_chegada_porto ? "pending" : "neutral";
  const stReceb = oc.saldo_aberto <= 0 ? "done" : oc.qty_recebida > 0 ? "pending" : "neutral";
  const atrasada = oc.data_entrega_prevista && oc.data_entrega_prevista < today && oc.saldo_aberto > 0;

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold tabular-nums">{oc.numero_oc}</h2>
                <Badge variant="outline" className="uppercase text-[10px]">{oc.oc_status}</Badge>
                {atrasada && <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>}
                {oc.has_divergencia && <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">Divergência</Badge>}
              </div>
              <p className="text-sm font-medium mt-1 truncate">{oc.produto_nome}</p>
              <p className="text-xs text-muted-foreground">{oc.produto_codigo}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setVincOpen(true)}>
              <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular Brasil
            </Button>
            <Button size="sm" variant="outline" onClick={() => setHistOpen(true)}>
              <History className="h-3.5 w-3.5 mr-1" /> Histórico
            </Button>
            <Button size="sm" variant="outline" onClick={() => setNcOpen(true)}>
              <AlertOctagon className="h-3.5 w-3.5 mr-1" /> Abrir NC
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/fabrica-china/ordens/${oc.ordem_compra_id}`)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir OC
            </Button>
          </div>
        </div>

        <Tabs defaultValue="resumo" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 self-start">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
            <TabsTrigger value="acoes">Ações & deep links</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <KpiCard title="Pedido" value={fmtNum(oc.qty_pedida)} icon={ShoppingCart} variant="info" />
                  <KpiCard title="Produzido" value={fmtNum(oc.qty_produzida)} icon={Factory} variant="default" />
                  <KpiCard title="Embarcado" value={fmtNum(oc.qty_embarcada)} icon={Ship} variant="accent" />
                  <KpiCard title="Recebido" value={fmtNum(oc.qty_recebida)} subtitle={`Saldo ${fmtNum(oc.saldo_aberto)}`} icon={PackageCheck} variant={oc.saldo_aberto > 0 ? "warning" : "default"} />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Card className="p-3 space-y-1">
                    <div className="text-muted-foreground">Emissão</div>
                    <div className="font-medium">{fmtDate(oc.data_emissao)}</div>
                  </Card>
                  <Card className="p-3 space-y-1">
                    <div className="text-muted-foreground">Entrega prevista</div>
                    <div className={cn("font-medium", atrasada && "text-destructive")}>{fmtDate(oc.data_entrega_prevista)}</div>
                  </Card>
                  <Card className="p-3 space-y-1">
                    <div className="text-muted-foreground">Chegada porto</div>
                    <div className="font-medium">{fmtDate(oc.data_chegada_porto)}</div>
                  </Card>
                  <Card className="p-3 space-y-1">
                    <div className="text-muted-foreground">Recebido CD</div>
                    <div className="font-medium">{fmtDate(oc.data_recebimento_cd)}</div>
                  </Card>
                </div>
                {timeline && timeline.ncs.length > 0 && (
                  <Card className="p-3 border-l-4 border-l-amber-500/60 text-xs space-y-1">
                    <div className="font-semibold text-amber-700">{timeline.ncs.length} não conformidade(s) abertas</div>
                    <p className="text-muted-foreground">Use a aba Ações para abrir o painel de divergências.</p>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {isLoading ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Carregando linha do tempo...</p>
                ) : (
                  <>
                    <StageCard icon={ShoppingCart} title="1. Pedido" status={stPedido}>
                      <DataRow label="Emissão" value={fmtDate(oc.data_emissao)} />
                      <DataRow label="Entrega prevista" value={fmtDate(oc.data_entrega_prevista)} />
                      <DataRow label="EAN caixa master" value={timeline?.oc?.ean_caixa_master || "—"} />
                      {timeline?.oc?.aprovado_em && <DataRow label="Aprovado em" value={fmtDate(timeline.oc.aprovado_em)} />}
                    </StageCard>

                    <StageCard icon={Factory} title="2. Produção" status={stProducao}>
                      <DataRow label="Apontado" value={`${fmtNum(totalApontado)} un.`} />
                      <DataRow label="Apontamentos" value={timeline?.apontamentos?.length || 0} />
                      {timeline && timeline.apontamentos.length > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          {timeline.apontamentos.slice(0, 3).map((a: any) => (
                            <div key={a.id} className="flex justify-between text-[11px]">
                              <span className="text-muted-foreground">{fmtDate(a.data_producao)} · {a.cor_nome}</span>
                              <span className="tabular-nums font-medium">{fmtNum(a.quantidade)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </StageCard>

                    <StageCard icon={Ship} title="3. Embarque" status={stEmbarque}>
                      {embarque ? (
                        <>
                          <DataRow label="Modalidade" value={`${embarque.modalidade || "—"} · ${embarque.tipo_embarque || "—"}`} />
                          <DataRow label="Container" value={embarque.numero_container || "—"} />
                          <DataRow label="BL" value={embarque.numero_bl || "—"} />
                          <DataRow label="Navio" value={embarque.navio || "—"} />
                          <DataRow label="ETD" value={fmtDate(embarque.data_embarque)} />
                          <DataRow label="ETA" value={fmtDate(embarque.data_eta)} />
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">Nenhum embarque registrado.</p>
                      )}
                    </StageCard>

                    <StageCard icon={Compass} title="4. Trânsito" status={stTransito}>
                      <DataRow label="Origem" value={embarque?.porto_origem || "—"} />
                      <DataRow label="Destino" value={embarque?.porto_destino || "—"} />
                      <DataRow label="Chegada porto" value={fmtDate(oc.data_chegada_porto)} />
                    </StageCard>

                    <StageCard icon={FileCheck2} title="5. Desembaraço" status={stDesemb}>
                      <DataRow label="Chegada porto" value={fmtDate(oc.data_chegada_porto)} />
                      <DataRow label="Desembaraço" value={fmtDate(oc.data_desembaraco)} />
                      <DataRow label="SLA porto→CD" value={oc.sla_porto_cd_dias != null ? `${oc.sla_porto_cd_dias} dias` : "—"} />
                    </StageCard>

                    <StageCard icon={PackageCheck} title="6. Recebido" status={stReceb}>
                      <DataRow label="Recebido CD" value={fmtDate(oc.data_recebimento_cd)} />
                      <DataRow label="Avariado" value={fmtNum(oc.qty_avariada)} />
                      <DataRow label="Faltante" value={fmtNum(oc.qty_faltante)} />
                      {timeline && timeline.ncs.length > 0 && (
                        <p className="text-[11px] text-amber-600 mt-1">
                          {timeline.ncs.length} não conformidade(s) registrada(s).
                        </p>
                      )}
                    </StageCard>

                    <StageCard icon={Link2} title="7. Vínculos Brasil" status={timeline && timeline.vinculos.length > 0 ? "done" : "neutral"}>
                      {timeline && timeline.vinculos.length > 0 ? (
                        timeline.vinculos.map((v: any) => (
                          <DataRow
                            key={v.id}
                            label={v.fabrica_op_id ? "OP" : v.fabrica_compra_id ? "Compra MP" : "MP"}
                            value={`${fmtNum(Number(v.qty_alocada))} un.`}
                          />
                        ))
                      ) : (
                        <p className="text-muted-foreground italic">Nenhum vínculo Brasil ainda.</p>
                      )}
                    </StageCard>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="acoes" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Ações rápidas e atalhos para os módulos especializados desta OC.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="outline" className="justify-start" onClick={() => setVincOpen(true)}>
                    <Link2 className="h-4 w-4 mr-2" /> Vincular ao Brasil (OP/Compra MP)
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setHistOpen(true)}>
                    <History className="h-4 w-4 mr-2" /> Histórico de recebimentos
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setNcOpen(true)}>
                    <AlertOctagon className="h-4 w-4 mr-2" /> Abrir não conformidade
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate(`/dashboard/fabrica-china/ordens/${oc.ordem_compra_id}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Detalhe completo da OC
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate(`/dashboard/fabrica-china/recebimentos-oc?oc=${oc.ordem_compra_id}`)}>
                    <PackageCheck className="h-4 w-4 mr-2" /> Monitor de recebimentos
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate(`/dashboard/fabrica-china/recebimentos/divergencias?oc=${oc.ordem_compra_id}`)}>
                    <AlertOctagon className="h-4 w-4 mr-2" /> Divergências
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate(`/dashboard/fabrica-china/torre-containers?oc=${oc.ordem_compra_id}`)}>
                    <Ship className="h-4 w-4 mr-2" /> Torre de Containers
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate(`/dashboard/fabrica-china/patio-embarque?oc=${oc.ordem_compra_id}`)}>
                    <Ship className="h-4 w-4 mr-2" /> Pátio de Embarque
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <VincularBrasilDialog
        open={vincOpen}
        onOpenChange={setVincOpen}
        ocId={oc.ordem_compra_id}
        numeroOC={oc.numero_oc}
        itemDescricao={oc.produto_nome}
        qtyDisponivel={Number(oc.qty_recebida) || Number(oc.saldo_aberto) || 0}
        submissaoId={oc.submissao_id}
      />
      <HistoricoRecebimentosInternacionalSheet
        open={histOpen}
        onOpenChange={setHistOpen}
        ordemCompraId={oc.ordem_compra_id}
        numeroOC={oc.numero_oc}
      />
      <AbrirNCDialog
        open={ncOpen}
        onOpenChange={setNcOpen}
        ordemCompraIdInicial={oc.ordem_compra_id}
      />
    </>
  );
}
