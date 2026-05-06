import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Factory, ShoppingBag, Package, Sparkles, X, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCriarVinculo } from "@/hooks/useComprasInternacionalVinculos";
import { useSubmissaoProjetosOPs } from "@/hooks/useSubmissaoProjetosOPs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ocId: string;
  numeroOC: string;
  itemId?: string;
  itemDescricao?: string;
  qtyDisponivel: number;
  submissaoId?: string;
}

type OPSelectionSource = "sugestao_auto" | "sugestao_clique" | "select_manual" | "limpar";

async function logOPSelection(params: {
  source: OPSelectionSource;
  opId: string | null;
  ocId: string;
  itemId?: string;
  submissaoId?: string;
  numeroOC: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_logs" as any).insert({
      user_id: user.id,
      action: `vincular_brasil.op_${params.source}`,
      entity_type: "china_ordem_compra",
      entity_id: params.ocId,
      metadata: {
        source: params.source,
        op_id: params.opId,
        item_id: params.itemId ?? null,
        submissao_id: params.submissaoId ?? null,
        numero_oc: params.numeroOC,
      },
    });
  } catch {
    // auditoria best-effort
  }
}

export function VincularBrasilDialog({
  open,
  onOpenChange,
  ocId,
  numeroOC,
  itemId,
  itemDescricao,
  qtyDisponivel,
  submissaoId,
}: Props) {
  const [tipo, setTipo] = useState<"op" | "compra" | "mp">("op");
  const [opId, setOpId] = useState<string>("");
  const [compraId, setCompraId] = useState<string>("");
  const [mpId, setMpId] = useState<string>("");
  const [qty, setQty] = useState<number>(qtyDisponivel);
  const [obs, setObs] = useState("");
  const criar = useCriarVinculo();

  const { data: sugestoes = [], isLoading: loadingSugestoes } = useSubmissaoProjetosOPs(
    open ? submissaoId : undefined,
  );
  const sugestoesComOps = sugestoes.filter((s) => s.ops.length > 0);
  const sugestaoFlat = sugestoesComOps.flatMap((s) => s.ops);
  const temProjetosSemOps = sugestoes.length > 0 && sugestoesComOps.length === 0;

  // Auto-preenche quando há exatamente uma OP sugerida e o usuário ainda não escolheu nada
  useEffect(() => {
    if (open && tipo === "op" && !opId && sugestaoFlat.length === 1) {
      const auto = sugestaoFlat[0];
      setOpId(auto.id);
      logOPSelection({
        source: "sugestao_auto",
        opId: auto.id,
        ocId,
        itemId,
        submissaoId,
        numeroOC,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sugestaoFlat.length]);

  const { data: ops = [], isLoading: loadingOps } = useQuery({
    queryKey: ["fabrica-ops-aberto"],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_ordens_producao" as any)
        .select("id, numero, status, quantidade_planejada")
        .in("status", ["pendente", "em_andamento", "planejada"])
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
  });

  const { data: compras = [] } = useQuery({
    queryKey: ["fabrica-compras-aberto"],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_compras" as any)
        .select("id, nota_fiscal, data_pedido, status")
        .neq("status", "recebido_total")
        .order("data_pedido", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
  });

  const { data: mps = [] } = useQuery({
    queryKey: ["fabrica-mps-list"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_materias_primas" as any)
        .select("id, nome, codigo")
        .order("nome")
        .limit(200);
      return (data || []) as any[];
    },
  });

  const handleUsarSugestao = useCallback(
    (id: string) => {
      setOpId(id);
      logOPSelection({ source: "sugestao_clique", opId: id, ocId, itemId, submissaoId, numeroOC });
    },
    [ocId, itemId, submissaoId, numeroOC],
  );

  const handleSelectManual = useCallback(
    (id: string) => {
      setOpId(id);
      logOPSelection({ source: "select_manual", opId: id, ocId, itemId, submissaoId, numeroOC });
    },
    [ocId, itemId, submissaoId, numeroOC],
  );

  const handleLimpar = useCallback(() => {
    if (!opId) return;
    setOpId("");
    logOPSelection({ source: "limpar", opId: null, ocId, itemId, submissaoId, numeroOC });
  }, [opId, ocId, itemId, submissaoId, numeroOC]);

  const handleSubmit = async () => {
    await criar.mutateAsync({
      china_ordem_compra_id: ocId,
      china_ordem_item_id: itemId,
      fabrica_op_id: tipo === "op" ? opId || undefined : undefined,
      fabrica_compra_id: tipo === "compra" ? compraId || undefined : undefined,
      fabrica_mp_id: tipo === "mp" ? mpId || undefined : undefined,
      qty_alocada: qty,
      observacoes: obs,
    });
    onOpenChange(false);
    setOpId(""); setCompraId(""); setMpId(""); setObs("");
  };

  const podeSubmeter =
    qty > 0 && ((tipo === "op" && opId) || (tipo === "compra" && compraId) || (tipo === "mp" && mpId));

  const semOpsDisponiveis = !loadingOps && ops.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular ao Brasil
          </DialogTitle>
          <DialogDescription>
            OC <strong>{numeroOC}</strong>
            {itemDescricao && <> · {itemDescricao}</>} · Disponível:{" "}
            <strong className="text-primary">{qtyDisponivel}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="op"><Factory className="h-3.5 w-3.5 mr-1" /> OP Brasil</TabsTrigger>
            <TabsTrigger value="compra"><ShoppingBag className="h-3.5 w-3.5 mr-1" /> Compra</TabsTrigger>
            <TabsTrigger value="mp"><Package className="h-3.5 w-3.5 mr-1" /> Estoque</TabsTrigger>
          </TabsList>

          <TabsContent value="op" className="space-y-2 pt-3">
            {sugestoesComOps.length > 0 && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Sugestão automática (mesmo projeto da submissão)
                </div>
                {sugestoesComOps.map((s) => (
                  <div key={s.projeto_id} className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">
                      Projeto <strong className="text-foreground">{s.projeto_nome}</strong> · {s.ops.length} OP{s.ops.length > 1 ? "s" : ""} em aberto
                    </div>
                    <div className="space-y-1">
                      {s.ops.slice(0, 5).map((op) => (
                        <div
                          key={op.id}
                          className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-[11px]"
                        >
                          <span className="truncate">
                            <strong>{op.numero}</strong>
                            <span className="text-muted-foreground"> · {op.status} · {op.quantidade_planejada ?? 0}</span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={opId === op.id ? "default" : "outline"}
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleUsarSugestao(op.id)}
                            disabled={semOpsDisponiveis}
                          >
                            {opId === op.id ? "Selecionada" : "Usar esta OP"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {temProjetosSemOps && !loadingSugestoes && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2 text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-700 dark:text-amber-300">
                    Projeto vinculado, mas sem OP em aberto
                  </div>
                  <div className="text-muted-foreground">
                    Os projetos da submissão não possuem Ordens de Produção pendentes ou em andamento. Crie uma OP no módulo Fábrica ou selecione uma OP avulsa abaixo.
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Selecione a Ordem de Produção</Label>
              {opId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={handleLimpar}
                >
                  <X className="h-3 w-3" /> Limpar seleção
                </Button>
              )}
            </div>
            <Select value={opId} onValueChange={handleSelectManual} disabled={semOpsDisponiveis}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingOps
                      ? "Carregando OPs…"
                      : semOpsDisponiveis
                      ? "Nenhuma OP em aberto disponível"
                      : "Escolha uma OP em aberto"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {ops.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.numero} · {op.status} · {op.quantidade_planejada}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {semOpsDisponiveis && (
              <p className="text-[10px] text-muted-foreground">
                Não há Ordens de Produção pendentes, planejadas ou em andamento. Crie uma no módulo Fábrica antes de vincular.
              </p>
            )}
          </TabsContent>

          <TabsContent value="compra" className="space-y-2 pt-3">
            <Label className="text-xs">Selecione a Compra Nacional</Label>
            <Select value={compraId} onValueChange={setCompraId}>
              <SelectTrigger><SelectValue placeholder="Escolha uma compra" /></SelectTrigger>
              <SelectContent>
                {compras.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    NF {c.nota_fiscal || "—"} · {c.data_pedido} · {c.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>

          <TabsContent value="mp" className="space-y-2 pt-3">
            <Label className="text-xs">Selecione a Matéria-prima</Label>
            <Select value={mpId} onValueChange={setMpId}>
              <SelectTrigger><SelectValue placeholder="Escolha uma matéria-prima" /></SelectTrigger>
              <SelectContent>
                {mps.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>
                    {mp.codigo ? `${mp.codigo} · ` : ""}{mp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Quantidade alocada</Label>
            <Input
              type="number"
              min={0}
              max={qtyDisponivel}
              value={qty}
              onChange={(e) =>
                setQty(Math.min(qtyDisponivel, Math.max(0, Number(e.target.value) || 0)))
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criar.isPending || !podeSubmeter}>
            {criar.isPending ? "Vinculando..." : "Criar vínculo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
