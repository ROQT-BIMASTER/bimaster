import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, X, Ship, FileText, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ChinaInboxOC } from "@/hooks/useChinaInboxOCs";
import { ChinaOCEditPanel } from "./ChinaOCEditPanel";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  oc: ChinaInboxOC | null;
  onChanged: () => void;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseLocalDate(d)!, "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}
function fmtTs(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; }
}

export function ChinaOCReader({ oc, onChanged }: Props) {
  const { t } = useChinaI18n();
  const [busy, setBusy] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [embarqueOpen, setEmbarqueOpen] = useState(false);

  if (!oc) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
        {t("inboxOC.selecioneOC")}
      </div>
    );
  }

  const handleAceitar = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("rpc_china_aceitar_oc" as any, { p_oc_id: oc.ordem_compra_id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("inboxOC.okAceita"));
    onChanged();
  };

  const pct = oc.qty_total > 0 ? Math.round((oc.qty_produzida / oc.qty_total) * 100) : 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold tabular-nums">{oc.numero_oc}</h2>
              {oc.aceita_em && (
                <Badge variant="secondary" className="text-[10px]">{t("inboxOC.aceita")}</Badge>
              )}
              {oc.recusada_em && (
                <Badge variant="destructive" className="text-[10px]">{t("inboxOC.recusada")}</Badge>
              )}
              {oc.has_embarque && (
                <Badge className="text-[10px]"><Ship className="h-3 w-3 mr-1" />{oc.embarque_status}</Badge>
              )}
            </div>
            <div className="mt-1 text-sm">
              <span className="text-muted-foreground">{oc.produto_codigo}</span> · {oc.produto_nome}
            </div>
          </div>
        </div>

        <Card className="p-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground text-[10px] uppercase">{t("inboxOC.quantidade")}</div>
            <div className="font-semibold tabular-nums">{oc.qty_produzida} / {oc.qty_total}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase">{t("inboxOC.progresso")}</div>
            <div className="font-semibold tabular-nums">{pct}%</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" /> {t("inboxOC.emissao")}
            </div>
            <div className="font-semibold">{fmtDate(oc.data_emissao)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" /> {t("inboxOC.entregaPrevista")}
            </div>
            <div className="font-semibold">{fmtDate(oc.data_entrega_prevista)}</div>
          </div>
          {oc.has_embarque && (
            <>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase">{t("inboxOC.embarcadoEm")}</div>
                <div className="font-semibold">{fmtDate(oc.data_embarque)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase">{t("inboxOC.eta")}</div>
                <div className="font-semibold">{fmtDate(oc.data_eta)}</div>
              </div>
            </>
          )}
        </Card>

        {oc.aceita_em && (
          <div className="text-[11px] text-muted-foreground">
            {t("inboxOC.aceitaEm")} {fmtTs(oc.aceita_em)}
          </div>
        )}
        {oc.recusada_em && (
          <Card className="p-2 border-destructive/40 bg-destructive/5 text-xs">
            <div className="font-medium">{t("inboxOC.recusadaEm")} {fmtTs(oc.recusada_em)}</div>
            <div className="text-muted-foreground mt-0.5">{oc.motivo_recusa}</div>
          </Card>
        )}

        <Separator />

        {/* Ações por estado */}
        <div className="flex flex-wrap gap-2">
          {!oc.aceita_em && !oc.recusada_em && (
            <>
              <Button size="sm" onClick={handleAceitar} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t("inboxOC.aceitarOC")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRecusarOpen(true)} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                {t("inboxOC.recusar")}
              </Button>
            </>
          )}
          {oc.aceita_em && !oc.has_embarque && (
            <Button size="sm" onClick={() => setEmbarqueOpen(true)} className="gap-1.5">
              <Ship className="h-3.5 w-3.5" />
              {t("inboxOC.confirmarEmbarque")}
            </Button>
          )}
        </div>

        {oc.observacoes && (
          <Card className="p-2 text-xs bg-muted/30">
            <div className="text-muted-foreground text-[10px] uppercase mb-1">{t("inboxOC.observacoesOC")}</div>
            <div className="whitespace-pre-wrap">{oc.observacoes}</div>
          </Card>
        )}

        <ChinaOCEditPanel oc={oc} onChanged={onChanged} />
      </div>

      <RecusarDialog
        open={recusarOpen}
        onOpenChange={setRecusarOpen}
        ocId={oc.ordem_compra_id}
        onDone={onChanged}
      />
      <ConfirmarEmbarqueDialog
        open={embarqueOpen}
        onOpenChange={setEmbarqueOpen}
        ocId={oc.ordem_compra_id}
        onDone={onChanged}
      />
    </ScrollArea>
  );
}

function RecusarDialog({
  open, onOpenChange, ocId, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; ocId: string; onDone: () => void }) {
  const { t } = useChinaI18n();
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!motivo.trim()) { toast.error(t("inboxOC.errMotivoRecusa")); return; }
    setBusy(true);
    const { error } = await supabase.rpc("rpc_china_recusar_oc" as any, {
      p_oc_id: ocId, p_motivo: motivo.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("inboxOC.okRecusada"));
    onDone();
    onOpenChange(false);
    setMotivo("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("inboxOC.recusarTitulo")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">{t("inboxOC.motivoObrigatorio")}</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("inboxOC.cancelar")}</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} {t("inboxOC.recusar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmarEmbarqueDialog({
  open, onOpenChange, ocId, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; ocId: string; onDone: () => void }) {
  const { t } = useChinaI18n();
  const [container, setContainer] = useState("");
  const [bl, setBl] = useState("");
  const [navio, setNavio] = useState("");
  const [portoOrigem, setPortoOrigem] = useState("");
  const [portoDestino, setPortoDestino] = useState("");
  const [dataEmb, setDataEmb] = useState("");
  const [dataEta, setDataEta] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!container.trim() || !dataEmb || !dataEta) {
      toast.error(t("inboxOC.errEmbarqueObrig"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("rpc_china_confirmar_embarque" as any, {
      p_oc_id: ocId,
      p_numero_container: container.trim(),
      p_numero_bl: bl.trim() || null,
      p_data_embarque: dataEmb,
      p_data_eta: dataEta,
      p_navio: navio.trim() || null,
      p_porto_origem: portoOrigem.trim() || null,
      p_porto_destino: portoDestino.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("inboxOC.okEmbarque"));
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("inboxOC.confirmarEmbTitulo")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">{t("inboxOC.numContainer")} *</Label>
            <Input value={container} onChange={(e) => setContainer(e.target.value)} placeholder="MSCU1234567" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">{t("inboxOC.bl")}</Label>
            <Input value={bl} onChange={(e) => setBl(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("inboxOC.dataEmbarque")} *</Label>
            <Input type="date" value={dataEmb} onChange={(e) => setDataEmb(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("inboxOC.eta")} *</Label>
            <Input type="date" value={dataEta} onChange={(e) => setDataEta(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("inboxOC.navio")}</Label>
            <Input value={navio} onChange={(e) => setNavio(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("inboxOC.portoOrigem")}</Label>
            <Input value={portoOrigem} onChange={(e) => setPortoOrigem(e.target.value)} placeholder="Shanghai" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">{t("inboxOC.portoDestino")}</Label>
            <Input value={portoDestino} onChange={(e) => setPortoDestino(e.target.value)} placeholder="Santos" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("inboxOC.cancelar")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} {t("inboxOC.confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
