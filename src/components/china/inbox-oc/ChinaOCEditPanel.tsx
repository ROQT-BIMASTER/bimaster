import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Save, Pencil, Calendar, FileText, AlertTriangle, History, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChinaOrdemItens, type ChinaOrdemItem } from "@/hooks/useChinaOrdemItens";
import { ChinaPastaDigitalPanel } from "@/components/china/ChinaPastaDigitalPanel";
import { useNaoConformidades, useAbrirNCManual } from "@/hooks/useChinaNaoConformidades";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import type { ChinaInboxOC } from "@/hooks/useChinaInboxOCs";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  oc: ChinaInboxOC;
  onChanged: () => void;
}

type Phase = "pendente" | "producao" | "bloqueado";

function getPhase(oc: ChinaInboxOC): Phase {
  if (!oc.aceita_em && !oc.recusada_em) return "pendente";
  if (oc.aceita_em && !oc.has_embarque && !oc.data_entrega_real) return "producao";
  return "bloqueado";
}

export function ChinaOCEditPanel({ oc, onChanged }: Props) {
  const { t } = useChinaI18n();
  const phase = getPhase(oc);
  const editavel = phase !== "bloqueado";
  const tem_submissao = !!oc.submissao_id;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{t("inboxOC.painelEdicao")}</span>
          <Badge variant={phase === "pendente" ? "warning" : phase === "producao" ? "secondary" : "outline"} className="text-[10px]">
            {phase === "pendente" ? t("inboxOC.phasePendente") : phase === "producao" ? t("inboxOC.phaseProducao") : t("inboxOC.phaseSomenteLeitura")}
          </Badge>
        </div>
      </div>
      <Tabs defaultValue="itens" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9 px-2">
          <TabsTrigger value="itens" className="text-xs">{t("inboxOC.tabItens")}</TabsTrigger>
          <TabsTrigger value="logistica" className="text-xs">{t("inboxOC.tabLogistica")}</TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs" disabled={!tem_submissao}>{t("inboxOC.tabDocumentos")}</TabsTrigger>
          <TabsTrigger value="ncs" className="text-xs">{t("inboxOC.tabNCs")}</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">{t("inboxOC.tabHistorico")}</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="m-0 p-3">
          <ItensTab oc={oc} phase={phase} editavel={editavel} onChanged={onChanged} />
        </TabsContent>

        <TabsContent value="logistica" className="m-0 p-3">
          <LogisticaTab oc={oc} phase={phase} editavel={editavel} onChanged={onChanged} />
        </TabsContent>

        <TabsContent value="documentos" className="m-0 p-0">
          {tem_submissao ? (
            <div className="max-h-[480px] overflow-auto">
              <ChinaPastaDigitalPanel submissaoId={oc.submissao_id!} />
            </div>
          ) : (
            <div className="p-6 text-xs text-muted-foreground text-center">
              {t("inboxOC.ocSemSubmissao")}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ncs" className="m-0 p-3">
          <NCsTab oc={oc} />
        </TabsContent>

        <TabsContent value="historico" className="m-0 p-3">
          <HistoricoTab ocId={oc.ordem_compra_id} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ---------------- ITENS ----------------
function ItensTab({ oc, phase, editavel, onChanged }: { oc: ChinaInboxOC; phase: Phase; editavel: boolean; onChanged: () => void }) {
  const { t } = useChinaI18n();
  const { data: itens = [], isLoading, refetch } = useChinaOrdemItens(oc.ordem_compra_id);
  const [drafts, setDrafts] = useState<Record<string, { qty_pedida: string; preco_unitario_usd: string }>>({});
  const [busy, setBusy] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cancelarTarget, setCancelarTarget] = useState<ChinaOrdemItem | null>(null);

  useEffect(() => {
    const d: typeof drafts = {};
    itens.forEach((i) => {
      d[i.id] = {
        qty_pedida: String(i.qty_pedida),
        preco_unitario_usd: i.preco_unitario_usd != null ? String(i.preco_unitario_usd) : "",
      };
    });
    setDrafts(d);
  }, [itens]);

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (itens.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-6">{t("inboxOC.semItens")}</div>;
  }

  const dirty = itens.some((i) => {
    const d = drafts[i.id];
    if (!d) return false;
    return Number(d.qty_pedida) !== i.qty_pedida || (d.preco_unitario_usd || null) !== (i.preco_unitario_usd != null ? String(i.preco_unitario_usd) : "");
  });

  const salvar = async () => {
    setBusy(true);
    const payload = itens
      .filter((i) => {
        const d = drafts[i.id];
        return Number(d.qty_pedida) !== i.qty_pedida || (d.preco_unitario_usd || "") !== (i.preco_unitario_usd != null ? String(i.preco_unitario_usd) : "");
      })
      .map((i) => ({
        id: i.id,
        qty_pedida: Number(drafts[i.id].qty_pedida) || 0,
        preco_unitario_usd: drafts[i.id].preco_unitario_usd ? Number(drafts[i.id].preco_unitario_usd) : null,
      }));

    const { error } = await supabase.rpc("rpc_china_oc_editar_itens_pendente" as any, {
      p_oc_id: oc.ordem_compra_id,
      p_itens: payload,
      p_motivo: motivo.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("inboxOC.okItensAtualizados"));
    setMotivo("");
    refetch();
    onChanged();
  };

  return (
    <div className="space-y-3">
      {!editavel && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1.5 rounded">
          {t("inboxOC.edicaoBloqueada")}
        </div>
      )}
      {phase === "producao" && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1.5 rounded">
          {t("inboxOC.ocEmProducaoAviso")}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground border-b">
            <tr>
              <th className="text-left py-1.5 px-2">{t("inboxOC.skuCor")}</th>
              <th className="text-right py-1.5 px-2">{t("inboxOC.qtdPedida")}</th>
              <th className="text-right py-1.5 px-2">{t("inboxOC.produzida")}</th>
              <th className="text-right py-1.5 px-2">{t("inboxOC.cancelada")}</th>
              <th className="text-right py-1.5 px-2">{t("inboxOC.precoUSD")}</th>
              <th className="text-right py-1.5 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className="border-b last:border-b-0">
                <td className="py-1.5 px-2">
                  <div className="font-medium">{i.sku || i.produto_codigo}</div>
                  {i.cor_nome && <div className="text-[10px] text-muted-foreground">{i.cor_nome}</div>}
                </td>
                <td className="py-1.5 px-2 text-right">
                  {phase === "pendente" ? (
                    <Input
                      type="number"
                      className="h-7 w-20 text-right text-xs ml-auto"
                      value={drafts[i.id]?.qty_pedida ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [i.id]: { ...d[i.id], qty_pedida: e.target.value } }))}
                    />
                  ) : (
                    <span className="tabular-nums">{i.qty_pedida}</span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">{i.qty_produzida}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{i.qty_cancelada}</td>
                <td className="py-1.5 px-2 text-right">
                  {phase === "pendente" ? (
                    <Input
                      type="number"
                      step="0.0001"
                      className="h-7 w-24 text-right text-xs ml-auto"
                      value={drafts[i.id]?.preco_unitario_usd ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [i.id]: { ...d[i.id], preco_unitario_usd: e.target.value } }))}
                    />
                  ) : (
                    <span className="tabular-nums">{i.preco_unitario_usd ?? "—"}</span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right">
                  {phase === "producao" && (
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => setCancelarTarget(i)}>
                      <Scissors className="h-3 w-3" /> {t("inboxOC.cancelarSaldo")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {phase === "pendente" && (
        <div className="space-y-2 pt-2 border-t">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">{t("inboxOC.motivoAlteracao")}</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="text-xs" />
          </div>
          <Button size="sm" disabled={!dirty || busy} onClick={salvar} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("inboxOC.salvarAlteracoes")}
          </Button>
        </div>
      )}

      <CancelarSaldoDialog
        item={cancelarTarget}
        onClose={() => setCancelarTarget(null)}
        onDone={() => { refetch(); onChanged(); }}
      />
    </div>
  );
}

function CancelarSaldoDialog({ item, onClose, onDone }: { item: ChinaOrdemItem | null; onClose: () => void; onDone: () => void }) {
  const { t } = useChinaI18n();
  const [qty, setQty] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) { setQty(""); setMotivo(""); }
  }, [item?.id]);

  if (!item) return null;
  const saldo = Math.max(0, item.qty_pedida - item.qty_recebida - item.qty_cancelada);

  const submit = async () => {
    const n = Number(qty);
    if (!n || n <= 0) { toast.error(t("inboxOC.errQtdValida")); return; }
    if (n > saldo) { toast.error(t("inboxOC.errMaximo", { n: saldo })); return; }
    if (!motivo.trim()) { toast.error(t("inboxOC.errMotivoObrig")); return; }
    setBusy(true);
    const { error } = await supabase.rpc("rpc_china_oc_cancelar_saldo_item" as any, {
      p_item_id: item.id, p_qty_cancelar: n, p_motivo: motivo.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("inboxOC.okSaldoCancelado"));
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("inboxOC.cancelarSaldoTitulo")} · {item.sku || item.produto_codigo}</DialogTitle>
          <DialogDescription>{t("inboxOC.saldoDisponivel")}: {saldo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">{t("inboxOC.qtdCancelar")}</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} max={saldo} />
          </div>
          <div>
            <Label className="text-xs">{t("inboxOC.motivo")}</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("inboxOC.cancelar")}</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} {t("inboxOC.cancelarSaldo")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- LOGÍSTICA ----------------
function LogisticaTab({ oc, phase, editavel, onChanged }: { oc: ChinaInboxOC; phase: Phase; editavel: boolean; onChanged: () => void }) {
  const { t } = useChinaI18n();
  const [data, setData] = useState(oc.data_entrega_prevista || "");
  const [obs, setObs] = useState(oc.observacoes || "");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setData(oc.data_entrega_prevista || "");
    setObs(oc.observacoes || "");
  }, [oc.ordem_compra_id]);

  const dirty = data !== (oc.data_entrega_prevista || "") || obs !== (oc.observacoes || "");

  const salvar = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("rpc_china_oc_atualizar_logistica" as any, {
      p_oc_id: oc.ordem_compra_id,
      p_data_entrega_prevista: data || null,
      p_observacoes: obs || null,
      p_motivo: motivo.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("inboxOC.okLogisticaAtualizada"));
    setMotivo("");
    onChanged();
  };

  return (
    <div className="space-y-3">
      {!editavel && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1.5 rounded">
          {t("inboxOC.ocEmbarcadaSomenteLeitura")}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {t("inboxOC.dataPrevistaEntrega")}
          </Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={!editavel} className="h-8 text-xs" />
        </div>
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t("inboxOC.obsProducao")}</Label>
        <Textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} disabled={!editavel} className="text-xs" />
      </div>
      {editavel && (
        <>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">{t("inboxOC.motivoOpcional")}</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="text-xs" />
          </div>
          <Button size="sm" disabled={!dirty || busy} onClick={salvar} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("inboxOC.salvar")}
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------- NCs ----------------
function NCsTab({ oc }: { oc: ChinaInboxOC }) {
  const { t } = useChinaI18n();
  const { data: ncs = [], isLoading, refetch } = useNaoConformidades({ ordemId: oc.ordem_compra_id });
  const abrir = useAbrirNCManual();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"qualidade" | "atraso" | "faltante" | "avariado" | "errado" | "outro">("qualidade");
  const [severidade, setSeveridade] = useState<"baixa" | "media" | "alta" | "critica">("media");
  const [descricao, setDescricao] = useState("");

  const submit = async () => {
    if (!descricao.trim()) { toast.error(t("inboxOC.errDescObrig")); return; }
    await abrir.mutateAsync({
      ordem_compra_id: oc.ordem_compra_id, tipo, severidade, descricao: descricao.trim(),
    });
    setOpen(false); setDescricao("");
    refetch();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{t("inboxOC.registros", { n: ncs.length })}</div>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setOpen(true)}>
          <AlertTriangle className="h-3 w-3" /> {t("inboxOC.novaNC")}
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : ncs.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">{t("inboxOC.semNCs")}</div>
      ) : (
        <div className="space-y-1.5">
          {ncs.map((nc: any) => (
            <Card key={nc.id} className="p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{nc.numero_nc}</span>
                  <Badge variant="outline" className="text-[10px]">{nc.tipo}</Badge>
                  <Badge variant={nc.severidade === "critica" || nc.severidade === "alta" ? "destructive" : "secondary"} className="text-[10px]">
                    {nc.severidade}
                  </Badge>
                </div>
                <Badge variant="outline" className="text-[10px]">{nc.status}</Badge>
              </div>
              <div className="mt-1 text-muted-foreground">{nc.descricao}</div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("inboxOC.novaNCTitulo")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t("inboxOC.tipo")}</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-xs" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                <option value="qualidade">{t("inboxOC.ncQualidade")}</option>
                <option value="atraso">{t("inboxOC.ncAtraso")}</option>
                <option value="faltante">{t("inboxOC.ncFaltante")}</option>
                <option value="avariado">{t("inboxOC.ncAvariado")}</option>
                <option value="errado">{t("inboxOC.ncErrado")}</option>
                <option value="outro">{t("inboxOC.ncOutro")}</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">{t("inboxOC.severidade")}</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-xs" value={severidade} onChange={(e) => setSeveridade(e.target.value as any)}>
                <option value="baixa">{t("inboxOC.sevBaixa")}</option>
                <option value="media">{t("inboxOC.sevMedia")}</option>
                <option value="alta">{t("inboxOC.sevAlta")}</option>
                <option value="critica">{t("inboxOC.sevCritica")}</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{t("inboxOC.descricao")}</Label>
              <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("inboxOC.cancelar")}</Button>
            <Button onClick={submit} disabled={abrir.isPending}>
              {abrir.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} {t("inboxOC.abrirNC")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- HISTÓRICO ----------------
function HistoricoTab({ ocId }: { ocId: string }) {
  const { t } = useChinaI18n();
  const { data: versoes = [], isLoading } = useQuery({
    queryKey: ["china-oc-versoes", ocId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_oc_versoes" as any)
        .select("id, versao, marco, motivo, created_at, created_by")
        .eq("ordem_compra_id", ocId)
        .order("versao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (versoes.length === 0) return <div className="text-xs text-muted-foreground text-center py-4">{t("inboxOC.semVersoes")}</div>;

  const marcoLabel: Record<string, string> = {
    edicao_pendente_antes: t("inboxOC.marcoEdicaoPendenteAntes"),
    edicao_pendente_depois: t("inboxOC.marcoEdicaoPendenteDepois"),
    edicao_logistica: t("inboxOC.marcoEdicaoLogistica"),
    cancelamento_saldo_parcial: t("inboxOC.marcoCancelamentoSaldo"),
    aceite: t("inboxOC.marcoAceite"),
    embarque: t("inboxOC.marcoEmbarque"),
  };

  return (
    <ScrollArea className="max-h-[360px]">
      <div className="space-y-1.5">
        {versoes.map((v: any) => (
          <div key={v.id} className="flex items-start gap-2 text-xs border-l-2 border-muted pl-2 py-1">
            <History className="h-3 w-3 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">v{v.versao}</Badge>
                <span className="font-medium">{marcoLabel[v.marco] || v.marco}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                {v.motivo ? ` · ${v.motivo}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
