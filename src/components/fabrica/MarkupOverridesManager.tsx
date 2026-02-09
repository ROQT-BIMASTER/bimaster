import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Package, Layers } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabelaId: string;
  tabelaNome: string;
}

interface Override {
  id: string;
  tabela_id: string;
  linha: string | null;
  produto_id: string | null;
  tipo_markup: string;
  valor_markup: number;
  ativo: boolean;
  produto_nome?: string;
}

interface ProdutoOption {
  id: string;
  nome: string;
  linha: string | null;
}

export function MarkupOverridesManager({ open, onOpenChange, tabelaId, tabelaNome }: Props) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<string[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [adding, setAdding] = useState(false);

  // Form state
  const [tipoOverride, setTipoOverride] = useState<"linha" | "produto">("linha");
  const [linhaSelecionada, setLinhaSelecionada] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [tipoMarkup, setTipoMarkup] = useState("percentual");
  const [valorMarkup, setValorMarkup] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, tabelaId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load overrides
      const { data: ov } = await supabase
        .from("fabrica_markup_overrides")
        .select("*")
        .eq("tabela_id", tabelaId)
        .order("created_at", { ascending: false });

      // Load produtos for names
      const { data: prods } = await supabase
        .from("fabrica_produtos")
        .select("id, nome, linha")
        .eq("tipo", "acabado")
        .eq("status", "finalizado");

      const prodMap: Record<string, string> = {};
      const linhasSet = new Set<string>();
      prods?.forEach(p => {
        prodMap[p.id] = p.nome;
        if (p.linha) linhasSet.add(p.linha);
      });

      setProdutos(prods || []);
      setLinhas(Array.from(linhasSet).sort());

      const enriched = (ov || []).map(o => ({
        ...o,
        produto_nome: o.produto_id ? prodMap[o.produto_id] || "Produto desconhecido" : undefined,
      })) as Override[];

      setOverrides(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!valorMarkup || Number(valorMarkup) === 0) {
      toast.error("Informe o valor do markup");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const newOverride: any = {
      tabela_id: tabelaId,
      tipo_markup: tipoMarkup,
      valor_markup: Number(valorMarkup),
      created_by: user?.id,
      linha: tipoOverride === "linha" ? linhaSelecionada : null,
      produto_id: tipoOverride === "produto" ? produtoSelecionado : null,
    };

    const { error } = await supabase.from("fabrica_markup_overrides").insert(newOverride);
    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe um override para esta combinação");
      } else {
        toast.error("Erro ao adicionar override");
      }
      return;
    }

    toast.success("Override adicionado");
    setAdding(false);
    setValorMarkup("");
    setLinhaSelecionada("");
    setProdutoSelecionado("");
    loadData();
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    await supabase.from("fabrica_markup_overrides").update({ ativo }).eq("id", id);
    setOverrides(prev => prev.map(o => o.id === id ? { ...o, ativo } : o));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("fabrica_markup_overrides").delete().eq("id", id);
    setOverrides(prev => prev.filter(o => o.id !== id));
    toast.success("Override removido");
  };

  const formatMarkup = (tipo: string, valor: number) => {
    if (tipo === "percentual") return `+${valor}%`;
    if (tipo === "multiplicador") return `×${valor}`;
    return `R$ ${valor.toFixed(2)}`;
  };

  const produtosFiltrados = buscaProduto
    ? produtos.filter(p => p.nome.toLowerCase().includes(buscaProduto.toLowerCase()))
    : produtos.slice(0, 20);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Overrides de Markup — {tabelaNome}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lista de overrides */}
            {overrides.length === 0 && !adding && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum override configurado. Todos os produtos usam o markup padrão da tabela.
              </p>
            )}

            {overrides.map(ov => (
              <div key={ov.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {ov.produto_id ? (
                      <Badge className="bg-purple-500/20 text-purple-700 border-purple-300">
                        <Package className="h-3 w-3 mr-1" />
                        Produto
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-700 border-blue-300">
                        <Layers className="h-3 w-3 mr-1" />
                        Linha
                      </Badge>
                    )}
                    <span className="font-medium text-sm">
                      {ov.produto_id ? ov.produto_nome : ov.linha}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ov.tipo_markup === "percentual" ? "Percentual" :
                      ov.tipo_markup === "multiplicador" ? "Multiplicador" : "Valor Fixo"}:
                    {" "}{formatMarkup(ov.tipo_markup, ov.valor_markup)}
                  </p>
                </div>
                <Switch checked={ov.ativo} onCheckedChange={v => handleToggle(ov.id, v)} />
                <Button variant="ghost" size="icon" onClick={() => handleDelete(ov.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            {/* Form adicionar */}
            {adding && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de Override</Label>
                    <Select value={tipoOverride} onValueChange={(v: "linha" | "produto") => setTipoOverride(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linha">Por Linha</SelectItem>
                        <SelectItem value="produto">Por Produto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {tipoOverride === "linha" ? (
                    <div>
                      <Label>Linha</Label>
                      <Select value={linhaSelecionada} onValueChange={setLinhaSelecionada}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {linhas.map(l => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label>Produto</Label>
                      <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              placeholder="Buscar produto..."
                              value={buscaProduto}
                              onChange={e => setBuscaProduto(e.target.value)}
                              className="h-8"
                            />
                          </div>
                          {produtosFiltrados.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome} {p.linha && `(${p.linha})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de Markup</Label>
                    <Select value={tipoMarkup} onValueChange={setTipoMarkup}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentual">Percentual (%)</SelectItem>
                        <SelectItem value="multiplicador">Multiplicador (×)</SelectItem>
                        <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={tipoMarkup === "percentual" ? "Ex: 35" : tipoMarkup === "multiplicador" ? "Ex: 1.8" : "Ex: 25.00"}
                      value={valorMarkup}
                      onChange={e => setValorMarkup(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAdd}>Salvar</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!adding && (
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Override
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
