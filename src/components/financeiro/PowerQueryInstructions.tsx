import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Copy, Check, FileSpreadsheet, Code, Database, 
  ChevronDown, ChevronUp, Zap, AlertCircle, CheckCircle,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const SUPABASE_PROJECT_ID = 'aokkyrgaqjarhlywhjju';
const ENDPOINT_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/contas-receber-powerquery`;

const powerQueryCode = `let
    // =====================================================
    // SINCRONIZAÇÃO POWER QUERY → SUPABASE
    // Contas a Receber - Integração Direta
    // =====================================================
    
    // 1. CONFIGURE SUA FONTE DE DADOS
    // Substitua pela sua conexão com SQL Server
    Fonte = Sql.Database("SEU_SERVIDOR", "SEU_BANCO", [Query="
        SELECT 
            EMPRESA as [ID Empresa],
            EMPRESA_NOME as [Empresa],
            TIPO as [Tipo],
            NOTA as [Nota],
            SEQ as [Seq],
            CODIGO as [Codigo],
            CLIENTE as [Cliente],
            VALOR as [Valor_Trc],
            SALDO as [Valor em Aberto],
            VALOR_PAGO as [Valor Pago],
            JUROS as [Valor Juros],
            DESCONTO as [Valor Desconto],
            DT_EMISSAO as [Emissao],
            DT_VENCIMENTO as [Vencimento],
            DT_PAGAMENTO as [Data Pgto],
            VENDEDOR as [Vendedor],
            PORTADOR as [Nome Portador],
            TABELA as [Tabela],
            CONTA as [Conta]
        FROM CONTAS_RECEBER
        WHERE DT_VENCIMENTO >= DATEADD(year, -2, GETDATE())
    "]),
    
    // 2. Converter tabela para formato JSON
    RegistrosJson = Json.FromValue(Table.ToRecords(Fonte)),
    
    // 3. Enviar para API do Supabase
    Response = Web.Contents(
        "${ENDPOINT_URL}",
        [
            Headers = [
                #"Content-Type" = "application/json"
            ],
            Content = RegistrosJson,
            Timeout = #duration(0, 0, 10, 0) // 10 minutos timeout
        ]
    ),
    
    // 4. Parsear resposta
    Resultado = Json.Document(Response)
in
    Resultado`;

const powerQueryCodeSimple = `let
    // VERSÃO SIMPLIFICADA - Use se sua query já está pronta
    
    // 1. Sua tabela já transformada
    Dados = SuaTabelaTransformada,
    
    // 2. Converter para JSON e enviar
    Response = Web.Contents(
        "${ENDPOINT_URL}",
        [
            Headers = [#"Content-Type" = "application/json"],
            Content = Json.FromValue(Table.ToRecords(Dados)),
            Timeout = #duration(0, 0, 10, 0)
        ]
    ),
    
    Resultado = Json.Document(Response)
in
    Resultado`;

const columnMapping = [
  { powerQuery: 'ID Empresa', supabase: 'empresa_id', type: 'integer', required: true },
  { powerQuery: 'Empresa', supabase: 'empresa_nome', type: 'text', required: false },
  { powerQuery: 'Tipo', supabase: 'tipo_documento', type: 'text', required: false },
  { powerQuery: 'Nota', supabase: 'numero_documento', type: 'text', required: true },
  { powerQuery: 'Seq', supabase: 'parcela', type: 'integer', required: false },
  { powerQuery: 'Codigo', supabase: 'cliente_codigo', type: 'text', required: true },
  { powerQuery: 'Cliente', supabase: 'cliente_nome', type: 'text', required: false },
  { powerQuery: 'Valor_Trc', supabase: 'valor_original', type: 'numeric', required: true },
  { powerQuery: 'Valor em Aberto', supabase: 'valor_aberto', type: 'numeric', required: false },
  { powerQuery: 'Valor Pago', supabase: 'valor_recebido', type: 'numeric', required: false },
  { powerQuery: 'Valor Juros', supabase: 'valor_juros', type: 'numeric', required: false },
  { powerQuery: 'Valor Desconto', supabase: 'valor_desconto', type: 'numeric', required: false },
  { powerQuery: 'Emissao', supabase: 'data_emissao', type: 'date', required: false },
  { powerQuery: 'Vencimento', supabase: 'data_vencimento', type: 'date', required: true },
  { powerQuery: 'Data Pgto', supabase: 'data_recebimento', type: 'date', required: false },
  { powerQuery: 'Vendedor', supabase: 'vendedor', type: 'text', required: false },
  { powerQuery: 'Nome Portador', supabase: 'portador', type: 'text', required: false },
  { powerQuery: 'Tabela', supabase: 'tabela', type: 'text', required: false },
  { powerQuery: 'Conta', supabase: 'conta', type: 'text', required: false },
];

export function PowerQueryInstructions() {
  const [copied, setCopied] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success('Copiado para a área de transferência!');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Integração Power Query / Power BI
          </CardTitle>
          <CardDescription>
            Envie dados diretamente do Power Query para o banco de dados sem intermediários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
              <Database className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Direto ao Banco</p>
                <p className="text-xs text-muted-foreground">Sem N8N ou webhooks externos</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
              <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Até 10.000 reg/req</p>
                <p className="text-xs text-muted-foreground">Processa grandes volumes</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Upsert Inteligente</p>
                <p className="text-xs text-muted-foreground">Insere novos, atualiza alterados</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoint Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endpoint da API</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
            <code className="flex-1 break-all">{ENDPOINT_URL}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(ENDPOINT_URL, 'endpoint')}
            >
              {copied === 'endpoint' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            <Badge>POST</Badge>
            <Badge variant="outline">Content-Type: application/json</Badge>
            <Badge variant="secondary">Público (sem autenticação)</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Code Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Código Power Query (M Language)
          </CardTitle>
          <CardDescription>
            Copie e cole no Editor Avançado do Power Query
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="complete">
            <TabsList className="mb-4">
              <TabsTrigger value="complete">Código Completo</TabsTrigger>
              <TabsTrigger value="simple">Versão Simplificada</TabsTrigger>
            </TabsList>

            <TabsContent value="complete">
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => copyToClipboard(powerQueryCode, 'code-complete')}
                >
                  {copied === 'code-complete' ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar Código
                    </>
                  )}
                </Button>
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono max-h-96">
                  {powerQueryCode}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="simple">
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => copyToClipboard(powerQueryCodeSimple, 'code-simple')}
                >
                  {copied === 'code-simple' ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar Código
                    </>
                  )}
                </Button>
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">
                  {powerQueryCodeSimple}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Column Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Mapeamento de Colunas</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Mostrar Todos
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            Nomes de colunas esperados no Power Query → campos no banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coluna Power Query</TableHead>
                  <TableHead>Campo Supabase</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Obrigatório</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(showAdvanced ? columnMapping : columnMapping.filter(c => c.required)).map((col) => (
                  <TableRow key={col.supabase}>
                    <TableCell className="font-mono text-sm">{col.powerQuery}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{col.supabase}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{col.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {col.required ? (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Sim</Badge>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!showAdvanced && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando apenas colunas obrigatórias. Clique em "Mostrar Todos" para ver todas as opções.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step by Step */}
      <Card>
        <CardHeader>
          <CardTitle>Passo a Passo</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium">Abra o Power Query Editor</p>
                <p className="text-sm text-muted-foreground">No Excel: Dados → Obter Dados → Iniciar Editor. No Power BI: Transformar Dados.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p className="font-medium">Crie uma nova Query em branco</p>
                <p className="text-sm text-muted-foreground">Página Inicial → Nova Fonte → Consulta em Branco</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p className="font-medium">Abra o Editor Avançado</p>
                <p className="text-sm text-muted-foreground">Página Inicial → Editor Avançado</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p className="font-medium">Cole o código M e adapte</p>
                <p className="text-sm text-muted-foreground">Substitua a conexão SQL Server pela sua e ajuste os nomes das colunas se necessário.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p className="font-medium">Execute a Query</p>
                <p className="text-sm text-muted-foreground">Clique em "Concluído" e depois em "Atualizar Tudo". O resultado mostrará as estatísticas da sincronização.</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600">
            <AlertCircle className="h-5 w-5" />
            Dicas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">•</span>
              <span><strong>Limite:</strong> Máximo de 10.000 registros por requisição. Para volumes maiores, divida em múltiplas queries.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">•</span>
              <span><strong>Timeout:</strong> O código inclui timeout de 10 minutos. Ajuste se necessário.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">•</span>
              <span><strong>Datas:</strong> Use formato DD/MM/YYYY ou YYYY-MM-DD. Outros formatos podem causar erros.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">•</span>
              <span><strong>Credenciais:</strong> No primeiro uso, autorize "Acesso Anônimo" quando solicitado.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">•</span>
              <span><strong>Power BI Service:</strong> Para agendamento automático, publique no Power BI Service e configure Refresh programado.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
