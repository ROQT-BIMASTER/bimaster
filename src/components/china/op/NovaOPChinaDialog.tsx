import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, AlertTriangle, Factory } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCriarOPChina } from "@/hooks/useChinaOrdensProducao";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Submissão pré-selecionada (opcional). */
  defaultSubmissaoId?: string;
}

/**
 * Dialog padrão China para criar Ordem de Produção.
 * Regras: submissão obrigatória, OC opcional. Sem OC -> notifica comprador.
 */
export function NovaOPChinaDialog({ open, onOpenChange, defaultSubmissaoId }: Props) {
  const [search, setSearch] = useState("");
  const [submissaoId, setSubmissaoId] = useState<string>(defaultSubmissaoId || "");
  const [ocId, setOcId] = useState<string>("");
  const [qty, setQty] = useState("");
  const [lote, setLote] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [obs, setObs] = useState("");

  const criar = useCriarOPChina();

  useEffect(() => {
    if (!open) {
      setSearch(""); setOcId(""); setQty(""); setLote("");
      setDataInicio(""); setDataPrevista(""); setObs("");
      if (!defaultSubmissaoId) setSubmissaoId("");
    } else if (defaultSubmissaoId) {
      setSubmissaoId(defaultSubmissaoId);
    }
  }, [open, defaultSubmissaoId]);

  // Busca submissões aprovadas/em produção
  const { data: submissoes = [], isFetching: loadingSubs } = useQuery({
    queryKey: ["china-submissoes-busca-op", search],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("id, numero_ordem, produto_codigo, produto_nome, qty_total, status")
        .or(
          `numero_ordem.ilike.%${search}%,produto_codigo.ilike.%${search}%,produto_nome.ilike.%${search}%`,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Submissão selecionada (mesmo se não veio na busca atual)
  const { data: submissaoSel } = useQuery({
    queryKey: ["china-submissao-detalhe", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_submissoes" as any)
        .select("id, numero_ordem, produto_codigo, produto_nome, qty_total, status")
        .eq("id", submissaoId)
        .maybeSingle();
      return data as any;
    },
  });

  // OCs disponíveis para essa submissão
  const { data: ocs = [] } = useQuery({
    queryKey: ["china-ocs-da-submissao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_ordens_compra" as any)
        .select("id, numero_oc, status, qty_total, qty_produzida")
        .eq("submissao_id", submissaoId)
        .in("status", ["aprovada", "emitida", "em_producao", "parcial"])
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    if (submissaoSel && !qty) setQty(String(submissaoSel.qty_total || ""));
  }, [submissaoSel]); // eslint-disable-line

  const semOC = useMemo(() => !ocId, [ocId]);

  const podeSalvar =
    !!submissaoId && Number(qty) > 0 && !criar.isPending;

  const handleSalvar = async () => {
    if (!podeSalvar) return;
    await criar.mutateAsync({
      submissao_id: submissaoId,
      qty: Number(qty),
      oc_id: ocId || null,
      lote: lote || null,
      data_inicio: dataInicio || null,
      data_prevista: dataPrevista || null,
      obs: obs || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary" />
            Nova Ordem de Produção · 新生产订单
          </DialogTitle>
          <DialogDescription>
            Submissão é obrigatória. Vincular OC é opcional — sem OC, o comprador será notificado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Submissão */}
          {!defaultSubmissaoId && (
            <div>
              <Label className="text-xs">
                Submissão / 提交 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nº ordem, código ou nome do produto…"
                  className="pl-7 h-9"
                />
              </div>
              {loadingSubs && (
                <div className="text-xs text-muted-foreground mt-1">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> Buscando…
                </div>
              )}
              {(submissoes as any[]).length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto border border-border rounded-md divide-y divide-border">
                  {(submissoes as any[]).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubmissaoId(s.id)}
                      className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center justify-between ${
                        submissaoId === s.id ? "bg-accent" : ""
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono">{s.numero_ordem || "—"}</span>
                        {" · "}
                        <span className="font-mono">{s.produto_codigo}</span>
                        {" · "}
                        {s.produto_nome}
                      </span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{s.status}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {submissaoSel && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="font-medium text-foreground">
                {submissaoSel.numero_ordem} · {submissaoSel.produto_codigo} — {submissaoSel.produto_nome}
              </div>
              <div className="text-muted-foreground mt-0.5">
                Qty submissão: {submissaoSel.qty_total?.toLocaleString()} · Status: {submissaoSel.status}
              </div>
            </div>
          )}

          {/* OC opcional */}
          <div>
            <Label className="text-xs">Ordem de Compra (opcional) / 采购订单（可选）</Label>
            <Select
              value={ocId || "none"}
              onValueChange={(v) => setOcId(v === "none" ? "" : v)}
              disabled={!submissaoId}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="— sem OC vinculada —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— sem OC vinculada —</SelectItem>
                {(ocs as any[]).map((oc) => (
                  <SelectItem key={oc.id} value={oc.id}>
                    {oc.numero_oc} · {oc.status} · {oc.qty_produzida ?? 0}/{oc.qty_total}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {semOC && submissaoId && (
              <Alert variant="default" className="mt-2 py-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">
                  Sem OC vinculada — o comprador responsável receberá uma notificação no inbox.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Quantidade / Lote / Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quantidade <span className="text-destructive">*</span></Label>
              <Input
                type="number" min="1" value={qty}
                onChange={(e) => setQty(e.target.value)} className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Lote / 批号</Label>
              <Input
                value={lote} onChange={(e) => setLote(e.target.value)}
                placeholder="LDS-…" className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Data início / 开始日期</Label>
              <Input
                type="date" value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)} className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Data prevista / 预计完成</Label>
              <Input
                type="date" value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)} className="h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações / 备注</Label>
            <Textarea
              value={obs} onChange={(e) => setObs(e.target.value)}
              rows={2} placeholder="Observações bilíngues…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={!podeSalvar}>
            {criar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Criar OP / 创建生产单
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
