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
  Receipt,
  Plug,
  Zap,
  Shield,
  Globe
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
╔══════════════════════════════════════════════════════════════════════════════╗
║          DOCUMENTAÇÃO TÉCNICA - API REST PARA INTEGRAÇÃO ERP                 ║
║                    BiMaster / Union CRM - Versão 3.0                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

Documento: Especificação Técnica de Integração via API REST
Versão: 3.0
Data: ${new Date().toLocaleDateString('pt-BR')}
Classificação: Confidencial - Uso Interno

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÍNDICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.  VISÃO GERAL E ARQUITETURA
2.  AUTENTICAÇÃO E SEGURANÇA
3.  REQUISITOS TÉCNICOS
4.  ENDPOINTS - CONTAS A RECEBER
5.  ENDPOINTS - CONTAS A PAGAR
6.  ENDPOINTS - ESTOQUE
7.  ESTRUTURA DE DADOS (PAYLOADS)
8.  CÓDIGOS DE RESPOSTA HTTP
9.  TRATAMENTO DE ERROS
10. ESTRATÉGIA DE SINCRONIZAÇÃO PARA MILHÕES DE REGISTROS
11. QUERIES SQL DE REFERÊNCIA
12. CONFIGURAÇÃO N8N
13. MONITORAMENTO E LOGS
14. PONTOS DE ATENÇÃO - GERENCIAIS E TÉCNICOS ⚠️ IMPORTANTE
15. PERGUNTAS OBRIGATÓRIAS ANTES DE INICIAR
16. PLANO DE AÇÃO RECOMENDADO
17. CHECKLIST DE IMPLEMENTAÇÃO
18. SUPORTE TÉCNICO

═══════════════════════════════════════════════════════════════════════════════
1. VISÃO GERAL E ARQUITETURA
═══════════════════════════════════════════════════════════════════════════════

Esta API REST foi projetada para sincronização bidirecional de dados entre 
sistemas ERP e a plataforma BiMaster/Union CRM, com capacidade para processar
MILHÕES de registros de forma eficiente e segura.

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARQUITETURA DA INTEGRAÇÃO                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────────────────┐    │
│   │   ERP       │──────│    N8N      │──────│   API REST (Supabase)   │    │
│   │ (SQL Server)│ SQL  │ (Orquestrador) HTTP │   Edge Functions        │    │
│   └─────────────┘      └─────────────┘      └─────────────────────────┘    │
│                                                      │                      │
│                                              ┌───────┴───────┐              │
│                                              │   PostgreSQL  │              │
│                                              │   (Database)  │              │
│                                              └───────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

CARACTERÍSTICAS TÉCNICAS:
• Protocolo: HTTPS (TLS 1.2+) - Obrigatório em produção
• Formato de dados: JSON (UTF-8)
• Autenticação: API Key via header
• Rate Limit: 100 requisições/minuto por IP
• Timeout máximo: 60 segundos por requisição
• Payload máximo: 100.000 registros por requisição
• Sincronização concorrente: 1 por entidade (proteção contra deadlocks)

CAPACIDADE DE PROCESSAMENTO:
┌────────────────────────┬────────────────────┬─────────────────────┐
│ Volume                 │ Tempo Estimado     │ Throughput          │
├────────────────────────┼────────────────────┼─────────────────────┤
│ 10.000 registros       │ ~5 segundos        │ ~2.000 rec/seg      │
│ 100.000 registros      │ ~50 segundos       │ ~2.000 rec/seg      │
│ 500.000 registros      │ ~4 minutos         │ ~2.000 rec/seg      │
│ 1.000.000 registros    │ ~8 minutos         │ ~2.000 rec/seg      │
│ 5.000.000+ registros   │ ~40 minutos        │ ~2.000 rec/seg      │
└────────────────────────┴────────────────────┴─────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
2. AUTENTICAÇÃO E SEGURANÇA
═══════════════════════════════════════════════════════════════════════════════

HEADERS OBRIGATÓRIOS EM TODAS AS REQUISIÇÕES:

┌──────────────────┬─────────────────────────────────────────────────────────┐
│ Header           │ Valor / Descrição                                       │
├──────────────────┼─────────────────────────────────────────────────────────┤
│ x-api-key        │ [Chave API fornecida] - OBRIGATÓRIO                     │
│ Content-Type     │ application/json - OBRIGATÓRIO para POST/PUT            │
│ Accept           │ application/json - Recomendado                          │
└──────────────────┴─────────────────────────────────────────────────────────┘

OBTENÇÃO DA API KEY:
A chave de API será fornecida pela equipe técnica após validação do projeto.
A chave é única por ambiente (desenvolvimento/homologação/produção).

BOAS PRÁTICAS DE SEGURANÇA:
✓ Armazene a API Key em variáveis de ambiente, NUNCA no código-fonte
✓ Utilize HTTPS em todas as requisições (HTTP será rejeitado em produção)
✓ Implemente IP Whitelist quando possível
✓ Rotacione a API Key periodicamente (recomendado: a cada 90 dias)
✓ Monitore logs de acesso para detectar uso anômalo

═══════════════════════════════════════════════════════════════════════════════
3. REQUISITOS TÉCNICOS
═══════════════════════════════════════════════════════════════════════════════

AMBIENTE DO ERP:
• SQL Server 2016+ (recomendado 2019+)
• Usuário de leitura com acesso às tabelas/views necessárias
• Conexão de rede estável (latência < 100ms recomendada)
• Firewall liberado para saída HTTPS (porta 443)

N8N (RECOMENDADO PARA ORQUESTRAÇÃO):
• Versão: 1.0+ 
• Memória: 4GB+ para cargas massivas
• Timeout do workflow: 30 minutos
• Self-hosted ou N8N Cloud

FORMATOS DE DATA:
• Datas: ISO 8601 (YYYY-MM-DD) ou (YYYY-MM-DDTHH:mm:ss.sssZ)
• Valores monetários: Decimal com ponto (1500.50)
• Encoding: UTF-8

═══════════════════════════════════════════════════════════════════════════════
4. ENDPOINTS - CONTAS A RECEBER
═══════════════════════════════════════════════════════════════════════════════

BASE URL: ${SUPABASE_URL}

────────────────────────────────────────────────────────────────────────────────
4.1 VERIFICAÇÃO DE CONECTIVIDADE
────────────────────────────────────────────────────────────────────────────────

GET /n8n-contas-receber/status

Descrição: Verifica conectividade e retorna estatísticas do sistema.
Uso: Teste inicial de integração, health checks.

Resposta (200 OK):
{
  "status": "ok",
  "timestamp": "2025-01-05T10:30:00.000Z",
  "total_registros": 1234567,
  "ultima_sincronizacao": "2025-01-05T08:00:00.000Z"
}

────────────────────────────────────────────────────────────────────────────────
4.2 SAÚDE DO SISTEMA
────────────────────────────────────────────────────────────────────────────────

GET /n8n-contas-receber/health

Descrição: Verifica saúde do banco e status de sincronizações ativas.

Resposta (200 OK):
{
  "database": true,
  "sync_active": false,
  "last_sync": "2025-01-05T08:00:00.000Z",
  "response_time_ms": 45
}

────────────────────────────────────────────────────────────────────────────────
4.3 INICIAR SESSÃO DE SINCRONIZAÇÃO
────────────────────────────────────────────────────────────────────────────────

POST /n8n-contas-receber/sync-start

Descrição: Inicia uma sessão de sincronização controlada.
IMPORTANTE: Apenas 1 sincronização ativa por vez é permitida.

Request Body:
{
  "batchSize": 5000,           // Tamanho do lote (default: 5000, max: 10000)
  "anoMinimo": 2023,           // Ano mínimo para filtrar dados (opcional)
  "scope": "incremental"       // "full" ou "incremental"
}

Resposta (200 OK):
{
  "sync_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": "2025-01-05T10:30:00.000Z",
  "message": "Sincronização iniciada com sucesso"
}

Resposta (409 Conflict) - Sync já em andamento:
{
  "error": "Já existe uma sincronização ativa",
  "active_sync_id": "550e8400-e29b-41d4-a716-446655440001",
  "started_at": "2025-01-05T10:25:00.000Z"
}

────────────────────────────────────────────────────────────────────────────────
4.4 ENVIAR PÁGINA DE REGISTROS
────────────────────────────────────────────────────────────────────────────────

POST /n8n-contas-receber/sync-page

Descrição: Envia uma página de registros para processamento.

Request Body:
{
  "sync_id": "550e8400-e29b-41d4-a716-446655440000",
  "page": 1,
  "contas": [
    { /* registro 1 */ },
    { /* registro 2 */ },
    // ... até 5000 registros por página
  ]
}

Resposta (200 OK):
{
  "processed": 5000,
  "inserted": 4500,
  "updated": 500,
  "errors": 0,
  "page": 1,
  "duration_ms": 2500
}

────────────────────────────────────────────────────────────────────────────────
4.5 FINALIZAR SINCRONIZAÇÃO
────────────────────────────────────────────────────────────────────────────────

POST /n8n-contas-receber/sync-finish

Descrição: Finaliza a sessão de sincronização e gera relatório.

Request Body:
{
  "sync_id": "550e8400-e29b-41d4-a716-446655440000"
}

Resposta (200 OK):
{
  "status": "completed",
  "total_processed": 500000,
  "total_pages": 100,
  "duration_seconds": 250,
  "rate_per_second": 2000
}

────────────────────────────────────────────────────────────────────────────────
4.6 SINCRONIZAÇÃO EM CHUNKS (★ RECOMENDADO PARA N8N ★)
────────────────────────────────────────────────────────────────────────────────

POST /contas-receber-api/sync-chunk

Descrição: Endpoint OTIMIZADO para processamento de chunks via N8N.
Ideal para volumes de 100.000 a 5.000.000+ registros.

Request Body:
{
  "contas": [ /* array de 5.000 a 25.000 registros */ ],
  "chunk_id": 1,              // Número do chunk atual (1-indexed)
  "total_chunks": 20,         // Total de chunks esperados
  "sync_id": "uuid-opcional", // ID para agrupar chunks
  "empresa_id": 1             // ID da empresa (opcional)
}

Resposta (200 OK):
{
  "success": true,
  "chunk_id": 1,
  "total_chunks": 20,
  "statistics": {
    "received": 5000,
    "processed": 5000,
    "errors": 0,
    "rate_per_second": 2500
  },
  "duration_ms": 2000,
  "next_action": "continue",
  "message": "Chunk 1 OK. Aguarde 3s antes do próximo chunk."
}

────────────────────────────────────────────────────────────────────────────────
4.7 CARGA MASSIVA (BULK)
────────────────────────────────────────────────────────────────────────────────

POST /contas-receber-api/bulk-sync

Descrição: Carga massiva para até 100.000 registros por requisição.
Usa SQL bulk insert para máxima performance.

Request Body:
{
  "contas": [ /* array de até 100.000 registros */ ],
  "clearExisting": false   // Se true, limpa registros antes de inserir
}

Resposta (200 OK):
{
  "success": true,
  "mode": "bulk_sql",
  "statistics": {
    "total": 100000,
    "processed": 99950,
    "errors": 50,
    "rate_per_second": 2000
  },
  "duration_ms": 50000
}

────────────────────────────────────────────────────────────────────────────────
4.8 SINCRONIZAÇÃO INCREMENTAL
────────────────────────────────────────────────────────────────────────────────

POST /contas-receber-api/sync-incremental

Descrição: Sincroniza apenas registros alterados (comparação por hash).
OTIMIZADO para atualizações diárias.

Request Body:
{
  "contas": [ /* array de registros */ ],
  "skip_unchanged": true   // Pula registros sem alteração
}

Resposta (200 OK):
{
  "success": true,
  "mode": "incremental",
  "statistics": {
    "total_received": 10000,
    "processed": 500,
    "inserted": 100,
    "updated": 400,
    "skipped": 9500,      // Registros sem alteração
    "errors": 0
  },
  "duration_ms": 3000,
  "message": "500 processados, 9500 sem alteração"
}

────────────────────────────────────────────────────────────────────────────────
4.9 CONSULTAR PROGRESSO
────────────────────────────────────────────────────────────────────────────────

GET /contas-receber-api/chunks-progress?hours=24

Descrição: Retorna progresso dos chunks processados.

Resposta (200 OK):
{
  "data": [
    {
      "chunk_id": 1,
      "total_chunks": 20,
      "registros_processados": 5000,
      "status": "success",
      "duracao_ms": 2000
    }
  ],
  "summary": {
    "total_chunks": 20,
    "total_processed": 100000,
    "total_errors": 0,
    "avg_duration_ms": 2100
  }
}

────────────────────────────────────────────────────────────────────────────────
4.10 STATUS DA SINCRONIZAÇÃO
────────────────────────────────────────────────────────────────────────────────

GET /contas-receber-api/sync-status

Resposta (200 OK):
{
  "last_sync": {
    "ultima_sync": "2025-01-05T08:00:00.000Z",
    "total_registros": 500000,
    "status": "complete",
    "duracao_ms": 250000
  },
  "recent_chunks": [...],
  "recommended_chunk_size": 25000
}

═══════════════════════════════════════════════════════════════════════════════
5. ENDPOINTS - CONTAS A PAGAR (★ OTIMIZADO PARA 1M+ REGISTROS ★)
═══════════════════════════════════════════════════════════════════════════════

BASE URL: ${SUPABASE_URL}/contas-pagar-api

PERFORMANCE ESPERADA:
┌────────────────────────┬────────────────────┬─────────────────────┐
│ Volume                 │ Tempo Estimado     │ Throughput          │
├────────────────────────┼────────────────────┼─────────────────────┤
│ 10.000 registros       │ ~8 segundos        │ ~1.200 rec/seg      │
│ 100.000 registros      │ ~1.5 minutos       │ ~1.200 rec/seg      │
│ 500.000 registros      │ ~7 minutos         │ ~1.200 rec/seg      │
│ 1.000.000 registros    │ ~15 minutos        │ ~1.200 rec/seg      │
│ 5.000.000+ registros   │ ~70 minutos        │ ~1.200 rec/seg      │
└────────────────────────┴────────────────────┴─────────────────────┘

────────────────────────────────────────────────────────────────────────────────
5.1 CARGA MASSIVA (★ RECOMENDADO PARA N8N ★)
────────────────────────────────────────────────────────────────────────────────

POST /bulk-sync

Descrição: Endpoint OTIMIZADO para carga massiva via N8N.
Processa até 5.000 registros por requisição com SQL bulk insert.
Usa hash MD5 para detecção inteligente de mudanças.

Request Body:
{
  "contas": [
    {
      "erp_id": "ERP-CP-001",
      "empresa_id": 1,
      "fornecedor_codigo": "F001",
      "fornecedor_nome": "Fornecedor Exemplo",
      "tipo_documento": "NF",
      "numero_documento": "12345",
      "data_vencimento": "2025-02-15",
      "valor_original": 2500.00,
      "valor_aberto": 2500.00,
      "status": "aberto"
    }
  ],
  "chunk_index": 1,
  "total_chunks": 40,
  "sync_id": "sync_20250105"
}

Resposta (200 OK):
{
  "success": true,
  "statistics": {
    "received": 5000,
    "processed": 5000,
    "inserted": 3500,
    "updated": 1450,
    "unchanged": 50,
    "errors": 0
  },
  "timing": {
    "total_ms": 4200,
    "rate_per_second": 1190
  }
}

────────────────────────────────────────────────────────────────────────────────
5.2 SINCRONIZAÇÃO INCREMENTAL
────────────────────────────────────────────────────────────────────────────────

POST /sync-incremental

Descrição: Sincronização inteligente que ignora registros sem alteração.

Request Body: (mesmo formato do /bulk-sync)

Resposta: Inclui campo "unchanged" com registros ignorados.

────────────────────────────────────────────────────────────────────────────────
5.3 FINALIZAÇÃO DE SINCRONIZAÇÃO
────────────────────────────────────────────────────────────────────────────────

POST /sync-complete

Descrição: Finaliza sessão e consolida estatísticas.

Request Body:
{
  "sync_id": "sync_20250105",
  "total_expected": 1000000,
  "tipo": "full"
}

────────────────────────────────────────────────────────────────────────────────
5.4 MONITORAMENTO
────────────────────────────────────────────────────────────────────────────────

GET /status              - Status e configuração da API
GET /chunks-progress     - Progresso dos chunks processados
GET /stats               - Estatísticas de sincronização

═══════════════════════════════════════════════════════════════════════════════
6. ENDPOINTS - ESTOQUE (★ OTIMIZADO PARA 1M+ MOVIMENTAÇÕES ★)
═══════════════════════════════════════════════════════════════════════════════

BASE URL: ${SUPABASE_URL}/estoque-n8n-sync

PERFORMANCE ESPERADA:
┌────────────────────────┬────────────────────┬─────────────────────┐
│ Volume                 │ Tempo Estimado     │ Throughput          │
├────────────────────────┼────────────────────┼─────────────────────┤
│ 10.000 movimentações   │ ~12 segundos       │ ~800 rec/seg        │
│ 100.000 movimentações  │ ~2 minutos         │ ~800 rec/seg        │
│ 500.000 movimentações  │ ~10 minutos        │ ~800 rec/seg        │
│ 1.000.000 movimentações│ ~20 minutos        │ ~800 rec/seg        │
│ 5.000.000+ movimentações│ ~100 minutos      │ ~800 rec/seg        │
└────────────────────────┴────────────────────┴─────────────────────┘

────────────────────────────────────────────────────────────────────────────────
6.1 CARGA MASSIVA DE MOVIMENTAÇÕES (★ RECOMENDADO PARA N8N ★)
────────────────────────────────────────────────────────────────────────────────

POST /bulk-movimentacoes

Descrição: Endpoint OTIMIZADO para carga massiva de movimentações.
Processa até 5.000 registros por requisição.

Request Body:
{
  "movimentacoes": [
    {
      "erp_id": "MOV-001",
      "distribuidora_cnpj": "12345678901234",
      "produto_sku": "SKU-001",
      "tipo_movimento": "entrada",
      "quantidade": 100,
      "data_movimento": "2025-01-05",
      "lote": "LOTE-2025-001",
      "custo_unitario": 15.50,
      "documento_referencia": "NF-12345"
    }
  ],
  "chunk_index": 1,
  "total_chunks": 200,
  "sync_id": "estoque_sync_20250105"
}

Resposta (200 OK):
{
  "success": true,
  "statistics": {
    "received": 5000,
    "processed": 5000,
    "inserted": 5000,
    "errors": 0
  },
  "timing": {
    "total_ms": 6250,
    "rate_per_second": 800
  },
  "saldos_atualizados": 5000
}

────────────────────────────────────────────────────────────────────────────────
6.2 SINCRONIZAÇÃO COMPLETA (DADOS MESTRES)
────────────────────────────────────────────────────────────────────────────────

POST /

Descrição: Sincroniza distribuidoras, produtos master e vinculações.
Use /bulk-movimentacoes para movimentações em massa.

Request Body:
{
  "tipo": "completo",
  "dados": {
    "distribuidoras": [...],
    "produtos_master": [...],
    "vinculacoes": [...]
  }
}

TIPOS DE MOVIMENTO:
┌─────────────────┬──────────────────────────────────────────────────────────┐
│ Tipo            │ Descrição                                                │
├─────────────────┼──────────────────────────────────────────────────────────┤
│ entrada         │ Entrada de mercadoria (compra, devolução)                │
│ saida           │ Saída de mercadoria (venda, transferência)               │
│ transferencia   │ Movimentação entre localizações                          │
│ ajuste          │ Ajuste de estoque (pode ser positivo ou negativo)        │
│ inventario      │ Contagem física (define quantidade absoluta)             │
└─────────────────┴──────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
7. ESTRUTURA DE DADOS (PAYLOADS)
═══════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────────────
7.1 CONTAS A RECEBER - FORMATO PRINCIPAL (Nomes Amigáveis)
────────────────────────────────────────────────────────────────────────────────

{
  "ID Empresa": 1,                    // INTEGER - ID da empresa (obrigatório)
  "Empresa": "NOME EMPRESA LTDA",     // STRING - Nome da empresa
  "Tipo": "DUP",                      // STRING - Tipo do documento
  "Conta": "000001",                  // STRING - Número da conta
  "Parcela": 1,                       // INTEGER - Número da parcela
  "Documento": "NF-12345",            // STRING - Número do documento
  "Cliente Codigo": "C00001",         // STRING - Código do cliente (obrigatório)
  "Cliente": "CLIENTE EXEMPLO S.A.",  // STRING - Nome do cliente
  "Portador ID": "001",               // STRING - ID do portador
  "Portador": "BANCO DO BRASIL",      // STRING - Nome do portador
  "Data Emissão": "2025-01-01",       // DATE (YYYY-MM-DD) - Data de emissão
  "Data Vencimento": "2025-02-01",    // DATE (YYYY-MM-DD) - Data de vencimento
  "Data Recebimento": null,           // DATE ou NULL - Data do recebimento
  "Valor Original": 1500.00,          // DECIMAL - Valor original do título
  "Valor Desconto": 0.00,             // DECIMAL - Valor de desconto
  "Valor Juros": 0.00,                // DECIMAL - Valor de juros
  "Valor Ajustes": 0.00,              // DECIMAL - Valor de ajustes
  "Valor Recebido": 0.00,             // DECIMAL - Valor já recebido
  "Valor Aberto": 1500.00,            // DECIMAL - Valor em aberto
  "Status": "aberto",                 // STRING - aberto|vencido|pago|parcial
  "Vendedor Codigo": "V001",          // STRING - Código do vendedor
  "Vendedor": "NOME DO VENDEDOR",     // STRING - Nome do vendedor
  "Tabela": "TABELA01"                // STRING - Tabela de preço
}

────────────────────────────────────────────────────────────────────────────────
7.2 CONTAS A RECEBER - FORMATO ALTERNATIVO (snake_case)
────────────────────────────────────────────────────────────────────────────────

{
  "erp_id": "1-DUP-000001-1-C00001",  // STRING - ID único composto
  "empresa_id": 1,
  "empresa_nome": "NOME EMPRESA LTDA",
  "tipo_documento": "DUP",
  "numero_documento": "NF-12345",
  "conta": "000001",
  "parcela": 1,
  "cliente_codigo": "C00001",
  "cliente_nome": "CLIENTE EXEMPLO S.A.",
  "portador_id": "001",
  "portador_nome": "BANCO DO BRASIL",
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
  "vendedor_nome": "NOME DO VENDEDOR",
  "tabela_preco": "TABELA01"
}

────────────────────────────────────────────────────────────────────────────────
7.3 CONTAS A PAGAR
────────────────────────────────────────────────────────────────────────────────

{
  "ID Empresa": 1,
  "Empresa": "NOME EMPRESA LTDA",
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
  "Status": "aberto",
  "ID Historico": "001",              // Código da categoria
  "Historico": "DESPESAS OPERACIONAIS" // Nome da categoria
}

═══════════════════════════════════════════════════════════════════════════════
8. CÓDIGOS DE RESPOSTA HTTP
═══════════════════════════════════════════════════════════════════════════════

┌────────┬──────────────────────────────┬─────────────────────────────────────┐
│ Código │ Significado                  │ Ação Recomendada                    │
├────────┼──────────────────────────────┼─────────────────────────────────────┤
│ 200    │ Sucesso                      │ Processar resposta normalmente      │
│ 207    │ Sucesso Parcial              │ Verificar campo "errors" na resposta│
│ 400    │ Requisição Inválida          │ Verificar formato do payload        │
│ 401    │ Não Autorizado               │ Verificar header x-api-key          │
│ 404    │ Endpoint não encontrado      │ Verificar URL                       │
│ 409    │ Conflito (sync em andamento) │ Aguardar sync atual finalizar       │
│ 413    │ Payload muito grande         │ Reduzir tamanho do chunk            │
│ 429    │ Rate limit excedido          │ Aguardar e retry (ver Retry-After)  │
│ 500    │ Erro interno do servidor     │ Retry com backoff exponencial       │
│ 503    │ Serviço indisponível         │ Retry após alguns segundos          │
└────────┴──────────────────────────────┴─────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
9. TRATAMENTO DE ERROS
═══════════════════════════════════════════════════════════════════════════════

ESTRUTURA DE ERRO PADRÃO:
{
  "error": "Descrição legível do erro",
  "code": "VALIDATION_ERROR",     // Código do erro para tratamento
  "details": {                    // Detalhes adicionais (opcional)
    "field": "cliente_codigo",
    "message": "Campo obrigatório"
  },
  "request_id": "uuid"            // ID da requisição para suporte
}

CÓDIGOS DE ERRO COMUNS:
• VALIDATION_ERROR   - Dados inválidos no payload
• AUTH_ERROR         - Falha de autenticação
• RATE_LIMIT         - Limite de requisições excedido
• SYNC_CONFLICT      - Sincronização já em andamento
• PAYLOAD_TOO_LARGE  - Payload excede limite máximo
• DATABASE_ERROR     - Erro de banco de dados
• TIMEOUT            - Timeout na operação

ESTRATÉGIA DE RETRY RECOMENDADA (Exponential Backoff):

┌──────────────┬───────────────┬─────────────────────────────────────────────┐
│ Tentativa    │ Aguardar      │ Descrição                                   │
├──────────────┼───────────────┼─────────────────────────────────────────────┤
│ 1ª           │ 1 segundo     │ Primeira tentativa imediata                 │
│ 2ª           │ 2 segundos    │ Após falha, aguardar 2s                     │
│ 3ª           │ 4 segundos    │ Dobrar tempo de espera                      │
│ 4ª           │ 8 segundos    │ Continuar dobrando                          │
│ 5ª           │ 16 segundos   │ Máximo: 5 tentativas                        │
└──────────────┴───────────────┴─────────────────────────────────────────────┘

Exemplo JavaScript:
async function fetchWithRetry(url, options, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
    const delay = Math.pow(2, attempt - 1) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

═══════════════════════════════════════════════════════════════════════════════
10. ESTRATÉGIA DE SINCRONIZAÇÃO PARA MILHÕES DE REGISTROS
═══════════════════════════════════════════════════════════════════════════════

CONFIGURAÇÃO RECOMENDADA:

┌──────────────────────────────────────────────────────────────────────────────┐
│                    PARÂMETROS OTIMIZADOS PARA ALTO VOLUME                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Chunk Size (registros por requisição):                                      │
│    • Carga inicial (full sync): 25.000 registros                             │
│    • Sincronização diária: 10.000 registros                                  │
│    • Rede instável: 5.000 registros                                          │
│                                                                              │
│  Intervalo entre chunks: 3.000 ms (3 segundos)                               │
│                                                                              │
│  Timeout por requisição: 60.000 ms (60 segundos)                             │
│                                                                              │
│  Retries: 5 tentativas com backoff exponencial                               │
│                                                                              │
│  Sincronizações simultâneas: Máximo 1 por entidade                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

FLUXO RECOMENDADO PARA 1M+ REGISTROS:

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 1. Contar   │────▶│ 2. Dividir  │────▶│ 3. Enviar   │────▶│ 4. Finalizar│
│   registros │     │   em chunks │     │   chunks    │     │   sync      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │ Loop para cada  │
                                     │ chunk:          │
                                     │ - POST /sync-   │
                                     │   chunk         │
                                     │ - Aguardar 3s   │
                                     └─────────────────┘

EXEMPLO DE CÁLCULO:
• Total de registros: 1.000.000
• Chunk size: 25.000
• Total de chunks: 40
• Tempo por chunk: ~12 segundos (10s processamento + 3s delay)
• Tempo total estimado: 40 × 12s = 480 segundos = 8 minutos

SCHEDULE RECOMENDADO:

┌─────────────────────────┬────────────────────────────────────────────────────────────┐
│ Horário                 │ Contas Receber     │ Contas Pagar      │ Estoque          │
├─────────────────────────┼────────────────────┼───────────────────┼──────────────────┤
│ 02:00 (Full Sync)       │ Sim                │ Sim               │ Sim              │
│ 08:00 (Incremental)     │ Sim                │ Sim               │ Sim              │
│ 14:00 (Incremental)     │ Sim                │ Sim               │ Sim              │
│ 20:00 (Incremental)     │ Sim                │ Sim               │ -                │
└─────────────────────────┴────────────────────┴───────────────────┴──────────────────┘

PARÂMETROS POR MÓDULO:

┌──────────────────────────┬──────────────────┬───────────────────┬──────────────────┐
│ Parâmetro                │ Contas Receber   │ Contas Pagar      │ Estoque          │
├──────────────────────────┼──────────────────┼───────────────────┼──────────────────┤
│ Chunk Size               │ 25.000           │ 25.000            │ 10.000           │
│ Timeout (ms)             │ 180.000          │ 180.000           │ 180.000          │
│ Delay entre chunks       │ 2-3 segundos     │ 2-3 segundos      │ 2-3 segundos     │
│ Max Retries              │ 5                │ 5                 │ 5                │
│ Throughput esperado      │ ~2.000 rec/s     │ ~1.200 rec/s      │ ~800 rec/s       │
└──────────────────────────┴──────────────────┴───────────────────┴──────────────────┘

═══════════════════════════════════════════════════════════════════════════════
11. QUERIES SQL DE REFERÊNCIA
═══════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────────────
11.1 CONTAS A RECEBER - Query com paginação (SQL Server)
────────────────────────────────────────────────────────────────────────────────

DECLARE @pageSize INT = 25000;
DECLARE @pageNumber INT = 1;
DECLARE @offset INT = (@pageNumber - 1) * @pageSize;
DECLARE @dataInicio DATE = '2024-01-01';

SELECT 
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
  FORMAT(cr.DATA_EMISSAO, 'yyyy-MM-dd') AS [Data Emissão],
  FORMAT(cr.DATA_VENCIMENTO, 'yyyy-MM-dd') AS [Data Vencimento],
  FORMAT(cr.DATA_RECEBIMENTO, 'yyyy-MM-dd') AS [Data Recebimento],
  CAST(cr.VALOR_ORIGINAL AS DECIMAL(18,2)) AS [Valor Original],
  CAST(ISNULL(cr.VALOR_DESCONTO, 0) AS DECIMAL(18,2)) AS [Valor Desconto],
  CAST(ISNULL(cr.VALOR_JUROS, 0) AS DECIMAL(18,2)) AS [Valor Juros],
  CAST(ISNULL(cr.VALOR_AJUSTES, 0) AS DECIMAL(18,2)) AS [Valor Ajustes],
  CAST(ISNULL(cr.VALOR_RECEBIDO, 0) AS DECIMAL(18,2)) AS [Valor Recebido],
  CAST(cr.VALOR_ABERTO AS DECIMAL(18,2)) AS [Valor Aberto],
  CASE 
    WHEN cr.DATA_RECEBIMENTO IS NOT NULL AND cr.VALOR_ABERTO = 0 THEN 'pago'
    WHEN cr.DATA_VENCIMENTO < GETDATE() AND cr.VALOR_ABERTO > 0 THEN 'vencido'
    WHEN cr.VALOR_RECEBIDO > 0 AND cr.VALOR_ABERTO > 0 THEN 'parcial'
    ELSE 'aberto'
  END AS [Status],
  vend.CODIGO AS [Vendedor Codigo],
  vend.NOME AS [Vendedor],
  tab.NOME AS [Tabela]
FROM CONTAS_RECEBER cr WITH (NOLOCK)
  INNER JOIN EMPRESAS emp WITH (NOLOCK) ON cr.EMPRESA_ID = emp.ID
  INNER JOIN CLIENTES cli WITH (NOLOCK) ON cr.CLIENTE_ID = cli.ID
  LEFT JOIN PORTADORES port WITH (NOLOCK) ON cr.PORTADOR_ID = port.ID
  LEFT JOIN VENDEDORES vend WITH (NOLOCK) ON cr.VENDEDOR_ID = vend.ID
  LEFT JOIN TABELAS_PRECO tab WITH (NOLOCK) ON cr.TABELA_ID = tab.ID
WHERE cr.DATA_EMISSAO >= @dataInicio
ORDER BY emp.ID_EMPRESA, cr.CONTA, cr.PARCELA
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

────────────────────────────────────────────────────────────────────────────────
11.2 CONTAS A PAGAR - Query com paginação (SQL Server)
────────────────────────────────────────────────────────────────────────────────

DECLARE @pageSize INT = 25000;
DECLARE @pageNumber INT = 1;
DECLARE @offset INT = (@pageNumber - 1) * @pageSize;
DECLARE @dataInicio DATE = '2024-01-01';

SELECT 
  emp.ID_EMPRESA AS [ID Empresa],
  emp.NOME AS [Empresa],
  cp.TIPO_DOCUMENTO AS [Tipo Documento],
  cp.CONTA AS [Conta],
  cp.PARCELA AS [Parcela],
  cp.DOCUMENTO AS [Documento],
  forn.CODIGO AS [Fornecedor Codigo],
  forn.NOME AS [Fornecedor],
  port.NOME AS [Portador],
  FORMAT(cp.DATA_EMISSAO, 'yyyy-MM-dd') AS [Data Emissão],
  FORMAT(cp.DATA_VENCIMENTO, 'yyyy-MM-dd') AS [Data Vencimento],
  FORMAT(cp.DATA_PAGAMENTO, 'yyyy-MM-dd') AS [Data Pagamento],
  CAST(cp.VALOR_ORIGINAL AS DECIMAL(18,2)) AS [Valor Original],
  CAST(ISNULL(cp.VALOR_DESCONTO, 0) AS DECIMAL(18,2)) AS [Valor Desconto],
  CAST(ISNULL(cp.VALOR_JUROS, 0) AS DECIMAL(18,2)) AS [Valor Juros],
  CAST(ISNULL(cp.VALOR_AJUSTES, 0) AS DECIMAL(18,2)) AS [Valor Ajustes],
  CAST(ISNULL(cp.VALOR_PAGO, 0) AS DECIMAL(18,2)) AS [Valor Pago],
  CAST(cp.VALOR_ABERTO AS DECIMAL(18,2)) AS [Valor Aberto],
  CASE 
    WHEN cp.DATA_PAGAMENTO IS NOT NULL AND cp.VALOR_ABERTO = 0 THEN 'pago'
    WHEN cp.DATA_VENCIMENTO < GETDATE() AND cp.VALOR_ABERTO > 0 THEN 'vencido'
    WHEN cp.VALOR_PAGO > 0 AND cp.VALOR_ABERTO > 0 THEN 'parcial'
    ELSE 'aberto'
  END AS [Status],
  hist.CODIGO AS [ID Historico],
  hist.NOME AS [Historico]
FROM CONTAS_PAGAR cp WITH (NOLOCK)
  INNER JOIN EMPRESAS emp WITH (NOLOCK) ON cp.EMPRESA_ID = emp.ID
  INNER JOIN FORNECEDORES forn WITH (NOLOCK) ON cp.FORNECEDOR_ID = forn.ID
  LEFT JOIN PORTADORES port WITH (NOLOCK) ON cp.PORTADOR_ID = port.ID
  LEFT JOIN HISTORICOS hist WITH (NOLOCK) ON cp.HISTORICO_ID = hist.ID
WHERE cp.DATA_EMISSAO >= @dataInicio
ORDER BY emp.ID_EMPRESA, cp.CONTA, cp.PARCELA
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

────────────────────────────────────────────────────────────────────────────────
11.3 CONTAGEM TOTAL (para calcular número de chunks)
────────────────────────────────────────────────────────────────────────────────

-- Contas a Receber
SELECT COUNT(*) AS total_registros
FROM CONTAS_RECEBER WITH (NOLOCK)
WHERE DATA_EMISSAO >= '2024-01-01';

-- Contas a Pagar
SELECT COUNT(*) AS total_registros
FROM CONTAS_PAGAR WITH (NOLOCK)
WHERE DATA_EMISSAO >= '2024-01-01';

═══════════════════════════════════════════════════════════════════════════════
12. CONFIGURAÇÃO N8N
═══════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────────────
12.1 CONFIGURAÇÃO DO NODE HTTP REQUEST
────────────────────────────────────────────────────────────────────────────────

{
  "method": "POST",
  "url": "${SUPABASE_URL}/contas-receber-api/sync-chunk",
  "authentication": "none",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      { "name": "x-api-key", "value": "={{$env.N8N_API_KEY}}" },
      { "name": "Content-Type", "value": "application/json" }
    ]
  },
  "options": {
    "timeout": 60000,
    "response": {
      "response": {
        "fullResponse": true
      }
    }
  },
  "retry": {
    "enabled": true,
    "maxTries": 5,
    "waitBetweenTries": 3000
  }
}

────────────────────────────────────────────────────────────────────────────────
12.2 CONFIGURAÇÃO DO NODE SQL SERVER
────────────────────────────────────────────────────────────────────────────────

{
  "operation": "executeQuery",
  "options": {
    "connectionTimeout": 60000,
    "requestTimeout": 120000
  }
}

────────────────────────────────────────────────────────────────────────────────
12.3 WORKFLOW COMPLETO - Estrutura Recomendada
────────────────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW N8N RECOMENDADO                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [1. Schedule Trigger]                                                       │
│         │                                                                    │
│         ▼                                                                    │
│  [2. SQL: Count Total] ─────────────────────────┐                            │
│         │                                       │                            │
│         ▼                                       │                            │
│  [3. Set: Calcular Chunks]                      │                            │
│         │ totalChunks = CEILING(total/chunkSize)│                            │
│         ▼                                       │                            │
│  [4. Loop: Para cada Chunk] ◄───────────────────┘                            │
│         │                                                                    │
│         ▼                                                                    │
│  [5. SQL: Buscar Página]                                                     │
│         │ OFFSET (chunkId-1)*chunkSize                                       │
│         ▼                                                                    │
│  [6. HTTP: POST /sync-chunk]                                                 │
│         │ Body: { contas, chunk_id, total_chunks }                           │
│         ▼                                                                    │
│  [7. Wait: 3 segundos]                                                       │
│         │                                                                    │
│         ▼                                                                    │
│  [8. IF: Último chunk?] ──Yes──▶ [9. HTTP: POST /sync-complete]              │
│         │                                      │                             │
│        No                                      ▼                             │
│         │                              [10. Sucesso!]                        │
│         └─────────────────▶ Próximo chunk                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
13. MONITORAMENTO E LOGS
═══════════════════════════════════════════════════════════════════════════════

ENDPOINTS DE MONITORAMENTO:

• GET /contas-receber-api/sync-status
  Retorna status da última sincronização e chunks recentes.

• GET /contas-receber-api/chunks-progress?hours=24
  Retorna progresso dos chunks nas últimas 24 horas.

• GET /contas-receber-api/stats
  Retorna histórico das últimas 10 sincronizações.

LOGS REGISTRADOS:
• Início e fim de cada sincronização
• Progresso de cada chunk
• Erros detalhados com stack trace
• Métricas de performance (registros/segundo)
• IP de origem das requisições

RETENÇÃO DE LOGS: 90 dias

═══════════════════════════════════════════════════════════════════════════════
14. PONTOS DE ATENÇÃO - GERENCIAIS E TÉCNICOS
═══════════════════════════════════════════════════════════════════════════════

🟡 PONTO 1: SEGURANÇA (Precisa Alinhamento Final)
────────────────────────────────────────────────────────────────────────────────

⚠ API Key simples (x-api-key)
⚠ Não há menção explícita a:
  • Rotação automatizada de chaves
  • Ambientes separados por chave (dev/hml/prod) com política formal
  • Auditoria por empresa_id

RECOMENDAÇÃO GERENCIAL:
  • Criar chaves por ambiente + por cliente
  • Logar sempre: empresa_id, sync_id, ip, endpoint
  • Implementar rotação trimestral de API keys

🟡 PONTO 2: SQL SERVER – USO DE NOLOCK
────────────────────────────────────────────────────────────────────────────────

⚠ Uso extensivo de WITH (NOLOCK) nas queries de exemplo

RISCOS:
  • Possibilidade de leitura suja (dirty reads)
  • Dados inconsistentes em fechamento financeiro

SUGESTÃO:
  • Avaliar Snapshot Isolation no SQL Server
  • NOLOCK apenas para cargas históricas (dados imutáveis)
  • Incremental SEM NOLOCK para dados recentes

🟡 PONTO 3: TIMEOUT E N8N CLOUD
────────────────────────────────────────────────────────────────────────────────

⚠ Alguns endpoints podem atingir:
  • 180s timeout por requisição
  • 25.000 registros por chunk

ALERTA:
  • N8N Cloud pode sofrer com limites de execução
  • Edge Functions têm limites de timeout (300s máx)

MITIGAÇÃO:
  • Preferir 10k–15k registros em produção inicial
  • Subir gradualmente após benchmark real
  • Usar N8N self-hosted para volumes acima de 500k

🔴 PONTO 4: GOVERNANÇA DE DADOS (NEGÓCIO) - CRÍTICO
────────────────────────────────────────────────────────────────────────────────

⚠ NÃO está explícito:
  • Quem é a fonte da verdade (ERP ou CRM)?
  • Se o CRM pode sobrescrever dados do ERP
  • Regras de conflito bidirecional

⚡ Isso PRECISA ser decidido ANTES da produção!

═══════════════════════════════════════════════════════════════════════════════
15. PERGUNTAS OBRIGATÓRIAS ANTES DE INICIAR (Gerente de TI)
═══════════════════════════════════════════════════════════════════════════════

🏢 AMBIENTES:
  [ ] Teremos DEV / HML / PROD separados?
  [ ] Cada um com API Key própria?

🎯 FONTE DA VERDADE:
  [ ] ERP sempre manda?
  [ ] CRM pode corrigir dados financeiros?

⏰ JANELA DE EXECUÇÃO:
  [ ] Qual o horário "seguro" no ERP?
  [ ] Existe fechamento contábil diário?

📊 VOLUME REAL:
  [ ] Contas a Receber: quantos registros hoje?
  [ ] Contas a Pagar: quantos registros hoje?
  [ ] Estoque: movimentações/dia ou histórico completo?

🖥️ INFRAESTRUTURA:
  [ ] N8N será self-hosted ou cloud?
  [ ] Quantos GB de RAM disponíveis para N8N?
  [ ] Conexão de rede entre ERP e Cloud é estável?

═══════════════════════════════════════════════════════════════════════════════
16. PLANO DE AÇÃO RECOMENDADO (Próximos Passos)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 1 – PREPARAÇÃO (Obrigatória)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ ] Validar volumes reais de cada módulo                                    │
│ [ ] Definir chunk inicial conservador (10k-15k)                             │
│ [ ] Criar API Keys por ambiente (DEV/HML/PROD)                              │
│ [ ] Validar SQL sem impacto no ERP (testar NOLOCK)                          │
│ [ ] Definir fonte da verdade e regras de conflito                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 2 – HOMOLOGAÇÃO                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ ] Teste com 10k → 100k → 1M registros                                     │
│ [ ] Medir tempo REAL (não estimado)                                         │
│ [ ] Simular falhas (timeout, rede, retry)                                   │
│ [ ] Validar hash incremental funciona corretamente                          │
│ [ ] Verificar logs de auditoria                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 3 – PRODUÇÃO CONTROLADA                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ ] Primeira execução monitorada em tempo real                              │
│ [ ] Alertas ativos (Slack/Email para falhas)                                │
│ [ ] Logs auditáveis com empresa_id e sync_id                                │
│ [ ] Rollback plan documentado                                               │
│ [ ] Comunicação com time financeiro                                         │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
17. CHECKLIST DE IMPLEMENTAÇÃO
═══════════════════════════════════════════════════════════════════════════════

ANTES DE INICIAR:
[ ] Obter API Key de produção
[ ] Definir IP(s) de origem para whitelist
[ ] Validar acesso ao SQL Server (usuário somente leitura)
[ ] Estimar volume de registros por entidade
[ ] Definir horários de sincronização

DESENVOLVIMENTO:
[ ] Testar endpoint /status (verificar conectividade)
[ ] Testar endpoint /health (verificar saúde do sistema)
[ ] Implementar query SQL com paginação
[ ] Testar com 100 registros primeiro
[ ] Testar com 1.000 registros
[ ] Testar com 10.000 registros
[ ] Implementar tratamento de erros e retries
[ ] Implementar logs locais

HOMOLOGAÇÃO:
[ ] Executar carga completa em ambiente de teste
[ ] Validar dados sincronizados
[ ] Medir performance (registros/segundo)
[ ] Testar recuperação de falhas
[ ] Documentar tempos de execução

PRODUÇÃO:
[ ] Configurar schedule de sincronização
[ ] Configurar alertas de erro
[ ] Monitorar primeiras execuções
[ ] Validar integridade dos dados

═══════════════════════════════════════════════════════════════════════════════
18. SUPORTE TÉCNICO
═══════════════════════════════════════════════════════════════════════════════

INFORMAÇÕES PARA ABERTURA DE CHAMADO:

Ao reportar problemas, incluir:
• Request ID (campo request_id na resposta de erro)
• Timestamp exato da requisição
• Endpoint utilizado
• Payload enviado (sem dados sensíveis)
• Resposta recebida
• Volume de dados sendo processado

DOCUMENTAÇÃO ADICIONAL:
• docs/N8N_SYNC_CONFIGURATION.md
• docs/N8N_WORKFLOW_1M_REGISTROS.md
• docs/N8N_WORKFLOW_CONTAS_PAGAR_1M.md
• docs/N8N_WORKFLOW_ESTOQUE_1M.md
• docs/API_REST_INTEGRACAO_ERP.md

╔══════════════════════════════════════════════════════════════════════════════╗
║                          FIM DO DOCUMENTO                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Versão 3.1 - ${new Date().toLocaleDateString('pt-BR')}                                                        ║
║  Este documento é confidencial e de uso exclusivo para integração.           ║
║  Inclui: Pontos de Atenção, Perguntas Obrigatórias e Plano de Ação          ║
╚══════════════════════════════════════════════════════════════════════════════╝
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="contas-receber" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Contas a Receber</span>
            <span className="sm:hidden">C. Receber</span>
          </TabsTrigger>
          <TabsTrigger value="contas-pagar" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Contas a Pagar</span>
            <span className="sm:hidden">C. Pagar</span>
          </TabsTrigger>
          <TabsTrigger value="estoque" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="atencao" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Pontos de Atenção</span>
            <span className="sm:hidden">Atenção</span>
          </TabsTrigger>
          <TabsTrigger value="mcp" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            MCP
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Configuração</span>
            <span className="sm:hidden">Config</span>
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
                <Badge className="ml-2 bg-green-500/10 text-green-600 border-green-500/20">Otimizado</Badge>
              </CardTitle>
              <CardDescription>
                Endpoints otimizados para sincronização massiva de contas a pagar (1M+ registros)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full" defaultValue="endpoints">
                <AccordionItem value="endpoints">
                  <AccordionTrigger>Endpoints Disponíveis</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Alert className="mb-4">
                      <Zap className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Recomendado para N8N:</strong> Use <code>/bulk-sync</code> para processamento otimizado. 
                        Throughput: ~1.200 registros/segundo.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg border-2 border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>POST</Badge>
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">★ Recomendado</Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api/bulk-sync`, "cp-bulk")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api/bulk-sync</code>
                        <p className="text-xs text-muted-foreground mt-1">Carga massiva otimizada (até 5.000 registros/req)</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>POST</Badge>
                            <Badge variant="outline" className="text-xs">Incremental</Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api/sync-incremental`, "cp-incr")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api/sync-incremental</code>
                        <p className="text-xs text-muted-foreground mt-1">Sincronização inteligente com detecção de mudanças (hash MD5)</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge>POST</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api/sync-complete`, "cp-complete")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api/sync-complete</code>
                        <p className="text-xs text-muted-foreground mt-1">Finalização de sincronização (após todos os chunks)</p>
                      </div>

                      <Separator className="my-2" />
                      <p className="text-xs text-muted-foreground font-medium">Endpoints de Monitoramento:</p>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api/status`, "cp-status")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api/status</code>
                        <p className="text-xs text-muted-foreground mt-1">Status e configuração da API</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">GET</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/contas-pagar-api/chunks-progress?sync_id=XXX`, "cp-chunks")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/contas-pagar-api/chunks-progress</code>
                        <p className="text-xs text-muted-foreground mt-1">Progresso dos chunks processados</p>
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

                <AccordionItem value="performance">
                  <AccordionTrigger>Performance Esperada</AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Volume</th>
                            <th className="text-left p-2">Tempo Estimado</th>
                            <th className="text-left p-2">Throughput</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["10.000 registros", "~8 segundos", "~1.200 rec/s"],
                            ["100.000 registros", "~1.5 minutos", "~1.200 rec/s"],
                            ["500.000 registros", "~7 minutos", "~1.200 rec/s"],
                            ["1.000.000 registros", "~15 minutos", "~1.200 rec/s"],
                            ["5.000.000+ registros", "~70 minutos", "~1.200 rec/s"],
                          ].map(([volume, tempo, throughput], i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2 font-medium">{volume}</td>
                              <td className="p-2 text-muted-foreground">{tempo}</td>
                              <td className="p-2 text-green-600">{throughput}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                            ["erp_id", "STRING", "Sim", "ID único do registro no ERP"],
                            ["empresa_id", "INTEGER", "Sim", "ID da empresa"],
                            ["fornecedor_codigo", "STRING", "Sim", "Código do fornecedor"],
                            ["fornecedor_nome", "STRING", "Não", "Nome do fornecedor"],
                            ["tipo_documento", "STRING", "Não", "Tipo do documento (NF, BOL, etc)"],
                            ["numero_documento", "STRING", "Não", "Número do documento"],
                            ["data_emissao", "DATE", "Não", "Data de emissão (YYYY-MM-DD)"],
                            ["data_vencimento", "DATE", "Não", "Data de vencimento (YYYY-MM-DD)"],
                            ["data_pagamento", "DATE", "Não", "Data do pagamento"],
                            ["valor_original", "DECIMAL", "Não", "Valor original do título"],
                            ["valor_aberto", "DECIMAL", "Não", "Valor em aberto"],
                            ["valor_pago", "DECIMAL", "Não", "Valor já pago"],
                            ["status", "STRING", "Não", "Status: aberto, pago, vencido"],
                            ["categoria_codigo", "STRING", "Não", "Código da categoria"],
                            ["categoria_nome", "STRING", "Não", "Nome da categoria"],
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
                    
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-sm">Query Incremental</AlertTitle>
                      <AlertDescription className="text-xs font-mono mt-2">
                        WHERE data_modificacao &gt;= DATEADD(HOUR, -6, GETDATE())<br/>
                        OR data_pagamento &gt;= DATEADD(HOUR, -6, GETDATE())
                      </AlertDescription>
                    </Alert>
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
                <Badge className="ml-2 bg-green-500/10 text-green-600 border-green-500/20">Otimizado</Badge>
              </CardTitle>
              <CardDescription>
                Endpoints otimizados para sincronização massiva de estoque (1M+ movimentações)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full" defaultValue="endpoints-bulk">
                <AccordionItem value="endpoints-bulk">
                  <AccordionTrigger>Carga Massiva (★ Recomendado)</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Alert className="mb-4">
                      <Zap className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Para volumes acima de 100.000 movimentações:</strong> Use <code>/bulk-movimentacoes</code>. 
                        Throughput: ~800 registros/segundo.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg border-2 border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>POST</Badge>
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">★ Recomendado</Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${SUPABASE_URL}/estoque-n8n-sync/bulk-movimentacoes`, "est-bulk")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm break-all">{SUPABASE_URL}/estoque-n8n-sync/bulk-movimentacoes</code>
                        <p className="text-xs text-muted-foreground mt-1">Carga massiva de movimentações (até 5.000 registros/req)</p>
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/50">
                        <p className="text-xs font-medium mb-2">Payload de Carga Massiva:</p>
                        <pre className="text-xs overflow-x-auto">{`{
  "movimentacoes": [
    {
      "erp_id": "MOV-001",
      "distribuidora_cnpj": "12345678901234",
      "produto_sku": "SKU-001",
      "tipo_movimento": "entrada",
      "quantidade": 100,
      "data_movimento": "2025-01-05",
      "lote": "LOTE-2025-001",
      "custo_unitario": 15.50,
      "documento_referencia": "NF-12345"
    }
    // ... até 5.000 registros
  ],
  "chunk_index": 1,
  "total_chunks": 200,
  "sync_id": "estoque_sync_20250105"
}`}</pre>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="performance">
                  <AccordionTrigger>Performance Esperada</AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Volume</th>
                            <th className="text-left p-2">Tempo Estimado</th>
                            <th className="text-left p-2">Throughput</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["10.000 movimentações", "~12 segundos", "~800 rec/s"],
                            ["100.000 movimentações", "~2 minutos", "~800 rec/s"],
                            ["500.000 movimentações", "~10 minutos", "~800 rec/s"],
                            ["1.000.000 movimentações", "~20 minutos", "~800 rec/s"],
                            ["5.000.000+ movimentações", "~100 minutos", "~800 rec/s"],
                          ].map(([volume, tempo, throughput], i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2 font-medium">{volume}</td>
                              <td className="p-2 text-muted-foreground">{tempo}</td>
                              <td className="p-2 text-green-600">{throughput}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="endpoints-sync">
                  <AccordionTrigger>Sincronização Completa (Dados Mestres)</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-3">
                      <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Use para dados mestres:</strong> Distribuidoras, produtos, vínculos. 
                          Para movimentações em massa, use <code>/bulk-movimentacoes</code>.
                        </AlertDescription>
                      </Alert>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>POST</Badge>
                            <Badge variant="outline" className="text-xs">Dados Mestres</Badge>
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
                        <p className="text-xs text-muted-foreground mt-1">Sincronização de distribuidoras, produtos e vínculos</p>
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/50">
                        <p className="text-xs font-medium mb-2">Payload de Dados Mestres:</p>
                        <pre className="text-xs overflow-x-auto">{`{
  "tipo": "completo",
  "dados": {
    "distribuidoras": [
      { "cnpj": "12345678901234", "nome": "Distribuidora X", "cidade": "São Paulo", "uf": "SP" }
    ],
    "produtos_master": [
      { "sku_master": "PROD001", "nome": "Produto Exemplo", "categoria": "Categoria A" }
    ],
    "vinculacoes": [
      { "distribuidora_cnpj": "12345678901234", "sku_master": "PROD001", "sku_distribuidora": "SKU-001" }
    ]
  }
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

                <AccordionItem value="tipos-movimento">
                  <AccordionTrigger>Tipos de Movimento</AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Tipo</th>
                            <th className="text-left p-2">Descrição</th>
                            <th className="text-left p-2">Efeito no Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["entrada", "Entrada de mercadoria (compra, devolução)", "+"],
                            ["saida", "Saída de mercadoria (venda, transferência)", "-"],
                            ["transferencia", "Movimentação entre localizações", "±"],
                            ["ajuste", "Ajuste de estoque (pode ser positivo ou negativo)", "±"],
                            ["inventario", "Contagem física (define quantidade absoluta)", "="],
                          ].map(([tipo, desc, efeito], i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2 font-mono text-xs">{tipo}</td>
                              <td className="p-2 text-muted-foreground">{desc}</td>
                              <td className="p-2 text-center font-bold">{efeito}</td>
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

        {/* Nova aba: Pontos de Atenção */}
        <TabsContent value="atencao">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Pontos de Atenção e Plano de Ação
                <Badge className="ml-2 bg-amber-500/10 text-amber-600 border-amber-500/20">Importante</Badge>
              </CardTitle>
              <CardDescription>
                Considerações críticas de segurança, governança e implementação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avaliação por Módulo */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Avaliação por Módulo
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2">Módulo</th>
                        <th className="text-left p-2">Avaliação</th>
                        <th className="text-left p-2">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Contas a Receber</td>
                        <td className="p-2 text-green-600">⭐⭐⭐⭐⭐</td>
                        <td className="p-2 text-muted-foreground">Muito bem resolvido</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Contas a Pagar</td>
                        <td className="p-2 text-green-600">⭐⭐⭐⭐⭐</td>
                        <td className="p-2 text-muted-foreground">Estrutura madura</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Estoque</td>
                        <td className="p-2 text-amber-600">⭐⭐⭐⭐☆</td>
                        <td className="p-2 text-muted-foreground">Alto volume exige testes de stress</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Incremental (Hash)</td>
                        <td className="p-2 text-green-600">⭐⭐⭐⭐⭐</td>
                        <td className="p-2 text-muted-foreground">Uso de hash é excelente</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Bulk Insert</td>
                        <td className="p-2 text-green-600">⭐⭐⭐⭐⭐</td>
                        <td className="p-2 text-muted-foreground">SQL bulk insert bem pensado</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              {/* Pontos de Atenção */}
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="seguranca">
                  <AccordionTrigger className="text-amber-600">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      1. Segurança (Precisa Alinhamento Final)
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Pontos Pendentes</AlertTitle>
                      <AlertDescription className="space-y-2 mt-2">
                        <p>⚠ API Key simples (x-api-key) - sem rotação automatizada</p>
                        <p>⚠ Não há menção explícita a:</p>
                        <ul className="list-disc ml-6 space-y-1">
                          <li>Rotação automatizada de chaves</li>
                          <li>Ambientes separados por chave (dev/hml/prod) com política formal</li>
                          <li>Auditoria por empresa_id</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Recomendação Gerencial
                      </h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Criar chaves por ambiente + por cliente</li>
                        <li>• Logar sempre: empresa_id, sync_id, ip, endpoint</li>
                        <li>• Implementar rotação trimestral de API keys</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="nolock">
                  <AccordionTrigger className="text-amber-600">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      2. SQL Server – Uso de NOLOCK
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Risco Identificado</AlertTitle>
                      <AlertDescription className="space-y-2 mt-2">
                        <p>⚠ Uso extensivo de <code className="bg-muted px-1 rounded">WITH (NOLOCK)</code></p>
                        <ul className="list-disc ml-6 space-y-1">
                          <li>Possibilidade de leitura suja (dirty reads)</li>
                          <li>Dados inconsistentes em fechamento financeiro</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Sugestão
                      </h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Avaliar <strong>Snapshot Isolation</strong> no SQL Server</li>
                        <li>• Usar NOLOCK <strong>apenas</strong> para cargas históricas (dados imutáveis)</li>
                        <li>• Incremental <strong>sem NOLOCK</strong> para dados recentes</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="timeout">
                  <AccordionTrigger className="text-amber-600">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      3. Timeout e N8N Cloud
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Alerta de Performance</AlertTitle>
                      <AlertDescription className="space-y-2 mt-2">
                        <p>⚠ Alguns endpoints podem atingir:</p>
                        <ul className="list-disc ml-6 space-y-1">
                          <li>180s timeout por requisição</li>
                          <li>25.000 registros por chunk</li>
                        </ul>
                        <p className="mt-2 font-medium">Impacto:</p>
                        <ul className="list-disc ml-6 space-y-1">
                          <li>N8N Cloud pode sofrer com limites de execução</li>
                          <li>Edge Functions têm limites de timeout (300s máx)</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Mitigação
                      </h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Preferir <strong>10k–15k registros</strong> em produção inicial</li>
                        <li>• Subir gradualmente após benchmark real</li>
                        <li>• Usar N8N self-hosted para volumes acima de 500k</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="governanca">
                  <AccordionTrigger className="text-amber-600">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      4. Governança de Dados (Negócio)
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Decisão Pendente - CRÍTICO</AlertTitle>
                      <AlertDescription className="space-y-2 mt-2">
                        <p>⚠ Não está explícito:</p>
                        <ul className="list-disc ml-6 space-y-1">
                          <li><strong>Quem é a fonte da verdade</strong> (ERP ou CRM)?</li>
                          <li>Se o CRM pode sobrescrever dados do ERP</li>
                          <li>Regras de conflito bidirecional</li>
                        </ul>
                        <p className="mt-2 font-medium text-red-700">⚡ Isso PRECISA ser decidido antes da produção!</p>
                      </AlertDescription>
                    </Alert>
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <h4 className="font-medium mb-2">Perguntas para Definir:</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>1. O ERP sempre manda? O CRM apenas recebe?</li>
                        <li>2. O CRM pode corrigir dados financeiros e enviar de volta?</li>
                        <li>3. Em caso de conflito, qual sistema prevalece?</li>
                        <li>4. Dados editados no CRM devem ser protegidos de sobrescrita?</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Separator />

              {/* Perguntas Obrigatórias */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Perguntas Obrigatórias Antes de Iniciar (Gerente de TI)
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 text-sm">🏢 Ambientes</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Teremos DEV / HML / PROD separados?</li>
                      <li>• Cada um com API Key própria?</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 text-sm">🎯 Fonte da Verdade</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• ERP sempre manda?</li>
                      <li>• CRM pode corrigir dados financeiros?</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 text-sm">⏰ Janela de Execução</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Qual o horário "seguro" no ERP?</li>
                      <li>• Existe fechamento contábil diário?</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 text-sm">📊 Volume Real</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Contas a Receber: quantos registros hoje?</li>
                      <li>• Estoque: movimentações/dia ou histórico completo?</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg md:col-span-2">
                    <h4 className="font-medium mb-2 text-sm">🖥️ Infraestrutura</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• N8N será self-hosted ou cloud?</li>
                      <li>• Quantos GB de RAM disponíveis para N8N?</li>
                      <li>• Conexão de rede entre ERP e Cloud é estável?</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Plano de Ação */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Plano de Ação Recomendado (Próximos Passos)
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20 rounded-r-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Badge className="bg-blue-500">Fase 1</Badge>
                      Preparação (Obrigatória)
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>✓ Validar volumes reais de cada módulo</li>
                      <li>✓ Definir chunk inicial conservador (10k-15k)</li>
                      <li>✓ Criar API Keys por ambiente (DEV/HML/PROD)</li>
                      <li>✓ Validar SQL sem impacto no ERP (testar NOLOCK)</li>
                      <li>✓ Definir fonte da verdade e regras de conflito</li>
                    </ul>
                  </div>

                  <div className="p-4 border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20 rounded-r-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Badge className="bg-amber-500">Fase 2</Badge>
                      Homologação
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>✓ Teste com 10k → 100k → 1M registros</li>
                      <li>✓ Medir tempo real (não estimado)</li>
                      <li>✓ Simular falhas (timeout, rede, retry)</li>
                      <li>✓ Validar hash incremental funciona corretamente</li>
                      <li>✓ Verificar logs de auditoria</li>
                    </ul>
                  </div>

                  <div className="p-4 border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20 rounded-r-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Badge className="bg-green-500">Fase 3</Badge>
                      Produção Controlada
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>✓ Primeira execução monitorada em tempo real</li>
                      <li>✓ Alertas ativos (Slack/Email para falhas)</li>
                      <li>✓ Logs auditáveis com empresa_id e sync_id</li>
                      <li>✓ Rollback plan documentado</li>
                      <li>✓ Comunicação com time financeiro</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Integração via MCP (Model Context Protocol)
                <Badge className="ml-2 bg-green-500/10 text-green-600 border-green-500/20">Novo</Badge>
              </CardTitle>
              <CardDescription>
                Opção avançada de integração direta via protocolo MCP com N8N
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Introdução */}
              <Alert className="border-primary/20 bg-primary/5">
                <Zap className="h-4 w-4" />
                <AlertTitle>Integração Bidirecional em Tempo Real</AlertTitle>
                <AlertDescription className="text-sm">
                  O MCP (Model Context Protocol) permite que o sistema N8N se conecte diretamente aos nossos workflows, 
                  possibilitando sincronização automatizada sem necessidade de configurar endpoints manualmente.
                </AlertDescription>
              </Alert>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="oque-e-mcp">
                  <AccordionTrigger>O que é MCP?</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="prose prose-sm max-w-none">
                      <p className="text-sm text-muted-foreground">
                        O <strong>Model Context Protocol (MCP)</strong> é um protocolo que permite que sistemas externos 
                        acessem e executem workflows de forma programática. Com essa integração, o N8N do ERP pode:
                      </p>
                      <ul className="text-sm space-y-2 mt-3">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Listar todos os workflows disponíveis para sincronização</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Executar workflows diretamente sem configurar URLs de endpoints</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Receber respostas estruturadas com confirmação de processamento</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Monitorar status de sincronizações em tempo real</span>
                        </li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="workflows-disponiveis">
                  <AccordionTrigger>Workflows Disponíveis via MCP</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="grid gap-3">
                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-primary" />
                            <span className="font-medium">sync_contas_receber</span>
                          </div>
                          <Badge variant="outline">Webhook</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Sincroniza dados de contas a receber do ERP. Aceita payloads em chunks de até 10.000 registros.
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-primary" />
                            <span className="font-medium">sync_contas_pagar</span>
                          </div>
                          <Badge variant="outline">Webhook</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Sincroniza dados de contas a pagar. Suporta classificação automática por categoria DRE.
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <span className="font-medium">sync_estoque</span>
                          </div>
                          <Badge variant="outline">Webhook</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Sincroniza distribuidoras, produtos master, vínculos e movimentações de estoque.
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" />
                            <span className="font-medium">sync_clientes</span>
                          </div>
                          <Badge variant="outline">Webhook</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Sincroniza cadastro de clientes com dados completos de endereço e contato.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="configurar-n8n">
                  <AccordionTrigger>Como Configurar no N8N</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          O N8N precisa ser versão 1.0+ e ter o módulo MCP habilitado. 
                          Consulte a documentação oficial do N8N para ativação do MCP.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Passo 1: Habilitar Acesso MCP no N8N</h4>
                        <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                          <p>1. Acesse <strong>Settings → MCP Access</strong> no N8N</p>
                          <p>2. Ative <strong>Enable MCP Access</strong></p>
                          <p>3. Copie a URL MCP gerada (ex: <code className="text-xs">https://seu-n8n.com/mcp-server/http</code>)</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Passo 2: Configurar Credenciais</h4>
                        <div className="p-4 bg-muted rounded-lg relative">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`{
  "mcp_url": "https://seu-n8n.com/mcp-server/http",
  "api_key": "SUA_API_KEY_AQUI",
  "timeout_ms": 60000
}`, "mcp-config")}
                          >
                            {copiedSection === "mcp-config" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                          <pre className="text-xs overflow-x-auto">{`{
  "mcp_url": "https://seu-n8n.com/mcp-server/http",
  "api_key": "SUA_API_KEY_AQUI",
  "timeout_ms": 60000
}`}</pre>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Passo 3: Habilitar Workflows para MCP</h4>
                        <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                          <p>Para cada workflow que deseja expor:</p>
                          <p>1. Abra o workflow no editor</p>
                          <p>2. Acesse <strong>Settings (⚙️)</strong></p>
                          <p>3. Ative <strong>Available in MCP</strong></p>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="exemplo-execucao">
                  <AccordionTrigger>Exemplo de Execução via MCP</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm">Listar Workflows Disponíveis</h4>
                      <div className="p-4 bg-muted rounded-lg relative">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`// Usando search_workflows
{
  "query": "sync",
  "limit": 10
}

// Resposta esperada
{
  "workflows": [
    {
      "id": "workflow_abc123",
      "name": "sync_contas_receber",
      "description": "Sincronização de contas a receber",
      "trigger_type": "webhook"
    },
    // ...
  ]
}`, "mcp-list")}
                        >
                          {copiedSection === "mcp-list" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        <pre className="text-xs overflow-x-auto">{`// Usando search_workflows
{
  "query": "sync",
  "limit": 10
}

// Resposta esperada
{
  "workflows": [
    {
      "id": "workflow_abc123",
      "name": "sync_contas_receber",
      "description": "Sincronização de contas a receber",
      "trigger_type": "webhook"
    },
    // ...
  ]
}`}</pre>
                      </div>

                      <h4 className="font-medium text-sm">Executar Workflow de Sincronização</h4>
                      <div className="p-4 bg-muted rounded-lg relative">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`// Usando execute_workflow
{
  "workflowId": "workflow_abc123",
  "inputs": {
    "type": "webhook",
    "webhookData": {
      "method": "POST",
      "body": {
        "contas": [
          {
            "empresa_id": 1,
            "empresa_nome": "Matriz",
            "tipo_documento": "DUP",
            "numero_documento": "12345",
            "parcela": 1,
            "cliente_codigo": "CLI001",
            "cliente_nome": "Cliente Exemplo",
            "data_vencimento": "2025-02-15",
            "valor_original": 1500.00,
            "valor_aberto": 1500.00,
            "status": "aberto"
          }
          // ... mais registros
        ],
        "chunk_id": 1,
        "total_chunks": 10
      }
    }
  }
}`, "mcp-exec")}
                        >
                          {copiedSection === "mcp-exec" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        <pre className="text-xs overflow-x-auto">{`// Usando execute_workflow
{
  "workflowId": "workflow_abc123",
  "inputs": {
    "type": "webhook",
    "webhookData": {
      "method": "POST",
      "body": {
        "contas": [
          {
            "empresa_id": 1,
            "empresa_nome": "Matriz",
            "tipo_documento": "DUP",
            "numero_documento": "12345",
            "parcela": 1,
            "cliente_codigo": "CLI001",
            "cliente_nome": "Cliente Exemplo",
            "data_vencimento": "2025-02-15",
            "valor_original": 1500.00,
            "valor_aberto": 1500.00,
            "status": "aberto"
          }
          // ... mais registros
        ],
        "chunk_id": 1,
        "total_chunks": 10
      }
    }
  }
}`}</pre>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="vantagens-mcp">
                  <AccordionTrigger>Vantagens do MCP vs API REST</AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Característica</th>
                            <th className="text-left p-2">API REST</th>
                            <th className="text-left p-2">MCP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["Configuração", "Manual (URLs, headers)", "Automática (discovery)"],
                            ["Descoberta de endpoints", "Documentação externa", "Listagem dinâmica"],
                            ["Validação de schema", "Runtime", "Pré-execução"],
                            ["Monitoramento", "Logs separados", "Integrado"],
                            ["Versionamento", "Gerenciado manualmente", "Automático"],
                            ["Segurança", "API Key", "API Key + MCP Token"],
                            ["Ideal para", "Integrações simples", "Automações complexas"],
                          ].map(([caracteristica, rest, mcp], i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2 font-medium">{caracteristica}</td>
                              <td className="p-2 text-muted-foreground">{rest}</td>
                              <td className="p-2 text-green-600">{mcp}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="seguranca-mcp">
                  <AccordionTrigger>Segurança e Boas Práticas</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <Shield className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Autenticação Dupla</p>
                          <p className="text-xs text-muted-foreground">
                            O MCP requer tanto a API Key quanto o token MCP para execução de workflows.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <Globe className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">IP Whitelist</p>
                          <p className="text-xs text-muted-foreground">
                            Configure no N8N os IPs autorizados a acessar o servidor MCP.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <Key className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Rotação de Credenciais</p>
                          <p className="text-xs text-muted-foreground">
                            Recomendamos rotacionar as credenciais MCP a cada 90 dias.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <Database className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Logs de Auditoria</p>
                          <p className="text-xs text-muted-foreground">
                            Todas as execuções via MCP são registradas com timestamp, IP e resultado.
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Separator />

              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Documentação Oficial N8N MCP</p>
                  <p className="text-xs text-muted-foreground">
                    <a 
                      href="https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/
                    </a>
                  </p>
                </div>
              </div>
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
