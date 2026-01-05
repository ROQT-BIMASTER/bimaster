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
DOCUMENTAÇÃO TÉCNICA - API REST PARA INTEGRAÇÃO ERP
================================================================================
Versão: 2.0
Última atualização: ${new Date().toLocaleDateString('pt-BR')}

================================================================================
1. VISÃO GERAL
================================================================================

Este documento descreve a API REST para sincronização bidirecional de dados 
entre o sistema ERP e nossa plataforma de gestão financeira.

Protocolo: HTTP REST (HTTPS obrigatório em produção)
Autenticação: API Key via header
Formato: JSON

================================================================================
2. AUTENTICAÇÃO
================================================================================

Todas as requisições DEVEM incluir os headers:

| Header          | Valor                    | Obrigatório |
|-----------------|--------------------------|-------------|
| x-api-key       | [chave fornecida]        | Sim         |
| Content-Type    | application/json         | Sim         |

Exemplo:
curl -X POST "${SUPABASE_URL}/n8n-contas-receber/sync-start" \\
  -H "x-api-key: sua_api_key_aqui" \\
  -H "Content-Type: application/json"

================================================================================
3. BASE URL
================================================================================

Produção: ${SUPABASE_URL}

================================================================================
4. ENDPOINTS - CONTAS A RECEBER
================================================================================

Base: ${SUPABASE_URL}/n8n-contas-receber

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.1 GET /status - Verificar conectividade                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Resposta: { "status": "ok", "timestamp": "...", "total_registros": 12345 }  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.2 GET /health - Saúde do sistema                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Resposta: { "database": true, "sync_active": false, "last_sync": "..." }    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.3 POST /sync-start - Iniciar sessão de sincronização                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Body: {                                                                      │
│   "batchSize": 5000,        // Tamanho do lote (opcional, default: 5000)    │
│   "anoMinimo": 2023,        // Ano mínimo para filtrar dados (opcional)     │
│   "scope": "incremental"    // "full" ou "incremental"                      │
│ }                                                                            │
│                                                                              │
│ IMPORTANTE: Apenas 1 sincronização ativa por vez!                           │
│ Resposta: { "sync_id": "uuid", "started_at": "..." }                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.4 POST /sync-page - Enviar página de registros                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Body: {                                                                      │
│   "sync_id": "uuid-da-sessão",                                              │
│   "page": 1,                                                                 │
│   "contas": [ ... array de registros ... ]                                  │
│ }                                                                            │
│ Resposta: { "processed": 500, "errors": 0, "page": 1 }                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.5 POST /sync-finish - Finalizar sincronização                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Body: { "sync_id": "uuid-da-sessão" }                                       │
│ Resposta: { "status": "completed", "total_processed": 5000, "duration": 45 }│
└─────────────────────────────────────────────────────────────────────────────┘

ENDPOINT ALTERNATIVO PARA CARGA MASSIVA:
────────────────────────────────────────

${SUPABASE_URL}/contas-receber-api/bulk-sync

┌─────────────────────────────────────────────────────────────────────────────┐
│ POST /bulk-sync - Carga massiva (até 100.000 registros)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Body: {                                                                      │
│   "contas": [ ... array de registros ... ],                                 │
│   "clearExisting": false   // Limpar registros existentes antes?            │
│ }                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘

${SUPABASE_URL}/contas-receber-api/sync-chunk

┌─────────────────────────────────────────────────────────────────────────────┐
│ POST /sync-chunk - RECOMENDADO PARA N8N                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Processa chunks de 5.000 a 10.000 registros com tratamento de erros.        │
│ Body: { "contas": [ ... ] }                                                 │
│ Resposta: { "inserted": 4500, "updated": 450, "errors": 50 }                │
└─────────────────────────────────────────────────────────────────────────────┘

PAYLOAD ESPERADO - CONTAS A RECEBER:
────────────────────────────────────

Formato 1 (Nomes amigáveis):
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

Formato 2 (JSON alternativo):
{
  "empresa_id": 1,
  "empresa_nome": "NOME EMPRESA",
  "tipo_documento": "DUP",
  "numero_documento": "NF-001",
  "conta": "123456",
  "parcela": 1,
  "cliente_codigo": "C001",
  "cliente_nome": "NOME CLIENTE",
  "portador_id": "001",
  "portador_nome": "BANCO X",
  "data_emissao": "2025-01-01",
  "data_vencimento": "2025-02-01",
  "data_recebimento": null,
  "valor_original": 1500.00,
  "valor_desconto": 0.00,
  "valor_juros": 0.00,
  "valor_ajustes": 0.00,
  "valor_recebido": 0.00,
  "valor_aberto": 1500.00,
  "status": "aberto",
  "vendedor_codigo": "V001",
  "vendedor_nome": "NOME VENDEDOR",
  "tabela_preco": "T01"
}

================================================================================
5. ENDPOINTS - CONTAS A PAGAR
================================================================================

Base: ${SUPABASE_URL}/contas-pagar-api

┌─────────────────────────────────────────────────────────────────────────────┐
│ POST /sync - Sincronização de contas a pagar                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Body: { "contas": [ ... array de registros ... ] }                          │
│ Resposta: { "inserted": 100, "updated": 50, "total": 150 }                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ GET / - Consultar contas a pagar                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Query params: ?limit=100&status=aberto                                      │
└─────────────────────────────────────────────────────────────────────────────┘

PAYLOAD ESPERADO - CONTAS A PAGAR:
──────────────────────────────────

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

================================================================================
6. ENDPOINTS - ESTOQUE
================================================================================

Base: ${SUPABASE_URL}/estoque-n8n-sync

┌─────────────────────────────────────────────────────────────────────────────┐
│ POST / - Sincronização completa de estoque                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Body: {                                                                      │
│   "distribuidoras": [ ... ],    // Lista de distribuidoras                  │
│   "produtos_master": [ ... ],   // Produtos master                          │
│   "vinculacoes": [ ... ],       // Vínculos produto-distribuidora           │
│   "movimentacoes": [ ... ]      // Movimentações de estoque                 │
│ }                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘

Consultas: ${SUPABASE_URL}/estoque-api

- GET ?tipo=por-distribuidora&distribuidora_id=XXX
- GET ?tipo=por-produto-master&produto_master_id=XXX
- GET ?tipo=consolidado&categoria=XXX
- GET ?tipo=movimentacoes&estoque_id=XXX&data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
- GET ?tipo=sync-logs&status=XXX

================================================================================
7. TRATAMENTO DE ERROS
================================================================================

Códigos HTTP:

| Código | Significado                    | Ação Recomendada                |
|--------|--------------------------------|---------------------------------|
| 200    | Sucesso                        | Prosseguir normalmente          |
| 207    | Sucesso parcial (alguns erros) | Verificar campo "errors"        |
| 400    | Requisição inválida            | Verificar payload/parâmetros    |
| 401    | Não autorizado                 | Verificar x-api-key             |
| 413    | Payload muito grande           | Reduzir tamanho do chunk        |
| 429    | Rate limit excedido            | Aguardar e retry com backoff    |
| 500    | Erro interno do servidor       | Retry com backoff exponencial   |

Estrutura de erro:
{
  "error": "Descrição do erro",
  "code": "VALIDATION_ERROR",
  "details": { ... }
}

Lógica de retry recomendada:
- 1ª tentativa: aguardar 1 segundo
- 2ª tentativa: aguardar 2 segundos
- 3ª tentativa: aguardar 4 segundos
- Máximo: 5 tentativas

================================================================================
8. RECOMENDAÇÕES DE PERFORMANCE
================================================================================

TAMANHO DE CHUNK RECOMENDADO:
┌──────────────────────┬───────────────────┐
│ Cenário              │ Chunk Size        │
├──────────────────────┼───────────────────┤
│ Sincronização diária │ 5.000 - 10.000    │
│ Carga inicial        │ 10.000 - 20.000   │
│ Rede lenta           │ 2.000 - 5.000     │
└──────────────────────┴───────────────────┘

INTERVALO ENTRE CHUNKS: 3.000 ms (3 segundos)

SINCRONIZAÇÕES SIMULTÂNEAS: Máximo 1 por endpoint

TIMEOUT RECOMENDADO: 60.000 ms (1 minuto)

DICAS DE OTIMIZAÇÃO:
- Use filtros de ano para reduzir volume de dados
- Priorize horários de menor carga (noite/madrugada)
- Implemente retry com backoff exponencial
- Monitore os logs de sincronização

================================================================================
9. QUERIES SQL SUGERIDAS
================================================================================

-- CONTAS A RECEBER (com paginação)
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
OFFSET @offset ROWS;

-- CONTAS A PAGAR (com paginação)
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
OFFSET @offset ROWS;

================================================================================
10. CONFIGURAÇÃO N8N
================================================================================

Node HTTP Request:
- Timeout: 60000ms
- Retry on Fail: true
- Max Retries: 3
- Retry Delay: 3000ms

Node SQL Server:
- Connection Timeout: 60000ms
- Request Timeout: 120000ms

================================================================================
11. SEGURANÇA
================================================================================

- API Key obrigatória em todas as requisições
- HTTPS obrigatório em produção
- IP Whitelist recomendado (solicitar IPs para liberação)
- Logs de auditoria mantidos por 90 dias

================================================================================
12. INFORMAÇÕES NECESSÁRIAS DO ERP
================================================================================

Por favor, nos forneça:

[ ] Nomes exatos dos campos no ERP (para mapeamento)
[ ] Views ou tabelas de origem dos dados
[ ] Credenciais de acesso (usuário somente leitura)
[ ] IP/DNS do servidor para whitelist
[ ] Estimativa de volume de registros por entidade
[ ] Horários recomendados para sincronização (menor carga)
[ ] Contato técnico para suporte

================================================================================
13. CONTATOS
================================================================================

Em caso de dúvidas técnicas, entrar em contato com a equipe responsável.

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
                      <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Recomendado para N8N:</strong> Use <code>/sync-chunk</code> para processamento otimizado
                        </AlertDescription>
                      </Alert>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>POST</Badge>
                            <Badge variant="outline" className="text-xs">Recomendado</Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-receber-api/sync-chunk`, "cr-chunk")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-receber-api/sync-chunk</code>
                        <p className="text-xs text-muted-foreground mt-1">Sincronização em chunks (5.000-10.000 registros)</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge>POST</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-receber-api/bulk-sync`, "cr-bulk")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-receber-api/bulk-sync</code>
                        <p className="text-xs text-muted-foreground mt-1">Carga massiva (até 100.000 registros)</p>
                      </div>

                      <Separator className="my-2" />
                      <p className="text-xs text-muted-foreground font-medium">Endpoints de Sessão:</p>

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
                        <p className="text-xs text-muted-foreground mt-1">Verificar status e conectividade</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/n8n-contas-receber/health`, "cr-health")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/n8n-contas-receber/health</code>
                        <p className="text-xs text-muted-foreground mt-1">Saúde do sistema e configurações ativas</p>
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
                        <p className="text-xs text-muted-foreground mt-1">Iniciar sessão de sincronização</p>
                      </div>

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
                        <p className="text-xs text-muted-foreground mt-1">Enviar página de registros</p>
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
                <AccordionItem value="endpoints-sync">
                  <AccordionTrigger>Sincronização (N8N)</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-3">
                      <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Endpoint principal para N8N:</strong> Sincroniza distribuidoras, produtos, vínculos e movimentações
                        </AlertDescription>
                      </Alert>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>POST</Badge>
                            <Badge variant="outline" className="text-xs">Sincronização</Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/estoque-n8n-sync`, "est-sync")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/estoque-n8n-sync</code>
                        <p className="text-xs text-muted-foreground mt-1">Sincronização completa de estoque</p>
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/50">
                        <p className="text-xs font-medium mb-2">Payload de Sincronização:</p>
                        <pre className="text-xs overflow-x-auto">{`{
  "distribuidoras": [
    { "cnpj": "12345678901234", "nome": "Distribuidora X", "cidade": "São Paulo", "uf": "SP" }
  ],
  "produtos_master": [
    { "sku_master": "PROD001", "nome": "Produto Exemplo", "categoria": "Categoria A" }
  ],
  "vinculacoes": [
    { "distribuidora_cnpj": "12345678901234", "sku_master": "PROD001", "sku_distribuidora": "SKU-001" }
  ],
  "movimentacoes": [
    { "estoque_id": "uuid", "tipo_movimento": "entrada", "quantidade": 100 }
  ]
}`}</pre>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="endpoints-consulta">
                  <AccordionTrigger>Consultas (API)</AccordionTrigger>
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
