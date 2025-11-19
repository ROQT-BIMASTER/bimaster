import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DetalhesNotaFiscalDialogProps {
  notaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetalhesNotaFiscalDialog({ notaId, open, onOpenChange }: DetalhesNotaFiscalDialogProps) {
  const { data: nota, isLoading } = useQuery({
    queryKey: ['nota-fiscal', notaId],
    queryFn: async () => {
      if (!notaId) return null;
      
      const { data, error } = await supabase
        .from('fabrica_notas_fiscais')
        .select(`
          *,
          fornecedor:fabrica_fornecedores(razao_social, cnpj)
        `)
        .eq('id', notaId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!notaId && open,
  });

  const { data: itens } = useQuery({
    queryKey: ['nota-fiscal-itens', notaId],
    queryFn: async () => {
      if (!notaId) return [];
      
      const { data, error } = await supabase
        .from('fabrica_itens_nf')
        .select(`
          *,
          produto_interno:fabrica_materias_primas(nome, codigo),
          codigo_mapeado:fabrica_codigos_fornecedor(*)
        `)
        .eq('nota_id', notaId)
        .order('numero_item', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!notaId && open,
  });

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Pendente", variant: "secondary" as const, icon: Clock },
      mapped: { label: "Mapeado", variant: "default" as const, icon: CheckCircle2 },
      manual_review: { label: "Revisão Manual", variant: "outline" as const, icon: AlertCircle },
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Detalhes da Nota Fiscal</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : nota ? (
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="space-y-6">
              {/* Cabeçalho da Nota */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Número</p>
                  <p className="font-semibold">NF-e {nota.numero} - Série {nota.serie}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chave de Acesso</p>
                  <p className="font-mono text-xs">{nota.chave_acesso}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fornecedor</p>
                  <p className="font-semibold">{nota.fornecedor?.razao_social}</p>
                  <p className="text-xs text-muted-foreground">{nota.fornecedor?.cnpj}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Emissão</p>
                  <p className="font-semibold">
                    {format(new Date(nota.data_emissao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="font-semibold text-lg">R$ {nota.valor_total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={nota.status === 'imported' ? 'secondary' : 'default'}>
                    {nota.status === 'imported' ? 'Importado' : nota.status}
                  </Badge>
                </div>
              </div>

              {/* Itens da Nota */}
              <div>
                <h3 className="font-semibold mb-3">Itens da Nota ({itens?.length || 0})</h3>
                <div className="space-y-2">
                  {itens?.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">#{item.numero_item}</span>
                            <span className="text-sm">{item.descricao}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Código: {item.codigo_fornecedor}</span>
                            {item.ncm && <span>NCM: {item.ncm}</span>}
                          </div>
                        </div>
                        {getStatusBadge(item.status_mapeamento || 'pending')}
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Quantidade:</span>
                          <p className="font-semibold">{item.quantidade} {item.unidade}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor Unit.:</span>
                          <p className="font-semibold">R$ {item.valor_unitario.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor Total:</span>
                          <p className="font-semibold">R$ {item.valor_total.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Score:</span>
                          <p className="font-semibold">
                            {item.score_similaridade ? `${(item.score_similaridade * 100).toFixed(0)}%` : '-'}
                          </p>
                        </div>
                      </div>

                      {item.produto_interno && (
                        <div className="pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Mapeado para: </span>
                          <span className="text-sm font-medium">
                            {item.produto_interno.codigo} - {item.produto_interno.nome}
                          </span>
                          {item.quantidade_convertida && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({item.quantidade_convertida} {item.unidade_convertida})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {nota.observacoes && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{nota.observacoes}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
