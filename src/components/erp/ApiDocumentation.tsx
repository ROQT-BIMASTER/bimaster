import { useState, useMemo, useRef } from "react";
import EndpointSupportChat from "./EndpointSupportChat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, ChevronDown, ChevronRight, Copy, Check,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Search,
  FileText, Webhook, BarChart3, Shield, Database,
  FileSpreadsheet, Building2, Layers, DollarSign, Package
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { exportToExcel } from "@/lib/excel-utils";
import type { SheetData } from "@/lib/excel-utils";

const BASE_URL = "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  tag?: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: string;
  response?: string;
  flow?: string[];
}

interface ApiDefinition {
  id: string;
  name: string;
  description: string;
  basePath: string;
  icon: React.ReactNode;
  sections: { title: string; endpoints: Endpoint[]; description?: string }[];
}

interface ApiModule {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  apis: ApiDefinition[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-700 border-red-500/30",
};

// ═══════════════════════════════════════
// REUSABLE FLOW PATTERNS
// ═══════════════════════════════════════
const FLOW = {
  status: ["Request", "Health Check", "Response 200"],
  listar: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Params", "Query DB", "Paginacao", "Response 200"],
  consultar: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Params", "Query DB", "Response 200"],
  incluir: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Body", "Validacao", "Insert DB", "Webhook Event", "Response 201"],
  alterar: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Body", "Find Record", "Update DB", "Webhook Event", "Response 200"],
  excluir: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Record", "Soft Delete", "Webhook Event", "Response 200"],
  upsert: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Body", "Conflict Check", "Upsert DB", "Webhook Event", "Response 200"],
  upsertLote: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Array", "Batch Validate", "Upsert DB", "Response 200"],
  pagamento: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Body", "Find Titulo", "Registra Baixa", "Webhook Event", "Response 200"],
  sync: ["Request", "API Key", "Rate Limit", "Extract Records", "Transform", "Batch Upsert", "Sync Log", "Response 200"],
  exportPull: ["Request", "API Key", "Rate Limit", "Query DB", "Transform Payload", "Response 200"],
  confirm: ["Request", "API Key", "Rate Limit", "Parse IDs", "Update Status", "Response 200"],
};

// ═══════════════════════════════════════
// ENDPOINT DATA
// ═══════════════════════════════════════

const contasPagarCrud: Endpoint[] = [
  {
    method: "GET", path: "/query", description: "Consulta avançada com filtros e paginação", tag: "consulta",
    flow: FLOW.listar,
    params: [
      { name: "empresa_id", type: "number", required: false, description: "Filtro por empresa" },
      { name: "status", type: "string", required: false, description: "Filtro: pendente, vencido, pago, cancelado" },
      { name: "vencimento_de", type: "date", required: false, description: "Data vencimento inicial" },
      { name: "vencimento_ate", type: "date", required: false, description: "Data vencimento final" },
      { name: "limit", type: "number", required: false, description: "Máx registros (default: 100, máx: 500)" },
      { name: "offset", type: "number", required: false, description: "Paginação" },
    ],
    response: `{ "data": [{ "id": "uuid", "fornecedor_nome": "...", "valor_original": 1500, "status": "pendente" }], "total": 250, "offset": 0, "limit": 100 }`,
  },
  {
    method: "PUT", path: "/update", description: "Atualização individual de título",
    flow: FLOW.alterar,
    body: `{ "id": "uuid-titulo", "data_vencimento": "2026-04-15", "valor_original": 1600, "portador": "Banco Itaú" }`,
    response: `{ "success": true, "message": "Título atualizado", "updated_fields": ["data_vencimento", "valor_original", "portador"] }`,
  },
  {
    method: "POST", path: "/cancelar", description: "Cancelamento com motivo obrigatório (suporta batch)",
    flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse IDs", "Cancelar Titulos", "Webhook Event", "Response 200"],
    body: `{ "ids": ["uuid-1", "uuid-2"], "motivo": "Duplicidade de lançamento" }`,
    response: `{ "cancelados": 2, "message": "2 título(s) cancelado(s)" }`,
  },
  {
    method: "POST", path: "/registrar-pagamento", description: "Registrar pagamento/baixa via API",
    flow: FLOW.pagamento,
    body: `{ "id": "uuid-titulo", "valor_pago": 1500, "data_pagamento": "2026-03-15", "metodo_pagamento": "PIX", "portador_id": "uuid" }`,
    response: `{ "success": true, "pagamento_id": "uuid", "novo_status": "pago", "valor_aberto": 0 }`,
  },
];

const contasPagarIntegracao: Endpoint[] = [
  {
    method: "GET", path: "/consultar", description: "Consultar título por ID ou código de integração (ConsultarContaPagar)", tag: "novo",
    flow: FLOW.consultar,
    params: [
      { name: "id", type: "uuid", required: false, description: "ID interno" },
      { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" },
      { name: "codigo_lancamento_huggs", type: "integer", required: false, description: "Código numérico Huggs" },
    ],
    response: `{ "conta_pagar_cadastro": { "id": "uuid", "codigo_lancamento_integracao": "INT-001", "valor_original": 100, ... } }`,
  },
  {
    method: "POST", path: "/incluir", description: "Incluir conta a pagar (IncluirContaPagar)", tag: "novo",
    flow: FLOW.incluir,
    body: `{ "codigo_lancamento_integracao": "INT-001", "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "2.04.01", "data_previsao": "21/03/2026", "id_conta_corrente": 4243124 }`,
    response: `{ "codigo_lancamento_huggs": null, "codigo_lancamento_integracao": "INT-001", "codigo_status": "0", "descricao_status": "Cadastro incluído com sucesso!" }`,
  },
  {
    method: "PUT", path: "/alterar", description: "Alterar conta a pagar (AlterarContaPagar)", tag: "novo",
    flow: FLOW.alterar,
    body: `{ "codigo_lancamento_integracao": "INT-001", "valor_documento": 150, "data_vencimento": "30/04/2026" }`,
    response: `{ "codigo_lancamento_integracao": "INT-001", "codigo_status": "0", "descricao_status": "Cadastro alterado com sucesso!" }`,
  },
  {
    method: "DELETE", path: "/excluir", description: "Excluir (inativar) conta a pagar (ExcluirContaPagar)", tag: "novo",
    flow: FLOW.excluir,
    params: [
      { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" },
      { name: "id", type: "uuid", required: false, description: "ID interno" },
    ],
  },
  {
    method: "POST", path: "/upsert", description: "Upsert unitário por codigo_lancamento_integracao (UpsertContaPagar)", tag: "novo",
    flow: FLOW.upsert,
    body: `{ "codigo_lancamento_integracao": "INT-001", "empresa_id": 8, "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "2.04.01" }`,
  },
  {
    method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500) (UpsertContaPagarPorLote)", tag: "novo",
    flow: FLOW.upsertLote,
    body: `{ "lote": 1, "conta_pagar_cadastro": [{ "codigo_lancamento_integracao": "INT-001", "empresa_id": 8, "valor_documento": 100 }] }`,
    response: `{ "lote": 1, "codigo_status": "0", "descricao_status": "1 processado(s), 0 erro(s)" }`,
  },
  {
    method: "POST", path: "/lancar-pagamento", description: "Efetuar baixa de pagamento (LancarPagamento)", tag: "novo",
    flow: FLOW.pagamento,
    body: `{ "codigo_lancamento_integracao": "INT-001", "valor": 100.20, "desconto": 0, "juros": 0, "multa": 0, "data": "21/03/2026", "observacao": "Baixa via API" }`,
    response: `{ "codigo_lancamento_integracao": "INT-001", "codigo_baixa": "uuid", "liquidado": "S", "valor_baixado": 100.20, "codigo_status": "0", "descricao_status": "Pagamento registrado com sucesso!" }`,
  },
  {
    method: "POST", path: "/cancelar-pagamento", description: "Cancelar pagamento/baixa (CancelarPagamento)", tag: "novo",
    flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Pagamento", "Estornar", "Webhook Event", "Response 200"],
    body: `{ "codigo_baixa": "uuid-pagamento" }`,
    response: `{ "codigo_baixa": "uuid", "codigo_status": "0", "descricao_status": "Pagamento cancelado com sucesso!" }`,
  },
  {
    method: "GET", path: "/listar", description: "Listagem paginada (ListarContasPagar)", tag: "novo",
    flow: FLOW.listar,
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
  { method: "GET", path: "/parcelas", description: "Consulta parcelas de um título", flow: FLOW.consultar, params: [{ name: "conta_pagar_id", type: "uuid", required: true, description: "ID do título" }] },
  { method: "POST", path: "/parcelas/sync", description: "Sync de parcelas do ERP (máx 5000/request)", flow: FLOW.sync, body: `{ "parcelas": [{ "conta_pagar_id": "uuid", "numero": 1, "valor": 500, "data_vencimento": "2026-04-15" }] }` },
  { method: "GET", path: "/pagamentos", description: "Histórico de pagamentos de um título", flow: FLOW.consultar, params: [{ name: "conta_pagar_id", type: "uuid", required: true, description: "ID do título" }] },
  { method: "POST", path: "/estornar", description: "Estorno de pagamento com recálculo de saldo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Pagamento", "Estornar", "Recalcular Saldo", "Response 200"], body: `{ "id": "uuid-titulo", "motivo": "Pagamento indevido", "valor_estorno": 500 }` },
  { method: "GET", path: "/anexos", description: "Consultar comprovantes de um título", flow: FLOW.consultar },
  { method: "POST", path: "/anexos", description: "Registrar comprovante de pagamento", flow: FLOW.incluir },
];

const exportPull: Endpoint[] = [
  { method: "GET", path: "/pending", description: "Itens aceitos pendentes de exportação (provisão)", flow: FLOW.exportPull, response: `{ "data": [{ "id": "uuid", "export_type": "registration", "fornecedor": { "nome": "ABC Ltda" }, "pagamento": { "valor": 1500 } }], "total": 5 }` },
  { method: "GET", path: "/paid", description: "Itens pagos pendentes de exportação (baixa)", flow: FLOW.exportPull },
  { method: "GET", path: "/cancelled", description: "Títulos cancelados pendentes de exportação", flow: FLOW.exportPull },
  { method: "POST", path: "/confirm", description: "Confirmar recebimento pelo ERP", flow: FLOW.confirm, body: `{ "ids": ["uuid-1", "uuid-2"], "export_type": "registration" }`, response: `{ "confirmed": 2, "export_type": "registration" }` },
  { method: "GET", path: "/status", description: "Status global de pendências de exportação", flow: FLOW.status },
];

const exportAdvanced: Endpoint[] = [
  { method: "GET", path: "/history", description: "Histórico completo de exportações com filtros", tag: "novo", flow: FLOW.listar, params: [{ name: "export_type", type: "string", required: false, description: "registration, payment, cancellation" }, { name: "status", type: "string", required: false, description: "exported, pending, error" }, { name: "limit", type: "number", required: false, description: "Máx 500" }] },
  { method: "POST", path: "/export-batch", description: "Exportação em lote (até 200 itens)", tag: "novo", flow: ["Request", "API Key", "Rate Limit", "Parse IDs", "Enfileirar", "Response 200"], body: `{ "ids": ["uuid-1", "uuid-2"], "channel": "rest_api", "export_type": "payment" }`, response: `{ "queued": 2, "skipped": 0, "message": "2 item(ns) enfileirado(s)" }` },
  { method: "POST", path: "/retry-failed", description: "Reprocessar exportações com erro", tag: "novo", flow: ["Request", "API Key", "Rate Limit", "Find Failed", "Re-enfileirar", "Response 200"], body: `{ "ids": ["queue-uuid-1"], "channel": "rest_api" }` },
  { method: "GET", path: "/reconciliation", description: "Reconciliação BiMaster ↔ ERP", tag: "novo", flow: FLOW.consultar, params: [{ name: "empresa_id", type: "number", required: false, description: "Filtro por empresa" }], response: `{ "resumo": { "total_titulos": 500, "exportados": 480, "com_erro": 5, "taxa_sincronizacao": 96.0 } }` },
  { method: "GET", path: "/export-summary", description: "Resumo detalhado por empresa e período", tag: "novo", flow: FLOW.consultar, params: [{ name: "empresa_id", type: "number", required: false, description: "Filtro por empresa" }, { name: "periodo_de", type: "date", required: false, description: "Data inicial" }, { name: "periodo_ate", type: "date", required: false, description: "Data final" }] },
  { method: "POST", path: "/webhook-push", description: "Configurar webhook outbound push", tag: "novo", flow: ["Request", "API Key", "Rate Limit", "Parse Config", "Save Webhook", "Response 200"], body: `{ "webhook_url": "https://erp.com/webhook", "events": ["accepted", "paid", "cancelled"], "secret": "hmac-secret" }` },
];

const contasCorrentesCrud: Endpoint[] = [
  { method: "GET", path: "/", description: "Listar contas correntes (paginado)", tag: "novo", flow: FLOW.listar, params: [{ name: "pagina", type: "integer", required: false, description: "Número da página" }, { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (máx 500)" }, { name: "apenas_importado_api", type: "string", required: false, description: "Filtrar importados (S/N)" }, { name: "filtrar_apenas_ativo", type: "string", required: false, description: "Filtrar ativos (S/N)" }], response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 100, "total_de_registros": 250, "ListarContasCorrentes": [...] }` },
  { method: "GET", path: "/resumo", description: "Listagem resumida de contas correntes", tag: "novo", flow: FLOW.consultar },
  { method: "GET", path: "/consultar", description: "Consultar conta corrente por ID ou código de integração", tag: "novo", flow: FLOW.consultar, params: [{ name: "id", type: "uuid", required: false, description: "ID interno" }, { name: "cCodCCInt", type: "string", required: false, description: "Código de integração" }, { name: "nCodCC", type: "integer", required: false, description: "Código numérico Huggs" }], response: `{ "fin_conta_corrente_cadastro": { "nCodCC": 12345, "cCodCCInt": "MyCC0001", "descricao": "Conta Itaú" } }` },
  { method: "POST", path: "/incluir", description: "Incluir nova conta corrente", flow: FLOW.incluir, body: `{ "cCodCCInt": "MyCC0001", "tipo_conta_corrente": "CC", "codigo_banco": "341", "descricao": "Conta Itaú", "saldo_inicial": 10000 }`, response: `{ "cCodCCInt": "MyCC0001", "cCodStatus": "0", "cDesStatus": "Conta corrente incluída com sucesso" }` },
  { method: "PUT", path: "/alterar", description: "Alterar conta corrente existente", flow: FLOW.alterar, body: `{ "cCodCCInt": "MyCC0001", "descricao": "Conta Itaú Atualizada", "valor_limite": 75000 }`, response: `{ "cCodCCInt": "MyCC0001", "cCodStatus": "0", "cDesStatus": "Conta corrente alterada com sucesso" }` },
  { method: "DELETE", path: "/excluir", description: "Excluir (inativar) conta corrente", flow: FLOW.excluir, params: [{ name: "cCodCCInt", type: "string", required: false, description: "Código de integração" }, { name: "id", type: "uuid", required: false, description: "ID interno" }] },
  { method: "POST", path: "/upsert", description: "Upsert unitário (cria ou atualiza por cCodCCInt)", flow: FLOW.upsert, body: `{ "cCodCCInt": "MyCC0001", "tipo_conta_corrente": "CC", "codigo_banco": "341", "descricao": "Conta Itaú", "saldo_inicial": 10000 }` },
  { method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500 contas)", flow: FLOW.upsertLote, body: `{ "lote": 1, "fin_conta_corrente_cadastro": [{ "cCodCCInt": "MyCC0001", "descricao": "Caixinha", "saldo_inicial": 0 }] }`, response: `{ "lote": 1, "cCodStatus": "0", "cDesStatus": "1 processado(s), 0 erro(s)" }` },
  { method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status },
];

const lancamentosCcCrud: Endpoint[] = [
  { method: "GET", path: "/", description: "Listar lançamentos de conta corrente (paginado)", tag: "novo", flow: FLOW.listar, params: [{ name: "nPagina", type: "integer", required: false, description: "Número da página" }, { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página (máx 500)" }, { name: "nCodCC", type: "integer", required: false, description: "Código da conta corrente" }, { name: "cOrigem", type: "string", required: false, description: "Filtro: MANU, CONP, CONR, TRAN" }, { name: "dtPagInicial", type: "date", required: false, description: "Data inicial" }, { name: "dtPagFinal", type: "date", required: false, description: "Data final" }], response: `{ "nPagina": 1, "nTotPaginas": 5, "nRegistros": 20, "nTotRegistros": 95, "listaLancamentos": [...] }` },
  { method: "GET", path: "/consultar", description: "Consultar lançamento por ID ou código", tag: "novo", flow: FLOW.consultar, params: [{ name: "id", type: "uuid", required: false, description: "ID interno" }, { name: "cCodIntLanc", type: "string", required: false, description: "Código de integração" }, { name: "nCodLanc", type: "integer", required: false, description: "Código numérico Huggs" }], response: `{ "lancamento": { "nCodLanc": 12345, "cCodIntLanc": "LANC001", "cabecalho": {...}, "detalhes": {...} } }` },
  { method: "POST", path: "/incluir", description: "Incluir novo lançamento de conta corrente", flow: FLOW.incluir, body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "nCodCliente": 2485994 } }`, response: `{ "nCodLanc": null, "cCodIntLanc": "LANC001", "cCodStatus": "0", "cDesStatus": "Lançamento incluído com sucesso" }` },
  { method: "PUT", path: "/alterar", description: "Alterar lançamento existente", flow: FLOW.alterar, body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nValorLanc": 200.00 }, "detalhes": { "cObs": "Valor corrigido" } }`, response: `{ "cCodIntLanc": "LANC001", "cCodStatus": "0", "cDesStatus": "Lançamento alterado com sucesso" }` },
  { method: "DELETE", path: "/excluir", description: "Excluir (inativar) lançamento", flow: FLOW.excluir, params: [{ name: "cCodIntLanc", type: "string", required: false, description: "Código de integração" }, { name: "id", type: "uuid", required: false, description: "ID interno" }] },
  { method: "POST", path: "/upsert", description: "Upsert unitário (cria ou atualiza por cCodIntLanc)", flow: FLOW.upsert, body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN" } }` },
  { method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500 lançamentos)", flow: FLOW.upsertLote, body: `{ "lote": 1, "lancamentos": [{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": 427619317, "dDtLanc": "21/03/2026", "nValorLanc": 100 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN" } }] }`, response: `{ "lote": 1, "cCodStatus": "0", "cDesStatus": "1 processado(s), 0 erro(s)" }` },
  { method: "GET", path: "/extrato", description: "Extrato de conta corrente com saldos e movimentos (ListarExtrato)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Params", "Query Movimentos", "Calcular Saldos", "Response 200"], params: [{ name: "nCodCC", type: "integer", required: false, description: "Código Huggs da conta" }, { name: "cCodIntCC", type: "string", required: false, description: "Código de integração" }, { name: "dPeriodoInicial", type: "string", required: false, description: "Período inicial" }, { name: "dPeriodoFinal", type: "string", required: false, description: "Período final" }, { name: "cExibirApenasSaldo", type: "string", required: false, description: "S para apenas saldos" }], response: `{ "nCodCC": 427619317, "cDescricao": "Conta Bradesco", "nSaldoAnterior": 10000.00, "nSaldoAtual": 15230.50, "listaMovimentos": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status },
];

const contasReceberIntegracao: Endpoint[] = [
  { method: "GET", path: "/consultar", description: "Consultar título por ID ou código (ConsultarContaReceber)", tag: "novo", flow: FLOW.consultar, params: [{ name: "id", type: "uuid", required: false, description: "ID interno" }, { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" }, { name: "codigo_lancamento_huggs", type: "integer", required: false, description: "Código numérico Huggs" }], response: `{ "conta_receber_cadastro": { "id": "uuid", "codigo_lancamento_integracao": "CR-001", "valor_original": 100 } }` },
  { method: "POST", path: "/incluir", description: "Incluir conta a receber (IncluirContaReceber)", tag: "novo", flow: FLOW.incluir, body: `{ "codigo_lancamento_integracao": "CR-001", "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "1.01.02" }`, response: `{ "codigo_lancamento_huggs": null, "codigo_lancamento_integracao": "CR-001", "codigo_status": "0", "descricao_status": "Cadastro incluído com sucesso!" }` },
  { method: "PUT", path: "/alterar", description: "Alterar conta a receber (AlterarContaReceber)", tag: "novo", flow: FLOW.alterar, body: `{ "codigo_lancamento_integracao": "CR-001", "valor_documento": 150, "data_vencimento": "30/04/2026" }`, response: `{ "codigo_lancamento_integracao": "CR-001", "codigo_status": "0", "descricao_status": "Cadastro alterado com sucesso!" }` },
  { method: "DELETE", path: "/excluir", description: "Excluir (inativar) conta a receber (ExcluirContaReceber)", tag: "novo", flow: FLOW.excluir, params: [{ name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" }, { name: "id", type: "uuid", required: false, description: "ID interno" }] },
  { method: "POST", path: "/upsert", description: "Upsert unitário (UpsertContaReceber)", tag: "novo", flow: FLOW.upsert, body: `{ "codigo_lancamento_integracao": "CR-001", "empresa_id": 8, "codigo_cliente_fornecedor": 4214850, "data_vencimento": "21/03/2026", "valor_documento": 100 }` },
  { method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500) (UpsertContaReceberPorLote)", tag: "novo", flow: FLOW.upsertLote, body: `{ "lote": 1, "conta_receber_cadastro": [{ "codigo_lancamento_integracao": "CR-001", "empresa_id": 8, "valor_documento": 100 }] }`, response: `{ "lote": 1, "codigo_status": "0", "descricao_status": "1 processado(s), 0 erro(s)" }` },
  { method: "POST", path: "/lancar-recebimento", description: "Registrar recebimento/baixa (LancarRecebimento)", tag: "novo", flow: FLOW.pagamento, body: `{ "codigo_lancamento_integracao": "CR-001", "valor": 100.20, "desconto": 0, "juros": 0, "multa": 0, "data": "21/03/2026" }`, response: `{ "codigo_lancamento_integracao": "CR-001", "liquidado": "S", "valor_baixado": 100.20, "codigo_status": "0", "descricao_status": "Recebimento registrado com sucesso!" }` },
  { method: "POST", path: "/cancelar-recebimento", description: "Cancelar recebimento (CancelarRecebimento)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Recebimento", "Estornar", "Response 200"], body: `{ "codigo_baixa": 0 }`, response: `{ "codigo_baixa": 0, "codigo_status": "0", "descricao_status": "Recebimento cancelado com sucesso!" }` },
  { method: "POST", path: "/conciliar", description: "Conciliar recebimento (ConciliarRecebimento)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Baixa", "Marcar Conciliado", "Response 200"], body: `{ "codigo_baixa": 0 }` },
  { method: "POST", path: "/desconciliar", description: "Desconciliar recebimento (DesconciliarRecebimento)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Baixa", "Reverter Conciliacao", "Response 200"], body: `{ "codigo_baixa": 0 }` },
  { method: "POST", path: "/cancelar", description: "Cancelar título (CancelarContaReceber)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Titulo", "Cancelar", "Webhook Event", "Response 200"], body: `{ "chave_lancamento": 0 }` },
  { method: "GET", path: "/listar", description: "Listagem paginada (ListarContasReceber)", tag: "novo", flow: FLOW.listar, params: [{ name: "pagina", type: "integer", required: false, description: "Página (default: 1)" }, { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (máx 500)" }, { name: "filtrar_por_status", type: "string", required: false, description: "Filtrar por status" }, { name: "filtrar_por_data_de", type: "date", required: false, description: "Vencimento a partir de" }, { name: "filtrar_por_data_ate", type: "date", required: false, description: "Vencimento até" }], response: `{ "pagina": 1, "total_de_paginas": 5, "registros": 20, "total_de_registros": 100, "conta_receber_cadastro": [...] }` },
];

const boletosCrud: Endpoint[] = [
  { method: "POST", path: "/gerar", description: "Gerar boleto para título CR (GerarBoleto)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Titulo", "Gerar Boleto", "Response 200"], body: `{ "nCodTitulo": 0, "cCodIntTitulo": "CR-001", "nPerJuros": 2.0, "nPerMulta": 2.0 }`, response: `{ "cLinkBoleto": "https://...", "cCodStatus": "0", "cDesStatus": "Boleto gerado com sucesso!" }` },
  { method: "GET", path: "/obter", description: "Obter link e dados do boleto (ObterBoleto)", tag: "novo", flow: FLOW.consultar, params: [{ name: "nCodTitulo", type: "integer", required: false, description: "Código do título" }, { name: "cCodIntTitulo", type: "string", required: false, description: "Código de integração" }], response: `{ "cLinkBoleto": "https://...", "cCodStatus": "0", "cDesStatus": "Boleto localizado com sucesso!" }` },
  { method: "POST", path: "/cancelar", description: "Cancelar boleto gerado (CancelarBoleto)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Boleto", "Cancelar", "Response 200"], body: `{ "nCodTitulo": 0, "cCodIntTitulo": "CR-001" }`, response: `{ "cCodStatus": "0", "cDesStatus": "Boleto cancelado com sucesso!" }` },
  { method: "POST", path: "/prorrogar", description: "Prorrogar vencimento do boleto (ProrrogarBoleto)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Boleto", "Atualizar Vencimento", "Response 200"], body: `{ "nCodTitulo": 0, "cCodIntTitulo": "CR-001", "dDtVenc": "30/04/2026" }`, response: `{ "cLinkBoleto": "https://...", "cCodStatus": "0", "cDesStatus": "Boleto prorrogado com sucesso!" }` },
  { method: "GET", path: "/listar", description: "Listar boletos paginado", flow: FLOW.listar, params: [{ name: "pagina", type: "integer", required: false, description: "Página (default: 1)" }, { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página (máx 500)" }, { name: "status", type: "string", required: false, description: "Filtro: gerado, cancelado, prorrogado" }], response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 20, "total_de_registros": 50, "boletos": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status },
];

const anexosCrud: Endpoint[] = [
  { method: "POST", path: "/incluir", description: "Incluir anexo (base64 zip) vinculado a um documento (IncluirAnexo)", tag: "novo", body: `{ "cCodIntAnexo": "ANX-001", "cTabela": "contas_receber", "nId": 12345, "cNomeArquivo": "comprovante.pdf", "cTipoArquivo": "pdf", "cArquivo": "<base64>", "cMd5": "a1b2c3..." }`, response: `{ "cCodIntAnexo": "ANX-001", "cCodStatus": "0", "cDesStatus": "Anexo incluído com sucesso!" }` },
  { method: "GET", path: "/consultar", description: "Consultar metadados de um anexo (ConsultarAnexo)", tag: "novo", params: [{ name: "cCodIntAnexo", type: "string", required: false, description: "Código de integração do anexo" }, { name: "cTabela", type: "string", required: false, description: "Tabela de origem" }, { name: "nId", type: "integer", required: false, description: "ID do documento" }] },
  { method: "GET", path: "/obter", description: "Obter link de download temporário (ObterAnexo)", tag: "novo", params: [{ name: "cCodIntAnexo", type: "string", required: false, description: "Código de integração" }, { name: "cTabela", type: "string", required: false, description: "Tabela de origem" }], response: `{ "cLinkDownload": "https://...", "dDtExpiracao": "21/03/2026", "cCodStatus": "0" }` },
  { method: "GET", path: "/listar", description: "Listar anexos de um documento (ListarAnexo)", tag: "novo", params: [{ name: "nPagina", type: "integer", required: false, description: "Página" }, { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página" }, { name: "nId", type: "integer", required: true, description: "ID do documento" }, { name: "cTabela", type: "string", required: true, description: "Tabela de origem" }], response: `{ "nPagina": 1, "nTotPaginas": 1, "nRegistros": 2, "nTotRegistros": 2, "listaAnexos": [...] }` },
  { method: "DELETE", path: "/excluir", description: "Excluir anexo (ExcluirAnexo)", tag: "novo", body: `{ "cCodIntAnexo": "ANX-001", "cTabela": "contas_receber", "nId": 12345 }`, response: `{ "cCodStatus": "0", "cDesStatus": "Anexo excluído com sucesso!" }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const empresasCrud: Endpoint[] = [
  { method: "POST", path: "/consultar", description: "Consultar empresa por código (ConsultarEmpresa)", tag: "novo", body: `{ "codigo_empresa": 8 }`, response: `{ "codigo_empresa": 8, "razao_social": "Empresa ABC", "cnpj": "12.345.678/0001-90", "estado": "SP" }` },
  { method: "POST", path: "/listar", description: "Listar empresas paginadas (ListarEmpresas)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 100 }`, response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 2, "total_de_registros": 2, "empresas_cadastro": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const departamentosCrud: Endpoint[] = [
  { method: "POST", path: "/incluir", description: "Incluir novo departamento (IncluirDepartamento)", tag: "novo", body: `{ "codigo": "000000000723648", "descricao": "Marketing Digital" }`, response: `{ "codigo": "000000000723648", "cCodStatus": "0", "cDesStatus": "Departamento incluído com sucesso" }` },
  { method: "POST", path: "/alterar", description: "Alterar departamento (AlterarDepartamento)", tag: "novo", body: `{ "codigo": "000000000723648", "descricao": "Marketing Atualizado" }`, response: `{ "codigo": "000000000723648", "cCodStatus": "0", "cDesStatus": "Departamento alterado com sucesso" }` },
  { method: "POST", path: "/consultar", description: "Consultar departamento por código (ConsultarDepartamento)", tag: "novo", body: `{ "codigo": "000000000723648" }`, response: `{ "codigo": "000000000723648", "descricao": "Marketing Digital", "inativo": "N" }` },
  { method: "POST", path: "/excluir", description: "Excluir departamento (ExcluirDepartamento)", tag: "novo", body: `{ "codigo": "000000000723648" }`, response: `{ "codigo": "000000000723648", "cCodStatus": "0", "cDesStatus": "Departamento excluído com sucesso" }` },
  { method: "POST", path: "/listar", description: "Listar departamentos paginados (ListarDepartamentos)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50 }`, response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 3, "total_de_registros": 3, "departamentos": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const categoriasCrud: Endpoint[] = [
  { method: "POST", path: "/incluir", description: "Incluir nova categoria (IncluirCategoria)", tag: "novo", body: `{ "descricao": "Serviços Terceiros", "tipo_categoria": "D", "natureza": "Despesas com serviços", "codigo_dre": "3.01.01" }`, response: `{ "codigo": "CAT-xxx", "codigo_status": "0", "descricao_status": "Categoria incluída com sucesso!" }` },
  { method: "POST", path: "/incluir-grupo", description: "Incluir grupo totalizador (IncluirGrupoCategoria)", tag: "novo", body: `{ "descricao": "Despesas Operacionais", "tipo_grupo": "D" }`, response: `{ "codigo": "GRP-xxx", "codigo_status": "0", "descricao_status": "Grupo de categoria incluído com sucesso!" }` },
  { method: "POST", path: "/alterar", description: "Alterar categoria (AlterarCategoria)", tag: "novo", body: `{ "codigo": "CAT-001", "descricao": "Serviços Terceiros Atualizado" }`, response: `{ "codigo": "CAT-001", "codigo_status": "0", "descricao_status": "Categoria alterada com sucesso!" }` },
  { method: "POST", path: "/alterar-grupo", description: "Alterar grupo totalizador (AlterarGrupoCategoria)", tag: "novo", body: `{ "codigo": "GRP-001", "descricao": "Despesas Operacionais Atualizado" }`, response: `{ "codigo": "GRP-001", "codigo_status": "0", "descricao_status": "Grupo alterado com sucesso!" }` },
  { method: "POST", path: "/consultar", description: "Consultar categoria por código (ConsultarCategoria)", tag: "novo", body: `{ "codigo": "CAT-001" }`, response: `{ "categoria_cadastro": { "codigo": "CAT-001", "descricao": "Serviços Terceiros", "tipo_categoria": "D" } }` },
  { method: "POST", path: "/listar", description: "Listar categorias paginadas (ListarCategorias)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50, "filtrar_apenas_ativo": "S" }`, response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "categoria_cadastro": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const parcelasCrud: Endpoint[] = [
  { method: "POST", path: "/incluir", description: "Incluir condição de parcelamento (IncluirParcela)", tag: "novo", body: `{ "cParcela": "30/60/90" }`, response: `{ "cCodStatus": "0", "cDesStatus": "Parcela incluída com sucesso!", "cCodParcela": "001", "cDesParcela": "30/60/90" }` },
  { method: "POST", path: "/listar", description: "Listar parcelas cadastradas (ListarParcelas)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50 }`, response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 3, "total_de_registros": 3, "cadastros": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const tiposAtividadeCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Listar tipos de atividade (ListarTipoAtiv)", tag: "novo", body: `{ "filtrar_por_codigo": "", "filtrar_por_descricao": "" }`, response: `{ "lista_tipos_atividade": [{ "cCodigo": "C", "cDescricao": "Comércio" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const tiposAnexoCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Listar tipos de anexo (ListarTiposAnexos)", tag: "novo", body: `{ "codigo": "" }`, response: `{ "listaTipoAnexo": [{ "codigo": "NF", "descricao": "Nota Fiscal" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const tiposEntregaCrud: Endpoint[] = [
  { method: "POST", path: "/incluir", description: "Incluir tipo de entrega (IncluirTipoEntrega)", tag: "novo", body: `{ "nCodTransp": 0, "cCodIntEntrega": "", "cDescricao": "Entrega Normal", "cInativo": "N" }`, response: `{ "nCodEntrega": 1, "cCodStatus": "0", "cDesStatus": "Tipo de entrega incluído com sucesso" }` },
  { method: "POST", path: "/alterar", description: "Alterar tipo de entrega (AlterarTipoEntrega)", body: `{ "nCodEntrega": 1, "cDescricao": "Entrega Expressa" }`, response: `{ "nCodEntrega": 1, "cCodStatus": "0", "cDesStatus": "Tipo de entrega alterado com sucesso" }` },
  { method: "POST", path: "/consultar", description: "Consultar tipo de entrega (ConsultarTipoEntrega)", body: `{ "nCodEntrega": 1 }`, response: `{ "nCodTransp": 0, "nCodEntrega": 1, "cDescricao": "Entrega Normal", "cInativo": "N" }` },
  { method: "POST", path: "/excluir", description: "Excluir tipo de entrega (ExcluirTipoEntrega)", body: `{ "nCodEntrega": 1 }`, response: `{ "nCodEntrega": 1, "cCodStatus": "0", "cDesStatus": "Tipo de entrega excluído com sucesso" }` },
  { method: "POST", path: "/listar", description: "Listar tipos de entrega com paginação (ListarTipoEntrega)", body: `{ "nPagina": 1, "nRegistrosPorPagina": 50 }`, response: `{ "nPagina": 1, "nTotalPaginas": 1, "nRegistros": 2, "nTotalRegistros": 2, "CadTiposEntrega": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const cnaeCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Listar CNAEs com paginação (ListarCNAE)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50 }`, response: `{ "pagina": 1, "total_de_paginas": 10, "registros": 50, "total_de_registros": 500, "cadastros": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const cidadesCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Pesquisar cidades brasileiras (PesquisarCidades)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50, "filtrar_cidade_contendo": "PAULO", "filtrar_por_uf": "SP" }`, response: `{ "pagina": 1, "total_de_paginas": 112, "registros": 50, "total_de_registros": 5570, "lista_cidades": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const paisesCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Listar países cadastrados (ListarPaises)", tag: "novo", body: `{ "filtrar_por_codigo": "", "filtrar_por_descricao": "" }`, response: `{ "lista_paises": [{ "cCodigo": "1058", "cDescricao": "BRASIL", "cCodigoISO": "BR" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const bancosCrud: Endpoint[] = [
  { method: "GET", path: "/consultar", description: "Consultar banco por código COMPE (ConsultarBanco)", tag: "novo", params: [{ name: "codigo", type: "string", required: true, description: "Código COMPE do banco" }], response: `{ "codigo": "001", "nome": "Banco do Brasil S.A." }` },
  { method: "GET", path: "/listar", description: "Listar bancos cadastrados (ListarBancos)", tag: "novo", params: [{ name: "pagina", type: "integer", required: false, description: "Página" }, { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página" }], response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 50, "total_de_registros": 50, "fin_banco_cadastro": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const tiposDocumentoCrud: Endpoint[] = [
  { method: "GET", path: "/consultar", description: "Consultar tipo de documento por código (ConsultarTipoDocumento)", tag: "novo", params: [{ name: "codigo", type: "string", required: true, description: "Código do tipo" }], response: `{ "codigo": "NF", "descricao": "Nota Fiscal" }` },
  { method: "POST", path: "/pesquisar", description: "Pesquisar tipos de documento (PesquisarTipoDocumento)", tag: "novo", body: `{ "codigo": "" }`, response: `{ "tipo_documento_cadastro": [{ "codigo": "NF", "descricao": "Nota Fiscal" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const dreCadastroCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Listar contas do DRE (ListarCadastroDRE)", tag: "novo", body: `{ "apenasContasAtivas": "N" }`, response: `{ "totalRegistros": 25, "dreLista": [{ "codigoDRE": "4.1", "descricaoDRE": "Receita Bruta" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const finalidadesTransfCrud: Endpoint[] = [
  { method: "GET", path: "/consultar", description: "Consultar finalidade por código (ConsultarFinalTransf)", tag: "novo", params: [{ name: "codigo", type: "string", required: true, description: "Código da finalidade" }], response: `{ "codigo": "01", "descricao": "Crédito em Conta" }` },
  { method: "GET", path: "/listar", description: "Listar finalidades paginadas (ListarFinalTransf)", tag: "novo", params: [{ name: "pagina", type: "integer", required: false, description: "Página" }, { name: "registros_por_pagina", type: "integer", required: false, description: "Registros por página" }], response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 8, "total_de_registros": 8, "cadastros": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const origensCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Listar origens de lançamento (ListarOrigem)", tag: "novo", body: `{ "codigo": "" }`, response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 6, "total_de_registros": 6, "origem": [{ "codigo": "MANUAL", "descricao": "Lançamento Manual" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const bandeirasCrud: Endpoint[] = [
  { method: "GET", path: "/listar", description: "Listar bandeiras de cartão (ListarBandeiras)", tag: "novo", params: [{ name: "nPagina", type: "integer", required: false, description: "Página" }, { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página" }], response: `{ "nPagina": 1, "nTotPaginas": 1, "nRegistros": 8, "nTotRegistros": 8, "listaBandeira": [{ "cCodigo": "VISA", "cDescricao": "Visa" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const clientesCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Lista paginada de clientes (ListarClientes)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50, "clientesFiltro": { "razao_social": "" } }`, response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "clientes_cadastro": [...] }` },
  { method: "POST", path: "/listar-resumido", description: "Lista resumida (ListarClientesResumido)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50 }`, response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "clientes_cadastro_resumido": [...] }` },
  { method: "POST", path: "/consultar", description: "Consultar cliente (ConsultarCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001" }`, response: `{ "clientes_cadastro": { "codigo_cliente_huggs": "uuid", "razao_social": "ABC Ltda" } }` },
  { method: "POST", path: "/incluir", description: "Incluir novo cliente (IncluirCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "razao_social": "Empresa ABC Ltda", "cnpj_cpf": "12.345.678/0001-90" }`, response: `{ "codigo_cliente_huggs": "uuid", "codigo_status": "0", "descricao_status": "Cliente incluído com sucesso!" }` },
  { method: "POST", path: "/alterar", description: "Alterar dados do cliente (AlterarCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "nome_fantasia": "ABC Atualizado" }`, response: `{ "codigo_status": "0", "descricao_status": "Cliente alterado com sucesso!" }` },
  { method: "POST", path: "/excluir", description: "Excluir (inativar) cliente (ExcluirCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001" }`, response: `{ "codigo_status": "0", "descricao_status": "Cliente excluído com sucesso!" }` },
  { method: "POST", path: "/upsert", description: "Upsert por código de integração (UpsertCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "razao_social": "ABC Ltda" }` },
  { method: "POST", path: "/upsert-cpfcnpj", description: "Upsert por CPF/CNPJ (UpsertClienteCpfCnpj)", tag: "novo", body: `{ "cnpj_cpf": "12.345.678/0001-90", "razao_social": "ABC Ltda" }` },
  { method: "POST", path: "/associar", description: "Associar código de integração (AssociarCodIntCliente)", tag: "novo", body: `{ "codigo_cliente_huggs": "uuid", "codigo_cliente_integracao": "CLI001" }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const clientesCaractCrud: Endpoint[] = [
  { method: "POST", path: "/caract/incluir", description: "Incluir característica (IncluirCaractCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "campo": "SEGMENTO", "conteudo": "Varejo" }`, response: `{ "codigo_status": "0", "descricao_status": "Característica incluída com sucesso!" }` },
  { method: "POST", path: "/caract/alterar", description: "Alterar característica (AlterarCaractCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "campo": "SEGMENTO", "conteudo": "Atacado" }` },
  { method: "POST", path: "/caract/consultar", description: "Consultar características (ConsultarCaractCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001" }`, response: `{ "caracteristicas": [{ "campo": "SEGMENTO", "conteudo": "Varejo" }] }` },
  { method: "POST", path: "/caract/excluir", description: "Excluir uma característica (ExcluirCaractCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "campo": "SEGMENTO" }` },
  { method: "POST", path: "/caract/excluir-todas", description: "Excluir todas as características (ExcluirTodasCaractCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001" }` },
];

const clientesTagsCrud: Endpoint[] = [
  { method: "POST", path: "/tags/incluir", description: "Associar tags ao cliente (IncluirTags)", tag: "novo", body: `{ "cCodIntCliente": "CLI001", "tags": [{ "tag": "Grupo A" }] }`, response: `{ "cCodStatus": "0", "cDesStatus": "Tags incluídas com sucesso!" }` },
  { method: "POST", path: "/tags/listar", description: "Listar tags do cliente (ListarTags)", tag: "novo", body: `{ "cCodIntCliente": "CLI001" }`, response: `{ "tagsLista": [{ "tag": "Grupo A", "nCodTag": 1 }] }` },
  { method: "POST", path: "/tags/excluir", description: "Remover tags específicas (ExcluirTags)", tag: "novo", body: `{ "cCodIntCliente": "CLI001", "tags": [{ "tag": "Grupo A" }] }` },
  { method: "POST", path: "/tags/excluir-todas", description: "Remover todas as tags (ExcluirTodas)", tag: "novo", body: `{ "cCodIntCliente": "CLI001" }` },
];

const projetosCrud: Endpoint[] = [
  { method: "POST", path: "/incluir", description: "Incluir projeto (IncluirProjeto)", tag: "novo", body: `{ "codInt": "PROJ-001", "nome": "Projeto Alpha" }`, response: `{ "codigo": "uuid", "codInt": "PROJ-001", "status": "0", "descricao": "Projeto incluído com sucesso!" }` },
  { method: "POST", path: "/alterar", description: "Alterar projeto (AlterarProjeto)", tag: "novo", body: `{ "codInt": "PROJ-001", "nome": "Projeto Alpha Atualizado" }`, response: `{ "status": "0", "descricao": "Projeto alterado com sucesso!" }` },
  { method: "POST", path: "/consultar", description: "Consultar projeto (ConsultarProjeto)", tag: "novo", body: `{ "codInt": "PROJ-001" }`, response: `{ "codigo": "uuid", "codInt": "PROJ-001", "nome": "Projeto Alpha", "inativo": "N" }` },
  { method: "POST", path: "/excluir", description: "Excluir projeto (ExcluirProjeto)", tag: "novo", body: `{ "codInt": "PROJ-001" }`, response: `{ "status": "0", "descricao": "Projeto excluído com sucesso!" }` },
  { method: "POST", path: "/listar", description: "Listar projetos paginado (ListarProjetos)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50 }`, response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 5, "total_de_registros": 5, "cadastro": [...] }` },
  { method: "POST", path: "/upsert", description: "Upsert por codInt (UpsertProjeto)", tag: "novo", body: `{ "codInt": "PROJ-001", "nome": "Projeto Alpha" }`, response: `{ "status": "0", "descricao": "Projeto incluído/alterado com sucesso!" }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const orcamentosCaixaCrud: Endpoint[] = [
  { method: "GET", path: "/listar", description: "Listar orçamento previsto x realizado (ListarOrcamentos)", tag: "novo", params: [{ name: "nAno", type: "integer", required: true, description: "Ano do orçamento" }, { name: "nMes", type: "integer", required: true, description: "Mês (1-12)" }], response: `{ "nAno": 2026, "nMes": 3, "ListaOrcamentos": [{ "cCodCateg": "2.04.01", "nValorPrevisto": 5000.00, "nValorRealizado": 3200.50 }] }` },
  { method: "POST", path: "/incluir", description: "Cadastrar/atualizar orçamento previsto", body: `{ "nAno": 2026, "nMes": 3, "cCodCateg": "2.04.01", "nValorPrevisto": 5000.00 }`, response: `{ "cCodStatus": "0", "cDesStatus": "Orçamento cadastrado com sucesso" }` },
  { method: "POST", path: "/incluir-lote", description: "Upsert em lote de orçamentos (máx 500)", body: `{ "nAno": 2026, "nMes": 3, "orcamentos": [{ "cCodCateg": "2.04.01", "nValorPrevisto": 5000.00 }] }`, response: `{ "cCodStatus": "0", "nTotal": 2 }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const pesquisarLancamentosCrud: Endpoint[] = [
  { method: "POST", path: "/pesquisar", description: "Pesquisa avançada unificada de títulos (PesquisarLancamentos)", tag: "novo", body: `{ "nPagina": 1, "nRegPorPagina": 20, "cNatureza": "R", "cStatus": "pendente", "dDtVencDe": "01/01/2026", "dDtVencAte": "31/03/2026" }`, response: `{ "nPagina": 1, "nTotPaginas": 5, "nRegistros": 20, "nTotRegistros": 100, "titulosEncontrados": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const movimentosFinanceirosCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Listagem unificada de movimentos financeiros (ListarMovimentos)", tag: "novo", body: `{ "nPagina": 1, "nRegPorPagina": 20, "cTpLancamento": "CP" }`, response: `{ "nPagina": 1, "nTotPaginas": 5, "nRegistros": 20, "nTotRegistros": 100, "movimentos": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const resumoFinanceiroCrud: Endpoint[] = [
  { method: "POST", path: "/resumo", description: "Resumo consolidado: saldos, totais, fluxo de caixa (ObterResumoFinancas)", tag: "novo", body: `{ "dDia": "21/03/2026", "lApenasResumo": false }`, response: `{ "dDia": "21/03/2026", "contaCorrente": { "vTotal": 150000 }, "contaPagar": { "nTotal": 45, "vTotal": 85000 }, "contaReceber": { "nTotal": 30, "vTotal": 120000 } }` },
  { method: "POST", path: "/em-aberto", description: "Lista paginada de títulos em aberto (ObterListaEmAberto)", tag: "novo", body: `{ "dDia": "21/03/2026", "cTipo": "P", "nPagina": 1 }`, response: `{ "ListaEmEberto": [...], "nRegistros": 50, "nTotPaginas": 3 }` },
  { method: "POST", path: "/lista-financas", description: "Lista por data/categoria/tipo (ObterListaFinancas)", tag: "novo", body: `{ "dDia": "21/03/2026", "cCodCateg": "1.01.01", "cTipo": "R" }`, response: `{ "listaDetalhesFinancas": [...] }` },
  { method: "POST", path: "/detalhes", description: "Detalhes de um título (ObterDetalhesLancamento)", tag: "novo", body: `{ "nIdTitulo": "uuid-do-titulo" }`, response: `{ "cTipoLanc": "R", "nIdTitulo": "uuid", "cNomeCliente": "ABC", "vDoc": 1500 }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const webhookInbound: Endpoint[] = [
  { method: "POST", path: "/", description: "Receber callbacks do ERP", body: `{ "event": "provisao_registrada", "titulo_id": "uuid", "erp_response_code": "OK-001" }`, response: `{ "sucesso": true, "mensagem": "Evento processado" }` },
];

// ═══════════════════════════════════════
// NEW APIs — Fornecedores, Plano de Contas, Portadores, Webhooks
// ═══════════════════════════════════════

const fornecedoresQueryCrud: Endpoint[] = [
  { method: "GET", path: "/", description: "Listar fornecedores ativos (com filtro por CNPJ)", tag: "novo", flow: FLOW.listar, params: [{ name: "cnpj", type: "string", required: false, description: "Filtro por CNPJ (parcial ou completo, com ou sem máscara)" }], response: `{ "fornecedores": [{ "id": "uuid", "cnpj": "12345678000190", "razao_social": "ABC Ltda", "nome_fantasia": "ABC", "erp_code": "4214850", "email": "contato@abc.com", "telefone": "11999998888", "status": "ativo", "ativo": true }], "total": 1 }` },
];

const fornecedoresSyncCrud: Endpoint[] = [
  { method: "POST", path: "/consultar", description: "Consultar fornecedor no ERP por CNPJ", tag: "novo", flow: FLOW.consultar, body: `{ "cnpj": "12.345.678/0001-90" }`, response: `{ "encontrado": true, "fornecedor": { "erp_code": "4214850", "razao_social": "ABC Ltda" } }` },
  { method: "POST", path: "/cadastrar", description: "Cadastrar fornecedor no ERP e salvar código retornado", tag: "novo", flow: FLOW.incluir, body: `{ "cnpj": "12.345.678/0001-90", "razao_social": "Novo Fornecedor", "nome_fantasia": "Novo", "email": "contato@novo.com" }`, response: `{ "success": true, "erp_code": "4214851", "message": "Fornecedor cadastrado no ERP" }` },
  { method: "POST", path: "/sync-bidirecional", description: "Sincronização bidirecional completa (BiMaster ↔ ERP)", tag: "novo", flow: FLOW.sync, body: `{ "empresa_id": 8, "modo": "full" }`, response: `{ "sincronizados": 45, "novos_no_erp": 3, "novos_no_bimaster": 2, "erros": 0 }` },
  { method: "POST", path: "/cadastrar-todas", description: "Cadastrar fornecedor em todas as empresas autorizadas", tag: "novo", flow: ["Request", "Auth (JWT)", "Rate Limit", "Parse Body", "Loop Empresas", "Cadastrar ERP", "Sync Log", "Response 200"], body: `{ "cnpj": "12.345.678/0001-90", "razao_social": "Fornecedor Multi" }`, response: `{ "empresas_cadastradas": 3, "erros": [] }` },
];

const planoContasCrud: Endpoint[] = [
  { method: "GET", path: "/", description: "Listar plano de contas ativo (chart of accounts)", tag: "novo", flow: FLOW.listar, response: `{ "plano_contas": [{ "id": "uuid", "codigo": "2.04.01", "nome": "Serviços Terceiros", "erp_code": "ERP001", "tipo": "D", "ativo": true }], "total": 25 }` },
];

const portadoresCrud: Endpoint[] = [
  { method: "GET", path: "/", description: "Listar portadores/contas bancárias ativos por empresa", tag: "novo", flow: FLOW.listar, response: `{ "data": [{ "id": "uuid", "nome": "Banco Itaú", "banco_codigo": "341", "banco_nome": "Itaú Unibanco", "agencia": "1234", "conta": "56789-0", "tipo": "corrente", "codigo_erp": "PORT001" }], "total": 5 }` },
  { method: "POST", path: "/sync", description: "Upsert em massa de portadores (máx 5000/request)", tag: "novo", flow: FLOW.sync, body: `{ "portadores": [{ "codigo_erp": "PORT001", "nome": "Banco Itaú", "banco_codigo": "341", "banco_nome": "Itaú Unibanco", "agencia": "1234", "conta": "56789-0", "tipo": "corrente" }] }`, response: `{ "success": true, "upserted": 5 }` },
];

const webhookSubscriptionsCrud: Endpoint[] = [
  { method: "GET", path: "/eventos", description: "Listar todos os eventos disponíveis para inscrição", tag: "novo", flow: FLOW.status, response: `{ "eventos": [{ "evento": "conta_pagar.criado", "descricao": "Novo título a pagar criado" }, { "evento": "conta_pagar.pago", "descricao": "Pagamento registrado" }] }` },
  { method: "GET", path: "/listar", description: "Listar assinaturas de webhook ativas", tag: "novo", flow: FLOW.listar, response: `{ "subscriptions": [{ "id": "uuid", "url": "https://erp.com/webhook", "eventos": ["conta_pagar.criado"], "ativo": true }], "total": 3 }` },
  { method: "GET", path: "/consultar", description: "Consultar assinatura por ID", tag: "novo", flow: FLOW.consultar, params: [{ name: "id", type: "uuid", required: true, description: "ID da assinatura" }], response: `{ "subscription": { "id": "uuid", "url": "https://erp.com/webhook", "eventos": ["conta_pagar.criado"], "secret": "hmac-***", "ativo": true } }` },
  { method: "POST", path: "/incluir", description: "Criar nova assinatura de webhook", tag: "novo", flow: FLOW.incluir, body: `{ "url": "https://erp.com/webhook", "eventos": ["conta_pagar.criado", "conta_pagar.pago"], "secret": "meu-segredo-hmac", "headers_customizados": { "X-ERP-Token": "abc123" } }`, response: `{ "id": "uuid", "message": "Assinatura criada com sucesso" }` },
  { method: "PUT", path: "/alterar", description: "Atualizar assinatura existente", tag: "novo", flow: FLOW.alterar, body: `{ "id": "uuid", "url": "https://erp.com/webhook-v2", "eventos": ["conta_pagar.criado", "conta_pagar.pago", "conta_pagar.cancelado"] }`, response: `{ "message": "Assinatura atualizada" }` },
  { method: "DELETE", path: "/excluir", description: "Remover assinatura de webhook", tag: "novo", flow: FLOW.excluir, params: [{ name: "id", type: "uuid", required: true, description: "ID da assinatura" }], response: `{ "message": "Assinatura removida" }` },
  { method: "POST", path: "/testar", description: "Enviar evento de teste para a URL da assinatura", tag: "novo", flow: ["Request", "Auth", "Rate Limit", "Build Test Payload", "Sign HMAC", "POST to URL", "Response 200"], body: `{ "id": "uuid" }`, response: `{ "success": true, "http_status": 200, "duration_ms": 150 }` },
  { method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status },
];

const webhookDispatcherCrud: Endpoint[] = [
  { method: "POST", path: "/process", description: "Processar fila de eventos pendentes (máx 50/execução)", tag: "novo", flow: ["Request", "Auth", "Rate Limit", "Query Pending", "Sign HMAC", "POST to Subscribers", "Update Queue", "Log Delivery", "Response 200"], response: `{ "processed": 10, "sent": 8, "failed": 2 }` },
  { method: "POST", path: "/retry-dead", description: "Reprocessar eventos mortos (dead letter)", tag: "novo", flow: ["Request", "Auth", "Rate Limit", "Find Dead Events", "Reset Status", "Response 200"], response: `{ "requeued": 5 }` },
  { method: "GET", path: "/stats", description: "Estatísticas da fila de webhooks", tag: "novo", flow: FLOW.status, response: `{ "subscriptions_ativas": 3, "fila": { "pending": 12, "failed": 2, "sent": 450, "dead": 1 } }` },
  { method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status },
];

// ═══════════════════════════════════════
// MODULE DEFINITIONS
// ═══════════════════════════════════════

const API_MODULES: ApiModule[] = [
  {
    id: "geral",
    name: "Geral",
    description: "Cadastros principais do sistema",
    icon: <Building2 className="h-5 w-5" />,
    color: "from-blue-600 to-blue-500",
    apis: [
      { id: "clientes", name: "Clientes", description: "CRUD completo de clientes/fornecedores", basePath: "/clientes-api", icon: <Database className="h-4 w-4 text-blue-500" />, sections: [{ title: "CRUD Principal", endpoints: clientesCrud }, { title: "Características", endpoints: clientesCaractCrud }, { title: "Tags", endpoints: clientesTagsCrud }] },
      { id: "fornecedores-query", name: "Fornecedores (Consulta)", description: "Consulta de fornecedores ativos por CNPJ", basePath: "/erp-fornecedores-query", icon: <Database className="h-4 w-4 text-blue-500" />, sections: [{ title: "Consulta", endpoints: fornecedoresQueryCrud }] },
      { id: "fornecedores-sync", name: "Fornecedores (Sync)", description: "Sincronização bidirecional de fornecedores com ERP", basePath: "/erp-fornecedores-sync", icon: <RefreshCw className="h-4 w-4 text-blue-500" />, sections: [{ title: "Sync Bidirecional", endpoints: fornecedoresSyncCrud }] },
      { id: "empresas", name: "Empresas", description: "Consultar e listar empresas", basePath: "/empresas-api", icon: <Building2 className="h-4 w-4 text-blue-500" />, sections: [{ title: "Consulta & Listagem", endpoints: empresasCrud }] },
      { id: "departamentos", name: "Departamentos", description: "CRUD completo de departamentos", basePath: "/departamentos-api", icon: <Layers className="h-4 w-4 text-blue-500" />, sections: [{ title: "CRUD", endpoints: departamentosCrud }] },
      { id: "categorias", name: "Categorias", description: "Categorias e grupos totalizadores", basePath: "/categorias-api", icon: <Database className="h-4 w-4 text-blue-500" />, sections: [{ title: "CRUD", endpoints: categoriasCrud }] },
      { id: "projetos", name: "Projetos", description: "CRUD completo de projetos", basePath: "/projetos-api", icon: <FileText className="h-4 w-4 text-blue-500" />, sections: [{ title: "CRUD", endpoints: projetosCrud }] },
      { id: "parcelas", name: "Parcelas", description: "Condições de parcelamento", basePath: "/parcelas-api", icon: <FileText className="h-4 w-4 text-blue-500" />, sections: [{ title: "CRUD", endpoints: parcelasCrud }] },
    ],
  },
  {
    id: "cadastros",
    name: "Cadastros Auxiliares",
    description: "Tabelas de apoio e dados de referência",
    icon: <Package className="h-5 w-5" />,
    color: "from-emerald-600 to-emerald-500",
    apis: [
      { id: "plano-contas", name: "Plano de Contas", description: "Chart of Accounts para classificação contábil", basePath: "/erp-plano-contas-api", icon: <BarChart3 className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: planoContasCrud }] },
      { id: "portadores", name: "Portadores", description: "Contas bancárias/portadores para pagamento", basePath: "/erp-portadores-api", icon: <DollarSign className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta & Sync", endpoints: portadoresCrud }] },
      { id: "tipos-atividade", name: "Tipos de Atividade", description: "Listagem de tipos", basePath: "/tipos-atividade-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: tiposAtividadeCrud }] },
      { id: "tipos-anexo", name: "Tipos de Anexo", description: "Tipos de documentos anexos", basePath: "/tipos-anexo-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: tiposAnexoCrud }] },
      { id: "tipos-entrega", name: "Tipos de Entrega", description: "CRUD de tipos de entrega", basePath: "/tipos-entrega-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "CRUD", endpoints: tiposEntregaCrud }] },
      { id: "tipos-documento", name: "Tipos de Documento", description: "Consulta e pesquisa", basePath: "/tipos-documento-api", icon: <FileText className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta", endpoints: tiposDocumentoCrud }] },
      { id: "cnae", name: "CNAE", description: "Classificação Nacional de Atividades", basePath: "/cnae-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: cnaeCrud }] },
      { id: "cidades", name: "Cidades", description: "Pesquisa de cidades brasileiras (IBGE)", basePath: "/cidades-api", icon: <Search className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Pesquisa", endpoints: cidadesCrud }] },
      { id: "paises", name: "Países", description: "Listagem de países", basePath: "/paises-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: paisesCrud }] },
      { id: "bancos", name: "Bancos", description: "Instituições financeiras", basePath: "/bancos-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta & Listagem", endpoints: bancosCrud }] },
      { id: "bandeiras", name: "Bandeiras de Cartão", description: "Bandeiras de crédito/débito", basePath: "/bandeiras-api", icon: <FileText className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: bandeirasCrud }] },
      { id: "origens", name: "Origens de Lançamento", description: "Tipos de origem de lançamento", basePath: "/origens-api", icon: <FileText className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: origensCrud }] },
      { id: "finalidades", name: "Finalidades de Transferência", description: "Finalidades bancárias", basePath: "/finalidades-transferencia-api", icon: <RefreshCw className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta & Listagem", endpoints: finalidadesTransfCrud }] },
      { id: "dre", name: "DRE", description: "Demonstrativo de Resultados", basePath: "/dre-cadastro-api", icon: <BarChart3 className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: dreCadastroCrud }] },
    ],
  },
  {
    id: "financas",
    name: "Finanças",
    description: "Gestão financeira completa: contas, boletos, extratos e análises",
    icon: <DollarSign className="h-5 w-5" />,
    color: "from-amber-600 to-amber-500",
    apis: [
      { id: "contas-pagar", name: "Contas a Pagar", description: "CRUD, integração, parcelas e pagamentos", basePath: "/contas-pagar-api", icon: <ArrowDownToLine className="h-4 w-4 text-amber-500" />, sections: [{ title: "Consulta & Gestão", endpoints: contasPagarCrud }, { title: "Integração CRUD", endpoints: contasPagarIntegracao, description: "Consultar, incluir, alterar, excluir, upsert, pagamentos" }, { title: "Parcelas, Pagamentos & Anexos", endpoints: contasPagarComplementar }] },
      { id: "contas-receber", name: "Contas a Receber", description: "CRUD, integração, recebimentos e conciliação", basePath: "/contas-receber-api", icon: <ArrowUpFromLine className="h-4 w-4 text-amber-500" />, sections: [{ title: "Integração CRUD", endpoints: contasReceberIntegracao, description: "Consultar, incluir, alterar, excluir, upsert, recebimentos" }] },
      { id: "boletos", name: "Boletos", description: "Cobrança bancária", basePath: "/boletos-api", icon: <FileText className="h-4 w-4 text-amber-500" />, sections: [{ title: "Gestão de Boletos", endpoints: boletosCrud }] },
      { id: "contas-correntes", name: "Contas Correntes", description: "Gestão de contas bancárias", basePath: "/contas-correntes-api", icon: <RefreshCw className="h-4 w-4 text-amber-500" />, sections: [{ title: "CRUD & Sync", endpoints: contasCorrentesCrud }] },
      { id: "lancamentos-cc", name: "Lançamentos CC", description: "Lançamentos e extrato de conta corrente", basePath: "/lancamentos-cc-api", icon: <ArrowDownToLine className="h-4 w-4 text-amber-500" />, sections: [{ title: "CRUD, Extrato & Sync", endpoints: lancamentosCcCrud }] },
      { id: "exportacao", name: "Exportação ERP", description: "Pull, batch, reconciliação e webhook push", basePath: "/contas-pagar-export-api", icon: <ArrowUpFromLine className="h-4 w-4 text-amber-500" />, sections: [{ title: "Pull (ERP consulta)", endpoints: exportPull }, { title: "Avançado (Lote & Reconciliação)", endpoints: exportAdvanced }] },
      { id: "orcamentos", name: "Orçamentos de Caixa", description: "Previsto x Realizado", basePath: "/orcamentos-caixa-api", icon: <BarChart3 className="h-4 w-4 text-amber-500" />, sections: [{ title: "Gestão de Orçamentos", endpoints: orcamentosCaixaCrud }] },
      { id: "pesquisar", name: "Pesquisar Lançamentos", description: "Pesquisa avançada unificada", basePath: "/pesquisar-lancamentos-api", icon: <Search className="h-4 w-4 text-amber-500" />, sections: [{ title: "Pesquisa", endpoints: pesquisarLancamentosCrud }] },
      { id: "movimentos", name: "Movimentos Financeiros", description: "Movimentação consolidada", basePath: "/movimentos-financeiros-api", icon: <RefreshCw className="h-4 w-4 text-amber-500" />, sections: [{ title: "Listagem", endpoints: movimentosFinanceirosCrud }] },
      { id: "resumo-fin", name: "Resumo Financeiro", description: "Dashboard financeiro via API", basePath: "/resumo-financeiro-api", icon: <BarChart3 className="h-4 w-4 text-amber-500" />, sections: [{ title: "Resumo & Detalhes", endpoints: resumoFinanceiroCrud }] },
    ],
  },
  {
    id: "complementar",
    name: "Dados Complementares",
    description: "Anexos, webhooks e integrações auxiliares",
    icon: <Webhook className="h-5 w-5" />,
    color: "from-purple-600 to-purple-500",
    apis: [
      { id: "anexos", name: "Anexos", description: "Gestão de documentos anexos", basePath: "/anexos-api", icon: <FileText className="h-4 w-4 text-purple-500" />, sections: [{ title: "CRUD de Anexos", endpoints: anexosCrud }] },
      { id: "webhook-inbound", name: "Webhook Inbound", description: "Callbacks do ERP para o BiMaster", basePath: "/erp-webhook-inbound", icon: <Webhook className="h-4 w-4 text-purple-500" />, sections: [{ title: "Inbound", endpoints: webhookInbound }] },
      { id: "webhook-subscriptions", name: "Webhook Subscriptions", description: "CRUD de assinaturas para webhooks outbound", basePath: "/webhook-subscriptions-api", icon: <Webhook className="h-4 w-4 text-purple-500" />, sections: [{ title: "Gestão de Assinaturas", endpoints: webhookSubscriptionsCrud }] },
      { id: "webhook-dispatcher", name: "Webhook Dispatcher", description: "Processamento e monitoramento da fila de webhooks", basePath: "/webhook-dispatcher", icon: <RefreshCw className="h-4 w-4 text-purple-500" />, sections: [{ title: "Processamento & Monitoramento", endpoints: webhookDispatcherCrud }] },
    ],
  },
];

// ═══════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════

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
      <pre className="bg-muted/70 border rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{code}</pre>
      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleCopy}>
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function EndpointCard({ endpoint, basePath }: { endpoint: Endpoint; basePath: string }) {
  const [open, setOpen] = useState(false);
  const fullUrl = `${BASE_URL}${basePath}${endpoint.path}`;
  const hasDetails = endpoint.params || endpoint.body || endpoint.response || endpoint.flow;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors group">
          {hasDetails ? (
            open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : <div className="w-3.5" />}
          <Badge variant="outline" className={`${METHOD_COLORS[endpoint.method]} text-[10px] font-bold px-2 py-0 min-w-[42px] justify-center`}>{endpoint.method}</Badge>
          <code className="text-xs font-mono text-foreground">{endpoint.path}</code>
          <span className="text-xs text-muted-foreground truncate flex-1">{endpoint.description}</span>
          {endpoint.tag === "novo" && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">NOVO</Badge>}
        </div>
      </CollapsibleTrigger>
      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-10 mr-3 mb-3 space-y-3 border-l-2 border-muted pl-4">
            {/* Flow diagram */}
            {endpoint.flow && endpoint.flow.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fluxo</span>
                <div className="flex items-center flex-wrap gap-1 py-2 px-3 bg-muted/40 rounded-lg">
                  {endpoint.flow.map((step, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
                        {step}
                      </span>
                      {i < endpoint.flow!.length - 1 && (
                        <span className="text-muted-foreground text-xs">→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
            <EndpointSupportChat apiId={basePath.replace(/^\//, "")} endpointPath={`${endpoint.method} ${endpoint.path}`} />
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ApiSectionBlock({ title, endpoints, basePath, description }: { title: string; endpoints: Endpoint[]; basePath: string; description?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="text-[10px]">{endpoints.length}</Badge>
            </div>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
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

// ═══════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════

function buildExcelData(modules: ApiModule[]): SheetData[] {
  const endpointsData: Record<string, unknown>[] = [];
  const paramsData: Record<string, unknown>[] = [];

  for (const mod of modules) {
    for (const api of mod.apis) {
      for (const section of api.sections) {
        for (const ep of section.endpoints) {
          const fullUrl = `${BASE_URL}${api.basePath}${ep.path}`;
          endpointsData.push({
            Módulo: mod.name,
            API: api.name,
            Seção: section.title,
            Método: ep.method,
            Path: ep.path,
            "URL Completa": fullUrl,
            Descrição: ep.description,
            "Body (JSON)": ep.body || "",
            "Response (JSON)": ep.response || "",
          });

          if (ep.params) {
            for (const p of ep.params) {
              paramsData.push({
                Módulo: mod.name,
                API: api.name,
                Endpoint: `${ep.method} ${ep.path}`,
                Parâmetro: p.name,
                Tipo: p.type,
                Obrigatório: p.required ? "Sim" : "Não",
                Descrição: p.description,
              });
            }
          }
        }
      }
    }
  }

  const authData: Record<string, unknown>[] = [
    { Informação: "Método Recomendado", Valor: "API Key via header x-api-key" },
    { Informação: "Formato da Chave", Valor: "huggs-erp-xxxxxxxxxxxxxxxx" },
    { Informação: "Exemplo cURL", Valor: `curl -H "x-api-key: SUA_CHAVE" ${BASE_URL}/contas-pagar-api/listar` },
    { Informação: "Rate Limit", Valor: "60 requisições/minuto por IP ou API key" },
    { Informação: "Método Alternativo", Valor: "Bearer Token (JWT) via header Authorization" },
    { Informação: "Erro 401", Valor: "API key inválida ou ausente" },
    { Informação: "Erro 429", Valor: "Rate limit excedido — Retry-After: 60" },
    { Informação: "Erro 400", Valor: "Parâmetros inválidos" },
    { Informação: "Erro 404", Valor: "Rota não encontrada" },
    { Informação: "Erro 500", Valor: "Erro interno do servidor" },
  ];

  return [
    {
      name: "Endpoints",
      data: endpointsData,
      columns: [
        { header: "Módulo", key: "Módulo", width: 18 },
        { header: "API", key: "API", width: 22 },
        { header: "Seção", key: "Seção", width: 25 },
        { header: "Método", key: "Método", width: 8 },
        { header: "Path", key: "Path", width: 25 },
        { header: "URL Completa", key: "URL Completa", width: 65 },
        { header: "Descrição", key: "Descrição", width: 50 },
        { header: "Body (JSON)", key: "Body (JSON)", width: 60 },
        { header: "Response (JSON)", key: "Response (JSON)", width: 60 },
      ],
    },
    {
      name: "Parâmetros",
      data: paramsData,
      columns: [
        { header: "Módulo", key: "Módulo", width: 18 },
        { header: "API", key: "API", width: 22 },
        { header: "Endpoint", key: "Endpoint", width: 30 },
        { header: "Parâmetro", key: "Parâmetro", width: 25 },
        { header: "Tipo", key: "Tipo", width: 12 },
        { header: "Obrigatório", key: "Obrigatório", width: 12 },
        { header: "Descrição", key: "Descrição", width: 50 },
      ],
    },
    {
      name: "Autenticação",
      data: authData,
      columns: [
        { header: "Informação", key: "Informação", width: 25 },
        { header: "Valor", key: "Valor", width: 80 },
      ],
    },
  ];
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════

export default function ApiDocumentation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedApi, setExpandedApi] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const totalEndpoints = useMemo(() => {
    let count = 0;
    for (const mod of API_MODULES) {
      for (const api of mod.apis) {
        for (const s of api.sections) count += s.endpoints.length;
      }
    }
    return count;
  }, []);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return API_MODULES;
    const q = searchQuery.toLowerCase();
    return API_MODULES.map(mod => ({
      ...mod,
      apis: mod.apis.filter(api => {
        const nameMatch = api.name.toLowerCase().includes(q) || api.description.toLowerCase().includes(q) || api.basePath.toLowerCase().includes(q);
        const endpointMatch = api.sections.some(s => s.endpoints.some(ep => ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q)));
        return nameMatch || endpointMatch;
      }),
    })).filter(mod => mod.apis.length > 0);
  }, [searchQuery]);

  const handleExportExcel = async () => {
    const sheets = buildExcelData(API_MODULES);
    await exportToExcel(sheets, "Huggs_API_Collection");
  };

  const scrollToModule = (moduleId: string) => {
    setActiveModule(moduleId);
    moduleRefs.current[moduleId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getApiEndpointCount = (api: ApiDefinition) => {
    return api.sections.reduce((sum, s) => sum + s.endpoints.length, 0);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Documentação das APIs</CardTitle>
            <Badge variant="secondary" className="text-xs">{totalEndpoints} endpoints</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
        <CardDescription>
          Referência completa de todos os endpoints disponíveis para integração
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar APIs, endpoints ou descrições..."
            className="pl-10"
          />
        </div>

        <div className="flex gap-6">
          {/* Sidebar nav */}
          <div className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-4 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-2">Módulos</p>
              {API_MODULES.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => scrollToModule(mod.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === mod.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {mod.icon}
                  <span className="truncate">{mod.name}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{mod.apis.length}</Badge>
                </button>
              ))}

              <div className="border-t mt-4 pt-4">
                <button
                  onClick={() => scrollToModule("auth")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === "auth" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Shield className="h-5 w-5" />
                  <span>Autenticação</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-8">
            {filteredModules.map(mod => (
              <div key={mod.id} ref={el => { moduleRefs.current[mod.id] = el; }}>
                {/* Module header */}
                <div className={`rounded-xl bg-gradient-to-r ${mod.color} p-4 mb-4`}>
                  <div className="flex items-center gap-3 text-white">
                    {mod.icon}
                    <div>
                      <h3 className="font-semibold text-base">{mod.name}</h3>
                      <p className="text-sm text-white/80">{mod.description}</p>
                    </div>
                    <Badge className="ml-auto bg-white/20 text-white border-white/30 text-xs">
                      {mod.apis.length} APIs
                    </Badge>
                  </div>
                </div>

                {/* API table */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 bg-muted/50 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    <span>API</span>
                    <span className="text-center">Versão</span>
                    <span className="text-right">Endpoints</span>
                  </div>

                  {mod.apis.map((api, idx) => {
                    const isExpanded = expandedApi === api.id;
                    const epCount = getApiEndpointCount(api);
                    return (
                      <div key={api.id} className={idx < mod.apis.length - 1 && !isExpanded ? "border-b" : ""}>
                        <button
                          onClick={() => setExpandedApi(isExpanded ? null : api.id)}
                          className="w-full grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 hover:bg-muted/30 transition-colors items-center text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                            {api.icon}
                            <div className="min-w-0">
                              <span className="font-medium text-sm text-foreground">{api.name}</span>
                              <p className="text-xs text-muted-foreground truncate">{api.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono">v1</Badge>
                          <Badge variant="secondary" className="text-[10px]">{epCount}</Badge>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t bg-muted/10">
                            <div className="mt-3 space-y-1">
                              <code className="text-[11px] font-mono text-muted-foreground block mb-3">
                                Base: {BASE_URL}{api.basePath}
                              </code>
                              {api.sections.map((section, si) => (
                                <ApiSectionBlock
                                  key={si}
                                  title={section.title}
                                  endpoints={section.endpoints}
                                  basePath={api.basePath}
                                  description={section.description}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Auth section */}
            <div ref={el => { moduleRefs.current["auth"] = el; }}>
              <div className="rounded-xl bg-gradient-to-r from-slate-700 to-slate-600 p-4 mb-4">
                <div className="flex items-center gap-3 text-white">
                  <Shield className="h-5 w-5" />
                  <div>
                    <h3 className="font-semibold text-base">Autenticação & Segurança</h3>
                    <p className="text-sm text-white/80">Como autenticar suas requisições</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border rounded-xl p-5">
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
                    <p className="text-xs text-muted-foreground mt-2">Para usuários autenticados via frontend.</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Rate Limiting</h4>
                  <p className="text-xs text-muted-foreground">
                    Todas as APIs têm limite de <strong>60 requisições/minuto</strong> por IP ou API key.
                    Exceder retorna <code className="bg-muted px-1 rounded">429 Too Many Requests</code>.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Códigos de Erro</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
            </div>

            {/* No results */}
            {filteredModules.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhuma API encontrada para "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
