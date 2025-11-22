import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { geraCredIcms, geraCredPisCofins, getTipoCreditoICMS, getTipoCreditoPisCofins, getDescricaoTipoOperacao } from "@/lib/fabrica/fiscal-rules";

interface ValidacaoFiscalRecebimentoProps {
  // Dados do produto
  valorUnitario: number;
  quantidade: number;
  
  // Impostos
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  valorIcmsSt: number;
  
  // CSTs
  cstIcms: string;
  cstIpi: string;
  cstPis: string;
  cstCofins: string;
  
  // Fiscal
  cfop: string;
  ncm: string;
  
  // Percentuais
  aliquotaIcms?: number;
  aliquotaIpi?: number;
  aliquotaPis?: number;
  aliquotaCofins?: number;
}

export const ValidacaoFiscalRecebimento = ({
  valorUnitario,
  quantidade,
  valorIcms,
  valorIpi,
  valorPis,
  valorCofins,
  valorIcmsSt,
  cstIcms,
  cstIpi,
  cstPis,
  cstCofins,
  cfop,
  ncm,
  aliquotaIcms,
  aliquotaIpi,
  aliquotaPis,
  aliquotaCofins,
}: ValidacaoFiscalRecebimentoProps) => {
  
  // Cálculos de custo
  const valorTotal = valorUnitario * quantidade;
  const totalImpostos = valorIcms + valorIpi + valorPis + valorCofins + valorIcmsSt;
  const custoFinal = valorTotal + valorIpi + valorIcmsSt; // IPI e ST agregam ao custo
  const custoUnitarioFinal = custoFinal / quantidade;
  
  // Créditos fiscais
  const creditoIcms = geraCredIcms(cstIcms, cfop) ? valorIcms : 0;
  const creditoPis = geraCredPisCofins(cstPis) ? valorPis : 0;
  const creditoCofins = geraCredPisCofins(cstCofins) ? valorCofins : 0;
  const totalCreditos = creditoIcms + creditoPis + creditoCofins;
  
  // Tipos de crédito
  const tipoCreditoIcms = getTipoCreditoICMS(cstIcms, cfop);
  const tipoCreditoPisCofins = getTipoCreditoPisCofins(cstPis);
  
  // Descrição da operação
  const descricaoOperacao = getDescricaoTipoOperacao(cfop);
  
  const formatMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  
  const CreditoIcon = ({ gera }: { gera: boolean }) => {
    return gera ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };
  
  return (
    <div className="space-y-4 bg-muted/50 p-4 rounded-lg border">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Validação Fiscal do Recebimento</h3>
      </div>
      
      {/* Composição de Custo */}
      <Card className="p-4 bg-card">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Composição de Custo de Entrada
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor dos Produtos:</span>
            <span className="font-medium">{formatMoeda(valorTotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>+ IPI Agregado:</span>
            <span>{formatMoeda(valorIpi)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>+ ICMS ST Agregado:</span>
            <span>{formatMoeda(valorIcmsSt)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>ICMS Próprio (não agrega):</span>
            <span>{formatMoeda(valorIcms)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Custo Final Total:</span>
            <span className="text-primary">{formatMoeda(custoFinal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Custo Unitário Final:</span>
            <span className="font-medium">{formatMoeda(custoUnitarioFinal)}</span>
          </div>
        </div>
      </Card>
      
      {/* Créditos Fiscais */}
      <Card className="p-4 bg-card">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Créditos Fiscais no Livro
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditoIcon gera={geraCredIcms(cstIcms, cfop)} />
              <span className="text-sm">ICMS</span>
              <Badge variant="outline" className="text-xs">
                CST {cstIcms}
              </Badge>
              {aliquotaIcms && (
                <span className="text-xs text-muted-foreground">({aliquotaIcms}%)</span>
              )}
            </div>
            <div className="text-right">
              <div className="font-medium">{formatMoeda(creditoIcms)}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {tipoCreditoIcms.replace('_', ' ')}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditoIcon gera={geraCredPisCofins(cstPis)} />
              <span className="text-sm">PIS</span>
              <Badge variant="outline" className="text-xs">
                CST {cstPis}
              </Badge>
              {aliquotaPis && (
                <span className="text-xs text-muted-foreground">({aliquotaPis}%)</span>
              )}
            </div>
            <div className="text-right">
              <div className="font-medium">{formatMoeda(creditoPis)}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {tipoCreditoPisCofins.replace('_', ' ')}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditoIcon gera={geraCredPisCofins(cstCofins)} />
              <span className="text-sm">COFINS</span>
              <Badge variant="outline" className="text-xs">
                CST {cstCofins}
              </Badge>
              {aliquotaCofins && (
                <span className="text-xs text-muted-foreground">({aliquotaCofins}%)</span>
              )}
            </div>
            <div className="text-right">
              <div className="font-medium">{formatMoeda(creditoCofins)}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {tipoCreditoPisCofins.replace('_', ' ')}
              </div>
            </div>
          </div>
          
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Total de Créditos:</span>
            <span className="text-success">{formatMoeda(totalCreditos)}</span>
          </div>
        </div>
      </Card>
      
      {/* Regra do CFOP */}
      <Card className="p-4 bg-card">
        <h4 className="font-medium mb-3">Regra do CFOP</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{cfop}</Badge>
            <span className="text-muted-foreground">{descricaoOperacao}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {cfop.startsWith('1') && '• Operação interna (dentro do estado)'}
            {cfop.startsWith('2') && '• Operação interestadual (fora do estado)'}
            {cfop.startsWith('3') && '• Operação de importação'}
          </div>
        </div>
      </Card>
      
      {/* Regra do NCM */}
      <Card className="p-4 bg-card">
        <h4 className="font-medium mb-3">Regra do NCM</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{ncm}</Badge>
            <span className="text-muted-foreground">Classificação fiscal</span>
          </div>
          <div className="text-xs text-muted-foreground">
            • Aplicam-se as alíquotas de ICMS, IPI, PIS/COFINS conforme NCM
            {valorIcmsSt > 0 && (
              <div className="mt-1 text-warning">• Produto sujeito à Substituição Tributária (ICMS ST)</div>
            )}
          </div>
        </div>
      </Card>
      
      {/* Resumo Final */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">Custo Final por Unidade:</span>
            <span className="text-lg font-bold text-primary">{formatMoeda(custoUnitarioFinal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total de Créditos Fiscais:</span>
            <span className="font-medium text-success">{formatMoeda(totalCreditos)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Carga Tributária Efetiva:</span>
            <span className="font-medium">
              {((totalImpostos / valorTotal) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
