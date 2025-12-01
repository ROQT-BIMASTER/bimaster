import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { History } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  onSuccess: () => void;
}

export function EditarPrecosProdutoDialog({ open, onOpenChange, produtoId, onSuccess }: Props) {
  const [precosEditados, setPrecosEditados] = useState<Record<string, string>>({});

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

      // Buscar as tabelas afetadas e criar versões + mudar status
      const precoIdsAlterados = Object.keys(precosEditados);
      const { data: precosAfetados } = await supabase
        .from("fabrica_precos_produtos")
        .select("tabela_id, id, produto_id, custo_base, preco_calculado, preco_final, preco_manual")
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

          // Buscar a última versão para incrementar
          const { data: ultimaVersao } = await supabase
            .from("fabrica_tabelas_preco_versoes")
            .select("versao")
            .eq("tabela_id", tabelaId)
            .order("versao", { ascending: false })
            .limit(1)
            .single();

          const novaVersao = (ultimaVersao?.versao || 0) + 1;

          // Criar nova versão com snapshot dos preços
          const { error: versionError } = await supabase
            .from("fabrica_tabelas_preco_versoes")
            .insert({
              tabela_id: tabelaId,
              versao: novaVersao,
              precos_snapshot: todosPrecos || [],
              created_by: user.user?.id,
            });

          if (versionError) {
            console.error("Erro ao criar versão:", versionError);
          }

          // Atualizar status da tabela para pending_approval
          const { error: statusError } = await supabase
            .from("fabrica_tabelas_preco")
            .update({ status: 'pending_approval' })
            .eq("id", tabelaId);

          if (statusError) {
            console.error("Erro ao atualizar status:", statusError);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Preços atualizados e enviados para aprovação!");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preços - {produto?.nome}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Código: {produto?.codigo}
          </p>
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
