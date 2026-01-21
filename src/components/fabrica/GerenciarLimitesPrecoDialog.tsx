import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Save, AlertTriangle, Shield, X, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProdutoComLimites {
  id: string;
  codigo: string;
  nome: string;
  linha: string | null;
  preco_maximo: number | null;
  preco_minimo: number | null;
  preco_atual?: number | null;
}

export function GerenciarLimitesPrecoDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [linhaFiltro, setLinhaFiltro] = useState<string>("all");
  const [limitesEditados, setLimitesEditados] = useState<Record<string, { preco_maximo: string; preco_minimo: string }>>({});
  const [produtosAlterados, setProdutosAlterados] = useState<Set<string>>(new Set());

  // Buscar produtos acabados com limites
  const { data: produtos, isLoading } = useQuery({
    queryKey: ['fabrica-produtos-limites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_produtos')
        .select(`
          id,
          codigo,
          nome,
          linha,
          preco_maximo,
          preco_minimo
        `)
        .eq('ativo', true)
        .eq('tipo', 'acabado')
        .order('nome');

      if (error) throw error;
      return data as ProdutoComLimites[];
    },
    enabled: open,
  });

  // Buscar preços atuais dos produtos
  const { data: precosAtuais } = useQuery({
    queryKey: ['fabrica-precos-atuais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_precos_produtos')
        .select('produto_id, preco_final')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Agrupar por produto, pegando o mais recente
      const precosPorProduto: Record<string, number> = {};
      data?.forEach(p => {
        if (!precosPorProduto[p.produto_id]) {
          precosPorProduto[p.produto_id] = Number(p.preco_final);
        }
      });
      return precosPorProduto;
    },
    enabled: open,
  });

  // Buscar linhas únicas para filtro
  const linhas = [...new Set(produtos?.map(p => p.linha).filter(Boolean))] as string[];

  // Inicializar limites editados quando produtos carregam
  useEffect(() => {
    if (produtos && Object.keys(limitesEditados).length === 0) {
      const limites: Record<string, { preco_maximo: string; preco_minimo: string }> = {};
      produtos.forEach(p => {
        limites[p.id] = {
          preco_maximo: p.preco_maximo?.toString() || "",
          preco_minimo: p.preco_minimo?.toString() || "",
        };
      });
      setLimitesEditados(limites);
    }
  }, [produtos]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setLimitesEditados({});
      setProdutosAlterados(new Set());
      setBusca("");
      setLinhaFiltro("all");
    }
  }, [open]);

  // Mutation para salvar limites
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const updates = Array.from(produtosAlterados).map(produtoId => {
        const limite = limitesEditados[produtoId];
        return {
          id: produtoId,
          preco_maximo: limite.preco_maximo ? parseFloat(limite.preco_maximo) : null,
          preco_minimo: limite.preco_minimo ? parseFloat(limite.preco_minimo) : null,
        };
      });

      for (const update of updates) {
        const { error } = await supabase
          .from('fabrica_produtos')
          .update({
            preco_maximo: update.preco_maximo,
            preco_minimo: update.preco_minimo,
          })
          .eq('id', update.id);

        if (error) throw error;
      }

      // Registrar auditoria
      await supabase.from('audit_logs').insert({
        action: 'UPDATE_LIMITES_PRECO',
        entity_type: 'fabrica_produtos',
        metadata: { produtos_atualizados: updates.length },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabrica-produtos-limites'] });
      queryClient.invalidateQueries({ queryKey: ['fabrica-produtos'] });
      toast({ title: "Limites salvos", description: `${produtosAlterados.size} produto(s) atualizado(s)` });
      setProdutosAlterados(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const handleLimiteChange = (produtoId: string, campo: 'preco_maximo' | 'preco_minimo', valor: string) => {
    // Permitir apenas números e ponto
    const valorLimpo = valor.replace(/[^\d.]/g, '');
    
    setLimitesEditados(prev => ({
      ...prev,
      [produtoId]: {
        ...prev[produtoId],
        [campo]: valorLimpo,
      },
    }));
    
    setProdutosAlterados(prev => new Set(prev).add(produtoId));
  };

  const limparLimite = (produtoId: string) => {
    setLimitesEditados(prev => ({
      ...prev,
      [produtoId]: { preco_maximo: "", preco_minimo: "" },
    }));
    setProdutosAlterados(prev => new Set(prev).add(produtoId));
  };

  // Filtrar produtos
  const produtosFiltrados = produtos?.filter(p => {
    const matchBusca = !busca || 
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busca.toLowerCase());
    const matchLinha = linhaFiltro === "all" || p.linha === linhaFiltro;
    return matchBusca && matchLinha;
  });

  // Verificar se preço atual excede limite
  const verificarExcedeLimite = (produtoId: string) => {
    const precoAtual = precosAtuais?.[produtoId];
    const limiteMax = limitesEditados[produtoId]?.preco_maximo;
    
    if (precoAtual && limiteMax) {
      return precoAtual > parseFloat(limiteMax);
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Gerenciar Limites de Preço
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={linhaFiltro} onValueChange={setLinhaFiltro}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Linha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as linhas</SelectItem>
                {linhas.map(linha => (
                  <SelectItem key={linha} value={linha}>{linha}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info */}
          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <p className="text-muted-foreground">
              Defina limites de preço máximo e mínimo para cada produto. 
              Ao gerar preços, valores que excedam esses limites serão automaticamente ajustados.
            </p>
          </div>

          {/* Tabela */}
          <ScrollArea className="h-[400px] border rounded-lg">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Preço Atual</TableHead>
                    <TableHead className="text-center">Preço Mínimo (R$)</TableHead>
                    <TableHead className="text-center">Preço Máximo (R$)</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosFiltrados?.map((produto) => {
                    const excedeLimite = verificarExcedeLimite(produto.id);
                    const alterado = produtosAlterados.has(produto.id);
                    
                    return (
                      <TableRow 
                        key={produto.id} 
                        className={alterado ? "bg-primary/5" : excedeLimite ? "bg-destructive/5" : ""}
                      >
                        <TableCell className="font-mono text-sm">{produto.codigo}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {produto.nome}
                            {excedeLimite && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Preço atual excede o limite máximo
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {produto.linha && <Badge variant="outline">{produto.linha}</Badge>}
                        </TableCell>
                        <TableCell>
                          {precosAtuais?.[produto.id] 
                            ? formatarMoeda(precosAtuais[produto.id])
                            : <span className="text-muted-foreground">-</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={limitesEditados[produto.id]?.preco_minimo || ""}
                            onChange={(e) => handleLimiteChange(produto.id, 'preco_minimo', e.target.value)}
                            className="w-24 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={limitesEditados[produto.id]?.preco_maximo || ""}
                            onChange={(e) => handleLimiteChange(produto.id, 'preco_maximo', e.target.value)}
                            className="w-24 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          {(limitesEditados[produto.id]?.preco_maximo || limitesEditados[produto.id]?.preco_minimo) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => limparLimite(produto.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {produtosFiltrados?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum produto encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          {/* Resumo */}
          {produtosAlterados.size > 0 && (
            <div className="flex items-center justify-between bg-primary/10 p-3 rounded-lg">
              <span className="text-sm font-medium">
                {produtosAlterados.size} produto(s) com alterações pendentes
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setProdutosAlterados(new Set());
                  // Reinicializar limites
                  if (produtos) {
                    const limites: Record<string, { preco_maximo: string; preco_minimo: string }> = {};
                    produtos.forEach(p => {
                      limites[p.id] = {
                        preco_maximo: p.preco_maximo?.toString() || "",
                        preco_minimo: p.preco_minimo?.toString() || "",
                      };
                    });
                    setLimitesEditados(limites);
                  }
                }}
              >
                Desfazer alterações
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMutation.mutate()}
            disabled={produtosAlterados.size === 0 || salvarMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {salvarMutation.isPending ? "Salvando..." : "Salvar Limites"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
