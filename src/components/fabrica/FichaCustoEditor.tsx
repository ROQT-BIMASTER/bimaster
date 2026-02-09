import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Calculator, FileDown } from "lucide-react";
import { 
  FichaCustoConfig, 
  CustoItem, 
  TIPOS_INSUMO,
  calcularCustosTotais,
  formatCurrency,
  TipoInsumo
} from "@/lib/fabrica/custo-types";
import { Skeleton } from "@/components/ui/skeleton";

interface FichaCustoEditorProps {
  formulaId: string;
  itens: any[];
  materiasPrimas: any[];
  onExportPDF?: () => void;
}

export function FichaCustoEditor({ 
  formulaId, 
  itens, 
  materiasPrimas,
  onExportPDF 
}: FichaCustoEditorProps) {
  const queryClient = useQueryClient();
  
  // Estado da configuração
  const [config, setConfig] = useState<FichaCustoConfig>({
    formula_id: formulaId,
    custo_mao_obra: 0,
    fornecedor_mao_obra: "",
    percentual_markup: 10,
    custo_mao_obra_nf: 0,
    custo_mao_obra_servico: 0,
  });

  // Estado dos custos por item
  const [custosItens, setCustosItens] = useState<Record<string, Partial<CustoItem>>>({});

  // Carregar configuração existente
  const { data: configExistente, isLoading: loadingConfig } = useQuery({
    queryKey: ["ficha-custo-config", formulaId],
    queryFn: async () => {
      if (!formulaId || formulaId === "nova") return null;
      
      const { data, error } = await supabase
        .from("fabrica_ficha_custo_config")
        .select("*")
        .eq("formula_id", formulaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!formulaId && formulaId !== "nova",
  });

  // Atualizar estado quando carregar config
  useEffect(() => {
    if (configExistente) {
      setConfig({
        ...configExistente,
        custo_mao_obra: Number(configExistente.custo_mao_obra) || 0,
        percentual_markup: Number(configExistente.percentual_markup) || 10,
        custo_mao_obra_nf: Number(configExistente.custo_mao_obra_nf) || 0,
        custo_mao_obra_servico: Number(configExistente.custo_mao_obra_servico) || 0,
      });
    }
  }, [configExistente]);

  // Inicializar custos dos itens
  useEffect(() => {
    const custos: Record<string, Partial<CustoItem>> = {};
    itens.forEach(item => {
      custos[item.id] = {
        custo_nf: Number(item.custo_nf) || 0,
        custo_servico: Number(item.custo_servico) || 0,
        custo_condicao: Number(item.custo_condicao) || 0,
        nf_referencia: item.nf_referencia || "",
        tipo_insumo: item.tipo_insumo || undefined,
      };
    });
    setCustosItens(custos);
  }, [itens]);

  // Salvar configuração
  const salvarConfigMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      // Upsert da configuração
      const { error: configError } = await supabase
        .from("fabrica_ficha_custo_config")
        .upsert({
          formula_id: formulaId,
          custo_mao_obra: config.custo_mao_obra,
          fornecedor_mao_obra: config.fornecedor_mao_obra,
          percentual_markup: config.percentual_markup,
          custo_mao_obra_nf: config.custo_mao_obra_nf,
          custo_mao_obra_servico: config.custo_mao_obra_servico,
          created_by: userId,
        }, { 
          onConflict: 'formula_id' 
        });

      if (configError) throw configError;

      // Atualizar custos dos itens
      for (const item of itens) {
        const custos = custosItens[item.id];
        if (custos) {
          const { error: itemError } = await supabase
            .from("fabrica_formula_itens")
            .update({
              custo_nf: custos.custo_nf || 0,
              custo_servico: custos.custo_servico || 0,
              custo_condicao: custos.custo_condicao || 0,
              nf_referencia: custos.nf_referencia || null,
              tipo_insumo: custos.tipo_insumo || null,
            })
            .eq("id", item.id);

          if (itemError) throw itemError;
        }
      }
    },
    onSuccess: () => {
      toast.success("Ficha de custos salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ficha-custo-config"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-formula"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar ficha de custos");
    },
  });

  const atualizarCustoItem = (itemId: string, campo: string, valor: any) => {
    setCustosItens(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [campo]: valor,
      }
    }));
  };

  // Calcular totais
  const itensComCusto: CustoItem[] = itens.map(item => {
    const mp = materiasPrimas?.find(m => m.id === item.mp_id);
    const custos = custosItens[item.id] || {};
    return {
      id: item.id,
      codigo: mp?.codigo || "",
      nome: mp?.nome || "Item sem nome",
      fornecedor: mp?.fabrica_fornecedores?.nome || "",
      custo_nf: Number(custos.custo_nf) || 0,
      custo_servico: Number(custos.custo_servico) || 0,
      custo_condicao: Number(custos.custo_condicao) || 0,
      nf_referencia: custos.nf_referencia || "",
      tipo_insumo: custos.tipo_insumo as TipoInsumo,
      quantidade: item.quantidade || 0,
      unidade: mp?.fabrica_unidades_medida?.sigla || "",
    };
  });

  const totais = calcularCustosTotais(itensComCusto, config);

  if (loadingConfig) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Configuração de M.O. e Markup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Configuração de Custos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Fornecedor M.O.</Label>
            <Input
              value={config.fornecedor_mao_obra}
              onChange={(e) => setConfig(prev => ({ ...prev, fornecedor_mao_obra: e.target.value }))}
              placeholder="Ex: Rodrigues"
            />
          </div>
          <div>
            <Label>M.O. - NF (R$)</Label>
            <Input
              type="number"
              step="0.000001"
              value={config.custo_mao_obra_nf}
              onChange={(e) => setConfig(prev => ({ ...prev, custo_mao_obra_nf: Number(e.target.value) }))}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label>M.O. - Serviço (R$)</Label>
            <Input
              type="number"
              step="0.000001"
              value={config.custo_mao_obra_servico}
              onChange={(e) => setConfig(prev => ({ ...prev, custo_mao_obra_servico: Number(e.target.value) }))}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label>Markup (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.percentual_markup}
              onChange={(e) => setConfig(prev => ({ ...prev, percentual_markup: Number(e.target.value) }))}
              placeholder="10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Custos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detalhamento de Custos por Insumo</CardTitle>
            <div className="flex gap-2">
              {onExportPDF && (
                <Button variant="outline" size="sm" onClick={onExportPDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={() => salvarConfigMutation.mutate()}
                disabled={salvarConfigMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Custos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px]">Código</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead className="w-[100px] text-right">NF (R$)</TableHead>
                  <TableHead className="w-[100px] text-right">Serviço (R$)</TableHead>
                  <TableHead className="w-[100px] text-right">Condição (R$)</TableHead>
                  <TableHead className="w-[100px]">NF Ref.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Linha de M.O. */}
                <TableRow className="bg-primary/5">
                  <TableCell className="font-medium">-</TableCell>
                  <TableCell className="font-medium">Mão de Obra</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">Serviço</span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(config.custo_mao_obra_nf)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(config.custo_mao_obra_servico)}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>

                {/* Itens */}
                {itensComCusto.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.codigo || "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{item.nome}</span>
                        {item.fornecedor && (
                          <span className="text-xs text-muted-foreground block">
                            {item.fornecedor}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={custosItens[item.id]?.tipo_insumo || ""}
                        onValueChange={(value) => atualizarCustoItem(item.id, "tipo_insumo", value)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_INSUMO.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="h-8 text-right text-sm min-w-[80px]"
                        value={custosItens[item.id]?.custo_nf === 0 ? "0" : (custosItens[item.id]?.custo_nf || "")}
                        onChange={(e) => {
                          const raw = e.target.value.replace(",", ".");
                          if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                            atualizarCustoItem(item.id, "custo_nf", raw === "" ? 0 : (raw.endsWith(".") ? raw : parseFloat(raw) || 0));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="h-8 text-right text-sm min-w-[80px]"
                        value={custosItens[item.id]?.custo_servico === 0 ? "0" : (custosItens[item.id]?.custo_servico || "")}
                        onChange={(e) => {
                          const raw = e.target.value.replace(",", ".");
                          if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                            atualizarCustoItem(item.id, "custo_servico", raw === "" ? 0 : (raw.endsWith(".") ? raw : parseFloat(raw) || 0));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="h-8 text-right text-sm min-w-[80px]"
                        value={custosItens[item.id]?.custo_condicao === 0 ? "0" : (custosItens[item.id]?.custo_condicao || "")}
                        onChange={(e) => {
                          const raw = e.target.value.replace(",", ".");
                          if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                            atualizarCustoItem(item.id, "custo_condicao", raw === "" ? 0 : (raw.endsWith(".") ? raw : parseFloat(raw) || 0));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-sm"
                        value={custosItens[item.id]?.nf_referencia || ""}
                        onChange={(e) => atualizarCustoItem(item.id, "nf_referencia", e.target.value)}
                        placeholder="NF..."
                      />
                    </TableCell>
                  </TableRow>
                ))}

                {/* Linha de Markup */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={2} className="font-medium">
                    {config.percentual_markup}% sobre o custo
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(totais.custoNfTotal * (config.percentual_markup / 100))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(totais.custoServicoTotal * (config.percentual_markup / 100))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(totais.custoCondicaoTotal * (config.percentual_markup / 100))}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/10 font-bold">
                  <TableCell colSpan={3}>TOTAIS</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totais.custoNfTotal + config.custo_mao_obra_nf)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totais.custoServicoTotal + config.custo_mao_obra_servico)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totais.custoCondicaoTotal)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatCurrency(totais.custoFinalTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Resumo de custos */}
          <div className="mt-4 grid gap-2 md:grid-cols-5 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">Custo NF</span>
              <p className="font-bold text-lg">{formatCurrency(totais.custoNfTotal + config.custo_mao_obra_nf)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">Custo Serviço</span>
              <p className="font-bold text-lg">{formatCurrency(totais.custoServicoTotal + config.custo_mao_obra_servico)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">Custo Condição</span>
              <p className="font-bold text-lg">{formatCurrency(totais.custoCondicaoTotal)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">Markup ({config.percentual_markup}%)</span>
              <p className="font-bold text-lg">{formatCurrency(totais.markupValor)}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-muted-foreground">Custo Total</span>
              <p className="font-bold text-xl text-primary">{formatCurrency(totais.custoFinalTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
