import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { History, Lock, LockOpen } from "lucide-react";
import { useVisibilityBlocks } from "@/hooks/useVisibilityBlocks";
import { useUserPriceTableAccess } from "@/hooks/useUserPriceTableAccess";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  onSuccess: () => void;
}

export function EditarPrecosProdutoDialog({ open, onOpenChange, produtoId, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [precosEditados, setPrecosEditados] = useState<Record<string, string>>({});
  const { isProductBlocked, getBlockForProduct, getBlockForLine, blockProduct, unblock, isBlocking, isUnblocking } = useVisibilityBlocks();
  const { hasFullAccess } = useUserPriceTableAccess();

  const { data: produto } = useQuery({
    queryKey: ["produto", produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("*")
        .eq("id", produtoId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!produtoId,
  });

  const { data: precos, isLoading, refetch } = useQuery({
    queryKey: ["precos-produto", produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select(`
          *,
          tabela:tabela_id(codigo, nome, tipo_markup, valor_markup)
        `)
        .eq("produto_id", produtoId)
        .eq("ativo", true)
        .order("tabela_id");

      if (error) throw error;
      return data;
    },
    enabled: open && !!produtoId,
  });

  const { data: historico } = useQuery({
    queryKey: ["historico-precos", produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_historico_precos")
        .select(`
          *,
          tabela:tabela_id(codigo, nome)
        `)
        .eq("produto_id", produtoId)
        .order("data_alteracao", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: open && !!produtoId,
  });

  const atualizarPrecosMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      // Atualizar os preços
      const atualizacoes = Object.entries(precosEditados).map(async ([precoId, novoValor]) => {
        const valor = parseFloat(novoValor);
        if (isNaN(valor) || valor <= 0) return;

        const { error } = await supabase
          .from("fabrica_precos_produtos")
          .update({
            preco_manual: valor,
            preco_final: valor,
            atualizado_por: user.user?.id,
          })
          .eq("id", precoId);

        if (error) throw error;
      });

      await Promise.all(atualizacoes);

      // Buscar as tabelas afetadas
      const precoIdsAlterados = Object.keys(precosEditados);
      const { data: precosAfetados } = await supabase
        .from("fabrica_precos_produtos")
        .select("tabela_id")
        .in("id", precoIdsAlterados);

      if (precosAfetados && precosAfetados.length > 0) {
        const tabelasIds = [...new Set(precosAfetados.map(p => p.tabela_id))];
        
        for (const tabelaId of tabelasIds) {
          // Buscar todos os preços da tabela para o snapshot
          const { data: todosPrecos } = await supabase
            .from("fabrica_precos_produtos")
            .select("*")
            .eq("tabela_id", tabelaId)
            .eq("ativo", true);

          // (Versões são criadas automaticamente por trigger ao mudar status para pending_approval)

          // SEMPRE atualizar para pending_approval (independente do status anterior)
          const { error: statusError } = await supabase
            .from("fabrica_tabelas_preco")
            .update({ 
              status: 'pending_approval',
              ativo: true
            })
            .eq("id", tabelaId);

          if (statusError) {
            console.error("Erro ao atualizar status:", statusError);
            throw statusError;
          }

          // Registrar na auditoria
          const { error: auditoriaError } = await supabase
            .from("fabrica_tabelas_preco_auditoria")
            .insert({
              tabela_id: tabelaId,
              user_id: user.user?.id,
              acao: "price_update",
              mensagem: "Preços atualizados manualmente e enviados para aprovação",
            });

          if (auditoriaError) {
            console.error("Erro na auditoria:", auditoriaError);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Preços atualizados e enviados para aprovação!");
      queryClient.invalidateQueries({ queryKey: ["precos-produto"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      refetch();
      setPrecosEditados({});
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar preços: " + error.message);
    },
  });

  const handleAtualizarPreco = (precoId: string, valor: string) => {
    setPrecosEditados({ ...precosEditados, [precoId]: valor });
  };

  const handleSalvar = () => {
    if (Object.keys(precosEditados).length === 0) {
      toast.error("Nenhuma alteração foi feita");
      return;
    }

    atualizarPrecosMutation.mutate();
  };

  const blocked = produto ? isProductBlocked(produto.linha, produto.id) : false;
  const productBlock = produto ? getBlockForProduct(produto.id) : undefined;
  const lineBlock = produto?.linha ? getBlockForLine(produto.linha) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <DialogTitle>Preços - {produto?.nome}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Código: {produto?.codigo}
              </p>
            </div>
            {blocked && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Bloqueado{lineBlock ? ' (Linha)' : ''}
              </Badge>
            )}
            {hasFullAccess && (
              <Button
                variant="outline"
                size="sm"
                disabled={isBlocking || isUnblocking}
                onClick={() => {
                  if (productBlock) {
                    unblock(productBlock.id);
                  } else if (!lineBlock) {
                    blockProduct(produtoId);
                  }
                }}
              >
                {productBlock ? (
                  <><LockOpen className="h-3.5 w-3.5 mr-1 text-green-600" /> Desbloquear</>
                ) : !lineBlock ? (
                  <><Lock className="h-3.5 w-3.5 mr-1 text-red-500" /> Bloquear</>
                ) : (
                  <><Lock className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Bloqueio via Linha</>
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preços por Tabela */}
          <div>
            <Label className="mb-3 block">Preços nas Tabelas</Label>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Carregando...</div>
            ) : precos?.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Produto não possui preços cadastrados
              </div>
            ) : (
              <div className="space-y-3">
                {precos?.map((preco: any) => (
                  <div
                    key={preco.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{preco.tabela.nome}</div>
                        <div className="text-sm text-muted-foreground">
                          {preco.tabela.codigo}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {preco.tabela.tipo_markup === "percentual" && `+${preco.tabela.valor_markup}%`}
                        {preco.tabela.tipo_markup === "multiplicador" && `x${preco.tabela.valor_markup}`}
                        {preco.tabela.tipo_markup === "valor_fixo" && `+${formatarMoeda(preco.tabela.valor_markup)}`}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <Label className="text-xs">Custo Base</Label>
                        <div className="font-medium">{formatarMoeda(preco.custo_base || 0)}</div>
                      </div>
                      <div>
                        <Label className="text-xs">Calculado</Label>
                        <div className="font-medium">{formatarMoeda(preco.preco_calculado || 0)}</div>
                      </div>
                      <div>
                        <Label className="text-xs">Manual</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={precosEditados[preco.id] ?? (preco.preco_manual || "")}
                          onChange={(e) => handleAtualizarPreco(preco.id, e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Preço Final</Label>
                        <div className="font-semibold text-primary">
                          {formatarMoeda(
                            precosEditados[preco.id]
                              ? parseFloat(precosEditados[preco.id])
                              : preco.preco_final || 0
                          )}
                        </div>
                      </div>
                    </div>

                    {preco.margem_lucro_percentual !== null && (
                      <div className="text-xs text-muted-foreground">
                        Margem de Lucro: {preco.margem_lucro_percentual.toFixed(2)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico de Alterações */}
          {historico && historico.length > 0 && (
            <div>
              <Label className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Alterações
              </Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Tabela</th>
                      <th className="p-2 text-right">De</th>
                      <th className="p-2 text-right">Para</th>
                      <th className="p-2 text-left">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h: any) => (
                      <tr key={h.id} className="border-t">
                        <td className="p-2">
                          {new Date(h.data_alteracao).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-2">{h.tabela?.codigo}</td>
                        <td className="p-2 text-right">{formatarMoeda(h.preco_anterior || 0)}</td>
                        <td className="p-2 text-right font-semibold">
                          {formatarMoeda(h.preco_novo || 0)}
                        </td>
                        <td className="p-2 text-muted-foreground">{h.motivo_alteracao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={atualizarPrecosMutation.isPending || Object.keys(precosEditados).length === 0}
          >
            {atualizarPrecosMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
