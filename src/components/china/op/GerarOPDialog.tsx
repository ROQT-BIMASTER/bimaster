import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGerarOPDaOC, useVincularOPExistente } from "@/hooks/useGerarOPDaOC";
import { Loader2, Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ocId: string;
  ocNumero: string;
  produtoCodigo?: string;
  produtoNome?: string;
  qtySugerida?: number;
}

export function GerarOPDialog({
  open, onOpenChange, ocId, ocNumero, produtoCodigo, produtoNome, qtySugerida,
}: Props) {
  const [tab, setTab] = useState<"gerar" | "vincular">("gerar");

  // Form state
  const [produtoId, setProdutoId] = useState<string>("");
  const [formulaId, setFormulaId] = useState<string>("");
  const [qty, setQty] = useState<string>(qtySugerida ? String(qtySugerida) : "");
  const [lote, setLote] = useState<string>("");
  const [dataPrevista, setDataPrevista] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [search, setSearch] = useState(produtoCodigo || "");

  // Vincular existente
  const [opExistenteId, setOpExistenteId] = useState<string>("");

  const gerar = useGerarOPDaOC();
  const vincular = useVincularOPExistente();

  const { data: produtos = [], isFetching: loadingProds } = useQuery({
    queryKey: ["fabrica-produtos-busca", search],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos" as any)
        .select("id, codigo, nome, formula_id")
        .or(`codigo.ilike.%${search}%,nome.ilike.%${search}%,sku.ilike.%${search}%`)
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const produtoSel = useMemo(
    () => (produtos as any[]).find((p) => p.id === produtoId),
    [produtos, produtoId]
  );

  const { data: formulas = [] } = useQuery({
    queryKey: ["fabrica-formulas-prod", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_formulas" as any)
        .select("id, nome, versao")
        .eq("produto_id", produtoId)
        .limit(20);
      return (data || []) as any[];
    },
  });

  const { data: opsLivres = [] } = useQuery({
    queryKey: ["fabrica-ops-disponiveis", produtoId],
    enabled: tab === "vincular" && !!produtoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_ordens_producao" as any)
        .select("id, numero, status, quantidade_planejada, lote, data_prevista")
        .eq("produto_id", produtoId)
        .in("status", ["pendente", "em_andamento", "pausada"])
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
  });

  const handleGerar = async () => {
    if (!produtoId) return;
    const n = Number(qty);
    if (!n || n <= 0) return;
    await gerar.mutateAsync({
      oc_id: ocId,
      produto_id: produtoId,
      qty: n,
      formula_id: formulaId || null,
      lote: lote || null,
      data_prevista: dataPrevista || null,
      obs: obs || null,
    });
    onOpenChange(false);
  };

  const handleVincular = async () => {
    if (!opExistenteId) return;
    await vincular.mutateAsync({
      oc_id: ocId,
      op_id: opExistenteId,
      qty: qty ? Number(qty) : undefined,
      obs: obs || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Ordem de Produção a partir de OC {ocNumero}
            <div className="text-xs font-normal text-muted-foreground mt-1">
              {produtoCodigo} — {produtoNome}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gerar">Gerar nova OP / 生成新生产单</TabsTrigger>
            <TabsTrigger value="vincular">Vincular existente / 关联已有</TabsTrigger>
          </TabsList>

          <TabsContent value="gerar" className="space-y-3 pt-3">
            <div>
              <Label>Produto Brasil</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por código, SKU ou nome…"
                    className="pl-7"
                  />
                </div>
              </div>
              {loadingProds && <div className="text-xs text-muted-foreground mt-1"><Loader2 className="inline h-3 w-3 animate-spin" /> Buscando…</div>}
              {(produtos as any[]).length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto border border-border rounded-md divide-y divide-border">
                  {(produtos as any[]).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setProdutoId(p.id); setFormulaId(p.formula_id || ""); }}
                      className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted ${produtoId === p.id ? "bg-accent" : ""}`}
                    >
                      <span className="font-mono">{p.codigo}</span> — {p.nome}
                    </button>
                  ))}
                </div>
              )}
              {produtoSel && (
                <div className="mt-1 text-xs text-emerald-600">
                  Selecionado: {produtoSel.codigo} — {produtoSel.nome}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <Label>Lote</Label>
                <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="LDS-..." />
              </div>
              <div>
                <Label>Data prevista</Label>
                <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
              </div>
              <div>
                <Label>Fórmula (opcional)</Label>
                <Select value={formulaId || "none"} onValueChange={(v) => setFormulaId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem fórmula —</SelectItem>
                    {(formulas as any[]).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome} (v{f.versao})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
            </div>
          </TabsContent>

          <TabsContent value="vincular" className="space-y-3 pt-3">
            <div>
              <Label>Produto Brasil (para listar OPs)</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto…" className="pl-7" />
              </div>
              {(produtos as any[]).length > 0 && (
                <div className="mt-2 max-h-32 overflow-auto border border-border rounded-md divide-y divide-border">
                  {(produtos as any[]).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProdutoId(p.id)}
                      className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted ${produtoId === p.id ? "bg-accent" : ""}`}
                    >
                      <span className="font-mono">{p.codigo}</span> — {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {produtoId && (
              <div>
                <Label>Ordem de Produção disponível</Label>
                <Select value={opExistenteId} onValueChange={setOpExistenteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma OP" /></SelectTrigger>
                  <SelectContent>
                    {(opsLivres as any[]).map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.numero} · {op.status} · plan: {op.quantidade_planejada}
                      </SelectItem>
                    ))}
                    {(opsLivres as any[]).length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma OP disponível</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qtd. alocada (opcional)</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="= planejada da OP" />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={obs} onChange={(e) => setObs(e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {tab === "gerar" ? (
            <Button onClick={handleGerar} disabled={!produtoId || !qty || gerar.isPending}>
              {gerar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Gerar OP
            </Button>
          ) : (
            <Button onClick={handleVincular} disabled={!opExistenteId || vincular.isPending}>
              {vincular.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Vincular
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
