import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Factory, Ship, Calculator, TrendingUp, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: {
    id: string;
    codigo: string;
    nome: string;
  } | null;
  onSuccess?: () => void;
}

interface CustoOrigem {
  id?: string;
  produto_id: string;
  origem: 'nacional' | 'importado';
  custo_base: number;
  custo_fob?: number;
  custo_frete?: number;
  custo_seguro?: number;
  custo_impostos?: number;
  taxa_cambio?: number;
  moeda_origem?: string;
  data_referencia: string;
  observacoes?: string;
  ativo: boolean;
}

export function CustosOrigemDialog({ open, onOpenChange, produto, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'nacional' | 'importado'>('nacional');
  
  const [custoNacional, setCustoNacional] = useState<Partial<CustoOrigem>>({
    origem: 'nacional',
    custo_base: 0,
    data_referencia: format(new Date(), 'yyyy-MM-dd'),
    ativo: true
  });

  const [custoImportado, setCustoImportado] = useState<Partial<CustoOrigem>>({
    origem: 'importado',
    custo_base: 0,
    custo_fob: 0,
    custo_frete: 0,
    custo_seguro: 0,
    custo_impostos: 0,
    taxa_cambio: 5.0,
    moeda_origem: 'USD',
    data_referencia: format(new Date(), 'yyyy-MM-dd'),
    ativo: true
  });

  // Buscar custos existentes
  const { data: custosExistentes, isLoading } = useQuery({
    queryKey: ['fabrica-custos-origem', produto?.id],
    queryFn: async () => {
      if (!produto?.id) return [];
      const { data, error } = await supabase
        .from('fabrica_custos_origem')
        .select('*')
        .eq('produto_id', produto.id)
        .eq('ativo', true)
        .order('data_referencia', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!produto?.id
  });

  // Preencher formulários com dados existentes
  useEffect(() => {
    if (custosExistentes && custosExistentes.length > 0) {
      const custoNac = custosExistentes.find(c => c.origem === 'nacional');
      const custoImp = custosExistentes.find(c => c.origem === 'importado');

      if (custoNac) {
        setCustoNacional({
          id: custoNac.id,
          produto_id: custoNac.produto_id,
          origem: 'nacional' as const,
          custo_base: Number(custoNac.custo_base) || 0,
          data_referencia: custoNac.data_referencia,
          observacoes: custoNac.observacoes || '',
          ativo: custoNac.ativo
        });
      }

      if (custoImp) {
        setCustoImportado({
          id: custoImp.id,
          produto_id: custoImp.produto_id,
          origem: 'importado' as const,
          custo_base: Number(custoImp.custo_base) || 0,
          custo_fob: Number(custoImp.custo_fob) || 0,
          custo_frete: Number(custoImp.custo_frete) || 0,
          custo_seguro: Number(custoImp.custo_seguro) || 0,
          custo_impostos: Number(custoImp.custo_impostos) || 0,
          taxa_cambio: Number(custoImp.taxa_cambio) || 5.0,
          moeda_origem: custoImp.moeda_origem || 'USD',
          data_referencia: custoImp.data_referencia,
          observacoes: custoImp.observacoes || '',
          ativo: custoImp.ativo
        });
      }
    }
  }, [custosExistentes]);

  // Calcular custo total importado
  const calcularCustoImportado = () => {
    const fob = custoImportado.custo_fob || 0;
    const frete = custoImportado.custo_frete || 0;
    const seguro = custoImportado.custo_seguro || 0;
    const impostos = custoImportado.custo_impostos || 0;
    const cambio = custoImportado.taxa_cambio || 1;
    
    return ((fob + frete + seguro) * cambio) + impostos;
  };

  // Atualizar custo base quando componentes mudam
  useEffect(() => {
    const custoCalculado = calcularCustoImportado();
    setCustoImportado(prev => ({ ...prev, custo_base: custoCalculado }));
  }, [
    custoImportado.custo_fob,
    custoImportado.custo_frete,
    custoImportado.custo_seguro,
    custoImportado.custo_impostos,
    custoImportado.taxa_cambio
  ]);

  // Mutation para salvar custos
  const salvarMutation = useMutation({
    mutationFn: async (custo: Partial<CustoOrigem>) => {
      if (!produto?.id) throw new Error('Produto não selecionado');

      const dados = {
        produto_id: produto.id,
        origem: custo.origem,
        custo_base: custo.custo_base,
        custo_fob: custo.custo_fob,
        custo_frete: custo.custo_frete,
        custo_seguro: custo.custo_seguro,
        custo_impostos: custo.custo_impostos,
        taxa_cambio: custo.taxa_cambio,
        moeda_origem: custo.moeda_origem,
        data_referencia: custo.data_referencia,
        observacoes: custo.observacoes,
        ativo: true
      };

      // Se já existe um custo para esta origem, desativar o anterior
      if (custo.id) {
        await supabase
          .from('fabrica_custos_origem')
          .update({ ativo: false })
          .eq('id', custo.id);
      }

      // Inserir novo registro
      const { error } = await supabase
        .from('fabrica_custos_origem')
        .insert(dados);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Custo salvo com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['fabrica-custos-origem'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar custo: ' + error.message);
    }
  });

  const handleSalvarNacional = () => {
    if (!custoNacional.custo_base || custoNacional.custo_base <= 0) {
      toast.error('Informe o custo base nacional');
      return;
    }
    salvarMutation.mutate(custoNacional);
  };

  const handleSalvarImportado = () => {
    if (!custoImportado.custo_base || custoImportado.custo_base <= 0) {
      toast.error('Informe os custos de importação');
      return;
    }
    salvarMutation.mutate(custoImportado);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!produto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Custos por Origem
          </DialogTitle>
          <DialogDescription>
            {produto.codigo} - {produto.nome}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'nacional' | 'importado')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nacional" className="gap-2">
                <Factory className="h-4 w-4" />
                Nacional
              </TabsTrigger>
              <TabsTrigger value="importado" className="gap-2">
                <Ship className="h-4 w-4" />
                Importado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nacional" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Factory className="h-4 w-4 text-green-600" />
                    Custo de Produção Nacional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="custo_base_nacional">Custo Base (R$)</Label>
                      <Input
                        id="custo_base_nacional"
                        type="number"
                        step="0.01"
                        value={custoNacional.custo_base || ''}
                        onChange={(e) => setCustoNacional({ ...custoNacional, custo_base: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_ref_nacional">Data de Referência</Label>
                      <Input
                        id="data_ref_nacional"
                        type="date"
                        value={custoNacional.data_referencia}
                        onChange={(e) => setCustoNacional({ ...custoNacional, data_referencia: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="obs_nacional">Observações</Label>
                    <Textarea
                      id="obs_nacional"
                      value={custoNacional.observacoes || ''}
                      onChange={(e) => setCustoNacional({ ...custoNacional, observacoes: e.target.value })}
                      placeholder="Observações sobre o custo nacional..."
                      rows={2}
                    />
                  </div>

                  {custosExistentes?.find(c => c.origem === 'nacional') && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Último registro: {format(new Date(custosExistentes.find(c => c.origem === 'nacional')!.created_at!), 'dd/MM/yyyy')}
                    </div>
                  )}

                  <Button 
                    onClick={handleSalvarNacional} 
                    disabled={salvarMutation.isPending}
                    className="w-full"
                  >
                    {salvarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Salvar Custo Nacional
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="importado" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Ship className="h-4 w-4 text-blue-600" />
                    Custo de Importação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="custo_fob">FOB ({custoImportado.moeda_origem})</Label>
                      <Input
                        id="custo_fob"
                        type="number"
                        step="0.01"
                        value={custoImportado.custo_fob || ''}
                        onChange={(e) => setCustoImportado({ ...custoImportado, custo_fob: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custo_frete">Frete ({custoImportado.moeda_origem})</Label>
                      <Input
                        id="custo_frete"
                        type="number"
                        step="0.01"
                        value={custoImportado.custo_frete || ''}
                        onChange={(e) => setCustoImportado({ ...custoImportado, custo_frete: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custo_seguro">Seguro ({custoImportado.moeda_origem})</Label>
                      <Input
                        id="custo_seguro"
                        type="number"
                        step="0.01"
                        value={custoImportado.custo_seguro || ''}
                        onChange={(e) => setCustoImportado({ ...custoImportado, custo_seguro: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="custo_impostos">Impostos (R$)</Label>
                      <Input
                        id="custo_impostos"
                        type="number"
                        step="0.01"
                        value={custoImportado.custo_impostos || ''}
                        onChange={(e) => setCustoImportado({ ...custoImportado, custo_impostos: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxa_cambio">Taxa de Câmbio</Label>
                      <Input
                        id="taxa_cambio"
                        type="number"
                        step="0.0001"
                        value={custoImportado.taxa_cambio || ''}
                        onChange={(e) => setCustoImportado({ ...custoImportado, taxa_cambio: parseFloat(e.target.value) || 0 })}
                        placeholder="5,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="moeda_origem">Moeda</Label>
                      <Select
                        value={custoImportado.moeda_origem}
                        onValueChange={(v) => setCustoImportado({ ...custoImportado, moeda_origem: v })}
                      >
                        <SelectTrigger id="moeda_origem">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - Dólar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - Libra</SelectItem>
                          <SelectItem value="CNY">CNY - Yuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_ref_importado">Data de Referência</Label>
                    <Input
                      id="data_ref_importado"
                      type="date"
                      value={custoImportado.data_referencia}
                      onChange={(e) => setCustoImportado({ ...custoImportado, data_referencia: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="obs_importado">Observações</Label>
                    <Textarea
                      id="obs_importado"
                      value={custoImportado.observacoes || ''}
                      onChange={(e) => setCustoImportado({ ...custoImportado, observacoes: e.target.value })}
                      placeholder="Observações sobre o custo importado..."
                      rows={2}
                    />
                  </div>

                  {/* Resumo do cálculo */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Custo Total Calculado:</span>
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          {formatCurrency(custoImportado.custo_base || 0)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Fórmula: (FOB + Frete + Seguro) × Câmbio + Impostos
                      </p>
                    </CardContent>
                  </Card>

                  {custosExistentes?.find(c => c.origem === 'importado') && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Último registro: {format(new Date(custosExistentes.find(c => c.origem === 'importado')!.created_at!), 'dd/MM/yyyy')}
                    </div>
                  )}

                  <Button 
                    onClick={handleSalvarImportado} 
                    disabled={salvarMutation.isPending}
                    className="w-full"
                  >
                    {salvarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Salvar Custo Importado
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
