import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, ChevronDown, ChevronRight, Copy, Check,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Search,
  FileText, Webhook, BarChart3, Shield, Database
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const BASE_URL = "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  tag?: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: string;
  response?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-700 border-red-500/30",
};

const contasPagarSync: Endpoint[] = [
  { method: "POST", path: "/sync", description: "Sync legado (compatibilidade N8N)", tag: "sync" },
  { method: "POST", path: "/bulk-sync", description: "Sync em massa com rate limiting", tag: "sync" },
  { method: "POST", path: "/sync-incremental", description: "Sync incremental com hash de verificação", tag: "sync" },
  { method: "POST", path: "/sync-complete", description: "Finalizar sync multi-chunk", tag: "sync" },
  { method: "POST", path: "/trigger-n8n", description: "Disparar sync via webhook N8N", tag: "sync" },
  { method: "GET", path: "/status", description: "Status da última sincronização", tag: "sync" },
  { method: "GET", path: "/stats", description: "Estatísticas de sincronização", tag: "sync" },
  { method: "GET", path: "/last-sync", description: "Timestamp da última sync", tag: "sync" },
];

const contasPagarCrud: Endpoint[] = [
  {
    method: "GET", path: "/query", description: "Consulta avançada com filtros e paginação", tag: "consulta",
    params: [
      { name: "empresa_id", type: "number", required: false, description: "Filtro por empresa" },
      { name: "status", type: "string", required: false, description: "Filtro: pendente, vencido, pago, cancelado" },
      { name: "vencimento_de", type: "date", required: false, description: "Data vencimento inicial" },
      { name: "vencimento_ate", type: "date", required: false, description: "Data vencimento final" },
      { name: "limit", type: "number", required: false, description: "Máx registros (default: 100, máx: 500)" },
      { name: "offset", type: "number", required: false, description: "Paginação" },
    ],
    response: `{
  "data": [{ "id": "uuid", "fornecedor_nome": "...", "valor_original": 1500, "status": "pendente" }],
  "total": 250, "offset": 0, "limit": 100
}`,
  },
  {
    method: "PUT", path: "/update", description: "Atualização individual de título",
    body: `{ "id": "uuid-titulo", "data_vencimento": "2026-04-15", "valor_original": 1600, "portador": "Banco Itaú" }`,
    response: `{ "success": true, "message": "Título atualizado", "updated_fields": ["data_vencimento", "valor_original", "portador"] }`,
  },
  {
    method: "POST", path: "/cancelar", description: "Cancelamento com motivo obrigatório (suporta batch)",
    body: `{ "ids": ["uuid-1", "uuid-2"], "motivo": "Duplicidade de lançamento" }`,
    response: `{ "cancelados": 2, "message": "2 título(s) cancelado(s)" }`,
  },
  {
    method: "POST", path: "/registrar-pagamento", description: "Registrar pagamento/baixa via API",
    body: `{ "id": "uuid-titulo", "valor_pago": 1500, "data_pagamento": "2026-03-15", "metodo_pagamento": "PIX", "portador_id": "uuid" }`,
    response: `{ "success": true, "pagamento_id": "uuid", "novo_status": "pago", "valor_aberto": 0 }`,
  },
];

const contasPagarOmie: Endpoint[] = [
  {
    method: "GET", path: "/consultar", description: "Consultar título por ID ou código de integração (ConsultarContaPagar)", tag: "novo",
    params: [
      { name: "id", type: "uuid", required: false, description: "ID interno" },
      { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" },
      { name: "codigo_lancamento_omie", type: "integer", required: false, description: "Código numérico Omie" },
    ],
    response: `{ "conta_pagar_cadastro": { "id": "uuid", "codigo_lancamento_integracao": "INT-001", "valor_original": 100, ... } }`,
  },
  {
    method: "POST", path: "/incluir", description: "Incluir conta a pagar (IncluirContaPagar)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "INT-001", "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "2.04.01", "data_previsao": "21/03/2026", "id_conta_corrente": 4243124 }`,
    response: `{ "codigo_lancamento_omie": null, "codigo_lancamento_integracao": "INT-001", "codigo_status": "0", "descricao_status": "Cadastro incluído com sucesso!" }`,
  },
  {
    method: "PUT", path: "/alterar", description: "Alterar conta a pagar (AlterarContaPagar)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "INT-001", "valor_documento": 150, "data_vencimento": "30/04/2026" }`,
    response: `{ "codigo_lancamento_integracao": "INT-001", "codigo_status": "0", "descricao_status": "Cadastro alterado com sucesso!" }`,
  },
  {
    method: "DELETE", path: "/excluir", description: "Excluir (inativar) conta a pagar (ExcluirContaPagar)", tag: "novo",
    params: [
      { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" },
      { name: "id", type: "uuid", required: false, description: "ID interno" },
    ],
  },
  {
    method: "POST", path: "/upsert", description: "Upsert unitário por codigo_lancamento_integracao (UpsertContaPagar)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "INT-001", "empresa_id": 8, "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "2.04.01" }`,
  },
  {
    method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500) (UpsertContaPagarPorLote)", tag: "novo",
    body: `{ "lote": 1, "conta_pagar_cadastro": [{ "codigo_lancamento_integracao": "INT-001", "empresa_id": 8, "valor_documento": 100 }] }`,
    response: `{ "lote": 1, "codigo_status": "0", "descricao_status": "1 processado(s), 0 erro(s)" }`,
  },
  {
    method: "POST", path: "/lancar-pagamento", description: "Efetuar baixa de pagamento (LancarPagamento)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "INT-001", "valor": 100.20, "desconto": 0, "juros": 0, "multa": 0, "data": "21/03/2026", "observacao": "Baixa via API" }`,
    response: `{ "codigo_lancamento_integracao": "INT-001", "codigo_baixa": "uuid", "liquidado": "S", "valor_baixado": 100.20, "codigo_status": "0", "descricao_status": "Pagamento registrado com sucesso!" }`,
  },
  {
    method: "POST", path: "/cancelar-pagamento", description: "Cancelar pagamento/baixa (CancelarPagamento)", tag: "novo",
    body: `{ "codigo_baixa": "uuid-pagamento" }`,
    response: `{ "codigo_baixa": "uuid", "codigo_status": "0", "descricao_status": "Pagamento cancelado com sucesso!" }`,
  },
  {
    method: "GET", path: "/listar", description: "Listagem paginada Omie-style (ListarContasPagar)", tag: "novo",
    params: [
      { name: "pagina", type: "integer", required: false, description: "Número da página (default: 1)" },
      { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (máx 500)" },
      { name: "apenas_importado_api", type: "string", required: false, description: "Filtrar importados (S/N)" },
      { name: "filtrar_por_status", type: "string", required: false, description: "Filtrar por status" },
      { name: "filtrar_por_data_de", type: "date", required: false, description: "Vencimento a partir de" },
      { name: "filtrar_por_data_ate", type: "date", required: false, description: "Vencimento até" },
      { name: "filtrar_cliente", type: "integer", required: false, description: "Código do cliente/fornecedor" },
      { name: "filtrar_por_projeto", type: "integer", required: false, description: "Código do projeto" },
      { name: "ordenar_por", type: "string", required: false, description: "Campo de ordenação" },
      { name: "ordem_descrescente", type: "string", required: false, description: "S para decrescente" },
    ],
    response: `{ "pagina": 1, "total_de_paginas": 5, "registros": 20, "total_de_registros": 100, "conta_pagar_cadastro": [...] }`,
  },
];

const contasPagarComplementar: Endpoint[] = [
  {
    method: "GET", path: "/parcelas", description: "Consulta parcelas de um título",
    params: [{ name: "conta_pagar_id", type: "uuid", required: true, description: "ID do título" }],
  },
  {
    method: "POST", path: "/parcelas/sync", description: "Sync de parcelas do ERP (máx 5000/request)",
    body: `{ "parcelas": [{ "conta_pagar_id": "uuid", "numero": 1, "valor": 500, "data_vencimento": "2026-04-15" }] }`,
  },
  {
    method: "GET", path: "/pagamentos", description: "Histórico de pagamentos de um título",
    params: [{ name: "conta_pagar_id", type: "uuid", required: true, description: "ID do título" }],
  },
  {
    method: "POST", path: "/estornar", description: "Estorno de pagamento com recálculo de saldo",
    body: `{ "id": "uuid-titulo", "motivo": "Pagamento indevido", "valor_estorno": 500 }`,
  },
  { method: "GET", path: "/anexos", description: "Consultar comprovantes de um título" },
  { method: "POST", path: "/anexos", description: "Registrar comprovante de pagamento" },
];

const exportPull: Endpoint[] = [
  {
    method: "GET", path: "/pending", description: "Itens aceitos pendentes de exportação (provisão)",
    response: `{
  "data": [{
    "id": "uuid", "export_type": "registration",
    "fornecedor": { "nome": "ABC Ltda", "documento": "12345678000190" },
    "pagamento": { "valor": 1500, "moeda": "BRL", "data_vencimento": "2026-03-15" },
    "status": "Aguardando Pagamento"
  }], "total": 5
}`,
  },
  { method: "GET", path: "/paid", description: "Itens pagos pendentes de exportação (baixa)" },
  { method: "GET", path: "/cancelled", description: "Títulos cancelados pendentes de exportação" },
  {
    method: "POST", path: "/confirm", description: "Confirmar recebimento pelo ERP",
    body: `{ "ids": ["uuid-1", "uuid-2"], "export_type": "registration" }`,
    response: `{ "confirmed": 2, "export_type": "registration" }`,
  },
  { method: "GET", path: "/status", description: "Status global de pendências de exportação" },
];

const exportAdvanced: Endpoint[] = [
  {
    method: "GET", path: "/history", description: "Histórico completo de exportações com filtros", tag: "novo",
    params: [
      { name: "export_type", type: "string", required: false, description: "registration, payment, cancellation" },
      { name: "status", type: "string", required: false, description: "exported, pending, error" },
      { name: "limit", type: "number", required: false, description: "Máx 500" },
    ],
  },
  {
    method: "POST", path: "/export-batch", description: "Exportação em lote (até 200 itens)", tag: "novo",
    body: `{ "ids": ["uuid-1", "uuid-2"], "channel": "rest_api", "export_type": "payment" }`,
    response: `{ "queued": 2, "skipped": 0, "message": "2 item(ns) enfileirado(s)" }`,
  },
  {
    method: "POST", path: "/retry-failed", description: "Reprocessar exportações com erro", tag: "novo",
    body: `{ "ids": ["queue-uuid-1"], "channel": "rest_api" }`,
  },
  {
    method: "GET", path: "/reconciliation", description: "Reconciliação BiMaster ↔ ERP", tag: "novo",
    params: [{ name: "empresa_id", type: "number", required: false, description: "Filtro por empresa" }],
    response: `{
  "resumo": { "total_titulos": 500, "exportados": 480, "com_erro": 5, "taxa_sincronizacao": 96.0 },
  "por_status": { "pendente": { "total": 100, "exported": 95 }, "pago": { "total": 300, "exported": 298 } }
}`,
  },
  {
    method: "GET", path: "/export-summary", description: "Resumo detalhado por empresa e período", tag: "novo",
    params: [
      { name: "empresa_id", type: "number", required: false, description: "Filtro por empresa" },
      { name: "periodo_de", type: "date", required: false, description: "Data inicial" },
      { name: "periodo_ate", type: "date", required: false, description: "Data final" },
    ],
  },
  {
    method: "POST", path: "/webhook-push", description: "Configurar webhook outbound push", tag: "novo",
    body: `{ "webhook_url": "https://erp.com/webhook", "events": ["accepted", "paid", "cancelled"], "secret": "hmac-secret" }`,
  },
];

const contasCorrentesCrud: Endpoint[] = [
  {
    method: "GET", path: "/", description: "Listar contas correntes (paginado)", tag: "novo",
    params: [
      { name: "pagina", type: "integer", required: false, description: "Número da página (default: 1)" },
      { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (máx 500)" },
      { name: "apenas_importado_api", type: "string", required: false, description: "Filtrar importados (S/N)" },
      { name: "filtrar_apenas_ativo", type: "string", required: false, description: "Filtrar ativos (S/N)" },
      { name: "ordenar_por", type: "string", required: false, description: "Campo de ordenação" },
    ],
    response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 100, "total_de_registros": 250, "ListarContasCorrentes": [...] }`,
  },
  {
    method: "GET", path: "/resumo", description: "Listagem resumida de contas correntes", tag: "novo",
    params: [
      { name: "pagina", type: "integer", required: false, description: "Número da página" },
      { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página" },
    ],
  },
  {
    method: "GET", path: "/consultar", description: "Consultar conta corrente por ID ou código de integração", tag: "novo",
    params: [
      { name: "id", type: "uuid", required: false, description: "ID interno" },
      { name: "cCodCCInt", type: "string", required: false, description: "Código de integração" },
      { name: "nCodCC", type: "integer", required: false, description: "Código numérico Omie" },
    ],
    response: `{ "fin_conta_corrente_cadastro": { "nCodCC": 12345, "cCodCCInt": "MyCC0001", "descricao": "Conta Itaú", ... } }`,
  },
  {
    method: "POST", path: "/incluir", description: "Incluir nova conta corrente",
    body: `{ "cCodCCInt": "MyCC0001", "tipo_conta_corrente": "CC", "codigo_banco": "341", "descricao": "Conta Itaú", "saldo_inicial": 10000 }`,
    response: `{ "cCodCCInt": "MyCC0001", "cCodStatus": "0", "cDesStatus": "Conta corrente incluída com sucesso" }`,
  },
  {
    method: "PUT", path: "/alterar", description: "Alterar conta corrente existente",
    body: `{ "cCodCCInt": "MyCC0001", "descricao": "Conta Itaú Atualizada", "valor_limite": 75000 }`,
    response: `{ "cCodCCInt": "MyCC0001", "cCodStatus": "0", "cDesStatus": "Conta corrente alterada com sucesso" }`,
  },
  {
    method: "DELETE", path: "/excluir", description: "Excluir (inativar) conta corrente",
    params: [
      { name: "cCodCCInt", type: "string", required: false, description: "Código de integração" },
      { name: "id", type: "uuid", required: false, description: "ID interno" },
    ],
  },
  {
    method: "POST", path: "/upsert", description: "Upsert unitário (cria ou atualiza por cCodCCInt)",
    body: `{ "cCodCCInt": "MyCC0001", "tipo_conta_corrente": "CC", "codigo_banco": "341", "descricao": "Conta Itaú", "saldo_inicial": 10000 }`,
  },
  {
    method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500 contas)",
    body: `{ "lote": 1, "fin_conta_corrente_cadastro": [{ "cCodCCInt": "MyCC0001", "descricao": "Caixinha", "saldo_inicial": 0 }] }`,
    response: `{ "lote": 1, "cCodStatus": "0", "cDesStatus": "1 processado(s), 0 erro(s)" }`,
  },
  {
    method: "POST", path: "/sync", description: "Sync legado (compatibilidade N8N)",
    body: `{ "contas": [{ "cCodCCInt": "CC001", "descricao": "Bradesco", "codigo_banco": "237" }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const lancamentosCcCrud: Endpoint[] = [
  {
    method: "GET", path: "/", description: "Listar lançamentos de conta corrente (paginado)", tag: "novo",
    params: [
      { name: "nPagina", type: "integer", required: false, description: "Número da página (default: 1)" },
      { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página (máx 500)" },
      { name: "nCodCC", type: "integer", required: false, description: "Filtro por conta corrente (código Omie)" },
      { name: "cOrigem", type: "string", required: false, description: "Filtro por origem: MANU, CONP, CONR, TRAN" },
      { name: "dtPagInicial", type: "date", required: false, description: "Data do lançamento inicial" },
      { name: "dtPagFinal", type: "date", required: false, description: "Data do lançamento final" },
      { name: "cOrdenarPor", type: "string", required: false, description: "Campo de ordenação" },
      { name: "cOrdemDecrescente", type: "string", required: false, description: "S para ordem decrescente" },
    ],
    response: `{ "nPagina": 1, "nTotPaginas": 5, "nRegistros": 20, "nTotRegistros": 95, "listaLancamentos": [...] }`,
  },
  {
    method: "GET", path: "/consultar", description: "Consultar lançamento por ID ou código de integração", tag: "novo",
    params: [
      { name: "id", type: "uuid", required: false, description: "ID interno" },
      { name: "cCodIntLanc", type: "string", required: false, description: "Código de integração" },
      { name: "nCodLanc", type: "integer", required: false, description: "Código numérico Omie" },
    ],
    response: `{ "lancamento": { "nCodLanc": 12345, "cCodIntLanc": "LANC001", "cabecalho": {...}, "detalhes": {...}, ... } }`,
  },
  {
    method: "POST", path: "/incluir", description: "Incluir novo lançamento de conta corrente",
    body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "nCodCliente": 2485994, "cObs": "Pagamento jardinagem" } }`,
    response: `{ "nCodLanc": null, "cCodIntLanc": "LANC001", "cCodStatus": "0", "cDesStatus": "Lançamento incluído com sucesso" }`,
  },
  {
    method: "PUT", path: "/alterar", description: "Alterar lançamento existente",
    body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nValorLanc": 200.00 }, "detalhes": { "cObs": "Valor corrigido" } }`,
    response: `{ "cCodIntLanc": "LANC001", "cCodStatus": "0", "cDesStatus": "Lançamento alterado com sucesso" }`,
  },
  {
    method: "DELETE", path: "/excluir", description: "Excluir (inativar) lançamento",
    params: [
      { name: "cCodIntLanc", type: "string", required: false, description: "Código de integração" },
      { name: "id", type: "uuid", required: false, description: "ID interno" },
    ],
  },
  {
    method: "POST", path: "/upsert", description: "Upsert unitário (cria ou atualiza por cCodIntLanc)",
    body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN" } }`,
  },
  {
    method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500 lançamentos)",
    body: `{ "lote": 1, "lancamentos": [{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 100 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN" } }] }`,
    response: `{ "lote": 1, "cCodStatus": "0", "cDesStatus": "1 processado(s), 0 erro(s)" }`,
  },
  {
    method: "POST", path: "/sync", description: "Sync legado (compatibilidade N8N)",
    body: `{ "lancamentos": [{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 100 }, "detalhes": { "cTipo": "DIN" } }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
  {
    method: "GET", path: "/extrato", description: "Extrato de conta corrente com saldos e movimentos (ListarExtrato)", tag: "novo",
    params: [
      { name: "nCodCC", type: "integer", required: false, description: "Código Omie da conta corrente" },
      { name: "cCodIntCC", type: "string", required: false, description: "Código de integração da conta" },
      { name: "dPeriodoInicial", type: "string", required: false, description: "Período inicial (dd/mm/yyyy ou yyyy-mm-dd)" },
      { name: "dPeriodoFinal", type: "string", required: false, description: "Período final (dd/mm/yyyy ou yyyy-mm-dd)" },
      { name: "cExibirApenasSaldo", type: "string", required: false, description: "S para retornar apenas saldos sem movimentos" },
    ],
    response: `{ "nCodCC": 427619317, "cDescricao": "Conta Bradesco", "dPeriodoInicial": "01/03/2026", "dPeriodoFinal": "21/03/2026", "nSaldoAnterior": 10000.00, "nSaldoAtual": 15230.50, "listaMovimentos": [{ "nCodLancamento": 123, "dDataLancamento": "05/03/2026", "nValorDocumento": 500.00, "nSaldo": 10500.00, "cNatureza": "C" }] }`,
  },
];

const contasReceberOmie: Endpoint[] = [
  {
    method: "GET", path: "/consultar", description: "Consultar título por ID ou código de integração (ConsultarContaReceber)", tag: "novo",
    params: [
      { name: "id", type: "uuid", required: false, description: "ID interno" },
      { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" },
      { name: "codigo_lancamento_omie", type: "integer", required: false, description: "Código numérico Omie" },
    ],
    response: `{ "conta_receber_cadastro": { "id": "uuid", "codigo_lancamento_integracao": "CR-001", "valor_original": 100, ... } }`,
  },
  {
    method: "POST", path: "/incluir", description: "Incluir conta a receber (IncluirContaReceber)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "CR-001", "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "1.01.02", "data_previsao": "21/03/2026", "id_conta_corrente": 4243124 }`,
    response: `{ "codigo_lancamento_omie": null, "codigo_lancamento_integracao": "CR-001", "codigo_status": "0", "descricao_status": "Cadastro incluído com sucesso!" }`,
  },
  {
    method: "PUT", path: "/alterar", description: "Alterar conta a receber (AlterarContaReceber)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "CR-001", "valor_documento": 150, "data_vencimento": "30/04/2026" }`,
    response: `{ "codigo_lancamento_integracao": "CR-001", "codigo_status": "0", "descricao_status": "Cadastro alterado com sucesso!" }`,
  },
  {
    method: "DELETE", path: "/excluir", description: "Excluir (inativar) conta a receber (ExcluirContaReceber)", tag: "novo",
    params: [
      { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" },
      { name: "id", type: "uuid", required: false, description: "ID interno" },
    ],
  },
  {
    method: "POST", path: "/upsert", description: "Upsert unitário (UpsertContaReceber)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "CR-001", "empresa_id": 8, "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "1.01.02" }`,
  },
  {
    method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500) (UpsertContaReceberPorLote)", tag: "novo",
    body: `{ "lote": 1, "conta_receber_cadastro": [{ "codigo_lancamento_integracao": "CR-001", "empresa_id": 8, "valor_documento": 100 }] }`,
    response: `{ "lote": 1, "codigo_status": "0", "descricao_status": "1 processado(s), 0 erro(s)" }`,
  },
  {
    method: "POST", path: "/lancar-recebimento", description: "Registrar recebimento/baixa (LancarRecebimento)", tag: "novo",
    body: `{ "codigo_lancamento_integracao": "CR-001", "valor": 100.20, "desconto": 0, "juros": 0, "multa": 0, "data": "21/03/2026", "observacao": "Baixa via API" }`,
    response: `{ "codigo_lancamento_integracao": "CR-001", "liquidado": "S", "valor_baixado": 100.20, "codigo_status": "0", "descricao_status": "Recebimento registrado com sucesso!" }`,
  },
  {
    method: "POST", path: "/cancelar-recebimento", description: "Cancelar recebimento (CancelarRecebimento)", tag: "novo",
    body: `{ "codigo_baixa": 0 }`,
    response: `{ "codigo_baixa": 0, "codigo_status": "0", "descricao_status": "Recebimento cancelado com sucesso!" }`,
  },
  {
    method: "POST", path: "/conciliar", description: "Conciliar recebimento (ConciliarRecebimento)", tag: "novo",
    body: `{ "codigo_baixa": 0 }`,
  },
  {
    method: "POST", path: "/desconciliar", description: "Desconciliar recebimento (DesconciliarRecebimento)", tag: "novo",
    body: `{ "codigo_baixa": 0 }`,
  },
  {
    method: "POST", path: "/cancelar", description: "Cancelar título (CancelarContaReceber)", tag: "novo",
    body: `{ "chave_lancamento": 0 }`,
  },
  {
    method: "GET", path: "/listar", description: "Listagem paginada Omie-style (ListarContasReceber)", tag: "novo",
    params: [
      { name: "pagina", type: "integer", required: false, description: "Número da página (default: 1)" },
      { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (máx 500)" },
      { name: "filtrar_por_status", type: "string", required: false, description: "Filtrar por status" },
      { name: "filtrar_por_data_de", type: "date", required: false, description: "Vencimento a partir de" },
      { name: "filtrar_por_data_ate", type: "date", required: false, description: "Vencimento até" },
      { name: "filtrar_cliente", type: "integer", required: false, description: "Código do cliente" },
      { name: "filtrar_por_projeto", type: "integer", required: false, description: "Código do projeto" },
      { name: "filtrar_por_vendedor", type: "integer", required: false, description: "Código do vendedor" },
      { name: "filtrar_por_cpf_cnpj", type: "string", required: false, description: "Filtrar por CPF/CNPJ" },
      { name: "ordenar_por", type: "string", required: false, description: "Campo de ordenação" },
      { name: "ordem_descrescente", type: "string", required: false, description: "S para decrescente" },
    ],
    response: `{ "pagina": 1, "total_de_paginas": 5, "registros": 20, "total_de_registros": 100, "conta_receber_cadastro": [...] }`,
  },
];

const contasReceberSync: Endpoint[] = [
  { method: "POST", path: "/sync", description: "Sync legado (compatibilidade N8N)", tag: "sync" },
  { method: "POST", path: "/bulk-sync", description: "Sync em massa", tag: "sync" },
  { method: "POST", path: "/sync-chunk", description: "Sync chunk", tag: "sync" },
  { method: "GET", path: "/sync-status", description: "Status da sync", tag: "sync" },
  { method: "POST", path: "/delete-old", description: "Limpar registros antigos", tag: "sync" },
];

const boletosCrud: Endpoint[] = [
  {
    method: "POST", path: "/gerar", description: "Gerar boleto para título CR (GerarBoleto)", tag: "novo",
    body: `{ "nCodTitulo": 0, "cCodIntTitulo": "CR-001", "nPerJuros": 2.0, "nPerMulta": 2.0, "dDescontoCond1": "2026-03-25", "vDescontoCond1": 5.00 }`,
    response: `{ "cLinkBoleto": "https://...", "cCodStatus": "0", "cDesStatus": "Boleto gerado com sucesso!", "dDtEmBol": "2026-03-21", "cNumBoleto": "BOL-001", "cCodBarras": "23793...", "nPerJuros": 2.0, "nPerMulta": 2.0 }`,
  },
  {
    method: "GET", path: "/obter", description: "Obter link e dados do boleto (ObterBoleto)", tag: "novo",
    params: [
      { name: "nCodTitulo", type: "integer", required: false, description: "Código do título no Omie" },
      { name: "cCodIntTitulo", type: "string", required: false, description: "Código de integração do título" },
      { name: "id", type: "uuid", required: false, description: "ID interno do boleto" },
    ],
    response: `{ "cLinkBoleto": "https://...", "cCodStatus": "0", "cDesStatus": "Boleto localizado com sucesso!", "dDtEmBol": "2026-03-21", "cNumBoleto": "BOL-001" }`,
  },
  {
    method: "POST", path: "/cancelar", description: "Cancelar boleto gerado (CancelarBoleto)", tag: "novo",
    body: `{ "nCodTitulo": 0, "cCodIntTitulo": "CR-001" }`,
    response: `{ "cCodStatus": "0", "cDesStatus": "Boleto cancelado com sucesso!" }`,
  },
  {
    method: "POST", path: "/prorrogar", description: "Prorrogar vencimento do boleto (ProrrogarBoleto)", tag: "novo",
    body: `{ "nCodTitulo": 0, "cCodIntTitulo": "CR-001", "dDtVenc": "30/04/2026" }`,
    response: `{ "cLinkBoleto": "https://...", "cCodStatus": "0", "cDesStatus": "Boleto prorrogado com sucesso!" }`,
  },
  {
    method: "GET", path: "/listar", description: "Listar boletos paginado",
    params: [
      { name: "pagina", type: "integer", required: false, description: "Página (default: 1)" },
      { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (máx 500)" },
      { name: "status", type: "string", required: false, description: "Filtro: gerado, cancelado, prorrogado" },
    ],
    response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 20, "total_de_registros": 50, "boletos": [...] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const anexosCrud: Endpoint[] = [
  {
    method: "POST", path: "/incluir", description: "Incluir anexo (base64 zip) vinculado a um documento (IncluirAnexo)", tag: "novo",
    body: `{ "cCodIntAnexo": "ANX-001", "cTabela": "contas_receber", "nId": 12345, "cNomeArquivo": "comprovante.pdf", "cTipoArquivo": "pdf", "cArquivo": "<base64>", "cMd5": "a1b2c3..." }`,
    response: `{ "cCodIntAnexo": "ANX-001", "cTabela": "contas_receber", "nId": 12345, "nIdAnexo": 0, "cNomeArquivo": "comprovante.pdf", "cCodStatus": "0", "cDesStatus": "Anexo incluído com sucesso!" }`,
  },
  {
    method: "GET", path: "/consultar", description: "Consultar metadados de um anexo (ConsultarAnexo)", tag: "novo",
    params: [
      { name: "cCodIntAnexo", type: "string", required: false, description: "Código de integração do anexo" },
      { name: "cTabela", type: "string", required: false, description: "Tabela de origem" },
      { name: "nId", type: "integer", required: false, description: "ID do documento" },
      { name: "nIdAnexo", type: "integer", required: false, description: "ID do anexo" },
    ],
    response: `{ "cCodIntAnexo": "ANX-001", "cTabela": "contas_receber", "nId": 12345, "cNomeArquivo": "comprovante.pdf", "cTipoArquivo": "pdf", "info": { "dInc": "21/03/2026" } }`,
  },
  {
    method: "GET", path: "/obter", description: "Obter link de download temporário (ObterAnexo)", tag: "novo",
    params: [
      { name: "cCodIntAnexo", type: "string", required: false, description: "Código de integração" },
      { name: "cTabela", type: "string", required: false, description: "Tabela de origem" },
      { name: "nId", type: "integer", required: false, description: "ID do documento" },
    ],
    response: `{ "cLinkDownload": "https://...", "dDtExpiracao": "21/03/2026", "cCodStatus": "0", "cDesStatus": "Link gerado com sucesso!" }`,
  },
  {
    method: "GET", path: "/listar", description: "Listar anexos de um documento (ListarAnexo)", tag: "novo",
    params: [
      { name: "nPagina", type: "integer", required: false, description: "Página (default: 1)" },
      { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página (máx 200)" },
      { name: "nId", type: "integer", required: true, description: "ID do documento" },
      { name: "cTabela", type: "string", required: true, description: "Tabela de origem" },
    ],
    response: `{ "nPagina": 1, "nTotPaginas": 1, "nRegistros": 2, "nTotRegistros": 2, "listaAnexos": [...] }`,
  },
  {
    method: "DELETE", path: "/excluir", description: "Excluir anexo (ExcluirAnexo)", tag: "novo",
    body: `{ "cCodIntAnexo": "ANX-001", "cTabela": "contas_receber", "nId": 12345 }`,
    response: `{ "cCodStatus": "0", "cDesStatus": "Anexo excluído com sucesso!" }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const empresasCrud: Endpoint[] = [
  {
    method: "POST", path: "/consultar", description: "Consultar empresa por código (ConsultarEmpresa)", tag: "novo",
    body: `{ "codigo_empresa": 8 }`,
    response: `{ "codigo_empresa": 8, "razao_social": "Empresa ABC", "cnpj": "12.345.678/0001-90", "estado": "SP", "inativa": "N", "inclusao_data": "15/01/2026", "..." }`,
  },
  {
    method: "POST", path: "/listar", description: "Listar empresas paginadas (ListarEmpresas)", tag: "novo",
    body: `{ "pagina": 1, "registros_por_pagina": 100 }`,
    response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 2, "total_de_registros": 2, "empresas_cadastro": [...] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const departamentosCrud: Endpoint[] = [
  {
    method: "POST", path: "/incluir", description: "Incluir novo departamento (IncluirDepartamento)", tag: "novo",
    body: `{ "codigo": "000000000723648", "descricao": "Marketing Digital" }`,
    response: `{ "codigo": "000000000723648", "descricao": "Marketing Digital", "cCodStatus": "0", "cDesStatus": "Departamento incluído com sucesso" }`,
  },
  {
    method: "POST", path: "/alterar", description: "Alterar departamento (AlterarDepartamento)", tag: "novo",
    body: `{ "codigo": "000000000723648", "descricao": "Marketing Atualizado" }`,
    response: `{ "codigo": "000000000723648", "descricao": "Marketing Atualizado", "cCodStatus": "0", "cDesStatus": "Departamento alterado com sucesso" }`,
  },
  {
    method: "POST", path: "/consultar", description: "Consultar departamento por código (ConsultarDepartamento)", tag: "novo",
    body: `{ "codigo": "000000000723648" }`,
    response: `{ "codigo": "000000000723648", "descricao": "Marketing Digital", "estrutura": "", "inativo": "N", "nivel_totalizador": "N" }`,
  },
  {
    method: "POST", path: "/excluir", description: "Excluir departamento (ExcluirDepartamento)", tag: "novo",
    body: `{ "codigo": "000000000723648" }`,
    response: `{ "codigo": "000000000723648", "descricao": "Marketing Digital", "cCodStatus": "0", "cDesStatus": "Departamento excluído com sucesso" }`,
  },
  {
    method: "POST", path: "/listar", description: "Listar departamentos paginados (ListarDepartamentos)", tag: "novo",
    body: `{ "pagina": 1, "registros_por_pagina": 50 }`,
    response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 3, "total_de_registros": 3, "departamentos": [...] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const categoriasCrud: Endpoint[] = [
  {
    method: "POST", path: "/incluir", description: "Incluir nova categoria (IncluirCategoria)", tag: "novo",
    body: `{ "descricao": "Serviços Terceiros", "tipo_categoria": "D", "natureza": "Despesas com serviços", "codigo_dre": "3.01.01", "categoria_superior": "" }`,
    response: `{ "codigo": "CAT-xxx", "codigo_status": "0", "descricao_status": "Categoria incluída com sucesso!" }`,
  },
  {
    method: "POST", path: "/incluir-grupo", description: "Incluir grupo totalizador (IncluirGrupoCategoria)", tag: "novo",
    body: `{ "descricao": "Despesas Operacionais", "tipo_grupo": "D", "natureza": "Grupo de despesas operacionais" }`,
    response: `{ "codigo": "GRP-xxx", "codigo_status": "0", "descricao_status": "Grupo de categoria incluído com sucesso!" }`,
  },
  {
    method: "POST", path: "/alterar", description: "Alterar categoria (AlterarCategoria)", tag: "novo",
    body: `{ "codigo": "CAT-001", "descricao": "Serviços Terceiros Atualizado", "tipo_categoria": "D" }`,
    response: `{ "codigo": "CAT-001", "descricao": "Serviços Terceiros Atualizado", "codigo_status": "0", "descricao_status": "Categoria alterada com sucesso!" }`,
  },
  {
    method: "POST", path: "/alterar-grupo", description: "Alterar grupo totalizador (AlterarGrupoCategoria)", tag: "novo",
    body: `{ "codigo": "GRP-001", "descricao": "Despesas Operacionais Atualizado" }`,
    response: `{ "codigo": "GRP-001", "descricao": "Despesas Operacionais Atualizado", "codigo_status": "0", "descricao_status": "Grupo alterado com sucesso!" }`,
  },
  {
    method: "POST", path: "/consultar", description: "Consultar categoria por código (ConsultarCategoria)", tag: "novo",
    body: `{ "codigo": "CAT-001" }`,
    response: `{ "categoria_cadastro": { "codigo": "CAT-001", "descricao": "Serviços Terceiros", "tipo_categoria": "D", "conta_inativa": "N", "totalizadora": "N", "dadosDRE": { "codigoDRE": "3.01.01" } } }`,
  },
  {
    method: "POST", path: "/listar", description: "Listar categorias paginadas (ListarCategorias)", tag: "novo",
    body: `{ "pagina": 1, "registros_por_pagina": 50, "filtrar_apenas_ativo": "S", "filtrar_por_tipo": "" }`,
    response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "categoria_cadastro": [...] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];


  {
    method: "GET", path: "/listar", description: "Listar orçamento previsto x realizado por mês/ano (ListarOrcamentos)", tag: "novo",
    params: [
      { name: "nAno", type: "integer", required: true, description: "Ano do orçamento" },
      { name: "nMes", type: "integer", required: true, description: "Mês (1-12)" },
    ],
    response: `{ "nAno": 2026, "nMes": 3, "ListaOrcamentos": [{ "cCodCateg": "2.04.01", "cDesCateg": "Serviços Terceiros", "nValorPrevisto": 5000.00, "nValorRealizado": 3200.50 }] }`,
  },
  {
    method: "POST", path: "/incluir", description: "Cadastrar/atualizar orçamento previsto para uma categoria",
    body: `{ "nAno": 2026, "nMes": 3, "cCodCateg": "2.04.01", "cDesCateg": "Serviços Terceiros", "nValorPrevisto": 5000.00 }`,
    response: `{ "cCodStatus": "0", "cDesStatus": "Orçamento cadastrado/atualizado com sucesso" }`,
  },
  {
    method: "POST", path: "/incluir-lote", description: "Upsert em lote de orçamentos previstos (máx 500)",
    body: `{ "nAno": 2026, "nMes": 3, "orcamentos": [{ "cCodCateg": "2.04.01", "cDesCateg": "Serviços Terceiros", "nValorPrevisto": 5000.00 }] }`,
    response: `{ "cCodStatus": "0", "cDesStatus": "2 orçamento(s) cadastrado(s)/atualizado(s)", "nTotal": 2 }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const pesquisarLancamentosCrud: Endpoint[] = [
  {
    method: "POST", path: "/pesquisar", description: "Pesquisa avançada unificada de títulos (PesquisarLancamentos)", tag: "novo",
    body: `{ "nPagina": 1, "nRegPorPagina": 20, "cNatureza": "R", "cStatus": "pendente", "dDtVencDe": "01/01/2026", "dDtVencAte": "31/03/2026", "nCodCliente": 4214850, "cCodCateg": "1.01.02", "cOrdenarPor": "data_vencimento", "cOrdemDecrescente": "S" }`,
    response: `{ "nPagina": 1, "nTotPaginas": 5, "nRegistros": 20, "nTotRegistros": 100, "titulosEncontrados": [{ "cabecTitulo": { "nCodTitulo": 123, "cCodIntTitulo": "CR-001", "nValorTitulo": 500, "cNatureza": "R" }, "lancamentos": [], "resumo": { "cLiquidado": "N", "nValPago": 200, "nValAberto": 300 } }] }`,
    params: [
      { name: "nPagina", type: "integer", required: false, description: "Página (default: 1)" },
      { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página (máx 500)" },
      { name: "cNatureza", type: "string", required: false, description: "R=Receber, P=Pagar, vazio=ambos" },
      { name: "cStatus", type: "string", required: false, description: "Status (vírgula para múltiplos)" },
      { name: "nCodCliente", type: "integer", required: false, description: "Código do cliente/fornecedor" },
      { name: "cCodCateg", type: "string", required: false, description: "Código da categoria" },
      { name: "dDtVencDe/Ate", type: "string", required: false, description: "Filtro por vencimento" },
      { name: "dDtEmisDe/Ate", type: "string", required: false, description: "Filtro por emissão" },
      { name: "cOrdenarPor", type: "string", required: false, description: "Campo de ordenação" },
      { name: "cOrdemDecrescente", type: "string", required: false, description: "S para decrescente" },
      { name: "lDadosCad", type: "boolean", required: false, description: "Incluir dados cadastrais" },
    ],
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const movimentosFinanceirosCrud: Endpoint[] = [
  {
    method: "POST", path: "/listar", description: "Listagem unificada de movimentos financeiros (ListarMovimentos)", tag: "novo",
    body: `{ "nPagina": 1, "nRegPorPagina": 20, "cTpLancamento": "CP", "cExibirDepartamentos": "S", "lDadosCad": true, "dDtVencDe": "01/01/2026", "dDtVencAte": "31/03/2026" }`,
    response: `{ "nPagina": 1, "nTotPaginas": 5, "nRegistros": 20, "nTotRegistros": 100, "movimentos": [{ "detalhes": { "nCodTitulo": 123, "cNatureza": "P", "cGrupo": "CP", "nValorMovCC": 500 }, "resumo": { "cLiquidado": "S", "nValPago": 500 }, "departamentos": [], "categorias": [] }] }`,
    params: [
      { name: "nPagina", type: "integer", required: false, description: "Página (default: 1)" },
      { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página (máx 500)" },
      { name: "cTpLancamento", type: "string", required: false, description: "Tipo: CP, CR, CC ou vazio para todos" },
      { name: "cExibirDepartamentos", type: "string", required: false, description: "S para incluir departamentos" },
      { name: "lDadosCad", type: "boolean", required: false, description: "Incluir dados cadastrais" },
      { name: "nCodMovCC", type: "integer", required: false, description: "Filtro por movimento CC" },
      { name: "cNatureza", type: "string", required: false, description: "R=Receber, P=Pagar" },
      { name: "cStatus", type: "string", required: false, description: "Status (vírgula para múltiplos)" },
      { name: "dDtVencDe/Ate", type: "string", required: false, description: "Filtro por vencimento" },
      { name: "cOrdenarPor", type: "string", required: false, description: "Campo de ordenação" },
    ],
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const resumoFinanceiroCrud: Endpoint[] = [
  {
    method: "POST", path: "/resumo", description: "Resumo consolidado: saldos CC, totais CP/CR, atrasos, fluxo de caixa (ObterResumoFinancas)", tag: "novo",
    body: `{ "dDia": "21/03/2026", "lApenasResumo": false, "lExibirCategoria": true }`,
    response: `{ "dDia": "21/03/2026", "contaCorrente": { "vTotal": 150000 }, "contaPagar": { "nTotal": 45, "vTotal": 85000, "vAtraso": 12000 }, "contaReceber": { "nTotal": 30, "vTotal": 120000 }, "fluxoCaixa": { "vPagar": 85000, "vReceber": 120000, "vSaldo": 150000 } }`,
    params: [
      { name: "dDia", type: "string", required: false, description: "Data de referência (dd/mm/aaaa)" },
      { name: "lApenasResumo", type: "boolean", required: false, description: "Exibir apenas resumo" },
      { name: "lExibirCategoria", type: "boolean", required: false, description: "Incluir totais por categoria" },
    ],
  },
  {
    method: "POST", path: "/em-aberto", description: "Lista paginada de títulos em aberto (ObterListaEmAberto)", tag: "novo",
    body: `{ "dDia": "21/03/2026", "cTipo": "P", "nPagina": 1, "nRegPorPagina": 50 }`,
    response: `{ "ListaEmEberto": [{ "nIdTitulo": "uuid", "cNomeCliente": "Empresa ABC", "vDoc": 1500, "nDiasAtraso": 6 }], "nRegistros": 50, "nTotPaginas": 3, "nTotRegistros": 125 }`,
    params: [
      { name: "cTipo", type: "string", required: false, description: "P=Pagar, R=Receber" },
      { name: "nCodCliente", type: "integer", required: false, description: "Filtrar por cliente/fornecedor" },
      { name: "cNomeCliente", type: "string", required: false, description: "Busca parcial por nome" },
      { name: "nPagina", type: "integer", required: false, description: "Página (default: 1)" },
      { name: "nRegPorPagina", type: "integer", required: false, description: "Registros/página (máx 500)" },
    ],
  },
  {
    method: "POST", path: "/lista-financas", description: "Lista de lançamentos por data/categoria/tipo (ObterListaFinancas)", tag: "novo",
    body: `{ "dDia": "21/03/2026", "cCodCateg": "1.01.01", "cTipo": "R" }`,
    response: `{ "listaDetalhesFinancas": [{ "nIdTitulo": "uuid", "cNomeCliente": "ABC", "vDoc": 1500, "dVencimento": "15/03/2026" }] }`,
    params: [
      { name: "dDia", type: "string", required: false, description: "Data de referência" },
      { name: "cCodCateg", type: "string", required: false, description: "Filtrar por categoria" },
      { name: "cTipo", type: "string", required: false, description: "P=Pagar, R=Receber" },
    ],
  },
  {
    method: "POST", path: "/detalhes", description: "Detalhes completos de um título (ObterDetalhesLancamento)", tag: "novo",
    body: `{ "nIdTitulo": "uuid-do-titulo" }`,
    response: `{ "cTipoLanc": "R", "nIdTitulo": "uuid", "cNomeCliente": "ABC", "vDoc": 1500, "cSituacao": "A vencer", "boletoInfo": { "cNumBoleto": "00001", "cLinkBoleto": "https://..." }, "listaAnexos": [] }`,
    params: [
      { name: "nIdTitulo", type: "string", required: true, description: "ID do título (UUID)" },
    ],
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const webhookInbound: Endpoint[] = [
  {
    method: "POST", path: "/", description: "Receber callbacks do ERP",
    body: `{ "event": "provisao_registrada", "titulo_id": "uuid", "erp_response_code": "OK-001", "empresa_id": "8" }`,
    response: `{ "sucesso": true, "mensagem": "Evento processado" }`,
  },
];

const bancosCrud: Endpoint[] = [
  {
    method: "GET", path: "/consultar", description: "Consultar banco por código COMPE (ConsultarBanco)", tag: "novo",
    params: [
      { name: "codigo", type: "string", required: true, description: "Código COMPE do banco (ex: 001, 341)" },
    ],
    response: `{ "codigo": "001", "nome": "Banco do Brasil S.A.", "tipo": "CB", "cod_compen": "001", "cod_ispb": "00000000", "cnab_cob": "N", "obank_sn": "N", "obank_pix": "N" }`,
  },
  {
    method: "GET", path: "/listar", description: "Listar bancos cadastrados com paginação (ListarBancos)", tag: "novo",
    params: [
      { name: "pagina", type: "integer", required: false, description: "Página (default: 1)" },
      { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (default: 100, máx: 500)" },
      { name: "tipo", type: "string", required: false, description: "Tipo: CB, CX, CV, AC" },
    ],
    response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 50, "total_de_registros": 50, "fin_banco_cadastro": [{ "codigo": "001", "nome": "Banco do Brasil S.A." }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const tiposDocumentoCrud: Endpoint[] = [
  {
    method: "GET", path: "/consultar", description: "Consultar tipo de documento por código (ConsultarTipoDocumento)", tag: "novo",
    params: [
      { name: "codigo", type: "string", required: true, description: "Código do tipo de documento (ex: NF, BOLETO)" },
    ],
    response: `{ "codigo": "NF", "descricao": "Nota Fiscal" }`,
  },
  {
    method: "POST", path: "/pesquisar", description: "Pesquisar tipos de documento (PesquisarTipoDocumento)", tag: "novo",
    body: `{ "codigo": "" }`,
    response: `{ "tipo_documento_cadastro": [{ "codigo": "NF", "descricao": "Nota Fiscal" }, { "codigo": "NFE", "descricao": "NF-e (Eletrônica)" }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const dreCadastroCrud: Endpoint[] = [
  {
    method: "POST", path: "/listar", description: "Listar contas do DRE (ListarCadastroDRE)", tag: "novo",
    body: `{ "apenasContasAtivas": "N" }`,
    response: `{ "totalRegistros": 25, "dreLista": [{ "codigoDRE": "4.1", "descricaoDRE": "Receita Bruta", "naoExibirDRE": "N", "nivelDRE": 2, "sinalDRE": "+", "totalizaDRE": "N" }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const finalidadesTransfCrud: Endpoint[] = [
  {
    method: "GET", path: "/consultar", description: "Consultar finalidade por código (ConsultarFinalTransf)", tag: "novo",
    params: [
      { name: "codigo", type: "string", required: true, description: "Código da finalidade de transferência" },
      { name: "banco", type: "string", required: false, description: "Código do banco (aceito mas ignorado)" },
    ],
    response: `{ "banco": "", "codigo": "01", "descricao": "Crédito em Conta" }`,
  },
  {
    method: "GET", path: "/listar", description: "Listar finalidades paginadas (ListarFinalTransf)", tag: "novo",
    params: [
      { name: "pagina", type: "integer", required: false, description: "Número da página (default: 1)" },
      { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (default: 50, máx 500)" },
      { name: "filtrar_por_banco", type: "string", required: false, description: "Código do banco (aceito mas ignorado)" },
    ],
    response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 8, "total_de_registros": 8, "cadastros": [{ "banco": "", "codigo": "01", "descricao": "Crédito em Conta" }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const origensCrud: Endpoint[] = [
  {
    method: "POST", path: "/listar", description: "Listar origens de lançamento (ListarOrigem)", tag: "novo",
    body: `{ "codigo": "" }`,
    response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 6, "total_de_registros": 6, "origem": [{ "codigo": "MANUAL", "descricao": "Lançamento Manual" }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const bandeirasCrud: Endpoint[] = [
  {
    method: "GET", path: "/listar", description: "Lista paginada de bandeiras de cartão (ListarBandeiras)", tag: "novo",
    params: [
      { name: "nPagina", type: "integer", required: false, description: "Número da página (default 1)" },
      { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página (default 50, max 500)" },
    ],
    response: `{ "nPagina": 1, "nTotPaginas": 1, "nRegistros": 8, "nTotRegistros": 8, "listaBandeira": [{ "cCodigo": "VISA", "cDescricao": "Visa" }] }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const clientesCrud: Endpoint[] = [
  {
    method: "POST", path: "/listar", description: "Lista completa paginada de clientes (ListarClientes)", tag: "novo",
    body: `{ "pagina": 1, "registros_por_pagina": 50, "clientesFiltro": { "razao_social": "", "estado": "", "inativo": "N" } }`,
    response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "clientes_cadastro": [...] }`,
  },
  {
    method: "POST", path: "/listar-resumido", description: "Lista resumida paginada (ListarClientesResumido)", tag: "novo",
    body: `{ "pagina": 1, "registros_por_pagina": 50 }`,
    response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "clientes_cadastro_resumido": [{ "codigo_cliente": "uuid", "codigo_cliente_integracao": "CLI001", "razao_social": "ABC", "nome_fantasia": "ABC", "cnpj_cpf": "12.345.678/0001-90" }] }`,
  },
  {
    method: "POST", path: "/consultar", description: "Consultar cliente por código (ConsultarCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001" }`,
    response: `{ "clientes_cadastro": { "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "razao_social": "ABC Ltda", ... } }`,
  },
  {
    method: "POST", path: "/incluir", description: "Incluir novo cliente (IncluirCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001", "razao_social": "Empresa ABC Ltda", "nome_fantasia": "ABC", "cnpj_cpf": "12.345.678/0001-90", "email": "contato@abc.com" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Cliente incluído com sucesso!" }`,
  },
  {
    method: "POST", path: "/alterar", description: "Alterar dados do cliente (AlterarCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001", "nome_fantasia": "ABC Atualizado", "email": "novo@abc.com" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Cliente alterado com sucesso!" }`,
  },
  {
    method: "POST", path: "/excluir", description: "Excluir (inativar) cliente (ExcluirCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Cliente excluído com sucesso!" }`,
  },
  {
    method: "POST", path: "/upsert", description: "Upsert por codigo_cliente_integracao (UpsertCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001", "razao_social": "ABC Ltda", "cnpj_cpf": "12.345.678/0001-90" }`,
  },
  {
    method: "POST", path: "/upsert-cpfcnpj", description: "Upsert por CPF/CNPJ (UpsertClienteCpfCnpj)", tag: "novo",
    body: `{ "cnpj_cpf": "12.345.678/0001-90", "razao_social": "ABC Ltda", "email": "contato@abc.com" }`,
  },
  {
    method: "POST", path: "/associar", description: "Associar código de integração (AssociarCodIntCliente)", tag: "novo",
    body: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001" }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const clientesCaractCrud: Endpoint[] = [
  {
    method: "POST", path: "/caract/incluir", description: "Incluir característica (IncluirCaractCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001", "campo": "SEGMENTO", "conteudo": "Varejo" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Característica incluída com sucesso!" }`,
  },
  {
    method: "POST", path: "/caract/alterar", description: "Alterar conteúdo de característica (AlterarCaractCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001", "campo": "SEGMENTO", "conteudo": "Atacado" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Característica alterada com sucesso!" }`,
  },
  {
    method: "POST", path: "/caract/consultar", description: "Consultar todas as características (ConsultarCaractCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "caracteristicas": [{ "campo": "SEGMENTO", "conteudo": "Varejo" }] }`,
  },
  {
    method: "POST", path: "/caract/excluir", description: "Excluir uma característica (ExcluirCaractCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001", "campo": "SEGMENTO" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Característica excluída com sucesso!" }`,
  },
  {
    method: "POST", path: "/caract/excluir-todas", description: "Excluir todas as características (ExcluirTodasCaractCliente)", tag: "novo",
    body: `{ "codigo_cliente_integracao": "CLI001" }`,
    response: `{ "codigo_cliente_omie": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Todas as características excluídas com sucesso!" }`,
  },
];

const clientesTagsCrud: Endpoint[] = [
  {
    method: "POST", path: "/tags/incluir", description: "Associar tags ao cliente (IncluirTags)", tag: "novo",
    body: `{ "nCodCliente": 0, "cCodIntCliente": "CLI001", "tags": [{ "tag": "Grupo A" }, { "tag": "Grupo B" }] }`,
    response: `{ "nCodCliente": "uuid", "cCodIntCliente": "CLI001", "cCodStatus": "0", "cDesStatus": "Tags incluídas com sucesso!" }`,
  },
  {
    method: "POST", path: "/tags/listar", description: "Listar tags do cliente (ListarTags)", tag: "novo",
    body: `{ "cCodIntCliente": "CLI001" }`,
    response: `{ "nCodCliente": "uuid", "cCodIntCliente": "CLI001", "tagsLista": [{ "tag": "Grupo A", "nCodTag": 1 }] }`,
  },
  {
    method: "POST", path: "/tags/excluir", description: "Remover tags específicas (ExcluirTags)", tag: "novo",
    body: `{ "cCodIntCliente": "CLI001", "tags": [{ "tag": "Grupo A" }] }`,
    response: `{ "nCodCliente": "uuid", "cCodIntCliente": "CLI001", "cCodStatus": "0", "cDesStatus": "Tags excluídas com sucesso!" }`,
  },
  {
    method: "POST", path: "/tags/excluir-todas", description: "Remover todas as tags (ExcluirTodas)", tag: "novo",
    body: `{ "cCodIntCliente": "CLI001" }`,
    response: `{ "nCodCliente": "uuid", "cCodIntCliente": "CLI001", "cCodStatus": "0", "cDesStatus": "Todas as tags excluídas com sucesso!" }`,
  },
];

const projetosCrud: Endpoint[] = [
  {
    method: "POST", path: "/incluir", description: "Incluir novo projeto (IncluirProjeto)", tag: "novo",
    body: `{ "codInt": "PROJ-001", "nome": "Projeto Alpha", "inativo": "N" }`,
    response: `{ "codigo": "uuid", "codInt": "PROJ-001", "status": "0", "descricao": "Projeto incluído com sucesso!" }`,
  },
  {
    method: "POST", path: "/alterar", description: "Alterar projeto (AlterarProjeto)", tag: "novo",
    body: `{ "codInt": "PROJ-001", "nome": "Projeto Alpha Atualizado" }`,
    response: `{ "codigo": "uuid", "codInt": "PROJ-001", "status": "0", "descricao": "Projeto alterado com sucesso!" }`,
  },
  {
    method: "POST", path: "/consultar", description: "Consultar projeto (ConsultarProjeto)", tag: "novo",
    body: `{ "codInt": "PROJ-001" }`,
    response: `{ "codigo": "uuid", "codInt": "PROJ-001", "nome": "Projeto Alpha", "inativo": "N", "info": { "data_inc": "2026-03-21", "hora_inc": "18:00:00", "data_alt": "2026-03-21", "hora_alt": "18:00:00" } }`,
  },
  {
    method: "POST", path: "/excluir", description: "Excluir projeto — soft delete (ExcluirProjeto)", tag: "novo",
    body: `{ "codInt": "PROJ-001" }`,
    response: `{ "codigo": "uuid", "codInt": "PROJ-001", "status": "0", "descricao": "Projeto excluído com sucesso!" }`,
  },
  {
    method: "POST", path: "/listar", description: "Listar projetos paginado (ListarProjetos)", tag: "novo",
    body: `{ "pagina": 1, "registros_por_pagina": 50, "nome_projeto": "", "apenas_importado_api": "N" }`,
    response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 5, "total_de_registros": 5, "cadastro": [...] }`,
  },
  {
    method: "POST", path: "/upsert", description: "Upsert por codInt (UpsertProjeto)", tag: "novo",
    body: `{ "codInt": "PROJ-001", "nome": "Projeto Alpha", "inativo": "N" }`,
    response: `{ "codigo": "uuid", "codInt": "PROJ-001", "status": "0", "descricao": "Projeto incluído/alterado com sucesso!" }`,
  },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const otherApis: Endpoint[] = [
  { method: "GET", path: "/fornecedores", description: "Listar fornecedores sincronizados" },
  { method: "POST", path: "/fornecedores/sync", description: "Sync de fornecedores do ERP" },
  { method: "GET", path: "/portadores", description: "Listar portadores (bancos/carteiras)" },
  { method: "POST", path: "/portadores/sync", description: "Sync de portadores do ERP" },
  { method: "GET", path: "/plano-contas", description: "Listar plano de contas" },
  { method: "POST", path: "/plano-contas/sync", description: "Sync do plano de contas" },
  { method: "POST", path: "/estoque/sync", description: "Sync de estoque do ERP" },
  { method: "GET", path: "/estoque/status", description: "Status da sync de estoque" },
];

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>}
      <pre className="bg-muted/70 border rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
      <Button
        variant="ghost" size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function EndpointCard({ endpoint, basePath }: { endpoint: Endpoint; basePath: string }) {
  const [open, setOpen] = useState(false);
  const fullUrl = `${BASE_URL}${basePath}${endpoint.path}`;
  const hasDetails = endpoint.params || endpoint.body || endpoint.response;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors group">
          {hasDetails ? (
            open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : <div className="w-3.5" />}
          <Badge variant="outline" className={`${METHOD_COLORS[endpoint.method]} text-[10px] font-bold px-2 py-0 min-w-[42px] justify-center`}>
            {endpoint.method}
          </Badge>
          <code className="text-xs font-mono text-foreground">{endpoint.path}</code>
          <span className="text-xs text-muted-foreground truncate flex-1">{endpoint.description}</span>
          {endpoint.tag === "novo" && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">NOVO</Badge>}
        </div>
      </CollapsibleTrigger>
      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-10 mr-3 mb-3 space-y-3 border-l-2 border-muted pl-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">URL completa</span>
              <CodeBlock code={`curl -H "x-api-key: SUA_CHAVE" \\\n  "${fullUrl}"`} />
            </div>
            {endpoint.params && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Parâmetros</span>
                <div className="mt-1 space-y-1">
                  {endpoint.params.map(p => (
                    <div key={p.name} className="flex items-center gap-2 text-xs">
                      <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{p.name}</code>
                      <span className="text-muted-foreground">{p.type}</span>
                      {p.required && <Badge variant="outline" className="text-[9px] h-4 px-1">obrigatório</Badge>}
                      <span className="text-muted-foreground">— {p.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {endpoint.body && <CodeBlock code={endpoint.body} label="Body (JSON)" />}
            {endpoint.response && <CodeBlock code={endpoint.response} label="Resposta" />}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

interface ApiSectionProps {
  icon: React.ReactNode;
  title: string;
  basePath: string;
  endpoints: Endpoint[];
  description?: string;
}

function ApiSection({ icon, title, basePath, endpoints, description }: ApiSectionProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-4 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{title}</span>
              <Badge variant="secondary" className="text-[10px]">{endpoints.length} endpoints</Badge>
            </div>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <code className="text-[10px] font-mono text-muted-foreground hidden sm:block">{basePath}</code>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mr-2 mb-2 border-l border-muted">
          {endpoints.map((ep, i) => (
            <EndpointCard key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} basePath={basePath} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ApiDocumentation() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Documentação das APIs</CardTitle>
        </div>
        <CardDescription>
          Referência completa de todos os endpoints disponíveis para integração ERP
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="contas-pagar" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="contas-pagar" className="text-xs gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Contas a Pagar
            </TabsTrigger>
            <TabsTrigger value="contas-receber" className="text-xs gap-1.5">
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Contas a Receber
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs gap-1.5">
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Exportação
            </TabsTrigger>
            <TabsTrigger value="contas-correntes" className="text-xs gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Contas Correntes
            </TabsTrigger>
            <TabsTrigger value="lancamentos-cc" className="text-xs gap-1.5">
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Lançamentos CC
            </TabsTrigger>
            <TabsTrigger value="boletos" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Boletos
            </TabsTrigger>
            <TabsTrigger value="anexos" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Anexos
            </TabsTrigger>
            <TabsTrigger value="orcamentos" className="text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Orçamentos
            </TabsTrigger>
            <TabsTrigger value="pesquisar" className="text-xs gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Pesquisar
            </TabsTrigger>
            <TabsTrigger value="movimentos" className="text-xs gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Movimentos
            </TabsTrigger>
            <TabsTrigger value="resumo-fin" className="text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Resumo Financeiro
            </TabsTrigger>
            <TabsTrigger value="bancos" className="text-xs gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Bancos
            </TabsTrigger>
            <TabsTrigger value="tipos-doc" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Tipos Documento
            </TabsTrigger>
            <TabsTrigger value="dre-cadastro" className="text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              DRE
            </TabsTrigger>
            <TabsTrigger value="final-transf" className="text-xs gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Final. Transferência
            </TabsTrigger>
            <TabsTrigger value="origens" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Origens
            </TabsTrigger>
            <TabsTrigger value="bandeiras" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Bandeiras
            </TabsTrigger>
            <TabsTrigger value="clientes" className="text-xs gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="projetos" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Projetos
            </TabsTrigger>
            <TabsTrigger value="empresas" className="text-xs gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="departamentos" className="text-xs gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Departamentos
            </TabsTrigger>
            <TabsTrigger value="categorias" className="text-xs gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="complementar" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Dados Complementares
            </TabsTrigger>
            <TabsTrigger value="auth" className="text-xs gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Autenticação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contas-pagar" className="space-y-1">
            <ApiSection
              icon={<ArrowDownToLine className="h-4 w-4 text-blue-500" />}
              title="Sync (ERP → BiMaster)"
              basePath="/contas-pagar-api"
              endpoints={contasPagarSync}
              description="Sincronização de títulos do ERP para o BiMaster"
            />
            <ApiSection
              icon={<Search className="h-4 w-4 text-emerald-500" />}
              title="Consulta & CRUD"
              basePath="/contas-pagar-api"
              endpoints={contasPagarCrud}
              description="Consultar, atualizar, cancelar e registrar pagamentos"
            />
            <ApiSection
              icon={<FileText className="h-4 w-4 text-purple-500" />}
              title="Parcelas, Pagamentos & Anexos"
              basePath="/contas-pagar-api"
              endpoints={contasPagarComplementar}
              description="Gestão de parcelas, histórico de pagamentos e comprovantes"
            />
            <ApiSection
              icon={<Webhook className="h-4 w-4 text-amber-500" />}
              title="CRUD Omie-Style (Padrão Omie)"
              basePath="/contas-pagar-api"
              endpoints={contasPagarOmie}
              description="Consultar, incluir, alterar, excluir, upsert, lançar/cancelar pagamento — formato Omie"
            />
          </TabsContent>

          <TabsContent value="contas-receber" className="space-y-1">
            <ApiSection
              icon={<Webhook className="h-4 w-4 text-emerald-500" />}
              title="CRUD Omie-Style (Padrão Omie)"
              basePath="/contas-receber-api"
              endpoints={contasReceberOmie}
              description="Consultar, incluir, alterar, excluir, upsert, lançar/cancelar recebimento — formato Omie"
            />
            <ApiSection
              icon={<ArrowDownToLine className="h-4 w-4 text-blue-500" />}
              title="Sync (ERP → BiMaster)"
              basePath="/contas-receber-api"
              endpoints={contasReceberSync}
              description="Sincronização legada de contas a receber"
            />
          </TabsContent>

          <TabsContent value="export" className="space-y-1">
            <ApiSection
              icon={<ArrowUpFromLine className="h-4 w-4 text-emerald-500" />}
              title="Pull (ERP consulta)"
              basePath="/contas-pagar-export-api"
              endpoints={exportPull}
              description="ERP puxa títulos pendentes de provisão e baixa"
            />
            <ApiSection
              icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
              title="Avançado (Lote, Reconciliação, Webhook)"
              basePath="/contas-pagar-export-api"
              endpoints={exportAdvanced}
              description="Exportação em lote, reprocessamento, reconciliação e push"
            />
            <ApiSection
              icon={<Webhook className="h-4 w-4 text-amber-500" />}
              title="Webhook Inbound (ERP → BiMaster)"
              basePath="/erp-webhook-inbound"
              endpoints={webhookInbound}
              description="Callbacks do ERP: provisão registrada, baixa confirmada, estorno"
            />
          </TabsContent>

          <TabsContent value="contas-correntes" className="space-y-1">
            <ApiSection
              icon={<RefreshCw className="h-4 w-4 text-primary" />}
              title="CRUD & Sync (Padrão Omie)"
              basePath="/contas-correntes-api"
              endpoints={contasCorrentesCrud}
              description="Gestão completa de contas correntes: listar, consultar, incluir, alterar, excluir, upsert e sync"
            />
          </TabsContent>

          <TabsContent value="lancamentos-cc" className="space-y-1">
            <ApiSection
              icon={<ArrowDownToLine className="h-4 w-4 text-primary" />}
              title="CRUD & Sync — Lançamentos de Conta Corrente (Padrão Omie)"
              basePath="/lancamentos-cc-api"
              endpoints={lancamentosCcCrud}
              description="Gestão de lançamentos: listar, consultar, incluir, alterar, excluir, upsert, upsert em lote e sync"
            />
          </TabsContent>

          <TabsContent value="boletos" className="space-y-1">
            <ApiSection
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Boletos — Cobrança Bancária (Padrão Omie)"
              basePath="/boletos-api"
              endpoints={boletosCrud}
              description="Gerar, obter, cancelar e prorrogar boletos vinculados a títulos do Contas a Receber"
            />
          </TabsContent>

          <TabsContent value="anexos" className="space-y-1">
            <ApiSection
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Anexos de Documentos (Padrão Omie)"
              basePath="/anexos-api"
              endpoints={anexosCrud}
              description="Incluir, consultar, obter link, listar e excluir anexos vinculados a qualquer documento"
            />
          </TabsContent>

          <TabsContent value="orcamentos" className="space-y-1">
            <ApiSection
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
              title="Orçamento de Caixa — Previsto x Realizado (Padrão Omie)"
              basePath="/orcamentos-caixa-api"
              endpoints={orcamentosCaixaCrud}
              description="Listar orçamento previsto vs realizado, cadastrar e importar metas por categoria/mês"
            />
          </TabsContent>

          <TabsContent value="pesquisar" className="space-y-1">
            <ApiSection
              icon={<Search className="h-4 w-4 text-primary" />}
              title="Pesquisa Avançada de Títulos (Padrão Omie)"
              basePath="/pesquisar-lancamentos-api"
              endpoints={pesquisarLancamentosCrud}
              description="Pesquisa unificada de Contas a Pagar e Receber com filtros extensivos, lançamentos e resumo financeiro"
            />
          </TabsContent>

          <TabsContent value="movimentos" className="space-y-1">
            <ApiSection
              icon={<RefreshCw className="h-4 w-4 text-primary" />}
              title="Movimentação Financeira Unificada (Padrão Omie)"
              basePath="/movimentos-financeiros-api"
              endpoints={movimentosFinanceirosCrud}
              description="Listagem consolidada de Contas a Pagar, Contas a Receber e Lançamentos CC — cada baixa/lançamento como linha individual"
            />
          </TabsContent>

          <TabsContent value="resumo-fin" className="space-y-1">
            <ApiSection
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
              title="Resumo Financeiro — Dashboard (Padrão Omie)"
              basePath="/resumo-financeiro-api"
              endpoints={resumoFinanceiroCrud}
              description="Resumo consolidado, lista em aberto, detalhes de lançamentos e lista de finanças por categoria"
            />
          </TabsContent>

          <TabsContent value="bancos" className="space-y-1">
            <ApiSection
              icon={<Database className="h-4 w-4 text-primary" />}
              title="Bancos — ConsultarBanco + ListarBancos (Padrão Omie)"
              basePath="/bancos-api"
              endpoints={bancosCrud}
              description="Consulta e listagem de bancos/instituições financeiras cadastradas"
            />
          </TabsContent>

          <TabsContent value="tipos-doc" className="space-y-1">
            <ApiSection
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Tipos de Documento — ConsultarTipoDocumento + PesquisarTipoDocumento (Padrão Omie)"
              basePath="/tipos-documento-api"
              endpoints={tiposDocumentoCrud}
              description="Consulta e pesquisa de tipos de documento cadastrados"
            />
          </TabsContent>

          <TabsContent value="projetos" className="space-y-1">
            <ApiSection
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Projetos — CRUD Completo (Padrão Omie)"
              basePath="/projetos-api"
              endpoints={projetosCrud}
              description="Incluir, alterar, consultar, excluir, listar e upsert projetos — formato Omie"
            />
          </TabsContent>

          <TabsContent value="departamentos" className="space-y-1">
            <ApiSection
              icon={<Database className="h-4 w-4 text-primary" />}
              title="Departamentos — CRUD Completo (Padrão Omie)"
              basePath="/departamentos-api"
              endpoints={departamentosCrud}
              description="Incluir, alterar, consultar, excluir e listar departamentos — formato Omie"
            />
          </TabsContent>

          <TabsContent value="empresas" className="space-y-1">
            <ApiSection
              icon={<Database className="h-4 w-4 text-primary" />}
              title="Empresas — ConsultarEmpresa + ListarEmpresas (Padrão Omie)"
              basePath="/empresas-api"
              endpoints={empresasCrud}
              description="Consulta e listagem paginada de empresas cadastradas"
            />
          </TabsContent>

          <TabsContent value="dre-cadastro" className="space-y-1">
            <ApiSection
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
              title="DRE — ListarCadastroDRE (Padrão Omie)"
              basePath="/dre-cadastro-api"
              endpoints={dreCadastroCrud}
              description="Listagem de contas do DRE com código, descrição, nível, sinal e visibilidade"
            />
          </TabsContent>

          <TabsContent value="final-transf" className="space-y-1">
            <ApiSection
              icon={<RefreshCw className="h-4 w-4 text-primary" />}
              title="Finalidades de Transferência — ConsultarFinalTransf + ListarFinalTransf (Padrão Omie)"
              basePath="/finalidades-transferencia-api"
              endpoints={finalidadesTransfCrud}
              description="Consulta e listagem paginada de finalidades de transferência bancária"
            />
          </TabsContent>

          <TabsContent value="origens" className="space-y-1">
            <ApiSection
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Origens de Lançamento — ListarOrigem (Padrão Omie)"
              basePath="/origens-api"
              endpoints={origensCrud}
              description="Listagem de origens de lançamento com filtro por código"
            />
          </TabsContent>

          <TabsContent value="bandeiras" className="space-y-1">
            <ApiSection
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Bandeiras de Cartão — ListarBandeiras (Padrão Omie)"
              basePath="/bandeiras-api"
              endpoints={bandeirasCrud}
              description="Lista paginada de bandeiras de cartão de crédito/débito"
            />
          </TabsContent>

          <TabsContent value="clientes" className="space-y-1">
            <ApiSection
              icon={<Database className="h-4 w-4 text-primary" />}
              title="Clientes — CRUD Completo (Padrão Omie)"
              basePath="/clientes-api"
              endpoints={clientesCrud}
              description="Incluir, alterar, consultar, excluir, listar, upsert e associar clientes — formato Omie"
            />
            <ApiSection
              icon={<FileText className="h-4 w-4 text-amber-500" />}
              title="Características de Clientes (Padrão Omie)"
              basePath="/clientes-api"
              endpoints={clientesCaractCrud}
              description="Incluir, alterar, consultar e excluir características de clientes/fornecedores"
            />
            <ApiSection
              icon={<FileText className="h-4 w-4 text-emerald-500" />}
              title="Tags de Clientes (Padrão Omie)"
              basePath="/clientes-api"
              endpoints={clientesTagsCrud}
              description="Associar, listar e remover tags de clientes/fornecedores"
            />
          </TabsContent>

          <TabsContent value="complementar" className="space-y-1">
            <ApiSection
              icon={<Database className="h-4 w-4 text-orange-500" />}
              title="Fornecedores, Portadores, Plano de Contas, Estoque"
              basePath=""
              endpoints={otherApis}
              description="APIs de dados mestres e estoque"
            />
          </TabsContent>

          <TabsContent value="auth">
            <div className="space-y-4 p-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Métodos de Autenticação</h4>
                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">Recomendado</Badge>
                      <span className="font-medium text-sm">API Key (x-api-key)</span>
                    </div>
                    <CodeBlock code={`curl -H "x-api-key: huggs-erp-xxxxxxxxxxxxxxxx" \\\n  "${BASE_URL}/contas-pagar-api/query"`} />
                    <p className="text-xs text-muted-foreground mt-2">
                      Gere chaves no Portal acima. Validação via SHA-256 hash com timing-safe comparison.
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <span className="font-medium text-sm">JWT (Bearer Token)</span>
                    <CodeBlock code={`curl -H "Authorization: Bearer eyJhbGciOiJI..." \\\n  "${BASE_URL}/erp-export-payment"`} />
                    <p className="text-xs text-muted-foreground mt-2">
                      Para usuários autenticados via frontend.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Rate Limiting</h4>
                <p className="text-xs text-muted-foreground">
                  Todas as APIs têm limite de <strong>60 requisições/minuto</strong> por IP ou API key.
                  Exceder retorna <code className="bg-muted px-1 rounded">429 Too Many Requests</code> com header <code className="bg-muted px-1 rounded">Retry-After: 60</code>.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Códigos de Erro</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { code: "400", label: "Parâmetros inválidos" },
                    { code: "401", label: "API key inválida" },
                    { code: "404", label: "Rota não encontrada" },
                    { code: "429", label: "Rate limit excedido" },
                    { code: "500", label: "Erro interno" },
                  ].map(e => (
                    <div key={e.code} className="border rounded-lg p-2 text-center">
                      <code className="text-sm font-bold font-mono">{e.code}</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{e.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
