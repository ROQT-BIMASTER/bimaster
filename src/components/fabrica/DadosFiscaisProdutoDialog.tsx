import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Receipt, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FiscalFieldWithOptions } from "./FiscalFieldWithOptions";
import { ValidacaoFiscalRecebimento } from "./ValidacaoFiscalRecebimento";

interface DadosFiscaisProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  produtoNome: string;
}

export const DadosFiscaisProdutoDialog = ({ 
  open, 
  onOpenChange, 
  produtoId,
  produtoNome 
}: DadosFiscaisProdutoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [dadosId, setDadosId] = useState<string | null>(null);
  
  // Valores originais do XML
  const [xmlValues, setXmlValues] = useState<any>({});
  
  // Sugestões da IA
  const [aiSuggestions, setAiSuggestions] = useState<any>({});

  // Classificação fiscal
  const [ncm, setNcm] = useState("");
  const [cest, setCest] = useState("");
  const [origemMercadoria, setOrigemMercadoria] = useState("");
  const [cfopPadrao, setCfopPadrao] = useState("");

  // Impostos
  const [aliquotaIcms, setAliquotaIcms] = useState("");
  const [aliquotaIpi, setAliquotaIpi] = useState("");
  const [aliquotaPis, setAliquotaPis] = useState("");
  const [aliquotaCofins, setAliquotaCofins] = useState("");
  const [cstIcms, setCstIcms] = useState("");
  const [cstIpi, setCstIpi] = useState("");
  const [cstPis, setCstPis] = useState("");
  const [cstCofins, setCstCofins] = useState("");

  // Flags de geração de crédito
  const [geraCreditoIcms, setGeraCreditoIcms] = useState(false);
  const [geraCreditoIpi, setGeraCreditoIpi] = useState(false);
  const [geraCreditoPis, setGeraCreditoPis] = useState(false);
  const [geraCreditoCofins, setGeraCreditoCofins] = useState(false);

  // Preços
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [precoMaximo, setPrecoMaximo] = useState("");
  const [precoFabrica, setPrecoFabrica] = useState("");
  const [custoMedio, setCustoMedio] = useState("");

  // Estoque
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [estoqueMaximo, setEstoqueMaximo] = useState("");

  // Pesos e Dimensões
  const [pesoBruto, setPesoBruto] = useState("");
  const [pesoLiquido, setPesoLiquido] = useState("");
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [volumeM3, setVolumeM3] = useState("");

  // Unidades
  const [unidadeCompra, setUnidadeCompra] = useState("");
  const [unidadeVenda, setUnidadeVenda] = useState("");

  // Outros
  const [observacoes, setObservacoes] = useState("");

  // IVA Dual
  const [aliquotaCbsPadrao, setAliquotaCbsPadrao] = useState("");
  const [aliquotaIbsPadrao, setAliquotaIbsPadrao] = useState("");
  const [elegivelCreditoIva, setElegivelCreditoIva] = useState(true);
  
  // Valores da nota para validação
  const [valorUnitarioNota, setValorUnitarioNota] = useState(0);
  const [quantidadeNota, setQuantidadeNota] = useState(0);
  const [valorIcmsNota, setValorIcmsNota] = useState(0);
  const [valorIpiNota, setValorIpiNota] = useState(0);
  const [valorPisNota, setValorPisNota] = useState(0);
  const [valorCofinsNota, setValorCofinsNota] = useState(0);
  const [valorIcmsStNota, setValorIcmsStNota] = useState(0);
  const [cfopNota, setCfopNota] = useState("");
  
  // Controle da validação
  const [mostrarValidacao, setMostrarValidacao] = useState(false);

  useEffect(() => {
    if (open) {
      carregarDados();
      carregarSugestoes();
    }
  }, [open, produtoId]);

  const carregarDados = async () => {
    setLoadingData(true);
    try {
      const response = await supabase
        .from("fabrica_dados_fiscais_produto")
        .select("*")
        .eq("produto_id", produtoId)
        .maybeSingle();

      if (response.error && response.error.code !== 'PGRST116') throw response.error;

      const data = response.data;
      if (data) {
        setDadosId(data.id);
        setNcm(data.ncm || "");
        setCest(data.cest || "");
        setOrigemMercadoria(data.origem_mercadoria || "");
        setCfopPadrao(data.cfop_padrao || "");
        
        setAliquotaIcms(data.aliquota_icms?.toString() || "");
        setAliquotaIpi(data.aliquota_ipi?.toString() || "");
        setAliquotaPis(data.aliquota_pis?.toString() || "");
        setAliquotaCofins(data.aliquota_cofins?.toString() || "");
        setCstIcms(data.cst_icms || "");
        setCstIpi(data.cst_ipi || "");
        setCstPis(data.cst_pis || "");
        setCstCofins(data.cst_cofins || "");
        
        setGeraCreditoIcms(data.gera_credito_icms || false);
        setGeraCreditoIpi(data.gera_credito_ipi || false);
        setGeraCreditoPis(data.gera_credito_pis || false);
        setGeraCreditoCofins(data.gera_credito_cofins || false);
        
        setPrecoCusto(data.preco_custo?.toString() || "");
        setPrecoVenda(data.preco_venda?.toString() || "");
        setPrecoMaximo(data.preco_maximo?.toString() || "");
        setPrecoFabrica(data.preco_fabrica?.toString() || "");
        setCustoMedio(data.custo_medio?.toString() || "");
        
        setEstoqueMinimo(data.estoque_minimo?.toString() || "");
        setEstoqueMaximo(data.estoque_maximo?.toString() || "");
        
        setPesoBruto(data.peso_bruto?.toString() || "");
        setPesoLiquido(data.peso_liquido?.toString() || "");
        setAltura(data.altura?.toString() || "");
        setLargura(data.largura?.toString() || "");
        setComprimento(data.comprimento?.toString() || "");
        setVolumeM3(data.volume_m3?.toString() || "");
        
        setUnidadeCompra(data.unidade_compra || "");
        setUnidadeVenda(data.unidade_venda || "");
        setObservacoes(data.observacoes || "");

        // IVA Dual
        setAliquotaCbsPadrao((data as any).aliquota_cbs_padrao?.toString() || "");
        setAliquotaIbsPadrao((data as any).aliquota_ibs_padrao?.toString() || "");
        setElegivelCreditoIva((data as any).elegivel_credito_iva !== false);
        
        // Valores da nota para validação
        setValorUnitarioNota(data.preco_custo || 0);
        setQuantidadeNota(1);
        setValorIcmsNota(data.preco_custo ? (data.preco_custo * (data.aliquota_icms || 0) / 100) : 0);
        setValorIpiNota(data.preco_custo ? (data.preco_custo * (data.aliquota_ipi || 0) / 100) : 0);
        setValorPisNota(data.preco_custo ? (data.preco_custo * (data.aliquota_pis || 0) / 100) : 0);
        setValorCofinsNota(data.preco_custo ? (data.preco_custo * (data.aliquota_cofins || 0) / 100) : 0);
        setValorIcmsStNota(0); // Será carregado do XML se houver
        setCfopNota(data.cfop_padrao || "");

        // Guardar valores originais como XML values
        setXmlValues({
          ncm: data.ncm,
          cest: data.cest,
          cstIcms: data.cst_icms,
          cstIpi: data.cst_ipi,
          cstPis: data.cst_pis,
          cstCofins: data.cst_cofins,
          aliquotaIcms: data.aliquota_icms,
          aliquotaIpi: data.aliquota_ipi,
          aliquotaPis: data.aliquota_pis,
          aliquotaCofins: data.aliquota_cofins,
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados fiscais:", error);
      toast.error("Erro ao carregar dados fiscais");
    } finally {
      setLoadingData(false);
    }
  };

  const carregarSugestoes = async () => {
    try {
      // As sugestões automáticas serão implementadas
      // diretamente no processamento do XML na tela de recebimentos
      // onde já temos acesso aos dados do fornecedor e NCM
      setAiSuggestions({});
    } catch (error: any) {
      console.error("Erro ao carregar sugestões:", error);
    }
  };

  const handlePreview = () => {
    setMostrarValidacao(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se ainda não mostrou a validação, mostrar primeiro
    if (!mostrarValidacao) {
      handlePreview();
      return;
    }
    
    setLoading(true);
    console.log("🔧 Iniciando salvamento de dados fiscais para produto:", produtoId);

    try {
      // Pegar user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const dadosFiscais = {
        produto_id: produtoId,
        ncm: ncm || null,
        cest: cest || null,
        origem_mercadoria: origemMercadoria || null,
        cfop_padrao: cfopPadrao || null,
        
        aliquota_icms: aliquotaIcms ? parseFloat(aliquotaIcms) : null,
        aliquota_ipi: aliquotaIpi ? parseFloat(aliquotaIpi) : null,
        aliquota_pis: aliquotaPis ? parseFloat(aliquotaPis) : null,
        aliquota_cofins: aliquotaCofins ? parseFloat(aliquotaCofins) : null,
        
        cst_icms: cstIcms || null,
        cst_ipi: cstIpi || null,
        cst_pis: cstPis || null,
        cst_cofins: cstCofins || null,
        
        gera_credito_icms: geraCreditoIcms,
        gera_credito_ipi: geraCreditoIpi,
        gera_credito_pis: geraCreditoPis,
        gera_credito_cofins: geraCreditoCofins,
        
        preco_custo: precoCusto ? parseFloat(precoCusto) : null,
        preco_venda: precoVenda ? parseFloat(precoVenda) : null,
        preco_maximo: precoMaximo ? parseFloat(precoMaximo) : null,
        preco_fabrica: precoFabrica ? parseFloat(precoFabrica) : null,
        custo_medio: custoMedio ? parseFloat(custoMedio) : null,
        
        estoque_minimo: estoqueMinimo ? parseFloat(estoqueMinimo) : null,
        estoque_maximo: estoqueMaximo ? parseFloat(estoqueMaximo) : null,
        
        peso_bruto: pesoBruto ? parseFloat(pesoBruto) : null,
        peso_liquido: pesoLiquido ? parseFloat(pesoLiquido) : null,
        altura: altura ? parseFloat(altura) : null,
        largura: largura ? parseFloat(largura) : null,
        comprimento: comprimento ? parseFloat(comprimento) : null,
        
        unidade_compra: unidadeCompra || null,
        unidade_venda: unidadeVenda || null,
        observacoes: observacoes || null,
        
        // IVA Dual
        aliquota_cbs_padrao: aliquotaCbsPadrao ? parseFloat(aliquotaCbsPadrao) : null,
        aliquota_ibs_padrao: aliquotaIbsPadrao ? parseFloat(aliquotaIbsPadrao) : null,
        elegivel_credito_iva: elegivelCreditoIva,
        
        updated_at: new Date().toISOString()
      };

      console.log("📦 Dados preparados:", dadosFiscais);

      let response;
      if (dadosId) {
        console.log("✏️ Atualizando dados existentes, ID:", dadosId);
        response = await supabase
          .from("fabrica_dados_fiscais_produto")
          .update(dadosFiscais)
          .eq("id", dadosId)
          .select();
      } else {
        console.log("➕ Inserindo novos dados fiscais");
        response = await supabase
          .from("fabrica_dados_fiscais_produto")
          .insert({ 
            ...dadosFiscais, 
            created_at: new Date().toISOString(),
            created_by: user.id 
          })
          .select();
      }

      console.log("📡 Resposta do banco:", response);

      if (response.error) {
        console.error("❌ Erro do Supabase:", response.error);
        toast.error(`Erro ao salvar: ${response.error.message}`);
        throw response.error;
      }

      if (!response.data || response.data.length === 0) {
        console.error("❌ Nenhum dado retornado após inserção");
        toast.error("Erro: Nenhum dado foi salvo");
        throw new Error("Nenhum dado retornado");
      }

      console.log("✅ Dados fiscais salvos com sucesso!");
      toast.success("Dados fiscais salvos com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("❌ Erro ao salvar dados fiscais:", error);
      toast.error(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Dados Fiscais - {produtoNome}
          </DialogTitle>
          <Badge variant="outline" className="w-fit mt-2">
            <Receipt className="h-3 w-3 mr-1" />
            Operação: Recebimento
          </Badge>
        </DialogHeader>

        {loadingData ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="fiscal" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                <TabsTrigger value="iva">IVA Dual</TabsTrigger>
                <TabsTrigger value="precos">Preços</TabsTrigger>
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
                <TabsTrigger value="outros">Outros</TabsTrigger>
              </TabsList>

              <TabsContent value="fiscal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FiscalFieldWithOptions
                    label="NCM"
                    xmlValue={xmlValues.ncm}
                    currentValue={ncm}
                    onChange={setNcm}
                    required
                  />

                  <FiscalFieldWithOptions
                    label="CEST"
                    xmlValue={xmlValues.cest}
                    currentValue={cest}
                    onChange={setCest}
                  />

                  <div className="space-y-2">
                    <Label>Origem da Mercadoria</Label>
                    <Select value={origemMercadoria} onValueChange={setOrigemMercadoria}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - Nacional</SelectItem>
                        <SelectItem value="1">1 - Estrangeira - Importação direta</SelectItem>
                        <SelectItem value="2">2 - Estrangeira - Adquirida no mercado interno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>CFOP Padrão</Label>
                    <Input
                      value={cfopPadrao}
                      onChange={(e) => setCfopPadrao(e.target.value)}
                      placeholder="Ex: 1101"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium mb-4">ICMS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FiscalFieldWithOptions
                      label="CST ICMS"
                      xmlValue={xmlValues.cstIcms}
                      aiSuggestion={aiSuggestions.cstIcms}
                      currentValue={cstIcms}
                      onChange={setCstIcms}
                    />

                    <FiscalFieldWithOptions
                      label="Alíquota ICMS (%)"
                      xmlValue={xmlValues.aliquotaIcms}
                      aiSuggestion={aiSuggestions.aliquotaIcms}
                      currentValue={aliquotaIcms}
                      onChange={setAliquotaIcms}
                      type="number"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium mb-4">IPI</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FiscalFieldWithOptions
                      label="CST IPI"
                      xmlValue={xmlValues.cstIpi}
                      aiSuggestion={aiSuggestions.cstIpi}
                      currentValue={cstIpi}
                      onChange={setCstIpi}
                    />

                    <FiscalFieldWithOptions
                      label="Alíquota IPI (%)"
                      xmlValue={xmlValues.aliquotaIpi}
                      aiSuggestion={aiSuggestions.aliquotaIpi}
                      currentValue={aliquotaIpi}
                      onChange={setAliquotaIpi}
                      type="number"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium mb-4">PIS/COFINS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FiscalFieldWithOptions
                      label="CST PIS"
                      xmlValue={xmlValues.cstPis}
                      aiSuggestion={aiSuggestions.cstPis}
                      currentValue={cstPis}
                      onChange={setCstPis}
                    />

                    <FiscalFieldWithOptions
                      label="Alíquota PIS (%)"
                      xmlValue={xmlValues.aliquotaPis}
                      aiSuggestion={aiSuggestions.aliquotaPis}
                      currentValue={aliquotaPis}
                      onChange={setAliquotaPis}
                      type="number"
                    />

                    <FiscalFieldWithOptions
                      label="CST COFINS"
                      xmlValue={xmlValues.cstCofins}
                      aiSuggestion={aiSuggestions.cstCofins}
                      currentValue={cstCofins}
                      onChange={setCstCofins}
                    />

                    <FiscalFieldWithOptions
                      label="Alíquota COFINS (%)"
                      xmlValue={xmlValues.aliquotaCofins}
                      aiSuggestion={aiSuggestions.aliquotaCofins}
                      currentValue={aliquotaCofins}
                      onChange={setAliquotaCofins}
                      type="number"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="iva" className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h3 className="font-medium mb-1">Reforma Tributária — IVA Dual</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Configure as alíquotas padrão de CBS e IBS para este produto.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Alíquota CBS Padrão (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={aliquotaCbsPadrao}
                        onChange={(e) => setAliquotaCbsPadrao(e.target.value)}
                        placeholder="Ex: 8.80"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alíquota IBS Padrão (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={aliquotaIbsPadrao}
                        onChange={(e) => setAliquotaIbsPadrao(e.target.value)}
                        placeholder="Ex: 17.70"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="checkbox"
                      id="elegivel_credito_iva"
                      checked={elegivelCreditoIva}
                      onChange={(e) => setElegivelCreditoIva(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="elegivel_credito_iva">Elegível para crédito de IVA (entradas)</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="precos" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preço de Custo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precoCusto}
                      onChange={(e) => setPrecoCusto(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preço de Venda</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precoVenda}
                      onChange={(e) => setPrecoVenda(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preço Máximo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precoMaximo}
                      onChange={(e) => setPrecoMaximo(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preço de Fábrica</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precoFabrica}
                      onChange={(e) => setPrecoFabrica(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Custo Médio</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={custoMedio}
                      onChange={(e) => setCustoMedio(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="estoque" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estoque Mínimo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={estoqueMinimo}
                      onChange={(e) => setEstoqueMinimo(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Estoque Máximo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={estoqueMaximo}
                      onChange={(e) => setEstoqueMaximo(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="outros" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Peso Bruto (kg)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={pesoBruto}
                      onChange={(e) => setPesoBruto(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Peso Líquido (kg)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={pesoLiquido}
                      onChange={(e) => setPesoLiquido(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Altura (cm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={altura}
                      onChange={(e) => setAltura(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Largura (cm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={largura}
                      onChange={(e) => setLargura(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Comprimento (cm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={comprimento}
                      onChange={(e) => setComprimento(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Volume (m³)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={volumeM3}
                      onChange={(e) => setVolumeM3(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unidade de Compra</Label>
                    <Input
                      value={unidadeCompra}
                      onChange={(e) => setUnidadeCompra(e.target.value)}
                      placeholder="Ex: UN, KG, L"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unidade de Venda</Label>
                    <Input
                      value={unidadeVenda}
                      onChange={(e) => setUnidadeVenda(e.target.value)}
                      placeholder="Ex: UN, KG, L"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Validação Fiscal */}
            {mostrarValidacao && ncm && cfopNota && cstIcms && (
              <div className="mt-6">
                <ValidacaoFiscalRecebimento
                  valorUnitario={valorUnitarioNota || parseFloat(precoCusto) || 0}
                  quantidade={quantidadeNota || 1}
                  valorIcms={valorIcmsNota}
                  valorIpi={valorIpiNota}
                  valorPis={valorPisNota}
                  valorCofins={valorCofinsNota}
                  valorIcmsSt={valorIcmsStNota}
                  cstIcms={cstIcms}
                  cstIpi={cstIpi || "99"}
                  cstPis={cstPis || "99"}
                  cstCofins={cstCofins || "99"}
                  cfop={cfopNota || cfopPadrao}
                  ncm={ncm}
                  aliquotaIcms={parseFloat(aliquotaIcms) || undefined}
                  aliquotaIpi={parseFloat(aliquotaIpi) || undefined}
                  aliquotaPis={parseFloat(aliquotaPis) || undefined}
                  aliquotaCofins={parseFloat(aliquotaCofins) || undefined}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              {!mostrarValidacao ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handlePreview}>
                    Validar Dados Fiscais
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setMostrarValidacao(false)}
                  >
                    Ajustar Dados
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar e Salvar
                  </Button>
                </>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
