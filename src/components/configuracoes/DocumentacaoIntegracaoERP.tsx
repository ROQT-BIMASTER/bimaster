import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Copy, 
  FileText, 
  Database, 
  Server, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  Download,
  ExternalLink,
  RefreshCw,
  Wallet,
  Package,
  Receipt
} from "lucide-react";

const SUPABASE_URL = "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1";

export function DocumentacaoIntegracaoERP() {
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      toast({ title: "Copiado!", description: "Texto copiado para a área de transferência" });
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const mensagemTI = `
================================================================================
REQUISITOS TÉCNICOS PARA INTEGRAÇÃO API - SISTEMA LOVABLE
================================================================================

Prezada equipe de TI,

Segue a documentação técnica para integração entre o ERP e nosso sistema de gestão.

--------------------------------------------------------------------------------
1. AUTENTICAÇÃO
--------------------------------------------------------------------------------

Todas as requisições devem incluir o header:
- x-api-key: [será fornecida após configuração]

--------------------------------------------------------------------------------
2. CONTAS A RECEBER
--------------------------------------------------------------------------------

Base URL: ${SUPABASE_URL}/n8n-contas-receber

ENDPOINTS DISPONÍVEIS:

a) POST /sync-page - Sincronização Paginada
   Headers:
   - x-api-key: [N8N_API_KEY]
   - Content-Type: application/json
   
   Body:
   {
     "sync_id": "uuid-da-sincronização",
     "page": 1,
     "contas": [...]
   }

b) GET /status - Verificar Status
   Query params: nenhum

c) POST /sync-start - Iniciar Sincronização
   Body: { "total_expected": 1000 }

d) POST /sync-finish - Finalizar Sincronização
   Body: { "sync_id": "uuid" }

PAYLOAD ESPERADO (cada registro):
{
  "ID Empresa": 1,
  "Empresa": "NOME EMPRESA",
  "Tipo": "DUP",
  "Conta": "123456",
  "Parcela": 1,
  "Documento": "NF-001",
  "Cliente Codigo": "C001",
  "Cliente": "NOME CLIENTE",
  "Portador ID": "001",
  "Portador": "BANCO X",
  "Data Emissão": "2025-01-01",
  "Data Vencimento": "2025-02-01",
  "Data Recebimento": null,
  "Valor Original": 1500.00,
  "Valor Desconto": 0.00,
  "Valor Juros": 0.00,
  "Valor Ajustes": 0.00,
  "Valor Recebido": 0.00,
  "Valor Aberto": 1500.00,
  "Status": "aberto",
  "Vendedor Codigo": "V001",
  "Vendedor": "NOME VENDEDOR",
  "Tabela": "T01"
}

--------------------------------------------------------------------------------
3. CONTAS A PAGAR
--------------------------------------------------------------------------------

Base URL: ${SUPABASE_URL}/contas-pagar-api

ENDPOINTS DISPONÍVEIS:

a) POST /sync - Sincronização
   Headers:
   - x-api-key: [N8N_API_KEY]
   - Content-Type: application/json
   
   Body:
   {
     "contas": [...]
   }

b) GET /contas-pagar-api - Consultar Contas
   Query params: limit (opcional)

c) GET /stats - Estatísticas de Sincronização

PAYLOAD ESPERADO (cada registro):
{
  "ID Empresa": 1,
  "Empresa": "NOME EMPRESA",
  "Tipo Documento": "NF",
  "Conta": "123456",
  "Parcela": 1,
  "Documento": "NF-001",
  "Fornecedor Codigo": "F001",
  "Fornecedor": "NOME FORNECEDOR",
  "Portador": "CAIXA",
  "Data Emissão": "2025-01-01",
  "Data Vencimento": "2025-02-01",
  "Data Pagamento": null,
  "Valor Original": 2500.00,
  "Valor Desconto": 0.00,
  "Valor Juros": 0.00,
  "Valor Ajustes": 0.00,
  "Valor Pago": 0.00,
  "Valor Aberto": 2500.00,
  "Status": "aberto"
}

--------------------------------------------------------------------------------
4. ESTOQUE
--------------------------------------------------------------------------------

Base URL: ${SUPABASE_URL}/estoque-api

ENDPOINTS DISPONÍVEIS:

a) GET ?tipo=por-distribuidora&distribuidora_id=XXX
   Retorna estoque por distribuidora

b) GET ?tipo=por-produto-master&produto_master_id=XXX
   Retorna estoque por produto master

c) GET ?tipo=consolidado&categoria=XXX
   Retorna estoque consolidado (categoria opcional)

d) GET ?tipo=movimentacoes&estoque_id=XXX&data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
   Retorna movimentações de estoque

e) GET ?tipo=sync-logs&status=XXX
   Retorna logs de sincronização

--------------------------------------------------------------------------------
5. REQUISITOS TÉCNICOS
--------------------------------------------------------------------------------

CONFIGURAÇÕES RECOMENDADAS PARA N8N:

Node SQL Server:
- Connection Timeout: 60000ms
- Request Timeout: 120000ms

Node HTTP Request:
- Timeout: 300000ms (5 minutos)
- Retry on Fail: true
- Max Retries: 3

PAGINAÇÃO RECOMENDADA:
- Chunk size: 500-1000 registros por requisição
- Intervalo entre chunks: 2-5 segundos

QUERIES SQL SUGERIDAS:

-- Contas a Receber (com paginação)
SELECT TOP (@pageSize)
  [ID Empresa], [Empresa], [Tipo], [Conta], [Parcela],
  [Documento], [Cliente Codigo], [Cliente], [Portador ID],
  [Portador], [Data Emissão], [Data Vencimento], [Data Recebimento],
  [Valor Original], [Valor Desconto], [Valor Juros], [Valor Ajustes],
  [Valor Recebido], [Valor Aberto], [Status], [Vendedor Codigo],
  [Vendedor], [Tabela]
FROM vw_contas_receber
WHERE [Data Emissão] >= @dataInicio
ORDER BY [Conta], [Parcela]
OFFSET @offset ROWS

-- Contas a Pagar (com paginação)
SELECT TOP (@pageSize)
  [ID Empresa], [Empresa], [Tipo Documento], [Conta], [Parcela],
  [Documento], [Fornecedor Codigo], [Fornecedor], [Portador],
  [Data Emissão], [Data Vencimento], [Data Pagamento],
  [Valor Original], [Valor Desconto], [Valor Juros], [Valor Ajustes],
  [Valor Pago], [Valor Aberto], [Status]
FROM vw_contas_pagar
WHERE [Data Emissão] >= @dataInicio
ORDER BY [Conta], [Parcela]
OFFSET @offset ROWS

--------------------------------------------------------------------------------
6. CONFIGURAÇÃO FUTURA - API DIRETA
--------------------------------------------------------------------------------

Para conexão direta sem N8N, precisaremos:

- Host do SQL Server: _______________
- Porta: _______________ (padrão: 1433)
- Nome do Database: _______________
- Usuário de leitura: _______________
- Senha: _______________
- IP do servidor para whitelist: _______________

Estes dados serão armazenados de forma segura como secrets.

--------------------------------------------------------------------------------
7. INFORMAÇÕES NECESSÁRIAS
--------------------------------------------------------------------------------

Por favor, nos forneça:

[ ] Nomes exatos dos campos no ERP (para mapeamento)
[ ] Views ou tabelas de origem dos dados
[ ] Credenciais de acesso (usuário somente leitura)
[ ] IP/DNS do servidor para whitelist
[ ] Estimativa de volume de registros por entidade
[ ] Horários recomendados para sincronização (menor carga)
[ ] Contato técnico para suporte

--------------------------------------------------------------------------------
8. CONTATOS
--------------------------------------------------------------------------------

Em caso de dúvidas técnicas sobre a integração, entrar em contato com a equipe responsável pelo sistema Lovable.

================================================================================
`;

  const payloadContasReceber = `{
  "ID Empresa": 1,
  "Empresa": "EMPRESA EXEMPLO LTDA",
  "Tipo": "DUP",
  "Conta": "000001",
  "Parcela": 1,
  "Documento": "NF-12345",
  "Cliente Codigo": "C00001",
  "Cliente": "CLIENTE EXEMPLO S.A.",
  "Portador ID": "001",
  "Portador": "BANCO DO BRASIL",
  "Data Emissão": "2025-01-01",
  "Data Vencimento": "2025-02-01",
  "Data Recebimento": null,
  "Valor Original": 1500.00,
  "Valor Desconto": 0.00,
  "Valor Juros": 0.00,
  "Valor Ajustes": 0.00,
  "Valor Recebido": 0.00,
  "Valor Aberto": 1500.00,
  "Status": "aberto",
  "Vendedor Codigo": "V001",
  "Vendedor": "VENDEDOR EXEMPLO",
  "Tabela": "TABELA01"
}`;

  const payloadContasPagar = `{
  "ID Empresa": 1,
  "Empresa": "EMPRESA EXEMPLO LTDA",
  "Tipo Documento": "NF",
  "Conta": "000001",
  "Parcela": 1,
  "Documento": "NF-FORN-12345",
  "Fornecedor Codigo": "F00001",
  "Fornecedor": "FORNECEDOR EXEMPLO LTDA",
  "Portador": "CAIXA GERAL",
  "Data Emissão": "2025-01-01",
  "Data Vencimento": "2025-02-01",
  "Data Pagamento": null,
  "Valor Original": 2500.00,
  "Valor Desconto": 0.00,
  "Valor Juros": 0.00,
  "Valor Ajustes": 0.00,
  "Valor Pago": 0.00,
  "Valor Aberto": 2500.00,
  "Status": "aberto"
}`;

  const sqlContasReceber = `-- Query SQL para Contas a Receber com paginação
DECLARE @pageSize INT = 1000;
DECLARE @offset INT = 0;
DECLARE @dataInicio DATE = '2024-01-01';

SELECT TOP (@pageSize)
  emp.ID_EMPRESA AS [ID Empresa],
  emp.NOME AS [Empresa],
  cr.TIPO AS [Tipo],
  cr.CONTA AS [Conta],
  cr.PARCELA AS [Parcela],
  cr.DOCUMENTO AS [Documento],
  cli.CODIGO AS [Cliente Codigo],
  cli.NOME AS [Cliente],
  port.ID AS [Portador ID],
  port.NOME AS [Portador],
  CONVERT(VARCHAR, cr.DATA_EMISSAO, 23) AS [Data Emissão],
  CONVERT(VARCHAR, cr.DATA_VENCIMENTO, 23) AS [Data Vencimento],
  CONVERT(VARCHAR, cr.DATA_RECEBIMENTO, 23) AS [Data Recebimento],
  cr.VALOR_ORIGINAL AS [Valor Original],
  ISNULL(cr.VALOR_DESCONTO, 0) AS [Valor Desconto],
  ISNULL(cr.VALOR_JUROS, 0) AS [Valor Juros],
  ISNULL(cr.VALOR_AJUSTES, 0) AS [Valor Ajustes],
  ISNULL(cr.VALOR_RECEBIDO, 0) AS [Valor Recebido],
  cr.VALOR_ABERTO AS [Valor Aberto],
  CASE 
    WHEN cr.DATA_RECEBIMENTO IS NOT NULL THEN 'pago'
    WHEN cr.DATA_VENCIMENTO < GETDATE() THEN 'vencido'
    ELSE 'aberto'
  END AS [Status],
  vend.CODIGO AS [Vendedor Codigo],
  vend.NOME AS [Vendedor],
  tab.NOME AS [Tabela]
FROM CONTAS_RECEBER cr
  INNER JOIN EMPRESAS emp ON cr.EMPRESA_ID = emp.ID
  INNER JOIN CLIENTES cli ON cr.CLIENTE_ID = cli.ID
  LEFT JOIN PORTADORES port ON cr.PORTADOR_ID = port.ID
  LEFT JOIN VENDEDORES vend ON cr.VENDEDOR_ID = vend.ID
  LEFT JOIN TABELAS_PRECO tab ON cr.TABELA_ID = tab.ID
WHERE cr.DATA_EMISSAO >= @dataInicio
ORDER BY cr.CONTA, cr.PARCELA
OFFSET @offset ROWS;`;

  const sqlContasPagar = `-- Query SQL para Contas a Pagar com paginação
DECLARE @pageSize INT = 1000;
DECLARE @offset INT = 0;
DECLARE @dataInicio DATE = '2024-01-01';

SELECT TOP (@pageSize)
  emp.ID_EMPRESA AS [ID Empresa],
  emp.NOME AS [Empresa],
  cp.TIPO_DOCUMENTO AS [Tipo Documento],
  cp.CONTA AS [Conta],
  cp.PARCELA AS [Parcela],
  cp.DOCUMENTO AS [Documento],
  forn.CODIGO AS [Fornecedor Codigo],
  forn.NOME AS [Fornecedor],
  port.NOME AS [Portador],
  CONVERT(VARCHAR, cp.DATA_EMISSAO, 23) AS [Data Emissão],
  CONVERT(VARCHAR, cp.DATA_VENCIMENTO, 23) AS [Data Vencimento],
  CONVERT(VARCHAR, cp.DATA_PAGAMENTO, 23) AS [Data Pagamento],
  cp.VALOR_ORIGINAL AS [Valor Original],
  ISNULL(cp.VALOR_DESCONTO, 0) AS [Valor Desconto],
  ISNULL(cp.VALOR_JUROS, 0) AS [Valor Juros],
  ISNULL(cp.VALOR_AJUSTES, 0) AS [Valor Ajustes],
  ISNULL(cp.VALOR_PAGO, 0) AS [Valor Pago],
  cp.VALOR_ABERTO AS [Valor Aberto],
  CASE 
    WHEN cp.DATA_PAGAMENTO IS NOT NULL THEN 'pago'
    WHEN cp.DATA_VENCIMENTO < GETDATE() THEN 'vencido'
    ELSE 'aberto'
  END AS [Status]
FROM CONTAS_PAGAR cp
  INNER JOIN EMPRESAS emp ON cp.EMPRESA_ID = emp.ID
  INNER JOIN FORNECEDORES forn ON cp.FORNECEDOR_ID = forn.ID
  LEFT JOIN PORTADORES port ON cp.PORTADOR_ID = port.ID
WHERE cp.DATA_EMISSAO >= @dataInicio
ORDER BY cp.CONTA, cp.PARCELA
OFFSET @offset ROWS;`;

  const secrets = [
    { name: "N8N_API_KEY", description: "Chave de autenticação para requisições N8N", required: true },
    { name: "ERP_SQL_SERVER", description: "Host:Porta do SQL Server do ERP", required: false },
    { name: "ERP_SQL_DATABASE", description: "Nome do database no ERP", required: false },
    { name: "ERP_SQL_USER", description: "Usuário de leitura do SQL Server", required: false },
    { name: "ERP_SQL_PASSWORD", description: "Senha do usuário SQL Server", required: false },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Documentação de Integrações ERP
          </CardTitle>
          <CardDescription>
            Configurações e instruções para integração com o sistema ERP via N8N ou API direta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => copyToClipboard(mensagemTI, "mensagem-ti")}
              className="flex items-center gap-2"
            >
              {copiedSection === "mensagem-ti" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copiar Documento para TI
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([mensagemTI], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'requisitos-integracao-erp.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar como TXT
            </Button>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Importante</AlertTitle>
            <AlertDescription>
              Envie o documento acima para a equipe de TI do ERP. Eles precisarão configurar as views/queries 
              e fornecer as credenciais de acesso.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="contas-receber" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contas-receber" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Contas a Receber
          </TabsTrigger>
          <TabsTrigger value="contas-pagar" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="estoque" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contas-receber">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                API Contas a Receber
              </CardTitle>
              <CardDescription>
                Endpoints e configurações para sincronização de contas a receber
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="endpoints">
                  <AccordionTrigger>Endpoints Disponíveis</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge>POST</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/n8n-contas-receber/sync-page`, "cr-sync")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/n8n-contas-receber/sync-page</code>
                        <p className="text-xs text-muted-foreground mt-1">Sincronização paginada de contas</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/n8n-contas-receber/status`, "cr-status")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/n8n-contas-receber/status</code>
                        <p className="text-xs text-muted-foreground mt-1">Verificar status da API</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge>POST</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/n8n-contas-receber/sync-start`, "cr-start")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/n8n-contas-receber/sync-start</code>
                        <p className="text-xs text-muted-foreground mt-1">Iniciar processo de sincronização</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge>POST</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/n8n-contas-receber/sync-finish`, "cr-finish")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/n8n-contas-receber/sync-finish</code>
                        <p className="text-xs text-muted-foreground mt-1">Finalizar sincronização</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="payload">
                  <AccordionTrigger>Payload Esperado</AccordionTrigger>
                  <AccordionContent>
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(payloadContasReceber, "payload-cr")}
                      >
                        {copiedSection === "payload-cr" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <ScrollArea className="h-[300px]">
                        <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                          {payloadContasReceber}
                        </pre>
                      </ScrollArea>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sql">
                  <AccordionTrigger>Query SQL Exemplo</AccordionTrigger>
                  <AccordionContent>
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => copyToClipboard(sqlContasReceber, "sql-cr")}
                      >
                        {copiedSection === "sql-cr" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <ScrollArea className="h-[400px]">
                        <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                          {sqlContasReceber}
                        </pre>
                      </ScrollArea>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mapeamento">
                  <AccordionTrigger>Mapeamento de Campos</AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Campo API</th>
                            <th className="text-left p-2">Tipo</th>
                            <th className="text-left p-2">Obrigatório</th>
                            <th className="text-left p-2">Descrição</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["ID Empresa", "number", "Sim", "Código da empresa no ERP"],
                            ["Empresa", "string", "Sim", "Nome da empresa"],
                            ["Tipo", "string", "Sim", "Tipo do documento (DUP, NF, etc)"],
                            ["Conta", "string", "Sim", "Número da conta/título"],
                            ["Parcela", "number", "Sim", "Número da parcela"],
                            ["Cliente Codigo", "string", "Sim", "Código do cliente"],
                            ["Cliente", "string", "Sim", "Nome do cliente"],
                            ["Data Vencimento", "date", "Sim", "Data de vencimento (YYYY-MM-DD)"],
                            ["Valor Original", "number", "Sim", "Valor original do título"],
                            ["Valor Aberto", "number", "Sim", "Valor em aberto"],
                            ["Status", "string", "Sim", "aberto, pago ou vencido"],
                          ].map(([campo, tipo, obrig, desc], i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2 font-mono text-xs">{campo}</td>
                              <td className="p-2"><Badge variant="outline">{tipo}</Badge></td>
                              <td className="p-2">{obrig === "Sim" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : "-"}</td>
                              <td className="p-2 text-muted-foreground">{desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contas-pagar">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                API Contas a Pagar
              </CardTitle>
              <CardDescription>
                Endpoints e configurações para sincronização de contas a pagar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="endpoints">
                  <AccordionTrigger>Endpoints Disponíveis</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge>POST</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api/sync`, "cp-sync")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api/sync</code>
                        <p className="text-xs text-muted-foreground mt-1">Sincronização de contas a pagar</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api`, "cp-get")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api</code>
                        <p className="text-xs text-muted-foreground mt-1">Consultar contas a pagar</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api/stats`, "cp-stats")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api/stats</code>
                        <p className="text-xs text-muted-foreground mt-1">Estatísticas de sincronização</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="payload">
                  <AccordionTrigger>Payload Esperado</AccordionTrigger>
                  <AccordionContent>
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(payloadContasPagar, "payload-cp")}
                      >
                        {copiedSection === "payload-cp" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <ScrollArea className="h-[300px]">
                        <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                          {payloadContasPagar}
                        </pre>
                      </ScrollArea>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sql">
                  <AccordionTrigger>Query SQL Exemplo</AccordionTrigger>
                  <AccordionContent>
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => copyToClipboard(sqlContasPagar, "sql-cp")}
                      >
                        {copiedSection === "sql-cp" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <ScrollArea className="h-[400px]">
                        <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                          {sqlContasPagar}
                        </pre>
                      </ScrollArea>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estoque">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                API Estoque
              </CardTitle>
              <CardDescription>
                Endpoints para consulta de estoque e movimentações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="endpoints">
                  <AccordionTrigger>Endpoints Disponíveis</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/estoque-api?tipo=por-distribuidora&distribuidora_id=XXX`, "est-dist")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/estoque-api?tipo=por-distribuidora</code>
                        <p className="text-xs text-muted-foreground mt-1">Estoque por distribuidora</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/estoque-api?tipo=consolidado`, "est-cons")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/estoque-api?tipo=consolidado</code>
                        <p className="text-xs text-muted-foreground mt-1">Estoque consolidado (opcional: &categoria=XXX)</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/estoque-api?tipo=movimentacoes&estoque_id=XXX`, "est-mov")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/estoque-api?tipo=movimentacoes</code>
                        <p className="text-xs text-muted-foreground mt-1">Movimentações de estoque</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/estoque-api?tipo=sync-logs`, "est-logs")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/estoque-api?tipo=sync-logs</code>
                        <p className="text-xs text-muted-foreground mt-1">Logs de sincronização</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracao">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Secrets Necessários
                </CardTitle>
                <CardDescription>
                  Chaves e credenciais configuradas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {secrets.map((secret) => (
                    <div key={secret.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-mono text-sm">{secret.name}</p>
                          <p className="text-xs text-muted-foreground">{secret.description}</p>
                        </div>
                      </div>
                      <Badge variant={secret.required ? "default" : "outline"}>
                        {secret.required ? "Obrigatório" : "Opcional"}
                      </Badge>
                    </div>
                  ))}
                </div>

                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Configuração de Secrets</AlertTitle>
                  <AlertDescription>
                    Os secrets são configurados no backend (Lovable Cloud). 
                    A API key N8N é obrigatória para sincronizações via webhook.
                    Os secrets ERP_SQL_* são necessários apenas para conexão direta ao banco do ERP.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Configurações N8N Recomendadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Node SQL Server</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>• Connection Timeout: <span className="font-mono">60000ms</span></p>
                        <p>• Request Timeout: <span className="font-mono">120000ms</span></p>
                        <p>• Pool Size: <span className="font-mono">10</span></p>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Node HTTP Request</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>• Timeout: <span className="font-mono">300000ms</span></p>
                        <p>• Retry on Fail: <span className="font-mono">true</span></p>
                        <p>• Max Retries: <span className="font-mono">3</span></p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">Recomendações de Paginação</h4>
                    <div className="p-4 bg-muted rounded-lg">
                      <ul className="space-y-1 text-sm">
                        <li>• Chunk size: <span className="font-mono">500-1000</span> registros por requisição</li>
                        <li>• Intervalo entre chunks: <span className="font-mono">2-5 segundos</span></li>
                        <li>• Horário recomendado: fora do horário comercial</li>
                        <li>• Frequência: diária ou conforme necessidade</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Headers Necessários</h4>
                    <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                      <p>x-api-key: $&#123;N8N_API_KEY&#125;</p>
                      <p>Content-Type: application/json</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
