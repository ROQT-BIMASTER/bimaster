import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Receipt, TrendingUp, Package, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  // Classificação fiscal
  const [ncm, setNcm] = useState("");
  const [cest, setCest] = useState("");
  const [origemMercadoria, setOrigemMercadoria] = useState("");
  const [classificacaoFiscal, setClassificacaoFiscal] = useState("");
  const [classificacaoPisCofins, setClassificacaoPisCofins] = useState("");
  const [cstpPis, setCstpPis] = useState("");
  const [codNbm, setCodNbm] = useState("");
  const [excecaoNcm, setExcecaoNcm] = useState("");
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

  // Preços
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [precoMaximo, setPrecoMaximo] = useState("");
  const [precoFabrica, setPrecoFabrica] = useState("");
  const [custoMedio, setCustoMedio] = useState("");
  const [custoIcms, setCustoIcms] = useState("");
  const [custoIcmsPercentual, setCustoIcmsPercentual] = useState("");

  // Margens
  const [markupPercentual, setMarkupPercentual] = useState("");
  const [descontoMaximo, setDescontoMaximo] = useState("");
  const [descontoEntrada, setDescontoEntrada] = useState("");
  const [descontoCompra, setDescontoCompra] = useState("");
  const [comissaoVenda, setComissaoVenda] = useState("");
  const [comissaoCobranca, setComissaoCobranca] = useState("");

  // Estoque
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [estoqueMaximo, setEstoqueMaximo] = useState("");
  const [reserva, setReserva] = useState("");
  const [qtdMinima, setQtdMinima] = useState("");
  const [qtdMaxima, setQtdMaxima] = useState("");
  const [qtdMaxDiaVendedor, setQtdMaxDiaVendedor] = useState("");
  const [qtdMaxDiaCliente, setQtdMaxDiaCliente] = useState("");

  // Pesos
  const [pesoBruto, setPesoBruto] = useState("");
  const [pesoLiquido, setPesoLiquido] = useState("");

  // Curvas
  const [curvaFisica, setCurvaFisica] = useState("");
  const [curvaMonetaria, setCurvaMonetaria] = useState("");

  // Compra/Venda
  const [caixaPadraoCompra, setCaixaPadraoCompra] = useState("");
  const [unidadeCompra, setUnidadeCompra] = useState("");
  const [unidadeVenda, setUnidadeVenda] = useState("");

  // Outros
  const [frete, setFrete] = useState("");
  const [repasseIcm, setRepasseIcm] = useState("");
  const [substancia, setSubstancia] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Carregar dados existentes
  useEffect(() => {
    if (open && produtoId) {
      carregarDados();
    }
  }, [open, produtoId]);

  const carregarDados = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_dados_fiscais_produto")
        .select("*")
        .eq("produto_id", produtoId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setDadosId(data.id);
        // Classificação fiscal
        setNcm(data.ncm || "");
        setCest(data.cest || "");
        setOrigemMercadoria(data.origem_mercadoria || "");
        setClassificacaoFiscal(data.classificacao_fiscal || "");
        setClassificacaoPisCofins(data.classificacao_pis_cofins || "");
        setCstpPis(data.cstp_pis || "");
        setCodNbm(data.cod_nbm || "");
        setExcecaoNcm(data.excecao_ncm || "");
        setCfopPadrao(data.cfop_padrao || "");
        
        // Impostos
        setAliquotaIcms(data.aliquota_icms?.toString() || "");
        setAliquotaIpi(data.aliquota_ipi?.toString() || "");
        setAliquotaPis(data.aliquota_pis?.toString() || "");
        setAliquotaCofins(data.aliquota_cofins?.toString() || "");
        setCstIcms(data.cst_icms || "");
        setCstIpi(data.cst_ipi || "");
        setCstPis(data.cst_pis || "");
        setCstCofins(data.cst_cofins || "");
        
        // Preços
        setPrecoCusto(data.preco_custo?.toString() || "");
        setPrecoVenda(data.preco_venda?.toString() || "");
        setPrecoMaximo(data.preco_maximo?.toString() || "");
        setPrecoFabrica(data.preco_fabrica?.toString() || "");
        setCustoMedio(data.custo_medio?.toString() || "");
        setCustoIcms(data.custo_icms?.toString() || "");
        setCustoIcmsPercentual(data.custo_icms_percentual?.toString() || "");
        
        // Margens
        setMarkupPercentual(data.markup_percentual?.toString() || "");
        setDescontoMaximo(data.desconto_maximo?.toString() || "");
        setDescontoEntrada(data.desconto_entrada?.toString() || "");
        setDescontoCompra(data.desconto_compra?.toString() || "");
        setComissaoVenda(data.comissao_venda?.toString() || "");
        setComissaoCobranca(data.comissao_cobranca?.toString() || "");
        
        // Estoque
        setEstoqueMinimo(data.estoque_minimo?.toString() || "");
        setEstoqueMaximo(data.estoque_maximo?.toString() || "");
        setReserva(data.reserva?.toString() || "");
        setQtdMinima(data.qtd_minima?.toString() || "");
        setQtdMaxima(data.qtd_maxima?.toString() || "");
        setQtdMaxDiaVendedor(data.qtd_max_dia_vendedor?.toString() || "");
        setQtdMaxDiaCliente(data.qtd_max_dia_cliente?.toString() || "");
        
        // Pesos
        setPesoBruto(data.peso_bruto?.toString() || "");
        setPesoLiquido(data.peso_liquido?.toString() || "");
        
        // Curvas
        setCurvaFisica(data.curva_fisica || "");
        setCurvaMonetaria(data.curva_monetaria || "");
        
        // Compra/Venda
        setCaixaPadraoCompra(data.caixa_padrao_compra?.toString() || "");
        setUnidadeCompra(data.unidade_compra || "");
        setUnidadeVenda(data.unidade_venda || "");
        
        // Outros
        setFrete(data.frete?.toString() || "");
        setRepasseIcm(data.repasse_icm?.toString() || "");
        setSubstancia(data.substancia || "");
        setObservacoes(data.observacoes || "");
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados fiscais:", error);
      toast.error("Erro ao carregar dados fiscais");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      const dadosFiscais = {
        produto_id: produtoId,
        // Classificação fiscal
        ncm: ncm || null,
        cest: cest || null,
        origem_mercadoria: origemMercadoria || null,
        classificacao_fiscal: classificacaoFiscal || null,
        classificacao_pis_cofins: classificacaoPisCofins || null,
        cstp_pis: cstpPis || null,
        cod_nbm: codNbm || null,
        excecao_ncm: excecaoNcm || null,
        cfop_padrao: cfopPadrao || null,
        // Impostos
        aliquota_icms: aliquotaIcms ? parseFloat(aliquotaIcms) : null,
        aliquota_ipi: aliquotaIpi ? parseFloat(aliquotaIpi) : null,
        aliquota_pis: aliquotaPis ? parseFloat(aliquotaPis) : null,
        aliquota_cofins: aliquotaCofins ? parseFloat(aliquotaCofins) : null,
        cst_icms: cstIcms || null,
        cst_ipi: cstIpi || null,
        cst_pis: cstPis || null,
        cst_cofins: cstCofins || null,
        // Preços
        preco_custo: precoCusto ? parseFloat(precoCusto) : null,
        preco_venda: precoVenda ? parseFloat(precoVenda) : null,
        preco_maximo: precoMaximo ? parseFloat(precoMaximo) : null,
        preco_fabrica: precoFabrica ? parseFloat(precoFabrica) : null,
        custo_medio: custoMedio ? parseFloat(custoMedio) : null,
        custo_icms: custoIcms ? parseFloat(custoIcms) : null,
        custo_icms_percentual: custoIcmsPercentual ? parseFloat(custoIcmsPercentual) : null,
        // Margens
        markup_percentual: markupPercentual ? parseFloat(markupPercentual) : null,
        desconto_maximo: descontoMaximo ? parseFloat(descontoMaximo) : null,
        desconto_entrada: descontoEntrada ? parseFloat(descontoEntrada) : null,
        desconto_compra: descontoCompra ? parseFloat(descontoCompra) : null,
        comissao_venda: comissaoVenda ? parseFloat(comissaoVenda) : null,
        comissao_cobranca: comissaoCobranca ? parseFloat(comissaoCobranca) : null,
        // Estoque
        estoque_minimo: estoqueMinimo ? parseFloat(estoqueMinimo) : null,
        estoque_maximo: estoqueMaximo ? parseFloat(estoqueMaximo) : null,
        reserva: reserva ? parseFloat(reserva) : null,
        qtd_minima: qtdMinima ? parseFloat(qtdMinima) : null,
        qtd_maxima: qtdMaxima ? parseFloat(qtdMaxima) : null,
        qtd_max_dia_vendedor: qtdMaxDiaVendedor ? parseFloat(qtdMaxDiaVendedor) : null,
        qtd_max_dia_cliente: qtdMaxDiaCliente ? parseFloat(qtdMaxDiaCliente) : null,
        // Pesos
        peso_bruto: pesoBruto ? parseFloat(pesoBruto) : null,
        peso_liquido: pesoLiquido ? parseFloat(pesoLiquido) : null,
        // Curvas
        curva_fisica: curvaFisica || null,
        curva_monetaria: curvaMonetaria || null,
        // Compra/Venda
        caixa_padrao_compra: caixaPadraoCompra ? parseFloat(caixaPadraoCompra) : null,
        unidade_compra: unidadeCompra || null,
        unidade_venda: unidadeVenda || null,
        // Outros
        frete: frete ? parseFloat(frete) : null,
        repasse_icm: repasseIcm ? parseFloat(repasseIcm) : null,
        substancia: substancia || null,
        observacoes: observacoes || null,
        // Controle
        updated_at: new Date().toISOString(),
        created_by: session.session?.user.id,
      };

      if (dadosId) {
        // Update
        const { error } = await supabase
          .from("fabrica_dados_fiscais_produto")
          .update(dadosFiscais)
          .eq("id", dadosId);

        if (error) throw error;
        toast.success("Dados fiscais atualizados com sucesso");
      } else {
        // Insert
        const { error } = await supabase
          .from("fabrica_dados_fiscais_produto")
          .insert(dadosFiscais);

        if (error) throw error;
        toast.success("Dados fiscais cadastrados com sucesso");
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar dados fiscais:", error);
      toast.error(error.message || "Erro ao salvar dados fiscais");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Dados Fiscais - {produtoNome}
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="fiscal" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="fiscal">
                  <Receipt className="h-4 w-4 mr-2" />
                  Fiscal
                </TabsTrigger>
                <TabsTrigger value="precos">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Preços
                </TabsTrigger>
                <TabsTrigger value="estoque">
                  <Package className="h-4 w-4 mr-2" />
                  Estoque
                </TabsTrigger>
                <TabsTrigger value="outros">
                  <FileText className="h-4 w-4 mr-2" />
                  Outros
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fiscal" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="ncm">NCM</Label>
                    <Input
                      id="ncm"
                      value={ncm}
                      onChange={(e) => setNcm(e.target.value)}
                      placeholder="12345678"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cest">CEST</Label>
                    <Input
                      id="cest"
                      value={cest}
                      onChange={(e) => setCest(e.target.value)}
                      placeholder="1234567"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="origem">Origem Mercadoria</Label>
                    <Select value={origemMercadoria} onValueChange={setOrigemMercadoria}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - Nacional</SelectItem>
                        <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                        <SelectItem value="2">2 - Estrangeira (adquirida no mercado interno)</SelectItem>
                        <SelectItem value="3">3 - Nacional com conteúdo de importação &gt; 40%</SelectItem>
                        <SelectItem value="4">4 - Nacional produção via processos produtivos básicos</SelectItem>
                        <SelectItem value="5">5 - Nacional com conteúdo de importação &lt;= 40%</SelectItem>
                        <SelectItem value="6">6 - Estrangeira (importação direta sem similar nacional)</SelectItem>
                        <SelectItem value="7">7 - Estrangeira (adquirida mercado interno sem similar nacional)</SelectItem>
                        <SelectItem value="8">8 - Nacional com conteúdo de importação &gt; 70%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="class-fiscal">Classificação Fiscal</Label>
                    <Input
                      id="class-fiscal"
                      value={classificacaoFiscal}
                      onChange={(e) => setClassificacaoFiscal(e.target.value)}
                      placeholder="Classificação fiscal"
                      maxLength={100}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cfop">CFOP Padrão</Label>
                    <Input
                      id="cfop"
                      value={cfopPadrao}
                      onChange={(e) => setCfopPadrao(e.target.value)}
                      placeholder="5101"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="cst-icms">CST ICMS</Label>
                    <Input
                      id="cst-icms"
                      value={cstIcms}
                      onChange={(e) => setCstIcms(e.target.value)}
                      placeholder="00"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="aliq-icms">Alíquota ICMS (%)</Label>
                    <Input
                      id="aliq-icms"
                      type="number"
                      step="0.01"
                      value={aliquotaIcms}
                      onChange={(e) => setAliquotaIcms(e.target.value)}
                      placeholder="18.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cst-ipi">CST IPI</Label>
                    <Input
                      id="cst-ipi"
                      value={cstIpi}
                      onChange={(e) => setCstIpi(e.target.value)}
                      placeholder="50"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="aliq-ipi">Alíquota IPI (%)</Label>
                    <Input
                      id="aliq-ipi"
                      type="number"
                      step="0.01"
                      value={aliquotaIpi}
                      onChange={(e) => setAliquotaIpi(e.target.value)}
                      placeholder="10.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="cst-pis">CST PIS</Label>
                    <Input
                      id="cst-pis"
                      value={cstPis}
                      onChange={(e) => setCstPis(e.target.value)}
                      placeholder="01"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="aliq-pis">Alíquota PIS (%)</Label>
                    <Input
                      id="aliq-pis"
                      type="number"
                      step="0.01"
                      value={aliquotaPis}
                      onChange={(e) => setAliquotaPis(e.target.value)}
                      placeholder="1.65"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cst-cofins">CST COFINS</Label>
                    <Input
                      id="cst-cofins"
                      value={cstCofins}
                      onChange={(e) => setCstCofins(e.target.value)}
                      placeholder="01"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="aliq-cofins">Alíquota COFINS (%)</Label>
                    <Input
                      id="aliq-cofins"
                      type="number"
                      step="0.01"
                      value={aliquotaCofins}
                      onChange={(e) => setAliquotaCofins(e.target.value)}
                      placeholder="7.60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="class-pis-cofins">Classificação PIS/COFINS</Label>
                    <Input
                      id="class-pis-cofins"
                      value={classificacaoPisCofins}
                      onChange={(e) => setClassificacaoPisCofins(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cstp-pis">CSTP PIS</Label>
                    <Input
                      id="cstp-pis"
                      value={cstpPis}
                      onChange={(e) => setCstpPis(e.target.value)}
                      maxLength={10}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="precos" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="preco-custo">Preço Custo</Label>
                    <Input
                      id="preco-custo"
                      type="number"
                      step="0.01"
                      value={precoCusto}
                      onChange={(e) => setPrecoCusto(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="preco-venda">Preço Venda</Label>
                    <Input
                      id="preco-venda"
                      type="number"
                      step="0.01"
                      value={precoVenda}
                      onChange={(e) => setPrecoVenda(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="preco-maximo">Preço Máximo</Label>
                    <Input
                      id="preco-maximo"
                      type="number"
                      step="0.01"
                      value={precoMaximo}
                      onChange={(e) => setPrecoMaximo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="preco-fabrica">Preço Fábrica</Label>
                    <Input
                      id="preco-fabrica"
                      type="number"
                      step="0.01"
                      value={precoFabrica}
                      onChange={(e) => setPrecoFabrica(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="custo-medio">Custo Médio</Label>
                    <Input
                      id="custo-medio"
                      type="number"
                      step="0.01"
                      value={custoMedio}
                      onChange={(e) => setCustoMedio(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="custo-icms">Custo ICMS</Label>
                    <Input
                      id="custo-icms"
                      type="number"
                      step="0.01"
                      value={custoIcms}
                      onChange={(e) => setCustoIcms(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="markup">Mark-up (%)</Label>
                    <Input
                      id="markup"
                      type="number"
                      step="0.01"
                      value={markupPercentual}
                      onChange={(e) => setMarkupPercentual(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="desc-max">Desc. Máximo (%)</Label>
                    <Input
                      id="desc-max"
                      type="number"
                      step="0.01"
                      value={descontoMaximo}
                      onChange={(e) => setDescontoMaximo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="desc-entrada">Desc. Entrada (%)</Label>
                    <Input
                      id="desc-entrada"
                      type="number"
                      step="0.01"
                      value={descontoEntrada}
                      onChange={(e) => setDescontoEntrada(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="desc-compra">Desc. Compra (%)</Label>
                    <Input
                      id="desc-compra"
                      type="number"
                      step="0.01"
                      value={descontoCompra}
                      onChange={(e) => setDescontoCompra(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="comissao-venda">Comissão Venda (%)</Label>
                    <Input
                      id="comissao-venda"
                      type="number"
                      step="0.01"
                      value={comissaoVenda}
                      onChange={(e) => setComissaoVenda(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="comissao-cobranca">Comissão Cobrança (%)</Label>
                    <Input
                      id="comissao-cobranca"
                      type="number"
                      step="0.01"
                      value={comissaoCobranca}
                      onChange={(e) => setComissaoCobranca(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="estoque" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="est-min">Estoque Mínimo</Label>
                    <Input
                      id="est-min"
                      type="number"
                      step="0.01"
                      value={estoqueMinimo}
                      onChange={(e) => setEstoqueMinimo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="est-max">Estoque Máximo</Label>
                    <Input
                      id="est-max"
                      type="number"
                      step="0.01"
                      value={estoqueMaximo}
                      onChange={(e) => setEstoqueMaximo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="reserva">Reserva</Label>
                    <Input
                      id="reserva"
                      type="number"
                      step="0.01"
                      value={reserva}
                      onChange={(e) => setReserva(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="qtd-min">Quantidade Mínima</Label>
                    <Input
                      id="qtd-min"
                      type="number"
                      step="0.01"
                      value={qtdMinima}
                      onChange={(e) => setQtdMinima(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="qtd-max">Quantidade Máxima</Label>
                    <Input
                      id="qtd-max"
                      type="number"
                      step="0.01"
                      value={qtdMaxima}
                      onChange={(e) => setQtdMaxima(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="qtd-max-vend">Qtd. Máx. Dia Vendedor</Label>
                    <Input
                      id="qtd-max-vend"
                      type="number"
                      step="0.01"
                      value={qtdMaxDiaVendedor}
                      onChange={(e) => setQtdMaxDiaVendedor(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="qtd-max-cli">Qtd. Máx. Dia Cliente</Label>
                    <Input
                      id="qtd-max-cli"
                      type="number"
                      step="0.01"
                      value={qtdMaxDiaCliente}
                      onChange={(e) => setQtdMaxDiaCliente(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="peso-bruto">Peso Bruto (kg)</Label>
                    <Input
                      id="peso-bruto"
                      type="number"
                      step="0.001"
                      value={pesoBruto}
                      onChange={(e) => setPesoBruto(e.target.value)}
                      placeholder="0.000"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="peso-liq">Peso Líquido (kg)</Label>
                    <Input
                      id="peso-liq"
                      type="number"
                      step="0.001"
                      value={pesoLiquido}
                      onChange={(e) => setPesoLiquido(e.target.value)}
                      placeholder="0.000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="curva-fisica">Curva Física</Label>
                    <Select value={curvaFisica} onValueChange={setCurvaFisica}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - Alta</SelectItem>
                        <SelectItem value="B">B - Média</SelectItem>
                        <SelectItem value="C">C - Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="curva-monetaria">Curva Monetária</Label>
                    <Select value={curvaMonetaria} onValueChange={setCurvaMonetaria}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - Alta</SelectItem>
                        <SelectItem value="B">B - Média</SelectItem>
                        <SelectItem value="C">C - Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="outros" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="caixa-padrao">Caixa Padrão Compra</Label>
                    <Input
                      id="caixa-padrao"
                      type="number"
                      step="0.01"
                      value={caixaPadraoCompra}
                      onChange={(e) => setCaixaPadraoCompra(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="und-compra">Unidade Compra</Label>
                    <Input
                      id="und-compra"
                      value={unidadeCompra}
                      onChange={(e) => setUnidadeCompra(e.target.value)}
                      placeholder="UN, CX, KG"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="und-venda">Unidade Venda</Label>
                    <Input
                      id="und-venda"
                      value={unidadeVenda}
                      onChange={(e) => setUnidadeVenda(e.target.value)}
                      placeholder="UN, CX, KG"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="frete">Frete</Label>
                    <Input
                      id="frete"
                      type="number"
                      step="0.01"
                      value={frete}
                      onChange={(e) => setFrete(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="repasse-icm">Repasse ICM (%)</Label>
                    <Input
                      id="repasse-icm"
                      type="number"
                      step="0.01"
                      value={repasseIcm}
                      onChange={(e) => setRepasseIcm(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cod-nbm">Código NBM</Label>
                    <Input
                      id="cod-nbm"
                      value={codNbm}
                      onChange={(e) => setCodNbm(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="substancia">Substância</Label>
                  <Input
                    id="substancia"
                    value={substancia}
                    onChange={(e) => setSubstancia(e.target.value)}
                    placeholder="Descrição da substância"
                    maxLength={200}
                  />
                </div>

                <div>
                  <Label htmlFor="exc-ncm">Exceção NCM</Label>
                  <Input
                    id="exc-ncm"
                    value={excecaoNcm}
                    onChange={(e) => setExcecaoNcm(e.target.value)}
                    maxLength={20}
                  />
                </div>

                <div>
                  <Label htmlFor="obs">Observações</Label>
                  <Textarea
                    id="obs"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                    placeholder="Observações gerais sobre o produto..."
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dadosId ? "Atualizar" : "Salvar"} Dados Fiscais
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
