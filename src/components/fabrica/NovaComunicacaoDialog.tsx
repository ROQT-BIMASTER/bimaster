import React, { useState, useEffect, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Package, Beaker } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  marca: string;
  linha: string;
}

interface MateriaPrima {
  id: string;
  nome: string;
  codigo: string;
}

interface NovaComunicacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriada: (revisaoId: string, configId: string, produto: Produto, insumos: MateriaPrima[]) => void;
}

export function NovaComunicacaoDialog({ open, onOpenChange, onCriada }: NovaComunicacaoDialogProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [loadingMPs, setLoadingMPs] = useState(false);
  const [saving, setSaving] = useState(false);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [mpSelecionada, setMpSelecionada] = useState<string>("all");
  const [mensagemInicial, setMensagemInicial] = useState("");

  // Load products
  useEffect(() => {
    if (!open) return;
    const loadProdutos = async () => {
      setLoadingProdutos(true);
      const { data } = await supabase
        .from("fabrica_produtos")
        .select("id, nome, codigo, marca, linha")
        .eq("ativo", true)
        .eq("tipo", "ACABADO")
        .order("nome");
      setProdutos((data as Produto[]) || []);
      setLoadingProdutos(false);
    };
    loadProdutos();
  }, [open]);

  // Load raw materials when product is selected (from formula)
  useEffect(() => {
    if (!produtoSelecionado) {
      setMateriasPrimas([]);
      setMpSelecionada("all");
      return;
    }
    const loadMPs = async () => {
      setLoadingMPs(true);
      // Get formula for this product
      const { data: formula } = await supabase
        .from("fabrica_formulas")
        .select("id")
        .eq("produto_id", produtoSelecionado.id)
        .eq("ativa", true)
        .maybeSingle();

      if (formula) {
        const { data: itens } = await supabase
          .from("fabrica_formula_itens")
          .select("mp_id, mp:fabrica_materias_primas(id, nome, codigo)")
          .eq("formula_id", formula.id);

        const mps = (itens || [])
          .map((i: any) => i.mp)
          .filter(Boolean)
          .sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        setMateriasPrimas(mps);
      } else {
        setMateriasPrimas([]);
      }
      setLoadingMPs(false);
    };
    loadMPs();
  }, [produtoSelecionado]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setProdutoSelecionado(null);
      setMpSelecionada("all");
      setMensagemInicial("");
      setBuscaProduto("");
    }
  }, [open]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto) return produtos;
    const term = buscaProduto.toLowerCase();
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term)
    );
  }, [produtos, buscaProduto]);

  const handleCriar = async () => {
    if (!produtoSelecionado) {
      toast.error("Selecione um produto.");
      return;
    }
    if (!mensagemInicial.trim()) {
      toast.error("Digite uma mensagem inicial.");
      return;
    }
    if (mensagemInicial.trim().length > 2000) {
      toast.error("Mensagem muito longa (máx. 2000 caracteres).");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();

      // 1. Find or create config
      let { data: config } = await supabase
        .from("fabrica_produto_custos_config")
        .select("id")
        .eq("produto_id", produtoSelecionado.id)
        .maybeSingle();

      if (!config) {
        const { data: newConfig, error: cfgErr } = await supabase
          .from("fabrica_produto_custos_config")
          .insert({
            produto_id: produtoSelecionado.id,
            created_by: user.id,
            status_aprovacao: "rascunho",
          })
          .select("id")
          .single();
        if (cfgErr) throw cfgErr;
        config = newConfig;
      }

      // 2. Get max version for this config
      const { data: maxVer } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("versao")
        .eq("config_id", config.id)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (maxVer?.versao || 0) + 1;

      // Build insumos snapshot
      const selectedMps = mpSelecionada !== "all"
        ? materiasPrimas.filter((mp) => mp.id === mpSelecionada)
        : materiasPrimas;

      // 3. Create revision
      const { data: revisao, error: revErr } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .insert({
          config_id: config.id,
          produto_id: produtoSelecionado.id,
          versao: nextVersion,
          status: "revisao_solicitada",
          chat_status: "aberto",
          submetido_por: user.id,
          submetido_em: new Date().toISOString(),
          snapshot_insumos: selectedMps.map((mp) => ({
            id: mp.id,
            nome: mp.nome,
            codigo: mp.codigo,
          })),
        })
        .select("id")
        .single();

      if (revErr) throw revErr;

      // 4. Create initial message
      const { error: msgErr } = await supabase
        .from("fabrica_revisao_mensagens" as any)
        .insert({
          revisao_id: revisao.id,
          usuario_id: user.id,
          usuario_nome: profile?.nome || user.email || "Usuário",
          conteudo: mensagemInicial.trim(),
          tipo: "usuario",
        } as any);

      if (msgErr) throw msgErr;

      toast.success("Comunicação iniciada!");
      onCriada(revisao.id, config.id, produtoSelecionado, selectedMps);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao criar comunicação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Nova Comunicação
          </DialogTitle>
          <DialogDescription>
            Selecione um produto e, opcionalmente, uma matéria-prima para iniciar a conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product selection */}
          <div className="space-y-2">
            <Label>Produto Acabado *</Label>
            {produtoSelecionado ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-primary/5">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{produtoSelecionado.nome}</p>
                  <p className="text-xs text-muted-foreground">{produtoSelecionado.codigo} — {produtoSelecionado.marca} / {produtoSelecionado.linha}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setProdutoSelecionado(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome ou código..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {loadingProdutos ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ScrollArea className="max-h-[200px] border rounded-lg">
                    <div className="p-1">
                      {produtosFiltrados.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
                      ) : (
                        produtosFiltrados.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setProdutoSelecionado(p)}
                            className="w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <p className="font-medium text-sm">{p.nome}</p>
                            <p className="text-xs text-muted-foreground">{p.codigo} — {p.marca} / {p.linha}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>

          {/* Raw material selection (optional) */}
          {produtoSelecionado && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Beaker className="h-3.5 w-3.5" />
                Matéria-Prima (opcional)
              </Label>
              {loadingMPs ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : materiasPrimas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma matéria-prima vinculada a este produto.</p>
              ) : (
                <Select value={mpSelecionada} onValueChange={setMpSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas matérias-primas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas matérias-primas</SelectItem>
                    {materiasPrimas.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>
                        {mp.nome} ({mp.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Initial message */}
          <div className="space-y-2">
            <Label>Mensagem Inicial *</Label>
            <Textarea
              placeholder="Descreva o assunto da comunicação..."
              value={mensagemInicial}
              onChange={(e) => setMensagemInicial(e.target.value)}
              rows={3}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">{mensagemInicial.length}/2000</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCriar} disabled={saving || !produtoSelecionado || !mensagemInicial.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Iniciar Comunicação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
