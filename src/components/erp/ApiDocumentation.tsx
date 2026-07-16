import { useState, useMemo, useRef } from "react";
import EndpointSupportChat from "./EndpointSupportChat";
import SdkDownloadButtons from "./SdkDownloadButtons";
import ApiStatusBadge from "./ApiStatusBadge";
import ApiGlobalStatus from "./ApiGlobalStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { 
  BookOpen, ChevronDown, ChevronRight, Copy, Check,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Search,
  FileText, Webhook, BarChart3, Shield, Database,
  FileSpreadsheet, Building2, Layers, DollarSign, Package,
  Rocket, AlertTriangle, Info, Zap, Terminal, History, RotateCcw, Globe,
  HelpCircle, PlayCircle, MessageCircle, FlaskConical, Clock, Lock
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { exportToExcel } from "@/lib/excel-utils";
import type { SheetData } from "@/lib/excel-utils";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const DOC_BASE_URL = "https://api.bimaster.online/v1";

// Pagination patterns for each API
const PAGINATION_PATTERNS: Record<string, "huggs" | "legado" | "rest"> = {
  "contas-pagar": "huggs", "contas-receber": "huggs", "departamentos": "huggs",
  "categorias": "huggs", "projetos": "huggs", "clientes": "huggs", "parcelas": "huggs",
  "contas-correntes": "legado", "lancamentos-cc": "legado", "anexos": "legado",
  "bandeiras": "legado", "cnae": "huggs", "cidades": "huggs",
  "exportacao": "rest", "boletos": "huggs",
};

const PAGINATION_LABELS: Record<string, { label: string; color: string }> = {
  huggs: { label: "Paginação Huggs", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  legado: { label: "Paginação Legada", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  rest: { label: "Paginação REST", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
};

// Event emitter for opening ApiTester with pre-filled data
export const apiTesterEventTarget = new EventTarget();
export function openApiTester(data: { method: string; url: string; body?: string }) {
  apiTesterEventTarget.dispatchEvent(new CustomEvent("open-tester", { detail: data }));
}

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  tag?: string | "deprecated";
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: string;
  response?: string;
  flow?: string[];
  /** v2.14.0: marca operação como deprecated no OpenAPI (deprecated:true + x-sunset). */
  deprecated?: boolean;
  /** v2.14.0: data de sunset (ISO date). Default: 2026-09-30. */
  xSunset?: string;
  /** v2.14.0: path do substituto recomendado (gera x-deprecation-replacement). */
  xReplacement?: string;
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
  status: ["Request", "Health Check", "DB Ping", "Response 200"],
  listar: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Zod Validate", "Query DB", "Paginacao", "Response 200"],
  consultar: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Zod Validate", "Query DB", "Response 200"],
  incluir: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Idempotency Check", "Zod Validate", "Insert DB", "Webhook Event", "Response 201"],
  alterar: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Zod Validate", "Find Record", "Update DB", "Webhook Event", "Response 200"],
  excluir: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Find Record", "Soft Delete", "Webhook Event", "Response 200"],
  upsert: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Idempotency Check", "Zod Validate", "Conflict Check", "Upsert DB", "Webhook Event", "Response 200"],
  upsertLote: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Idempotency Check", "Zod Array", "Batch Validate", "Upsert DB", "Response 200"],
  pagamento: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Idempotency Check", "Zod Validate", "Find Titulo", "RPC Atomic Payment", "Webhook Event", "Response 200"],
  sync: ["Request", "API Key", "Rate Limit (120)", "Extract Records", "Transform", "Batch Upsert", "Sync Log", "Response 200"],
  exportPull: ["Request", "API Key", "Rate Limit (120)", "Query DB", "Transform Payload", "Response 200"],
  confirm: ["Request", "API Key", "Rate Limit (120)", "Parse IDs", "Update Status", "Response 200"],
};

// ═══════════════════════════════════════
// ENDPOINT DATA
// ═══════════════════════════════════════

const contasPagarCrud: Endpoint[] = [
  {
    method: "GET", path: "/query", description: "Consulta avançada com filtros, paginação offset e cursor", tag: "consulta",
    flow: FLOW.listar,
    params: [
      { name: "empresa_id", type: "number", required: false, description: "Filtro por empresa" },
      { name: "fornecedor_codigo", type: "string", required: false, description: "Código do fornecedor" },
      { name: "status", type: "string", required: false, description: "Filtro: pendente, vencido, pago, cancelado" },
      { name: "vencimento_de", type: "date", required: false, description: "Data vencimento inicial (YYYY-MM-DD)" },
      { name: "vencimento_ate", type: "date", required: false, description: "Data vencimento final (YYYY-MM-DD)" },
      { name: "emissao_de", type: "date", required: false, description: "Data emissão inicial (YYYY-MM-DD)" },
      { name: "emissao_ate", type: "date", required: false, description: "Data emissão final (YYYY-MM-DD)" },
      { name: "limit", type: "number", required: false, description: "Máx registros (default: 100, máx: 1000)" },
      { name: "offset", type: "number", required: false, description: "Paginação offset" },
      { name: "cursor", type: "uuid", required: false, description: "Cursor pagination — ID do último registro (alternativa a offset)" },
      { name: "order_by", type: "string", required: false, description: "Campo de ordenação (default: data_vencimento)" },
      { name: "order_dir", type: "string", required: false, description: "Direção: asc ou desc" },
    ],
    response: `{ "data": [{ "id": "uuid", "fornecedor_nome": "...", "valor_original": 1500, "status": "pendente" }], "pagination": { "total": 250, "offset": 0, "limit": 100 }, "meta": { "request_id": "uuid", "api_version": "2.4.0", "duration_ms": 45 } }`,
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
    response: `{ "success": true, "cancelados": 2, "ids": ["uuid-1", "uuid-2"], "message": "2 título(s) cancelado(s)" }`,
  },
  {
    method: "POST", path: "/cancelar-lote", description: "Alias batch-explícito para /cancelar (mesmo handler, mesmo shape de body/response)",
    flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse IDs", "Cancelar Titulos", "Webhook Event", "Response 200"],
    body: `{ "ids": ["uuid-1", "uuid-2"], "motivo": "Duplicidade de lançamento" }`,
    response: `{ "success": true, "cancelados": 2, "ids": ["uuid-1", "uuid-2"], "bloqueados": [], "message": "2 título(s) cancelado(s)" }`,
  },
  // /registrar-pagamento removido em v4.0.0 (PR-7) — use /lancar-pagamento.
  { method: "GET", path: "/status", description: "Health check enriquecido da API (latência DB, sync slots)", flow: FLOW.status, response: `{ "status": "online", "version": "2.4.0", "timestamp": "2026-04-16T00:00:00Z", "service": "contas-pagar-api", "health": { "db_latency_ms": 12, "db_connected": true, "active_sync_slots": 3 }, "meta": { "request_id": "uuid", "api_version": "2.4.0", "duration_ms": 15 } }` },
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
    body: `{ "codigo_lancamento_integracao": "INT-001", "codigo_cliente_fornecedor": "2d3d20ef-158d-4765-8d2c-3e6100aace64", "data_vencimento": "2026-03-21", "valor_documento": 100, "codigo_categoria": "2.04.01" }`,
    response: `{ "codigo_lancamento_huggs": null, "codigo_lancamento_integracao": "INT-001", "codigo_status": "0", "descricao_status": "Cadastro incluído com sucesso!" }`,
  },
  // /alterar removido em v4.0.0 (PR-7) — use /upsert.
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
    body: `{ "codigo_lancamento_integracao": "INT-001", "empresa_id": "abc12345-6789-0def-ghij-klmnopqrstuv", "codigo_cliente_fornecedor": "2d3d20ef-158d-4765-8d2c-3e6100aace64", "data_vencimento": "2026-03-21", "valor_documento": 100, "codigo_categoria": "2.04.01" }`,
    response: `{ "codigo_lancamento_integracao": "INT-001", "codigo_status": "0", "descricao_status": "Upsert realizado com sucesso!" }`,
  },
  {
    method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500) (UpsertContaPagarPorLote)", tag: "novo",
    flow: FLOW.upsertLote,
    body: `{ "lote": 1, "conta_pagar_cadastro": [{ "codigo_lancamento_integracao": "INT-001", "empresa_id": "abc12345-6789-0def-ghij-klmnopqrstuv", "codigo_cliente_fornecedor": "2d3d20ef-158d-4765-8d2c-3e6100aace64", "data_vencimento": "2026-03-21", "valor_documento": 100, "codigo_categoria": "2.04.01" }] }`,
    response: `{ "lote": 1, "codigo_status": "0", "descricao_status": "1 processado(s), 0 erro(s)" }`,
  },
  {
    method: "POST", path: "/lancar-pagamento", description: "Efetuar baixa de pagamento (LancarPagamento)", tag: "novo",
    flow: FLOW.pagamento,
    body: `{ "codigo_lancamento_integracao": "INT-001", "valor": 100.20, "desconto": 0, "juros": 0, "multa": 0, "data": "2026-03-21", "observacao": "Baixa via API" }`,
    response: `{ "codigo_lancamento_integracao": "INT-001", "codigo_baixa": "uuid", "liquidado": "S", "valor_baixado": 100.20, "codigo_status": "0", "descricao_status": "Pagamento registrado com sucesso!" }`,
  },
  // /cancelar-pagamento removido em v4.0.0 (PR-7) — use /estornar (estorno auditável com motivo).
  // /listar removido em v4.0.0 (PR-7) — use /query (paginação REST com cursor/offset).
];

const contasPagarComplementar: Endpoint[] = [
  { method: "GET", path: "/parcelas", description: "Consulta parcelas de um título", flow: FLOW.consultar, params: [{ name: "conta_pagar_id", type: "uuid", required: true, description: "ID do título" }, { name: "cursor", type: "uuid", required: false, description: "Cursor pagination" }] },
  { method: "POST", path: "/parcelas/sync", description: "Sync de parcelas do ERP (máx 5000/request)", flow: FLOW.sync, body: `{ "parcelas": [{ "conta_pagar_id": "uuid", "numero": 1, "valor": 500, "data_vencimento": "2026-04-15" }] }` },
  { method: "GET", path: "/pagamentos", description: "Histórico de pagamentos de um título (cursor pagination)", flow: FLOW.consultar, params: [{ name: "conta_pagar_id", type: "uuid", required: true, description: "ID do título" }, { name: "limit", type: "integer", required: false, description: "Máx registros (default: 100, máx: 500)" }, { name: "offset", type: "integer", required: false, description: "Paginação offset" }, { name: "cursor", type: "uuid", required: false, description: "Cursor pagination — ID do último registro" }] },
  { method: "POST", path: "/estornar", description: "Estorno de pagamento com recálculo de saldo. NOTA v2.16.0: estornar e cancelar-pagamento coexistem por design — estornar exige motivo auditável (compliance contábil); cancelar = anulação operacional simples. Preferir estornar para rastreabilidade.", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit (120/60)", "Idempotency Check", "Zod Validate", "Find Pagamento", "Estornar", "Recalcular Saldo", "Response 200"], body: `{ "id": "uuid-titulo", "motivo": "Pagamento indevido", "valor_estorno": 500 }`, response: `{ "success": true, "message": "Estorno realizado", "meta": { "request_id": "uuid", "api_version": "2.4.0" } }` },
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
  { method: "POST", path: "/incluir", description: "Incluir novo lançamento de conta corrente", flow: FLOW.incluir, body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": "codigo-da-conta-corrente", "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "nCodCliente": "codigo-do-cliente", "cObs": "Referente a jardinagem" } }`, response: `{ "nCodLanc": null, "cCodIntLanc": "LANC001", "cCodStatus": "0", "cDesStatus": "Lançamento incluído com sucesso" }` },
  { method: "PUT", path: "/alterar", description: "Alterar lançamento existente", flow: FLOW.alterar, body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nValorLanc": 200.00 }, "detalhes": { "cObs": "Valor corrigido" } }`, response: `{ "cCodIntLanc": "LANC001", "cCodStatus": "0", "cDesStatus": "Lançamento alterado com sucesso" }` },
  { method: "DELETE", path: "/excluir", description: "Excluir (inativar) lançamento", flow: FLOW.excluir, params: [{ name: "cCodIntLanc", type: "string", required: false, description: "Código de integração" }, { name: "id", type: "uuid", required: false, description: "ID interno" }] },
  { method: "POST", path: "/upsert", description: "Upsert unitário (cria ou atualiza por cCodIntLanc)", flow: FLOW.upsert, body: `{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": "codigo-da-conta-corrente", "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "cObs": "Lançamento via API" } }` },
  { method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500 lançamentos)", flow: FLOW.upsertLote, body: `{ "lote": 1, "lancamentos": [{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": "codigo-da-conta-corrente", "dDtLanc": "21/03/2026", "nValorLanc": 100 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN" } }] }`, response: `{ "lote": 1, "cCodStatus": "0", "cDesStatus": "1 processado(s), 0 erro(s)" }` },
  { method: "GET", path: "/extrato", description: "Extrato de conta corrente com saldos e movimentos (ListarExtrato)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Parse Params", "Query Movimentos", "Calcular Saldos", "Response 200"], params: [{ name: "nCodCC", type: "integer", required: false, description: "Código Huggs da conta" }, { name: "cCodIntCC", type: "string", required: false, description: "Código de integração" }, { name: "dPeriodoInicial", type: "string", required: false, description: "Período inicial" }, { name: "dPeriodoFinal", type: "string", required: false, description: "Período final" }, { name: "cExibirApenasSaldo", type: "string", required: false, description: "S para apenas saldos" }], response: `{ "nCodCC": 427619317, "cDescricao": "Conta Bradesco", "nSaldoAnterior": 10000.00, "nSaldoAtual": 15230.50, "listaMovimentos": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status },
];

const contasReceberIntegracao: Endpoint[] = [
  { method: "GET", path: "/consultar", description: "Consultar título por ID ou código (ConsultarContaReceber)", tag: "novo", flow: FLOW.consultar, params: [{ name: "id", type: "uuid", required: false, description: "ID interno" }, { name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" }, { name: "codigo_lancamento_huggs", type: "integer", required: false, description: "Código numérico Huggs" }], response: `{ "conta_receber_cadastro": { "id": "uuid", "codigo_lancamento_integracao": "CR-001", "valor_original": 100 } }` },
  // PR-17 — paridade CR↔CP: query unificada + parcelas + histórico de recebimentos
  { method: "GET", path: "/query", description: "Consulta unificada CR com filtros, paginação offset e cursor (paridade com cpQuery)", tag: "novo", flow: FLOW.listar, params: [{ name: "empresa_id", type: "integer", required: false, description: "Filtro por empresa" }, { name: "status", type: "string", required: false, description: "Status (vírgula para múltiplos)" }, { name: "cliente_codigo", type: "string", required: false, description: "Código do cliente" }, { name: "vencimento_de", type: "date", required: false, description: "Vencimento inicial (YYYY-MM-DD)" }, { name: "vencimento_ate", type: "date", required: false, description: "Vencimento final (YYYY-MM-DD)" }, { name: "limit", type: "integer", required: false, description: "Máx registros (default 100, máx 1000)" }, { name: "offset", type: "integer", required: false, description: "Paginação offset" }, { name: "cursor", type: "uuid", required: false, description: "Cursor pagination — UUID do último registro" }, { name: "order_by", type: "string", required: false, description: "Campo de ordenação (default data_vencimento)" }, { name: "order_dir", type: "string", required: false, description: "asc ou desc (default desc)" }], response: `{ "data": [{ "id": "uuid", "codigo_lancamento_integracao": "CR-001", "valor_original": 100, "status": "Pendente" }], "pagination": { "total": 250, "limit": 100, "offset": 0, "has_more": true } }` },
  { method: "GET", path: "/parcelas", description: "Consultar parcelas de um título CR (paridade com cpGetParcelas)", tag: "novo", flow: FLOW.consultar, params: [{ name: "conta_receber_id", type: "uuid", required: true, description: "UUID do título CR" }, { name: "limit", type: "integer", required: false, description: "Máx 500 (default 100)" }, { name: "offset", type: "integer", required: false, description: "Paginação offset" }], response: `{ "data": [{ "id": "uuid", "numero_parcela": 1, "valor_original": 100, "data_vencimento": "2026-04-15", "status": "Pendente" }], "pagination": { "total": 3, "limit": 100, "offset": 0, "has_more": false } }` },
  { method: "GET", path: "/recebimentos", description: "Histórico de recebimentos de um título CR (paridade com cpGetPagamentos)", tag: "novo", flow: FLOW.consultar, params: [{ name: "conta_receber_id", type: "uuid", required: true, description: "UUID do título CR" }, { name: "limit", type: "integer", required: false, description: "Máx 500 (default 100)" }, { name: "offset", type: "integer", required: false, description: "Paginação offset" }], response: `{ "data": [{ "id": "uuid", "valor_recebido": 100.20, "data_recebimento": "2026-03-21", "forma_recebimento": "DIN" }], "pagination": { "total": 1, "limit": 100, "offset": 0, "has_more": false } }` },
  { method: "POST", path: "/incluir", description: "Incluir conta a receber (IncluirContaReceber)", tag: "novo", flow: FLOW.incluir, body: `{ "codigo_lancamento_integracao": "CR-001", "codigo_cliente_fornecedor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "data_vencimento": "2026-03-21", "valor_documento": 100, "codigo_categoria": "1.01.02" }`, response: `{ "codigo_lancamento_huggs": null, "codigo_lancamento_integracao": "CR-001", "codigo_status": "0", "descricao_status": "Cadastro incluído com sucesso!" }` },
  // CR /alterar removido em v4.0.0 (PR-7) — use /upsert.
  { method: "DELETE", path: "/excluir", description: "Excluir (inativar) conta a receber (ExcluirContaReceber)", tag: "novo", flow: FLOW.excluir, params: [{ name: "codigo_lancamento_integracao", type: "string", required: false, description: "Código de integração" }, { name: "id", type: "uuid", required: false, description: "ID interno" }] },
  { method: "POST", path: "/upsert", description: "Upsert unitário (UpsertContaReceber)", tag: "novo", flow: FLOW.upsert, body: `{ "codigo_lancamento_integracao": "CR-001", "empresa_id": "abc12345-6789-0def-ghij-klmnopqrstuv", "codigo_cliente_fornecedor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "data_vencimento": "2026-03-21", "valor_documento": 100, "codigo_categoria": "1.01.02" }` },
  { method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500) (UpsertContaReceberPorLote)", tag: "novo", flow: FLOW.upsertLote, body: `{ "lote": 1, "conta_receber_cadastro": [{ "codigo_lancamento_integracao": "CR-001", "empresa_id": "abc12345-6789-0def-ghij-klmnopqrstuv", "codigo_cliente_fornecedor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "data_vencimento": "2026-03-21", "valor_documento": 100, "codigo_categoria": "1.01.02" }] }`, response: `{ "lote": 1, "codigo_status": "0", "descricao_status": "1 processado(s), 0 erro(s)" }` },
  { method: "POST", path: "/lancar-recebimento", description: "Registrar recebimento/baixa (LancarRecebimento)", tag: "novo", flow: FLOW.pagamento, body: `{ "codigo_lancamento_integracao": "CR-001", "valor": 100.20, "desconto": 0, "juros": 0, "multa": 0, "data": "2026-03-21" }`, response: `{ "codigo_lancamento_integracao": "CR-001", "liquidado": "S", "valor_baixado": 100.20, "codigo_status": "0", "descricao_status": "Recebimento registrado com sucesso!" }` },
  // CR /cancelar-recebimento removido em v4.0.0 (PR-7) — use /estornar.
  { method: "POST", path: "/conciliar", description: "Conciliar recebimento (ConciliarRecebimento)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Baixa", "Marcar Conciliado", "Response 200"], body: `{ "codigo_baixa": "uuid-da-baixa" }` },
  { method: "POST", path: "/desconciliar", description: "Desconciliar recebimento (DesconciliarRecebimento)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Baixa", "Reverter Conciliacao", "Response 200"], body: `{ "codigo_baixa": "uuid-da-baixa" }` },
  { method: "POST", path: "/cancelar", description: "Cancelar título (CancelarContaReceber)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Rate Limit", "Find Titulo", "Cancelar", "Webhook Event", "Response 200"], body: `{ "chave_lancamento": "codigo-do-titulo" }` },
  // CR /listar removido em v4.0.0 (PR-7) — use /consultar (single record) ou query equivalente.
  { method: "GET", path: "/status", description: "Health check da API de Contas a Receber", flow: FLOW.status, response: `{ "status": "ok", "version": "1.4.0", "timestamp": "2026-04-18T00:00:00Z" }` },
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
  { method: "POST", path: "/incluir", description: "Cadastrar nova empresa (IncluirEmpresa)", tag: "novo", flow: FLOW.incluir, body: `{ "razao_social": "Empresa ABC Ltda", "nome_fantasia": "ABC", "cnpj": "12.345.678/0001-90", "codigo_empresa_integracao": "EMP001", "codigo_erp": "12345", "regime_apuracao": "Competência", "tipo_empresa": "Matriz", "natureza_juridica": "Ltda", "porte": "EPP", "capital_social": 100000.00, "data_abertura": "2020-01-15", "codigo_ibge_municipio": 3550308, "responsavel_nome": "João Silva", "responsavel_cpf": "123.456.789-00", "inscricao_estadual": "123456789", "inscricao_municipal": "987654", "regime_tributario": "Lucro Presumido", "endereco": "Rua das Flores", "endereco_numero": "100", "complemento": "Sala 201", "bairro": "Centro", "cidade": "São Paulo", "estado": "SP", "cep": "01000-000", "email": "contato@abc.com", "telefone1_ddd": "11", "telefone1_numero": "999998888" }`, response: `{ "codigo_empresa": 8, "codigo_empresa_integracao": "EMP001", "codigo_status": "0", "descricao_status": "Empresa incluída com sucesso!" }` },
  { method: "POST", path: "/alterar", description: "Alterar dados de empresa (AlterarEmpresa)", tag: "novo", flow: FLOW.alterar, body: `{ "codigo_empresa": 8, "razao_social": "Empresa ABC Ltda Atualizada", "regime_apuracao": "Caixa", "porte": "ME" }`, response: `{ "codigo_empresa": 8, "codigo_empresa_integracao": "EMP001", "codigo_status": "0", "descricao_status": "Empresa alterada com sucesso!" }` },
  { method: "POST", path: "/consultar", description: "Consultar empresa por código (ConsultarEmpresa)", tag: "novo", flow: FLOW.consultar, body: `{ "codigo_empresa": 8 }`, response: `{ "empresas_cadastro": { "codigo_empresa": 8, "codigo_empresa_integracao": "EMP001", "codigo_erp": "12345", "cnpj": "12.345.678/0001-90", "razao_social": "Empresa ABC Ltda", "nome_fantasia": "ABC", "regime_apuracao": "Competência", "tipo_empresa": "Matriz", "natureza_juridica": "Ltda", "porte": "EPP", "capital_social": 100000.00, "data_abertura": "2020-01-15", "codigo_ibge_municipio": 3550308, "responsavel_nome": "João Silva", "responsavel_cpf": "123.456.789-00", "inscricao_estadual": "123456789", "inscricao_municipal": "987654", "regime_tributario": "Lucro Presumido", "endereco": "Rua das Flores", "endereco_numero": "100", "complemento": "Sala 201", "bairro": "Centro", "cidade": "São Paulo", "estado": "SP", "cep": "01000-000", "inativa": "N" } }` },
  { method: "POST", path: "/listar", description: "Listar empresas paginadas (ListarEmpresas)", tag: "novo", flow: FLOW.listar, body: `{ "pagina": 1, "registros_por_pagina": 100 }`, response: `{ "pagina": 1, "total_de_paginas": 1, "registros": 2, "total_de_registros": 2, "empresas_cadastro": [...] }` },
  { method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status },
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
  { method: "GET", path: "/listar", description: "Listar bandeiras de cartão (ListarBandeiras)", tag: "novo", params: [{ name: "nPagina", type: "integer", required: false, description: "Página" }, { name: "nRegPorPagina", type: "integer", required: false, description: "Registros por página" }], response: `{ "nPagina": 1, "nTotPaginas": 1, "nRegistros": 8, "nTotRegistros": 8, "listaBandeira": [{ "cCodigo": "VISA", "cDescricao": "Visa", "cTipo": "credito" }] }` },
  { method: "GET", path: "/status", description: "Health check da API" },
];

const clientesCrud: Endpoint[] = [
  { method: "POST", path: "/listar", description: "Lista paginada de clientes (ListarClientes)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50, "clientesFiltro": { "razao_social": "" } }`, response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "clientes_cadastro": [...] }` },
  { method: "POST", path: "/listar-resumido", description: "Lista resumida (ListarClientesResumido)", tag: "novo", body: `{ "pagina": 1, "registros_por_pagina": 50 }`, response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 50, "total_de_registros": 125, "clientes_cadastro_resumido": [...] }` },
  { method: "POST", path: "/consultar", description: "Consultar cliente (ConsultarCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001" }`, response: `{ "clientes_cadastro": { "codigo_cliente_huggs": "uuid", "razao_social": "ABC Ltda" } }` },
  { method: "POST", path: "/incluir", description: "Incluir novo cliente (IncluirCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "razao_social": "Empresa ABC Ltda", "cnpj_cpf": "12.345.678/0001-90" }`, response: `{ "codigo_cliente_huggs": "uuid", "codigo_status": "0", "descricao_status": "Cliente incluído com sucesso!" }` },
  { method: "POST", path: "/alterar", description: "Alterar dados do cliente (AlterarCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "nome_fantasia": "ABC Atualizado" }`, response: `{ "codigo_status": "0", "descricao_status": "Cliente alterado com sucesso!" }` },
  { method: "POST", path: "/excluir", description: "Excluir (inativar) cliente (ExcluirCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001" }`, response: `{ "codigo_status": "0", "descricao_status": "Cliente excluído com sucesso!" }` },
  { method: "POST", path: "/upsert", description: "Upsert por código de integração (UpsertCliente)", tag: "novo", body: `{ "codigo_cliente_integracao": "CLI001", "razao_social": "ABC Ltda" }`, response: `{ "codigo_cliente_huggs": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Cliente processado com sucesso (upsert)!" }` },
  { method: "POST", path: "/upsert-cpfcnpj", description: "Upsert por CPF/CNPJ (UpsertClienteCpfCnpj)", tag: "novo", body: `{ "cnpj_cpf": "12.345.678/0001-90", "razao_social": "ABC Ltda" }`, response: `{ "codigo_cliente_huggs": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Cliente processado com sucesso (upsert por CPF/CNPJ)!" }` },
  { method: "POST", path: "/upsert-lote", description: "Upsert em lote (máx 500) (UpsertClientePorLote)", tag: "novo", flow: FLOW.upsertLote, body: `{ "lote": 1, "clientes_cadastro": [{ "codigo_cliente_integracao": "CLI001", "razao_social": "ABC Ltda", "cnpj_cpf": "12.345.678/0001-90" }] }`, response: `{ "lote": 1, "codigo_status": "0", "descricao_status": "1 processado(s), 0 erro(s)", "processados": 1, "erros": 0 }` },
  { method: "POST", path: "/sync", description: "Sync bidirecional — retorna clientes alterados desde data (SyncClientes)", tag: "novo", flow: FLOW.sync, body: `{ "atualizado_desde": "2026-03-01T00:00:00Z", "pagina": 1, "registros_por_pagina": 100 }`, response: `{ "pagina": 1, "total_de_paginas": 3, "registros": 100, "total_de_registros": 250, "atualizado_desde": "2026-03-01T00:00:00Z", "clientes_cadastro": [...] }` },
  { method: "POST", path: "/associar", description: "Associar código de integração (AssociarCodIntCliente)", tag: "novo", body: `{ "codigo_cliente_huggs": "uuid", "codigo_cliente_integracao": "CLI001" }`, response: `{ "codigo_cliente_huggs": "uuid", "codigo_cliente_integracao": "CLI001", "codigo_status": "0", "descricao_status": "Código de integração associado com sucesso!" }` },
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
  { method: "POST", path: "/check", description: "Verificar se fornecedor existe pelo CNPJ (verificação rápida — usado por integradores antes de cadastrar)", tag: "novo", flow: FLOW.consultar, body: `{ "cnpj": "12.345.678/0001-90" }`, response: `{ "exists": true, "erp_code": "4214850", "razao_social": "ABC Ltda", "meta": { "request_id": "uuid", "duration_ms": 42 } }` },
  { method: "POST", path: "/sync", description: "Sincronizar fornecedor (upsert por CNPJ — cria se não existe, atualiza se existe)", tag: "novo", flow: FLOW.sync, body: `{ "cnpj": "12.345.678/0001-90", "razao_social": "ABC Ltda", "nome_fantasia": "ABC", "email": "contato@abc.com", "telefone": "11999998888" }`, response: `{ "codigo_status": "OK", "descricao_status": "Fornecedor sincronizado", "erp_code": "4214850", "meta": { "request_id": "uuid", "duration_ms": 78 } }` },
  { method: "POST", path: "/consultar", description: "Consultar fornecedor no ERP por CNPJ", tag: "novo", flow: FLOW.consultar, body: `{ "cnpj": "12.345.678/0001-90" }`, response: `{ "encontrado": true, "fornecedor": { "erp_code": "4214850", "razao_social": "ABC Ltda" } }` },
  { method: "POST", path: "/cadastrar", description: "Cadastrar fornecedor no ERP e salvar código retornado", tag: "novo", flow: FLOW.incluir, body: `{ "cnpj": "12.345.678/0001-90", "razao_social": "Novo Fornecedor", "nome_fantasia": "Novo", "email": "contato@novo.com" }`, response: `{ "success": true, "erp_code": "4214851", "message": "Fornecedor cadastrado no ERP" }` },
  { method: "POST", path: "/sync-bidirecional", description: "Sincronização bidirecional completa (BiMaster ↔ ERP)", tag: "novo", flow: FLOW.sync, body: `{ "empresa_id": "abc12345-6789-0def-ghij-klmnopqrstuv", "modo": "full" }`, response: `{ "sincronizados": 45, "novos_no_erp": 3, "novos_no_bimaster": 2, "erros": 0 }` },
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

const erpExportPushCrud: Endpoint[] = [
  { method: "POST", path: "/", description: "Exportar pagamento para ERP (action: export). Erros: 400 (payload inválido), 404 payment_queue_not_found (UUID válido mas inexistente em financial_payment_queue), 502 (canal externo falhou).", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Validate Zod", "Find Payment (404 se ausente)", "Build Payload", "Send to Channel", "Log Export", "Response 200"], body: `{\n  "action": "export",\n  "payment_queue_id": "550e8400-e29b-41d4-a716-446655440000",\n  "channel": "rest_api",\n  "export_type": "payment"\n}`, response: `{\n  "success": true,\n  "exports": [\n    { "id": "9f1c2b34-1111-4d22-9aaa-cccccccccccc", "status": "exported", "external_id": "REF-001" }\n  ],\n  "registration": { "created": 1, "updated": 0 },\n  "payment": { "settled": 1 },\n  "meta": { "request_id": "uuid", "api_version": "2.16.1", "duration_ms": 120 }\n}\n\n// Erro 404 (payment_queue_id inexistente):\n{\n  "error": "payment_queue_not_found",\n  "message": "Nenhum registro encontrado em financial_payment_queue para payment_queue_id=00000000-0000-0000-0000-000000000000",\n  "meta": { "processed_at": "2026-04-17T12:00:00Z", "duration_ms": 45 }\n}` },
  { method: "POST", path: "/", description: "Reenviar exportação com erro (action: retry)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Validate Zod", "Find Export Record", "Resend to Channel", "Update Status", "Response 200"], body: `{\n  "action": "retry",\n  "export_queue_id": "9f1c2b34-1111-4d22-9aaa-cccccccccccc"\n}`, response: `{ "success": true, "attempts": 2, "message": "Reenvio bem-sucedido" }` },
  { method: "POST", path: "/", description: "Consultar status de exportação (action: status)", tag: "novo", flow: ["Request", "Auth (JWT/API Key)", "Validate Zod", "Query Export Queue", "Response 200"], body: `{\n  "action": "status",\n  "payment_queue_id": "550e8400-e29b-41d4-a716-446655440000"\n}`, response: `{\n  "success": true,\n  "exports": [\n    { "id": "9f1c2b34-1111-4d22-9aaa-cccccccccccc", "status": "exported", "external_id": "REF-001", "attempts": 1, "last_error": null }\n  ],\n  "registration": { "created": 1, "updated": 0 },\n  "payment": { "settled": 1 },\n  "meta": { "request_id": "uuid", "api_version": "2.13.0", "duration_ms": 85 }\n}` },
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
      { id: "clientes", name: "Clientes", description: "CRUD completo de clientes/fornecedores. ATENCAO: Este e o cadastro geral de pessoas (clientes e fornecedores). Para consultas especificas de fornecedores do Contas a Pagar, use a API de Fornecedores.", basePath: "/clientes-api", icon: <Database className="h-4 w-4 text-blue-500" />, sections: [{ title: "CRUD Principal", endpoints: clientesCrud }, { title: "Características", endpoints: clientesCaractCrud }, { title: "Tags", endpoints: clientesTagsCrud }] },
      { id: "empresas", name: "Empresas", description: "Consultar e listar empresas", basePath: "/empresas-api", icon: <Building2 className="h-4 w-4 text-blue-500" />, sections: [{ title: "Consulta & Listagem", endpoints: empresasCrud }] },
      { id: "projetos", name: "Projetos", description: "CRUD completo de projetos", basePath: "/projetos-api", icon: <FileText className="h-4 w-4 text-blue-500" />, sections: [{ title: "CRUD", endpoints: projetosCrud }] },
    ],
  },
  {
    id: "cadastros",
    name: "Cadastros Auxiliares",
    description: "Cadastros essenciais para integração ERP",
    icon: <Package className="h-5 w-5" />,
    color: "from-emerald-600 to-emerald-500",
    apis: [
      { id: "fornecedores-query", name: "Fornecedores (Consulta)", description: "Consulta de fornecedores ativos por CNPJ. ATENCAO: Subset do cadastro de Clientes, retorna apenas fornecedores vinculados ao Contas a Pagar.", basePath: "/erp-fornecedores-query", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta", endpoints: fornecedoresQueryCrud }] },
      { id: "fornecedores-sync", name: "Fornecedores (Sync)", description: "Sincronização bidirecional de fornecedores com ERP", basePath: "/erp-fornecedores-sync", icon: <RefreshCw className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Sync Bidirecional", endpoints: fornecedoresSyncCrud }] },
      { id: "plano-contas", name: "Plano de Contas", description: "Chart of Accounts para classificacao contabil. ATENCAO: Diferente de Categorias -- Plano de Contas e a estrutura contabil oficial, Categorias sao agrupamentos internos do BiMaster.", basePath: "/erp-plano-contas-api", icon: <BarChart3 className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: planoContasCrud }] },
      { id: "portadores", name: "Portadores", description: "Contas bancárias/portadores para pagamento", basePath: "/erp-portadores-api", icon: <DollarSign className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta & Sync", endpoints: portadoresCrud }] },
      { id: "categorias", name: "Categorias", description: "Categorias financeiras internas (receita/despesa). ATENCAO: Diferente de Plano de Contas -- Categorias sao agrupamentos internos, Plano de Contas e a estrutura contabil.", basePath: "/categorias-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "CRUD", endpoints: categoriasCrud }] },
      { id: "departamentos", name: "Departamentos", description: "Centros de custo / departamentos", basePath: "/departamentos-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "CRUD", endpoints: departamentosCrud }] },
      { id: "parcelas", name: "Parcelas", description: "Condições de pagamento/parcelamento", basePath: "/parcelas-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "CRUD", endpoints: parcelasCrud }] },
      { id: "dre", name: "DRE", description: "Demonstrativo de Resultados", basePath: "/dre-cadastro-api", icon: <BarChart3 className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: dreCadastroCrud }] },
      { id: "bancos", name: "Bancos", description: "Instituições financeiras", basePath: "/bancos-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta & Listagem", endpoints: bancosCrud }] },
      { id: "tipos-documento", name: "Tipos de Documento", description: "Consulta e pesquisa", basePath: "/tipos-documento-api", icon: <FileText className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta", endpoints: tiposDocumentoCrud }] },
      { id: "tipos-entrega", name: "Tipos de Entrega", description: "CRUD de tipos de entrega", basePath: "/tipos-entrega-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "CRUD", endpoints: tiposEntregaCrud }] },
      { id: "finalidades", name: "Finalidades de Transferência", description: "Finalidades bancárias", basePath: "/finalidades-transferencia-api", icon: <RefreshCw className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Consulta & Listagem", endpoints: finalidadesTransfCrud }] },
      { id: "tipos-atividade", name: "Tipos de Atividade", description: "Listagem de tipos", basePath: "/tipos-atividade-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: tiposAtividadeCrud }] },
      { id: "tipos-anexo", name: "Tipos de Anexo", description: "Tipos de documentos anexos", basePath: "/tipos-anexo-api", icon: <Database className="h-4 w-4 text-emerald-500" />, sections: [{ title: "Listagem", endpoints: tiposAnexoCrud }] },
    ],
  },
  {
    id: "referencia",
    name: "Tabelas de Referência (Opcional)",
    description: "Tabelas estáticas read-only — opcionais se o ERP já possui estes dados internamente (IBGE, CNAE, etc.)",
    icon: <Database className="h-5 w-5" />,
    color: "from-slate-600 to-slate-500",
    apis: [
      { id: "cnae", name: "CNAE", description: "Classificação Nacional de Atividades Econômicas (tabela IBGE pública)", basePath: "/cnae-api", icon: <Database className="h-4 w-4 text-slate-500" />, sections: [{ title: "Listagem", endpoints: cnaeCrud }] },
      { id: "cidades", name: "Cidades", description: "Pesquisa de cidades brasileiras (tabela IBGE pública)", basePath: "/cidades-api", icon: <Search className="h-4 w-4 text-slate-500" />, sections: [{ title: "Pesquisa", endpoints: cidadesCrud }] },
      { id: "paises", name: "Países", description: "Lista estática de países", basePath: "/paises-api", icon: <Database className="h-4 w-4 text-slate-500" />, sections: [{ title: "Listagem", endpoints: paisesCrud }] },
      { id: "bandeiras", name: "Bandeiras de Cartão", description: "Lista estática de bandeiras de crédito/débito", basePath: "/bandeiras-api", icon: <FileText className="h-4 w-4 text-slate-500" />, sections: [{ title: "Listagem", endpoints: bandeirasCrud }] },
      { id: "origens", name: "Origens de Lançamento", description: "Tipos de origem de lançamento (interno BiMaster)", basePath: "/origens-api", icon: <FileText className="h-4 w-4 text-slate-500" />, sections: [{ title: "Listagem", endpoints: origensCrud }] },
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
      { id: "exportacao", name: "Exportação ERP (Pull)", description: "Pull, batch, reconciliação e webhook push", basePath: "/contas-pagar-export-api", icon: <ArrowUpFromLine className="h-4 w-4 text-amber-500" />, sections: [{ title: "Pull (ERP consulta)", endpoints: exportPull }, { title: "Avançado (Lote & Reconciliação)", endpoints: exportAdvanced }] },
      { id: "exportacao-push", name: "Exportação ERP (Push)", description: "Envio direto de pagamentos ao ERP via REST API ou SQL Direct. Suporta provisão (registration) e baixa (payment).", basePath: "/erp-export-payment", icon: <Rocket className="h-4 w-4 text-amber-500" />, sections: [{ title: "Ações (export, retry, status)", endpoints: erpExportPushCrud, description: "Canais: rest_api, sql_direct | Tipos: registration (provisão), payment (baixa)" }] },
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
      { id: "webhook-subscriptions", name: "Webhook Subscriptions", description: "CRUD de assinaturas para webhooks outbound", basePath: "/webhook-subscriptions-api", icon: <Webhook className="h-4 w-4 text-purple-500" />, sections: [{ title: "Gestão de Assinaturas", endpoints: webhookSubscriptionsCrud }, { title: "Catálogo de Eventos", endpoints: [], description: "Eventos disponíveis para assinatura — use GET /eventos para lista atualizada" }] },
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
  const [curlCopied, setCurlCopied] = useState(false);
  const fullUrl = `${DOC_BASE_URL}${basePath}${endpoint.path}`;
  const hasDetails = endpoint.params || endpoint.body || endpoint.response || endpoint.flow;

  const generateCurl = () => {
    const parts = [`curl -X ${endpoint.method}`];
    parts.push(`  -H "x-api-key: SUA_CHAVE"`);
    if (endpoint.body) {
      parts.push(`  -H "Content-Type: application/json"`);
      const compactBody = endpoint.body.replace(/\s+/g, " ").trim();
      parts.push(`  -d '${compactBody}'`);
    }
    parts.push(`  "${fullUrl}"`);
    return parts.join(" \\\n");
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(generateCurl());
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  };

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
          {endpoint.tag === "deprecated" && <Badge variant="destructive" className="text-[9px] h-4 px-1.5 uppercase tracking-wider">Legado</Badge>}
          {endpoint.tag === "novo" && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">NOVO</Badge>}
        </div>
      </CollapsibleTrigger>
      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-10 mr-3 mb-3 space-y-3 border-l-2 border-muted pl-4">
            {/* Curl copy button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => {
                openApiTester({
                  method: endpoint.method,
                  url: `${DOC_BASE_URL}${basePath}${endpoint.path}`,
                  body: endpoint.body,
                });
              }}>
                <PlayCircle className="h-3 w-3" />
                Testar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleCopyCurl}>
                {curlCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Terminal className="h-3 w-3" />}
                {curlCopied ? "Copiado!" : "Copiar curl"}
              </Button>
            </div>
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
              <CodeBlock code={generateCurl()} />
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
          const fullUrl = `${DOC_BASE_URL}${api.basePath}${ep.path}`;
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
    { Informação: "Exemplo cURL", Valor: `curl -H "x-api-key: SUA_CHAVE" "${DOC_BASE_URL}/contas-pagar-api/query?limit=10"` },
    { Informação: "Rate Limit (API Key)", Valor: "120 requisições/minuto por API key" },
    { Informação: "Rate Limit (JWT)", Valor: "60 requisições/minuto por usuário" },
    { Informação: "Idempotência", Valor: "Header X-Idempotency-Key (UUID) — obrigatório em pagamentos, recomendado em POSTs" },
    { Informação: "Envelope Meta", Valor: "Todas as respostas incluem meta: { request_id, api_version, duration_ms }" },
    { Informação: "Cursor Pagination", Valor: "Param cursor=<uuid> em /query e /pagamentos (alternativa a offset)" },
    { Informação: "Método Alternativo", Valor: "Bearer Token (JWT) via header Authorization" },
    { Informação: "Erro 401", Valor: "API key inválida ou ausente" },
    { Informação: "Erro 429", Valor: "Rate limit excedido — Retry-After: 60" },
    { Informação: "Erro 400", Valor: "Parâmetros inválidos (validação Zod)" },
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
// POSTMAN COLLECTION GENERATOR
// ═══════════════════════════════════════

function generatePostmanCollection(modules: ApiModule[]) {
  const items = modules.flatMap(mod =>
    mod.apis.map(api => ({
      name: `${mod.name} / ${api.name}`,
      item: api.sections.flatMap(section =>
        section.endpoints.map(ep => {
          const fullUrl = `${DOC_BASE_URL}${api.basePath}${ep.path}`;
          const item: any = {
            name: `${ep.method} ${ep.path} — ${ep.description}`,
            request: {
              method: ep.method,
              header: [
                { key: "x-api-key", value: "{{API_KEY}}", type: "text" },
                { key: "Content-Type", value: "application/json", type: "text" },
              ],
              url: { raw: fullUrl, protocol: "https", host: [fullUrl.split("//")[1]?.split("/")[0] || ""], path: fullUrl.split("//")[1]?.split("/").slice(1) || [] },
            },
          };
          if (ep.body) {
            item.request.body = { mode: "raw", raw: ep.body, options: { raw: { language: "json" } } };
          }
          return item;
        })
      ),
    }))
  );

  return {
    info: {
      name: "Huggs API Collection",
      description: "Coleção completa das APIs de integração Huggs/BiMaster",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [{ key: "API_KEY", value: "SUA_CHAVE_AQUI", type: "string" }],
    item: items,
  };
}

// ═══════════════════════════════════════
// OPENAPI 3.0 SPEC GENERATOR
// ═══════════════════════════════════════

function generateOpenAPISpec(modules: ApiModule[]) {
  // ── 40+ Typed Schemas ──
  const schemas: Record<string, any> = {
    // Reutilizáveis
    PaginatedBase: {
      type: "object",
      properties: {
        pagina: { type: "integer", example: 1 },
        total_de_paginas: { type: "integer", example: 3 },
        registros: { type: "integer", example: 50 },
        total_de_registros: { type: "integer", example: 125 },
      },
      required: ["pagina", "total_de_paginas", "registros", "total_de_registros"],
    },
    PaginatedRequest: {
      type: "object",
      properties: {
        pagina: { type: "integer", default: 1 },
        registros_por_pagina: { type: "integer", default: 50 },
      },
    },
    ErrorValidation: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
        details: { type: "object" },
      },
    },
    ErrorAuth: {
      type: "object",
      properties: {
        error: { type: "string", example: "unauthorized" },
        message: { type: "string", example: "API key inválida ou ausente" },
      },
    },
    ErrorRateLimit: {
      type: "object",
      properties: {
        error: { type: "string", example: "rate_limit_exceeded" },
        message: { type: "string", example: "Rate limit excedido" },
        retry_after: { type: "integer", example: 60 },
      },
    },
    MutationResponse: {
      type: "object",
      properties: {
        codigo_status: { type: "string", example: "0" },
        descricao_status: { type: "string" },
      },
      required: ["codigo_status", "descricao_status"],
    },
    LoteResponse: {
      type: "object",
      properties: {
        lote: { type: "integer" },
        codigo_status: { type: "string" },
        descricao_status: { type: "string" },
        processados: { type: "integer" },
        erros: { type: "integer" },
      },
    },
    HealthCheckResponse: {
      type: "object",
      properties: {
        status: { type: "string", example: "online" },
        version: { type: "string", example: "2.4.0" },
        timestamp: { type: "string", format: "date-time" },
        service: { type: "string", example: "contas-pagar-api" },
        health: {
          type: "object",
          properties: {
            db_latency_ms: { type: "integer", example: 12 },
            db_connected: { type: "boolean", example: true },
            active_sync_slots: { type: "integer", example: 3 },
          },
        },
      },
    },
    MetaEnvelope: {
      type: "object",
      description: "Envelope de metadados incluído em todas as respostas",
      properties: {
        request_id: { type: "string", format: "uuid", description: "ID único da requisição" },
        api_version: { type: "string", example: "2.4.0" },
        processed_at: { type: "string", format: "date-time" },
        duration_ms: { type: "integer", example: 45 },
      },
    },
    // PR-21: IdempotencyHeaders removido — orphan irrecuperável (já coberto por
    // components.parameters.IdempotencyKey/RequestId + components.headers.XRequestId).
    ErrorConflict: {
      type: "object",
      properties: {
        error: { type: "string", example: "conflict" },
        message: { type: "string", example: "Registro já existe. Use upsert." },
      },
    },
    // Clientes
    ClienteInput: {
      type: "object",
      required: ["razao_social"],
      description: "PR-21: campo telefone1_ddd removido — runtime clientes-api usa Zod .strict() e só aceita telefone1_numero. Enviar telefone1_ddd causa 400.",
      properties: {
        codigo_cliente_integracao: { type: "string", description: "ID único no ERP externo" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        cnpj_cpf: { type: "string", description: "RECOMENDADO para upsert" },
        email: { type: "string", format: "email" },
        telefone1_numero: { type: "string" },
        endereco: { type: "string" },
        cidade: { type: "string" },
        estado: { type: "string", maxLength: 2 },
        cep: { type: "string" },
      },
    },
    ClienteResponse: {
      type: "object",
      properties: {
        codigo_cliente_huggs: { type: "string", format: "uuid" },
        codigo_cliente_integracao: { type: "string" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        cnpj_cpf: { type: "string" },
        email: { type: "string" },
        pessoa_fisica: { type: "string", enum: ["S", "N"] },
        inativo: { type: "string", enum: ["S", "N"] },
        importado_api: { type: "string", enum: ["S", "N"] },
      },
    },
    ClienteListarRequest: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedRequest" },
        {
          type: "object",
          properties: {
            clientesFiltro: {
              type: "object",
              properties: { razao_social: { type: "string" } },
            },
          },
        },
      ],
    },
    // Contas a Pagar
    ContaPagarInput: {
      type: "object",
      required: ["codigo_lancamento_integracao", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
      properties: {
        codigo_lancamento_integracao: { type: "string", description: "ID único do título no ERP" },
        codigo_cliente_fornecedor: { oneOf: [{ type: "string" }, { type: "integer" }], description: "ID do fornecedor (UUID string ou inteiro legado)" },
        data_vencimento: { type: "string", description: "ISO 8601 (YYYY-MM-DD) preferencial. DD/MM/AAAA aceito por compatibilidade (legado, removido em v4)." },
        valor_documento: { type: "number", minimum: 0.01 },
        codigo_categoria: { type: "string", example: "2.04.01" },
        data_previsao: { type: "string" },
        // PR-23 (v4.4.0): campos fiscais/documentais persistidos pelo handler.
        data_emissao: { type: "string", description: "PR-23: ISO 8601. Era silently dropped antes de v4.4.0." },
        data_entrada: { type: "string", description: "Data de entrada do documento" },
        id_conta_corrente: { oneOf: [{ type: "string" }, { type: "integer" }], description: "ID da conta corrente" },
        numero_documento: { type: "string" },
        numero_documento_fiscal: { type: "string" },
        chave_nfe: { type: "string", minLength: 44, maxLength: 44, description: "Chave de acesso NFe" },
        codigo_tipo_documento: { oneOf: [{ type: "string" }, { type: "integer" }], description: "PR-23: código do tipo de documento" },
        tipo_documento: { type: "string", description: "Ex: NF, Boleto, Duplicata, Recibo" },
        numero_pedido: { oneOf: [{ type: "string" }, { type: "integer" }], description: "PR-23: número do pedido relacionado" },
        parcela: { oneOf: [{ type: "string" }, { type: "integer" }], description: "Número da parcela (ex: 1/3)" },
        observacao: { type: "string", maxLength: 5000 },
        codigo_projeto: { oneOf: [{ type: "string" }, { type: "integer" }], description: "ID do projeto" },
        empresa_id: { oneOf: [{ type: "string" }, { type: "integer" }], description: "Obrigatório para upsert" },
      },
    },
    ContaPagarRelacionados: {
      type: "object",
      description: "PR-23 (v4.4.0): bloco enriquecido com nomes/identificadores das entidades relacionadas (empresa, fornecedor, categoria, departamento, portador, projeto). Evita N+1 lookups no cliente.",
      properties: {
        empresa: { type: "object", nullable: true, properties: { id: { type: "integer" }, nome: { type: "string", nullable: true } } },
        fornecedor: { type: "object", nullable: true, properties: { codigo: { type: "string", nullable: true }, nome: { type: "string", nullable: true }, cnpj: { type: "string", nullable: true } } },
        categoria: { type: "object", nullable: true, properties: { codigo: { type: "string", nullable: true }, nome: { type: "string", nullable: true } } },
        departamento: { type: "object", nullable: true, properties: { id: { type: "string", nullable: true }, nome: { type: "string", nullable: true } } },
        portador: { type: "object", nullable: true, properties: { id: { type: "string", nullable: true }, nome: { type: "string", nullable: true }, codigo: { type: "string", nullable: true } } },
        projeto: { type: "object", nullable: true, properties: { id: { type: "string", nullable: true }, nome: { type: "string", nullable: true } } },
      },
    },
    ContaPagarResponse: {
      type: "object",
      properties: {
        codigo_lancamento_huggs: { type: "integer", nullable: true },
        codigo_lancamento_integracao: { type: "string" },
        codigo_status: { type: "string" },
        descricao_status: { type: "string" },
        // PR-23: meta_relacionados retornado em GET /consultar e GET /query (não no POST de criação).
        meta_relacionados: { $ref: "#/components/schemas/ContaPagarRelacionados" },
      },
    },
    PagamentoInput: {
      type: "object",
      required: ["codigo_lancamento_integracao", "valor", "data"],
      properties: {
        codigo_lancamento_integracao: { type: "string" },
        valor: { type: "number", minimum: 0.01 },
        data: { type: "string", description: "ISO 8601 (YYYY-MM-DD) preferencial. DD/MM/AAAA aceito por compatibilidade (legado, removido em v4)." },
        desconto: { type: "number", default: 0 },
        juros: { type: "number", default: 0 },
        multa: { type: "number", default: 0 },
        observacao: { type: "string" },
        id_conta_corrente: { oneOf: [{ type: "string" }, { type: "integer" }], description: "Se omitido, usa conta padrão da empresa" },
        // PR-23 (v4.4.0): forma_pagamento enum + codigo_pix (paridade com telas do ERP).
        forma_pagamento: { type: "string", enum: ["dinheiro","cheque","pix","boleto","cartao","transferencia","API"], description: "PR-23: enum validado server-side." },
        codigo_pix: { type: "string", maxLength: 255, description: "PR-23: código/chave PIX usada na baixa." },
      },
    },
    PagamentoResponse: {
      type: "object",
      properties: {
        codigo_lancamento_integracao: { type: "string" },
        codigo_baixa: { type: "string" },
        liquidado: { type: "string", enum: ["S", "N"] },
        valor_baixado: { type: "number" },
        codigo_status: { type: "string" },
        descricao_status: { type: "string" },
        // PR-23: enriquecimento em GET /pagamentos.
        forma_pagamento: { type: "string", nullable: true },
        codigo_pix: { type: "string", nullable: true },
        usuario_id: { type: "string", nullable: true, description: "PR-23: UUID do usuário que registrou a baixa." },
        usuario_nome: { type: "string", nullable: true, description: "PR-23: nome do usuário (JOIN profiles)." },
        conta_corrente: { type: "object", nullable: true, description: "PR-23: JOIN contas_bancarias (apresenta banco/agencia/conta agrupados).", properties: { id: { type: "string" }, nome: { type: "string", nullable: true }, banco: { type: "string", nullable: true } } },
      },
    },
    // Contas a Receber
    ContaReceberInput: {
      type: "object",
      required: ["codigo_lancamento_integracao", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
      properties: {
        codigo_lancamento_integracao: { type: "string" },
        codigo_cliente_fornecedor: { oneOf: [{ type: "string" }, { type: "integer" }] },
        data_vencimento: { type: "string" },
        valor_documento: { type: "number", minimum: 0.01 },
        codigo_categoria: { type: "string" },
        data_previsao: { type: "string" },
        id_conta_corrente: { oneOf: [{ type: "string" }, { type: "integer" }] },
        numero_documento: { type: "string" },
        observacao: { type: "string" },
        numero_pedido: { type: "string" },
        numero_contrato: { type: "string" },
        numero_ordem_servico: { type: "string" },
        empresa_id: { oneOf: [{ type: "string" }, { type: "integer" }] },
      },
    },
    RecebimentoInput: {
      type: "object",
      required: ["codigo_lancamento_integracao", "valor", "data"],
      properties: {
        codigo_lancamento_integracao: { type: "string" },
        valor: { type: "number", minimum: 0.01 },
        data: { type: "string" },
        desconto: { type: "number", default: 0 },
        juros: { type: "number", default: 0 },
        multa: { type: "number", default: 0 },
        observacao: { type: "string" },
        id_conta_corrente: { oneOf: [{ type: "string" }, { type: "integer" }] },
      },
    },
    // Empresas
    EmpresaInput: {
      type: "object",
      required: ["razao_social"],
      description: "PR-20: paridade total com SDK TS e runtime — 7 campos adicionados (responsavel_nome, responsavel_cpf, capital_social, data_abertura, regime_tributario, codigo_ibge_municipio, natureza_juridica).",
      properties: {
        razao_social: { type: "string" },
        cnpj: { type: "string", description: "RECOMENDADO: sem CNPJ a empresa fica em estado parcial" },
        nome_fantasia: { type: "string" },
        codigo_empresa_integracao: { type: "string" },
        codigo_erp: { type: "string", description: "Código no ERP externo (espelha SDK)" },
        regime_apuracao: { type: "string", enum: ["Competência", "Caixa"], description: "RECOMENDADO: afeta DRE" },
        tipo_empresa: { type: "string", enum: ["Matriz", "Filial", "Coligada"] },
        porte: { type: "string", enum: ["ME", "EPP", "Demais"] },
        natureza_juridica: { type: "string", description: "Descrição da natureza jurídica (ex: 'LTDA', 'EIRELI', 'S.A.')" },
        capital_social: { type: "number", description: "Valor do capital social em BRL" },
        data_abertura: { type: "string", format: "date", description: "Data de abertura ISO (YYYY-MM-DD)" },
        codigo_ibge_municipio: { type: "integer", description: "Código IBGE de 7 dígitos do município" },
        responsavel_nome: { type: "string", description: "Nome do responsável legal" },
        responsavel_cpf: { type: "string", description: "CPF do responsável legal (apenas dígitos)" },
        regime_tributario: { type: "string", maxLength: 1, description: "Código fiscal varchar(1) — 1=Simples Nacional, 2=SN-Excesso, 3=Lucro Presumido, 4=Lucro Real" },
        inscricao_estadual: { type: "string" },
        inscricao_municipal: { type: "string" },
        endereco: { type: "string" },
        endereco_numero: { type: "string", description: "PR-21: número do endereço (paridade com SDK TS e runtime)" },
        complemento: { type: "string" },
        bairro: { type: "string" },
        cidade: { type: "string" },
        estado: { type: "string", maxLength: 2 },
        cep: { type: "string" },
        email: { type: "string", format: "email" },
        telefone1_ddd: { type: "string" },
        telefone1_numero: { type: "string" },
      },
    },
    EmpresaResponse: {
      type: "object",
      properties: {
        codigo_empresa: { type: "integer" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        cnpj: { type: "string" },
        codigo_status: { type: "string" },
        descricao_status: { type: "string" },
      },
    },
    // Fornecedores (PR-19: FornecedorQuery removido — schema órfão sem $ref)
    FornecedorSyncInput: {
      type: "object",
      required: ["cnpj_cpf", "razao_social"],
      properties: {
        cnpj_cpf: { type: "string" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        codigo_integracao: { type: "string" },
        email: { type: "string" },
        telefone: { type: "string" },
        endereco: { type: "string" },
        cidade: { type: "string" },
        estado: { type: "string", maxLength: 2 },
        cep: { type: "string", maxLength: 8 },
        inscricao_estadual: { type: "string" },
        empresa_ids: { type: "array", items: { type: "integer" }, description: "RECOMENDADO: vincular a pelo menos uma empresa" },
      },
    },
    // Contas Correntes
    ContaCorrenteInput: {
      type: "object",
      required: ["descricao"],
      description: "PR-21: schema completo (10 campos canônicos do runtime). Campos legados agencia/conta removidos — runtime contas-correntes-api ignora.",
      properties: {
        cCodCCInt: { type: "string", description: "Código de integração — chave para upsert/consultar/excluir" },
        descricao: { type: "string" },
        tipo_conta_corrente: { type: "string", enum: ["CC", "CP", "CX", "CI", "CM", "PI"], description: "CC=Corrente, CP=Poupança, CX=Caixa, CI=Investimento, CM=Cartão, PI=PIX" },
        codigo_banco: { type: "string", description: "Código COMPE do banco (ex: '341' Itaú, '237' Bradesco)" },
        codigo_agencia: { type: "string", description: "Número da agência (sem dígito)" },
        numero_conta_corrente: { type: "string", description: "Número da conta com dígito (ex: '56789-0')" },
        saldo_inicial: { type: "number", default: 0 },
        valor_limite: { type: "number", description: "Limite disponível (cheque especial / cartão)" },
        pix_sn: { type: "string", enum: ["S", "N"], description: "Conta habilitada para PIX" },
        bol_sn: { type: "string", enum: ["S", "N"], description: "Conta habilitada para emissão de boletos" },
      },
    },
    // PR-19: ContaCorrenteResponse removido — schema órfão sem $ref
    // Boletos
    BoletoGerarInput: {
      type: "object",
      required: ["conta_receber_id"],
      properties: {
        conta_receber_id: { type: "string", format: "uuid" },
      },
    },
    BoletoResponse: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        conta_receber_id: { type: "string" },
        status: { type: "string" },
        url_boleto: { type: "string", format: "uri" },
        linha_digitavel: { type: "string" },
        valor: { type: "number" },
        vencimento: { type: "string", format: "date" },
      },
    },
    // Categorias
    CategoriaInput: {
      type: "object",
      required: ["codigo_categoria", "descricao", "tipo"],
      properties: {
        codigo_categoria: { type: "string", example: "2.04.01", description: "Código hierárquico" },
        descricao: { type: "string" },
        tipo: { type: "string", enum: ["receita", "despesa"] },
        categoria_pai: { type: "string" },
      },
    },
    // Projetos
    ProjetoInput: {
      type: "object",
      required: ["nome"],
      properties: {
        codInt: { type: "string", description: "Código de integração" },
        nome: { type: "string" },
      },
    },
    ProjetoResponse: {
      type: "object",
      properties: {
        codigo: { type: "string", format: "uuid" },
        codInt: { type: "string" },
        nome: { type: "string" },
        inativo: { type: "string", enum: ["S", "N"] },
      },
    },
    // Departamentos
    DepartamentoInput: {
      type: "object",
      required: ["descricao"],
      properties: {
        codigo_departamento_integracao: { type: "string" },
        descricao: { type: "string" },
      },
    },
    // Webhooks
    WebhookSubscribeInput: {
      type: "object",
      required: ["url", "eventos"],
      description: "PR-19: campo é 'eventos' (PT). Runtime rejeita 'events'. SDKs alinhados a partir do v3.2.3.",
      properties: {
        url: { type: "string", format: "uri" },
        eventos: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "conta_pagar.criado", "conta_pagar.alterado", "conta_pagar.excluido", "conta_pagar.pago",
              "conta_receber.criado", "conta_receber.alterado", "conta_receber.recebido",
              "cliente.criado", "cliente.alterado",
              "fornecedor.criado", "fornecedor.alterado",
            ],
          },
        },
        secret: { type: "string", description: "RECOMENDADO: habilita HMAC-SHA256 no header x-hub-signature-256" },
        empresa_id: { oneOf: [{ type: "string" }, { type: "integer" }], description: "ID da empresa dona da subscription (obrigatório no runtime)" },
        descricao: { type: "string", description: "Descrição livre da assinatura" },
        max_retries: { type: "integer", default: 3, description: "Tentativas máximas em caso de falha" },
        headers_customizados: { type: "object", additionalProperties: { type: "string" } },
      },
    },
    WebhookSubscriptionResponse: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        url: { type: "string" },
        eventos: { type: "array", items: { type: "string" } },
        status: { type: "string" },
        created_at: { type: "string", format: "date-time" },
      },
    },
    // PR-19: PaisResponse, CidadeResponse, BancoResponse, ExportPendingResponse,
    // ExportConfirmInput removidos — schemas órfãos sem $ref ativo na spec.
    // Lançamentos CC
    LancamentoCCInput: {
      type: "object",
      required: ["cCodIntLanc", "nCodCC", "valor", "data"],
      properties: {
        cCodIntLanc: { type: "string" },
        nCodCC: { type: "integer" },
        valor: { type: "number" },
        data: { type: "string" },
        observacao: { type: "string" },
        nCodCateg: { type: "string" },
      },
    },
  };

  // ── Path → Schema mapping ──
  const PATH_SCHEMA_MAP: Record<string, { req?: string; res?: string; is201?: boolean }> = {
    // Clientes
    "POST:/clientes-api/incluir": { req: "ClienteInput", res: "MutationResponse", is201: true },
    "POST:/clientes-api/alterar": { req: "ClienteInput", res: "MutationResponse" },
    "POST:/clientes-api/upsert": { req: "ClienteInput", res: "MutationResponse", is201: true },
    "POST:/clientes-api/consultar": { res: "ClienteResponse" },
    "POST:/clientes-api/listar": { req: "ClienteListarRequest" },
    "POST:/clientes-api/listar-resumido": { req: "PaginatedRequest" },
    "POST:/clientes-api/sync": { req: "ClienteInput", res: "MutationResponse" },
    // CP (v4.0.0: /alterar e /cancelar-pagamento removidos)
    "POST:/contas-pagar-api/incluir": { req: "ContaPagarInput", res: "ContaPagarResponse", is201: true },
    "DELETE:/contas-pagar-api/excluir": { res: "MutationResponse" },
    "POST:/contas-pagar-api/upsert": { req: "ContaPagarInput", res: "ContaPagarResponse", is201: true },
    "POST:/contas-pagar-api/upsert-lote": { res: "LoteResponse" },
    "POST:/contas-pagar-api/lancar-pagamento": { req: "PagamentoInput", res: "PagamentoResponse" },
    // CR (v4.0.0: /alterar e /cancelar-recebimento removidos; PR-17: /query, /parcelas, /recebimentos adicionados)
    "POST:/contas-receber-api/incluir": { req: "ContaReceberInput", res: "ContaPagarResponse", is201: true },
    "DELETE:/contas-receber-api/excluir": { res: "MutationResponse" },
    "POST:/contas-receber-api/upsert": { req: "ContaReceberInput", res: "MutationResponse", is201: true },
    "POST:/contas-receber-api/lancar-recebimento": { req: "RecebimentoInput", res: "PagamentoResponse" },
    "GET:/contas-receber-api/query": { res: "PaginatedResponse" },
    "GET:/contas-receber-api/parcelas": { res: "PaginatedResponse" },
    "GET:/contas-receber-api/recebimentos": { res: "PaginatedResponse" },
    // Empresas
    "POST:/empresas-api/incluir": { req: "EmpresaInput", res: "EmpresaResponse", is201: true },
    "POST:/empresas-api/alterar": { req: "EmpresaInput", res: "EmpresaResponse" },
    "POST:/empresas-api/consultar": { res: "EmpresaResponse" },
    "POST:/empresas-api/listar": { req: "PaginatedRequest" },
    // Fornecedores (PR-17: /check e /sync documentados — já existem como rotas)
    "POST:/erp-fornecedores-sync/incluir": { req: "FornecedorSyncInput", res: "MutationResponse", is201: true },
    "POST:/erp-fornecedores-sync/cadastrar": { req: "FornecedorSyncInput", res: "MutationResponse", is201: true },
    "POST:/erp-fornecedores-sync/alterar": { req: "FornecedorSyncInput", res: "MutationResponse" },
    "POST:/erp-fornecedores-sync/upsert": { req: "FornecedorSyncInput", res: "MutationResponse", is201: true },
    "POST:/erp-fornecedores-sync/listar": { req: "PaginatedRequest" },
    "POST:/erp-fornecedores-sync/consultar": { },
    "POST:/erp-fornecedores-sync/check": { res: "MutationResponse" },
    "POST:/erp-fornecedores-sync/sync": { req: "FornecedorSyncInput", res: "MutationResponse" },
    "POST:/erp-fornecedores-sync/sync-bidirecional": { res: "MutationResponse" },
    "POST:/erp-fornecedores-sync/cadastrar-todas": { res: "LoteResponse" },
    // Contas Correntes
    "POST:/contas-correntes-api/incluir": { req: "ContaCorrenteInput", res: "MutationResponse", is201: true },
    "POST:/contas-correntes-api/upsert-lote": { res: "LoteResponse" },
    // Boletos
    "POST:/boletos-api/gerar": { req: "BoletoGerarInput", res: "BoletoResponse", is201: true },
    // Categorias
    "POST:/categorias-api/incluir": { req: "CategoriaInput", res: "MutationResponse", is201: true },
    "POST:/categorias-api/listar": { req: "PaginatedRequest" },
    // Projetos
    "POST:/projetos-api/incluir": { req: "ProjetoInput", res: "ProjetoResponse", is201: true },
    "POST:/projetos-api/alterar": { req: "ProjetoInput", res: "MutationResponse" },
    "POST:/projetos-api/consultar": { res: "ProjetoResponse" },
    "POST:/projetos-api/listar": { req: "PaginatedRequest" },
    // Departamentos
    "POST:/departamentos-api/incluir": { req: "DepartamentoInput", res: "MutationResponse", is201: true },
    "POST:/departamentos-api/alterar": { req: "DepartamentoInput", res: "MutationResponse" },
    "POST:/departamentos-api/listar": { req: "PaginatedRequest" },
    // Webhooks
    "POST:/webhook-subscriptions-api/incluir": { req: "WebhookSubscribeInput", res: "WebhookSubscriptionResponse", is201: true },
    // Lançamentos CC
    "POST:/lancamentos-cc-api/incluir": { req: "LancamentoCCInput", res: "MutationResponse", is201: true },
    "PUT:/lancamentos-cc-api/alterar": { req: "LancamentoCCInput", res: "MutationResponse" },
    "POST:/lancamentos-cc-api/upsert": { req: "LancamentoCCInput", res: "MutationResponse", is201: true },
    "POST:/lancamentos-cc-api/upsert-lote": { res: "LoteResponse" },
  };

  // ── Legacy field patterns ──
  const LEGACY_PATHS = [
    "/tipos-entrega-api/",
    "/lancamentos-cc-api/",
  ];

  // ── Tags ──
  const tags = [
    { name: "Geral / Clientes", description: "Cadastro e gestão de clientes (21 endpoints)" },
    { name: "Geral / Empresas", description: "Cadastro multi-empresa (5 endpoints)" },
    { name: "Geral / Projetos", description: "Gestão de projetos e centros de resultado (7 endpoints)" },
    { name: "Finanças / Contas a Pagar", description: "Títulos, pagamentos, parcelas e anexos (19 endpoints)" },
    { name: "Finanças / Contas a Receber", description: "Títulos, recebimentos e conciliação (12 endpoints)" },
    { name: "Finanças / Contas Correntes", description: "Cadastro e gestão de contas bancárias (9 endpoints)" },
    { name: "Finanças / Boletos", description: "Geração, consulta e gestão de boletos (6 endpoints)" },
    { name: "Finanças / Lançamentos CC", description: "Lançamentos em conta corrente e extratos (9 endpoints)" },
    { name: "Finanças / Exportação ERP (Pull)", description: "Exportação de dados para ERP externo (10 endpoints)" },
    { name: "Finanças / Exportação ERP (Push)", description: "Push de pagamentos para ERP (1 endpoint)" },
    { name: "Finanças / Resumo Financeiro", description: "Dashboards e relatórios financeiros (5 endpoints)" },
    { name: "Finanças / Orçamentos de Caixa", description: "Previsão de fluxo de caixa (4 endpoints)" },
    { name: "Finanças / Movimentos Financeiros", description: "Extrato consolidado (2 endpoints)" },
    { name: "Finanças / Pesquisar Lançamentos", description: "Busca unificada de lançamentos (2 endpoints)" },
    { name: "Cadastros Auxiliares / Fornecedores (Consulta)", description: "Consulta de fornecedores ativos (1 endpoint)" },
    { name: "Cadastros Auxiliares / Fornecedores (Sync)", description: "Sincronização bidirecional de fornecedores (4 endpoints)" },
    { name: "Cadastros Auxiliares / Categorias", description: "Categorias financeiras (7 endpoints)" },
    { name: "Cadastros Auxiliares / Departamentos", description: "Centros de custo (6 endpoints)" },
    { name: "Cadastros Auxiliares / Bancos", description: "Tabela de bancos COMPE (3 endpoints)" },
    { name: "Cadastros Auxiliares / Plano de Contas", description: "Estrutura contábil (1 endpoint)" },
    { name: "Cadastros Auxiliares / Portadores", description: "Contas bancárias para pagamento (2 endpoints)" },
    { name: "Cadastros Auxiliares / Parcelas", description: "Gestão de parcelas (3 endpoints)" },
    { name: "Cadastros Auxiliares / Tipos de Documento", description: "Tipos de documento fiscal (3 endpoints)" },
    { name: "Cadastros Auxiliares / Tipos de Entrega", description: "Tipos de entrega (6 endpoints)" },
    { name: "Cadastros Auxiliares / Tipos de Atividade", description: "Classificação de atividade (2 endpoints)" },
    { name: "Cadastros Auxiliares / Tipos de Anexo", description: "Tipos de anexo (2 endpoints)" },
    { name: "Cadastros Auxiliares / Finalidades de Transferência", description: "Finalidades bancárias (3 endpoints)" },
    { name: "Dados Complementares / Anexos", description: "Upload e gestão de anexos (6 endpoints)" },
    { name: "Dados Complementares / Webhook Subscriptions", description: "Assinaturas de webhook (8 endpoints)" },
    { name: "Dados Complementares / Webhook Dispatcher", description: "Processamento de fila de webhooks (4 endpoints)" },
    { name: "Dados Complementares / Webhook Inbound", description: "Recepção de webhooks externos (1 endpoint)" },
    { name: "Tabelas de Referência / Países", description: "Lista estática de países (2 endpoints)" },
    { name: "Tabelas de Referência / Cidades", description: "Lista de cidades (2 endpoints)" },
    { name: "Tabelas de Referência / CNAE", description: "Classificação Nacional de Atividades (2 endpoints)" },
    { name: "Tabelas de Referência / Bandeiras de Cartão", description: "Bandeiras de cartão (2 endpoints)" },
    { name: "Tabelas de Referência / Origens de Lançamento", description: "Origens de lançamento (2 endpoints)" },
  ];

  // ── operationId generator (PR-19: method-aware on collision + camelCase puro) ──
  function toOperationId(fullPath: string, method: string): string {
    const cleanPath = fullPath.replace(DOC_BASE_URL, "").replace(/^\//, "");
    const parts = cleanPath.split("/").filter(Boolean);
    const apiName = (parts[0] || "").replace(/-api$/, "").replace(/-/g, "_");
    let action = parts.slice(1).join("_").replace(/-/g, "_") || "root";
    const moduleMap: Record<string, string> = {
      contas_pagar: "cp", contas_receber: "cr", contas_correntes: "cc",
      contas_pagar_export: "cpExport",
      erp_fornecedores_sync: "fornecedoresSync", erp_fornecedores_query: "fornecedoresQuery",
      erp_plano_contas: "planoContas", erp_portadores: "portadores",
      erp_webhook_callbacks: "webhookCallbacks",
      webhook_subscriptions: "webhookSub", webhook_dispatcher: "webhookDispatch",
      lancamentos_cc: "lancCC", tipos_entrega: "tiposEntrega", tipos_documento: "tiposDoc",
      tipos_atividade: "tiposAtiv", tipos_anexo: "tiposAnexo",
      finalidades_transferencia: "finalidadesTransf", plano_contas: "planoContas",
      bandeiras_cartao: "bandeirasCartao",
      resumo_financeiro: "resumoFinanceiro",
      pesquisar_lancamentos: "pesquisarLanc",
      movimentos_financeiros: "movFin",
      tabela_de_titulos: "tabelaTitulos",
    };
    // Sanitize prefix: any residual snake_case → camelCase (zero underscores invariant)
    const rawPrefix = moduleMap[apiName] || apiName;
    const prefix = rawPrefix.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    // Action 'root' → verb derived from method (avoid literal "Root")
    if (action === "root") {
      const M = method.toUpperCase();
      action = M === "GET" ? "listar" : M === "POST" ? "criar" : M === "PUT" ? "alterar" : M === "DELETE" ? "excluir" : "root";
    }
    const camel = action.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    return `${prefix}${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
  }

  // PR-19: method → semantic suffix for collision resolution
  const COLLISION_SUFFIX: Record<string, string> = {
    GET: "Listar", POST: "Incluir", PUT: "Alterar", PATCH: "Alterar", DELETE: "Excluir",
  };

  // ── Standard error responses (use shared refs from components.responses) ──
  const stdErrors: Record<string, any> = {
    "400": { $ref: "#/components/responses/ErrorBadRequest" },
    "401": { $ref: "#/components/responses/ErrorUnauthorized" },
    "429": { $ref: "#/components/responses/ErrorRateLimited" },
  };

  const conflictResponse = {
    description: "Conflito — registro duplicado",
    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorConflict" } } },
  };

  // ── Write methods accept Idempotency-Key + Request-Id ──
  const isWriteOp = (m: string, path: string) => {
    const M = m.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(M)) return false;
    return !/\/(listar|consultar|status|pesquisar|exportar|relatorio)/i.test(path);
  };

  // ── Fallback schema inference by pattern ──
  function inferResponseSchema(path: string, method: string): string | undefined {
    if (path.endsWith("/status")) return "HealthCheckResponse";
    if (path.includes("/upsert-lote")) return "LoteResponse";
    if (path.includes("/incluir") || path.includes("/cadastrar") || path.includes("/alterar") || path.includes("/excluir") || path.includes("/upsert")) return "MutationResponse";
    if (path.includes("/lancar-pagamento") || path.includes("/lancar-recebimento")) return "PagamentoResponse";
    if (path.includes("/cancelar-pagamento") || path.includes("/cancelar-recebimento")) return "MutationResponse";
    if (path.includes("/gerar") && path.includes("boleto")) return "BoletoResponse";
    // listar endpoints get PaginatedBase
    if (path.includes("/listar") || path.includes("/listar-resumido")) return "PaginatedBase";
    if (path.includes("/consultar")) {
      if (path.includes("clientes")) return "ClienteResponse";
      if (path.includes("empresas")) return "EmpresaResponse";
      if (path.includes("projetos")) return "ProjetoResponse";
      if (path.includes("lancamentos-cc")) return "LancamentoCCInput";
      // PR-19: portadores antes mapeava para ContaCorrenteResponse (órfão removido)
    }
    return undefined;
  }

  function inferRequestSchema(path: string, method: string): string | undefined {
    if (method === "GET" || method === "DELETE") return undefined;
    if (path.includes("/listar") || path.includes("/listar-resumido")) return "PaginatedRequest";
    if (path.includes("clientes") && (path.includes("/incluir") || path.includes("/upsert") || path.includes("/sync"))) return "ClienteInput";
    if (path.includes("contas-pagar") && path.includes("/incluir")) return "ContaPagarInput";
    if (path.includes("contas-receber") && path.includes("/incluir")) return "ContaReceberInput";
    if (path.includes("empresas") && path.includes("/incluir")) return "EmpresaInput";
    if (path.includes("fornecedores") && (path.includes("/incluir") || path.includes("/cadastrar") || path.includes("/upsert"))) return "FornecedorSyncInput";
    if (path.includes("categorias") && path.includes("/incluir")) return "CategoriaInput";
    if (path.includes("departamentos") && path.includes("/incluir")) return "DepartamentoInput";
    if (path.includes("projetos") && (path.includes("/incluir") || path.includes("/alterar"))) return "ProjetoInput";
    if (path.includes("webhook") && path.includes("/incluir")) return "WebhookSubscribeInput";
    if (path.includes("lancamentos-cc") && (path.includes("/incluir") || path.includes("/upsert") || path.includes("/alterar"))) return "LancamentoCCInput";
    if (path.includes("boletos") && path.includes("/gerar")) return "BoletoGerarInput";
    if (path.includes("contas-correntes") && path.includes("/incluir")) return "ContaCorrenteInput";
    if (path.includes("/lancar-pagamento")) return "PagamentoInput";
    if (path.includes("/lancar-recebimento")) return "RecebimentoInput";
    return undefined;
  }

  // ── Legacy field description helper ──
  const LEGACY_FIELD_DESCRIPTIONS: Record<string, string> = {
    nPagina: "LEGADO: será migrado para 'pagina' em versão futura",
    nTotPaginas: "LEGADO: será migrado para 'total_de_paginas' em versão futura",
    nTotalPaginas: "LEGADO: será migrado para 'total_de_paginas' em versão futura",
    nRegistros: "LEGADO: será migrado para 'registros' em versão futura",
    nTotalRegistros: "LEGADO: será migrado para 'total_de_registros' em versão futura",
    nTotRegistros: "LEGADO: será migrado para 'total_de_registros' em versão futura",
    nRegistrosPorPagina: "LEGADO: será migrado para 'registros_por_pagina' em versão futura",
    nRegPorPagina: "LEGADO: será migrado para 'registros_por_pagina' em versão futura",
    cCodStatus: "LEGADO: será migrado para 'codigo_status' em versão futura",
    cDesStatus: "LEGADO: será migrado para 'descricao_status' em versão futura",
    nCodEntrega: "LEGADO: será migrado para 'codigo_entrega' em versão futura",
    cCodIntEntrega: "LEGADO: será migrado para 'codigo_entrega_integracao' em versão futura",
  };

  // Annotate legacy fields in example objects
  function annotateLegacyFields(example: any): any {
    if (!example || typeof example !== "object") return example;
    for (const key of Object.keys(example)) {
      if (LEGACY_FIELD_DESCRIPTIONS[key] && typeof example[key] !== "object") {
        // Mark with x-legacy in the containing structure
      }
    }
    return example;
  }

  // ── Build paths ──
  const paths: Record<string, any> = {};

  for (const mod of modules) {
    for (const api of mod.apis) {
      for (const section of api.sections) {
        for (const ep of section.endpoints) {
          // PR-18: trim trailing slash em raízes de módulo (ep.path === "/" ? api.basePath : ...)
          const fullPath = ep.path === "/" ? api.basePath : `${api.basePath}${ep.path}`;
          if (!paths[fullPath]) paths[fullPath] = {};

          const method = ep.method.toLowerCase();
          const mapKey = `${ep.method.toUpperCase()}:${ep.path}`;
          const schemaMapping = PATH_SCHEMA_MAP[mapKey];
          const isStatusEndpoint = ep.path.endsWith("/status");
          const isCreationEndpoint = ep.path.endsWith("/incluir") || ep.path.endsWith("/cadastrar") || ep.path.endsWith("/gerar");
          const isLegacy = LEGACY_PATHS.some(lp => fullPath.includes(lp));

          // Parse example safely — convert string JSON to object
          const parseExample = (str: string | undefined) => {
            if (!str) return undefined;
            if (typeof str === "object") return str;
            try {
              // Sanitize common shorthand patterns that break JSON.parse
              const sanitized = str
                .replace(/\[\.\.\.\]/g, "[]")        // [...] → []
                .replace(/\{\.\.\.\}/g, "{}")         // {...} → {}
                .replace(/,\s*\.\.\.\s*\}/g, " }");  // , ... } → }
              return JSON.parse(sanitized);
            } catch { return str; }
          };

          const responseExample = annotateLegacyFields(parseExample(ep.response));
          const successCode = schemaMapping?.is201 ? "201" : "200";

          // Determine response schema: explicit mapping > fallback inference
          const resSchemaName = isStatusEndpoint
            ? "HealthCheckResponse"
            : (schemaMapping?.res || inferResponseSchema(fullPath, ep.method.toUpperCase()));

          // Build response content
          const successContent: any = {};
          if (resSchemaName) {
            // PR-21: wire MetaEnvelope via allOf em endpoints CP/CR
            const isCpCr = fullPath.startsWith("/contas-pagar-api/") || fullPath.startsWith("/contas-receber-api/");
            const baseRef = { $ref: `#/components/schemas/${resSchemaName}` };
            successContent.schema = isCpCr
              ? { allOf: [baseRef, { type: "object", properties: { meta: { $ref: "#/components/schemas/MetaEnvelope" } } }] }
              : baseRef;
          }
          if (responseExample) {
            successContent.example = responseExample;
          }

          // v3.9.1 — universal headers em toda response 2xx (X-Request-ID + RateLimit-*)
          const baseSuccessHeaders: Record<string, any> = {
            "X-Request-ID": { $ref: "#/components/headers/XRequestId" },
            "RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
            "RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
            "RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
          };
          // v3.9.1 — GETs cacheáveis (/listar, /consultar, /status) ganham ETag em 200 + response 304
          const isCacheable = ep.method.toUpperCase() === "GET"
            && (ep.path.endsWith("/listar") || ep.path.endsWith("/consultar") || ep.path.endsWith("/status"));
          if (isCacheable) {
            baseSuccessHeaders["ETag"] = { $ref: "#/components/headers/ETag" };
          }
          // v3.9.1 — endpoints deprecated documentam Deprecation + Sunset nas 2xx
          if ((ep as any).deprecated) {
            baseSuccessHeaders["Deprecation"] = { $ref: "#/components/headers/Deprecation" };
            baseSuccessHeaders["Sunset"] = { $ref: "#/components/headers/Sunset" };
          }

          const responses: Record<string, any> = {
            [successCode]: {
              description: "Sucesso",
              headers: baseSuccessHeaders,
              content: Object.keys(successContent).length > 0 ? { "application/json": successContent } : undefined,
            },
            ...stdErrors,
          };

          if (isCreationEndpoint || schemaMapping?.is201) {
            responses["409"] = conflictResponse;
          }

          // v3.9.1 — response 304 NotModified em GETs cacheáveis (If-None-Match casa)
          if (isCacheable) {
            responses["304"] = { $ref: "#/components/responses/NotModified" };
          }

          const operation: any = {
            operationId: toOperationId(fullPath, method),
            summary: ep.description,
            tags: [`${mod.name} / ${api.name}`],
            security: isStatusEndpoint ? [] : [{ ApiKeyAuth: [] }],
            responses,
          };

          if (isLegacy) {
            operation["x-legacy"] = true;
            operation["x-legacy-note"] = "LEGADO: campos nPagina/cCodStatus serão migrados para padrão Huggs em versão futura";
          }

          // v2.14.0: deprecation real no OpenAPI — paths legados ganham deprecated:true + x-sunset
          if ((ep as any).deprecated) {
            operation.deprecated = true;
            operation["x-sunset"] = (ep as any).xSunset || "2026-09-30";
            if ((ep as any).xReplacement) {
              operation["x-deprecation-replacement"] = (ep as any).xReplacement;
            }
          }

          // Build parameters: query params + idempotency/correlation headers for writes
          const parameters: any[] = [];
          if (ep.params && ep.params.length > 0) {
            for (const p of ep.params) {
              parameters.push({
                name: p.name,
                in: "query",
                required: p.required,
                description: p.description,
                schema: { type: p.type === "integer" || p.type === "number" ? "integer" : "string" },
              });
            }
          }
          if (!isStatusEndpoint && isWriteOp(ep.method, ep.path)) {
            parameters.push({ $ref: "#/components/parameters/IdempotencyKey" });
            parameters.push({ $ref: "#/components/parameters/RequestId" });
          }
          if (parameters.length > 0) {
            operation.parameters = parameters;
          }

          // Determine request schema: explicit mapping > fallback inference
          const reqSchemaName = schemaMapping?.req || inferRequestSchema(fullPath, ep.method.toUpperCase());

          if (ep.body || reqSchemaName) {
            const bodyContent: any = {};
            if (reqSchemaName) {
              bodyContent.schema = { $ref: `#/components/schemas/${reqSchemaName}` };
            }
            const bodyExample = parseExample(ep.body);
            if (bodyExample) {
              bodyContent.example = bodyExample;
            }
            operation.requestBody = {
              required: true,
              content: { "application/json": bodyContent },
            };
          }

          paths[fullPath][method] = operation;
        }
      }
    }
  }

  // PR-19: pós-processo — resolver colisões de operationId (ex: GET+POST /anexos = cpAnexos)
  // Estratégia: agrupar por operationId; para grupos com >1 entry, anexar sufixo
  // semântico do método (Listar/Incluir/Alterar/Excluir). Mantém IDs únicos atuais intactos.
  {
    const idToOps: Record<string, Array<{ pathKey: string; methodKey: string; op: any }>> = {};
    for (const pathKey of Object.keys(paths)) {
      for (const methodKey of Object.keys(paths[pathKey])) {
        const op = paths[pathKey][methodKey];
        if (!op?.operationId) continue;
        (idToOps[op.operationId] ||= []).push({ pathKey, methodKey, op });
      }
    }
    for (const [opId, entries] of Object.entries(idToOps)) {
      if (entries.length < 2) continue;
      for (const e of entries) {
        const suffix = COLLISION_SUFFIX[e.methodKey.toUpperCase()] || e.methodKey.toUpperCase();
        e.op.operationId = `${opId}${suffix}`;
      }
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Huggs ERP Integration API",
      version: "4.4.1",
      description: [
        "API completa de integração financeira BiMaster/Huggs. 185 endpoints em 27 módulos.",
        "",
        "## Autenticação",
        "Header obrigatório `x-api-key` em todas as chamadas (chave gerada no Portal de Integração ERP).",
        "",
        "## Idempotência",
        "Operações de escrita (POST/PUT) aceitam o header `X-Idempotency-Key` (UUID v4 recomendado).",
        "Requisições repetidas com a mesma chave dentro de 24h retornam a resposta original sem reprocessar.",
        "**Strongly recommended**: enviar `X-Idempotency-Key` em todos os endpoints financeiros — `/lancar-pagamento`, `/lancar-recebimento`, `/upsert`, `/upsert-lote` (CP e CR) — para evitar processamento duplicado em caso de timeout. SDKs oficiais expõem `retry=True` + `idempotency_key` derivada (ex: `f\"cp-pag-{codigo}-{valor}\"`).",
        "",
        "## Datas",
        "Padrão de saída: ISO 8601 (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ssZ`).",
        "Padrão de entrada: ISO 8601 preferencial. `DD/MM/AAAA` ainda aceito por compatibilidade (legado, será removido em v4).",
        "",
        "## Rate Limits",
        "- Operações de leitura (GET, /listar, /consultar): **120 req/min** por chave.",
        "- Operações de escrita (POST/PUT/DELETE): **60 req/min** por chave.",
        "- Operações em lote (`/incluir-lote`, `/upsert-lote`): **20 req/min** por chave, máx. 500 itens por requisição.",
        "Resposta 429 inclui header `Retry-After` (segundos).",
        "",
        "## Webhooks (HMAC)",
        "Eventos enviados ao endpoint cadastrado incluem os headers:",
        "- `X-Webhook-Event`: nome do evento (ex: `conta_pagar.criado`)",
        "- `X-Webhook-Signature`: `sha256=<hex>` — HMAC-SHA256 do **corpo bruto** (UTF-8) usando o `secret` da subscription como chave",
        "- `X-Webhook-Timestamp`: epoch UNIX em segundos (rejeitar se diferença > 5 min)",
        "- `X-Webhook-ID`: UUID único do evento (use para idempotência no consumidor)",
        "",
        "Validação de exemplo (Node.js):",
        "```js",
        "const crypto = require('crypto');",
        "const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');",
        "const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-webhook-signature']));",
        "```",
        "",
        "## Status de Negócio",
        "Respostas HTTP 200 podem conter `codigo_status` indicando erro de negócio.",
        "`codigo_status === '0'` significa sucesso. Qualquer outro valor é falha — os SDKs oficiais lançam `HuggsBusinessError` automaticamente.",
        "",
        "## Correlação",
        "Todas as respostas incluem header `X-Request-ID` (UUID) — guarde para suporte e rastreamento de logs.",
        "",
        "## Política `required` em responses (PR-19)",
        "Campos de response são documentados como **opcionais** no spec para forward-compatibility. Os SDKs oficiais tipam-nos como obrigatórios com base nas garantias atuais do runtime — clientes gerados a partir do OpenAPI devem aplicar a mesma política se quiserem tipos estritos.",
        "",
        "## Envelope `meta` (PR-20)",
        "Toda response 2xx inclui um campo `meta` conforme schema [`MetaEnvelope`](#/components/schemas/MetaEnvelope) com `request_id`, `api_version`, `processed_at` e `duration_ms` para correlação e observabilidade.",
        "",
        "## Cache HTTP (ETag — RFC 7232) e Rate Limit (draft-ietf-httpapi-ratelimit-headers)",
        "v3.9.1: documenta os headers `ETag`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Deprecation` e `Sunset` que já eram emitidos pelo runtime desde v3.8.8 (Deprecation/Sunset), v3.8.9 (ETag) e v3.9.0 (RateLimit-*). GETs cacheáveis (`/listar`, `/consultar`, `/status`) aceitam `If-None-Match` e podem responder `304 Not Modified`. SDKs oficiais ≥ v2.18.1 fazem isso automaticamente.",
        "",
        "## Changelog v4.3.4 (PR-21)",
        "- **ContaCorrenteInput**: schema completo com 10 campos canônicos do runtime — adicionados `codigo_agencia`, `numero_conta_corrente`, `valor_limite`, `pix_sn` (S/N), `bol_sn` (S/N). Removidos `agencia`/`conta` (deprecated, ignorados pelo runtime).",
        "- **EmpresaInput**: `endereco_numero` adicionado (paridade total com SDK TS).",
        "- **ClienteInput**: `telefone1_ddd` removido — runtime `clientes-api` usa Zod `.strict()` e só aceita `telefone1_numero`. Enviar o campo causava 400.",
        "- **MetaEnvelope wiring**: schema agora referenciado via `allOf` nas responses 2xx de `/contas-pagar-api/*` e `/contas-receber-api/*` (escopo CP/CR).",
        "- **IdempotencyHeaders**: schema removido (orphan irrecuperável, já coberto por `parameters.IdempotencyKey`/`RequestId` + `headers.XRequestId`).",
        "",
        "## Changelog v4.3.3 (PR-20)",
        "- **EmpresaInput**: 7 campos adicionados (`responsavel_nome`, `responsavel_cpf`, `capital_social`, `data_abertura`, `regime_tributario`, `codigo_ibge_municipio`, `natureza_juridica`) — paridade total com SDK TS e runtime `empresas-api`.",
        "- **Schemas órfãos resolvidos**: `ErrorAuth`, `ErrorValidation`, `ErrorRateLimit` agora referenciados via `$ref` em `components.responses` (eram inline). `MetaEnvelope` documentado no envelope padrão.",
        "- **SDKs v3.2.4**: `ContaCorrentePayload` (TS/JS/PY) corrigido — usava `tipo`, `banco_codigo`, `agencia`, `conta` (ignorados pelo runtime). Nomes canônicos: `tipo_conta_corrente`, `codigo_banco`, `codigo_agencia`, `numero_conta_corrente`, `cCodCCInt`. Aliases legados mantidos por 1 versão.",
      ].join("\n"),
      contact: {
        name: "Suporte Huggs",
        url: "https://bimaster.online/dashboard/integracao-erp",
        email: "suporte@bimaster.online",
      },
      license: {
        name: "Proprietary",
        url: "https://bimaster.online/termos",
      },
    },
    servers: [
      { url: DOC_BASE_URL, description: "Produção" },
      { url: "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1", description: "Supabase Direct (desenvolvimento)" },
    ],
    tags,
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key", description: "Chave gerada no Portal de Integração" },
      },
      parameters: {
        IdempotencyKey: {
          name: "X-Idempotency-Key",
          in: "header",
          required: false,
          description: "UUID v4 para garantir que uma operação não seja processada duas vezes. Janela: 24h.",
          schema: { type: "string", format: "uuid" },
        },
        RequestId: {
          name: "X-Request-ID",
          in: "header",
          required: false,
          description: "UUID opcional para correlacionar logs do cliente com o servidor. Se ausente, será gerado.",
          schema: { type: "string", format: "uuid" },
        },
      },
      headers: {
        XRequestId: {
          description: "UUID do request — guarde para suporte.",
          schema: { type: "string", format: "uuid" },
        },
        RetryAfter: {
          description: "Segundos a aguardar antes de tentar novamente.",
          schema: { type: "integer" },
        },
        // v3.9.1 — ETag / If-None-Match (RFC 7232)
        ETag: {
          description: "Hash estável do body — use em If-None-Match para receber 304.",
          schema: { type: "string", example: 'W/"a1b2c3d4e5f6"' },
        },
        // v3.9.1 — RateLimit headers (draft-ietf-httpapi-ratelimit-headers)
        RateLimitLimit: {
          description: "Limite de chamadas/minuto desta chave para esta classe de endpoint.",
          schema: { type: "integer", example: 120 },
        },
        RateLimitRemaining: {
          description: "Chamadas restantes na janela atual.",
          schema: { type: "integer", example: 118 },
        },
        RateLimitReset: {
          description: "Unix epoch (segundos) do reset da janela atual.",
          schema: { type: "integer", example: 1735689600 },
        },
        // v3.9.1 — Deprecation/Sunset (RFC 8594 + draft-ietf-httpapi-deprecation)
        Deprecation: {
          description: 'Indica que o endpoint está depreciado. Valor "true" ou data IMF-fixdate.',
          schema: { type: "string", example: "true" },
        },
        Sunset: {
          description: "Data IMF-fixdate em que o endpoint será removido.",
          schema: { type: "string", example: "Wed, 30 Sep 2026 23:59:59 GMT" },
        },
      },
      responses: {
        ErrorBadRequest: {
          description: "Payload inválido — ver detalhes em ErrorValidation",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorValidation" } } },
        },
        ErrorUnauthorized: {
          description: "API key ausente ou inválida — ver detalhes em ErrorAuth",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorAuth" } } },
        },
        ErrorRateLimited: {
          description: "Rate limit excedido — ver detalhes em ErrorRateLimit",
          headers: {
            "Retry-After": { $ref: "#/components/headers/RetryAfter" },
            "RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
            "RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
            "RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
          },
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorRateLimit" } } },
        },
        ErrorBusiness: {
          description: "Erro de negócio (HTTP 200 com codigo_status != '0')",
          content: { "application/json": { schema: { type: "object", properties: { codigo_status: { type: "string", example: "100" }, descricao_status: { type: "string" } } } } },
        },
        // v3.9.1 — 304 Not Modified para GETs cacheáveis com If-None-Match
        NotModified: {
          description: "Recurso inalterado desde a versão indicada por If-None-Match. Body vazio.",
          headers: {
            "ETag": { $ref: "#/components/headers/ETag" },
            "X-Request-ID": { $ref: "#/components/headers/XRequestId" },
            "RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
            "RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
            "RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
          },
        },
      },
      schemas,
    },
    paths,
  };
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════

interface ApiDocumentationProps {
  accessProfileModules?: { module_id: string; api_id: string | null; visivel: boolean }[] | null;
}

export default function ApiDocumentation({ accessProfileModules }: ApiDocumentationProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedApi, setExpandedApi] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Apply access profile filtering
  const accessFilteredModules = useMemo(() => {
    if (!accessProfileModules || accessProfileModules.length === 0) return API_MODULES;

    return API_MODULES.map(mod => {
      // Check if full module is allowed
      const moduleEntry = accessProfileModules.find(m => m.module_id === mod.id && !m.api_id);
      if (moduleEntry && moduleEntry.visivel) return mod;

      // Check individual APIs
      const allowedApiIds = accessProfileModules
        .filter(m => m.module_id === mod.id && m.api_id && m.visivel)
        .map(m => m.api_id);

      if (allowedApiIds.length === 0 && !moduleEntry) return { ...mod, apis: [] };

      return {
        ...mod,
        apis: mod.apis.filter(api => allowedApiIds.includes(api.id)),
      };
    }).filter(mod => mod.apis.length > 0);
  }, [accessProfileModules]);

  const totalEndpoints = useMemo(() => {
    let count = 0;
    for (const mod of accessFilteredModules) {
      for (const api of mod.apis) {
        for (const s of api.sections) count += s.endpoints.length;
      }
    }
    return count;
  }, [accessFilteredModules]);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return accessFilteredModules;
    const q = searchQuery.toLowerCase();
    return accessFilteredModules.map(mod => ({
      ...mod,
      apis: mod.apis.filter(api => {
        const nameMatch = api.name.toLowerCase().includes(q) || api.description.toLowerCase().includes(q) || api.basePath.toLowerCase().includes(q);
        const endpointMatch = api.sections.some(s => s.endpoints.some(ep => ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q)));
        return nameMatch || endpointMatch;
      }),
    })).filter(mod => mod.apis.length > 0);
  }, [searchQuery, accessFilteredModules]);

  const handleExportExcel = async () => {
    const sheets = buildExcelData(accessFilteredModules);
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const collection = generatePostmanCollection(accessFilteredModules);
              const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "Huggs_API_Collection.postman_collection.json";
              a.click();
              URL.revokeObjectURL(url);
            }} className="gap-2">
              <Globe className="h-4 w-4" />
              Postman Collection
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const spec = generateOpenAPISpec(accessFilteredModules);
              const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "huggs-openapi-3.0.json";
              a.click();
              URL.revokeObjectURL(url);
            }} className="gap-2">
              <FileText className="h-4 w-4" />
              OpenAPI 3.0
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
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
              <ApiGlobalStatus basePaths={accessFilteredModules.flatMap(m => m.apis.map(a => a.basePath))} />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-2">Módulos</p>
              {accessFilteredModules.map(mod => (
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

              <div className="border-t mt-4 pt-4 space-y-1">
                <button
                  onClick={() => scrollToModule("glossary")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === "glossary" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <BookOpen className="h-5 w-5" />
                  <span>Glossário</span>
                </button>
                <button
                  onClick={() => scrollToModule("faq")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === "faq" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <HelpCircle className="h-5 w-5" />
                  <span>FAQ</span>
                </button>
                <button
                  onClick={() => scrollToModule("getting-started")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === "getting-started" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Rocket className="h-5 w-5" />
                  <span>Início Rápido</span>
                </button>
                <button
                  onClick={() => scrollToModule("auth")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === "auth" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Shield className="h-5 w-5" />
                  <span>Autenticação</span>
                </button>
                <button
                  onClick={() => scrollToModule("changelog")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === "changelog" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <History className="h-5 w-5" />
                  <span>Changelog</span>
                </button>
                <button
                  onClick={() => scrollToModule("security")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeModule === "security" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Lock className="h-5 w-5" />
                  <span>Segurança</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* ═══ GETTING STARTED ═══ */}
            {!searchQuery && (
              <div ref={el => { moduleRefs.current["getting-started"] = el; }}>
                <div className="rounded-xl bg-gradient-to-r from-primary to-primary/80 p-4 mb-4">
                  <div className="flex items-center gap-3 text-white">
                    <Rocket className="h-5 w-5" />
                    <div>
                      <h3 className="font-semibold text-base">Início Rápido</h3>
                      <p className="text-sm text-white/80">Guia para integrar seu ERP com o BiMaster em 4 passos</p>
                    </div>
                  </div>
                </div>

                {/* Environments Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="border-2 border-emerald-500/40 bg-emerald-500/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-emerald-600" />
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">Produção</Badge>
                    </div>
                    <code className="text-xs font-mono block break-all text-foreground">{DOC_BASE_URL}</code>
                    <p className="text-[11px] text-muted-foreground mt-2">Dados reais. Todas as operações são persistidas e auditadas.</p>
                  </div>
                  <div className="border-2 border-orange-500/40 bg-orange-500/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FlaskConical className="h-4 w-4 text-orange-600" />
                      <Badge className="bg-orange-500/15 text-orange-700 border-orange-500/30 text-[10px]">Sandbox</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Ative o toggle <strong>"Sandbox"</strong> no API Tester. Mesma URL, respostas simuladas sem persistência.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">ATENCAO: Nao use dados reais no sandbox -- eles sao descartados.</p>
                  </div>
                </div>

                <div className="border rounded-xl p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Politica de Versionamento</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Versao atual: <strong>v1</strong> (estável). Breaking changes serão comunicados com <strong>90 dias de antecedência</strong> via webhook e e-mail cadastrado.
                    Versões anteriores permanecerão ativas por no mínimo <strong>6 meses</strong> após o lançamento de uma nova versão.
                    Campos novos podem ser adicionados a qualquer momento (aditivos, não-breaking) — seu parser deve ignorar campos desconhecidos.
                  </p>
                </div>

                {/* Estimated Integration Times */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Cadastros Base", time: "~2h", desc: "Empresas, Clientes, Fornecedores, Categorias", color: "text-emerald-600" },
                    { label: "Financeiro Completo", time: "~4h", desc: "CP, CR, Boletos, Pagamentos, Contas Correntes", color: "text-blue-600" },
                    { label: "Webhooks & Automação", time: "~1h", desc: "Assinaturas, HMAC, retries, dead letter", color: "text-purple-600" },
                  ].map(t => (
                    <div key={t.label} className="border rounded-lg p-3 text-center">
                      <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className={`text-lg font-bold ${t.color}`}>{t.time}</p>
                      <p className="text-xs font-medium">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{t.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Sandbox Info Banner */}
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <FlaskConical className="h-5 w-5 text-orange-600 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm text-orange-700">Ambiente Sandbox Disponível</h4>
                      <p className="text-xs text-muted-foreground">
                        Use o toggle <strong>Sandbox</strong> no API Tester abaixo para testar chamadas sem afetar dados reais. 
                        Todas as respostas são simuladas e registradas para auditoria.
                      </p>
                    </div>
                  </div>
                </div>

                {/* v2.9.0: Primeiros 5 Minutos + Quando usar cada método */}
                <div className="border-2 border-primary/30 rounded-xl p-5 mb-4 bg-primary/5">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Primeiros 5 Minutos (Quick Start)
                  </h4>
                  <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                    <li><strong className="text-foreground">Gerar API Key</strong> — clique em "Gerenciar Chaves API" no portal acima.</li>
                    <li><strong className="text-foreground">Instalar SDK</strong> — <code className="bg-muted px-1 rounded">npm i @bimaster/huggs-erp-sdk</code> ou <code className="bg-muted px-1 rounded">pip install huggs-erp-sdk</code> (ou copie o arquivo gerado).</li>
                    <li><strong className="text-foreground">Primeiro request</strong> — <code className="bg-muted px-1 rounded">{`erp.cpConsultar({ codigo_lancamento_integracao: "TEST-001" })`}</code></li>
                    <li><strong className="text-foreground">Tratar erro de negócio</strong> — envolva em <code className="bg-muted px-1 rounded">try/catch</code>; o SDK lança <code className="bg-muted px-1 rounded">HuggsBusinessError</code> quando <code className="bg-muted px-1 rounded">codigo_status != "0"</code>.</li>
                    <li><strong className="text-foreground">Produção com retry</strong> — <code className="bg-muted px-1 rounded">{`erp.cpLancarPagamento(payload, { retry: true, idempotencyKey: \`cp-pag-\${codigo}-\${valor}\` })`}</code></li>
                  </ol>
                </div>

                <div className="border rounded-xl p-5 mb-4">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Quando usar cada método
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left p-2 font-semibold">Cenário</th>
                          <th className="text-left p-2 font-semibold text-emerald-700">Use</th>
                          <th className="text-left p-2 font-semibold text-rose-700">Não use</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        {[
                          ["Criar título novo (primeira vez)", "cpIncluir / crIncluir", "cpUpsert (silencia conflito)"],
                          ["Sincronizar de sistema externo (idempotente)", "cpUpsert / crUpsert", "cpIncluir (falha em duplicata)"],
                          ["Baixa unitária com idempotência forte", "cpLancarPagamento / crLancarRecebimento", "—"],
                          ["Lote >100 títulos", "cpUpsertLote / crUpsertLote + retry: true", "loop manual de cpUpsert/crUpsert"],
                          ["Listagem unificada (UI + ETL, com cursor)", "cpQuery / crQuery (cursor + offset)", "—"],
                          ["Estorno auditável de baixa", "cpEstornar / crEstornar (motivo obrigatório)", "—"],
                        ].map((row, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="p-2 font-medium text-foreground">{row[0]}</td>
                            <td className="p-2"><code className="bg-emerald-500/10 text-emerald-700 px-1 rounded">{row[1]}</code></td>
                            <td className="p-2"><code className="bg-rose-500/10 text-rose-700 px-1 rounded">{row[2]}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border rounded-xl p-5 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { step: "1", title: "Obter API Key", desc: "Gere sua chave no portal acima (Gerenciar Chaves API)", icon: <Shield className="h-4 w-4" /> },
                      { step: "2", title: "Testar Health Check", desc: "GET /status em qualquer API para validar conectividade", icon: <Zap className="h-4 w-4" /> },
                      { step: "3", title: "Sync Cadastros Base", desc: "Empresas → Fornecedores → Categorias → Plano de Contas → Portadores", icon: <Database className="h-4 w-4" /> },
                      { step: "4", title: "Integrar Financeiro", desc: "Contas a Pagar/Receber → Boletos → Webhooks", icon: <DollarSign className="h-4 w-4" /> },
                    ].map(s => (
                      <div key={s.step} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold">{s.step}</span>
                          {s.icon}
                          <span className="font-medium text-sm">{s.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Integration Order Flow */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Ordem de Integração Sugerida
                    </h4>
                    <div className="flex items-center flex-wrap gap-1 py-3 px-4 bg-muted/40 rounded-lg">
                      {["Empresas", "→", "Fornecedores / Clientes", "→", "Categorias + Plano de Contas", "→", "Portadores", "→", "Contas a Pagar / Receber", "→", "Boletos", "→", "Webhooks"].map((item, i) => (
                        item === "→" ? (
                          <span key={i} className="text-muted-foreground text-sm font-bold">→</span>
                        ) : (
                          <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">{item}</span>
                        )
                      ))}
                    </div>
                     <p className="text-[11px] text-muted-foreground mt-2">
                       ATENCAO: Respeite esta ordem para evitar erros de referencia (ex: incluir titulo sem fornecedor cadastrado).
                     </p>

                     {/* Dependency Map */}
                     <div className="mt-3 border rounded-lg p-3 bg-muted/20">
                       <h5 className="text-xs font-medium mb-2">Mapa de Dependências entre APIs:</h5>
                       <div className="font-mono text-[11px] text-muted-foreground space-y-1 leading-relaxed">
                         <div>[E] <span className="text-foreground font-medium">Empresas</span></div>
                         <div className="ml-4">├── [C] <span className="text-foreground font-medium">Clientes / Fornecedores</span> <span className="text-[10px]">(dependem de empresa)</span></div>
                         <div className="ml-4">├── [F] <span className="text-foreground font-medium">Categorias</span> + <span className="text-foreground font-medium">Plano de Contas</span></div>
                         <div className="ml-4">├── [B] <span className="text-foreground font-medium">Contas Correntes</span> + <span className="text-foreground font-medium">Portadores</span></div>
                         <div className="ml-4">│   ├── [CP] <span className="text-foreground font-medium">Contas a Pagar</span> <span className="text-[10px]">(depende de fornecedor + categoria + CC)</span></div>
                         <div className="ml-4">│   ├── [CR] <span className="text-foreground font-medium">Contas a Receber</span> <span className="text-[10px]">(depende de cliente + categoria + CC)</span></div>
                         <div className="ml-4">│   │   └── [BL] <span className="text-foreground font-medium">Boletos</span> <span className="text-[10px]">(depende de CR + conta corrente habilitada)</span></div>
                         <div className="ml-4">│   └── [LC] <span className="text-foreground font-medium">Lancamentos CC</span> <span className="text-[10px]">(depende de conta corrente)</span></div>
                         <div className="ml-4">└── [WH] <span className="text-foreground font-medium">Webhooks</span> <span className="text-[10px]">(independente -- configure a qualquer momento)</span></div>
                       </div>
                     </div>
                   </div>

                  {/* POST Convention Note */}
                  <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 flex gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm text-amber-700">Convenção POST (Padrão Huggs)</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Algumas APIs (Empresas, Departamentos, Categorias, Projetos) utilizam <code className="bg-muted px-1 rounded">POST</code> para todas as operações,
                        incluindo consultas e listagens. Isso segue o padrão Huggs para compatibilidade. O body JSON substitui query params.
                      </p>
                    </div>
                  </div>

                   {/* Multilingual Examples */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <Terminal className="h-4 w-4 text-primary" />
                       Hello World — Exemplos Completos em 4 Linguagens
                     </h4>
                     <p className="text-xs text-muted-foreground mb-3">
                       Fluxo completo: autenticação → health check → listar fornecedores. Copie e execute para validar sua integração.
                     </p>
                     <Tabs defaultValue="curl" className="w-full">
                       <TabsList className="grid w-full grid-cols-4 h-8">
                         <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                         <TabsTrigger value="js" className="text-xs">JavaScript</TabsTrigger>
                         <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
                         <TabsTrigger value="php" className="text-xs">PHP</TabsTrigger>
                       </TabsList>
                       <TabsContent value="curl" className="mt-2">
                         <CodeBlock code={`# 1. Health check
curl -s ${DOC_BASE_URL}/contas-pagar-api/status

# 2. Listar fornecedores
curl -H "x-api-key: SUA_CHAVE" \\
  "${DOC_BASE_URL}/erp-fornecedores-query/"

# 3. Criar conta a pagar
curl -X POST \\
  -H "x-api-key: SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"codigo_lancamento_integracao":"INT-001","codigo_cliente_fornecedor":12345,"data_vencimento":"21/03/2026","valor_documento":100,"codigo_categoria":"2.04.01"}' \\
  "${DOC_BASE_URL}/contas-pagar-api/incluir"`} />
                       </TabsContent>
                       <TabsContent value="js" className="mt-2">
                         <CodeBlock code={`const API_KEY = "SUA_CHAVE";
const BASE = "${DOC_BASE_URL}";

// 1. Health check
const health = await fetch(\`\${BASE}/contas-pagar-api/status\`);
logger.log("Status:", health.ok ? "Online" : "Offline");

// 2. Listar fornecedores
const fornecedores = await fetch(\`\${BASE}/erp-fornecedores-query/\`, {
  headers: { "x-api-key": API_KEY }
});
const { fornecedores: lista } = await fornecedores.json();
logger.log(\`\${lista.length} fornecedores encontrados\`);

// 3. Criar CP com tratamento de erro
const res = await fetch(\`\${BASE}/contas-pagar-api/incluir\`, {
  method: "POST",
  headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    codigo_lancamento_integracao: "INT-001",
    codigo_cliente_fornecedor: 12345,
    data_vencimento: "21/03/2026",
    valor_documento: 100,
    codigo_categoria: "2.04.01"
  })
});
if (!res.ok) {
  const err = await res.json();
  logger.error(\`Erro \${res.status}: \${err.message}\`);
} else {
  logger.log("Título criado:", await res.json());
}`} />
                       </TabsContent>
                       <TabsContent value="python" className="mt-2">
                         <CodeBlock code={`import requests

API_KEY = "SUA_CHAVE"
BASE = "${DOC_BASE_URL}"
HEADERS = {"x-api-key": API_KEY, "Content-Type": "application/json"}

# 1. Health check
r = requests.get(f"{BASE}/contas-pagar-api/status")
print(f"Status: {'Online' if r.ok else 'Offline'}")

# 2. Listar fornecedores
r = requests.get(f"{BASE}/erp-fornecedores-query/", headers=HEADERS)
print(f"{r.json()['total']} fornecedores encontrados")

# 3. Criar CP
r = requests.post(f"{BASE}/contas-pagar-api/incluir", headers=HEADERS, json={
    "codigo_lancamento_integracao": "INT-001",
    "codigo_cliente_fornecedor": 12345,
    "data_vencimento": "21/03/2026",
    "valor_documento": 100,
    "codigo_categoria": "2.04.01"
})
if r.ok:
    print("Título criado:", r.json())
else:
    print(f"Erro {r.status_code}: {r.json().get('message', r.text)}")`} />
                       </TabsContent>
                       <TabsContent value="php" className="mt-2">
                         <CodeBlock code={`<?php
$api_key = "SUA_CHAVE";
$base = "${DOC_BASE_URL}";

// 1. Health check
$status = file_get_contents("$base/contas-pagar-api/status");
echo json_decode($status)->status === "ok" ? "Online\\n" : "Offline\\n";

// 2. Listar fornecedores
$ctx = stream_context_create(["http" => [
    "header" => "x-api-key: $api_key"
]]);
$fornecedores = json_decode(file_get_contents("$base/erp-fornecedores-query/", false, $ctx));
echo count($fornecedores->fornecedores) . " fornecedores\\n";

// 3. Criar CP
$ctx = stream_context_create(["http" => [
    "method"  => "POST",
    "header"  => "x-api-key: $api_key\\r\\nContent-Type: application/json",
    "content" => json_encode([
        "codigo_lancamento_integracao" => "INT-001",
        "codigo_cliente_fornecedor" => 12345,
        "data_vencimento" => "21/03/2026",
        "valor_documento" => 100,
        "codigo_categoria" => "2.04.01"
    ])
]]);
$result = json_decode(file_get_contents("$base/contas-pagar-api/incluir", false, $ctx));
echo "Status: " . $result->descricao_status . "\\n";`} />
                       </TabsContent>
                     </Tabs>
                   </div>

                   {/* Field Glossary */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       Glossário de Campos — CP /incluir
                     </h4>
                     <p className="text-xs text-muted-foreground mb-2">Referência detalhada dos campos para criação de Conta a Pagar via integração.</p>
                     <div className="border rounded-lg overflow-hidden text-xs">
                       <div className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                         <span>Campo</span><span>Tipo</span><span>Obrigatório</span><span>Descrição</span>
                       </div>
                       {[
                         { field: "codigo_lancamento_integracao", type: "string", req: true, desc: "Código único do título no seu ERP (chave de integração)" },
                         { field: "codigo_cliente_fornecedor", type: "integer", req: true, desc: "Código do fornecedor cadastrado no sistema" },
                          { field: "data_vencimento", type: "date", req: true, desc: "Entrada: DD/MM/AAAA ou YYYY-MM-DD (recomendado: DD/MM/AAAA). Saída (listagens/webhooks): sempre ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ). ATENÇÃO: O formato de entrada e saída são diferentes. Seu parser deve tratar ambos." },
                         { field: "valor_documento", type: "decimal", req: true, desc: "Valor do título em BRL" },
                         { field: "codigo_categoria", type: "string", req: true, desc: "Código da categoria (ex: 2.04.01)" },
                         { field: "empresa_id", type: "integer", req: false, desc: "ID da empresa (obrigatório no upsert)" },
                         { field: "data_previsao", type: "date", req: false, desc: "Data prevista para pagamento" },
                         { field: "id_conta_corrente", type: "integer", req: false, desc: "Código da conta corrente" },
                         { field: "observacao", type: "string", req: false, desc: "Observações do título (max 5000 chars)" },
                         { field: "numero_documento_fiscal", type: "string", req: false, desc: "Número da NF-e" },
                         { field: "chave_nfe", type: "string(44)", req: false, desc: "Chave de acesso da NF-e" },
                       ].map(f => (
                         <div key={f.field} className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                           <code className="font-mono text-[11px] text-primary">{f.field}</code>
                           <span className="text-muted-foreground">{f.type}</span>
                           <span>{f.req ? <Badge variant="outline" className="text-[9px] h-4 px-1">sim</Badge> : <span className="text-muted-foreground">não</span>}</span>
                           <span className="text-muted-foreground">{f.desc}</span>
                         </div>
                       ))}
                     </div>
                   </div>

                   {/* Field Glossary — CR /incluir */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       Glossário de Campos — CR /incluir
                     </h4>
                     <p className="text-xs text-muted-foreground mb-2">Referência detalhada dos campos para criação de Conta a Receber via integração.</p>
                     <div className="border rounded-lg overflow-hidden text-xs">
                       <div className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                         <span>Campo</span><span>Tipo</span><span>Obrigatório</span><span>Descrição</span>
                       </div>
                       {[
                         { field: "codigo_lancamento_integracao", type: "string", req: true, desc: "Código único do título no seu ERP (chave de integração)" },
                         { field: "codigo_cliente_fornecedor", type: "integer", req: true, desc: "Código do cliente cadastrado no sistema" },
                         { field: "data_vencimento", type: "date", req: true, desc: "Entrada: DD/MM/AAAA ou YYYY-MM-DD (recomendado: DD/MM/AAAA). Saída (listagens/webhooks): sempre ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ). ATENÇÃO: O formato de entrada e saída são diferentes. Seu parser deve tratar ambos." },
                         { field: "valor_documento", type: "decimal", req: true, desc: "Valor do título em BRL" },
                         { field: "codigo_categoria", type: "string", req: true, desc: "Código da categoria de receita (ex: 1.01.02)" },
                         { field: "empresa_id", type: "integer", req: false, desc: "ID da empresa (obrigatório no upsert)" },
                         { field: "data_previsao", type: "date", req: false, desc: "Data prevista para recebimento" },
                         { field: "id_conta_corrente", type: "integer", req: false, desc: "Código da conta corrente para recebimento" },
                         { field: "observacao", type: "string", req: false, desc: "Observações do título (max 5000 chars)" },
                         { field: "numero_pedido", type: "string", req: false, desc: "Número do pedido de venda vinculado" },
                         { field: "numero_contrato", type: "string", req: false, desc: "Número do contrato vinculado" },
                         { field: "numero_ordem_servico", type: "string", req: false, desc: "Número da ordem de serviço" },
                       ].map(f => (
                         <div key={f.field} className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                           <code className="font-mono text-[11px] text-primary">{f.field}</code>
                           <span className="text-muted-foreground">{f.type}</span>
                           <span>{f.req ? <Badge variant="outline" className="text-[9px] h-4 px-1">sim</Badge> : <span className="text-muted-foreground">não</span>}</span>
                           <span className="text-muted-foreground">{f.desc}</span>
                         </div>
                       ))}
                     </div>
                   </div>

                   {/* Field Glossary — Fornecedores /incluir */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       Glossário de Campos — Fornecedores /incluir
                     </h4>
                     <p className="text-xs text-muted-foreground mb-2">Referência detalhada dos campos para cadastro de Fornecedores via sync bidirecional.</p>
                     <div className="border rounded-lg overflow-hidden text-xs">
                       <div className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                         <span>Campo</span><span>Tipo</span><span>Obrigatório</span><span>Descrição</span>
                       </div>
                       {[
                         { field: "cnpj_cpf", type: "string", req: true, desc: "CPF ou CNPJ do fornecedor (sem pontuação)" },
                         { field: "razao_social", type: "string", req: true, desc: "Razão social ou nome completo" },
                         { field: "nome_fantasia", type: "string", req: false, desc: "Nome fantasia da empresa" },
                         { field: "codigo_integracao", type: "string", req: false, desc: "Código do fornecedor no ERP externo" },
                         { field: "email", type: "string", req: false, desc: "E-mail de contato" },
                         { field: "telefone", type: "string", req: false, desc: "Telefone de contato" },
                         { field: "endereco", type: "string", req: false, desc: "Logradouro" },
                         { field: "cidade", type: "string", req: false, desc: "Cidade" },
                         { field: "estado", type: "string(2)", req: false, desc: "UF (ex: SP, RJ)" },
                         { field: "cep", type: "string(8)", req: false, desc: "CEP sem pontuação" },
                         { field: "inscricao_estadual", type: "string", req: false, desc: "Inscrição estadual" },
                          { field: "empresa_ids", type: "integer[]", req: false, desc: "RECOMENDADO: IDs das empresas para vinculação. Sem vinculação a pelo menos uma empresa, o fornecedor não aparece em listagens filtradas e não pode ser referenciado em títulos de CP." },
                        ].map(f => (
                          <div key={f.field} className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                            <code className="font-mono text-[11px] text-primary">{f.field}</code>
                            <span className="text-muted-foreground">{f.type}</span>
                            <span>{f.req ? <Badge variant="outline" className="text-[9px] h-4 px-1">sim</Badge> : <span className="text-muted-foreground">não</span>}</span>
                            <span className="text-muted-foreground">{f.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                   {/* Field Glossary — Clientes /incluir */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       Glossário de Campos — Clientes /incluir
                     </h4>
                     <p className="text-xs text-muted-foreground mb-2">Referência detalhada dos campos para cadastro de Clientes via integração.</p>
                     <div className="border rounded-lg overflow-hidden text-xs">
                       <div className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                         <span>Campo</span><span>Tipo</span><span>Obrigatório</span><span>Descrição</span>
                       </div>
                       {[
                         { field: "razao_social", type: "string", req: true, desc: "Razão social ou nome completo" },
                         { field: "cnpj_cpf", type: "string", req: false, desc: "CPF ou CNPJ sem pontuação. RECOMENDADO para /upsert: chave de duplicidade. Sem este campo, o /upsert não consegue identificar duplicidade e sempre criará novo registro." },
                         { field: "codigo_cliente_integracao", type: "string", req: false, desc: "Código do cliente no ERP externo. Alternativa ao cnpj_cpf como chave de integração." },
                         { field: "nome_fantasia", type: "string", req: false, desc: "Nome fantasia" },
                         { field: "email", type: "string", req: false, desc: "E-mail de contato" },
                         { field: "telefone1_numero", type: "string", req: false, desc: "Telefone de contato" },
                         { field: "endereco", type: "string", req: false, desc: "Logradouro" },
                         { field: "cidade", type: "string", req: false, desc: "Cidade" },
                         { field: "estado", type: "string(2)", req: false, desc: "UF (ex: SP)" },
                         { field: "cep", type: "string(8)", req: false, desc: "CEP sem pontuação" },
                       ].map(f => (
                         <div key={f.field} className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                           <code className="font-mono text-[11px] text-primary">{f.field}</code>
                           <span className="text-muted-foreground">{f.type}</span>
                           <span>{f.req ? <Badge variant="outline" className="text-[9px] h-4 px-1">sim</Badge> : <span className="text-muted-foreground">não</span>}</span>
                           <span className="text-muted-foreground">{f.desc}</span>
                         </div>
                       ))}
                     </div>
                     <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-2 mt-2">
                       <p className="text-[11px] text-muted-foreground"><strong>NOTA:</strong> Para operações de /upsert, o sistema usa cnpj_cpf como chave primária de duplicidade. Se cnpj_cpf não for informado, o upsert se comporta como /incluir (sempre cria novo registro). Recomendamos sempre informar cnpj_cpf.</p>
                     </div>
                   </div>

                   {/* Field Glossary — Empresas /incluir */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       Glossário de Campos — Empresas /incluir
                     </h4>
                     <p className="text-xs text-muted-foreground mb-2">Referência detalhada dos campos para cadastro de Empresas via integração.</p>
                     <div className="border rounded-lg overflow-hidden text-xs">
                       <div className="grid grid-cols-[220px_80px_100px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                         <span>Campo</span><span>Tipo</span><span>Obrigatório</span><span>Descrição</span>
                       </div>
                       {[
                         { field: "razao_social", type: "string", req: "sim", desc: "Razão social da empresa" },
                         { field: "cnpj", type: "string", req: "recomendado", desc: "CNPJ sem pontuação. Sem CNPJ, a empresa não pode ser vinculada a operações fiscais, fornecedores ou relatórios tributários." },
                         { field: "nome_fantasia", type: "string", req: "não", desc: "Nome fantasia" },
                         { field: "regime_apuracao", type: "string", req: "recomendado", desc: "'Competência' ou 'Caixa'. Afeta diretamente o cálculo do DRE e relatórios financeiros. Se omitido, padrão: 'Competência'." },
                         { field: "tipo_empresa", type: "string", req: "recomendado", desc: "'Matriz', 'Filial' ou 'Coligada'. Define hierarquia multi-empresa." },
                         { field: "porte", type: "string", req: "não", desc: "'ME', 'EPP' ou 'Demais'" },
                         { field: "codigo_empresa_integracao", type: "string", req: "não", desc: "Código da empresa no ERP externo" },
                         { field: "inscricao_estadual", type: "string", req: "não", desc: "IE para operações com ICMS" },
                         { field: "inscricao_municipal", type: "string", req: "não", desc: "IM para serviços" },
                         { field: "endereco", type: "string", req: "não", desc: "Logradouro" },
                         { field: "endereco_numero", type: "string", req: "não", desc: "Número" },
                         { field: "complemento", type: "string", req: "não", desc: "Complemento" },
                         { field: "bairro", type: "string", req: "não", desc: "Bairro" },
                         { field: "cidade", type: "string", req: "não", desc: "Cidade" },
                         { field: "estado", type: "string(2)", req: "não", desc: "UF" },
                         { field: "cep", type: "string(8)", req: "não", desc: "CEP sem pontuação" },
                         { field: "email", type: "string", req: "não", desc: "E-mail da empresa" },
                         { field: "telefone1_ddd", type: "string", req: "não", desc: "DDD" },
                         { field: "telefone1_numero", type: "string", req: "não", desc: "Telefone" },
                       ].map(f => (
                         <div key={f.field} className="grid grid-cols-[220px_80px_100px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                           <code className="font-mono text-[11px] text-primary">{f.field}</code>
                           <span className="text-muted-foreground">{f.type}</span>
                           <span>{f.req === "sim" ? <Badge variant="outline" className="text-[9px] h-4 px-1">sim</Badge> : f.req === "recomendado" ? <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/30 text-amber-600">recomendado</Badge> : <span className="text-muted-foreground">não</span>}</span>
                           <span className="text-muted-foreground">{f.desc}</span>
                         </div>
                       ))}
                     </div>
                     <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-2 mt-2">
                       <p className="text-[11px] text-muted-foreground"><strong>ATENÇÃO:</strong> Campos marcados como "recomendado" não são obrigatórios no schema (a API aceita sem eles), mas sem eles a empresa fica em estado parcial — sem CNPJ não vincula a fiscal, sem regime_apuracao o DRE fica incorreto, sem tipo_empresa a hierarquia multi-empresa não funciona.</p>
                     </div>
                   </div>

                   {/* Field Glossary — Categorias /incluir */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       Glossário de Campos — Categorias /incluir
                     </h4>
                     <p className="text-xs text-muted-foreground mb-2">Referência detalhada dos campos para criação de Categorias Financeiras.</p>
                     <div className="border rounded-lg overflow-hidden text-xs">
                       <div className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                         <span>Campo</span><span>Tipo</span><span>Obrigatório</span><span>Descrição</span>
                       </div>
                       {[
                         { field: "codigo_categoria", type: "string", req: true, desc: "Código hierárquico (ex: '2.04.01'). Deve seguir a estrutura pai → filho (ex: 2 → 2.04 → 2.04.01)" },
                         { field: "descricao", type: "string", req: true, desc: "Descrição da categoria (ex: 'Aluguel')" },
                         { field: "tipo", type: "string", req: true, desc: "'receita' ou 'despesa'" },
                         { field: "categoria_pai", type: "string", req: false, desc: "Código da categoria pai para hierarquia. Se omitido, cria como categoria raiz." },
                       ].map(f => (
                         <div key={f.field} className="grid grid-cols-[180px_80px_80px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                           <code className="font-mono text-[11px] text-primary">{f.field}</code>
                           <span className="text-muted-foreground">{f.type}</span>
                           <span>{f.req ? <Badge variant="outline" className="text-[9px] h-4 px-1">sim</Badge> : <span className="text-muted-foreground">não</span>}</span>
                           <span className="text-muted-foreground">{f.desc}</span>
                         </div>
                       ))}
                     </div>
                     <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-2 mt-2">
                       <p className="text-[11px] text-muted-foreground"><strong>NOTA:</strong> Diferente de Plano de Contas. Categorias são agrupamentos internos do BiMaster para classificação gerencial. Plano de Contas é a estrutura contábil oficial.</p>
                     </div>
                   </div>

                   {/* Field Glossary — Contas Correntes /incluir */}
                   <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       Glossário de Campos — Contas Correntes /incluir
                     </h4>
                     <p className="text-xs text-muted-foreground mb-2">Referência detalhada dos campos para cadastro de Contas Correntes.</p>
                     <div className="border rounded-lg overflow-hidden text-xs">
                       <div className="grid grid-cols-[180px_80px_100px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                         <span>Campo</span><span>Tipo</span><span>Obrigatório</span><span>Descrição</span>
                       </div>
                       {[
                         { field: "descricao", type: "string", req: "sim", desc: "Nome/descrição da conta (ex: 'BB CC 12345')" },
                         { field: "tipo", type: "string", req: "recomendado", desc: "'corrente', 'poupanca', 'investimento'. Padrão: 'corrente'." },
                         { field: "banco_codigo", type: "string", req: "recomendado", desc: "Código COMPE do banco (ex: '001' = BB, '341' = Itaú). Sem banco_codigo, a conta não pode ser usada para geração de boletos nem conciliação bancária." },
                         { field: "agencia", type: "string", req: "recomendado", desc: "Número da agência" },
                         { field: "conta", type: "string", req: "recomendado", desc: "Número da conta com dígito" },
                         { field: "saldo_inicial", type: "number", req: "não", desc: "Saldo inicial em R$. Padrão: 0.00." },
                       ].map(f => (
                         <div key={f.field} className="grid grid-cols-[180px_80px_100px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                           <code className="font-mono text-[11px] text-primary">{f.field}</code>
                           <span className="text-muted-foreground">{f.type}</span>
                           <span>{f.req === "sim" ? <Badge variant="outline" className="text-[9px] h-4 px-1">sim</Badge> : f.req === "recomendado" ? <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/30 text-amber-600">recomendado</Badge> : <span className="text-muted-foreground">não</span>}</span>
                           <span className="text-muted-foreground">{f.desc}</span>
                         </div>
                       ))}
                     </div>
                     <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-2 mt-2">
                       <p className="text-[11px] text-muted-foreground"><strong>ATENÇÃO:</strong> Campos bancários (banco_codigo, agencia, conta) são opcionais no schema, mas sem eles a conta corrente fica inutilizável para: geração de boletos, conciliação de extrato bancário e integração com portadores. Se a conta for apenas para controle interno de caixa, esses campos podem ser omitidos.</p>
                     </div>
                   </div>

                   {/* Pre-conditions — CP /lancar-pagamento */}
                   <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertTriangle className="h-4 w-4 text-amber-600" />
                       <span className="font-semibold text-sm text-amber-700">Pré-condições — CP /lancar-pagamento</span>
                     </div>
                     <ul className="text-xs text-muted-foreground space-y-1">
                       <li>• O título deve existir e estar com status "pendente" ou "vencido"</li>
                       <li>• Se a empresa possui múltiplas contas correntes e id_conta_corrente não for informado, o sistema usará a conta corrente padrão da empresa</li>
                       <li>• O valor do pagamento não pode exceder o saldo devedor do título</li>
                       <li>• Para pagamentos parciais, o título permanece com status "pendente" até quitação total</li>
                     </ul>
                     <p className="text-[11px] text-muted-foreground mt-2"><strong>CAMPO RECOMENDADO:</strong> id_conta_corrente — Se omitido, debita da conta corrente padrão. Informe para garantir que o pagamento seja registrado na conta correta.</p>
                   </div>

                   {/* Pre-conditions — CR /lancar-recebimento */}
                   <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertTriangle className="h-4 w-4 text-amber-600" />
                       <span className="font-semibold text-sm text-amber-700">Pré-condições — CR /lancar-recebimento</span>
                     </div>
                     <ul className="text-xs text-muted-foreground space-y-1">
                       <li>• O título deve existir e estar com status "pendente" ou "vencido"</li>
                       <li>• Se id_conta_corrente não for informado, credita na conta corrente padrão da empresa</li>
                       <li>• O valor do recebimento não pode exceder o saldo devedor do título</li>
                     </ul>
                     <p className="text-[11px] text-muted-foreground mt-2"><strong>CAMPO RECOMENDADO:</strong> id_conta_corrente — Se omitido, credita na conta corrente padrão. Informe para garantir que o recebimento seja registrado na conta correta.</p>
                   </div>

                   {/* Pre-conditions — Boletos /gerar */}
                   <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-3">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertTriangle className="h-4 w-4 text-red-600" />
                       <span className="font-semibold text-sm text-red-700">Pré-condições — Boletos /gerar</span>
                     </div>
                     <ul className="text-xs text-muted-foreground space-y-1">
                       <li>• O título de Contas a Receber referenciado deve existir e estar com status "pendente"</li>
                       <li>• A empresa deve ter pelo menos uma conta corrente com dados bancários completos (banco_codigo, agencia, conta) e habilitada para cobrança</li>
                       <li>• Se o título já foi recebido ou cancelado, a geração falhará com erro 422</li>
                     </ul>
                     <div className="mt-2 space-y-1">
                       <p className="text-[11px] font-medium">Erros comuns:</p>
                       <p className="text-[11px] text-muted-foreground">• <code className="bg-muted px-1 rounded">422 "Título não elegível"</code> — O CR não está pendente. Verifique o status antes de gerar.</p>
                       <p className="text-[11px] text-muted-foreground">• <code className="bg-muted px-1 rounded">422 "Conta corrente sem dados bancários"</code> — A CC precisa de banco_codigo, agencia e conta.</p>
                       <p className="text-[11px] text-muted-foreground">• <code className="bg-muted px-1 rounded">422 "Empresa sem portador configurado"</code> — Configure um portador antes de gerar boletos.</p>
                     </div>
                   </div>

                   {/* Pagination Note */}
                   <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3 flex gap-3">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm text-blue-700">Padrões de Paginação</h4>
                      <div className="mt-2 space-y-1.5">
                        <div className="text-xs">
                          <span className="font-medium">Padrão 1 (Huggs):</span>{" "}
                          <code className="bg-muted px-1 rounded text-[11px]">pagina</code> + <code className="bg-muted px-1 rounded text-[11px]">registros_por_pagina</code>
                          <span className="text-muted-foreground"> — Contas a Pagar, Contas a Receber, Departamentos, Categorias</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Padrão 2 (Legado):</span>{" "}
                          <code className="bg-muted px-1 rounded text-[11px]">nPagina</code> + <code className="bg-muted px-1 rounded text-[11px]">nRegPorPagina</code>
                          <span className="text-muted-foreground"> — Contas Correntes, Lançamentos CC, Anexos</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Padrão 3 (REST):</span>{" "}
                          <code className="bg-muted px-1 rounded text-[11px]">limit</code> + <code className="bg-muted px-1 rounded text-[11px]">offset</code>
                          <span className="text-muted-foreground"> — Consultas avançadas (query endpoints)</span>
                        </div>
                      </div>

                      {/* Pagination Iteration Examples */}
                      <div className="mt-3">
                        <h5 className="font-medium text-xs mb-2">Como percorrer todas as páginas:</h5>
                        <Tabs defaultValue="js-pag" className="w-full">
                          <TabsList className="h-7">
                            <TabsTrigger value="js-pag" className="text-[11px]">JavaScript</TabsTrigger>
                            <TabsTrigger value="py-pag" className="text-[11px]">Python</TabsTrigger>
                          </TabsList>
                          <TabsContent value="js-pag" className="mt-1">
                            <CodeBlock code={`async function fetchAllPages(baseUrl, apiKey) {
  let pagina = 1, todas = [];
  while (true) {
    const res = await fetch(\`\${baseUrl}?pagina=\${pagina}&registros_por_pagina=500\`, {
      headers: { "x-api-key": apiKey }
    });
    const data = await res.json();
    todas.push(...(data.conta_pagar_cadastro || []));
    if (pagina >= data.total_de_paginas) break;
    pagina++;
  }
  return todas; // Array com TODOS os registros
}`} />
                          </TabsContent>
                          <TabsContent value="py-pag" className="mt-1">
                            <CodeBlock code={`def fetch_all_pages(base_url, api_key):
    pagina, todas = 1, []
    while True:
        r = requests.get(f"{base_url}?pagina={pagina}&registros_por_pagina=500",
                         headers={"x-api-key": api_key})
        data = r.json()
        todas.extend(data.get("conta_pagar_cadastro", []))
        if pagina >= data["total_de_paginas"]:
            break
        pagina += 1
    return todas  # Lista com TODOS os registros`} />
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  </div>

                  {/* Retry / Backoff Guide */}
                  <div className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-3 flex gap-3">
                    <RotateCcw className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm text-orange-700">Estratégia de Retry</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Quando receber <code className="bg-muted px-1 rounded">429</code> ou <code className="bg-muted px-1 rounded">5xx</code>, aplique backoff exponencial:
                      </p>
                      <div className="space-y-1 text-xs">
                        <div><span className="font-medium">1ª tentativa:</span> aguardar <code className="bg-muted px-1 rounded">Retry-After</code> header (ou 1s)</div>
                        <div><span className="font-medium">2ª tentativa:</span> aguardar 2s</div>
                        <div><span className="font-medium">3ª tentativa:</span> aguardar 4s</div>
                        <div className="text-muted-foreground mt-1">Máximo de 3 tentativas. Após isso, registrar erro e notificar.</div>
                      </div>
                      <CodeBlock code={`// Exemplo Node.js
async function fetchWithRetry(url, opts, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, opts);
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      const wait = parseInt(res.headers.get("Retry-After") || String(Math.pow(2, i)));
      await new Promise(r => setTimeout(r, wait * 1000));
    } else throw new Error(\`HTTP \${res.status}\`);
  }
  throw new Error("Max retries exceeded");
}`} />
                    </div>
                  </div>

                  {/* HMAC Webhook Verification Guide */}
                  <div className="border border-purple-500/30 bg-purple-500/5 rounded-lg p-3 flex gap-3">
                    <Shield className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm text-purple-700">Verificação HMAC de Webhooks</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Ao receber webhooks do BiMaster, verifique a assinatura <code className="bg-muted px-1 rounded">x-hub-signature-256</code> para garantir autenticidade:
                      </p>
                      <CodeBlock code={`// Node.js
const crypto = require("crypto");
function verifySignature(payload, signature, secret) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature), Buffer.from(expected)
  );
}`} label="Node.js" />
                      <div className="mt-2">
                        <CodeBlock code={`# Python
import hmac, hashlib
def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)`} label="Python" />
                      </div>
                    </div>
                  </div>

                  {/* Webhook Events Catalog */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-purple-500" />
                      Catálogo de Eventos Webhook
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Eventos disponíveis para assinatura via <code className="bg-muted px-1 rounded">webhook-subscriptions-api</code>. Use <code className="bg-muted px-1 rounded">GET /eventos</code> para lista atualizada em tempo real.
                    </p>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="grid grid-cols-[180px_1fr_180px] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                        <span>Evento</span>
                        <span>Descrição</span>
                        <span>Módulo</span>
                      </div>
                      {[
                        { event: "conta_pagar.criado", desc: "Novo título de AP incluído", mod: "Contas a Pagar" },
                        { event: "conta_pagar.alterado", desc: "Título de AP atualizado", mod: "Contas a Pagar" },
                        { event: "conta_pagar.pago", desc: "Baixa/pagamento registrado", mod: "Contas a Pagar" },
                        { event: "conta_pagar.cancelado", desc: "Título cancelado", mod: "Contas a Pagar" },
                        { event: "conta_receber.criado", desc: "Novo título de AR incluído", mod: "Contas a Receber" },
                        { event: "conta_receber.alterado", desc: "Título de AR atualizado", mod: "Contas a Receber" },
                        { event: "conta_receber.recebido", desc: "Recebimento registrado", mod: "Contas a Receber" },
                        { event: "cliente.criado", desc: "Novo cliente cadastrado", mod: "Clientes" },
                        { event: "cliente.alterado", desc: "Dados do cliente atualizados", mod: "Clientes" },
                        { event: "cliente.excluido", desc: "Cliente removido", mod: "Clientes" },
                        { event: "fornecedor.criado", desc: "Novo fornecedor cadastrado", mod: "Fornecedores" },
                        { event: "fornecedor.alterado", desc: "Dados do fornecedor atualizados", mod: "Fornecedores" },
                        { event: "fornecedor.excluido", desc: "Fornecedor removido", mod: "Fornecedores" },
                        { event: "departamento.criado", desc: "Novo departamento criado", mod: "Departamentos" },
                        { event: "departamento.alterado", desc: "Departamento atualizado", mod: "Departamentos" },
                        { event: "categoria.criado", desc: "Nova categoria criada", mod: "Categorias" },
                        { event: "categoria.alterado", desc: "Categoria atualizada", mod: "Categorias" },
                        { event: "projeto.criado", desc: "Novo projeto criado", mod: "Projetos" },
                        { event: "projeto.alterado", desc: "Projeto atualizado", mod: "Projetos" },
                        { event: "conta_corrente.criado", desc: "Nova conta corrente criada", mod: "Contas Correntes" },
                        { event: "conta_corrente.alterado", desc: "Conta corrente atualizada", mod: "Contas Correntes" },
                        { event: "lancamento_cc.criado", desc: "Novo lançamento em conta corrente", mod: "Lançamentos CC" },
                        { event: "tarefa.criado", desc: "Nova tarefa criada", mod: "Tarefas" },
                        { event: "tarefa.alterado", desc: "Tarefa atualizada", mod: "Tarefas" },
                        { event: "tarefa.concluido", desc: "Tarefa marcada como concluída", mod: "Tarefas" },
                      ].map(ev => (
                        <div key={ev.event} className="grid grid-cols-[180px_1fr_180px] gap-2 px-3 py-2 border-b last:border-b-0 text-xs hover:bg-muted/30">
                          <code className="font-mono text-[11px] text-primary">{ev.event}</code>
                          <span className="text-muted-foreground">{ev.desc}</span>
                          <Badge variant="outline" className="text-[10px] w-fit">{ev.mod}</Badge>
                        </div>
                      ))}
                    </div>

                    {/* Webhook Payload Example */}
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Webhook className="h-4 w-4 text-purple-500" />
                        Exemplo de Payload Recebido
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Este é o formato exato do JSON que seu endpoint receberá via POST quando um evento for disparado:
                      </p>
                      <CodeBlock code={`// POST para sua URL de webhook
// Headers:
//   Content-Type: application/json
//   x-hub-signature-256: sha256=a1b2c3d4e5...
//   x-webhook-event: conta_pagar.criado
//   x-delivery-id: uuid-da-entrega

{
  "event": "conta_pagar.criado",
  "timestamp": "2026-03-23T22:00:00.000Z",
  "delivery_id": "550e8400-e29b-41d4-a716-446655440000",
  "subscription_id": "uuid-da-assinatura",
  "data": {
    "id": "uuid-do-titulo",
    "codigo_lancamento_integracao": "INT-001",
    "empresa_id": 5,
    "fornecedor_nome": "ABC Ltda",
    "fornecedor_codigo": "codigo-do-fornecedor",
    "valor_documento": 1500.00,
    "data_vencimento": "2026-04-15",
    "status": "pendente",
    "categoria_codigo": "2.04.01",
    "created_at": "2026-03-23T22:00:00.000Z"
  }
}`} label="Payload completo de webhook" />
                      <p className="text-[11px] text-muted-foreground mt-2">
                        ATENCAO: Seu endpoint deve retornar <code className="bg-muted px-1 rounded">200 OK</code> em ate 30s. Caso contrario, o dispatcher reenviara ate 3x com backoff exponencial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
             )}

            {/* ═══ FAQ / TROUBLESHOOTING ═══ */}
            {!searchQuery && (
              <div ref={el => { moduleRefs.current["faq"] = el; }}>
                <div className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 p-4 mb-4">
                  <div className="flex items-center gap-3 text-white">
                    <HelpCircle className="h-5 w-5" />
                    <div>
                      <h3 className="font-semibold text-base">FAQ & Troubleshooting</h3>
                      <p className="text-sm text-white/80">Problemas comuns e soluções rápidas</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-5 space-y-3">
                  {[
                    {
                      q: "Recebo 401 mas minha API Key está correta",
                      a: "Verifique se a chave não foi desativada no portal. Chaves expiram após rotação. Gere uma nova chave em Gerenciar Chaves API e substitua no seu sistema.",
                    },
                    {
                      q: "Erro 'campo_obrigatorio: empresa_id' no /upsert",
                      a: "O campo empresa_id é obrigatório em operações de upsert (tanto CP quanto CR) pois é usado na cláusula onConflict. Inclua-o sempre no body.",
                    },
                    {
                      q: "Criei um título mas ele não aparece na listagem",
                      a: "Verifique: (1) os cadastros base foram sincronizados primeiro (fornecedor, categoria)? (2) Está filtrando por empresa_id correto? (3) Limite de paginação — use registros_por_pagina=500.",
                    },
                    {
                      q: "Qual a diferença entre Categorias e Plano de Contas?",
                      a: "Categorias são agrupamentos internos do BiMaster (receita/despesa). Plano de Contas é a estrutura contábil oficial do ERP. Ambos podem ser usados para classificação, mas servem propósitos diferentes.",
                    },
                    {
                      q: "Meu webhook não está recebendo eventos",
                      a: "Verifique: (1) A URL é acessível publicamente (HTTPS). (2) Assinatura está ativa (GET /webhook-subscriptions-api/listar). (3) Use POST /testar para validar. (4) O dispatcher precisa estar ativo (POST /webhook-dispatcher/process).",
                    },
                    {
                      q: "Recebo 429 Too Many Requests",
                      a: "O rate limit é de 60 req/min por IP ou API key. Implemente backoff exponencial (1s → 2s → 4s). Para cargas em lote, use endpoints de upsert-lote com até 500 registros por chamada.",
                    },
                    {
                      q: "Formato de data — DD/MM/AAAA ou YYYY-MM-DD?",
                      a: "Entrada: aceita DD/MM/AAAA ou YYYY-MM-DD (recomendado: DD/MM/AAAA). Saída (listagens e webhooks): sempre retorna em formato ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss.sssZ). Seu parser deve aceitar ambos os formatos na leitura.",
                    },
                    {
                      q: "Como saber se a API está online?",
                      a: "Cada API tem um endpoint GET /status que retorna 200 OK. Os badges verdes/vermelhos nesta documentação fazem essa verificação em tempo real.",
                    },
                  ].map((faq, i) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-start gap-3 p-3 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors">
                          <MessageCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm font-medium text-foreground">{faq.q}</span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-10 mr-3 mb-2 p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            )}

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
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground">{api.name}</span>
                                <ApiStatusBadge basePath={api.basePath} />
                                {PAGINATION_PATTERNS[api.id] && (
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${PAGINATION_LABELS[PAGINATION_PATTERNS[api.id]].color}`}>
                                    {PAGINATION_LABELS[PAGINATION_PATTERNS[api.id]].label}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{api.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono">v1</Badge>
                          <Badge variant="secondary" className="text-[10px]">{epCount}</Badge>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t bg-muted/10">
                            <div className="mt-3 space-y-1">
                              <div className="flex items-center gap-2 mb-3">
                                <code className="text-[11px] font-mono text-muted-foreground">
                                  Base: {DOC_BASE_URL}{api.basePath}
                                </code>
                                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[9px]">
                                  <Globe className="h-2.5 w-2.5 mr-1" />
                                  Produção
                                </Badge>
                              </div>
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
                    <CodeBlock code={`curl -H "x-api-key: huggs-erp-xxxxxxxxxxxxxxxx" \\\n  "${DOC_BASE_URL}/contas-pagar-api/query"`} />
                    <p className="text-xs text-muted-foreground mt-2">
                      Gere chaves no Portal acima. Validação via SHA-256 hash com timing-safe comparison.
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <span className="font-medium text-sm">JWT (Bearer Token)</span>
                    <CodeBlock code={`curl -H "Authorization: Bearer eyJhbGciOiJI..." \\\n  "${DOC_BASE_URL}/erp-export-payment"`} />
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
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { code: "400", label: "Parâmetros inválidos" },
                      { code: "401", label: "API key inválida" },
                      { code: "404", label: "Rota não encontrada" },
                      { code: "409", label: "Recurso duplicado" },
                      { code: "429", label: "Rate limit excedido" },
                      { code: "500", label: "Erro interno" },
                    ].map(e => (
                      <div key={e.code} className="border rounded-lg p-2 text-center">
                        <code className="text-sm font-bold font-mono">{e.code}</code>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{e.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    💡 <strong>409 Conflict</strong>: Retornado quando <code className="bg-muted px-1 rounded">codigo_lancamento_integracao</code> já existe. Use <code className="bg-muted px-1 rounded">/upsert</code> para evitar.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Estrutura de Erros</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Todas as APIs retornam erros com estrutura padronizada:
                  </p>
                  <CodeBlock code={`// Erro de validação (400)
{ "error": "campo_obrigatorio", "message": "O campo codigo_lancamento_integracao é obrigatório", "field": "codigo_lancamento_integracao" }

// Erro de autenticação (401)
{ "error": "unauthorized", "message": "API key inválida ou ausente" }

// Rate limit (429)
{ "error": "rate_limit", "message": "Limite de 60 req/min excedido", "retry_after": 60 }

// Erro interno (500)
{ "error": "internal_error", "message": "Erro ao processar requisição", "request_id": "uuid" }`} label="Exemplos de resposta de erro" />
                </div>

                {/* Endpoint-specific Errors */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Erros Específicos por Endpoint</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Além dos códigos HTTP genéricos, cada endpoint pode retornar erros específicos no campo <code className="bg-muted px-1 rounded">error</code>:
                  </p>
                  <div className="space-y-3">
                    {[
                      {
                        api: "CP /incluir",
                        errors: [
                          { code: "fornecedor_nao_encontrado", desc: "O codigo_cliente_fornecedor não existe no cadastro" },
                          { code: "categoria_invalida", desc: "O codigo_categoria não existe ou está inativo" },
                          { code: "data_invalida", desc: "Formato de data incorreto (esperado DD/MM/AAAA)" },
                          { code: "duplicidade", desc: "Já existe título com este codigo_lancamento_integracao" },
                          { code: "conta_corrente_invalida", desc: "O id_conta_corrente não existe" },
                        ],
                      },
                      {
                        api: "CP /upsert",
                        errors: [
                          { code: "empresa_id_obrigatorio", desc: "Campo empresa_id é obrigatório para resolver conflito" },
                          { code: "conflito_integracao", desc: "codigo_lancamento_integracao duplicado em outra empresa" },
                        ],
                      },
                      {
                        api: "CR /incluir",
                        errors: [
                          { code: "cliente_nao_encontrado", desc: "O codigo_cliente_fornecedor não existe no cadastro" },
                          { code: "categoria_invalida", desc: "O codigo_categoria não existe ou está inativo" },
                          { code: "data_invalida", desc: "Formato de data incorreto (esperado DD/MM/AAAA)" },
                        ],
                      },
                      {
                        api: "Fornecedores /incluir",
                        errors: [
                          { code: "cnpj_invalido", desc: "CPF/CNPJ com formato ou dígitos verificadores inválidos" },
                          { code: "duplicidade_cnpj", desc: "Já existe fornecedor com este CPF/CNPJ" },
                          { code: "empresa_nao_encontrada", desc: "Um dos empresa_ids fornecidos não existe" },
                        ],
                      },
                      {
                        api: "Boletos /gerar",
                        errors: [
                          { code: "titulo_nao_encontrado", desc: "O nCodTitulo ou cCodIntTitulo não existe no Contas a Receber" },
                          { code: "boleto_ja_gerado", desc: "Já existe boleto ativo para este título" },
                          { code: "titulo_liquidado", desc: "Título já está liquidado, não é possível gerar boleto" },
                          { code: "conta_corrente_sem_boleto", desc: "A conta corrente do título não está habilitada para boletos" },
                        ],
                      },
                      {
                        api: "Contas Correntes /incluir",
                        errors: [
                          { code: "codigo_duplicado", desc: "Já existe conta corrente com este cCodCCInt" },
                          { code: "banco_invalido", desc: "O codigo_banco informado não existe na tabela de bancos" },
                          { code: "tipo_invalido", desc: "O tipo_conta_corrente deve ser CC, CP, CX, CI, CM ou PI" },
                        ],
                      },
                      {
                        api: "Lançamentos CC /incluir",
                        errors: [
                          { code: "conta_corrente_invalida", desc: "O nCodCC não existe ou está inativo" },
                          { code: "categoria_invalida", desc: "O cCodCateg não existe no plano de contas" },
                          { code: "data_invalida", desc: "Formato de data incorreto (esperado DD/MM/AAAA)" },
                          { code: "duplicidade", desc: "Já existe lançamento com este cCodIntLanc" },
                        ],
                      },
                    ].map(group => (
                      <Collapsible key={group.api}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded-lg cursor-pointer">
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <code className="text-xs font-mono font-medium">{group.api}</code>
                            <Badge variant="secondary" className="text-[10px]">{group.errors.length} erros</Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-5 border rounded-lg overflow-hidden text-xs">
                            {group.errors.map(e => (
                              <div key={e.code} className="grid grid-cols-[200px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                                <code className="font-mono text-[11px] text-red-600">{e.code}</code>
                                <span className="text-muted-foreground">{e.desc}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>

                {/* Key Rotation Guide */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Rotação de API Key (sem downtime)</h4>
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      {[
                        { step: "1", text: "Gerar nova chave no Portal" },
                        { step: "2", text: "Atualizar chave no seu sistema" },
                        { step: "3", text: "Testar com GET /status" },
                        { step: "4", text: "Desativar chave antiga" },
                      ].map((s, i) => (
                        <span key={s.step} className="flex items-center gap-1">
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">{s.step}</span>
                          <span className="text-xs">{s.text}</span>
                          {i < 3 && <span className="text-muted-foreground ml-1">→</span>}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      A chave antiga permanece valida por 24h apos rotacao (<code className="bg-muted px-1 rounded">api_key_anterior_expira_em</code>), permitindo transicao gradual.
                    </p>
                  </div>
                </div>

                {/* Consolidated Quotas */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Limites & Quotas</h4>
                  <div className="border rounded-lg overflow-hidden text-xs">
                    <div className="grid grid-cols-[200px_120px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                      <span>Recurso</span><span>Limite</span><span>Detalhes</span>
                    </div>
                    {[
                      { resource: "Rate limit global", limit: "60 req/min", detail: "Por IP ou API key. Header Retry-After em 429." },
                      { resource: "Upsert em lote", limit: "500 registros", detail: "Por chamada. Use múltiplas chamadas para volumes maiores." },
                      { resource: "Sync legado", limit: "5.000 registros", detail: "Por request de sincronização." },
                      { resource: "Payload máximo", limit: "200 KB", detail: "Body JSON. Para anexos, use base64 com md5." },
                      { resource: "Timeout de requisição", limit: "30 segundos", detail: "Após 30s a requisição é abortada." },
                      { resource: "Webhook delivery", limit: "3 tentativas", detail: "Backoff: 1s → 2s → 4s. Após: dead letter." },
                    ].map(q => (
                      <div key={q.resource} className="grid grid-cols-[200px_120px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                        <span className="font-medium">{q.resource}</span>
                        <code className="font-mono text-[11px] text-primary">{q.limit}</code>
                        <span className="text-muted-foreground">{q.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SDK Downloads */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">SDKs Prontos para Download</h4>
                  <div className="border rounded-lg p-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      SDKs com métodos tipados para todas as APIs. Basta instanciar com sua API Key e começar a usar.
                    </p>
                    <SdkDownloadButtons />
                  </div>
                </div>

                {/* Versioning Policy */}
                <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3 flex gap-3">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-blue-700">Política de Versionamento</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                       Todas as APIs estão em <strong>v1</strong> (estável). Breaking changes serão comunicados com <strong>90 dias de antecedência</strong> via webhook e e-mail cadastrado.
                      Versões anteriores permanecerão ativas por no mínimo <strong>6 meses</strong> após o lançamento de uma nova versão, disponibilizada em <code className="bg-muted px-1 rounded">/v2</code>.
                      Campos novos podem ser adicionados a qualquer momento (aditivos, não-breaking) — seu parser deve ignorar campos desconhecidos.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Glossário de Termos */}
            {!searchQuery && (
              <div ref={el => { moduleRefs.current["glossary"] = el; }}>
                <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 p-4 mb-4">
                  <div className="flex items-center gap-3 text-white">
                    <BookOpen className="h-5 w-5" />
                    <div>
                      <h3 className="font-semibold text-base">Glossário de Termos</h3>
                      <p className="text-sm text-white/80">O que significa cada campo técnico nas APIs</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-5 space-y-4">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[220px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide">
                      <span>Campo</span><span>Significado</span>
                    </div>
                    {[
                      { campo: "codigo_lancamento_integracao", desc: "Seu ID externo. É a chave única que conecta o título no seu ERP com o BiMaster. Deve ser único por empresa." },
                      { campo: "codigo_cliente_fornecedor", desc: "Código numérico do fornecedor ou cliente já cadastrado. Consulte via GET /clientes-api/listar." },
                      { campo: "id_conta_corrente", desc: "ID numérico da conta bancária onde será debitado/creditado. Consulte via GET /contas-correntes-api/listar." },
                      { campo: "codigo_categoria", desc: "Código hierárquico da natureza financeira (ex: '2.04.01' = Despesas > Operacionais > Aluguel). Consulte via GET /categorias-api/listar." },
                      { campo: "data_previsao", desc: "Data prevista para pagamento efetivo (pode diferir do vencimento). Formato DD/MM/AAAA." },
                      { campo: "empresa_id", desc: "ID numérico da empresa no BiMaster. Obrigatório em upsert para resolver conflitos multi-empresa." },
                      { campo: "numero_documento", desc: "Número da nota fiscal, boleto ou documento fiscal associado ao título." },
                      { campo: "codigo_projeto", desc: "Código do centro de projeto/custo para rateio gerencial. Consulte via GET /projetos-api/listar." },
                      { campo: "data_vencimento", desc: "Entrada: aceita DD/MM/AAAA ou YYYY-MM-DD (recomendado: DD/MM/AAAA). Saída (listagens e webhooks): sempre retorna em formato ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss.sssZ)." },
                      { campo: "valor_documento", desc: "Valor nominal do título (positivo, em reais). Não inclui juros/multa." },
                      { campo: "c_cod_int_titulo", desc: "Código de integração do título no ERP legado (Omie). Usado internamente." },
                      { campo: "n_cod_titulo", desc: "ID numérico sequencial do título no sistema financeiro." },
                      { campo: "status_titulo", desc: "Estado do título: 'pendente', 'pago', 'cancelado', 'vencido'. Calculado automaticamente pela data de vencimento." },
                    ].map(item => (
                      <div key={item.campo} className="grid grid-cols-[220px_1fr] gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30">
                        <code className="font-mono text-[11px] text-primary">{item.campo}</code>
                        <span className="text-xs text-muted-foreground">{item.desc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Erros Comuns */}
                  <h4 className="font-semibold text-sm mt-4 mb-2">Erros Comuns e Soluções</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[80px_200px_1fr_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide">
                      <span>Código</span><span>Mensagem</span><span>Causa</span><span>Solução</span>
                    </div>
                    {[
                      { code: "400", msg: "Validation error", cause: "Campo obrigatório ausente ou formato inválido", fix: "Verifique o schema Zod do endpoint. Use .strict() — campos extras são rejeitados." },
                      { code: "401", msg: "API key inválida", cause: "Chave inexistente, expirada ou revogada", fix: "Gere uma nova chave no portal ou verifique se está enviando no header x-api-key." },
                      { code: "403", msg: "Forbidden", cause: "Key ativa mas sem permissão para esta empresa", fix: "Verifique se a key está vinculada à empresa correta." },
                      { code: "404", msg: "Rota não encontrada", cause: "Endpoint ou path incorreto", fix: "Confira a documentação. Ex: /contas-pagar-api/incluir (não /api/contas-pagar/incluir)." },
                      { code: "409", msg: "Duplicidade", cause: "codigo_lancamento_integracao já existe", fix: "Use /upsert em vez de /incluir, ou altere o código de integração." },
                      { code: "422", msg: "Entidade não processável", cause: "Dados válidos mas incoerentes (ex: fornecedor inexistente)", fix: "Verifique se as entidades referenciadas existem (fornecedor, categoria, conta corrente)." },
                      { code: "429", msg: "Too Many Requests", cause: "Excedeu 60 req/min", fix: "Implemente backoff exponencial. Use o header Retry-After." },
                      { code: "500", msg: "Internal Server Error", cause: "Erro interno (raro)", fix: "Tente novamente em 5s. Se persistir, envie o request_id ao suporte." },
                    ].map(item => (
                      <div key={item.code + item.msg} className="grid grid-cols-[80px_200px_1fr_1fr] gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30">
                        <Badge variant={item.code.startsWith("4") ? "outline" : "destructive"} className="text-[10px] h-5 justify-center">{item.code}</Badge>
                        <code className="font-mono text-[10px]">{item.msg}</code>
                        <span className="text-xs text-muted-foreground">{item.cause}</span>
                        <span className="text-xs text-muted-foreground">{item.fix}</span>
                      </div>
                    ))}
                  </div>

                  {/* FAQ Técnico */}
                  <h4 className="font-semibold text-sm mt-4 mb-2">FAQ Técnico — 10 Perguntas Mais Frequentes</h4>
                  <div className="space-y-2">
                    {[
                      { q: "Como listar todos os fornecedores de uma empresa?", a: "GET /clientes-api/listar?tipo=fornecedor&empresa_id=SEU_ID. A resposta usa paginação Huggs (pagina, registros_por_pagina)." },
                      { q: "Qual a diferença entre /incluir e /upsert?", a: "/incluir cria um novo título e falha se o codigo_lancamento_integracao já existir (409). /upsert cria ou atualiza automaticamente — ideal para sincronização." },
                      { q: "Como tratar paginação nas listagens?", a: "Envie pagina=1&registros_por_pagina=50. A resposta traz total_registros e total_paginas. Itere incrementando pagina até total_paginas." },
                      { q: "Posso enviar campos extras no body?", a: "Não. Todos os schemas usam Zod .strict() — campos não documentados retornam erro 400. Envie apenas os campos listados na documentação." },
                      { q: "Como autenticar minhas chamadas?", a: "Envie o header x-api-key com sua chave gerada no portal. Ex: x-api-key: huggs-erp-xxxx. Não use Bearer Token." },
                      { q: "Como testar sem afetar dados reais?", a: "Use o toggle 'Sandbox' no API Tester do portal. Chamadas sandbox simulam respostas realistas sem gravar dados." },
                      { q: "O que é codigo_lancamento_integracao?", a: "É o ID que seu sistema usa para identificar o título. Deve ser único por empresa. É a chave de ligação entre seu ERP e o BiMaster." },
                      { q: "Como registrar um pagamento (baixa)?", a: "POST /contas-pagar-api/lancar-pagamento com {codigo_lancamento_integracao, valor, data}. O título deve existir e estar pendente." },
                      { q: "Como receber notificações de mudanças?", a: "Configure webhooks em POST /webhook-subscriptions-api/incluir com a URL do seu servidor e a lista de eventos desejados. Eventos disponíveis seguem o padrão: conta_pagar.criado, conta_pagar.alterado, conta_pagar.pago, conta_receber.criado, conta_receber.recebido, entre outros. Consulte o Catálogo de Eventos acima para a lista completa dos 25 eventos." },
                      { q: "Posso usar a API com Python/Node/PHP?", a: "Sim! Baixe os SDKs prontos (JS e Python) no portal, ou use os exemplos cURL/PHP na documentação de cada endpoint." },
                    ].map((item, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <p className="text-xs font-medium mb-1">{item.q}</p>
                        <p className="text-xs text-muted-foreground">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Security Section */}
            {!searchQuery && (
              <div ref={el => { moduleRefs.current["security"] = el; }}>
                <div className="rounded-xl bg-gradient-to-r from-red-700 to-red-600 p-4 mb-4">
                  <div className="flex items-center gap-3 text-white">
                    <Lock className="h-5 w-5" />
                    <div>
                      <h3 className="font-semibold text-base">Segurança & Criptografia</h3>
                      <p className="text-sm text-white/80">Como seus dados são protegidos em todas as camadas</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { title: "TLS 1.3 + HSTS", desc: "Todas as comunicacoes sao criptografadas em transito via TLS 1.3. HSTS garante que conexoes HTTP sejam promovidas para HTTPS.", icon: <Lock className="h-4 w-4 text-red-500" /> },
                      { title: "AES-256-GCM", desc: "Dados sensiveis em repouso (tokens OAuth, credenciais) sao criptografados com AES-256-GCM via Vault (pgcrypto).", icon: <Shield className="h-4 w-4 text-red-500" /> },
                      { title: "SHA-256 HMAC", desc: "Webhooks outbound sao assinados com HMAC-SHA256. API keys sao armazenadas como hash SHA-256, nunca em plaintext.", icon: <Lock className="h-4 w-4 text-red-500" /> },
                      { title: "Timing-Safe Compare", desc: "Comparacao de API keys e tokens usa algoritmo constant-time para prevenir timing attacks.", icon: <Clock className="h-4 w-4 text-red-500" /> },
                      { title: "CSP + Security Headers", desc: "Todas as Edge Functions incluem Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff.", icon: <Shield className="h-4 w-4 text-red-500" /> },
                      { title: "WAF L7 em Codigo", desc: "Middleware de protecao contra SQL Injection (20+ patterns), XSS (10+ patterns), Path Traversal e bots maliciosos.", icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
                    ].map(s => (
                      <div key={s.title} className="border rounded-lg p-3">
                         <div className="flex items-center gap-2 mb-1">
                           {s.icon}
                          <span className="font-medium text-sm">{s.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-3 flex gap-3">
                    <Shield className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm text-emerald-700">Garantias para o Integrador</h4>
                      <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                        <li>-- Tokens OAuth nunca trafegam em plaintext -- criptografia server-side via Vault</li>
                        <li>-- API Keys sao armazenadas como hash SHA-256 -- mesmo com acesso ao banco, nao e possivel reconstruir a chave</li>
                        <li>-- Rate limiting de 60 req/min protege contra DDoS e abuso</li>
                        <li>-- Audit logging completo -- toda operacao de escrita e registrada para rastreabilidade</li>
                        <li>-- RLS (Row Level Security) em todas as tabelas -- isolamento total entre empresas</li>
                        <li>-- Validacao Zod .strict() -- rejeicao de campos nao documentados (Mass Assignment Protection)</li>
                      </ul>
                    </div>
                  </div>

                  {/* Headers de Seguranca Retornados */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      Headers de Seguranca Retornados
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      Toda resposta da API inclui os seguintes headers de seguranca automaticamente:
                    </p>
                    <div className="border rounded-lg overflow-hidden text-xs">
                      <div className="grid grid-cols-[220px_1fr] gap-2 px-3 py-2 bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b">
                        <span>Header</span><span>Valor / Descricao</span>
                      </div>
                      {[
                        { header: "X-Content-Type-Options", value: "nosniff -- impede que o navegador interprete conteudo como tipo diferente do declarado" },
                        { header: "X-Frame-Options", value: "DENY -- bloqueia embedding da resposta em iframes (protecao contra clickjacking)" },
                        { header: "Referrer-Policy", value: "strict-origin-when-cross-origin -- limita informacoes de referrer em requisicoes cross-origin" },
                        { header: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' *.bimaster.online" },
                        { header: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self) -- restringe acesso a APIs do navegador" },
                        { header: "Cache-Control", value: "no-store, no-cache (em endpoints sensiveis) -- impede cache de dados confidenciais" },
                      ].map(h => (
                        <div key={h.header} className="grid grid-cols-[220px_1fr] gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                          <code className="font-mono text-[11px] text-primary">{h.header}</code>
                          <span className="text-muted-foreground">{h.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Boas Praticas para o Integrador */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-red-500" />
                      Boas Praticas para o Integrador
                    </h4>
                    <div className="border rounded-lg p-3 space-y-2">
                      <ul className="text-xs text-muted-foreground space-y-2">
                        <li><strong>Armazenamento da API Key:</strong> Nunca inclua a chave diretamente no codigo-fonte. Use variaveis de ambiente (ex: process.env.HUGGS_API_KEY) e arquivos .env que nao sejam versionados.</li>
                        <li><strong>Validacao HMAC em Webhooks:</strong> Sempre valide a assinatura x-hub-signature-256 antes de processar qualquer payload de webhook. Compare usando algoritmo constant-time para evitar timing attacks.</li>
                        <li><strong>Retry com Backoff Exponencial:</strong> Em caso de erro 429 ou 5xx, implemente retry automatico com intervalos crescentes (1s, 2s, 4s, 8s). Respeite o header Retry-After quando presente.</li>
                        <li><strong>Nao Logar Dados Sensiveis:</strong> Evite registrar payloads completos em logs de producao. Mascare campos como CPF, CNPJ, valores financeiros e tokens em qualquer saida de log.</li>
                        <li><strong>HTTPS Obrigatorio:</strong> Todas as chamadas devem usar HTTPS. Conexoes HTTP sao rejeitadas automaticamente pelo servidor.</li>
                        <li><strong>Rotacao Periodica de Chaves:</strong> Troque sua API Key a cada 90 dias. O sistema suporta transicao com 24h de sobreposicao entre chave antiga e nova.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Isolamento de Dados */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Database className="h-4 w-4 text-red-500" />
                      Isolamento de Dados (Multi-Tenant)
                    </h4>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        O sistema implementa Row Level Security (RLS) em todas as tabelas do banco de dados. Isso garante que mesmo com uma API Key valida, 
                        a empresa A jamais conseguira acessar ou modificar dados da empresa B. O isolamento e aplicado na camada de banco de dados, 
                        tornando-o independente da aplicacao. Cada requisicao autenticada e filtrada automaticamente pelo empresa_id vinculado a chave.
                      </p>
                    </div>
                  </div>

                  {/* Audit Trail */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      Audit Trail (Rastreabilidade)
                    </h4>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        Toda operacao de escrita (incluir, alterar, excluir, pagamentos, cancelamentos) gera automaticamente um registro de auditoria contendo: 
                        IP de origem, timestamp UTC, user_id ou API Key utilizada, endpoint chamado e payload resumido. 
                        Esses registros sao imutaveis e retidos por 12 meses, permitindo rastreabilidade completa para compliance e investigacao de incidentes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Changelog */}
            {!searchQuery && (
              <div ref={el => { moduleRefs.current["changelog"] = el; }}>
                <div className="rounded-xl bg-gradient-to-r from-slate-600 to-slate-500 p-4 mb-4">
                  <div className="flex items-center gap-3 text-white">
                    <History className="h-5 w-5" />
                    <div>
                      <h3 className="font-semibold text-base">Changelog</h3>
                      <p className="text-sm text-white/80">Histórico de mudanças na API</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-5 space-y-3">
                   {[
                   { version: "v4.5.1 / SDK v3.3.1 / APP v3.5.98", date: "2026-07-16", changes: [
                     "MINHAS TAREFAS / CENTRAL DE TRABALHO — force-refresh global (bump `APP_VERSION` 3.5.97 → 3.5.98) para propagar a correção dos gatilhos destrutivos em `projeto_tarefa_responsaveis` (migração `20260716134908`) que zeravam `responsavel_id` e removiam vínculos ao trocar responsável. Usuária Paloma e outros continuavam sem enxergar suas tarefas em `Minhas Tarefas` e na visão de projeto porque o bundle JS estava preso em versão anterior no Service Worker (deadlock de cache documentado em `docs/audits/2026-05-stale-cache-audit.md`). O bump dispara heartbeat via `<meta name=\"app-version\">`, `clearAllCaches()` e desregistro do SW antigo, forçando reload do bundle novo em todos os clientes ativos. Sem mudança de RPC, RLS, hook, UI ou schema. Invariantes grep: `grep -n '3.5.98' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.5.1 / SDK v3.3.1 / APP v3.5.96", date: "2026-07-06", changes: [
                     "CONTAS-PAGAR-API — redeploy forçado (API_VERSION `2.4.0` → `2.4.1`) para restabelecer o aceite de `departamento_id` / `plano_contas_id` / `natureza_lancamento` em `POST /incluir` e `POST /upsert`. O bundle deployado estava servindo o `IncluirSchema` antigo (pré-Passo 1a) e rejeitava aceites da Central de Pagamentos com `Payload inválido: : Unrecognized key(s) in object: 'departamento_id'` (400), embora `supabase/functions/_shared/contas-pagar/types.ts` já declarasse os 3 campos. Alterado: `API_VERSION` em `_shared/contas-pagar/utils.ts` e comentário-bump em `contas-pagar-api/index.ts` (força hash diferente do arquivo de entrada e permite verificar pelo envelope `api_version` que o novo bundle subiu). Zero mudança de schema, RPC, RLS, SDK público ou payload do frontend — `useFinancialPaymentQueue.acceptPayment` continua mandando os mesmos campos. Invariantes grep: `grep -n \"API_VERSION = '2.4.1'\" supabase/functions/_shared/contas-pagar/utils.ts | wc -l` ≥ 1; `grep -n 'v2.4.1 redeploy bump' supabase/functions/contas-pagar-api/index.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.5.0 / SDK v3.3.1 / APP v3.5.96", date: "2026-07-05", changes: [
                     "CACHE BUSTING REFORÇADO — endurecimento aditivo do protocolo anti-cache (`mem://pwa/anti-cache-versioning`) para garantir que clientes sempre carreguem o bundle novo. (1) `vite.config.ts` — `appVersionMetaPlugin` passa a injetar também `<meta name=\"app-build-id\" content=\"<timestamp>\">` além da já existente `app-version`, permitindo distinguir dois deploys com a mesma `APP_VERSION` (hotfix sem bump). Hashes de asset (`assets/js/[name]-[hash].js`, `assets/[name]-[hash].ext`) já existiam. (2) `src/lib/version.ts` — `getDeployedVersionFromHtml()` agora retorna `{ version, buildId }` (com `cache: no-store` + query `?ts=<now>`); novo `getLocalBuildId()` lê a meta injetada no bundle atual; `isVersionMismatch()` compara ambos e aceita string por retrocompatibilidade. (3) `src/contexts/PWAContext.tsx` — heartbeat ganha polling periódico a cada 3 min (além do já existente em `visibilitychange`); ao detectar 2 checks consecutivos de divergência **sem reload-gate ativo** dispara `forceCleanReload()` automático (limpa Cache Storage, desregistra Service Workers e recarrega com `?v=<now>`), preservando o comportamento de aguardar drawer/dialog fechar quando gate ativo. Bump `APP_VERSION` 3.5.95 → 3.5.96. Sem mudança de RPC, RLS, schema, edge functions ou SDK público. Invariantes grep: `grep -n 'app-build-id' vite.config.ts | wc -l` ≥ 1; `grep -n 'getLocalBuildId' src/lib/version.ts | wc -l` ≥ 1; `grep -n 'heartbeatInterval' src/contexts/PWAContext.tsx | wc -l` ≥ 2; `grep -n '3.5.96' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.99 / SDK v3.3.1 / APP v3.5.95", date: "2026-07-05", changes: [
                     "CACHE — force-refresh global para desbloquear clientes presos em bundle antigo reportando tela branca após deploy recente. Bump `APP_VERSION` 3.5.94 → 3.5.95 dispara o heartbeat de versão (`<meta name=\"app-version\">`), `clearAllCaches()` e desregistro do Service Worker antigo, forçando reload do bundle novo em todos os clientes ativos (protocolo documentado em `mem://pwa/anti-cache-versioning` e `docs/audits/2026-05-stale-cache-audit.md`). Sem mudança de RPC, RLS, hook, UI ou schema. Invariantes grep: `grep -n '3.5.95' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.98 / SDK v3.3.1 / APP v3.5.94", date: "2026-07-03", changes: [
                     "MINHAS TAREFAS — separação de tarefas por papel do usuário para atender reclamações de que tarefas onde ele é apenas colaborador/seguidor apareciam misturadas com aquelas em que é responsável. (1) RPC `get_minhas_tarefas_central` agora calcula `papel` em 3 valores: `responsavel` (t.responsavel_id = auth.uid() OU está em `projeto_tarefa_responsaveis`), `colaborador` (só em `projeto_tarefa_colaboradores`) e `seguidor` (só em `projeto_tarefa_seguidores`); prioridade responsavel > colaborador > seguidor no DISTINCT ON quando o usuário aparece em mais de um vínculo. Assinatura, joins, ordenação e grants inalterados — não é breaking change (frontends que só checam `=== \"responsavel\"` continuam corretos). (2) `useMinhasTarefas` alarga `MinaTarefa.papel` para `\"responsavel\" | \"colaborador\" | \"seguidor\"` e o mapper preserva os 3 valores. (3) `MinhasTarefasSimples.tsx` ganha um novo `Select` \"Meu papel\" com opções Todos os papéis / Responsável / Colaborador / Seguindo, aplicado em `filtered` junto com origem/projeto/prioridade/busca; badge discreto (`bg-muted text-muted-foreground`, texto 10px) prefixa o título quando papel ≠ responsável para dar sinal visual imediato; contadores dos chips (Todas/Sem prazo/Para hoje/Atrasadas/Concluídas hoje) passam a respeitar o filtro de papel. Sem mudança em RLS, realtime, layout de coluna, Board, Calendar ou Central de Trabalho. Bump `APP_VERSION` 3.5.93 → 3.5.94. Invariantes grep: `grep -n 'PapelFilter' src/components/minhas-tarefas/MinhasTarefasSimples.tsx | wc -l` ≥ 2; `grep -n 'PapelBadge' src/components/minhas-tarefas/MinhasTarefasSimples.tsx | wc -l` ≥ 2; `grep -n \"'seguidor'\" src/hooks/useMinhasTarefas.ts | wc -l` ≥ 1; `grep -n '3.5.94' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.97 / SDK v3.3.1 / APP v3.5.93", date: "2026-07-03", changes: [
                     "MINHAS TAREFAS / CENTRAL DE TRABALHO — force-refresh global para propagar o fix da RPC `get_minhas_tarefas_central` (migração `20260703184644`) que passou a incluir tarefas onde o usuário é multi-responsável via `projeto_tarefa_responsaveis` além do `responsavel_id` principal. Usuária Paloma (e potencialmente outros) continuava sem enxergar tarefas atribuídas porque o bundle JS estava preso em versão anterior no Service Worker (deadlock de cache documentado em `docs/audits/2026-05-stale-cache-audit.md`). Bump `APP_VERSION` 3.5.92 → 3.5.93 dispara o heartbeat de versão via `<meta name=\"app-version\">`, `clearAllCaches()` e desregistro do SW antigo, forçando reload do bundle novo em todos os clientes ativos. Sem mudança de RPC, RLS, hook, UI ou schema. Invariantes grep: `grep -n '3.5.93' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.96 / SDK v3.3.1 / APP v3.5.92", date: "2026-07-03", changes: [
                     "MEUS PROJETOS / DETALHE DE TAREFA — aplicado o mesmo protocolo anti-pisca já usado em Central de Trabalho e Minhas Tarefas no drawer aberto por `/dashboard/projetos/<id>?tarefa=<id>`. Bug residual: o editor principal de Responsável/Seguidores (`TarefaResponsavelSeguidoresEditor.tsx`) ainda não fazia warm-up de `profile-mini` nem pré-decode do `avatar_url` ao abrir o picker; além disso, `SubtarefaResponsavelPicker.tsx` ainda invalidava as bridges de subtarefas com refetch ativo, podendo atropelar o patch otimista e trocar referências no painel. Fix: (1) `TarefaResponsavelSeguidoresEditor` agora usa `preloadedRef` + `queryClient.setQueryData(['profile-mini', uid], ...)` + `new window.Image()` para todos os membros assim que qualquer popover abre, garantindo avatar no mesmo frame da seleção; (2) `SubtarefaResponsavelPicker` passa a invalidar `projeto-tarefas-subtarefas-bridge` e `projeto-tarefas-subtarefas-bridge-mt` com `refetchType:'none'`, alinhado ao picker de seguidores; (3) `ProjetoTarefaDetalhe.tsx` memoiza `responsaveisDetalhe` e `seguidoresDetalhe` por assinatura estável (`user_id/nome/avatar_url`), evitando recriar arrays e re-renderizar o editor quando alterações de status, prioridade ou datas não mudam equipe. Sem RPC/RLS/schema/layout. Bump `APP_VERSION` 3.5.91 → 3.5.92. Invariantes grep: `grep -n 'preloadedRef' src/components/projetos/tarefa-detalhe/TarefaResponsavelSeguidoresEditor.tsx | wc -l` ≥ 2; `grep -n 'profile-mini' src/components/projetos/tarefa-detalhe/TarefaResponsavelSeguidoresEditor.tsx | wc -l` ≥ 2; `grep -n 'refetchType: \"none\"' src/components/projetos/tarefa-detalhe/SubtarefaResponsavelPicker.tsx | wc -l` ≥ 3; `grep -n 'responsaveisDetalheSignature' src/components/projetos/ProjetoTarefaDetalhe.tsx | wc -l` ≥ 2; `grep -n '3.5.92' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.95 / SDK v3.3.1 / APP v3.5.91", date: "2026-07-03", changes: [
                     "MEUS PROJETOS — corrigido flicker de avatares na linha da tarefa (`ProjetoTarefaRow.tsx`) ao adicionar/remover responsável e seguidor via os pickers da lista em `/dashboard/projetos/<id>`. Bug: mesmo com o patch otimista de `useProjetoTarefas.addColaborador/addResponsavel` atualizando `projeto-tarefas-v2` no mesmo frame do clique, o pill visível na linha usava `<Avatar><AvatarImage src={... || undefined} referrerPolicy=\"no-referrer\"/><AvatarFallback>...</AvatarFallback></Avatar>` bruto. Cada mudança do array recria o `<img>`, browser refaz decode e mostra o fallback de iniciais por ~100–300 ms antes da bitmap voltar do cache — flicker perceptível. Central de Trabalho e Minhas Tarefas já não piscavam porque usam `SmartAvatar`, que mantém `resolvedCache` de signed URLs em memória e renderiza o fallback colorido determinístico no primeiro paint (`3.5.89`). Fix: trocado o `Avatar/AvatarImage/AvatarFallback` bruto por `SmartAvatar` nos dois triggers visíveis da linha: (1) `PersonPicker` (responsável) — `SmartAvatar` com `identifier={current.id}` para hue estável e ring `ring-primary/20`; (2) `ColaboradoresPicker` (pill '+ Equipe') — `SmartAvatar` por colaborador com `identifier={c.user_id}` e `border-2 border-background`. Preservados tamanhos (h-6 w-6 / h-5 w-5), rings, borders e overlap (-space-x-1.5). Import de `SmartAvatar` adicionado ao topo do arquivo, `Avatar/AvatarImage/AvatarFallback` mantidos porque ainda são usados nas listas internas dos pickers (que só montam com o popover aberto — flicker imperceptível). Sem RPC/RLS/schema. Bump `APP_VERSION` 3.5.90 → 3.5.91. Invariantes grep: `grep -n 'SmartAvatar' src/components/projetos/ProjetoTarefaRow.tsx | wc -l` ≥ 3; `grep -n 'identifier={current.id}' src/components/projetos/ProjetoTarefaRow.tsx | wc -l` ≥ 1; `grep -n 'identifier={c.user_id}' src/components/projetos/ProjetoTarefaRow.tsx | wc -l` ≥ 1; `grep -n '3.5.91' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.94 / SDK v3.3.1 / APP v3.5.90", date: "2026-07-03", changes: [
                     "NAVEGAÇÃO — migração 100% dos usuários para o ambiente v2 (Beta). Antes o default era v1 (sidebar clássica) com opt-in por usuário via `user_ui_preferences.nav_version` e toggles no rodapé do menu e em Preferências. Agora: (1) `src/lib/featureFlags/navigationVersion.ts` — `DEFAULT_NAV_VERSION='v2'`, `getNavVersion` retorna `'v2'` incondicionalmente (ignora o valor gravado na coluna, inclusive `'v1'`), `useNavVersion` sempre resolve para `'v2'`. Migração sem SQL — coluna `nav_version` continua existindo por compatibilidade histórica mas seu valor não é lido. (2) Toggle removido de todas as superfícies: deletado `src/components/navigation/NavVersionToggle.tsx`, removidos os imports+renders em `src/components/dashboard/AppSidebar.tsx` (rodapé v1) e `src/components/navigation/v2/AppRail.tsx` (rail v2). (3) `src/pages/PreferenciasUI.tsx` — removido o card 'Navegação lateral' com radio v1/v2 e toda a mutation de upsert em `user_ui_preferences.nav_version`; página agora só contém o card 'Tema do Launcher'. Sem RPC/RLS/schema. Bump `APP_VERSION` 3.5.89 → 3.5.90. Invariantes grep: `grep -n \"DEFAULT_NAV_VERSION: NavVersion = \\\"v2\\\"\" src/lib/featureFlags/navigationVersion.ts | wc -l` ≥ 1; `grep -rn 'NavVersionToggle' src/ | wc -l` = 0; `grep -n 'nav_version' src/pages/PreferenciasUI.tsx | wc -l` = 0; `grep -n '3.5.90' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.93 / SDK v3.3.1 / APP v3.5.89", date: "2026-07-03", changes: [
                     "AVATARES — `SmartAvatar` (`src/components/ui/SmartAvatar.tsx`) agora renderiza um avatar padrão determinístico quando o usuário não tem `avatar_url`. Antes o fallback usava sempre `bg-primary/15 text-primary`, o que fazia todos os membros sem foto aparecerem com o mesmo pill roxo — visualmente indistinguíveis e fáceis de confundir com estado de loading. Fix: novo `computeFallbackStyle(seed)` deriva um hue estável (`hashSeed(seed) % 360`) usando `identifier` (ex.: user_id) como semente primária e `displayNome` como fallback; aplica `hsl(H 62% 46%)` como background e texto branco via `style` inline. Como o hue vem de hash puro sobre string estável, o mesmo usuário sempre renderiza a mesma cor entre sessões e componentes (Central de Trabalho, detalhe de tarefa, pickers, subtarefas) — o pill NÃO pisca nem muda ao re-renderizar. Fallback é síncrono: `<AvatarFallback>` já mostra iniciais + cor no primeiro paint, sem depender do fetch pós-save nem do `resolveOnce` de signed URL. Sem RPC/RLS/schema. Bump `APP_VERSION` 3.5.88 → 3.5.89. Invariantes grep: `grep -n 'computeFallbackStyle' src/components/ui/SmartAvatar.tsx | wc -l` ≥ 2; `grep -n 'hashSeed' src/components/ui/SmartAvatar.tsx | wc -l` ≥ 2; `grep -n '3.5.89' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.92 / SDK v3.3.1 / APP v3.5.88", date: "2026-07-03", changes: [
                     "TAREFAS / SUBTAREFAS — pré-carregamento de avatares dos membros do time ao abrir os pickers de responsável (`SubtarefaResponsavelPicker`) e seguidor (`SubtarefaSeguidoresPicker`). Quando o Popover abre, um `useEffect` percorre `useProjetoMembros().membros` (roda 1x por user_id via `preloadedRef: Set<string>`) e faz duas coisas para cada membro: (1) `queryClient.setQueryData(['profile-mini', uid], prev => prev ?? { id, nome, avatar_url })` — warm-up do cache lido por `resolvePessoa`/`enrichPessoaFromProfile` no `useProjetoTarefas`, evitando fetch redundante e permitindo o patch otimista já sair com nome+avatar reais; (2) `new window.Image(); img.decoding='async'; img.referrerPolicy='no-referrer'; img.src = avatar_url` — warm-up do cache HTTP do browser (bitmap fica em memory/disk cache). Efeito: ao clicar num membro, o `SmartAvatar` da linha da subtarefa exibe o `<img>` no MESMO frame do clique, sem placeholder de iniciais intermediário nem round-trip de rede. Preload é best-effort (try/catch silencioso) e não bloqueia render. Sem RPC/RLS/schema. Bump `APP_VERSION` 3.5.87 → 3.5.88. Invariantes grep: `grep -n 'preloadedRef' src/components/projetos/tarefa-detalhe/SubtarefaSeguidoresPicker.tsx src/components/projetos/tarefa-detalhe/SubtarefaResponsavelPicker.tsx | wc -l` ≥ 4; `grep -n \"'profile-mini'\" src/components/projetos/tarefa-detalhe/SubtarefaSeguidoresPicker.tsx src/components/projetos/tarefa-detalhe/SubtarefaResponsavelPicker.tsx | wc -l` ≥ 2; `grep -n '3.5.88' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.91 / SDK v3.3.1 / APP v3.5.87", date: "2026-07-03", changes: [
                     "TAREFAS / SUBTAREFAS — corrigido carregamento imediato do avatar ao adicionar seguidor via '+ Equipe' na linha de subtarefa (Central de Trabalho / Modo Foco). Bug: `addColaborador.onMutate` só aplicava patch otimista em `projeto-tarefas-v2` e `tarefa-junctions`, mas a subtarefa é renderizada por `SubtarefasSection` a partir de `projeto-tarefas-subtarefas-bridge` (e variante `-mt`), que ficava esperando refetch — o pill '+ Equipe' seguia no estado antigo por 200–800ms e o `SubtarefaSeguidoresPicker.invalidateAll` ainda invalidava esse bridge com `refetchType:'active'`, causando piscada. Fix: (1) novo helper `patchSubtarefasBridge(tarefaId, mutator)` em `src/hooks/useProjetoTarefas.ts` que faz `queryClient.getQueriesData` com predicate sobre as chaves `projeto-tarefas-subtarefas-bridge` e `projeto-tarefas-subtarefas-bridge-mt` e aplica patch por subtarefa. (2) `addColaborador.onMutate` e `removeColaborador.onMutate` agora chamam `patchSubtarefasBridge` alinhando `colaboradores[]` — o avatar aparece no mesmo frame. (3) Mesmo tratamento aplicado a `addResponsavel`/`removeResponsavel` (colateral: responsável de subtarefa também sincroniza sem depender do refetch). (4) `SubtarefaSeguidoresPicker.invalidateAll` passa a usar `refetchType:'none'` também no bridge — sem refetch atropelando o patch. Sem RPC/RLS/schema. Bump `APP_VERSION` 3.5.86 → 3.5.87. Invariantes grep: `grep -n 'patchSubtarefasBridge' src/hooks/useProjetoTarefas.ts | wc -l` ≥ 5; `grep -n \"projeto-tarefas-subtarefas-bridge.*refetchType\" src/components/projetos/tarefa-detalhe/SubtarefaSeguidoresPicker.tsx | wc -l` ≥ 1; `grep -n '3.5.87' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.90 / SDK v3.3.1 / APP v3.5.86", date: "2026-07-03", changes: [
                     "TAREFAS — adicionado botão 'Expandir/Recolher' no cabeçalho do campo Descrição em `src/components/projetos/ProjetoTarefaDetalhe.tsx`. Antes, textos longos ficavam confinados na caixa de 80px com barra de rolagem, dificultando a leitura. Agora, quando `descValue.length > 0`, aparece um toggle (Maximize2/Minimize2) ao lado de 'Sugerir com IA' que alterna a Textarea entre `min-h-[80px] resize-none` e `min-h-[320px] max-h-[65vh] resize-y` com transição suave (200ms). Estado local `descExpanded` isolado por instância do drawer — não afeta outras tarefas nem persiste ao trocar de tarefa. Sem mudanças em schema/RLS/RPC. Bump `APP_VERSION` 3.5.85 → 3.5.86. Invariantes grep: `grep -n 'descExpanded' src/components/projetos/ProjetoTarefaDetalhe.tsx | wc -l` ≥ 3; `grep -n '3.5.86' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.89 / SDK v3.3.1 / APP v3.5.85", date: "2026-07-03", changes: [
                     "TAREFAS / CENTRAL DE TRABALHO — corrigido Select 'Mover para' (seção) travado na seção antiga e com piscada de lista após confirmar. Bug: `handleBridgeMoveTarefa` em `src/components/projetos/central/MinhasTarefasContent.tsx` só chamava `supabase.update({ secao_id })` e depois `invalidateQueries(['minhas-tarefas'])` — o `bridgedTarefa.secao_id` lido pelo Select do drawer continuava apontando para a seção de origem até o usuário fechar/reabrir o painel, dando aparência de 'não funcionou'; além disso, sem patch em cache o refetch da lista causava re-render do agrupamento. Fix: (1) leitura de `bridgedSecoes` para descobrir `secao_nome` de destino; (2) patch otimista em `setDetailTarefa` antes do await, atualizando `secao_id` + `secao_nome`; (3) `queryClient.setQueryData(['minhas-tarefas', user.id], ...)` mapeando o item movido para a nova seção; (4) `refetchType: 'none'` mantido em `minhas-tarefas` e `projeto-tarefas-v2` após sucesso; (5) rollback do `detailTarefa` + `invalidate active` em `minhas-tarefas` quando o `update` falha. Sem RPC/RLS/schema. Bump `APP_VERSION` 3.5.84 → 3.5.85. Invariantes grep: `grep -n 'handleBridgeMoveTarefa' src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 1; `grep -n \"setQueryData<MinaTarefa\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 1; `grep -n '3.5.85' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.88 / SDK v3.3.1 / APP v3.5.84", date: "2026-07-03", changes: [
                     "TAREFAS / CENTRAL DE TRABALHO — corrigido Select 'Alertar antes' travado em '2 dias' no drawer aberto a partir de `/dashboard/projetos/central?tab=tarefas`. Bug: (1) `bridgedTarefa` mapeava `alertar_antes` (chave inexistente no schema — a coluna é `dias_alerta_antes`), então o `Select` de ProjetoTarefaDetalhe sempre caía no fallback `?? 2`. (2) A RPC `get_minhas_tarefas_central` não retorna `dias_alerta_antes` nem `data_proxima_acao`, então mesmo o valor inicial vindo do banco não aparecia. (3) `handleBridgeUpdate` só atualizava `detailTarefa` DEPOIS do await do Supabase, deixando o Select preso na opção antiga por 200–800ms — leitura do usuário como 'travado'. Fix: (a) nova query `['tarefa-planning', tarefaId]` em `MinhasTarefasContent.tsx` busca `dias_alerta_antes, data_proxima_acao, data_inicio_planejada` da tabela `projeto_tarefas` quando o drawer abre; (b) `bridgedTarefa` agora expõe `dias_alerta_antes` (corrigindo o nome do campo) com fallback `detailTarefa → bridgedPlanning → null`, idem para `data_proxima_acao`/`data_inicio_planejada`; (c) `handleBridgeUpdate` aplica `setDetailTarefa` + `queryClient.setQueryData(['tarefa-planning', id], ...)` ANTES do `attemptSave`, e em caso de falha faz rollback do estado local + invalida a chave de planning. Sem RPC/RLS/schema novo. Bump `APP_VERSION` 3.5.83 → 3.5.84. Invariantes grep: `grep -n \"'tarefa-planning'\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 2; `grep -n 'dias_alerta_antes:' src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 1; `grep -n '3.5.84' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.87 / SDK v3.3.1 / APP v3.5.83", date: "2026-07-03", changes: [
                     "TAREFAS / NOTIFICAÇÕES — a regra `dias_alerta_antes` passa a valer também para o campo `data_inicio_planejada`, não só para `data_prazo`. `supabase/functions/projeto-monitor-atrasos/index.ts` agora seleciona `data_inicio_planejada`, filtra `neq status concluida` + `data_prazo not null OR data_inicio_planejada not null`, e para cada tarefa dispara: (a) `atraso_tarefa` / `alerta_prazo` (comportamento anterior) e (b) `atraso_inicio_tarefa` / `alerta_inicio` — este último só quando o status ainda é `pendente`, para não incomodar quem já começou. Antecedência (`dias_alerta_antes`, default 2) unificada para prazo e início. FIX ADICIONAL: o cron `monitor-atrasos-diario` estava quebrado desde a criação (`extensions.http_post does not exist` em `cron.job_run_details` todos os dias), então **nenhum** alerta era enviado; reagendado via `net.http_post` (pg_net) com `jsonb_build_object` no header. `secureHandler` do monitor passou de `auth: apikey` para `auth: none` porque é chamado exclusivamente por pg_cron (não há usuário nem chave ERP no invoker). Validado in-vivo: `SELECT net.http_post(...)` retornou `{processed:813, notifications_sent:1135}` (2 `alerta_inicio`, 6 `alerta_prazo`, 87 `atraso_inicio_tarefa`, 1040 `atraso_tarefa`) com mensagens no formato \"A tarefa X deve iniciar hoje\" / \"em N dia(s)\" / \"está N dia(s) atrasado\". Bump `APP_VERSION` 3.5.82 → 3.5.83. Invariantes grep: `grep -n 'alerta_inicio' supabase/functions/projeto-monitor-atrasos/index.ts | wc -l` ≥ 2; `grep -n 'data_inicio_planejada' supabase/functions/projeto-monitor-atrasos/index.ts | wc -l` ≥ 3; `grep -n '3.5.83' src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.86 / SDK v3.3.1 / APP v3.5.82", date: "2026-07-03", changes: [
                     "TAREFAS / CENTRAL DE TRABALHO — corrigido carregamento imediato dos avatares de responsáveis e seguidores adicionados via drawer aberto em `/dashboard/projetos/central?tab=tarefas`. Bug: o `bridgedTarefa` em `MinhasTarefasContent.tsx` não incluía `responsaveis[]`, `colaboradores[]` nem o objeto `responsavel`, então o `TarefaResponsavelSeguidoresEditor` sempre recebia arrays vazios; ao adicionar/remover pessoa a mutação atualizava `projeto-tarefas-v2` mas o drawer da Central não lia essa chave. Fix: (1) nova query `['tarefa-junctions', tarefaId]` que busca `projeto_tarefa_responsaveis` + `projeto_tarefa_colaboradores` e enriquece nomes/avatares via `profiles.in(ids)` quando o drawer abre. (2) `bridgedTarefa` agora expõe `responsavel` (a partir de `responsavel_nome/avatar_url` do MinaTarefa) e injeta `responsaveis`/`colaboradores` a partir dessa nova query. (3) Novo helper `patchTarefaJunctions(tarefaId, mutator)` em `useProjetoTarefas.ts` aplica update otimista na chave `tarefa-junctions` dentro de `addColaborador.onMutate`, `removeColaborador.onMutate`, `addResponsavel.onMutate` e `removeResponsavel.onMutate` — a UI reflete o avatar no mesmo frame, sem refetch/piscar. (4) `enrichPessoaFromProfile` também percorre `queryCache.findAll({ queryKey: ['tarefa-junctions'] })` e atualiza nome/avatar do usuário nas junções abertas quando o `profile-mini` chega. Sem RPC/RLS/schema. Bump `APP_VERSION` 3.5.81 → 3.5.82. Invariantes grep: `grep -n \"tarefa-junctions\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 1; `grep -n \"patchTarefaJunctions\" src/hooks/useProjetoTarefas.ts | wc -l` ≥ 5; `grep -n \"3.5.82\" src/lib/version.ts | wc -l` ≥ 1.",
                   ], author: "Lovable AI" },
                   { version: "v4.4.85 / SDK v3.3.1 / APP v3.5.81", date: "2026-07-03", changes: [
                      "TAREFAS / CENTRAL DE TRABALHO — corrigido preenchimento imediato do campo Início planejado (e Próxima ação / Alertar antes) no drawer aberto a partir de `/dashboard/projetos/central?tab=tarefas`. Bug: `bridgedTarefa` em `src/components/projetos/central/MinhasTarefasContent.tsx` montava o objeto `ProjetoTarefa` passado ao `ProjetoTarefaDetalhe` sem incluir `data_inicio_planejada` (nem `data_proxima_acao` / `alertar_antes`). Como o Popover do drawer lê `(tarefa as any).data_inicio_planejada`, o botão ficava travado em 'Definir início (obrigatório)' mesmo após o `handleBridgeUpdate` gravar no banco (verificado via `SELECT data_inicio_planejada FROM projeto_tarefas` = 2026-07-10). Data prazo funcionava porque já estava no bridge. Fix: bridge passa `data_inicio_planejada: detailTarefa.data_inicio_planejada ?? null` + fallbacks para `data_proxima_acao` e `alertar_antes` via `(detailTarefa as any)`. Sem mudança em RPC, schema, RLS ou layout. Validado no preview via Playwright: seleção no calendário do Início planejado agora atualiza o botão para 'DD MMM YYYY' de imediato, espelhando o comportamento de Data prazo. Bump `APP_VERSION` 3.5.80 → 3.5.81. Invariantes grep: `grep -n 'data_inicio_planejada: detailTarefa.data_inicio_planejada' src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 1; `grep -n '3.5.81' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},

                    { version: "v4.4.84 / SDK v3.3.1 / APP v3.5.80", date: "2026-07-03", changes: [
                      "TAREFAS — corrigido preenchimento imediato dos campos Início planejado, Próxima ação e Alertar antes no drawer/Modo Foco, além do carregamento imediato do avatar de responsáveis e seguidores recém-adicionados. (1) RPC `public.get_projeto_tarefas_v2` passou a incluir `t.data_proxima_acao` na CTE `visible_tarefas`, evitando que o refetch de reconciliação apague o campo aplicado pelo patch otimista. (2) Novo helper `enrichPessoaFromProfile` em `src/hooks/useProjetoTarefas.ts` executa fire-and-forget `queryClient.fetchQuery(['profile-mini', userId])` quando `resolvePessoa`/`resolveMembro` retorna avatar/nome incompletos; ao chegar, aplica `patchView` mínimo que atualiza apenas o registro daquele usuário em `responsavel`, `responsaveis[]`, `colaboradores[]` e `teamMembers`, sem invalidar/refetch da view (0 add/remove no DOM). Hookado em `updateTarefa.onMutate` (respChange), `addColaborador.onMutate` e `addResponsavel.onMutate`. Bump `APP_VERSION` 3.5.79 → 3.5.80. Invariantes grep: `grep -n 'data_proxima_acao' supabase/migrations | wc -l` ≥ 1; `grep -n 'enrichPessoaFromProfile' src/hooks/useProjetoTarefas.ts | wc -l` ≥ 3; `grep -n 'profile-mini' src/hooks/useProjetoTarefas.ts | wc -l` ≥ 1; `grep -n '3.5.80' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},

                    { version: "v4.4.83 / SDK v3.3.1 / APP v3.5.79", date: "2026-07-03", changes: [
                      "TAREFAS — adicionado kill-switch mestre anti-flicker em `src/lib/tarefas/featureFlags.ts`. Nova chave `ff:tarefas_antiflicker_master` no localStorage tem precedência absoluta sobre flags individuais e sobre `window.__TAREFAS_FF__`; quando setada como `off`, `isTarefasFlagEnabled` retorna `false` para todas as flags anti-flicker (`tarefas_realtime_cirurgico`, `tarefas_realtime_batch`, `tarefas_realtime_dedupe`, `tarefas_descricao_editor_isolado`, `tarefas_drawer_permanente`). Exposto helper global `window.__tarefasAntiFlicker` com `disableAll()`, `enableAll()`, `reset()` e `status()` para diagnóstico em produção. Uso em incidente: `window.__tarefasAntiFlicker.disableAll(); location.reload();`. Cobertura em `src/lib/tarefas/__tests__/featureFlags.test.ts` (6 testes). Sem mudança em schema, RPCs, permissões ou layout. Bump `APP_VERSION` 3.5.78 → 3.5.79. Invariantes grep: `grep -n 'ff:tarefas_antiflicker_master' src/lib/tarefas/featureFlags.ts | wc -l` ≥ 1; `grep -n 'disableAntiFlicker' src/lib/tarefas/featureFlags.ts | wc -l` ≥ 1; `grep -n '__tarefasAntiFlicker' src/lib/tarefas/featureFlags.ts | wc -l` ≥ 1; `grep -n '3.5.79' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.82 / SDK v3.3.1 / APP v3.5.78", date: "2026-07-03", changes: [
                      "TAREFAS — adicionada instrumentação anti-flicker opt-in em `src/lib/tarefas/instrumentation.ts`. Expõe `window.__tarefasInstrumentation` com `snapshot()`, `reset()`, `enable(on)` e `markUpdate(label)`, contando remounts por linha (`useRowMountCounter` em `ProjetoTarefaRow`) e medindo tempo até estabilizar a UI após cada patch cirúrgico de Realtime (`markTasksUpdated('realtime-batch')` disparado em `useProjetoTarefas`). O container da lista recebeu `data-tarefas-list-root` para escopo do `MutationObserver`. Ativar via `localStorage.setItem('ff:instrumentation','on')`; default OFF, custo zero em produção. Sem mudança em schema, RPCs, permissões ou layout. Bump `APP_VERSION` 3.5.77 → 3.5.78. Invariantes grep: `grep -n 'useRowMountCounter' src/components/projetos/ProjetoTarefaRow.tsx | wc -l` ≥ 1; `grep -n 'markTasksUpdated' src/hooks/useProjetoTarefas.ts | wc -l` ≥ 1; `grep -n 'data-tarefas-list-root' src/components/projetos/ProjetoListView.tsx | wc -l` ≥ 1; `grep -n '3.5.78' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.81 / SDK v3.3.1 / APP v3.5.77", date: "2026-07-03", changes: [
                      "TAREFAS — ativado por padrão o pacote anti-flicker que já estava implementado, mas permanecia atrás de flags locais desligadas: `tarefas_realtime_cirurgico`, `tarefas_realtime_batch`, `tarefas_realtime_dedupe`, `tarefas_descricao_editor_isolado` e `tarefas_drawer_permanente` agora retornam `true` por default em `src/lib/tarefas/featureFlags.ts`. O kill-switch continua disponível por cliente via `localStorage.setItem('ff:<flag>', 'off')`. Isso faz o fluxo real usar patch granular de Realtime, batching por frame, deduplicação de eco local e proteção de campos em edição sem depender de DevTools. Sem mudança em schema, permissões, RPCs ou layout. Bump `APP_VERSION` 3.5.76 → 3.5.77. Invariantes grep: `grep -n 'const DEFAULT_FLAGS' src/lib/tarefas/featureFlags.ts | wc -l` ≥ 1; `grep -n 'tarefas_realtime_cirurgico: true' src/lib/tarefas/featureFlags.ts | wc -l` ≥ 1; `grep -n '3.5.77' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.80 / SDK v3.3.1 / APP v3.5.76", date: "2026-07-02", changes: [
                      "UPLOAD PSD CHINA — corrigida a causa específica do arquivo `TESTE.psd`: validação local confirmou assinatura PSD válida (`8BPS`) e tamanho real de 235.915 bytes. A recusa combinava buckets China ainda fora da rotina de sincronização e um gatilho legado de validação de anexos acoplado indevidamente aos objetos de armazenamento, que tentava ler campos inexistentes e fazia o backend retornar `DatabaseSchemaMismatch`. `storage-bucket-upload-limits` agora monitora e ressincroniza também `china-documentos`, `china-pasta-digital` e `china-chat-anexos`, elevando o teto para `UPLOAD_MAX_BYTES`/1 GB e aplicando os MIMEs Adobe (`image/vnd.adobe.photoshop`, `image/psd`, `application/x-photoshop`, `application/photoshop`, `application/postscript`, `application/illustrator`, `application/vnd.adobe.illustrator`, `application/octet-stream`). As políticas de `china-documentos` foram recompostas para aceitar paths atuais `<uid>/<submissaoId>/...` e legados `<submissaoId>/...` quando o usuário é criador da submissão ou membro do projeto vinculado. `public.enforce_projeto_anexos_limits()` agora ignora chamadas fora de `public.projeto_tarefa_anexos` e o gatilho correto foi criado nessa tabela, removendo o erro enganoso em uploads válidos. `DiagnosticoBuckets` passa a refletir estes buckets no painel admin e remove texto técnico desnecessário da UI. `storage-helper.uploadFile` e `uploadAndGetSignedUrl`, usados por telas China como ficha, submissão, checklist e pasta digital, agora passam pelo `resumableUpload` compartilhado, preservando validação central e habilitando TUS/chunked para arquivos grandes. Testes adicionaram o caso `TESTE.psd` com assinatura `8BPS` e tamanho real do arquivo enviado. Validação real pós-correção: upload controlado do `TESTE.psd` em `china-documentos` retornou 200 e o objeto de diagnóstico foi removido em seguida. Bump `APP_VERSION` 3.5.75 → 3.5.76. Invariantes grep: `grep -n 'china-documentos' supabase/functions/storage-bucket-upload-limits/index.ts | wc -l` ≥ 1; `grep -n 'resumableUpload' src/lib/utils/storage-helper.ts | wc -l` ≥ 2; `grep -n 'TESTE.psd' src/lib/utils/__tests__/file-security.test.ts | wc -l` ≥ 1; `grep -n '3.5.76' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.79 / SDK v3.3.1 / APP v3.5.75", date: "2026-07-02", changes: [
                      "UPLOAD OBSERVABILIDADE — três reforços para blindar o limite unificado de 1 GB (.ai/.psd inclusos) contra regressões futuras. (1) Testes automatizados: novo `src/lib/upload/__tests__/limits.test.ts` valida `UPLOAD_MAX_BYTES === 1073741824`, `UPLOAD_MAX_LABEL === '1 GB'`, `isWithinUploadLimit` no boundary, `uploadSizeExceededMessage`. `src/lib/utils/__tests__/file-security.test.ts` reescrito para o teto unificado (removidas expectativas antigas de 200/500 MB) e ampliado com cobertura específica de `.ai` (magic %PDF e %!PS) e `.psd` (magic 8BPS + MIME `image/vnd.adobe.photoshop` e `application/octet-stream`), boundary de tamanho (500 MB, 900 MB, 1 GB exatos, 1 GB+1 MB rejeitado), MIME divergente, extensão dupla, batch validator, e `describeUploadError` cobrindo `payload too large`, `database schema is out of sync`, `file_size_limit`, `415`. (2) Frontend/backend sem divergência: `describeUploadError` e a mensagem `SIZE_EXCEEDED` de `file-security.ts` passaram a interpolar `UPLOAD_MAX_LABEL`/`UPLOAD_MAX_BYTES` em vez de hardcodar '1 GB'/'1024 MB' — qualquer bump do teto no `src/lib/upload/limits.ts` propaga automaticamente para toda a UI. (3) Tela de diagnóstico admin `/admin/diagnostico-buckets` (`src/pages/admin/DiagnosticoBuckets.tsx`): consulta em tempo real a Edge Function `storage-bucket-upload-limits` em modo `list` (novo, não altera nada) e mostra por bucket o `file_size_limit` efetivo, se aceita MIMEs Adobe (.ai/.psd), badges de status e ação 'Ressincronizar 1 GB + Adobe' que reaplica limites e whitelist nos 10 buckets alvo. Bump `APP_VERSION` 3.5.74 → 3.5.75. Invariantes grep: `grep -n \"UPLOAD_MAX_BYTES\" src/lib/utils/__tests__/file-security.test.ts | wc -l` ≥ 1; `grep -n \"action.*list\" supabase/functions/storage-bucket-upload-limits/index.ts | wc -l` ≥ 1; `grep -n \"DiagnosticoBuckets\" src/App.tsx | wc -l` ≥ 2; `grep -n \"3.5.75\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.78 / SDK v3.3.1 / APP v3.5.74", date: "2026-07-02", changes: [
                      "UPLOAD STORAGE — corrigida a divergência real entre frontend/API e Storage. Auditoria inicial confirmou os buckets de anexos com caps antigos (`projeto-anexos`, `documento-anexos`, `attachments`, `marketing-assets` em 50 MB; `briefing-cofre`, `chat-anexos`, `aprovacao-documentos` em 20 MB; `fluxo-artes`, `aprovacao-artes` em 10 MB; `trade-assets` em 5 MB), enquanto `public.upload_max_bytes()` e `UPLOAD_MAX_BYTES` já estavam em 1 GB (`1073741824`). Correção aplicada via função administrativa segura `storage-bucket-upload-limits`: todos os 10 buckets foram atualizados para `file_size_limit=1073741824`, mantidos privados, e os buckets com whitelist receberam MIME types Adobe (`application/postscript`, `application/illustrator`, `application/vnd.adobe.illustrator`, `image/vnd.adobe.photoshop`, `application/x-photoshop`, `application/photoshop`, `image/psd`, `application/octet-stream`). Verificação pós-aplicação confirmou `file_size_limit=1073741824` em `projeto-anexos`, `documento-anexos`, `attachments`, `marketing-assets`, `briefing-cofre`, `chat-anexos`, `aprovacao-documentos`, `fluxo-artes`, `aprovacao-artes` e `trade-assets`. Policies de `storage.objects` revisadas: regras filtram bucket/path/participação, sem limite de tamanho próprio. Correção de aplicação complementar: uploads diretos de anexos em `projeto-anexos`, `briefing-cofre`, `chat-anexos`, `attachments`, `trade-assets`, `fluxo-artes` e `aprovacao-artes` agora usam `resumableUpload`/TUS quando recebem `File`, preservando validação central, paths, permissões e UI. Texto residual '20MB cada' em rejeição China atualizado para `UPLOAD_MAX_LABEL`. Bump `APP_VERSION` 3.5.73 → 3.5.74.",
                    ]},
                    { version: "v4.4.77 / SDK v3.3.1 / APP v3.5.73", date: "2026-07-02", changes: [
                      "UPLOAD UX — diagnóstico e mensagem correta para o erro 'The database schema is out of sync. Please run migrations or contact support.' Investigação: o texto NÃO vem do Postgres/PostgREST nem do supabase-js — é o wrapper do Lovable Cloud sobre respostas 413/415 do Storage quando o `file_size_limit` do bucket é menor que o arquivo (ou o MIME não está na `allowed_mime_types`). Confirmado no ambiente atual: `storage.buckets.file_size_limit` = 50 MB em `projeto-anexos`/`documento-anexos`/`attachments`/`marketing-assets`, 20 MB em `briefing-cofre`/`chat-anexos`/`aprovacao-documentos`, 10 MB em `fluxo-artes`/`aprovacao-artes`, 5 MB em `trade-assets` — enquanto o validador client-side (`UPLOAD_MAX_BYTES`) e a função `public.upload_max_bytes()` permitem 1 GB. Correção de UX aplicada em `src/lib/utils/file-security.ts::describeUploadError`: novas assinaturas `database schema is out of sync`, `please run migrations`, `schema is out of sync`, `invalid_mime_type` e `415` são traduzidas em título/descrição orientando o usuário a compactar/dividir e avisar a equipe interna, em vez de exibir a mensagem enganosa sobre migrações. **Pendência de infraestrutura (bloqueada por política)**: elevar `file_size_limit` para 1 GB (`1073741824`) e adicionar `application/vnd.adobe.illustrator`, `image/vnd.adobe.photoshop`, `application/x-photoshop`, `application/photoshop`, `image/psd`, `application/illustrator` a `allowed_mime_types` nos 10 buckets acima — Lovable Cloud bloqueia `UPDATE storage.buckets` (erro `bucket_sql_blocked`) e o tool `storage_update_bucket` só aceita `public` (não `file_size_limit`/`allowed_mime_types`). Enquanto o suporte Lovable não elevar os caps, uploads > cap atual continuarão sendo rejeitados, mas agora com mensagem clara. Sem mudança em schema, RLS, triggers, TUS, `UPLOAD_MAX_BYTES` ou `upload_max_bytes()`. Bump `APP_VERSION` 3.5.72 → 3.5.73. Invariantes grep: `grep -n 'database schema is out of sync' src/lib/utils/file-security.ts | wc -l` ≥ 1; `grep -n 'invalid_mime_type' src/lib/utils/file-security.ts | wc -l` ≥ 1; `grep -n '3.5.73' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.76 / SDK v3.3.1 / APP v3.5.72", date: "2026-07-02", changes: [
                      "ANEXOS — corrigido `invalid input syntax for type uuid: \"temp-…\"` ao excluir anexo recém-enviado. Causa raiz: `useProjetoTarefaDetalhe.uploadAnexo` criava placeholder otimista com `id: temp-${crypto.randomUUID()}` e o `onSettled` invalidava com `refetchType:'none'`, deixando o `temp-…` no cache até um refetch futuro; clicar em excluir enviava esse id para `.eq('id', anexo.id)` e o Postgres rejeitava. Correções: (1) `src/lib/utils/uploadTarefaAnexo.ts` passou a `.select('*').single()` e retorna `row` completa junto com `id`/`storagePath`/`nome`. (2) `useProjetoTarefaDetalhe.uploadAnexo` agora guarda `tempId` no contexto de `onMutate` e, em `onSuccess`, substitui o item cujo `id === ctx.tempId` pelo `row` real (preservando posição, sem duplicidade); `onError` remove o placeholder órfão como defesa extra. (3) Novo helper `src/lib/utils/isUuid.ts` (`isUUID` com regex canônico v1–v5). (4) `deleteAnexo` em `useProjetoTarefaDetalhe` e `useMinhasTarefaDetalhe` bloqueia com toast 'Aguarde o upload concluir antes de excluir este anexo.' quando `!isUUID(anexo.id)`, e só chama `storage.remove` se `storage_path` estiver preenchido. (5) `TarefaAnexosSection` desabilita o botão de lixeira com tooltip 'Aguarde o upload concluir' enquanto `id.startsWith('temp-')` ou `isUploading`. Sem mudanças em RLS, schema, bucket, TUS ou limites de 1 GB. Bump `APP_VERSION` 3.5.71 → 3.5.72. Invariantes grep: `grep -n 'isUUID(anexo' src/hooks/useProjetoTarefaDetalhe.ts src/hooks/useMinhasTarefaDetalhe.ts | wc -l` ≥ 2; `grep -n \"tempId\" src/hooks/useProjetoTarefaDetalhe.ts | wc -l` ≥ 3; `grep -n \"select(\\\"\\*\\\")\" src/lib/utils/uploadTarefaAnexo.ts | wc -l` ≥ 1; `grep -n '3.5.72' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.75 / SDK v3.3.1 / APP v3.5.71", date: "2026-07-02", changes: [
                      "UPLOAD LIMIT PARIDADE — validadores de anexos genéricos alinhados ao mesmo teto de 1 GB de `UPLOAD_MAX_BYTES`. Arquivos migrados para importar `@/lib/upload/limits` no lugar de `20 * 1024 * 1024` local: `src/hooks/useSubmissaoPareceres.ts`, `src/components/china/submissao/PareceresSubmissaoCard.tsx`, `src/components/china/submissao-board/ChecklistB2CSheet.tsx`, `src/components/china/inbox/ChecklistFlow/DrawerComentariosTab.tsx`, `src/components/china/checklist/ChecklistItemPainel.tsx`, `src/components/china/{DialogAprovarDocumento,DialogContestarDocumento,DialogRejeitarDocumento}.tsx`, `src/components/projetos/tarefa-detalhe/ChinaDocumentoBlock.tsx`, `src/components/financeiro/contratos/FornecedorContratoDialog.tsx`, `src/components/chat/v2/{NovaAprovacaoDialog,MessageInput}.tsx`, `src/components/financeiro/payments/PaymentChatPanel.tsx`. Onde a constante local se chamava `MAX_BYTES`/`MAX_SIZE`, foi convertida em `import { UPLOAD_MAX_BYTES as MAX_BYTES } from '@/lib/upload/limits'` para preservar o call-site sem risco de regressão. Verificação de paridade do chunked TUS: `resumableUpload` decide o path por `SMALL_UPLOAD_THRESHOLD=5 MB` (fast-path single-shot) vs TUS 6 MB/chunk até 1 GB — nenhum caller carrega mais de 6 MB por request. Limites intencionalmente menores foram MANTIDOS por serem específicos de domínio (não são validadores de anexo genérico): entrada de OCR/IA em `ExpenseReceiptScanner`/`ImportarInsumosIA`/`CadastroIAStep`/`CreativeImageGenerator`/`AdvancedVideoGenerator`/`StitchDesignStudio` (10 MB — throughput de IA); avatares `fabrica/UploadFotoProdutoDialog` (5 MB — thumbnail); imagens de chat de briefing `briefings/chat/AttachImageButton` (10 MB — análise IA); vídeo `RecebimentoAmostra` (50 MB — reprodução inline); anexos cross-workspace `PainelCentralAP`/`ReceiptUploadSection`/`ExpenseAttachments` (10 MB — política financeira). Também mantidos os caps do lado servidor: `supabase/functions/projeto-copilot` (200 MB — leitura in-memory para extração de texto, evita OOM do Deno), `asana-sync`/`cache-post-media` (50 MB — janela do worker), `ingest-influencer-media` (20 MB — thumbnail social). Bump `APP_VERSION` 3.5.70 → 3.5.71. Invariantes grep: `grep -rn '20 \\* 1024 \\* 1024' src/hooks/useSubmissaoPareceres.ts src/components/china src/components/chat/v2 src/components/financeiro/contratos src/components/financeiro/payments src/components/projetos/tarefa-detalhe | wc -l` = 0; `grep -rn 'UPLOAD_MAX_BYTES' src/components/china src/components/chat/v2 src/components/financeiro src/components/projetos/tarefa-detalhe src/hooks | wc -l` ≥ 13; `grep -n '3.5.71' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.74 / SDK v3.3.1 / APP v3.5.70", date: "2026-07-02", changes: [
                      "UPLOAD UX — mensagem amigável para HTTP 413 (Payload Too Large). `src/lib/utils/file-security.ts::describeUploadError` reconhece agora `413`, `payload too large`, `request entity too large`, `exceeded the maximum` e `file_size_limit`, retornando título 'Arquivo acima do limite aceito pelo servidor' e descrição em 3 passos: (1) confirmar < 1 GB, (2) compactar/dividir, (3) se abaixo de 1 GB e ainda falhar, abrir chamado para elevar o cap do bucket. Também traduz `aborted/cancelado` e `network/rede` em toasts específicos. `src/lib/upload/resumableUpload.ts::chunkedTusUpload` passa a anexar '413 Payload Too Large — ' ao `err.message` quando `originalResponse.getStatus() === 413` e emite `code='payload_too_large'`, garantindo que qualquer caller (mesmo os que só logam `error.message`) veja a string reconhecida por `describeUploadError`. Bump `APP_VERSION` 3.5.69 → 3.5.70. Invariantes grep: `grep -n 'payload_too_large' src/lib/upload/resumableUpload.ts | wc -l` ≥ 1; `grep -n 'Arquivo acima do limite aceito pelo servidor' src/lib/utils/file-security.ts | wc -l` ≥ 1; `grep -n '3.5.70' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.73 / SDK v3.3.1 / APP v3.5.69", date: "2026-07-02", changes: [
                      "UPLOAD LIMIT — centralizada a configuração do limite de upload em uma única fonte de verdade, em front e back. Novo módulo `src/lib/upload/limits.ts` exporta `UPLOAD_MAX_BYTES` (1 GB), `UPLOAD_MAX_LABEL` ('1 GB'), `isWithinUploadLimit(bytes)` e `uploadSizeExceededMessage(fileName?)`. `src/lib/utils/file-security.ts` deixa de hardcodar `1024*1024*1024` — `MAX_FILE_SIZE_BYTES`, `MAX_VIDEO_SIZE_BYTES` e `MAX_DESIGN_FILE_SIZE_BYTES` viraram aliases que reexportam `UPLOAD_MAX_BYTES` (aliases mantidos por compatibilidade de imports/telemetria). Back-end: nova função `public.upload_max_bytes()` (IMMUTABLE, `SET search_path=public`) retorna o mesmo `1073741824::bigint`; trigger `public.enforce_projeto_anexos_limits` reescrito para ler `upload_max_bytes()` no lugar do literal 1 GB. Efeito: para mudar o teto no futuro basta atualizar `UPLOAD_MAX_BYTES` no front e `upload_max_bytes()` no back — nenhum outro arquivo carrega o número. Bump `APP_VERSION` 3.5.68 → 3.5.69. Invariantes grep: `grep -rn '1024 \\* 1024 \\* 1024' src/lib/utils/file-security.ts | wc -l` = 0; `grep -n 'UPLOAD_MAX_BYTES' src/lib/upload/limits.ts src/lib/utils/file-security.ts | wc -l` ≥ 2; `grep -n 'upload_max_bytes' supabase/migrations/*.sql | tail -1` deve apontar para a migração de 3.5.69; `grep -n '3.5.69' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.72 / SDK v3.3.1 / APP v3.5.68", date: "2026-07-02", changes: [
                      "UPLOAD CHUNKED — `src/lib/upload/resumableUpload.ts` reescrito para usar protocolo TUS 1.0 nativo do Storage (`/storage/v1/upload/resumable`) em chunks de 6 MB (múltiplo exigido pelo Supabase). Dependência nova: `tus-js-client@4`. Fast-path single-shot mantido para arquivos < 5 MB. Acima disso, envio em partes com retomada automática (`findPreviousUploads`/`resumeFromPreviousUpload`), retry por chunk com backoff exponencial (`retryDelays: [0, 800, 1600, 3200, 6400, 12800]`) e cancelamento real via `AbortSignal` propagado para `upload.abort(true)`. Vantagens: (1) nenhuma requisição HTTP carrega mais de 6 MB por vez — elimina timeouts de proxy/CDN em arquivos de 1 GB; (2) queda de rede retoma do último chunk aceito, não do zero; (3) progresso granular por byte já consumido pelo `upload-progress-bar`. Auth via `Bearer` do session token + `x-upsert` header; bucket/objectName vão em `metadata`. Removidos: `computeTimeoutMs`, `performXhrPut` e `createSignedUploadUrl` (o TUS gerencia lifecycle próprio). Bump `APP_VERSION` 3.5.67 → 3.5.68. Invariantes grep: `grep -n 'tus-js-client' src/lib/upload/resumableUpload.ts | wc -l` ≥ 1; `grep -n 'chunkSize: TUS_CHUNK_SIZE' src/lib/upload/resumableUpload.ts | wc -l` ≥ 1; `grep -n '/storage/v1/upload/resumable' src/lib/upload/resumableUpload.ts | wc -l` ≥ 1; `grep -n '3.5.68' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.71 / SDK v3.3.1 / APP v3.5.67", date: "2026-07-02", changes: [
                      "UPLOAD — limite unificado de 1 GB por arquivo para qualquer extensão suportada. `src/lib/utils/file-security.ts`: `MAX_FILE_SIZE_BYTES` e `MAX_VIDEO_SIZE_BYTES` passam de 200 MB / 500 MB para 1 GB (`MAX_DESIGN_FILE_SIZE_BYTES` já era 1 GB); branch de tamanho colapsado — todas as categorias batem no mesmo teto de 1 GB. Mensagens de `EXTENSION_NOT_ALLOWED`, `SIZE_EXCEEDED` e `describeUploadError` reescritas para 'limite unificado de 1 GB por arquivo', preservando o hint sobre elevação do bucket. Trigger `enforce_projeto_anexos_limits` no schema `public` reescrito para aplicar teto único de 1 GB (`1073741824 bytes`) sem distinguir vídeo/design/documento; auditoria em `projeto_anexos_upload_audit` mantida (`rejection_code='size_exceeded'`). Sem mudança em `resumableUpload.ts` — o timeout adaptativo (60 s + 200 ms/MB ≈ 4 min para 1 GB) e retry exponencial já cobrem arquivos grandes. Bump `APP_VERSION` 3.5.66 → 3.5.67. **Pendência da plataforma**: `file_size_limit` dos buckets (`projeto-anexos`, `documento-anexos`, `attachments`, `marketing-assets`, `briefing-cofre`, `chat-anexos`, `aprovacao-documentos`, `fluxo-artes`, `aprovacao-artes`, `trade-assets`) segue no cap antigo — Lovable Cloud bloqueia `UPDATE storage.buckets`, então **uploads acima do cap do bucket continuarão retornando HTTP 413 mesmo com validador e trigger liberados a 1 GB**; abrir chamado no suporte Lovable pedindo elevação para 1 GB nesses buckets. Invariantes grep: `grep -n 'MAX_FILE_SIZE_BYTES = 1024 \\* 1024 \\* 1024' src/lib/utils/file-security.ts | wc -l` ≥ 1; `grep -n 'v_is_design' supabase/migrations/*.sql | tail -1` deve apontar para a migração de 3.5.65 (mais recente não contém); `grep -n '3.5.67' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.70 / SDK v3.3.1 / APP v3.5.66", date: "2026-07-02", changes: [
                      "UI TAREFAS — corrigida sobreposição entre o botão nativo 'Fechar (X)' do Sheet/Dialog e os botões da barra de ações (Foco, Sair do Foco). `src/components/ui/dialog.tsx` ganha prop `hideClose?: boolean` no `DialogContent`, espelhando o padrão já existente em `Sheet`. `src/components/projetos/ProjetoTarefaDetalhe.tsx` passa `hideClose` ao `SheetContent` e adiciona o X inline como último item do grupo `ml-auto` (após 'Foco'), usando `variant='ghost' size='sm' rounded-full h-8 w-8 p-0 shrink-0`; a barra ganha `flex-wrap` para evitar colisões em resoluções estreitas e zoom 125–200%. `src/components/projetos/TarefaFocusMode.tsx` também passa `hideClose` e adiciona X inline após 'Sair do Foco', reusando `handleExitFocusClick` para preservar o guard de saída explícita. Sem mudança em RLS, RPCs, migrations ou lógica de negócio — apenas layout do cabeçalho. Bump `APP_VERSION` 3.5.65 → 3.5.66. Invariantes grep: `grep -n 'hideClose' src/components/ui/dialog.tsx | wc -l` ≥ 2; `grep -n 'hideClose' src/components/projetos/ProjetoTarefaDetalhe.tsx src/components/projetos/TarefaFocusMode.tsx | wc -l` ≥ 2; `grep -n '3.5.66' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.69 / SDK v3.3.1 / APP v3.5.65", date: "2026-07-02", changes: [
                      "UPLOAD DESIGN — suporte a Adobe Illustrator (`.ai`) e Photoshop (`.psd`) com limite de 1 GB. Validador central `src/lib/utils/file-security.ts` ganha `ai`/`psd` em `ALLOWED_EXTENSIONS`, MIMEs (`application/postscript`, `application/illustrator`, `application/vnd.adobe.illustrator`, `image/vnd.adobe.photoshop`, `application/x-photoshop`, `application/photoshop`, `image/psd`), nova constante `MAX_DESIGN_FILE_SIZE_BYTES=1 GB` (`.ai`/`.psd`) preservando 200 MB doc / 500 MB vídeo; magic bytes PSD (`38 42 50 53`) e AI (`%PDF` + `%!PS`). `describeUploadError` reflete 1 GB. Trigger `enforce_projeto_anexos_limits` reescrito para permitir 1 GB quando extensão ∈ {ai,psd} (documentos comuns seguem 20 MB, vídeos 100 MB). Novo `src/lib/upload/resumableUpload.ts` faz upload direto para signed URL via XHR com `onProgress`, `AbortController` e retry exponencial (3 tentativas, timeout adaptativo 60s + 200ms/MB); arquivos <5 MB usam fast-path supabase-js. Novo `src/components/ui/upload-progress-bar.tsx` para barra de progresso reutilizável. Utilitário `src/lib/utils/fileIcons.tsx` mapeia ícone/cor por extensão (AI laranja, PSD azul) para preview sem renderização. `AnexarEvidenciaDialog` (briefings/cofre) adiciona `.ai,.psd` no `accept=`; os demais uploaders principais (tarefas/chat/cofre em `TarefaAnexosSection`, `TarefaFocusMode`, `MessageInput`, `ProjetoCofreUploadDialog`) já são wildcard e herdam suporte via validador central. Bump `APP_VERSION` 3.5.64 → 3.5.65. **Pendência da plataforma**: os limites `file_size_limit` e `allowed_mime_types` dos buckets `projeto-anexos`, `documento-anexos`, `attachments`, `marketing-assets`, `briefing-cofre`, `chat-anexos`, `aprovacao-documentos`, `fluxo-artes`, `aprovacao-artes` e `trade-assets` seguem no cap anterior (10–50 MB) porque o Lovable Cloud bloqueia `UPDATE storage.buckets` em migrações. **Uploads acima do cap atual do bucket serão recusados pelo Storage com HTTP 413 mesmo com validador e trigger liberados** — necessário abrir chamado no suporte Lovable pedindo elevação para 1 GB nesses buckets. Invariantes grep: `grep -n 'MAX_DESIGN_FILE_SIZE_BYTES' src/lib/utils/file-security.ts | wc -l` ≥ 1; `grep -n '\"ai\"\\|\"psd\"' src/lib/utils/file-security.ts | wc -l` ≥ 2; `grep -n 'v_is_design' supabase/migrations/*.sql | wc -l` ≥ 1; `grep -n 'resumableUpload\\|ResumableUploadError' src/lib/upload/resumableUpload.ts | wc -l` ≥ 2; `grep -n '3.5.65' src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.68 / SDK v3.3.1 / APP v3.5.64", date: "2026-07-02", changes: [
                      "TAREFAS — paridade da seta de navegação de subtarefa em Minhas Tarefas (legado). `src/components/minhas-tarefas/MinhasTarefasSimples.tsx` agora passa `onOpenSubtarefa` para `ProjetoTarefaDetalhe`, fazendo a seta em `SubtarefasSection` (`src/components/projetos/tarefa-detalhe/SubtarefasSection.tsx:437`) aparecer também nessa superfície — antes só Projetos (`ProjetoListView.tsx:439`) e Central v2 (`central/MinhasTarefasContent.tsx`) tinham. Handler extraído para `src/lib/tarefas/openSubtarefaHandler.ts` (`makeOpenSubtarefaHandler`) e reusado nos dois consumidores, eliminando a duplicação inline anterior. Telemetria (`src/lib/telemetry/subtarefaArrowTelemetry.ts`) ganha surface `v1_minhas_tarefas` para separar métrica da rota `/minhas-tarefas`. Sem mudança em RLS, migrations, RPCs, `ProjetoTarefaRow` ou layout das listas — a auditoria arquitetural completa (unificar row/expand-collapse/badges entre v1/v1-mt/v2) ficou registrada para tarefa separada. Bump `APP_VERSION` 3.5.63 → 3.5.64. Invariantes grep: `grep -n \"makeOpenSubtarefaHandler\" src/lib/tarefas/openSubtarefaHandler.ts src/components/minhas-tarefas/MinhasTarefasSimples.tsx src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 3; `grep -n \"v1_minhas_tarefas\" src/lib/telemetry/subtarefaArrowTelemetry.ts | wc -l` ≥ 2; `grep -n \"3.5.64\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.67 / SDK v3.3.1 / APP v3.5.63", date: "2026-07-02", changes: [
                      "SIDEBAR — telas que o usuário não tem acesso não aparecem mais no menu lateral. `src/components/dashboard/AppSidebar.tsx` agora filtra cada MenuItemLink por `hasPermission(screenCode)` nos módulos que antes vazavam links (`comercial`, `china`, `composicao`, `amostras`, `analise_embalagem`, `etiqueta_bula`, `aprovacao_artes`, `processos`, `projetos`, `reunioes`), reusando telas já cadastradas em `telas_sistema` (`comercial_*`, `ci_*`, `china_*`, `composicao_checklist`, `amostras_recebimento`, `embalagem_analise`, `etiqueta_checklist`, `aprovacao_artes_lista`/`aprovacao_artes_config`, `processos_*`, `reunioes_lista`, `projetos_home`/`projetos_minhas_tarefas`/`projetos_dashboard`). Se todos os subitens forem filtrados, o bloco inteiro do módulo retorna `null` — nada de header vazio. Admin (`isAdmin`) mantém bypass automático via `PermissionsContext`. Sem mudança em RLS, RPCs, migrations ou route guards. Bump `APP_VERSION` 3.5.62 → 3.5.63. Invariantes grep: `grep -n \"comercial_dashboard\\|ci_executivo\\|comercial_ibge\" src/components/dashboard/AppSidebar.tsx | wc -l` ≥ 3; `grep -n \"china_submissoes\\|china_ordens_producao\" src/components/dashboard/AppSidebar.tsx | wc -l` ≥ 2; `grep -n \"composicao_checklist\\|amostras_recebimento\\|embalagem_analise\\|etiqueta_checklist\" src/components/dashboard/AppSidebar.tsx | wc -l` ≥ 4; `grep -n \"processos_consulta\\|processos_etapas\\|processos_workflows\" src/components/dashboard/AppSidebar.tsx | wc -l` ≥ 3; `grep -n \"3.5.63\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.66 / SDK v3.3.1 / APP v3.5.61", date: "2026-07-02", changes: [

                      "FUTURA VENDAS — refinamento do Bloco 4 (`BlocoRankingYoy`) em `/dashboard/fornecedor/vendas`. Página `src/pages/vendas/ResultadosVendas.tsx` passa a `max-w-[1600px]` e grid Mensal/Share em `md:grid-cols-12` (7/5). Ordenação da tabela virtualizada agora indica coluna ativa com `ArrowUp`/`ArrowDown` (peso `text-rv-ink`), suporta toggle asc/desc por Faturamento e Crescimento vs ano anterior, e empurra `variacao=null`/`novo` para o fim quando ordenado por crescimento. Estado `sort`+`query` elevado para o pai — `RankingYoyFocoDialog` recebe props controladas (`query`, `onQueryChange`, `sort`, `onSortChange`), preservando filtro e ordenação ao fechar/reabrir Focar. Rodapé mostra `N de total` real distinguindo filtrado/total + label da ordenação ativa. `max-h` da tabela subiu para `70vh` e Foco expande até `xl:max-w-[1600px]`. Clique em qualquer linha (tabela principal ou Foco) abre novo `ClienteDetalheDialog` com KPIs Faturamento {ano}/{ano-1}/Variação/Ticket/Nº notas usando `formatCurrency` + `variacaoTone`. Helper `sortYoyRows` exportado de `BlocoRankingYoy` e reusado no dialog. Bump `APP_VERSION` 3.5.60 → 3.5.61. Invariantes grep: `grep -n \"ClienteDetalheDialog\" src/components/vendas/BlocoRankingYoy.tsx src/components/vendas/RankingYoyFocoDialog.tsx src/components/vendas/ClienteDetalheDialog.tsx | wc -l` ≥ 3; `grep -n \"sortYoyRows\" src/components/vendas/BlocoRankingYoy.tsx src/components/vendas/RankingYoyFocoDialog.tsx | wc -l` ≥ 2; `grep -n \"max-w-\\[1600px\\]\" src/pages/vendas/ResultadosVendas.tsx | wc -l` ≥ 1; `grep -n \"3.5.61\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.65 / SDK v3.3.1 / APP v3.5.60", date: "2026-07-02", changes: [
                      "FUTURA VENDAS — reescrita editorial de `/dashboard/fornecedor/vendas` em 5 blocos casando 1:1 com o frame Figma. Nova RPC `public.vendas_ranking_cliente(date,date,int)` STABLE SECURITY INVOKER (`GRANT EXECUTE ... TO authenticated, service_role`) alimenta o scatter valor × recorrência (Bloco 2) com um cliente por linha. Página `src/pages/vendas/ResultadosVendas.tsx` orquestra 6 subcomponentes em `src/components/vendas/*`: `HeaderResultados` (seletor 'Fornecedor · Futura' + toggle ano), `BlocoRankingVendedor` (Recharts BarChart com top 5 coloridos rv-steel/steel2/sage/tan/khaki + cauda 'Outros' cinza, avatar circular no eixo X via tick customizado, toggle Faturamento|Nº pedidos), `BlocoScatterClientes` (ScatterChart + ReferenceArea 'Clientes-chave' na metade superior do Y + aside com próximos 8 destaques, cada cliente individual sem soma), `BlocoMensalYoY` (grouped bars sage=atual/cinza=anterior com Δ% acima de cada mês verde/terracota, subtítulo com variação acumulada jan..mês atual, meses futuros ocultam ano corrente), `BlocoShareTabelaPreco` (barras horizontais com faturamento + notas + share%), `BlocoRankingYoy` (tabela virtualizada com `@tanstack/react-virtual` renderizando 100% das linhas, headers ordenáveis por faturamento e crescimento, coluna com barra divergente ±120% centrada em 0 verde/terracota, badge 'NOVO' quando `fat_anterior=0`, botão 'Focar' abre `RankingYoyFocoDialog` full-screen 95vw/90vh com busca e colunas extras fat_anterior/variação/ticket). Novo hook `src/hooks/vendas/useVendasRankingCliente.ts` + token `--rv-steel2` em `src/index.css` e `tailwind.config.ts`. Toggle 'Produto' desabilitado com rótulo '(em breve)' aguardando sell-through. Bump `APP_VERSION` 3.5.59 → 3.5.60. Invariantes grep: `grep -n \"vendas_ranking_cliente\" src/hooks/vendas/useVendasRankingCliente.ts | wc -l` ≥ 1; `grep -n \"BlocoRankingYoy\\|BlocoScatterClientes\\|BlocoMensalYoY\" src/pages/vendas/ResultadosVendas.tsx | wc -l` ≥ 3; `grep -n \"useVirtualizer\" src/components/vendas/BlocoRankingYoy.tsx src/components/vendas/RankingYoyFocoDialog.tsx | wc -l` ≥ 2; `grep -n \"rv-steel2\" tailwind.config.ts | wc -l` ≥ 1; `grep -n \"3.5.60\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.65 / SDK v3.3.1 / APP v3.5.59", date: "2026-07-02", changes: [

                      "FUTURA VENDAS — nova tela editorial `/dashboard/fornecedor/vendas` (`src/pages/vendas/ResultadosVendas.tsx`) substitui `AnaliseVendas` (removida). Paleta terrosa flat via tokens HSL `--rv-*` em `src/index.css` e `theme.extend.colors.rv.*` em `tailwind.config.ts` — zero cores literais. Duas RPCs novas em `public`: `vendas_yoy_por_dimensao(text,int,int)` (STABLE SECURITY INVOKER, retorna crescimento YoY do mesmo período por cliente/vendedor) e `vendas_share_tabela_preco(date,date,int)` (STABLE SECURITY INVOKER, share % por tabela de preço). Hooks TanStack em `src/hooks/vendas/useVendasYoy.ts` e `useVendasShareTabela.ts` calculam `variacao` e `share_pct` no client. Rota mantém `ScreenProtectedRoute screenCode=\"fornecedor_vendas\"`; item sidebar e card de módulo renomeados para 'Resultados de Vendas'. Bump `APP_VERSION` 3.5.58 → 3.5.59. Invariantes grep: `grep -n \"ResultadosVendas\" src/App.tsx | wc -l` ≥ 2; `grep -n \"rv-ink\\|rv-bg\" tailwind.config.ts | wc -l` ≥ 2; `grep -n \"vendas_yoy_por_dimensao\" src/hooks/vendas/useVendasYoy.ts | wc -l` ≥ 1; `grep -n \"vendas_share_tabela_preco\" src/hooks/vendas/useVendasShareTabela.ts | wc -l` ≥ 1; `grep -n \"3.5.59\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.65 / SDK v3.3.1 / APP v3.5.47", date: "2026-07-01", changes: [

                      "NAV V2 — UNIFICAÇÃO DE ENGRENAGENS. Rail v2 (`src/components/navigation/v2/AppRail.tsx`) exibia dois ícones ⚙️ empilhados para admins: um vindo de `nav_sidebar_config` (categoria `configuracoes`/`sistema` com icon=Settings) e outro sintético gerado por `buildAdminCategory` em `src/components/navigation/v2/adminCategory.ts`. `useNavV2Data.ts` agora detecta a categoria hospedeira (icon === 'Settings' OU key normalizada em {configuracoes, config, sistema, administracao, admin}) e absorve os módulos de Administração dentro dela — resultado: uma única engrenagem no rail. Cada módulo mesclado ganha um `sectionLabel` opcional (novo campo em `NavV2Module`) marcando sua origem ('Configurações' vs 'Administração'). `ContextualSidebar.tsx` renderiza subheader `text-[10px] uppercase tracking-wider` + border-top de separação sempre que `sectionLabel` muda entre módulos consecutivos — categorias que NÃO foram fundidas (todas as outras do rail) continuam idênticas, sem subheader. Não-admins não sofrem impacto: `buildAdminCategory` já retorna null e o merge é pulado. Sem alteração de RLS/RPC/edge/migrations/rotas. Bump `APP_VERSION` 3.5.46 → 3.5.47. Invariantes grep: `grep -n \"sectionLabel\" src/components/navigation/v2/useNavV2Data.ts | wc -l` ≥ 2; `grep -n \"sectionLabel\" src/components/navigation/v2/ContextualSidebar.tsx | wc -l` ≥ 2; `grep -n \"SETTINGS_KEYS\" src/components/navigation/v2/useNavV2Data.ts | wc -l` ≥ 1; `grep -n \"3.5.47\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.65 / SDK v3.3.1 / APP v3.5.46", date: "2026-07-01", changes: [

                      "TIPOGRAFIA GLOBAL PADRONIZADA — Meus Projetos e Central de Trabalho agora usam a mesma família em todo o app. Tokens `--font-sans` (body) migrados de Segoe UI para DM Sans e `--font-display` (headings) para Space Grotesk Variable, com fallback `system-ui, -apple-system, 'Segoe UI', sans-serif` preservando o baseline histórico se a fonte web falhar. Fontes auto-hospedadas via `@fontsource/dm-sans` (400/500/600/700) e `@fontsource-variable/space-grotesk` importadas em `src/main.tsx` — sem dependência de Google Fonts CDN (funciona em CN e sob CSP estrita). `tailwind.config.ts` atualizado no mesmo bloco `fontFamily` para manter paridade entre `font-sans`/`font-display` e as variáveis CSS. Nenhum componente foi tocado, nenhum peso/tamanho/tracking alterado, sem mudança de RLS/SDK/OpenAPI/edge/migrations. Bump `APP_VERSION` 3.5.45 → 3.5.46 dispara refresh via heartbeat. Invariantes grep: `grep -n \"DM Sans\" src/index.css | wc -l` ≥ 1; `grep -n \"Space Grotesk\" src/index.css | wc -l` ≥ 1; `grep -n \"@fontsource/dm-sans\" src/main.tsx | wc -l` ≥ 1; `grep -n \"@fontsource-variable/space-grotesk\" src/main.tsx | wc -l` ≥ 1; `grep -n \"3.5.46\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.65 / SDK v3.3.1 / APP v3.5.45", date: "2026-06-12", changes: [

                      "SEGURANÇA — FASE 4 ROTAÇÃO AUTOMÁTICA SEGURA. (1) Migração adiciona coluna `api_key_anterior_hash TEXT` em `public.erp_config`, permitindo período de graça sem armazenar texto plano da chave antiga. (2) RPC `public.rpc_rotate_erp_api_key(p_empresa_id int, p_grace_days int default 7, p_validity_days int default 90)` SECURITY DEFINER com checagem `has_role(auth.uid(), 'admin')`: gera 32 bytes aleatórios (`gen_random_bytes` → hex), calcula SHA-256, move `api_key_hash` atual para `api_key_anterior_hash`, define `api_key_anterior_expira_em = now() + grace`, grava novo hash, limpa `api_key` plaintext, ajusta `api_key_expira_em = now() + validity`. Devolve o texto plano UMA ÚNICA VEZ. EXECUTE revogado de PUBLIC, concedido apenas a `authenticated`. (3) RPC `public.rpc_erp_keys_status()` SECURITY DEFINER para o notificador. (4) `_shared/auth.ts` (`validateErpAuthInternal` e `validateErpAuth`) agora aceita match timing-safe contra `api_key_anterior_hash` durante a janela de graça — antes só comparava plaintext. (5) Nova Edge Function `erp-key-expiration-notifier` (Deno.serve, sem JWT, chamada por cron) detecta chaves com 30/15/5 dias restantes ou já expiradas e insere notificações idempotentes (type=`erp_key_expiration:<empresa>:<threshold>:<YYYY-MM-DD>`) para todos os admins de `user_roles`. (6) Cron job `erp-key-expiration-notifier-daily` agendado para 11:00 UTC via `pg_cron` + `pg_net`. (7) UI: botão `RotateButton` em `src/pages/admin/IntegracoesSaude.tsx` abre Dialog com inputs de grace (0-30d) e validity (7-365d), chama RPC, exibe a nova chave em bloco copiável com `navigator.clipboard.writeText` e avisos de expiração. Apenas linhas `ERP Huggs` com `empresa_id` recebem o botão (Portal Integração não rotaciona pelo mesmo fluxo). Bump `APP_VERSION` 3.5.44 → 3.5.45. Invariantes grep: `grep -n \"api_key_anterior_hash\" supabase/functions/_shared/auth.ts | wc -l` ≥ 2; `grep -n \"rpc_rotate_erp_api_key\" src/pages/admin/IntegracoesSaude.tsx | wc -l` ≥ 1; `grep -n \"RotateButton\" src/pages/admin/IntegracoesSaude.tsx | wc -l` ≥ 2; `grep -n \"3.5.45\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.64 / SDK v3.3.1 / APP v3.5.44", date: "2026-06-12", changes: [
                      "SEGURANÇA — FASE 3 TELEMETRIA DE ANOMALIAS. Adicionado bloco `AnomaliasCard` em `src/pages/admin/IntegracoesSaude.tsx` que consulta `api_security_log` para a janela das últimas 24h (`gte created_at`, limite 5000 linhas, refetch 60s). KPIs: total de requisições, falhas (`success=false`), taxa de falha (%). Banner crítico aciona quando taxa ≥50% AND falhas ≥100. Três rankings agregados em memória: top 5 IPs com mais falhas, top 5 endpoints (method+path) e top 5 mensagens de erro. RLS de `api_security_log` já restringe SELECT a admin/supervisor — nenhuma policy nova. Sem mutação, sem RPC nova, sem schema change. Bump `APP_VERSION` 3.5.43 → 3.5.44. Invariantes grep: `grep -n \"AnomaliasCard\" src/pages/admin/IntegracoesSaude.tsx | wc -l` ≥ 1; `grep -n \"api_security_log_24h\" src/pages/admin/IntegracoesSaude.tsx | wc -l` ≥ 1; `grep -n \"3.5.44\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.63 / SDK v3.3.1 / APP v3.5.43", date: "2026-06-12", changes: [
                      "SEGURANÇA — FASE 2 GESTÃO DE CHAVES ERP. (1) `validateErpAuth` em `supabase/functions/_shared/auth.ts` agora consulta `erp_config` carregando `api_key_hash`, `api_key`, `api_key_anterior`, `api_key_anterior_expira_em`, `api_key_expira_em` e `config_value`. Validação hash-first SHA-256 com `timingSafeEqual`, fallback timing-safe para plaintext em `api_key` e legado em `config_value`, e período de graça honrando `api_key_anterior_expira_em`. Chave expirada (`api_key_expira_em` no passado) é rejeitada mesmo com hash/plaintext válidos — exceto pela janela de graça do par anterior. Source string emitida no log: `erp_config` para chave atual ou `erp_config_grace` quando a anterior é aceita. (2) `UPDATE public.erp_config SET api_key_expira_em = COALESCE(api_key_expira_em, now() + interval '90 days') WHERE config_key='api_key' AND ativo=true` aplicou prazo de 90 dias à chave da empresa 5, que estava sem expiração. (3) Nova página admin `/admin/integracoes-saude` (`src/pages/admin/IntegracoesSaude.tsx`) lista chaves de `erp_config` + `erp_api_keys` com badge Crítico/Atenção/OK (≤5d/≤15d/restante), banner vermelho se houver chave ativa expirando em ≤5 dias, e indicadores de armazenamento (`hash`, `plaintext fallback`). Rota registrada em `src/App.tsx` via `ScreenRoute screenCode='admin'`. Nenhuma chave existente foi rotacionada ou invalidada — mudança puramente aditiva. Sem alteração de SDK, OpenAPI ou contratos REST. Bump `APP_VERSION` 3.5.42 → 3.5.43. Invariantes grep: `grep -n \"api_key_hash\" supabase/functions/_shared/auth.ts | wc -l` ≥ 2; `grep -n \"erp_config_grace\" supabase/functions/_shared/auth.ts | wc -l` ≥ 1; `grep -n \"integracoes-saude\" src/App.tsx | wc -l` ≥ 1; `grep -n \"3.5.43\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.62 / SDK v3.3.1 / APP v3.5.42", date: "2026-06-12", changes: [
                      "SEGURANÇA — APOSENTADORIA COMPLETA DO VETOR LEGACY N8N_API_KEY. Auditoria prévia em `api_security_log` confirmou 0 chamadas a endpoints n8n nos últimos 30 dias antes da remoção. (1) Edge functions deletadas: `contas-pagar-n8n-sync`, `estoque-n8n-sync`, `processar-transacao-n8n`, `clientes-sync` (originalmente receiver dedicado de workflow n8n). (2) Funções com múltiplos auth sources tiveram a linha `Deno.env.get('N8N_API_KEY')` removida mantendo os demais: `sync-dimensao-vendedores` (mantém `POLLO_API_KEY`), `cobranca-automation-api` (mantém `COBRANCA_API_KEY` + `POLLO_API_KEY`), `contas-pagar-api` (mantém fallback `erp_config` + `erp_api_keys`), `_shared/contas-pagar/infra-handlers.ts` (mantém JWT). (3) Funções gated exclusivamente pelo legacy receberam novo guard `requireAdminJwt` de `_shared/admin-jwt.ts` (valida JWT + checa `user_roles.role='admin'`): `trade-marketing-api`, `export-all-data`, `export-prospects`, `export-conversion-rates`, `datawarehouse-api`. (4) Comentário em `_shared/auth.ts` (parâmetro `legacyEnvKeys`) atualizado removendo menção a N8N. Imports órfãos de `timingSafeEqual` retirados de `contas-pagar-api`, `datawarehouse-api` e `_shared/contas-pagar/infra-handlers.ts`. Documentação interna em `src/pages/RelatorioAPIs.tsx` removeu linha `estoque-n8n-sync` e referência ao termo n8n em `erp-export-payment`. Sem mudança de RLS, schema, GRANT, SDK ou OpenAPI público. Bump `APP_VERSION` 3.5.41 → 3.5.42 para forçar refresh. Invariantes grep: `grep -rn \"N8N_API_KEY\" supabase/functions | grep -v admin-jwt.ts | wc -l` = 0; `ls supabase/functions/contas-pagar-n8n-sync supabase/functions/estoque-n8n-sync supabase/functions/processar-transacao-n8n supabase/functions/clientes-sync 2>/dev/null | wc -l` = 0; `grep -n \"requireAdminJwt\" supabase/functions/_shared/admin-jwt.ts | wc -l` ≥ 1; `grep -rn \"requireAdminJwt\" supabase/functions/trade-marketing-api supabase/functions/export-all-data supabase/functions/export-prospects supabase/functions/export-conversion-rates | wc -l` ≥ 4; `grep -n \"3.5.42\" src/lib/version.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.61 / SDK v3.3.1 / APP v3.5.40", date: "2026-06-10", changes: [
                      "CENTRAL DE TRABALHO — PADRONIZAÇÃO DO FUSO HORÁRIO BRASIL EM CALENDÁRIOS/PRAZOS. Substituídas todas as ocorrências de `startOfDay(new Date())` por `getToday()` (meia-noite em `America/Sao_Paulo` via `Intl.DateTimeFormat`) em: `useMinhasTarefas.groupTarefas`, `HojeTab`, `RoleOverviewCard`, `ResumoSemanal`, `DelegadasContent`, `MinhasTarefasBoard.tarefaColumn`, `MinhasTarefasKPIs`, `MinhasTarefasSimples`, `CustomDashboardBuilder`, `WidgetListaProximas`, `WidgetListaAtrasadas`, `WidgetTimelineConclusoes`. Saudação e label de data no header (`CentralHeader`, `MinhasTarefasSimples`) passam a usar `getCurrentHourBR()` + `format(getToday(), ...)`. Gravações em colunas `timestamptz` (`data_conclusao`, `excluida_em`) substituem `new Date().toISOString()` (UTC instantâneo) por `nowSaoPauloISO()` (ISO com offset `-03:00`) em `MinhasTarefasContent.handleToggle`, `HojeTab.handleToggle/handleDeleteTarefa` e `MinhasTarefasSimples.handleToggle/handleDelete/handleBridgeToggle/handleBridgeDelete`. Leituras de `data_prazo` (coluna `DATE`) substituem `new Date(string)` por `parseLocalDate(string)` em `HojeTab.TarefaRow`, `MinhasTarefasContent` (ordenação por prioridade) e `WidgetListaAtrasadas` — elimina shift UTC que após 21h em São Paulo movia tarefas \"de hoje\" para \"atrasadas\". `MinhasTarefasBoard.toIsoDate` agora delega a `formatLocalDate` (componentes locais) preservando a data correta ao soltar no Kanban. `src/lib/utils/parseLocalDate.ts` ganha re-export canônico de `getToday` (definido em `src/utils/dateUtils.ts`) e novo `getCurrentHourBR()` — ponto único de entrada para \"agora SP\". Sem mudança de schema, RLS, GRANT, SDK, OpenAPI ou layout. Bump `APP_VERSION` 3.5.39 → 3.5.40. Invariantes grep: `grep -rn \"startOfDay(new Date())\" src/components/projetos/central src/components/minhas-tarefas src/hooks/useMinhasTarefas.ts | wc -l` = 0; `grep -n \"getCurrentHourBR\" src/lib/utils/parseLocalDate.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.61 / SDK v3.3.1 / APP v3.5.39", date: "2026-06-10", changes: [
                      "CENTRAL DE TRABALHO — KANBAN ARRASTÁVEL + REALTIME MULTI-USUÁRIO. (1) Bug Kanban: `MinhasTarefasContent.tsx` agora passa `onChangePrazo={handleChangePrazo}` para `MinhasTarefasBoard` — antes o handler do board fazia `if (!onChangePrazo) return` e silenciosamente ignorava todo drop em Atrasadas/Hoje/A fazer (só Concluídas funcionava via `onToggle`). Novo `handleChangePrazo` faz `update projeto_tarefas.data_prazo` + invalidate de `[\"minhas-tarefas\"]` + toast. Regras existentes do board preservadas: não recua prazos futuros ao soltar em \"A fazer\", reabre tarefa ao tirar de Concluídas. (2) Realtime: `useMinhasTarefas` ganhou `useEffect` que assina canal `minhas-tarefas-rt:<uid>` com 3 listeners `postgres_changes` — `projeto_tarefas` (event *), `projeto_tarefa_responsaveis` (filter `user_id=eq.<uid>`) e `projeto_tarefa_colaboradores` (idem) — debounced 250 ms invalidando `[\"minhas-tarefas\", uid]`. Cobertura derivada sem mudança extra: Kanban, lista, `HojeTab`, `RoleOverviewCard`, `ResumoSemanal`, `PapelChangeBanner` atualizam sem F5 quando outro usuário menciona, adiciona/remove o usuário, muda prazo, conclui ou cria subtarefa. (3) Migration aditiva: `alter table projeto_tarefa_responsaveis/colaboradores replica identity full` + add à publicação `supabase_realtime` (idempotente via `pg_publication_tables`). Sem mudança de RLS, GRANT, SDK, OpenAPI ou layout. Bump `APP_VERSION` 3.5.38 → 3.5.39. Invariantes grep: `grep -n \"onChangePrazo={handleChangePrazo}\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 1; `grep -n \"minhas-tarefas-rt:\" src/hooks/useMinhasTarefas.ts | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.61 / SDK v3.3.1 / APP v3.5.34", date: "2026-06-09", changes: [
                      "ESTOQUE UNIFICADO 3 NÍVEIS — REMOÇÃO DE CUSTOS + HARDENING DA CONSOLIDAÇÃO. Conclui a remoção dos campos monetários (custo_total) das 3 superfícies (KPIs, tabela principal, breakdown de SKUs, drawer) — coluna SKUs agora renderiza só o inteiro `skus_envolvidos`. Em `src/hooks/estoque/useEstoqueUnificado.ts`, a chave do Map de consolidação por produto-raiz foi normalizada com `Number(r.produto_raiz)` (defensivo contra string vs int devolvido pelo PostgREST em colunas com cast diferente) e adicionado `logger.warn` em dev quando o mesmo produto-raiz cair em chaves diferentes — evita regressão silenciosa onde o mesmo SKU aparecesse em 2 linhas com badge \"1 filial\". Em `EstoqueUnificadoTable.tsx`, badge de empresa em modo consolidado com 1 única filial agora mostra `{abrev} · 1 filial` (igual ao estilo do modo por filial). Bump `APP_VERSION` 3.5.33 → 3.5.34 para forçar invalidação de bundle em clientes ainda no PWA pré-remoção de custos. Invariantes grep: `grep -rn \"skus_envolvidos\\|Number(r.produto_raiz)\" src/hooks/estoque src/components/estoque | wc -l` ≥ 2.",
                    ]},
                    { version: "v4.4.60 / SDK v3.3.1 / APP v3.5.33", date: "2026-06-08", changes: [
                      "BRIEFINGS — COFRE DE DOCUMENTOS SEGUE PARA RR-TASKS NO MESMO CAMINHO DA NOVA API. Antes, `rrtask-create-task` só enviava o conteúdo do briefing (campos + payload) para a página no Notion da agência; os arquivos do Cofre (`briefing_documentos` + bucket `briefing-cofre`) ficavam fora — eram espelhados só pelo fluxo legado `notion-export-briefing` (Notion pessoal). Agora: (1) Novo helper compartilhado `supabase/functions/_shared/rrtask-cofre-docs.ts` com `loadCofreDocs`/`buildCofreDocBlocks`/`appendDocsToPage`/`markDocsEnviados` — busca docs com status `recebido|aprovado`, assina URL do bucket `briefing-cofre` por 7 dias, renderiza como `heading_3` + `bulleted_list_item` (com link nomeado e metadados categoria/fornecedor/lote/tamanho/status) e bloco `file` external para PDF/imagem, marca `enviado_notion_em`/`notion_file_url`/`notion_page_id`. (2) `rrtask-create-task` agora inclui os docs no caminho `create` (toggle Round 1), no `devolucao_resend` (só docs novos no toggle Round N, idempotente via `updated_at > enviado_notion_em`) e no `update` (append como children avulsos com heading `Documentos adicionados em dd/mm`); response ganha `documentos_sincronizados`/`documentos_totais`. (3) Nova edge function `supabase/functions/rrtask-sync-documentos/index.ts` (`auth: 'jwt'`, `rateLimit: 30`) faz push incremental sob demanda: valida owner/admin, exige `rrtask_page_id`, anexa só os docs novos, loga em `rrtask_sync_log` com `action='docs_sync'`. (4) Migration libera `'docs_sync'` e `'devolucao_resend'` em `rrtask_sync_log_action_check`. (5) Frontend dispara o sync (best-effort, silencioso) após upload em `UploadDocumentoDialog.tsx`/`AnexarEvidenciaDialog.tsx` e após `useAplicarTemplate`/`useAtualizarDocumento` em `src/hooks/useBriefingCofre.ts`, sempre checando antes se o briefing tem `rrtask_page_id`. Bump `APP_VERSION` 3.5.32 → 3.5.33. Invariantes grep: `grep -rn \"rrtask-sync-documentos\\|rrtask-cofre-docs\\|buildCofreDocBlocks\\|docs_sync\" src supabase | wc -l` ≥ 6.",
                    ]},
                    { version: "v4.4.59 / SDK v3.3.1 / APP v3.5.32", date: "2026-06-08", changes: [
                      "BRIEFINGS — STATUS DA AGÊNCIA EM TEMPO REAL (RR-TASKS). Antes, o status (`rrtask_status` / `rrtask_aprovacao` / `rrtask_etapa`) só atualizava via cron a cada 5 min em horário comercial (15 min fora). Agora três camadas combinadas: (1) Migration habilita Realtime em `public.briefings` (`ALTER PUBLICATION supabase_realtime ADD TABLE` + `REPLICA IDENTITY FULL`); cria vault secret `rrtask_webhook_secret` + RPCs SECURITY DEFINER `_get_rrtask_webhook_secret()` e `_set_rrtask_webhook_secret(text)` restritas a `service_role`; libera `action='webhook'` em `rrtask_sync_log_action_check`. (2) Nova edge function `supabase/functions/rrtask-webhook/index.ts` (verify_jwt=false) recebe o push do Notion: handshake `{verification_token}` é persistido no vault e ecoado como `{challenge}`; eventos validam `X-Notion-Signature: sha256=...` via HMAC-SHA256 com `timingSafeEqual`, resolvem o briefing por `rrtask_page_id` e disparam o mesmo apply usado pelo poller. (3) Helper compartilhado `supabase/functions/_shared/rrtask-apply-page.ts` extraído (lê página Notion, aplica R09 write-back, faz update do briefing, loga em `rrtask_sync_log`). (4) `rrtask-poll-status` reescrito para 2 modos: cron (cron-secret + janela 5/15 min, lote round-robin de 200) **e** single on-demand `{briefing_id}` autenticado por JWT do usuário, sem janela. (5) Frontend `src/hooks/useBriefingChat.ts` ganha `useEffect` extra que dispara `supabase.functions.invoke('rrtask-poll-status', { body: { briefing_id } })` 400 ms após abrir o briefing — reforço caso o webhook ainda não esteja configurado; o canal Realtime já existente faz a UI re-renderizar sem F5. (6) `supabase/config.toml`: bloco `[functions.rrtask-webhook]` com `verify_jwt = false`. Bump `APP_VERSION` 3.5.31 → 3.5.32. Invariantes grep: `grep -rn \"rrtask-webhook\\|applyRrtaskPage\\|_get_rrtask_webhook_secret\" src supabase | wc -l` ≥ 5.",
                    ]},
                    { version: "v4.4.58 / SDK v3.3.1 / APP v3.5.31", date: "2026-06-08", changes: [

                      "MEU PERFIL — REVELAÇÃO POR CAMPO COM ENFORCEMENT NO BACKEND + RATE LIMIT + AUDITORIA. Migration cria `profile_reveal_grants` (id, user_id, field in cpf/rg/email, granted_at, expires_at, hidden_at, ip, user_agent) e `profile_reveal_attempts` (user_id, success, ip, attempted_at) com RLS: usuário enxerga próprias linhas, admin enxerga todas, INSERT/UPDATE apenas via service_role. RPC `mark_profile_reveal_hidden(_grant_id)` SECURITY DEFINER marca `hidden_at = now()` se o grant pertence a `auth.uid()`. Nova edge function `supabase/functions/meu-perfil-reveal/index.ts` valida JWT, busca email/cpf/rg via service-role, aplica rate limit (5 falhas em 10 min → 429 Retry-After de 15 min), reautentica com `signInWithPassword`, registra tentativa em `profile_reveal_attempts` (sucesso e falha), cria grant com `expires_at = now()+30s` e retorna apenas o valor do campo solicitado. Em `src/pages/MeuPerfil.tsx`: substitui botão único por `SensitiveField` por linha (CPF, RG, e-mail) com state `Record<'cpf'|'rg'|'email', RevealState>`, timers independentes por campo, countdown ao vivo no botão Ocultar, e chamada para `supabase.functions.invoke('meu-perfil-reveal')`. Novo card 'Auditoria — Revelações de dados sensíveis' lista próprias concessões com data/hora, campo, duração calculada (`hidden_at ?? expires_at − granted_at`) e motivo de encerramento (ocultado vs expirou). Admins automaticamente recebem todas as linhas via policy. Bump `APP_VERSION` 3.5.30 → 3.5.31. Invariantes grep: `grep -rn \"profile_reveal_grants\\|meu-perfil-reveal\\|SensitiveField\" src supabase/functions | wc -l` ≥ 5.",
                    ]},
                    { version: "v4.4.57 / SDK v3.3.1 / APP v3.5.30", date: "2026-06-08", changes: [
                      "MEU PERFIL — STEP-UP DE PRIVACIDADE PARA CPF/RG/EMAIL. Em `src/pages/MeuPerfil.tsx`, os campos sensíveis do card 'Dados de cadastro' agora aparecem sempre mascarados por padrão (email: `xx****@d****.com`; CPF: `***.456.789-**`; RG: 2 últimos dígitos visíveis). Botão 'Mostrar completos' abre `Dialog` que exige reautenticação (`signInWithPassword` com email do perfil + senha atual); ao validar, libera os valores completos por 30 s (timeout via `setTimeout` com cleanup em unmount) e registra o evento em `sensitive_data_access_log` (action `reveal_own_pii`, `record_id = auth.uid()`). Botão 'Ocultar' encerra a janela manualmente. Helpers novos: `formatCpfFull`, `maskRgPartial`, `maskEmailPartial`. Senha do diálogo nunca é logada; insert em auditoria é best-effort (try/catch silencioso). Bump `APP_VERSION` 3.5.29 → 3.5.30. Invariantes grep: `grep -rn \"reveal_own_pii\\|maskEmailPartial\\|REVEAL_TTL_MS\" src | wc -l` ≥ 3.",
                    ]},
                    { version: "v4.4.56 / SDK v3.3.1 / APP v3.5.29", date: "2026-06-08", changes: [
                      "PERFIL — NOVA PÁGINA 'MEU PERFIL' (/meu-perfil) ACESSÍVEL A TODOS OS USUÁRIOS AUTENTICADOS. Criada `src/pages/MeuPerfil.tsx` com 4 cards: (1) Foto de perfil — upload PNG/JPG/WebP até 2 MB em `avatars/<uid>/avatar-<ts>.<ext>` e atualização de `profiles.avatar_url`; (2) Dados pessoais editáveis (nome, cargo, telefone com máscara `(99) 99999-9999`) validados via Zod `.strict()`; (3) Dados de cadastro somente leitura (email, CPF mascarado parcial `***.456.789-**`, RG, data de cadastro); (4) Segurança — redefinição de senha com reautenticação obrigatória (`signInWithPassword` antes de `updateUser({ password })`), regras mín. 8 chars/1 maiúscula/1 número, e checkbox obrigatório de aceite de `privacy_policy@1.0` + `terms_of_use@1.0` (gravado em `terms_acceptance` via upsert com `onConflict: user_id,document_type,document_version`). Sidebar (`AppSidebar.tsx`) ganhou link `NavLink` para `/meu-perfil` no rodapé ao lado do ícone de Configurações, e o bloco avatar+nome do usuário virou clicável para a mesma rota. Rota registrada em `src/App.tsx` sob `<ProtectedRoute>` (disponível a qualquer perfil, inclusive Portal ERP). Bump `APP_VERSION` 3.5.28 → 3.5.29. Invariantes grep: `grep -rn \"/meu-perfil\\|MeuPerfil\" src | wc -l` ≥ 4.",
                    ]},
                    { version: "v4.4.55 / SDK v3.3.1 / APP v3.5.28", date: "2026-06-08", changes: [
                      "AUTH — CADASTRO ENRIQUECIDO COM CARGO, TELEFONE, CPF, RG E FOTO. Migration adiciona `profiles.cargo`, `profiles.cpf` (UNIQUE parcial onde NOT NULL/'') e `profiles.rg`; trigger `handle_new_user` passa a ler `cargo/telefone/cpf/rg` de `auth.users.raw_user_meta_data` (mantém `nome` e `tipo_usuario`). `SignupForm.tsx` reescrito: campos novos obrigatórios com máscaras locais (CPF `999.999.999-99` com DV; Telefone `(99) 99999-9999`), input file para avatar (PNG/JPG/WebP até 2 MB) com preview circular e upload para o bucket `avatars` no path `<uid>/avatar-<ts>.<ext>` (policies já existentes) e em seguida `profiles.avatar_url` é atualizado; CPF e telefone são gravados apenas com dígitos. Zod `.strict()` mantido + honeypot. Bump `APP_VERSION` 3.5.27 → 3.5.28. Invariantes grep: `grep -rn \"isValidCPF\\|maskTelefone\\|maskCPF\" src | wc -l` ≥ 3.",
                    ] },
                    { version: "v4.4.54 / SDK v3.3.1 / APP v3.5.27", date: "2026-06-08", changes: [
                      "USUÁRIOS — 'APLICAR ACESSO PADRÃO' AGORA PERMITE ESCOLHER USUÁRIO. Em `src/components/configuracoes/GerenciamentoUsuarios.tsx`, o botão 'Aplicar acesso padrão' virou um `DropdownMenu` com duas opções: (1) 'Aplicar a um usuário específico…' abre `Dialog` com combobox (`Command` + `Popover`) que filtra a lista `usuarios` por nome/email, mostra badge 'Pendente' para não aprovados e chama `supabase.rpc('aplicar_acesso_padrao', { _user_id })`; (2) 'Aplicar a todos os usuários ativos' abre `AlertDialog` (substitui o `confirm()` nativo) que chama `aplicar_acesso_padrao_em_massa()`. Ambos os fluxos exibem toast com `telas_concedidas`/`modulos_concedidos`. Sem mudanças de backend — as duas RPCs já existiam (`aplicar_acesso_padrao(_user_id uuid)` e `aplicar_acesso_padrao_em_massa()`). Bump `APP_VERSION` 3.5.26 → 3.5.27. Invariantes grep: `grep -rn \"acessoPadraoSingleOpen\\|aplicar_acesso_padrao\" src | wc -l` ≥ 3.",
                    ] },
                    { version: "v4.4.53 / SDK v3.3.1 / APP v3.5.26", date: "2026-06-08", changes: [
                      "AUTH — REABILITA AUTO-CADASTRO COM FILA DE APROVAÇÃO. (1) `src/components/auth/SignupForm.tsx` reescrito como formulário real (nome, email, senha, confirmação) com Zod `.strict()` e honeypot; chama `supabase.auth.signUp({ email, password, options: { data: { nome }, emailRedirectTo: '/aguardando-aprovacao' } })` e em caso de sucesso redireciona para `/aguardando-aprovacao`. (2) Nova rota `/auth/signup` agora aponta para `src/pages/Signup.tsx` (antes era `<Navigate to=\"/auth/login\">`). (3) `LoginForm` ganhou link 'Criar conta'. (4) `configure_auth`: `disable_signup=false`, `auto_confirm_email=true`, `password_hibp_enabled=true` — usuário consegue logar imediatamente e cair em `/aguardando-aprovacao` até o admin aprovar. (5) Pacote 'acesso padrão' continua sendo aplicado automaticamente pelo trigger `handle_new_user` via `aplicar_acesso_padrao(NEW.id)` no momento do signup (módulo Projetos pré-configurado). Aprovação do admin apenas altera `profiles.aprovado=true`. (6) `GerenciamentoUsuarios.tsx` ganhou abas 'Pendentes / Aprovados / Todos' com contadores, banner de destaque quando há pendentes (`bg-warning/10`) e ordenação por mais antigos primeiro — facilita a triagem do ADM. Bump `APP_VERSION` 3.5.25 → 3.5.26. Invariantes grep: `grep -rn \"aprovacaoFilter\\|Criar conta e solicitar acesso\" src | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.52 / SDK v3.3.1 / APP v3.5.25", date: "2026-06-08", changes: [
                      "PROJETOS — ELIMINA PISCAR E FECHAMENTO DO MODO FOCO EM EDIÇÕES. Causa raiz: `useProjetoTarefas.scheduleReconcile()` chamava `refetchQueries(type:'active')` ~600ms após cada update, trocando a referência da lista de tarefas e provocando (1) re-render do `selectedTarefa` no `ProjetoListView`/`ProjetoKanbanView`/`MinhasTarefasContent`, (2) sensação de F5 visual no painel e nas linhas, (3) em caminhos sensíveis, fechamento colateral do `Dialog` do Modo Foco. Solução: novo módulo `src/hooks/projetoTarefasOpenGate.ts` (gate global por `projetoId` com `acquireDetailGate`/`releaseDetailGate`/`isDetailGateActive`/`subscribeDetailGate`); enquanto houver painel de detalhe OU Modo Foco aberto, `scheduleReconcile` só marca a query como stale e adia o refetch, flushando automaticamente quando o último gate libera (via `subscribeDetailGate`). Acquire/release adicionados em `ProjetoListView` (efeito de `selectedTarefaId`), `ProjetoKanbanView` (idem), `MinhasTarefasContent` (efeito de `detailOpen`+`selectedProjetoId`) e `TarefaFocusMode` (efeito de `open`+`projeto_id`, defesa adicional). `TarefaFocusMode` ganhou `DialogTitle`/`DialogDescription` envoltos em `VisuallyHidden` (`@radix-ui/react-visually-hidden`) — remove os erros de acessibilidade do Radix vistos no console que contribuíam para instabilidade da camada. Bump `APP_VERSION` 3.5.24 → 3.5.25. Invariantes grep: `grep -rn \"projetoTarefasOpenGate\\|acquireDetailGate\\|isDetailGateActive\" src | wc -l` ≥ 6.",
                    ] },
                    { version: "v4.4.51 / SDK v3.3.1 / APP v3.5.24", date: "2026-06-08", changes: [
                      "PROJETOS — MODO FOCO: corrige fechamento do Foco ANTES do usuário confirmar a conclusão de tarefa/subtarefa. Causa raiz: o `toggleTarefaCompleta` rodava `confirmConclusaoTarefa` dentro do `mutationFn`, então o `onMutate` (update otimista) aplicava `status='concluida'` na cache ANTES do AlertDialog aparecer; a mudança na signature do `useMemo` `selectedTarefa` em `ProjetoListView` retornava nova referência de tarefa, e o AlertDialog global do `ConfirmConclusaoListener` (montado fora da árvore do Focus) entrava como nova layer Radix por cima — combinação que derrubava o `Dialog` do Focus em alguns caminhos de re-render. Solução: novo wrapper `confirmAndToggleTarefa(tarefa)` exportado por `useProjetoTarefas` que (1) dispara `confirmConclusaoTarefa` ANTES de chamar `.mutate()`, (2) só dispara a mutation se o usuário confirmar, e (3) garante que nenhum update otimista rode antes do confirm — eliminando o re-render colateral. `ProjetoListView.handleToggle` e `ProjetoKanbanView` (card e detalhe) passam a usar o wrapper. `TarefaFocusMode` ganhou `onFocusOutside={e => e.preventDefault()}` como defesa em profundidade contra focus-stealing de overlays portalizados. `mutationFn` agora retorna `__CANCELLED__` apenas no fluxo de evidência da China (não mais para confirm cancelado). Bump `APP_VERSION` 3.5.23 → 3.5.24. Invariante grep: `grep -rn \"confirmAndToggleTarefa\" src | wc -l` ≥ 3.",
                    ] },
                    { version: "v4.4.50 / SDK v3.3.1 / APP v3.5.23", date: "2026-06-08", changes: [
                      "PROJETOS — MODO FOCO: paridade total de subtarefas + reforço anti-fechamento. Novo componente `src/components/projetos/tarefa-detalhe/SubtarefasSection.tsx` (self-contained: gerencia edição inline, IA pending e show/hide concluídas) replica no Modo Foco a UI rica do detalhe normal (checkbox + título editável + abrir subtarefa + excluir + selects inline de Status/Prioridade/Estágio + `SubtarefaResponsavelPicker` + badge de data + botão 'Sugerir com IA' que dispara `generateChecklist`). `TarefaFocusMode.tsx` ganhou props `onDelete` e `onOpenSubtarefa` e substituiu o bloco minimal anterior pelo novo componente. `ProjetoTarefaDetalhe.tsx` repassa `onDelete` e mapeia `onOpenSubtarefa → setSelectedSubtarefaId`, permitindo abrir o detalhe da subtarefa por cima do Modo Foco sem fechá-lo. Defesa adicional: o `Sheet` pai agora ignora qualquer pedido de `onOpenChange` enquanto `focusMode === true`, evitando que re-renders colaterais (refetch após concluir tarefa/marcar update) derrubem o Sheet e façam a tela 'saltar' para fora do foco. Bump `APP_VERSION` 3.5.22 → 3.5.23. Invariante grep: `grep -rn \"SubtarefasSection\" src | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.49 / SDK v3.3.1 / APP v3.5.22", date: "2026-06-08", changes: [
                      "COFRE — Filtro automático 'minha equipe' no diálogo `PromoverAnexoCofreDialog`. Novo hook `useMeuDepartamento` (`src/hooks/cofre/useCofreProdutoPastas.ts`) lê `profiles.departamento_id` do usuário logado e busca o nome em `departamentos` (cache 5min). Quando o usuário tem departamento, o select 'Pasta / Coleção' passa a mostrar apenas pastas cujo `departamento_id` é o do usuário OU `null` (globais), com Switch 'Só da minha equipe' ligado por padrão e contador de pastas ocultas; desligar revela todas. Effect normaliza `pastaId` para `__sem_pasta__` quando a seleção corrente sai do filtro. Ao abrir 'Nova pasta', o select de equipe é pré-preenchido com o departamento do usuário. Estado vazio explícito: 'Nenhuma pasta para a sua equipe.' Bump `APP_VERSION` 3.5.21 → 3.5.22. Invariante grep: `grep -rn \"useMeuDepartamento\\|filtrarMinhaEquipe\\|pastasVisiveis\" src | wc -l` ≥ 4.",
                    ] },
                    { version: "v4.4.48 / SDK v3.3.1 / APP v3.5.21", date: "2026-06-08", changes: [
                      "COFRE — Pastas/coleções por produto com vínculo opcional a equipe (departamento). Nova tabela `cofre_produto_pastas` (`produto_id`, `nome` único por produto, `descricao`, `departamento_id` FK em `departamentos`, `cor`, `criado_por`) com RLS via `can_access_fabrica`; apenas o criador ou `admin` pode excluir. Nova coluna `fabrica_revisao_documentos.pasta_id` (FK em `cofre_produto_pastas`, `ON DELETE SET NULL`, índice dedicado) classifica cada documento por pasta. Hook `useCofreProdutoPastas` (`src/hooks/cofre/useCofreProdutoPastas.ts`) lista pastas com `departamento` embed e expõe `createPasta` (escopa `criado_por` no auth.uid()); novo `useDepartamentosOptions` cacheia o select de equipes (5min). `PromoverAnexoCofreDialog` ganha select 'Pasta / Coleção' (com `Sem pasta (raiz)` e label `nome — equipe`) e botão 'Nova pasta' inline (nome + equipe opcional) que cria a pasta e a seleciona automaticamente; `sendToCofre` em `useProjetoTarefaDetalhe.ts` agora aceita `pastasPorAnexo: Record<anexoId, pastaId|null>` e grava `pasta_id` no insert de `fabrica_revisao_documentos`. Bump `APP_VERSION` 3.5.20 → 3.5.21. Invariante grep: `grep -rn \"cofre_produto_pastas\\|useCofreProdutoPastas\\|pastasPorAnexo\" src | wc -l` ≥ 5.",
                    ] },
                    { version: "v4.4.47 / SDK v3.3.1 / APP v3.5.20", date: "2026-06-08", changes: [
                      "CHAT TAREFAS — Anexos no chat (Focus Mode + painel lateral do detalhe da tarefa): botão `Paperclip` no composer envia o arquivo via `uploadAnexo` (bucket `projeto-anexos`, path `<uid>/<tarefaId>/<ts>_<nome>`, validação 20MB e log em `produto_doc_audit_log`) e logo em seguida dispara `sendMessage` com `anexo_id` apontando para o registro recém-criado em `projeto_tarefa_anexos` — o arquivo aparece simultaneamente na aba 'Anexos' da tarefa e como card inline na bolha da mensagem. Novo componente compartilhado `ChatAnexoCard` (`src/components/projetos/chat/ChatAnexoCard.tsx`) renderiza preview de imagem ou cartão de download (via Blob, sem `window.open`) com ações 'Ver na tarefa', 'Baixar' e 'Promover ao Cofre'. Novo diálogo `PromoverAnexoCofreDialog` reusa `sendToCofre` do hook `useProjetoTarefaDetalhe` com a mesma lista de categorias da aba 'Fora do Cofre' e mesma validação de papel `admin_cofre`/`coordenador` via RPC `can_publish_to_cofre`; botão é desabilitado quando a tarefa não tem produto vinculado e oculto para papéis sem permissão. `TarefaFocusMode.tsx` e `tarefa-detalhe/TarefaChatPanel.tsx` (consumido em `ProjetoTarefaDetalhe.tsx`) agora exibem o card de anexo, e o painel lateral recebe `uploadAnexo`, `getAnexoUrl`, `sendToCofre`, `produtoId`, `projetoId` e `canPromoteToCofre` via props. Nenhuma mudança de schema/RLS: usa `projeto_tarefa_messages.anexo_id`, `projeto_tarefa_anexos`, `projeto_cofre_documentos` e triggers de notificação já existentes. Bump `APP_VERSION` 3.5.19 → 3.5.20. Invariante grep: `grep -rn \"ChatAnexoCard\\|PromoverAnexoCofreDialog\\|canPromoteToCofre\" src | wc -l` ≥ 5.",
                    ] },

                    { version: "v4.4.46 / SDK v3.3.1 / APP v3.5.19", date: "2026-06-08", changes: [
                      "CHAT TAREFAS — Governança e produtividade na aba 'Tarefas': (1) nova tabela `projeto_tarefa_chat_preferencias_audit (user_id, tarefa_id, changed_by, action, previous_muted, previous_archived, new_muted, new_archived)` com trigger `trg_log_tarefa_chat_preferencia` em `projeto_tarefa_chat_preferencias` que registra automaticamente quem silenciou/arquivou uma conversa e os valores antes/depois — rastreamento auditável de qualquer mudança. RLS: usuário lê apenas registros próprios (`user_id = auth.uid()` OU `changed_by = auth.uid()`). (2) Conversas silenciadas/arquivadas continuam preservando histórico completo, mas não incrementam notificações nem contadores globais (mute/archive já honrados em `notify_task_mentions`/`notify_task_replies` e nos cálculos `naoLidasTotal`/`countTarefas`/`countSubtarefas` no sidebar). (3) Busca expandida cobre projeto + tarefa + parent + código + status + última mensagem; ordenação por última mensagem (default), projeto, tarefa, subtarefa (subt. primeiro) ou status — via menu `ArrowUpDown` no header da aba. (4) Modo de seleção múltipla com checkboxes (toggle `CheckSquare2`/`X` no header), 'Selecionar todas (visíveis)' e ações em lote: silenciar, reativar, arquivar, restaurar via nova RPC SECURITY DEFINER `rpc_tarefa_chat_set_preferencia_bulk(p_tarefa_ids uuid[], p_muted boolean, p_archived boolean)` que aplica upsert atômico e dispara o trigger de auditoria para cada tarefa. Hook `useTarefaChatPreferenciaBulk` invalida a query e exibe toast com contagem. Bump `APP_VERSION` 3.5.18 → 3.5.19. Invariante grep: `grep -rn \"projeto_tarefa_chat_preferencias_audit\\|rpc_tarefa_chat_set_preferencia_bulk\\|useTarefaChatPreferenciaBulk\\|ordenarTarefasChat\" src supabase/migrations | wc -l` ≥ 5.",
                    ] },

                    { version: "v4.4.45 / SDK v3.3.1 / APP v3.5.18", date: "2026-06-08", changes: [
                      "CHAT TAREFAS — Aba 'Tarefas' do hub ganhou (1) silenciar/arquivar por conversa via nova tabela `projeto_tarefa_chat_preferencias (user_id, tarefa_id, muted, archived)` com RLS por `auth.uid()`, sem perder histórico; (2) anexos no chat — coluna nova `anexo_id` em `projeto_tarefa_messages` (FK `projeto_tarefa_anexos`), com preview inline para imagens e card de download para outros formatos, mais link 'Ver na tarefa' que abre o detalhe (`/dashboard/projetos/<id>?tarefa=<id>&anexo=<id>`); (3) novos filtros na sidebar — Todas / Tarefas / Subt. / Não lidas / @ / Arquivadas, com contadores por categoria; (4) notificações realtime — `notify_task_mentions` agora ignora destinatários que silenciaram/arquivaram, e novo trigger `notify_task_replies` insere `notifications` tipo `task_reply` para responsável/criador/colaboradores/seguidores (exceto autor e mencionados, respeita mute/archive). Mensagens fluem para o sino global via `useNotifications` (toast) e `useMencoesNotifications` (@). RPC `rpc_chat_tarefas_do_usuario` agora também retorna `muted, archived`. Bump `APP_VERSION` 3.5.17 → 3.5.18. Invariante grep: `grep -rn \"projeto_tarefa_chat_preferencias\\|notify_task_replies\\|useTarefaChatPreferencia\" src supabase/migrations | wc -l` ≥ 4.",
                    ] },

                    { version: "v4.4.44 / SDK v3.3.1 / APP v3.5.17", date: "2026-06-08", changes: [
                      "CHAT — Nova aba 'Tarefas' no hub corporativo de Chat (`ChatLayout`/`ChatSidebar`), agregando tarefas E subtarefas em que o usuário participa (responsável, criador, colaborador, seguidor ou mencionado em alguma mensagem) e que possuam conversa em `projeto_tarefa_messages`. O usuário agora recebe no hub central as notificações de mensagens trocadas dentro de cada tarefa/subtarefa, com contagem de não lidas, badge de menções (@), prévia do último autor/conteúdo, breadcrumb do projeto e indicação visual de subtarefa. Filtros: Todas / Não lidas / @ Menções / Subtarefas. Realtime via `postgres_changes` em `projeto_tarefa_messages`. Painel central reusa o chat existente da tarefa (mesma origem de verdade), com botão 'Abrir tarefa' que navega para `/dashboard/projetos/<id>?tarefa=<id>`. Marcação de leitura: nova tabela `projeto_tarefa_chat_leituras (user_id, tarefa_id, last_read_at)` com RLS por `auth.uid()`, RPC `rpc_tarefa_chat_marcar_lida(p_tarefa_id)` (SECURITY DEFINER, valida via `user_can_access_projeto_via_tarefa`) e RPC agregadora `rpc_chat_tarefas_do_usuario()` que retorna tarefas com prévia da última mensagem, contagem de não lidas (mensagens posteriores a `last_read_at` e não autoria do próprio user) e contagem de menções. Novos arquivos: `src/hooks/chat/useTarefasChat.ts`, `src/hooks/chat/useTemAcessoTarefas.ts`, `src/components/chat/v2/TarefaChatPanel.tsx`. Bump `APP_VERSION` 3.5.16 → 3.5.17. Invariante grep: `grep -rn \"rpc_chat_tarefas_do_usuario\\|TarefaChatPanel\\|useTarefasChat\" src supabase/migrations | wc -l` ≥ 4.",
                    ] },

                    { version: "v4.4.43 / SDK v3.3.1 / APP v3.5.16", date: "2026-06-08", changes: [
                      "PROJETOS / COFRE — Upload de anexo em tarefa/subtarefa agora oferece, no mesmo diálogo, a opção 'Promover ao Cofre do produto' com seletor de categoria (Briefing, Arte Final, Rótulo, etc.). O toggle só aparece quando a tarefa tem produto vinculado e o usuário tem papel `admin_cofre`/`coordenador`. Para os demais, exibe nota informativa. Após o upload, dispara `sendToCofre` automaticamente.",
                      "PROJETOS / COFRE — Nova ação 'Tirar do Cofre' (rebaixar) na aba 'No Cofre' do Modo Foco. Soft delete em `fabrica_revisao_documentos` (status=`removido`, `removed_at`, `removed_by`) preserva histórico e auditoria; o anexo bruto permanece nos anexos da tarefa. Mesma alçada do envio (`admin_cofre`/`coordenador`). Query do cofre passa a filtrar `removed_at IS NULL`.",
                      "PADRÃO DE FUSO BRASIL — Calendário de prazo de tarefas (e subtarefas) corrigido: antes usava `new Date(data_prazo)` na leitura e `d.toISOString().split('T')[0]` na escrita, o que gravava o dia anterior em São Paulo (UTC-3) e violava a Core rule #5. Agora usa `parseLocalDate` / `parseLocalDateOrNow` / `formatLocalDate` em `TarefaFocusMode.tsx`, `ProjetoTarefaDetalhe.tsx` e `useProjetoTarefas.ts`. `data_conclusao` passa a usar `todayBR()` e `updated_at` manual usa `nowSaoPauloISO()`.",
                      "PADRÃO DE FUSO BRASIL — `src/lib/utils/parseLocalDate.ts` exporta novos helpers canônicos: `formatLocalDate(date)` (escrita em coluna DATE sem shift UTC), `nowSaoPauloISO(date?)` (timestamptz com offset -03:00 explícito) e `todayBR()` (atalho YYYY-MM-DD do dia em SP). Migration cria função SQL `public.app_now_br()` para triggers/views futuros que precisem do 'agora Brasil'.",
                      "BANCO — Migration adiciona `removed_at timestamptz`, `removed_by uuid` e índice parcial em `fabrica_revisao_documentos` para suportar soft remove no Cofre.",
                      "Bump `APP_VERSION` 3.5.15 → 3.5.16. Invariante grep: `grep -n \"3.5.16\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },

                    { version: "v4.4.42 / SDK v3.3.1 / APP v3.5.15", date: "2026-06-08", changes: [
                      "PROJETOS — Reforço do Modo Foco: mesmo após o fix v3.5.14, concluir uma subtarefa (e outras ações que invalidam a query) ainda fechava o foco por um caminho não-Radix (re-render colateral da página pai). Solução: adicionado guard de intenção explícita em `ProjetoTarefaDetalhe.tsx` via `closeFocusIntentRef` — o `onOpenChange` do `TarefaFocusMode` agora IGNORA qualquer pedido de fechamento que não tenha sido armado pelos caminhos legítimos (botão 'Sair do Foco' e Esc). O `TarefaFocusMode` ganhou prop `requestExitFocus` que é chamada antes de `onOpenChange(false)` no botão de saída e no `handleOpenChangeSafe` (Esc). Resultado: marcar/desmarcar subtarefa, concluir marco, mudar responsável, mudar data e qualquer save com refetch mantêm o foco aberto; só sai por ação explícita do usuário. Bump `APP_VERSION` 3.5.14 → 3.5.15. Invariante grep: `grep -n \"3.5.15\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },

                    { version: "v4.4.41 / SDK v3.3.1 / APP v3.5.14", date: "2026-06-08", changes: [
                      "PROJETOS — Modo Foco da tarefa não fecha mais sozinho ao concluir marco, marcar subtarefa, alterar responsável, mudar status/prioridade ou escolher data no calendário. Causa raiz: o `DialogContent` do `TarefaFocusMode` herdava o comportamento padrão do Radix de fechar em `pointerDownOutside`/`interactOutside`, e qualquer overlay portalizado (AlertDialog de confirmação de conclusão, Popover do calendário, Select de status, Dropdowns, cmdk) era interpretado como clique fora — fechando o foco e expondo o Sheet simples por trás (sensação de 'piscar e sair do foco'). Fix em `src/components/projetos/TarefaFocusMode.tsx`: `onPointerDownOutside` e `onInteractOutside` agora chamam `e.preventDefault()`, e `onOpenChange` ignora qualquer pedido de abertura vindo do Radix — só o botão explícito 'Sair do Foco' (e Esc quando nenhum overlay está sobre o foco) fecha a tela. Bump `APP_VERSION` 3.5.13 → 3.5.14. Invariante grep: `grep -n \"3.5.14\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.40 / SDK v3.3.1 / APP v3.5.13", date: "2026-06-08", changes: [
                      "PROJETOS — Visibilidade do painel de Detalhe de Tarefa passa a ser GLOBAL: o que o admin oculta em `/dashboard/admin/visibilidade-detalhe-tarefa` fica oculto para TODOS os usuários (vendedor, supervisor, gerente, marketing, etc.). O administrador é automaticamente isento e continua vendo tudo (bypass em `useUIPermissions` via `useUserRole().isAdmin`). Regras são gravadas com sentinel `role='__all__'`/`departamento_id=null`. Tela ADM simplificada: removidos os seletores 'Por perfil' / 'Por departamento'; lista única com switch global por componente. Migration de dados consolida regras antigas (ex.: regras só de `vendedor`) em escopo global e remove as específicas. Precedência mantida no hook: departamento > role específico > global > default. Bump `APP_VERSION` 3.5.12 → 3.5.13. Invariante grep: `grep -n \"3.5.13\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.39 / SDK v3.3.1 / APP v3.5.12", date: "2026-06-08", changes: [
                      "RELEASE — Bump `APP_VERSION` 3.5.11 → 3.5.12 consolidando o fix de visibilidade do painel Minhas Tarefas (Realtime em `ui_permissions` + `useUIPermissions` consumido por `MinhasTarefaDetail`). Invariante grep: `grep -n \"3.5.12\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.38 / SDK v3.3.1 / APP v3.5.11", date: "2026-06-08", changes: [
                      "PROJETOS — Configurações de visibilidade do painel de tarefa passam a valer também no painel de Minhas Tarefas/Central de Trabalho (`src/components/minhas-tarefas/MinhasTarefaDetail.tsx` agora consome `useUIPermissions('tarefa_detalhe').canView`). Catálogo `src/config/tarefa-detalhe-componentes.ts` ganhou novos códigos: `secao_anexos`, `secao_chat`, `campo_observacoes`, `acao_abrir_no_projeto`. Hook `useUIPermissions` reduziu `staleTime` de 5 min para 60 s, ativou `refetchOnWindowFocus` e passou a assinar Realtime em `public.ui_permissions` filtrado por `tela_codigo`, invalidando o cache assim que o admin grava regra nova. Migration `ALTER PUBLICATION supabase_realtime ADD TABLE public.ui_permissions`. Bump `APP_VERSION` 3.5.10 → 3.5.11. Invariante grep: `grep -n \"3.5.11\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.37 / SDK v3.3.1 / APP v3.5.10", date: "2026-06-08", changes: [
                      "SEGURANÇA — Correções de IDOR e hardening em edge functions: `analyze-brand-positioning` agora exige `our_brands.created_by = user.id` e restringe `competitor_intelligence` ao escopo do usuário (vendedor/supervisor); `phyllo-create-sdk-token` deriva o `phyllo_user_id` exclusivamente de `phyllo_users` via `ctx.userId` (remove parâmetro vindo do body); `save-brand-analysis` valida ownership em `our_brands` antes do update e seta `created_by = ctx.userId` no insert de `our_products`; `asana-sync /replay-user` agora exige role `admin` (via `has_role`) para replay de outro usuário, ou self-replay. Migration revoga `EXECUTE` em funções `SECURITY DEFINER` do schema `public` para `anon`/`PUBLIC`, mantendo apenas `submit_dynamic_form_response` (uso público intencional para envio de formulários). Bump `APP_VERSION` 3.5.09 → 3.5.10. Invariante grep: `grep -n \"3.5.10\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.36 / SDK v3.3.1 / APP v3.5.09", date: "2026-06-08", changes: [
                      "PROJETOS — Visibilidade configurável do painel de Detalhe de Tarefa. Cada ação do cabeçalho (Marcar como concluída, Chat, Copiar link, Foco, número do processo) e cada campo/seção do corpo (Status, Prioridade, Estágio, Data prazo, Início planejado, Alertar antes, Risco, Responsável/Seguidores, Produto, Processo, China, Módulos vinculados, Mover para, Retrabalho, Dependências, Workflow de Aprovação, Marcos/Metas) passa por `useUIPermissions('tarefa_detalhe').canView(codigo)` em `ProjetoTarefaDetalhe.tsx`. Catálogo centralizado em `src/config/tarefa-detalhe-componentes.ts`. Nova tela ADM `/dashboard/admin/visibilidade-detalhe-tarefa` (`src/pages/admin/VisibilidadeDetalheTarefa.tsx`, somente `admin`) permite ocultar componentes por perfil (role) ou por departamento — útil para esconder features em desenvolvimento de usuários ativos. Persistido em `ui_permissions` (default = visível; regra com `visivel=false` esconde; departamento sobrepõe role). Bump `APP_VERSION` 3.5.08 → 3.5.09. Invariante grep: `grep -n \"3.5.09\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.35 / SDK v3.3.1 / APP v3.5.08", date: "2026-06-08", changes: [
                      "ESTOQUE — RPC `estoque_filtro_opcoes` (SECURITY DEFINER, STABLE) passa a alimentar o painel de filtros com empresas/linhas/unidades distintas respeitando RLS, eliminando o truncamento de 10.000 linhas no client. Botão 'Sincronizar ERP' adicionado ao cabeçalho de Visão Geral aciona `sync-estoque-full` e invalida os caches `estoque`, `estoque-filter-options` e `estoque-kpis`. Linha de chips 'Unidade' removida da Visão Geral (já disponível no painel de filtros). Bump `APP_VERSION` 3.5.07 → 3.5.08. Invariante grep: `grep -n \"3.5.08\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.34 / SDK v3.3.1 / APP v3.5.07", date: "2026-06-02", changes: [
                      "PROJETOS — `projeto_secoes` teve as policies recriadas para permitir criação/edição/exclusão/leitura por usuários autenticados com acesso ao projeto via `user_can_access_projeto`, corrigindo o bloqueio de criação de seções. `user_can_access_projeto`, `user_can_access_secao` e `get_projeto_tarefas_v2` foram otimizadas para reduzir timeouts no quadro de tarefas, com índices novos para vínculos de membros, responsáveis, colaboradores e seguidores. Bump `APP_VERSION` 3.5.06 → 3.5.07. Invariante grep: `grep -n \"3.5.07\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.33 / SDK v3.3.1 / APP v3.5.06", date: "2026-06-02", changes: [
                      "PROJETOS — `user_can_access_projeto` agora inclui projetos com `visibilidade='equipe'` (e `deleted_at IS NULL`) como acessíveis a qualquer usuário autenticado, além das regras já existentes (criador, membros, departamentos, vínculos em tarefas). Corrige `new row violates row-level security policy for table projeto_secoes` ao criar seção em projetos compartilhados com o time (caso projeto Redes). Projetos `visibilidade='privado'` continuam restritos. Bump `APP_VERSION` 3.5.05 → 3.5.06. Invariante grep: `grep -n \"3.5.06\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.32 / SDK v3.3.1 / APP v3.5.05", date: "2026-06-02", changes: [
                      "PROJETOS — `get_projeto_tarefas_v2` reescrita para gatear acesso via `user_can_access_projeto` e retornar todas as seções e tarefas (não excluídas) do projeto a qualquer usuário com acesso. Remove o subset por `projeto_membro_secoes` que escondia seções recém-criadas após refresh e causava a impressão de que tarefas estavam sendo apagadas no projeto Redes. Bump `APP_VERSION` 3.5.04 → 3.5.05. Invariante grep: `grep -n \"3.5.05\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.31 / SDK v3.3.1 / APP v3.5.04", date: "2026-06-02", changes: [
                      "PROJETOS — correção do retorno ao criar seção em projetos compartilhados. A regra de leitura de `projeto_secoes` agora reutiliza `user_can_access_projeto`, alinhando a visibilidade da seção recém-criada com a regra já ampliada para quem enxerga o projeto por membro, departamento ou vínculo em tarefa. Isso elimina a falha pós-inserção ao criar 'Nova Seção' no projeto Redes. Bump `APP_VERSION` 3.5.03 → 3.5.04 para acionar o mecanismo de atualização dos clientes. Sem mudança de frontend funcional, SDK ou OpenAPI público. Invariante grep: `grep -n \"3.5.04\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.30 / SDK v3.3.1 / APP v3.5.03", date: "2026-05-25", changes: [
                      "FINANCEIRO — Cadastro do cancelamento do fornecedor Milvus (`fornecedor_codigo=2207`, `fornecedor_nome=MILVUS.COM LTDA`, `tipo=cancelamento`, `data_vigencia_fim=2026-05-07`, `numero_contrato=CANCELAMENTO-MILVUS-2026-05`). Comprovante: e-mail `Cancelamento_Milvus.eml` (ticket #181956 - 22849, suporte@milvus.com.br) anexado em `fornecedor-contratos/MILVUS/Cancelamento_Milvus.eml` (mime `message/rfc822`). Processo em 2 etapas confirmado pela Milvus em 18/05/2026; pagamento de maio quitado; último boleto pós-pago a ser emitido; responsável interno Thiago Vieira (Supervisor de TI). Bump `APP_VERSION` 3.5.02 → 3.5.03. Invariante grep: `grep -n \"3.5.03\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.29 / SDK v3.3.1 / APP v3.5.02", date: "2026-05-25", changes: [
                      "FINANCEIRO — Cadastro do cancelamento do fornecedor Cortex (`fornecedor_codigo=CORTEX`, `tipo=cancelamento`, `data_vigencia_fim=2026-05-15`, `numero_contrato=CANCELAMENTO-CORTEX-2026-05`). Comprovante: print do e-mail de confirmação de Antônio Carlos (a.carlos@rubyrosemaquiagem.com.br) em 15/05/2026 15:48 anexado em `fornecedor-contratos/CORTEX/Confirmacao_Cancelamento_Cortex.png` (mime `image/png`). Mesma thread mencionou ajustes Blip (R$ 8.500) e Dawntech (3 meses). Bump `APP_VERSION` 3.5.01 → 3.5.02. Invariante grep: `grep -n \"3.5.02\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.28 / SDK v3.3.1 / APP v3.5.01", date: "2026-05-25", changes: [
                      "FINANCEIRO — Cadastro dos contratos Blip (`fornecedor_codigo=BLIP`, aditivo Enterprise→Enterprise Lite aceito em 08/05/2026, R$ ~8.500/mês, redução 50% em números adicionais R$1.000→R$500, sem prazo final, .eml `Proposta_Blip.eml` anexado em `fornecedor-contratos/BLIP/`) e Dawntech Consultoria LTDA (`fornecedor_codigo=DAWNTECH`, contrato vigente R$ 6.080 serviço 36h + R$ 3.499 Catalyst = R$ 9.579/mês até 30/09/2026, parecer com 3 opções de renegociação registrado em `observacoes`: Op.1 sem fidelidade economia R$ 2.479,84 / Op.2 fidelidade 12m economia R$ 14.998,80 / Op.3 fidelidade 18m economia R$ 33.207,30, status em análise, .eml `Proposta_Dawntech_Catalyst.eml` anexado em `fornecedor-contratos/DAWNTECH/`). Ambos sem filial específica (sem chave composta com CNPJ). Bump `APP_VERSION` 3.5.00 → 3.5.01. Invariante grep: `grep -n \"3.5.01\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.27 / SDK v3.3.1 / APP v3.5.00", date: "2026-05-25", changes: [
                      "FINANCEIRO — Indicador visual de contrato por fornecedor agora resolve chaves compostas. `useFornecedorContrato` aceita `empresaNome` opcional e faz busca tolerante: `.or()` por `fornecedor_codigo.eq`, `fornecedor_codigo.ilike <token>%` (cobre chaves `ALLTOMATIZE-<CNPJ>`, `SCANNUP-<CNPJ>` etc.) e `fornecedor_nome.ilike %<token>%`, com filtro client-side por tokens da filial (≥4 chars, ignora LTDA/SA/DO/DA). `FornecedorContratoBadge` recebe nova prop `empresaNome` e, em `iconOnly`, mostra texto curto (`OK` / `CANC` / `+`) ao lado do ícone para tornar o estado legível sem hover. `PlanoReducaoGastos` (Modo Foco) e `RelatorioConsolidadoPlanoReducao` passam `revisao.empresa_nome` para o badge. Bump `APP_VERSION` 3.4.99 → 3.5.00. Invariante grep: `grep -n \"3.5.00\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.26 / SDK v3.3.1 / APP v3.4.99", date: "2026-05-25", changes: [
                      "FINANCEIRO — Importação dos 9 contratos iniciais de fornecedores. 8 contratos da ALLTOMATIZE SISTEMA E TECNOLOGIA (CNPJ 10.668.959/0001-53, licença do software RESULT-PRO, mensalidade R$ 2.125,00, prazo indeterminado, aviso prévio 30 dias, multa rescisória 2x, reajuste IGPM, foro Aracaju/SE) vinculados às licenciadas A Gente Cosmeticos, Midday Cosmic, New Cosmic, Pro Party, Union Pernambuco, Ruby Rose-SP, Union Medic MG e Ruby Rose-Gyn via chave composta `ALLTOMATIZE-<CNPJ_LICENCIADA>` no `fornecedor_contratos.fornecedor_codigo` (preserva o índice único parcial de 1 ativo por código). 1 contrato da SCANN-UP AUTOMACAO E TECNOLOGIA (locação Zebra MC33 para a Ruby Rose filial Glass / C Representações CNPJ 34.547.433/0002-64, reajuste IGPM após 12 meses, valores de reposição em USD documentados em observações). PDFs originais arquivados no bucket privado `fornecedor-contratos`. Nova empresa UNION PERNAMBUCO (CNPJ 55.715.202/0001-01) cadastrada em `empresas`. Bump `APP_VERSION` 3.4.98 → 3.4.99. Invariante grep: `grep -n \"3.4.99\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.25 / SDK v3.3.1 / APP v3.4.98", date: "2026-05-25", changes: [
                      "FINANCEIRO — Gestão de contratos por fornecedor com IA. Nova tabela `fornecedor_contratos` (tipo `ativo` | `cancelamento`, vigência início/fim via trigger de validação, índice único parcial garantindo 1 contrato ativo por `fornecedor_codigo`, RLS admin/supervisor para escrita e SELECT autenticado), bucket privado `fornecedor-contratos`, edge function `fornecedor-contrato-analise` (gemini-3-flash-preview via callAIGateway com tool calling retornando resumo + partes + vigência + multa rescisão + cláusulas críticas + alertas). Componentes reutilizáveis `FornecedorContratoBadge`/`FornecedorContratoDialog` (tabs Ativo/Cancelamento/Histórico, upload + análise IA + download blob) plugados no Modo Foco (`PlanoReducaoGastos`) e no Relatório Consolidado (`RelatorioConsolidadoPlanoReducao`) ao lado de cada nome de fornecedor. Bump `APP_VERSION` 3.4.97 → 3.4.98. Invariante grep: `grep -n \"3.4.98\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.24 / SDK v3.3.1 / APP v3.4.97", date: "2026-05-25", changes: [
                      "FÁBRICA BRASIL — Padronização visual (Focus Mode) e correções de análises do ambiente de simulação. Pareamento cronológico em `ComparativoSimulacoes` (baseline Sim01), nova seção 'MPs exclusivas por cenário' em `AnaliseInsumosComparativa`, paginação manual em `useCustosConsolidados` (bypass do limite 1k do PostgREST) e invalidação de queries em `PromoverCenarioDialog` (`fabrica-produtos-acabados`, `fabrica-cenarios-grupos`, `fabrica-cenarios-grupo`, `fabrica-custos-consolidados-v1`). Sem mudança em schema, RLS, edge functions, SDK ou OpenAPI público. Bump `APP_VERSION` 3.4.96 → 3.4.97. Invariante grep: `grep -n \"3.4.97\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.23 / SDK v3.3.1 / APP v3.4.96", date: "2026-05-20", changes: [
                      "PWA — ATIVAÇÃO DEFAULT DO HEARTBEAT + RUNBOOK (encerramento do plano anti-cache). Após validação das Fases 2/3/4 em produção (telemetria mostra clientes em 3.4.95, kill switch testado e Realtime entregando o aviso), a flag `ff_pwa_heartbeat` agora vem **ligada por padrão** em todos os clientes. Comportamento: o `PWAContext` continua silenciosamente comparando `APP_VERSION` local com a meta `<meta name=\"app-version\">` do `index.html` remoto a cada `visibilitychange→visible` e 10s após mount, e segue escutando `app_release_pins` via Realtime — em qualquer divergência ou pin remoto ativo abaixo de `min_version`, dispara o toast existente \"Nova versão disponível\" (não-destrutivo: usuário escolhe \"Atualizar agora\" ou \"Depois\", nunca recarrega à força, não invalida sessão nem permissões). Mudança em `src/lib/featureFlags.ts`: `isPwaHeartbeatEnabled()` agora retorna `true` por padrão; override explícito por `localStorage.setItem('ff_pwa_heartbeat','0')` (rollback individual) ou `VITE_FF_PWA_HEARTBEAT=0` no build (rollback global) continua funcionando. Sem mudança em schema, RLS, edge functions, SDK ou OpenAPI público. Novo runbook em `docs/runbooks/pwa-anti-cache-runbook.md` documenta operação do kill switch, escolha de `min_version`, rollback e troubleshooting. Bump `APP_VERSION` 3.4.95 → 3.4.96. Invariantes grep positivo: `grep -n \"3.4.96\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"Default a partir da v3.4.96: LIGADO\" src/lib/featureFlags.ts | wc -l` ≥ 1; `test -f docs/runbooks/pwa-anti-cache-runbook.md`.",
                    ] },
                    { version: "v4.4.22 / SDK v3.3.1 / APP v3.4.95", date: "2026-05-20", changes: [
                      "PWA — KILL SWITCH REMOTO + DASHBOARD DE VERSÕES (Fase 4 do plano anti-cache). Permite ao admin forçar todos os clientes conectados a receberem o aviso de atualização sem esperar visibilitychange/heartbeat (caso de hotfix urgente). Mudanças aditivas: (1) nova tabela `public.app_release_pins` (`min_version`, `mensagem`, `criado_por`, `criado_em`) com RLS: SELECT para qualquer autenticado, INSERT só para `has_role(auth.uid(),'admin')` E `auth.uid() = criado_por`. Sem UPDATE/DELETE policies (mantém histórico imutável). Adicionada à `supabase_realtime` publication com `REPLICA IDENTITY FULL`. (2) Novo módulo `src/lib/releasePin.ts` com `fetchLatestPin()`, `subscribeToReleasePins(onPin)`, `isBelowPin(pin)` (comparador semver X.Y.Z), todos com falha silenciosa. (3) `src/contexts/PWAContext.tsx` faz pull inicial via `fetchLatestPin()` e subscribe Realtime; em divergência, dispara `needRefresh=true` se `isPwaHeartbeatEnabled()` (mesma flag da Fase 2 para rollout unificado). Cleanup do canal no unmount. (4) Nova página `/admin/versoes-clientes` (`src/pages/admin/VersoesClientes.tsx`) protegida por `ScreenRoute screenCode=\"admin\"`: registra pins (exige reconfirmação por senha via `AdminPasswordDialog`, validação semver `^\\d+\\.\\d+\\.\\d+$`), exibe histórico, distribuição agregada de versões dos últimos 500 heartbeats e tabela detalhada dos últimos 100. Bump `APP_VERSION` 3.4.94 → 3.4.95. Sem mudança em edge functions, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.95\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"subscribeToReleasePins\" src/contexts/PWAContext.tsx | wc -l` ≥ 1; `grep -n \"app_release_pins\" src/lib/releasePin.ts | wc -l` ≥ 1; `grep -n \"VersoesClientes\" src/App.tsx | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.21 / SDK v3.3.1 / APP v3.4.94", date: "2026-05-20", changes: [
                      "PWA — TELEMETRIA DE VERSÃO (Fase 3 do plano anti-cache). Permite ao admin saber em qual `APP_VERSION` cada usuário está rodando, diagnosticando proativamente quem ficou preso em bundle antigo (caso reportado: Cláudia no módulo China). Mudanças aditivas: (1) nova tabela `public.client_version_telemetry` (`user_id` PK, `app_version`, `user_agent`, `last_seen`, `created_at`) com RLS estrita — INSERT/UPDATE apenas pelo próprio usuário (`auth.uid() = user_id`), SELECT apenas para `has_role(auth.uid(),'admin')`. Sem FK para `auth.users`. Índices em `app_version` e `last_seen DESC`. (2) Novo helper `src/lib/version-telemetry.ts` exporta `reportClientVersion(userId)` — fire-and-forget com throttle de 5 min por sessão (evita spam por TOKEN_REFRESHED), grava `APP_VERSION` + `navigator.userAgent` (cortado em 500 chars). Falha 100% silenciada (telemetria não pode quebrar login). (3) `src/contexts/AuthContext.tsx` chama `reportClientVersion(newSession.user.id)` dentro do handler `onAuthStateChange` quando event ∈ {SIGNED_IN, TOKEN_REFRESHED}, envolto em try/catch. Bump `APP_VERSION` 3.4.93 → 3.4.94. Sem mudança em edge functions, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.94\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"reportClientVersion\" src/contexts/AuthContext.tsx | wc -l` ≥ 1; `grep -n \"client_version_telemetry\" src/lib/version-telemetry.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.20 / SDK v3.3.1 / APP v3.4.93", date: "2026-05-20", changes: [
                      "PWA — HEARTBEAT DE VERSÃO (Fase 2 do plano anti-cache). Quebra o deadlock onde correções do dev não chegam a outros usuários porque o Service Worker serve bundle JS antigo (e o `APP_VERSION` lido vem do próprio bundle antigo, então `checkAndUpdateVersion()` nunca dispara). Mudanças aditivas: (1) `vite.config.ts` ganha `appVersionMetaPlugin()` que injeta `<meta name=\"app-version\" content=\"X.Y.Z\">` em `index.html` em build time, lendo APP_VERSION de `src/lib/version.ts`. Como `index.html` é NetworkFirst + `Cache-Control: no-cache`, essa meta sempre reflete o deploy mais recente. (2) `src/lib/version.ts` exporta `getDeployedVersionFromHtml()` e `isVersionMismatch(remote)`, ambos com falha silenciosa. (3) `src/contexts/PWAContext.tsx` roda heartbeat 10s após mount e em todo `visibilitychange→visible`, comparando meta remota com `APP_VERSION` local; em divergência loga sempre, e **se a flag `pwa_heartbeat_enabled` estiver ligada** dispara o toast existente `needRefresh=true`. (4) Nova flag `isPwaHeartbeatEnabled()` em `src/lib/featureFlags.ts` (env `VITE_FF_PWA_HEARTBEAT` ou localStorage `ff_pwa_heartbeat=1`) — default **false** para rollout gradual. Rollout: dia 1 só observa logs; dia 3 admins ligam `localStorage.setItem('ff_pwa_heartbeat','1')`; dia 7 promove a env. Auditoria em `docs/audits/2026-05-stale-cache-audit.md`. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.93\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"appVersionMetaPlugin\" vite.config.ts | wc -l` ≥ 1; `grep -n \"getDeployedVersionFromHtml\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"isPwaHeartbeatEnabled\" src/contexts/PWAContext.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.19 / SDK v3.3.1 / APP v3.4.92", date: "2026-05-20", changes: [
                      "BRIEFINGS HUB — módulo em `/dashboard/briefings` com layout híbrido (chat + canvas) para Marketing, Criativo, Produto/Fábrica e Trade. Agente `briefing-agent` respeita `usuario_permissoes_modulos` via tool `internal_lookup`. Bump `APP_VERSION` 3.4.91 → 3.4.92.",
                    ] },
                    { version: "v4.4.18 / SDK v3.3.1 / APP v3.4.91", date: "2026-05-18", changes: [
                      "PROJETOS — DEEP-LINK DE MENÇÕES (Onda 1): clique em menção de comentário/chat agora leva direto à tarefa/mensagem certa. Migration corrige `public.notify_task_mentions` para gravar `action_url='/dashboard/projetos/<id>?tarefa=<tid>&comentario=<cid>'` (antes: `/projetos/<id>`, rota inexistente — todo clique caía em 404) e `public.notify_projeto_chat_mentions` para `/dashboard/projetos/<id>?tab=chat&mensagem=<mid>` (antes: `/chat` genérico). Frontend: `src/pages/ProjetoDetalhe.tsx` lê `?tarefa`, `?comentario`, `?tab`, `?mensagem`, abre a aba/tarefa correspondente e limpa os params após consumo. `ProjetoListView` ganhou props `initialTarefaId`/`highlightCommentId` que abrem o detalhe assim que as tarefas carregam. `ProjetoTarefaDetalhe` repassa `highlightCommentId` para `TarefaComentariosSection`, que expande a janela paginada até cobrir o comentário, rola até ele e aplica `ring-2 ring-primary` por 2,5s. `ProjetoChatTab` recebe `highlightMsgId`, adiciona `data-msg-id` nas mensagens e aplica o mesmo destaque. Sem mudança de schema, RLS, SDK, OpenAPI público ou triggers (só `CREATE OR REPLACE FUNCTION`). Bump `APP_VERSION` 3.4.90 → 3.4.91 força refresh para todos. Invariantes grep positivo: `grep -n \"3.4.91\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"tarefa=\" supabase/migrations/*fix_mention_action_urls*.sql | wc -l` ≥ 1; `grep -n \"highlightCommentId\" src/components/projetos/tarefa-detalhe/TarefaComentariosSection.tsx | wc -l` ≥ 1.",
                    ]},
                    { version: "v4.4.17 / SDK v3.3.1 / APP v3.4.90", date: "2026-05-18", changes: [
                      "PROJETOS — CENTRAL DE TRABALHO: limpeza visual e consolidação de ações repetitivas. (1) `src/components/projetos/central/CentralHeader.tsx` reescrito: 7 botões da toolbar (Salvar agora, Compartilhar contexto, Como funciona visibilidade, Restaurar padrão split, Preferências, Copiloto, Criar) reduzidos a 3 (Copiloto, Configurar, Criar). Saudação H1 reduzida de `text-2xl font-bold` para `text-xl font-semibold` com data inline em vez de empilhada. `ProjetoBgColorPicker` saiu da toolbar e foi para dentro do novo menu de configuração. (2) Novo `src/components/projetos/central/CentralSettingsMenu.tsx` agrupa em um único DropdownMenu: Aparência (bg color picker), Preferências (Salvar agora, Compartilhar contexto, Abrir preferências completas), Restaurar (Restaurar tudo com AlertDialog de diff, Apenas filtros e busca), Ajuda (Como funciona a visibilidade). (3) `src/pages/CentralTrabalho.tsx`: `<CentralKPIs/>` agora só renderiza nas abas `tarefas` e `delegadas` — removido das abas `hoje` (duplicava os cabeçalhos de seção `Atrasadas/Hoje/Sem datas` já presentes em HojeTab) e `inbox` (badge da tab já indica não lidas). Breadcrumb perdeu o último segmento (`› Hoje/Tarefas/...` redundante com tab ativa) e passou a `hidden lg:flex` para liberar espaço no mobile. Adicionados contadores discretos `text-[10px] text-muted-foreground` nas tabs Hoje (atrasadas+hoje) e Minhas tarefas (pendentes), reusando o cache do `useMinhasTarefas`. (4) `src/components/projetos/central/HojeTab.tsx`: assinatura de `onGoToTarefas` agora aceita filtro opcional (`atrasadas | hoje | sem_data`); cabeçalhos de seção viraram `<button>` clicáveis que navegam para Minhas tarefas já filtrado. Resultado: chrome vertical da aba Hoje cai de ~236–536 px para ~96–192 px (ganho de até 340 px / uma lista inteira de tarefas a mais visível sem rolar). Sem mudança de schema, RLS, SDK, OpenAPI público, rotas ou parâmetros de URL. Bump `APP_VERSION` 3.4.89 → 3.4.90 força refresh para todos. Invariantes grep positivo: `grep -n \"3.4.90\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"CentralSettingsMenu\" src/components/projetos/central/CentralHeader.tsx | wc -l` ≥ 1; `grep -n \"activeTab === \\\"tarefas\\\" || activeTab === \\\"delegadas\\\"\" src/pages/CentralTrabalho.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.16 / SDK v3.3.1 / APP v3.4.89", date: "2026-05-18", changes: [
                      "OPERACIONAL — FORÇA ATUALIZAÇÃO AUTOMÁTICA PARA TODOS OS USUÁRIOS. Bump `APP_VERSION` 3.4.88 → 3.4.89 em `src/lib/version.ts`. Na próxima visita/foco de aba, `checkAndUpdateVersion()` detecta divergência e dispara `clearAllCaches()` (Cache Storage + sessionStorage + desregistro de Service Workers); paralelamente, o SW precache de `index.html` reva via novo build hash, e o handler `controllerchange` em `PWAContext` força `window.location.reload()` assim que o novo SW assume controle. Sem mudança de schema, RLS, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.89\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },

                    { version: "v4.4.15 / SDK v3.3.1 / APP v3.4.88", date: "2026-05-13", changes: [
                      "FÁBRICA — REVISÃO DE FICHAS: filtros, segmentação Kits/Unitários, aba de Aprovadas com cancelamento e link de NF para documento. (1) `src/pages/FichaRevisaoDiretoria.tsx`: substituído o `Select` simples de Produto por `MultiSelectProdutos` (multi-seleção com busca, itens fixos no topo e chips removíveis) — resolve a perda de referência ao rolar a tabela. Adicionado `ToggleGroup` segmentado **Todos / Kits / Unitários** baseado em `produto.tipo === 'DISPLAY'`. Nova aba de status **Pendentes / Aprovadas (60 dias)** ligada a `useFichaRevisaoDiretoria.statusFiltro` que troca o filtro do `select` (`status='aprovada' AND revisado_em >= now()-60d`, limit 200, ordenado por `revisado_em desc`). (2) `src/components/fabrica/FichaAnalisePanel.tsx`: nova coluna **NF Ref.** na tabela principal de insumos, clicável quando há documento em `fabrica_revisao_documentos` com `materia_prima_id = insumo.mp_id` e `status='ativo'` — abre `StoragePreviewDialog` direto no documento; documentos indexados em `docsByMp` carregados junto com evidências/cotações. Atualizado `colSpan` da linha expandida de cotações (7→8 / 8→9). Botão **Cancelar Aprovação** renderizado quando `ficha.status === 'aprovada'`, exige motivo via `prompt`, chama `onCancelarAprovacao` que invoca `useFichaRevisaoDiretoria.cancelarAprovacao` (status `aprovada → pendente`, limpa `revisado_em`, anexa `[CANCELAMENTO ts] motivo` ao parecer e restaura `revisao_ativa_id` na config com `status_aprovacao='em_revisao'`). Bump `APP_VERSION` 3.4.87 → 3.4.88. Sem mudança de schema, RLS, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.88\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"MultiSelectProdutos\" src/pages/FichaRevisaoDiretoria.tsx | wc -l` ≥ 1; `grep -n \"Cancelar Aprovação\" src/components/fabrica/FichaAnalisePanel.tsx | wc -l` ≥ 1; `grep -n \"cancelarAprovacao\" src/hooks/useFichaRevisao.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.14 / SDK v3.3.1 / APP v3.4.87", date: "2026-05-05", changes: [
                      "SEGURANÇA — HARDENING DE RLS CROSS-TENANT + TIMING-SAFE EM 7 EDGE FUNCTIONS. (1) RLS: substituídas policies SELECT com `USING (true)` em `cofre_generico_documentos` (admin-only), `fluxo_aprovacao_aprovadores` (removidas duas policies abertas, mantida `fluxo_aprovacao_aprovadores_scoped_select`), `processo_instancias` (admin/supervisor/gerente/criador), `fabrica_markup_overrides`, `produtos_brasil_custos`, `produtos_brasil_precos`, `trade_bank_daily_balances` (via `can_access_bank_accounts`), `fabrica_notas_fiscais_saida` e `fabrica_itens_nf_saida`. (2) Storage: removidas as policies INSERT/DELETE sem ownership nos buckets `embalagem-analise`, `etiqueta-bula`, `amostras` (variantes `Users can ...` já enforce path-prefix); bucket `fabrica-produto-fotos` ganhou enforcement de ownership por path em SELECT/INSERT/UPDATE/DELETE com fallback para admin/supervisor/módulo `fabrica`. (3) Edge functions: `export-all-data`, `export-conversion-rates`, `export-prospects`, `processar-transacao-n8n`, `contas-pagar-n8n-sync`, `estoque-n8n-sync` e `trade-marketing-api` agora comparam `N8N_API_KEY` via `timingSafeEqual` de `_shared/timing-safe.ts`, eliminando timing oracle. Bump `APP_VERSION` 3.4.86 → 3.4.87. Sem mudança de SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.87\" src/lib/version.ts | wc -l` ≥ 1; `grep -rn \"timingSafeEqual(apiKey, expectedKey)\" supabase/functions | wc -l` ≥ 7.",
                    ] },
                    { version: "v4.4.13 / SDK v3.3.1 / APP v3.4.86", date: "2026-05-05", changes: [
                      "OPERACIONAL — DESATIVAÇÃO TEMPORÁRIA DE TRAVAS DE ACESSO POR APROVAÇÃO/STATUS NO `ProtectedRoute`. Comentados os redirecionamentos `!approved → /aguardando-aprovacao` e `!isActive → /usuario-bloqueado` em `src/components/auth/ProtectedRoute.tsx` para evitar bloqueio de usuários enquanto pagamento financeiro está em processamento (regularização prevista em até 2 dias úteis). `useAuth()` continua expondo `approved`/`isActive` (não removidos do contexto) e o cache em localStorage segue intacto, permitindo reativação imediata do guard apenas restaurando os dois `if`. Sessão (`!session → /auth/login`) e regra de cliente (`isCliente → /portal/precos`) preservadas. Bump `APP_VERSION` 3.4.85 → 3.4.86 em `src/lib/version.ts` para forçar `checkAndUpdateVersion()` a limpar caches do cliente. Sem mudança de RLS, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.86\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"travas de aprovação/atividade desabilitadas\" src/components/auth/ProtectedRoute.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.12 / SDK v3.3.1 / APP v3.4.85", date: "2026-05-04", changes: [
                      "SEGURANÇA — RLS HARDENING DE TABELAS SENSÍVEIS DE COTAÇÕES, CONTAS E OPERAÇÕES CHINA. Substituídas todas as políticas RLS (SELECT/INSERT/UPDATE/DELETE) que usavam apenas `auth.uid() IS NOT NULL` em 10 tabelas críticas: `fabrica_mp_cotacoes` (preço unitário, custos NF/serviço/condição, fornecedor) → `check_user_access('fabrica')`; `trade_chart_of_accounts` (plano de contas) → `check_user_access('financeiro')`; tabelas operacionais China (`china_ordem_itens`, `china_embarques`, `china_embarque_itens`, `china_recebimentos_carga`, `china_recebimento_itens`, `china_oc_saldo_decisoes`, `china_nao_conformidades`) → `check_user_access('china') OR check_user_access('fabrica')`; `china_oc_custos` (FOB, frete, seguro, alíquotas, total BRL) → `check_user_access('china') OR check_user_access('financeiro')`. Em todas, fallback para `has_role(admin|supervisor)`. Bump `APP_VERSION` 3.4.84 → 3.4.85 em `src/lib/version.ts` para forçar `checkAndUpdateVersion()` a limpar caches do cliente. Sem mudança de SDK ou OpenAPI público — apenas RLS e versão. Invariantes grep positivo: `grep -n \"3.4.85\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.11 / SDK v3.3.1 / APP v3.4.84", date: "2026-05-04", changes: [
                      "CLIENTES — SYNC DIRETO ERP → BANCO (SUBSTITUI N8N). Novo pipeline de sincronização de clientes no mesmo padrão de `contas-pagar-n8n-sync` e `contas-receber-api/sync`, eliminando a dependência do workflow N8N. **Edge function nova** `clientes-sync` (`supabase/functions/clientes-sync/index.ts`): auth manual via `x-api-key` (`N8N_API_KEY`) com `timingSafeEqual` (constant-time), aceita 3 formatos de payload via `unwrapPayload()` — array bruto N8N `[{json:{...}}]`, wrapper `{ clientes|data|records|items: [...] }` e array simples — para transição suave; processa em mini-lotes de 500 com `INTER_BATCH_DELAY_MS=120` e retry exponencial (`MAX_RETRIES=5`); upsert em `clientes` com `onConflict: 'codigo,empresa_id'` (constraint já existente); registra cada chamada em `sync_control` com `entidade='clientes'`, `origem='erp'`, status `success|partial|error`. **Shared utils novas** `_shared/clientes/utils.ts` com `transformErpData()` (whitelist explícita de 39 campos canônicos: codigo, empresa_id, nome, nome_abreviado, cnpj, inscricao_estadual, tipo_cliente, email, telefone, celular, fax, comprador, endereco, bairro, cidade, uf, cep, cobrança×4, limite_credito, classificacao, conceito, status_bloqueio, rota, portador, ramo_atividade, convenio, datas/valores última e maior compra, observacoes, contrato, responsavel, cod_vend), `parseDate()`, `sanitizeString()` (remove control chars + cap 1000), `normalizeCnpj()` (apenas dígitos), `toNumberOrNull()`, `toIntOrNull()`, `processRecordsWithRetry()` que filtra registros sem `codigo`+`nome` antes do upsert. **`clientes-api` ganha 3 rotas novas**: `POST /sync-ingest` (limite 5.000/chamada, JWT), `POST /bulk-sync` (limite 50.000/chamada, JWT), `GET /sync-status` (devolve `{ last_sync, status }` baseado no maior `sincronizado_em`). Resposta padronizada em `{ success, received, processed, inserted, updated, skipped, errors, duration_ms, rate_per_second, api_version }` (HTTP 207 em falha parcial). Sem migração de banco, sem mudança de RLS, sem mudança no CRUD existente (`/incluir`, `/alterar`, `/upsert`, `/listar`, `/sync` paginado de leitura) e sem mudança no SDK público. Invariantes grep positivo: `grep -n \"3.4.84\" src/lib/version.ts | wc -l` ≥ 1; `ls supabase/functions/clientes-sync/index.ts | wc -l` = 1; `ls supabase/functions/_shared/clientes/utils.ts | wc -l` = 1; `grep -n \"/sync-ingest\\|/bulk-sync\\|/sync-status\" supabase/functions/clientes-api/index.ts | wc -l` ≥ 3; `grep -n \"timingSafeEqual\" supabase/functions/clientes-sync/index.ts | wc -l` ≥ 1; `grep -n \"onConflict: \\\"codigo,empresa_id\\\"\" supabase/functions/_shared/clientes/utils.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.10 / SDK v3.3.1 / APP v3.4.83", date: "2026-05-04", changes: [
                      "PWA — BUMP DE VERSÃO PARA FORÇAR ATUALIZAÇÃO. Bump `APP_VERSION` 3.4.82 → 3.4.83 em `src/lib/version.ts` para que `checkAndUpdateVersion()` detecte mismatch com `localStorage.app_version` em todos os clientes na próxima carga e dispare `clearAllCaches()` (Cache Storage + desregistro de SWs + sessionStorage). Combinado com o auto-update pós-login (3.4.81), garante que toda sessão entre no bundle mais recente. Sem mudança de código além do número da versão. Invariantes grep positivo: `grep -n \"3.4.83\" src/lib/version.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.10 / SDK v3.3.1 / APP v3.4.82", date: "2026-05-04", changes: [
                      "PWA — INDICADOR DE VERSÃO VISÍVEL ANTES DO LOGIN. Antes, `APP_VERSION` só aparecia no rodapé da `AppSidebar` (rotas protegidas), e o `SplashScreen` mostrava `'Versão 2.0'` hardcoded — usuários não-logados não tinham como confirmar se estavam no bundle mais recente. **Mudanças**: (1) `src/components/pwa/SplashScreen.tsx` — importa `APP_VERSION` de `@/lib/version` e exibe `v{APP_VERSION}` no rodapé do splash em vez de string fixa. (2) `src/components/auth/AuthLayout.tsx` — adiciona botão discreto `v{APP_VERSION}` (text-xs, text-muted-foreground/70) abaixo do card de login; clique exibe `window.confirm` e dispara `forceCleanReload()` (limpa Cache Storage + desregistra SWs + reload com query-busting), dando ao usuário saída manual para forçar atualização ANTES do login. (3) Bump `APP_VERSION` 3.4.81 → 3.4.82 em `src/lib/version.ts`. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.82\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"APP_VERSION\" src/components/pwa/SplashScreen.tsx | wc -l` ≥ 1; `grep -n \"APP_VERSION\" src/components/auth/AuthLayout.tsx | wc -l` ≥ 1. Invariante grep negativo: `grep -n \"Versão 2.0\" src/components/pwa/SplashScreen.tsx | wc -l` = 0.",
                    ] },
                    { version: "v4.4.10 / SDK v3.3.1 / APP v3.4.81", date: "2026-05-04", changes: [
                      "PWA — ATUALIZAÇÃO AUTOMÁTICA NO LOGIN. Após login bem-sucedido, `LoginForm.navigateAfterLogin` agora exibe toast discreto 'Atualizando sistema — Carregando a versão mais recente...' (2s) e em seguida chama `forceCleanNavigate(targetPath)` que já limpava Cache Storage + desregistrava Service Workers + recarregava com query-busting `?v=<timestamp>&app_version=<APP_VERSION>`. Sequência: `autoUpdateOnLogin()` (pede update do SW) → toast → 600ms de respiro para o usuário ver o toast → `forceCleanNavigate('/dashboard'|'/portal/precos')`. Garante que toda sessão entra com bundle/CSS/HTML mais recentes sem depender de `controllerchange` ou hard-refresh manual. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.81\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"Atualizando sistema\" src/components/auth/LoginForm.tsx | wc -l` ≥ 1; `grep -n \"forceCleanNavigate\" src/components/auth/LoginForm.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.10 / SDK v3.3.1 / APP v3.4.80", date: "2026-05-04", changes: [
                      "PWA — CORREÇÃO DO CICLO DE ATUALIZAÇÃO (USUÁRIOS PRESOS EM VERSÃO ANTIGA). Causa-raiz: o Service Worker era registrado em `vite.config.ts` SEM `skipWaiting`/`clientsClaim` e com `index.html` incluído no `globPatterns` do precache. Resultado: todo deploy gerava um SW novo que ficava em estado *waiting* até TODAS as abas do app serem fechadas (cenário praticamente inexistente num ERP usado o dia inteiro), e o `index.html` antigo continuava sendo servido do precache mesmo após hard-refresh, fazendo o cliente nunca baixar os bundles novos. **Mudanças**: (1) `vite.config.ts` — adicionado `skipWaiting: true` + `clientsClaim: true` no bloco `workbox`, removido `'html'` de `globPatterns`, adicionado `runtimeCaching` com handler `NetworkFirst` (timeout 3s) para requisições com `request.mode === 'navigate'` (HTML sempre tenta a rede primeiro, cai no cache só offline), `navigateFallbackDenylist` agora também exclui `/~oauth`. (2) `src/contexts/PWAContext.tsx` — listener `controllerchange` em `navigator.serviceWorker` recarrega a página UMA vez (guarda `reloadedForNewSW`) quando o SW novo assume controle (combinado com `skipWaiting`, fecha o ciclo: deploy → SW novo detectado → ativação imediata → reload automático com bundle novo); intervalo de checagem reduzido de 5min para 2min; checagem extra disparada em `visibilitychange` (`document.visibilityState === 'visible'`) — quando o usuário volta para a aba após algum tempo, o SW verifica updates imediatamente. Cleanup atualizado para remover ambos listeners. (3) `src/components/dashboard/AppSidebar.tsx` — indicador discreto da versão atual no rodapé da sidebar, ao lado dos links Privacidade/Termos. Clique no indicador exibe `window.confirm` e, se aceito, dispara `forceCleanReload()` (limpa Cache Storage, desregistra SWs, faz reload com query-string busting `?v=<timestamp>`). Dá ao usuário e ao suporte uma saída manual quando algum cliente fica preso. **`<PWAUpdatePrompt />` global** já estava montado em `src/App.tsx`; agora passa a ser efetivamente acionado pelo ciclo corrigido — quando o SW detecta nova versão, exibe Card fixo bottom-right com botão 'Atualizar agora'. **Migração para clientes presos na versão antiga**: precisarão UMA última vez fazer hard-refresh (Ctrl+Shift+R) ou clicar no número da versão na sidebar para puxar o bundle com este fix; deploys futuros propagam automaticamente em até ~2min. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI público. Invariantes grep positivo: `grep -n \"3.4.80\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"skipWaiting: true\" vite.config.ts | wc -l` ≥ 1; `grep -n \"clientsClaim: true\" vite.config.ts | wc -l` ≥ 1; `grep -n \"controllerchange\" src/contexts/PWAContext.tsx | wc -l` ≥ 1; `grep -n \"APP_VERSION\" src/components/dashboard/AppSidebar.tsx | wc -l` ≥ 1. Invariante grep negativo: `grep -n \"NÃO usar skipWaiting\" vite.config.ts | wc -l` = 0; `grep -n \"NÃO escutar controllerchange\" src/contexts/PWAContext.tsx | wc -l` = 0.",
                    ] },
                    { version: "v4.4.10 / SDK v3.3.1 / APP v3.4.79", date: "2026-05-02", changes: [
                      "PROJETOS — VISÃO CONSOLIDADA DE APROVAÇÕES (PESSOAL / SEÇÃO / PROJETO). Camada de visualização sobre o motor Kanban de alçadas (v3.4.78). **Backend** (migration `20260502204842`): nova view `vw_aprovacoes_consolidado` (security_invoker=true) que une `fluxo_aprovacao_instancias` + última linha de `fluxo_aprovacao_etapa_eventos` + `fluxo_aprovacao_etapas` + `projetos`/`projeto_secoes`/`projeto_tarefas`, expondo `etapa_responsavel_id`, `etapa_prazo_em`, flag `atrasado`, `dias_restantes`, breadcrumb `projeto_nome/secao_nome/tarefa_titulo` e `qtd_documentos`; RPC `rpc_aprovacoes_pendentes_para(_user_id)` STABLE SECURITY INVOKER retorna lotes onde o usuário é titular ou suplente da etapa pendente atual; índices `idx_fai_status_etapa`, `idx_faee_responsavel_pendente` (parcial WHERE decisao='pendente'), `idx_faee_instancia_etapa_rodada`. RLS herdada das tabelas-base (semi-joins). **Frontend novo**: `src/hooks/useAprovacoesConsolidado.ts` (3 escopos: pessoal/seção/projeto, Realtime em instâncias e eventos), `src/components/projetos/aprovacoes/AprovacoesDashboard.tsx` (Kanban consolidado por etapa, KPIs Pendentes/Atrasadas/Concluídas/Total, filtros Abertos/Atrasados/Concluídos/Todos + busca por lote/projeto/tarefa/etapa), `LoteAprovacaoCardCompacto.tsx` (card minimalista com breadcrumb + etapa + R# + SLA), `LoteAprovacaoDrawer.tsx` (Sheet lateral que reusa `LoteAprovacaoCard` completo + atalho 'Abrir tarefa no projeto'). **Páginas**: `src/pages/CentralAprovacoes.tsx` (rewrite — visão pessoal substituindo o `CentralTrabalhoModulo` legado, mesma rota `/dashboard/central/aprovacoes`); nova `src/pages/projetos/ProjetoAprovacoes.tsx` em `/dashboard/projetos/:id/aprovacoes` (escopo projeto; aceita `?secao=<uuid>` para escopo seção). **Sem mudança no fluxo existente**: criação de lote, RPCs `rpc_avancar_etapa_aprovacao`/`rpc_criar_lote_aprovacao` e a `TarefaAprovacoesSection` dentro da tarefa permanecem idênticas. Memória atualizada: `mem://features/projects/kanban-alcadas-aprovacao`. Invariantes grep positivo: `grep -n \"3.4.79\" src/lib/version.ts | wc -l` ≥ 1; `grep -n \"vw_aprovacoes_consolidado\" src/hooks/useAprovacoesConsolidado.ts | wc -l` ≥ 1; `grep -n \"rpc_aprovacoes_pendentes_para\" src/hooks/useAprovacoesConsolidado.ts | wc -l` ≥ 1; `grep -n \"AprovacoesDashboard\" src/pages/CentralAprovacoes.tsx | wc -l` ≥ 1; `grep -n \"/dashboard/projetos/:id/aprovacoes\" src/App.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.10 / SDK v3.3.1 / APP v3.4.78", date: "2026-05-02", changes: [
                      "PROJETOS — KANBAN DE ALÇADAS DE APROVAÇÃO NA TAREFA + REMOÇÃO DO FLUXO 'DESPACHAR PARA MÓDULO'. Substituição completa do fluxo paralelo de despacho da China (que duplicava trabalho dos usuários e nunca foi adotado) por um motor único de aprovação acoplado à tarefa do projeto. **Schema** (migration `20260502202253`): `fluxo_aprovacao_instancias` ganhou `tarefa_id` (FK projeto_tarefas), `secao_id` (FK projeto_secoes), `lote_nome`, `prazo_lote`, `politica_movimentacao` ('continuar'|'reiniciar_etapa'); `fluxo_aprovacao_etapas` ganhou `prazo_dias`; novas tabelas `fluxo_aprovacao_lote_documentos` (vincula china_produto_documentos ao lote) e `fluxo_aprovacao_etapa_eventos` (snapshot por etapa+rodada com decisao/prazo_em/decidido_por). RPCs SECURITY DEFINER `rpc_criar_lote_aprovacao(tarefa_id, config_id, lote_nome, documento_ids[], prazo?, politica?)`, `rpc_avancar_etapa_aprovacao(instancia_id, decisao, comentario?)` (rejeição volta etapa anterior + rodada+1; só responsável atual ou admin), `rpc_mover_lote_para_tarefa(instancia_id, nova_tarefa_id)` (aplica politica). Trigger `trg_log_faee` em etapa_eventos grava automaticamente em `projeto_atividades`. Realtime habilitado em `fluxo_aprovacao_instancias` e `fluxo_aprovacao_etapa_eventos`. **Frontend novo**: `src/hooks/useLoteAprovacao.ts`, `src/components/projetos/aprovacoes/{TarefaAprovacoesSection,LoteAprovacaoCard,CriarLoteDialog}.tsx`. Section montada em `ProjetoTarefaDetalhe` quando `isProjetoProduto`, abaixo dos documentos da China. Card mostra pipeline horizontal de etapas (atual/passada/futura), badges de rodada (R2/R3) quando rejeição cria nova rodada, badge `Vencido` quando `prazo_em < now()` (parseLocalDate, América/SP), Popover com Aprovar/Rejeitar + comentário, histórico colapsável. Tela admin de templates reutilizáveis (`/admin/templates-alcadas` → FluxoAprovacaoConfig) seguia introduzida em v3.4.77. **Removido**: `DespachoModuloDialog.tsx`, `DespachoFichaDialog.tsx` (deletados); `DESPACHO_MODULOS` const e `useDespacharModulo` mutation removidos de `useChinaPastaDigital.ts`; botão 'Despachar' e info bar de despacho em `ChinaPastaDigitalPanel.tsx`; botão 'Despachar' + state `despachoOpen` + uso de DespachoFichaDialog em `ChinaFichaProduto.tsx`; counter `despachados` e badge correspondente. Telas legacy `FluxoAprovacaoArtes/Detalhe/FluxoArtesMotor/FluxoArtesDetalhe` + `FluxoVinculosPanel`/`FluxoAnexosPanel` foram deletadas em v3.4.77. **Substituição de window.open**: `TarefaChinaDocsSection.tsx` agora usa `triggerBlobDownload` (download via Blob, conforme política de download seguro). Coluna `china_pasta_digital.despacho_modulo` mantida no schema por compatibilidade — não é mais escrita pela UI. Sem mudança de SDK ou OpenAPI público (motor de aprovação é interno; lotes são estado de tarefa). Memória: `mem://features/projects/kanban-alcadas-aprovacao`. Invariantes grep positivo: `grep -n \"3.4.78\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"TarefaAprovacoesSection\" src/components/projetos/aprovacoes/TarefaAprovacoesSection.tsx | wc -l` ≥ 1; `grep -n \"rpc_criar_lote_aprovacao\" src/hooks/useLoteAprovacao.ts | wc -l` ≥ 1; `grep -n \"rpc_avancar_etapa_aprovacao\" src/hooks/useLoteAprovacao.ts | wc -l` ≥ 1. Invariante grep negativo (UI legacy removida): `find src/components/china -name 'DespachoModuloDialog.tsx' -o -name 'DespachoFichaDialog.tsx' | wc -l` = 0; `grep -n \"DESPACHO_MODULOS = \\[\" src/hooks/useChinaPastaDigital.ts | wc -l` = 0; `grep -n \"useDespacharModulo()\" src/hooks/useChinaPastaDigital.ts | wc -l` = 0.",
                    ] },
                    { version: "v4.4.9 / SDK v3.3.1 / APP v3.4.77", date: "2026-05-02", changes: [
                      "HIGIENE DE REPO — `.env` removido do versionamento. `.gitignore` ganhou bloco ignorando `.env` e `.env.*.local`, mantendo `!.env.example`. `.env.example`, `AGENTS.md` §5 e `docs/onboarding/01-STACK-AND-SETUP.md` atualizados com instruções de bootstrap para clones externos (copiar de `.env.example`, preencher com valores de Connectors → Lovable Cloud) e nota explícita de que dentro do sandbox Lovable o arquivo é auto-provisionado e regenerado por sessão. Memória `mem://reference/onboarding-docs` documenta a política. **Sem rotação de chaves Supabase** (o `.env` continha somente `VITE_SUPABASE_*` publishable — desenhadas para vir no bundle do browser, sem service-role exposto). **Sem reescrita de histórico** (custo > benefício para chaves publishable). Untrack do `.env` legado precisa ser feito **uma vez fora do agent Lovable**: `git rm --cached .env && git commit -m \"chore: untrack .env\"`. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI público. Invariantes grep: `grep -n \"3.4.77\" src/lib/version.ts | wc -l` ≥ 2; `grep -nE \"^\\.env$\" .gitignore | wc -l` ≥ 1; `grep -n \"!.env.example\" .gitignore | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.9 / SDK v3.3.1 / APP v3.4.76", date: "2026-05-02", changes: [
                      "BUMP DE VERSÃO — APP v3.4.75 → v3.4.76. Atualização de `APP_VERSION` em `src/lib/version.ts` para forçar `checkAndUpdateVersion()` a limpar caches do cliente (service worker, localStorage tagueado por versão, snapshots de segurança) e propagar o pacote completo de onboarding para devs externos e IAs externas (`AGENTS.md`, `AI_CONTEXT.md`, `docs/onboarding/00-INDEX.md` até `13-GOTCHAS.md`) já referenciado em `mem://reference/onboarding-docs` e `mem://index.md`. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI público. Invariantes grep: `grep -n \"3.4.76\" src/lib/version.ts | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.9 / SDK v3.3.1 / APP v3.4.75", date: "2026-05-02", changes: [
                      "BUMP DE VERSÃO — APP v3.4.74 → v3.4.75. Atualização de `APP_VERSION` em `src/lib/version.ts` para forçar `checkAndUpdateVersion()` a limpar caches do cliente (service worker, localStorage tagueado por versão, snapshots de segurança) e propagar entregas recentes de UI (Projetos: `ProjetoActiveFiltersBar`, `ProjetoDensityToggle`, `ProjetoKpiStrip`, hook `useTarefaDensity`, ajustes em `ProjetoHeader`/`ProjetoTarefaRow`/`Projetos.tsx`) e o pacote de onboarding (`AGENTS.md`, `AI_CONTEXT.md`, `docs/onboarding/00-13`). Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI público. Invariantes grep: `grep -n \"3.4.75\" src/lib/version.ts | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.9 / SDK v3.3.1 / APP v3.4.74", date: "2026-05-01", changes: [
                      "RLS HARDENING + E2E SECURITY SUITE EM CI. **Migração**: políticas SELECT em `our_products`, `product_comparisons` e `social_media_metrics_history` reescritas para `TO authenticated` (antes USING(true) em role public, leitura anônima vazando dados sensíveis — finding `our_products_anonymous_cost_margin`, `product_comparisons_anonymous_read`, `social_media_metrics_history_cross_user_read`). Em `social_media_metrics_history` a política ampla `Authenticated users can view social media metrics` foi removida — passa a valer somente o escopo por conta. **Validação E2E PostgREST**: 96 probes anônimas em variantes de colunas sensíveis (cost/custo/cost_price/unit_cost/margin/margem/margem_percentual/profit_margin/price/preco/sale_price/wholesale_price em our_products; similarity_score/comparison_notes/competitor_price/our_price/their_price/notes em product_comparisons; followers_count/followers/engagement_rate/engagement/sentiment_score/username/reach/impressions em social_media_metrics_history) cobrindo `select`, projeção combinada, `order=col.desc` e filtro `col=gt.0`, + HEAD com `Prefer: count=exact` + `Range: 0-0` exigindo `Content-Range: */0`. Resultado: **96/96 PASS** — sem auth, toda variante retorna erro PostgREST (coluna inexistente ou negada) ou array vazio; nenhuma rota anônima vaza linha. **Novos artefatos** em `scripts/security/`: `e2e-anonymous-sensitive-columns.sh` (exit 1 se vazar dado, lista LEAKS detalhadas), `e2e-authenticated-sensitive-columns.sh` (login GoTrue com `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`, valida HTTP 200 + JSON array nas mesmas tabelas via `Authorization: Bearer` e re-confirma anônimo bloqueado nos mesmos endpoints como sanity check; SKIP exit 0 quando secrets ausentes para não quebrar PRs de fork) e `README.md` documentando os secrets necessários e como adicionar novas tabelas sensíveis. **Workflow CI** `.github/workflows/security-rls-e2e.yml` roda em todo `push main` e em todo `pull_request`: job `anonymous-lockdown` (sempre executa, falha o PR ao detectar vazamento), job dependente `authenticated-access` (skip limpo se secrets não configurados). Sem mudança de SDK ou OpenAPI público — somente políticas RLS, scripts de teste e workflow CI. Invariantes grep: `grep -n \"3.4.74\" src/lib/version.ts | wc -l` ≥ 2; `test -f scripts/security/e2e-anonymous-sensitive-columns.sh`; `test -f scripts/security/e2e-authenticated-sensitive-columns.sh`; `test -f .github/workflows/security-rls-e2e.yml`; `grep -n \"anonymous-lockdown\" .github/workflows/security-rls-e2e.yml | wc -l` ≥ 1; `grep -n \"E2E_TEST_EMAIL\" .github/workflows/security-rls-e2e.yml | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.8 / SDK v3.3.1 / APP v3.4.73", date: "2026-05-01", changes: [
                      "INSIDER THREAT DEFENSE PROGRAM. **Camada 2 — JIT Access**: nova tabela `public.jit_access_requests` (requester_id, scope, justification min 10 chars, requested_minutes 5-240, requires_four_eyes bool, approver_id, status pending/approved/denied/expired/revoked, granted_at, expires_at, constraint `jit_no_self_approve` impede aprovação própria, RLS select_own_or_admin + insert_own + update_admin_only). Escopos com 4-eyes obrigatório auto-detectado em `jit_request`: `users.role_change_admin`, `users.role_change_gerente`, `finance.export_full`, `municipios.bulk_reassign`, `mfa.reset_other`. RPCs SECURITY DEFINER `jit_request(_scope,_justification,_minutes)`, `jit_approve(_request_id,_decision,_reason)` (admin-only, valida self-approval + already_decided), `jit_active(_user_id,_scope)` (boolean). Hook `useJitRequest` para consumo em telas sensíveis. **Camada 3 — Export Receipts**: nova tabela `public.export_receipts` (user_id, scope, row_count, file_format csv/xlsx/pdf, file_hash_sha256, receipt_token único hex 18 bytes, ip_address, user_agent, request_id, is_massive=row_count>1000, jit_request_id FK, RLS select_own_or_admin). RPC `export_receipt_create` insere receipt + dispara `security_event_record` severidade `high` quando massivo, `info` caso contrário — alimenta detecção de exfiltração. **Camada 4 — Honeytokens**: coluna `is_honeytoken boolean DEFAULT false NOT NULL` em `municipios`, `clientes`, `contas_pagar`, `profiles` com índices parciais `WHERE is_honeytoken=true`. Tabela `public.honeytoken_hits` (user_id, entity_table, entity_id, hit_context read/export/update, ip, ua, RLS admin-only). RPC `honeytoken_touched(_entity_table,_entity_id,_context,_ip,_ua)` registra hit + `security_event_record('honeytoken_touched','critical',...)` + auto-quarentena 1h via `account_quarantine` ON CONFLICT extends expires_at. RPC `honeytokens_seed` (admin) planta 3 municípios fictícios `__HT_Município_Alpha/Beta/Gamma` em UF=ZZ, regiao=INTERNAL. **Camada 5 — Behavioral Baselines**: tabela `public.behavioral_baselines` (typical_hour_start/end p5/p95, avg_actions_per_hour, avg_exports_per_day, known_ips/known_countries/known_modules text[], sample_window_days default 30, RLS admin-only) preparada para UEBA cron futuro. **Camada 7 — Access Review**: tabelas `public.access_review_cycles` (cycle_label, opened_by, due_at default now()+90d, status open/closed) e `public.access_review_items` (target_user_id, current_role_name, decision keep/revoke/downgrade, reviewer_id, runtime constraint NO SELF-REVIEW em `access_review_decide`). RPC `access_review_open(_label)` admin-only popula items com todos `user_roles` em ('admin','gerente'). RPC `access_review_decide(_item_id,_decision,_notes)` admin-only valida decision enum + self-review forbidden. **Step-up scopes adicionais** seedados em `step_up_scopes`: `device.trust` (300s), `jit.approve` (300s), `mfa.reset_other` (300s), `secret.reveal` (180s), `access.review_decision` (600s). **RPC consolidada** `insider_threat_metrics()` admin-only retorna 8 KPIs (high_risk_users>70, untrusted_devices_active 7d, jit_pending, jit_active, honeytoken_hits_30d, massive_exports_7d, quarantined_active, access_review_pending) + top_risk_users (10). **Edge function `insider-threat`** (jwt + rateLimit 60/min) ops: metrics, jit_list, jit_decide, reviews_list, review_open, review_decide, seed_honeytokens, exports_recent, honey_hits. **Frontend** nova aba 'Insider Threat' no Hardening Center v2 (`InsiderThreatPanel.tsx`) com 8 KPI cards (tone semântico danger/warn/default conforme thresholds) e 5 sub-abas: Top risco (10 users por score), JIT pendentes (decisão com motivo obrigatório, badge 4-eyes destrutivo quando aplicável), Access Review (botão 'Abrir novo ciclo' + decisão keep/downgrade/revoke por linha), Exports recentes (linhas massivas em bg-destructive/5), Honeytoken hits (todas linhas em bg-destructive/10 — sinal crítico). Botão 'Plantar honeytokens' admin-only. Sem mudança de SDK ou OpenAPI público. Migração aditiva, zero downtime. Invariantes grep: `grep -n \"3.4.73\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"jit_access_requests\" supabase/functions/insider-threat/index.ts | wc -l` ≥ 1; `grep -n \"insider_threat_metrics\" supabase/functions/insider-threat/index.ts | wc -l` ≥ 1; `grep -n \"InsiderThreatPanel\" src/components/admin/security/InsiderThreatPanel.tsx | wc -l` ≥ 1; `grep -n \"value=\\\"insider\\\"\" src/pages/admin/security/SecurityHardeningCenterV2.tsx | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.7 / SDK v3.3.1 / APP v3.4.72", date: "2026-05-01", changes: [
                      "ALERTAS AUTOMÁTICOS DE SEGURANÇA. Novas tabelas `public.security_alert_rules` (rule_key UNIQUE, metric, comparison lt/lte/gt/gte/eq, threshold numeric, severity info/warn/high/critical, cooldown_minutes 1-10080, enabled, last_triggered_at) e `public.security_alerts` (rule_id FK, observed_value, threshold, message, acknowledged + acknowledged_by/at), ambas RLS admin-only via `has_role('admin')`. **8 regras seedadas**: `mfa_coverage_drop` (lt 80%, high, 6h), `waf_shadow_spike` (gt 500/24h, warn, 2h), `anomalies_high` (gt 5/24h, high, 1h), `anomalies_total` (gt 50/24h, warn, 2h), `quarantine_active` (gte 3, critical, 30min), `cves_open` (gt 0, warn, 24h), `secrets_overdue` (gt 0, warn, 24h), `pentest_low` (lt 80%, high, 12h). RPC `public.security_evaluate_alerts()` SECURITY DEFINER (REVOKE de PUBLIC/anon/authenticated; GRANT só service_role) consome `security_v2_metrics()` + count `anomaly_events` severity high/critical 24h, avalia cada regra `enabled=true`, respeita **cooldown** via `last_triggered_at + cooldown_minutes`, insere alerta em `security_alerts` e log em `security_audit_log` com `action='security_alert_triggered'` (severity mapeada critical/error/warn/info). Cron pg_cron `security-alerts-evaluate` roda a cada 15min. **Edge function `security-alerts`** (admin only, rateLimit 60/min) ops: `list` (GET — devolve rules+alerts), `evaluate` (POST — dispara avaliação on-demand e retorna {evaluated_at, rules_evaluated, alerts_triggered, skipped}), `update_rule` (POST — ajusta threshold/cooldown_minutes/enabled/severity/comparison com validação por enum), `acknowledge` (POST — marca alerta como reconhecido com user+timestamp). Frontend: **nova aba 'Alertas'** no Hardening Center v2 (`SecurityAlertsPanel.tsx`) com header pulsante quando há pendências (BellRing animate-pulse vermelho), card de 100 alertas recentes com badge sev + botão Reconhecer inline, tabela editável de regras com Input numérico para threshold/cooldown, Switch para enabled (commit imediato), Salvar habilitado só quando dirty. Sem mudança de SDK ou OpenAPI público. Migração aditiva, zero downtime. Invariantes grep: `grep -n \"3.4.72\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"security_alert_rules\" supabase/functions/security-alerts/index.ts | wc -l` ≥ 1; `grep -n \"security_evaluate_alerts\" supabase/functions/security-alerts/index.ts | wc -l` ≥ 1; `grep -n \"value=\\\"alerts\\\"\" src/pages/admin/security/SecurityHardeningCenterV2.tsx | wc -l` ≥ 2; `grep -n \"SecurityAlertsPanel\" src/components/admin/security/SecurityAlertsPanel.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.6 / SDK v3.3.1 / APP v3.4.71", date: "2026-05-01", changes: [
                      "SECURITY HARDENING CENTER v2 — gráficos de tendência e comparativo por versão. Nova aba **Tendências** (default) em `/dashboard/admin/security/hardening-v2` com 3 charts Recharts e janela ajustável 7/14/30d: (1) `SecurityTrendsCharts` AreaChart de Cobertura MFA % com gradiente primário e badge Δ em pontos percentuais entre primeiro e último ponto da janela; (2) LineChart de Eventos WAF Shadow (volume diário que seria bloqueado em modo enforce, mostra pico do período); (3) BarChart empilhado de Anomalias por severidade (low=muted, medium=chart-1, high=warning, critical=destructive). Componente `SecurityVersionCompare` adiciona mecanismo de **snapshot localStorage** (chave `security_v2_version_snapshots`, máx 20 capturas, tagueado por APP_VERSION) com seletor base/atual e tabela diff de 7 KPIs (MFA pct, pentest score, waf_shadow_24h, anomalias 24h, quarentenas, CVEs abertos, segredos vencidos) — cada linha exibe badge Δ verde quando a métrica melhora ou destructive quando piora, respeitando direção semântica (cobertura MFA up=melhor; anomalias/CVEs down=melhor). Edge function `security-metrics-v2` ganhou ops `trends` (agrega `security_audit_log` action='waf_shadow' + `anomaly_events` por severidade + `mfa_enrollments.verified_at` em buckets diários, calcula cobertura MFA cumulativa retroativa subtraindo enrollments diários do total atual) e `version_snapshot` (devolve metrics + captured_at). Apenas frontend e edge function — zero migration, zero mudança de SDK ou OpenAPI público. Invariantes grep: `grep -n \"3.4.71\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"SecurityTrendsCharts\" src/components/admin/security/SecurityTrendsCharts.tsx | wc -l` ≥ 1; `grep -n \"SecurityVersionCompare\" src/components/admin/security/SecurityVersionCompare.tsx | wc -l` ≥ 1; `grep -n \"op === \\\"trends\\\"\" supabase/functions/security-metrics-v2/index.ts | wc -l` ≥ 1; `grep -n \"value=\\\"trends\\\"\" src/pages/admin/security/SecurityHardeningCenterV2.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.5 / SDK v3.3.1 / APP v3.4.70", date: "2026-05-01", changes: [
                      "PENTEST INTERNO + 6 CAMADAS PROFUNDAS DE SEGURANÇA. Nova edge function `pentest-runner` (admin only, rateLimit 5/min, modo `dry_run` ou `full` exigindo step-up scope `pentest.execute` TTL 5min) executa 13 checks ofensivos OWASP A01-A10 + lógica de negócio (anônimo→user_roles/profiles/contas_pagar; audit chain immutable+verify; SSRF guard; step-up reuse; MFA coverage; public buckets; audit coverage; quarantine tracking; WAF runtime mode) e grava em `pentest_runs`/`pentest_findings` com cwe_id, severity, evidence_hash SHA-256 e remediation. CAMADA 1 (anti-abuso comportamental): tabelas `user_behavior_baseline` (avg_req_per_min/stddev/typical_hours/known_ips/asns/ua/countries) + `anomaly_events` + RPC `anomaly_record(uid,type,severity,signal,ip,asn,country,ua)` com auto-quarentena (3 anomalias high+ em 1h → 1h). CAMADA 2 (cofre de segredos): `secret_rotation_policy` seedada (LOVABLE_API_KEY/STRIPE_SECRET_KEY/ERP_API_KEY 90d, SUPABASE_SERVICE_ROLE_KEY 180d, FAL_KEY 180d) + `secret_access_log` + RPC `secret_audit_access(name,fn,req_id)`. CAMADA 3 (supply chain): `dependency_findings` + `app_integrity_baseline` + edge function `dependency-scan` ingere `npm audit --json`. CAMADA 4 (anti-DoS L7): `global_rate_limit_buckets` (sliding window por minuto) + RPC `global_rate_limit_check(_id,_limit DEFAULT 1000)`. CAMADA 6 (forense): `incident_timeline` + RPC `incident_snapshot(_uid,_hours DEFAULT 24)` admin-only + edge function `forensic-snapshot` (step-up `user.management`, hash SHA-256 de integridade). RPC `security_v2_metrics()` consolida MFA adoption/WAF shadow/anomalies/quarantine/pentest score/CVEs/secrets vencidos. Edge function `security-metrics-v2` (rateLimit 60/min) ops: metrics|anomalies|secrets|pentest_runs|pentest_findings|dependencies. Frontend nova rota `/dashboard/admin/security/hardening-v2` (`SecurityHardeningCenterV2.tsx`) com 4 KPIs + 5 abas (Pentest, Anomalias, Segredos, Dependências, Forense) e download de snapshot JSON. step_up_scopes ganha `pentest.execute` (300s). Migração aditiva, zero downtime; sem mudança de SDK ou OpenAPI público. Invariantes grep: `grep -n \"3.4.70\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"pentest-runner\" supabase/functions/pentest-runner/index.ts | wc -l` ≥ 1; `grep -n \"security_v2_metrics\" supabase/functions/security-metrics-v2/index.ts | wc -l` ≥ 1; `grep -n \"hardening-v2\" src/App.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.69", date: "2026-05-01", changes: [
                      "HARDENING — ROLLOUT FINAL (MFA enforce admin/gerente, Step-up enforcement, WAF v2 shadow, DR drill). **MFA OBRIGATÓRIO admin/gerente com grace period 7d**: nova tabela `public.mfa_grace_periods` (PK user_id, grace_started_at, grace_expires_at default `now()+'7 days'`, RLS self-read + admin-write); função `public.mfa_is_enforced_for_user(uuid)` SECURITY DEFINER que (1) retorna false se usuário não tem role admin/gerente; (2) retorna false se já tem `mfa_enrollments.verified_at IS NOT NULL`; (3) inicia grace automaticamente no primeiro acesso e retorna false; (4) só retorna **true após `now() > grace_expires_at`**. `supabase/functions/_shared/secure-handler.ts` agora chama essa RPC após validar JWT — quando enforce=true, retorna **403 com `{error, code:'MFA_REQUIRED'}`** propagando em todas as ~200 edge functions. Frontend: novo `<MfaGate />` em `src/components/security/MfaGate.tsx` plugado em `DashboardLayout` mostra Alert amarelo (`MFA será obrigatório em N dias`) durante o grace e Alert vermelho destrutivo após expirar, com botão direto para `/dashboard/security/mfa`. Recovery: 10 codes one-time-show já emitidos no enrollment; lockout: admin reseta enrollment via `security-admin`. **STEP-UP ENFORCEMENT nas 4 categorias sensíveis**: nova tabela `public.step_up_scopes` (scope PK, ttl_seconds, enabled, RLS admin-write + read autenticado) seedada com `export.data` (15min), `user.management` (15min), `finance.sensitive` (5min), `municipios.write` (15min). Nova função `public.mfa_step_up_validate(uid, scope, token)` SECURITY DEFINER restrita a `service_role` (REVOKE EXECUTE de PUBLIC/anon/authenticated): SHA-256 do token via `extensions.digest`, valida `consumed=false` e `expires_at>now()`, marca consumido em UPDATE atômico (single-use). `secureHandler` aceita novo campo `requireStepUp: 'scope'` — quando setado, exige header **`x-step-up-token`** e retorna 401 com `{code:'STEP_UP_REQUIRED', scope}` se ausente ou `{code:'STEP_UP_INVALID'}` se inválido/consumido/expirado. Frontend: novo hook `src/hooks/useStepUp.ts` (`useStepUp()` retorna `request(scope, description) => Promise<token|null>` orquestrando o `StepUpDialog` via Promise + dialogProps), facilita: `const token = await request('export.data', 'Exportar planilha')` → enviar em `headers['x-step-up-token']`. **WAF v2 SHADOW MODE 48h**: nova tabela `public.waf_runtime_config` (singleton id=1, mode CHECK in `shadow|enforce|off` default `shadow`, geo_enabled, bot_signals_enabled) + função `public.waf_get_mode()`. Engine `supabase/functions/_shared/waf.ts` reescrita: cache de 30s do modo; **avalia geo policy** lendo `cf-ipcountry` ou `x-vercel-ip-country` ou `x-country` contra `waf_geo_policy` (block tem precedência sobre allow); **bot signals heurísticos** com score (UA missing=30, UA<20chars=15, sem accept-language=10, sem accept=10, headless/puppeteer/playwright=50) → ≥50 dispara; mantém SQLi/XSS/path-traversal e bot signatures. Em **shadow mode** infrações são logadas em `security_audit_log` com `action='waf_shadow', severity='low'` e a request **passa** (allowed:true, shadowed:true) — permite calibrar sem bloquear. Toggle para enforce sem deploy: `UPDATE public.waf_runtime_config SET mode='enforce' WHERE id=1` (cache propaga em 30s). **DR — RPO 15min/RTO 1h**: nova tabela `public.dr_drill_log` (started_at, finished_at, rpo_minutes, rto_minutes, scenario, outcome, notes, executed_by, RLS admin-only); script `scripts/dr/drill.sh` com modos dry-run (default) e --execute, simula PITR list → restore → smoke test → DNS flip medindo etapas em segundos, calcula RPO/RTO finais e grava no log; runbook completo (7 etapas) em `.lovable/plan.md`. Migração 100% aditiva, zero downtime; usuários SEM role admin/gerente não veem nenhuma diferença. Sem mudança de SDK ou OpenAPI público. Invariantes grep positivos: `grep -n \"3.4.69\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"mfa_is_enforced_for_user\" supabase/functions/_shared/secure-handler.ts | wc -l` ≥ 1; `grep -n \"requireStepUp\" supabase/functions/_shared/secure-handler.ts | wc -l` ≥ 2; `grep -n \"MfaGate\" src/components/dashboard/DashboardLayout.tsx | wc -l` ≥ 2; `grep -n \"useStepUp\" src/hooks/useStepUp.ts | wc -l` ≥ 1; `grep -n \"waf_runtime_config\" supabase/functions/_shared/waf.ts | wc -l` ≥ 1; `grep -n \"shadow\" supabase/functions/_shared/waf.ts | wc -l` ≥ 3; `test -x scripts/dr/drill.sh && echo OK`.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.68", date: "2026-05-01", changes: [
                      "HARDENING DE SEGURANÇA — FASES 2 a 7 (MFA + Step-up + WAF v2 + CSP + PII + SIEM + DR). **Fase 2 (MFA TOTP + Step-up)**: novas tabelas `public.mfa_enrollments` (UNIQUE user_id, secret_encrypted, recovery_codes_hash[10], verified, RLS self-only via `auth.uid() = user_id`), `public.mfa_step_up_tokens` (token_hash UNIQUE, scope, consumed, expires_at TTL 5min, single-use), `public.mfa_required_roles` (role app_role PK, seed: `admin`, `gerente`; admin gerencia via RLS) e `public.device_fingerprints` (UNIQUE user_id+fingerprint_hash). 3 funções `SECURITY DEFINER` com `search_path = public, pg_temp` e `EXECUTE` revogado de PUBLIC/anon: `user_requires_mfa(uid)`, `user_has_active_mfa(uid)`, `validate_step_up_token(uid, token_hash, scope)` (UPDATE atômico que consome single-use). Trigger `purge_expired_step_up_tokens` (lazy cleanup AFTER INSERT). Implementação TOTP **RFC 6238 nativa em Deno** (zero deps externas) em `supabase/functions/_shared/totp.ts`: `generateBase32Secret(20)`, `base32Encode/Decode`, `hmacSha1` via `crypto.subtle.importKey({name:'HMAC',hash:'SHA-1'})`, `totpCode(secret, time, step=30, digits=6)`, `verifyTotp` com **tolerância ±1 step** (clock drift) e `timingSafeEqual` constant-time, `buildOtpauthUri` (issuer=Bimaster), `sha256Hex` e `generateRecoveryCodes(10)`. 2 edge functions novas: `mfa-manage` (auth jwt, rateLimit 20/min) com 4 actions (`status`/`enroll`/`verify`/`disable` — disable exige TOTP atual) e `mfa-step-up` (auth jwt, rateLimit 30/min) com 2 actions (`request` exige código TOTP e devolve token hex 32B + expires_at; `validate` consome via RPC). Hook frontend `src/hooks/useMfa.ts` exporta `useMfa()` (status/enroll/verify/disable), `requestStepUp(scope, code)` e `validateStepUp(scope, token)`. Página `/dashboard/security/mfa` (`src/pages/security/MfaSettingsPage.tsx`): QR code via `api.qrserver.com`, secret base32 visível, **10 códigos de recuperação one-time-show**, alert vermelho quando `required && !verified`, ativar/desativar com TOTP. Componente reutilizável `<StepUpDialog open scope onSuccess={(token)=>...} />` em `src/components/security/StepUpDialog.tsx` para qualquer ação sensível (financeiro, mudança de role, exports massivos) — caller envia o token no header `X-Step-Up-Token`. **Fase 3 (WAF v2)**: novas tabelas `public.waf_geo_policy` (country_code CHAR(2) PK, action CHECK in allow/challenge/block, pré-povoada `BR/CN/US/PT=allow`, `KP/IR/SY/CU=block` por sanções) e `public.waf_bot_signals` (telemetria por IP+UA hash com índice por ip+created_at DESC). **Fase 4 (CSP / defesa em profundidade no cliente)**: `index.html` ganhou `<meta http-equiv=\"X-Content-Type-Options\" content=\"nosniff\">`, `<meta http-equiv=\"Permissions-Policy\" content=\"camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()\">`, `<meta name=\"format-detection\" content=\"telephone=no\">` e `<meta name=\"color-scheme\" content=\"light dark\">`. **Fase 5 (PII / LGPD)**: 2 funções `IMMUTABLE` com search_path fixo, EXECUTE só p/ authenticated: `mask_cpf(text)` retorna `***.XXX.XXX-**` e `mask_email(text)` retorna `f***@dominio` — usar em RLS/views para retorno mascarado a usuários sem clearance. **Fase 6 (SIEM correlation engine)**: `public.siem_correlation_rules` (4 regras seed: `credential_stuffing` threshold=10/300s, `impossible_travel` threshold=1/600s, `mass_export` threshold=50/3600s, `privilege_escalation` threshold=1/60s) e `public.siem_alerts` (rule_key, user_id, ip, severity, matched_count, payload, acknowledged) com RLS admin-only. Edge function `siem-correlate` (auth jwt, rateLimit 10/min, exige `has_role admin`) agrega `security_events` por janela e gera alerts. **Fase 7 (process gates)**: plano com **RPO 15min / RTO 1h** documentado no plano. Migração 100% aditiva, zero downtime, todas as roles autenticadas mantêm fluxos atuais — MFA ainda **não força bloqueio** (rollout gradual via `MfaGate` opt-in nas próximas releases). Sem mudança de SDK ou OpenAPI público. Invariantes grep positivos: `grep -n \"3.4.68\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"verifyTotp\" supabase/functions/_shared/totp.ts | wc -l` ≥ 1; `grep -n \"mfa-manage\" supabase/functions/mfa-manage/index.ts | wc -l` ≥ 1; `grep -n \"mfa-step-up\" supabase/functions/mfa-step-up/index.ts | wc -l` ≥ 1; `grep -n \"useMfa\" src/hooks/useMfa.ts | wc -l` ≥ 1; `grep -n \"StepUpDialog\" src/components/security/StepUpDialog.tsx | wc -l` ≥ 1; `grep -n \"MfaSettingsPage\" src/pages/security/MfaSettingsPage.tsx | wc -l` ≥ 1; `grep -n \"siem-correlate\" supabase/functions/siem-correlate/index.ts | wc -l` ≥ 1; `grep -n \"Permissions-Policy\" index.html | wc -l` ≥ 1; `grep -n \"X-Content-Type-Options\" index.html | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.67", date: "2026-05-01", changes: [
                      "HARDENING DE SEGURANÇA PROFUNDO — Fase 1 (DB) + fundação SIEM/Quarentena/Audit imutável. Migration revoga `EXECUTE` em ~750 funções `SECURITY DEFINER` do schema `public` para `anon`/`PUBLIC` (mantém em `authenticated` apenas para RPCs; revoga também de `authenticated` em ~116 funções tipo `RETURNS trigger` que nunca devem ser chamadas via REST). Força `SET search_path = public, pg_temp` em todas as DEFINER restantes e `ALTER VIEW ... SET (security_invoker = true)` em todas as views de `public`. Move `pg_trgm` e `pg_net` para schema dedicado `extensions`. Resultado do scan: **754 → 273 findings (-64%)**; remanescentes são lint advisory 0029 (DEFINER callable por authenticated, esperado para RPCs de negócio que validam internamente). Nova função `public.security_invariants_check()` retorna FAIL se aparecerem regressões. **HIBP password protection ativada** (`password_hibp_enabled=true`). Nova tabela append-only `public.audit_log_immutable` com hash chain SHA-256 (trigger `audit_log_immutable_seal` calcula `prev_hash`/`row_hash` em BEFORE INSERT; trigger `audit_log_immutable_block` proíbe UPDATE/DELETE/TRUNCATE) + RPCs `audit_log_record(action,entity,entity_id,before,after,ip,ua,req_id)` e `audit_log_verify_chain(limit)` que recalcula a cadeia. Nova tabela `public.security_events` (event_type, severity, user_id, ip, asn, country, resource, details) com índices por timestamp/user/ip/type+sev e RPC `security_event_record`. Nova tabela `public.account_quarantine` + RPCs `account_quarantine_set`/`_release`/`is_account_quarantined` (admin-only via `has_role`). Nova tabela `public.lgpd_consents` (user_id, purpose, version, granted, revoked_at) com RLS self-only. Nova tabela `public.user_trusted_devices` (UNIQUE user_id+fingerprint) + RPC `user_device_register` que dispara `security_event_record('new_device','warn',...)` em primeiro registro. **`secureHandler` agora chama `is_account_quarantined`** (cache 30s em memória) após validar JWT e retorna **423 Locked** para contas bloqueadas — efeito imediato em todas as ~200 edge functions. Nova edge function `security-admin` (secureHandler jwt, rateLimit 60/min, valida `has_role admin` antes de cada op): GET `?op=kpis|events|invariants|audit|quarantined`, POST `{op:quarantine|release|verify_chain}`. Nova rota `/dashboard/admin/security/hardening` (`src/pages/admin/security/SecurityHardeningCenter.tsx`): 4 KPIs (eventos 24h, críticos, warnings, contas em quarentena) + 4 abas — Invariantes (status OK/FAIL por check), Eventos (tabela 200 últimos), Quarentena (form + lista de bloqueados + liberar) e Auditoria (botão Verificar integridade da hash chain). Sem mudança de SDK/OpenAPI. Invariantes grep positivos: `grep -n \"is_account_quarantined\" supabase/functions/_shared/secure-handler.ts | wc -l` ≥ 1; `grep -n \"audit_log_immutable_seal\" supabase/migrations | wc -l` ≥ 1; `grep -n \"SecurityHardeningCenter\" src/App.tsx | wc -l` ≥ 2; `grep -n \"3.4.67\" src/lib/version.ts | wc -l` ≥ 2; `grep -n \"security-admin\" supabase/functions/security-admin/index.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.64", date: "2026-05-01", changes: [
                      "PROJETOS — DESTAQUE VISUAL DA ABA \"CHAT IA\" — Em `src/components/projetos/ProjetoHeader.tsx` (`MANAGE_TABS`), a aba `chat` foi renomeada de `Chat` para `Chat IA` para deixar claro que é o chat com resumo automático diário (componente `ProjetoChatTab` consumindo `useProjetoChat` + edge function `projeto-resumo-diario`) e não confundir com o botão `Resumo IA` da hero pill. O bump de `APP_VERSION` (3.4.63 → 3.4.64) em `src/lib/version.ts` dispara `checkAndUpdateVersion()`, limpando caches do cliente que ainda mascaravam a aba após o PR-96. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI. Invariante grep positivo: `grep -n \"Chat IA\" src/components/projetos/ProjetoHeader.tsx | wc -l` ≥ 1; `grep -n \"3.4.64\" src/lib/version.ts | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.63", date: "2026-04-30", changes: [
                      "ESTABILIDADE DOS CHATS DE IA — Correção crítica em `supabase/functions/projeto-copilot/index.ts`, `supabase/functions/projeto-copilot-aplicar/index.ts` e `supabase/functions/projeto-copilot-relatorio/index.ts`: as três funções estavam usando `export default secureHandler(...)` em vez de `Deno.serve(secureHandler(...))`, fazendo o Edge Runtime nunca registrar o listener — toda chamada ficava pendurada até o cliente desistir (sintoma reportado: \"Copiloto fica carregando para sempre\"). Agora todas as três expõem `Deno.serve()` corretamente. Novo helper `supabase/functions/_shared/ai-gateway-call.ts` (`callAIGateway` + `aiGatewayErrorResponse`) com timeout via AbortController (default 60s, evita pendurar a edge), fallback automático de modelo em 429/402 (`gemini-2.5-pro`→`gemini-3-flash-preview`→`gemini-2.5-flash-lite`, `gpt-5/5.2`→`gpt-5-mini`→`gpt-5-nano`) e tradução padronizada de erros (rate_limited/payment_required/timeout/upstream). `ai-insights/index.ts` migrado para o helper com modelo padrão alterado de `google/gemini-2.5-pro` para `google/gemini-3-flash-preview` (chat interativo — latência prioritária); função `callModel` interna do `projeto-copilot` removida e substituída pelo helper, com loop de tool-calling elevado de 4→5 iterações e mensagem clara de fallback ao final (\"Não consegui finalizar a resposta após várias tentativas...\"). `contas-pagar-ai-chat/index.ts`: modelo das duas chamadas alterado de `gemini-2.5-pro` para `gemini-3-flash-preview`. `api-support-ai/index.ts`: `reasoning.effort` reduzido de `high` para `medium` (chat interativo). Novo helper frontend `src/lib/ai/invokeChat.ts`: wrapper de `supabase.functions.invoke()` com timeout cliente de 90s (evita spinner infinito mesmo se uma função futura quebrar) e tradução de erros 402/429/timeout/401 em mensagens de toast claras. `src/components/chat/AIInsightsChat.tsx` (chat principal de Insights) refatorado para consumir `invokeChat`. Smoke tests via curl confirmaram resposta em ~3s para `projeto-copilot` (estava 100% morto antes) e `ai-insights`, `api-support-ai` e `huggs-agent-chat`. Sem mudança de schema, RLS, SDK ou OpenAPI. Invariantes grep positivos: `grep -n \"Deno.serve(secureHandler\" supabase/functions/projeto-copilot/index.ts | wc -l` ≥ 1; `grep -n \"Deno.serve(secureHandler\" supabase/functions/projeto-copilot-aplicar/index.ts | wc -l` ≥ 1; `grep -n \"Deno.serve(secureHandler\" supabase/functions/projeto-copilot-relatorio/index.ts | wc -l` ≥ 1; `grep -n \"callAIGateway\" supabase/functions/_shared/ai-gateway-call.ts | wc -l` ≥ 1; `grep -n \"callAIGateway\" supabase/functions/projeto-copilot/index.ts | wc -l` ≥ 1; `grep -n \"callAIGateway\" supabase/functions/ai-insights/index.ts | wc -l` ≥ 1; `grep -n \"invokeChat\" src/lib/ai/invokeChat.ts | wc -l` ≥ 1; `grep -n \"invokeChat\" src/components/chat/AIInsightsChat.tsx | wc -l` ≥ 1; `grep -n \"google/gemini-3-flash-preview\" supabase/functions/ai-insights/index.ts | wc -l` ≥ 1; `grep -n \"google/gemini-3-flash-preview\" supabase/functions/contas-pagar-ai-chat/index.ts | wc -l` ≥ 2. Invariantes grep negativos: `grep -n \"export default secureHandler\" supabase/functions/projeto-copilot/index.ts | wc -l` deve retornar 0; `grep -n \"google/gemini-2.5-pro\" supabase/functions/ai-insights/index.ts | wc -l` deve retornar 0.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.62", date: "2026-04-30", changes: [
                      "PROJETOS — COPILOTO DE IA (FASES 2, 3 E 4) — Conclui o copiloto avançado por projeto. **Fase 2 (ações com confirmação por senha):** nova edge function `supabase/functions/projeto-copilot-aplicar/index.ts` (`secureHandler` `auth: jwt`, `rateLimit: 20/min`, schema Zod `.strict()` com `{acao_id, password}`) carrega a ação em `projeto_copilot_acoes` (valida ownership via join com `projeto_copilot_threads`, exige `status='proposta'`), faz reauth chamando `signInWithPassword({ email: ctx.email, password })` em cliente Supabase isolado (`persistSession:false`), registra tentativa via nova RPC `public.register_copilot_password_attempt(_user_id, _success)` (SECURITY DEFINER, EXECUTE revogado de `public/anon/authenticated` — só service role; janela de 15min, 5 falhas → bloqueia 30min em `projeto_copilot_password_attempts.bloqueado_ate`) e, em sucesso, executa via nova RPC `public.copilot_executar_acao(_user_id, _projeto_id, _tipo, _payload)` (SECURITY DEFINER, EXECUTE revogado; valida `user_can_access_projeto` antes de qualquer mutação; suporta `criar_tarefa` com fallback para primeira seção do projeto, `ajustar_prazo`, `reatribuir`, `mudar_status` ∈ pendente|em_andamento|concluida|bloqueada|cancelada com `data_conclusao` automática quando concluída, e `mudar_prioridade` ∈ baixa|media|alta). Atualiza `projeto_copilot_acoes` com `status`, `aplicada_por`, `aplicada_em`, `resultado`, `ip` (de `x-forwarded-for`) e `user_agent` para auditoria. As tools `propor_criar_tarefa`, `propor_ajustar_prazo`, `propor_reatribuir`, `propor_mudar_status` e `propor_mudar_prioridade` em `projeto-copilot/index.ts` agora gravam linha em `projeto_copilot_acoes` com `status='proposta'`, calculam `diff` (snapshot anterior via JWT do usuário) e retornam para o agente `{ ok, acao_id, resumo, requer_confirmacao_senha:true }`. **Fase 3 (relatórios PDF/XLSX com gráficos):** nova edge function `supabase/functions/projeto-copilot-relatorio/index.ts` (`secureHandler` `auth: jwt`, `rateLimit: 10/min`, schema Zod `{projeto_id, thread_id?, tipo:'status'|'responsaveis'|'executivo', formato:'pdf'|'xlsx'}`) cria registro `pending` em `projeto_copilot_relatorios`, gera o arquivo, faz upload em `projeto-relatorios/<userId>/<projeto_id>/<relatorio_id>.<ext>` (RLS por uid já garantida na Fase 1) e devolve `signed_url` de 10min + nome amigável. PDF via `pdf-lib@1.17.1`: capa, 6 cards de métricas (total/concluídas/em andamento/atrasadas/sem responsável/% concluído), gráfico de barras desenhado por status (4 barras coloridas), tabela de carga por responsável (com atrasadas em vermelho) e seção de tarefas atrasadas, com paginação A4 e rodapé com numeração. XLSX via `exceljs@4.4.0` em 3 sheets (Resumo, Tarefas, Por responsável). Tool `gerar_relatorio` em `projeto-copilot` invoca a function via fetch interno reaproveitando o `Authorization` do usuário (RLS aplica) e devolve `ReportOut` para o agente. **Fase 4 (modelo híbrido):** novo roteador `escolherModelo(userMsg)` em `projeto-copilot` analisa intenção por palavras-chave (replanej*, planejamento, risco*, análise/avalie, cenário, estratégia, cronograma, próximas duas semanas, ata, por que) e usa `openai/gpt-5.2` com `reasoning: { effort: 'medium' }` para planejamento/risco/análise; padrão segue `google/gemini-3-flash-preview`. `callModel` agora aceita `model` dinâmico e injeta `reasoning` apenas para GPT-5.2; em 429, fallback automático Flash → `google/gemini-2.5-flash-lite`. Resposta da function ganha campos `proposals[]`, `reports[]` e `model`; após persistir mensagem do assistente, vincula propostas via `projeto_copilot_acoes.mensagem_id`. Migração aditiva: adiciona `projeto_copilot_acoes` à publicação `supabase_realtime` com `REPLICA IDENTITY FULL`. Frontend: `useProjetoCopilot` ganha `applyProposal(acaoId, password)` e `discardProposal(acaoId)` com atualização local do status; mensagens carregam `proposals` e `reports`. Novo `src/components/projetos/ConfirmarAcaoDialog.tsx` (Dialog com diff visual `de → para`, campo Input type='password' autoFocus, mensagem de aviso sobre 5 tentativas/30min, Confirmar com `ShieldCheck`). `ProjetoCopilotPanel` reescrito com sub-componentes `ProposalCard` (botões \"Aplicar com senha\" / \"Descartar\", `StatusBadge` por estado proposta/aplicada/descartada/falhou) e `ReportCard` (ícone PDF/XLSX, download via `downloadStorageBlob` + `triggerBlobDownload`, sem `window.open`, conforme memória `Blob Download Protocol`). Indicador discreto do modelo usado na resposta. Sugestão inicial \"Replanejar 2 semanas\" exemplifica o caminho GPT-5.2. Sem alteração em `useProjetos`, `useProjetoTarefas`, `useProjetoChat`, `projeto-ia-assistant`, `projeto-monitor-atrasos`, `projeto-resumo-diario` ou `projeto-estimar-horas-historico` — risco zero. Sem mudança de SDK ou OpenAPI. Invariantes grep positivos: `grep -n \"projeto-copilot-aplicar\" src/hooks/useProjetoCopilot.ts | wc -l` ≥ 1; `grep -n \"projeto-copilot-relatorio\" supabase/functions/projeto-copilot/index.ts | wc -l` ≥ 1; `grep -n \"copilot_executar_acao\" supabase/functions/projeto-copilot-aplicar/index.ts | wc -l` ≥ 1; `grep -n \"register_copilot_password_attempt\" supabase/functions/projeto-copilot-aplicar/index.ts | wc -l` ≥ 1; `grep -n \"openai/gpt-5.2\" supabase/functions/projeto-copilot/index.ts | wc -l` ≥ 1; `grep -n \"escolherModelo\" supabase/functions/projeto-copilot/index.ts | wc -l` ≥ 2; `grep -n \"ConfirmarAcaoDialog\" src/components/projetos/ProjetoCopilotPanel.tsx | wc -l` ≥ 2; `grep -n \"propor_criar_tarefa\\|propor_ajustar_prazo\" supabase/functions/projeto-copilot/index.ts | wc -l` ≥ 2; `grep -n \"triggerBlobDownload\" src/components/projetos/ProjetoCopilotPanel.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.61", date: "2026-04-30", changes: [
                      "PROJETOS — COPILOTO DE IA (FASE 1, FUNDAÇÃO) — Nova edge function `supabase/functions/projeto-copilot/index.ts` (secureHandler `auth: jwt`, `rateLimit: 30/min`, schema Zod `.strict()` com `{thread_id?, projeto_id, user_message}`) implementa um agente conversacional por projeto via Lovable AI Gateway (`google/gemini-3-flash-preview`) com tool-calling. Sete tools de leitura, todas executadas com o JWT do usuário (RLS aplicada, nada bypassa service role): `metricas_projeto`, `listar_tarefas` (filtros status/responsável/atrasadas/sem_responsavel), `detalhar_tarefa`, `buscar_no_projeto` (ilike em titulo/descricao), `carga_por_responsavel`, `listar_anexos` e `ler_anexo` — esta extrai texto de PDFs (até 50 páginas via `pdfjs-serverless@0.5.0`), XLSX/XLS (via `xlsx@0.18.5` → CSV) e CSV/TXT, com teto de 20MB no anexo e 30k chars no retorno; verifica via join `projeto_tarefa_anexos→projeto_tarefas` que o anexo pertence ao `projeto_id` da requisição. Acesso ao projeto validado por `user_can_access_projeto(uid, projeto_id)` antes de criar/usar thread. System prompt restringe escopo a Projetos e proíbe ações destrutivas. Migração aditiva cria 5 tabelas: `projeto_copilot_threads` (RLS dono select/insert/update/delete + admin select; insert exige `user_can_access_projeto`), `projeto_copilot_mensagens` (sources jsonb, model, tokens_in/out, latency_ms; trigger `validate_copilot_msg_role` valida role ∈ user|assistant|system|tool sem CHECK, segue memória; RLS select via thread, insert direto bloqueado com `WITH CHECK (false)` — só backend escreve), `projeto_copilot_acoes` (auditoria com tipo/payload/status/ip/user_agent; trigger `validate_copilot_acao` valida status ∈ proposta|aplicada|descartada|falhou|expirada), `projeto_copilot_relatorios` (status/storage_path/expires_at default now()+30d) e `projeto_copilot_password_attempts` (preparada para Fase 2, RLS só admin). Bucket privado `projeto-relatorios` com policies em `storage.objects` exigindo `(storage.foldername(name))[1] = auth.uid()::text` ou `is_admin()`. `REPLICA IDENTITY FULL` + `supabase_realtime` em `projeto_copilot_mensagens` e `projeto_copilot_relatorios`. Frontend: novo hook `src/hooks/useProjetoCopilot.ts` (`send`, `loadThread`, `newThread`, `messages`, `sending`) que invoca `supabase.functions.invoke(\"projeto-copilot\")` com optimistic update da mensagem do usuário e rollback em erro. Novo componente `src/components/projetos/ProjetoCopilotPanel.tsx` — Sheet à direita (`sm:max-w-xl`) com markdown via `react-markdown`, chips `Badge` de fontes consultadas (tipo: tarefa|anexo + label truncada), 4 sugestões iniciais (Resumo, Atrasadas, Carga, Sem responsável), Textarea com Enter-to-send e botão \"Nova conversa\". `src/pages/ProjetoDetalhe.tsx` ganha state `copilotOpen` e FAB `Sparkles + \"Copiloto\"` `fixed bottom-6 right-6` que abre o painel. Sem alteração em `useProjetos`, `useProjetoTarefas`, `useProjetoChat`, `projeto-ia-assistant`, `projeto-monitor-atrasos`, `projeto-resumo-diario` ou `projeto-estimar-horas-historico` — risco zero para produção. Sem mudança de SDK ou OpenAPI. Invariantes grep positivos: `grep -n \"projeto-copilot\" src/hooks/useProjetoCopilot.ts | wc -l` ≥ 1; `grep -n \"ProjetoCopilotPanel\" src/pages/ProjetoDetalhe.tsx | wc -l` ≥ 2; `grep -n \"ler_anexo\" supabase/functions/projeto-copilot/index.ts | wc -l` ≥ 2; `grep -n \"projeto_copilot_threads\" supabase/migrations/ -r | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.60", date: "2026-04-30", changes: [
                      "AUDITORIA PROJETOS — FASE 2 (PERFORMANCE + REALTIME) — Migração aditiva cria três funções SECURITY DEFINER (anon revogado, EXECUTE para authenticated): (a) `public.get_projetos_collab_avatars()` retorna `(projeto_id, user_id, nome, avatar_url)` apenas para projetos onde `auth.uid()` é membro ou criador, substituindo no `useProjetos` o fan-out anterior — `select id, projeto_id from projeto_tarefas` + N batches de 500 em `projeto_tarefa_colaboradores` + `select profiles in (...)` — por 1 round-trip; (b) `public.get_meus_projetos_metrics(p_limit int default 200)` agrega server-side `total_tarefas / concluidas / atrasadas / minhas_pendentes` por projeto ativo do usuário (status ≠ 'finalizado'), permitindo `useMeusProjetosRecentes` deixar de baixar todas as tarefas para o cliente; (c) `public.count_projeto_tarefas_excluidas(uuid)` devolve só o COUNT exigido pelo badge da lixeira no `ProjetoHeader`. `useProjetoTarefas(id, { lixeiraOpen })` agora aceita um segundo argumento opcional e a query `projeto-tarefas-excluidas` só roda quando `lixeiraOpen === true` (lazy load de lixeira); novo state-controle `lixeiraOpen` mora em `ProjetoDetalhe.tsx` e é propagado via novas props `lixeiraOpen` / `onLixeiraOpenChange` / `tarefasExcluidasCount` em `ProjetoHeader.tsx` (compat com o uso legado preservada — `lixeiraBadgeCount = tarefasExcluidasCount ?? tarefasExcluidas.length`). Realtime: `ALTER TABLE public.projeto_tarefas / projeto_secoes REPLICA IDENTITY FULL` + ambas adicionadas idempotentemente à publicação `supabase_realtime`; `useProjetoTarefas` assina canal `rt-projeto-<id>` com filtros `projeto_id=eq.<id>` em ambas as tabelas e dispara `invalidateQueries(['projeto-tarefas-v2', id])` + invalidação do count de excluídas com debounce de 200ms (cleanup remove channel + clearTimeout). Soft-delete e restaurar invalidam o novo `projeto-tarefas-excluidas-count`. Sem mudança de SDK, OpenAPI, RLS ou CHECKs. Invariantes grep positivos: `grep -n \"get_projetos_collab_avatars\" src/hooks/useProjetos.ts | wc -l` ≥ 1; `grep -n \"get_meus_projetos_metrics\" src/hooks/useMeusProjetosRecentes.ts | wc -l` ≥ 1; `grep -n \"count_projeto_tarefas_excluidas\" src/hooks/useProjetoTarefas.ts | wc -l` ≥ 1; `grep -n \"rt-projeto-\" src/hooks/useProjetoTarefas.ts | wc -l` ≥ 1; `grep -n \"lixeiraOpen\" src/pages/ProjetoDetalhe.tsx | wc -l` ≥ 2. Invariantes grep negativos: `grep -n \"i += 500\" src/hooks/useProjetos.ts | wc -l` deve retornar 0; `grep -n \"projeto_tarefas\\\".*select(\\\"id, projeto_id, status, data_prazo\" src/hooks/useMeusProjetosRecentes.ts | wc -l` deve retornar 0.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.59", date: "2026-04-30", changes: [
                      "PROJETOS / CENTRAL DE TRABALHO — USUÁRIO PODE TROCAR A PRÓPRIA FOTO DE PERFIL DIRETO DO HEADER — Em `src/components/projetos/central/CentralHeader.tsx`, o `ProfileAvatarUpload` (`src/components/shared/ProfileAvatarUpload.tsx`, já usado em `PortalPerfil` e `TeamPerformanceChart`) é renderizado em modo `editable` ao lado do `ProjetoBgColorPicker`, à esquerda do título \"Bom dia, X\". Tooltip: \"Clique para atualizar sua foto de perfil\". A query `my-profile-name` foi estendida para selecionar também `avatar_url` (`select(\"nome, avatar_url\")`) e o `onUploadComplete` invalida `[\"my-profile-name\", user.id]` via `useQueryClient` para refletir a nova foto imediatamente sem reload. Reuso integral do upload existente: bucket `avatars` (privado), signed URL de 365 dias, update em `profiles.avatar_url`, validação de tipo/tamanho (máx 5MB) já implementadas no componente compartilhado. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI. Invariante grep positivo: `grep -n \"ProfileAvatarUpload\" src/components/projetos/central/CentralHeader.tsx | wc -l` ≥ 2 e `grep -n \"nome, avatar_url\" src/components/projetos/central/CentralHeader.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.58", date: "2026-04-30", changes: [
                      "AUDITORIA PROJETOS — FASE 1 (4 CORREÇÕES DE BAIXO RISCO) — (1) Migration aditiva amplia o CHECK de `public.asana_sync_log.status` para incluir `core_partial`, valor já gravado pela edge function `asana-sync` (linha 325 de `supabase/functions/asana-sync/index.ts`) sempre que o orçamento de tempo termina antes do core completar. Antes da correção todo update era rejeitado com erro `new row for relation \"asana_sync_log\" violates check constraint \"asana_sync_log_status_check\"` (visível em logs a cada execução), deixando o painel \"última sincronização\" defasado. Conjunto válido agora: `running | core_done | core_partial | secondary_partial | completed | failed`. (2) `src/pages/Projetos.tsx` — `podeVerTodos` agora também é `true` para `isGerenteGeral` (`useIsGerenteGeralProjetos` já era importado mas estava sem uso): linha 88 trocada de `const podeVerTodos = isAdmin;` para `const podeVerTodos = isAdmin || isGerenteGeral;`. RLS continua sendo a fonte de verdade — apenas o toggle UI passa a ser exposto para gerentes gerais. (3) `src/pages/ProjetoDetalhe.tsx` — query do projeto trocou `.single()` por `.maybeSingle()` e a tipagem de retorno passou para `Projeto | null`, alinhando com o caminho de \"permissão negada\" já implementado (`if (!projeto) { logProjectAccessDenied(); return <ShieldAlert/> }`). Antes, RLS bloqueando deixava o `useQuery` em estado de erro genérico sem disparar o log de auditoria. (4) `src/components/projetos/ColumnConfigPopover.tsx` — `loadColumnConfig` e `saveColumnConfig` agora protegem `typeof window === \"undefined\"` antes de tocar `localStorage` e o write é envolvido em try/catch (consistente com o padrão de read). Frontend + 1 migration aditiva. Sem mudança de SDK, OpenAPI ou contrato de RPC. Invariante grep positivo: `grep -n \"isAdmin || isGerenteGeral\" src/pages/Projetos.tsx | wc -l` ≥ 1; `grep -n \"\\.maybeSingle()\" src/pages/ProjetoDetalhe.tsx | wc -l` ≥ 1; `grep -n \"typeof window === \\\\\"undefined\\\\\"\" src/components/projetos/ColumnConfigPopover.tsx | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.57", date: "2026-04-30", changes: [
                      "PROJETOS — FILTRO \"APENAS EU\" E BADGE \"SOU RESPONSÁVEL\" NA TABELA DE TAREFAS DO PROJETO — Em `src/components/projetos/ProjetoFilterSort.tsx`, o Select de Responsável dentro do `FilterButton` ganhou nova opção \"Apenas eu (sou responsável)\" usando a sentinela `__me__`. A função `applyFilters(tarefas, filters, currentUserId?)` foi estendida para aceitar um terceiro argumento opcional `currentUserId` (string|null) que resolve a sentinela: se `filters.responsavelId === '__me__'`, mantém apenas tarefas onde `t.responsavel_id === currentUserId`. Em `src/components/projetos/ProjetoListView.tsx`, `useAuth()` é consumido e `user?.id` é repassado para `applyFilters` no `useMemo` `filteredTarefasPorSecao` (também adicionado às deps). Em `src/components/projetos/ProjetoTarefaRow.tsx`, novo Badge `outline` com ícone `UserCheck` (`bg-primary/10 text-primary border-primary/30`, h-4, text-[9px]) é renderizado inline ao lado dos demais badges (Sem prazo, Sem responsável, Retrabalho) quando `tarefa.responsavel_id === auth.user.id` e `status !== 'concluida'`. Tooltip: \"Você é o responsável por esta tarefa\". Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI. Invariante grep positivo: `grep -n \"Sou responsável\" src/components/projetos/ProjetoTarefaRow.tsx | wc -l` ≥ 1 e `grep -n \"__me__\" src/components/projetos/ProjetoFilterSort.tsx | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.56", date: "2026-04-30", changes: [
                      "CENTRAL DE TRABALHO — BADGE \"SOU RESPONSÁVEL\" NA TABELA DE TAREFAS — Em `src/components/projetos/central/MinhasTarefasContent.tsx`, o componente `ListRow` agora renderiza um Badge `outline` com ícone `UserCheck` e tom `primary` (`border-primary/40 bg-primary/5 text-primary`) quando `tarefa.papel === 'responsavel'`, análogo ao Badge `Colaborando` (Users, info) já existente para `papel === 'colaborador'`. Tooltip explicativo: \"Você é o responsável por entregar esta tarefa.\". Ambos os badges aparecem inline ao lado do título, antes da seção/projeto. Visível em todas as visões da Central (Hoje, Minhas tarefas, agrupamentos por prazo/status/prioridade e visão consolidada plana). Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI. Invariante grep positivo: `grep -n \"Sou responsável\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.55", date: "2026-04-30", changes: [
                      "CENTRAL DE TRABALHO — CARD \"MEUS PROJETOS\" DA ABA HOJE GANHA SCROLL E MOSTRA TODOS OS PROJETOS — Antes o card limitava a lista a 6 projetos (`.limit(6)` no hook `useMeusProjetosRecentes`) e renderizava sem altura máxima, então usuários com mais de 6 projetos ativos não conseguiam ver os demais nem rolar. Mudanças: (1) `src/hooks/useMeusProjetosRecentes.ts` — `.limit(6)` elevado para `.limit(200)` (teto defensivo evitando query sem limite, mantendo `order(\"updated_at\", desc)`). (2) `src/components/projetos/central/HojeTab.tsx` — container interno da lista de projetos envolvido em `<div class=\"max-h-[420px] overflow-y-auto divide-y divide-border/30 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent\">`, mesma classe de scrollbar fina já adotada em `ui/table.tsx`. Título do card ganhou Badge `secondary` com a contagem total de projetos ativos do usuário ao lado do nome (oculto durante loading e quando lista vazia). Loading state (3 skeletons) e empty state (\"Nenhum projeto ativo\") preservados. (3) Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI — feature 100% frontend. Invariante grep positivo: `grep -n \"max-h-\\[420px\\] overflow-y-auto\" src/components/projetos/central/HojeTab.tsx | wc -l` ≥ 1. Invariante grep negativo: `grep -n \"\\.limit(6)\" src/hooks/useMeusProjetosRecentes.ts | wc -l` deve retornar 0.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.54", date: "2026-04-30", changes: [
                      "CENTRAL DE TRABALHO — ORDENAÇÃO MANUAL POR ARRASTAR E SOLTAR NO MODO PRIORIDADE — Quando o usuário escolhe `Ordenar tarefas → Prioridade (maior)` no toolbar de `MinhasTarefasContent.tsx`, a lista plana agora ganha drag handles (`GripVertical`) à esquerda de cada `ListRow` e o usuário pode arrastar para reordenar manualmente sobrepondo a ordem automática (urgente→alta→media→baixa). A ordem custom é persistida por usuário em `localStorage` (chave `central:manual-priority-order:<uid>`) via novo hook `useManualPriorityOrder(userId)` em `src/hooks/useManualPriorityOrder.ts`, que expõe `{ order, setOrder, clear }` e o helper puro `applyManualOrder(items, order)` (coloca itens com IDs no array no topo na ordem informada e mantém o restante após na ordem original). Novo componente `ManualPrioritySortable` (`src/components/projetos/central/ManualPrioritySortable.tsx`) usa `@dnd-kit/core` + `@dnd-kit/sortable` (já instalados, mesma stack do Kanban de Prospects) com `PointerSensor` (activation distance 6px para não conflitar com clique de seleção), `KeyboardSensor` para acessibilidade e `verticalListSortingStrategy`. Banner azul com ícone `Flag` aparece acima da lista no modo prioridade explicando o gesto; quando há ordem manual ativa, exibe Badge `ordem manual ativa` e botão `Limpar ordem manual` (`RotateCcw`) que chama `clear()` + toast `Ordem manual removida`. A ordem manual é aplicada APENAS no `sortMode === \"prioridade\"` — modos `prazo`, `status`, `urgent` e `default` ignoram completamente o array (linhas 678-693 de `MinhasTarefasContent.tsx`). O `useMemo` `groups` ganhou `manualOrder` nas deps. Empty state, filtros, busca, papel, comentários rápidos e seleção em massa permanecem funcionais e atravessam o sortable sem regressão. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI — feature 100% frontend. Invariante grep positivo: `grep -n \"useManualPriorityOrder\\|ManualPrioritySortable\\|applyManualOrder\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 3. Invariante grep em hook: `grep -n \"central:manual-priority-order:\" src/hooks/useManualPriorityOrder.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.53", date: "2026-04-30", changes: [
                      "CENTRAL DE TRABALHO — OPÇÕES DE ORDENAÇÃO NA VISÃO CONSOLIDADA \"MINHAS TAREFAS\" — `VALID_SORTS` em `src/lib/centralUrlParams.ts` estendido de `['default','urgent']` para `['default','urgent','prazo','status','prioridade']` (parser/normalizador `normalizeSort` cobre os novos valores; defaults do PostgREST e do hook `useCentralPreferences` permanecem `default`). Novo Select \"Ordenar tarefas\" no toolbar de `MinhasTarefasContent.tsx` (ícone `ArrowUpDown`, w-[170px] h-9) entre o filtro de papel e o botão `Filtros avançados`, com 5 opções: `Agrupado por prazo` (default — mantém `groupTarefas` original com Atrasadas/Hoje/Semana/Mais tarde/Sem data), `Prazo (mais próximo)` (lista plana ordenada por `data_prazo` ASC, NULL ao final, tiebreaker por `titulo`), `Prioridade (maior)` (urgente→alta→media→baixa via `PRIORITY_WEIGHT`, tiebreaker por prazo, concluídas ao final), `Status` (em_andamento=1, pendente/nao_iniciado=2, bloqueada=3, cancelada=4, concluida=5 via novo `STATUS_WEIGHT`, tiebreaker por prazo) e `Urgência + prazo` (modo `urgent` pré-existente preservado). Cada modo retorna um único grupo com `label` descritivo (`buildFlat(label, items, key)` helper). O sub-agrupamento por papel (`splitByRole`) continua condicionado a `filterRole === 'all' && sortMode !== 'urgent'` — modos planos custom (`prazo`/`status`/`prioridade`) também desativam o split para preservar a leitura linear. Estado sincronizado com URL via `?sort=` (já existente, agora aceita 3 valores extras) e persistido via mesmo fluxo de `default_sort`. O filtro de prioridade alta/média/baixa solicitado já existia no toolbar (Select `filterPriority` com opções `urgente/alta/media/baixa`) e continua atendendo ao requisito de refinamento por prioridade na visão consolidada — nenhuma duplicação no popover de filtros avançados. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI. Invariante grep positivo: `grep -n \"sortMode === \\\"prazo\\\"\\|sortMode === \\\"status\\\"\\|sortMode === \\\"prioridade\\\"\\|STATUS_WEIGHT\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 4. Invariante grep em `centralUrlParams.ts`: `grep -n 'VALID_SORTS = \\[\"default\", \"urgent\", \"prazo\", \"status\", \"prioridade\"\\]' src/lib/centralUrlParams.ts | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.52", date: "2026-04-30", changes: [
                      "CENTRAL DE TRABALHO — FILTROS AVANÇADOS NA VISÃO CONSOLIDADA \"MINHAS TAREFAS\" — Nova affordance no toolbar de `MinhasTarefasContent.tsx`: botão `Filtros avançados` (ícone `SlidersHorizontal`, variante `default` com Badge de contagem quando há filtros ativos, `outline` caso contrário) abre um Popover (340px, `align=start`) com três seções separadas por `Separator`. (1) `Status` — multi-seleção via Checkbox em grid 2 colunas usando `STATUS_OPTIONS` de `@/lib/projetoConstants` (Não iniciado, Em andamento, Concluído, Bloqueada, Cancelada); estado controlado por `filterStatus: string[]` aplicado em `filtered` via `filterStatus.includes(t.status)`. (2) `Responsável` — Select com opção `Todos os responsáveis` no topo, `Apenas eu` (quando `user?.id` definido) e o restante alimentado por `useSystemProfiles()` filtrado pelos `responsavel_id` distintos das tarefas atuais (memoizado em `responsavelOptions`); estado `filterResponsavel: string` aplicado via igualdade de `t.responsavel_id`. (3) `Período (prazo)` — dois date-pickers shadcn (mode=single, `pointer-events-auto`) renderizados em grid 2 colunas (`De` / `Até`), aplicados em `filtered` comparando `t.data_prazo` contra `setHours(0,0,0,0)` no piso e `setHours(23,59,59,999)` no teto; tarefas sem `data_prazo` são excluídas quando o filtro está ativo. Pills removíveis abaixo da toolbar (`basis-full` para quebrar linha) listam cada filtro ativo com botão `X` individual; botão `Limpar` no header do popover reseta as três seções de uma vez via `clearAdvancedFilters()`. Estado mantido apenas em memória local — NÃO foi propagado para `URLSearchParams`, `centralUrlParams.ts`, `user_central_preferences` nem `centralSaveReason.ts`, preservando integralmente o contrato de URL/preferências documentado e idempotência de `sanitizeCentralSearchParams`. A barra de busca pré-existente (`q=`) e os filtros de prazo rápido (`filter=hoje|atrasadas|sem_data`), prioridade, projeto e papel permanecem inalterados — os novos filtros são aditivos. Sem mudança de schema, RLS, edge functions, SDK ou OpenAPI. Invariante grep positivo: `grep -n \"Filtros avançados\\|advancedActiveCount\\|filterDateFrom\\|filterResponsavel\\|filterStatus\" src/components/projetos/central/MinhasTarefasContent.tsx | wc -l` ≥ 5.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.51", date: "2026-04-30", changes: [
                      "CENTRAL DE TRABALHO — NOTIFICAÇÕES DE MUDANÇA DE PAPEL + VISÃO CONSOLIDADA + COMENTÁRIO RÁPIDO INLINE — Três melhorias coordenadas na Central de Trabalho que reaproveitam infraestrutura existente sem nova rota nem nova tabela. (1) Trigger `notify_tarefa_papel_change` (SECURITY DEFINER, search_path=public) em `AFTER INSERT ON projeto_tarefa_acesso_audit` insere uma notificação `type='task_role_change'` em `public.notifications` para o `user_afetado_id` toda vez que `papel_novo` muda — inclui as 5 transições alvo (null→responsavel, null→colaborador, colaborador→responsavel, responsavel→colaborador e *→null), pula quando `ator_id = user_afetado_id` (auto-mudanças não geram spam) e monta a mensagem em PT-BR contextualizada com título da tarefa e nome do projeto via JOIN em `projeto_tarefas` × `projetos`; `action_url` aponta para `/dashboard/projetos/central?tab=tarefas&task={id}`. `usePushNotifications` (já escutando `INSERT` em `notifications` via realtime) propaga via Web Push automaticamente quando o usuário concedeu permissão. (2) Novo componente `PapelChangeBanner` (`src/components/projetos/central/PapelChangeBanner.tsx`) renderizado no topo de `MinhasTarefasContent` lê via React Query (refetchInterval 60s) as notificações `task_role_change` não lidas das últimas 24h do usuário autenticado e exibe um banner compacto `info` com contagem; clique abre Popover com lista das mensagens, tempo relativo (`formatDistanceToNow` ptBR), botão `Ir para tarefa` (que marca como lido + navega) e botão `Marcar todas`. Sem RLS extra — `notif_select` existente já restringe ao `user_id = auth.uid()`. (3) Novo `RoleOverviewCard` (`src/components/projetos/central/RoleOverviewCard.tsx`) — Card colapsável renderizado acima da lista quando `tarefas.length > 0`, persistido em `user_central_preferences.show_role_overview` (nova coluna `boolean NOT NULL DEFAULT true`). Calcula em `useMemo` a divisão entre `Sou responsável` e `Estou colaborando`: contagem de ativas, atrasadas (data_prazo < hoje) e tarefas para hoje, mais o total agregado e o número de concluídas hoje. Cada linha é clicável e aplica/desaplica o filtro `Meu papel` correspondente (`responsavel`/`colaborador`/`all`); botão `Ver todos os papéis` resseta para `all`. (4) Sub-agrupamento por papel dentro de cada bloco de prazo: `ListSection` ganha props `messageCounts` e `splitByRole` — quando `filterRole === 'all'` e `sortMode !== 'urgent'`, cada grupo (`Atrasadas`, `A fazer hoje`, etc.) é sub-dividido em `Como responsável` e `Como colaborador` com sub-cabeçalhos colapsáveis independentes (state local `collapsedSub`); quando o filtro de papel está ativo, a separação some. (5) Novo `QuickCommentPopover` (`src/components/projetos/central/QuickCommentPopover.tsx`) renderizado em cada `ListRow`: ícone de balão à direita do prazo (oculto até hover quando count=0; sempre visível quando há comentários, com Badge contador). Popover (360px, align=end) com Textarea (até 1000 chars), atalhos Ctrl+Enter (envia) e Esc (fecha), contador `value.length/MAX_LEN`. Salva em `projeto_tarefa_messages` (RLS de membros via `user_can_access_projeto_via_tarefa` já existente, sem `mentions` para manter rapidez) e invalida `tarefa-message-counts` + `minha-tarefa-messages`. Toast `Comentário registrado` ao sucesso. (6) Novo hook `useTarefaMessageCounts(ids[])` (`src/hooks/useTarefaMessageCounts.ts`) faz uma única query agregada client-side (`select tarefa_id from projeto_tarefa_messages where tarefa_id in (...)`) e devolve `Record<id, count>`, evitando N queries. Re-fetch quando `filtered` muda. (7) `useCentralPreferences` ganha `show_role_overview` em DEFAULTS, em todos os SELECTs do PostgREST e no payload do `saveNow`; persistência debounced (800ms) integrada à mesma effect que já salva `show_weekly_summary`. Sem mudança de RLS de tarefas, sem nova rota, sem mudança de SDK/OpenAPI público. Invariante grep positivo: `grep -rn \"notify_tarefa_papel_change\\|task_role_change\\|RoleOverviewCard\\|QuickCommentPopover\\|useTarefaMessageCounts\\|show_role_overview\" src supabase/migrations | wc -l` ≥ 8.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.50", date: "2026-04-30", changes: [
                      "CENTRAL DE TRABALHO — CLAREZA SOBRE \"MINHAS TAREFAS\" (RESPONSÁVEL × COLABORADOR × DELEGADA) — Aba \"Tarefas\" renomeada para \"Minhas tarefas\" no `TabsTrigger` e no breadcrumb de `CentralTrabalho.tsx`. Novo filtro \"Meu papel\" em `MinhasTarefasContent.tsx` (Select com 3 opções: Todos / Sou responsável / Sou colaborador) sincronizado com URL via `?role=` (novo enum `VALID_ROLES`/`normalizeRole` em `centralUrlParams.ts`, sanitizer estendido na seção tarefas) e persistido em `user_central_preferences.default_role` (nova coluna `text NOT NULL DEFAULT 'all'`). Hook `useCentralPreferences` ganha `default_role` em DEFAULTS, em todos os SELECTs do PostgREST e no payload do `saveNow`; `centralSaveReason.ts` ganha causa `role_change` com label \"salvo após mudança do filtro de papel\". Badge \"Colaborando\" (ícone Users, tom info) renderizado no `ListRow` quando `papel === 'colaborador'` com tooltip explicando que outra pessoa é a responsável; tarefas onde o usuário é responsável ficam sem badge para evitar poluição visual. KPIs \"Para hoje\" (3 abas) e \"Pendentes\" (inbox) ganham subtitle dinâmico no formato \"X suas · Y colaborando\" via helper `roleSubtitle` quando há mistura de papéis (oculta a sub-linha quando todos do mesmo papel). Empty state da lista, quando o filtro `role=colaborador` estiver ativo, oferece atalho clicável para a aba `Delegadas`. Novo componente `PapelExplicativoBanner` (one-time, dispensa via flag `central:papel-banner-dismissed` em localStorage) renderizado no topo de `MinhasTarefasContent` esclarece os três papéis em uma única passagem. Sem mudança de RLS, sem mudança nos hooks de dados (`useMinhasTarefas` já trazia `papel` mas a UI não consumia), sem mudança de SDK/OpenAPI — apenas UI + uma coluna de preferência. Invariante grep positivo: `grep -rn \"normalizeRole\\|default_role\\|PapelExplicativoBanner\" src | wc -l` ≥ 4.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.49", date: "2026-04-30", changes: [
                      "ESTOQUE UNIFICADO — CORREÇÃO DO CÁLCULO DE UN EQUIVALENTE PARA SORTIMENTO HIERÁRQUICO — A função `refresh_estoque_unificado_cache()` calculava `fator_cx_para_un` e `fator_bx_para_un` como `MAX(fator_acumulado)` de uma única folha em `vw_bom_path`, retornando apenas o fator de uma sub-árvore. Para produtos com sortimento heterogêneo (ex: produto-raiz 3213 `CX BATOM VELVETY GLASS` com 8 mães distintas BG01..BG08, cada uma contendo 4 BX × 12 UN), o cache exibia `fator_cx_para_un = 48` quando o correto é `384` (8 × 4 × 12). Reescrita: `fator_cx_para_un = SUM(fator_un)` sobre todas as folhas UN distintas (`nivel = 3`) sob a raiz, usando CTE `folhas_un` com `DISTINCT ON (raiz_cod, folha_cod) ... ORDER BY profundidade DESC` para garantir um único caminho por folha. `fator_bx_para_un = SUM(fator_un) / COUNT(DISTINCT mae_cod)` (média ponderada por mãe = UN equivalente médio por display). `saldo_total_em_unidades` também passou a usar a mesma CTE para evitar dupla contagem em folhas com múltiplos caminhos. Cache recalculado retroativamente via `SELECT refresh_estoque_unificado_cache()` na própria migration (3.267 linhas). Validação produto 3213: `fator_cx_para_un` agora `384`, `fator_bx_para_un` `48`, `saldo_total_em_unidades` para empresa 6 corrigido de 465.863 para 461.108 UN (eliminação de duplicatas). Sem alteração de schema, hooks, tipos ou UI — somente a função SQL e o cache materializado. Invariante grep positivo: `grep -n \"folhas_un\\|SUM(fu.fator_un)\" supabase/migrations | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.48", date: "2026-04-30", changes: [
                      "PROJETOS — TELAS DE GESTÃO DE PRODUTIVIDADE — Nova rota `/dashboard/projetos/:id/produtividade` (`ProdutividadeProjeto.tsx`) com 4 KPIs (horas totais, custo de pessoas calculado via `horas × custo_hora_snapshot`, custo de tecnologia rateado de `vw_projeto_rateio_tecnologia`, total investido), 2 gráficos Recharts cruzando `vw_projeto_produtividade` × `vw_projeto_rateio_tecnologia` (BarChart de horas por mês e LineChart de custos pessoas vs tecnologia), tabela com os 50 últimos lançamentos exibindo origem (manual/IA/import) e mini-painel reutilizável `ProjetoHorasMiniPanel` para registrar horas no nível do projeto. Novo `BackfillIADialog` (`src/components/projetos/BackfillIADialog.tsx`) consome a edge function `projeto-estimar-horas-historico` (Lovable AI / `google/gemini-2.5-flash`), exibe lista de tarefas concluídas sem horas com checkbox + input editável de horas + justificativa da IA, e ao aprovar lança em massa em `projeto_horas_lancamentos` com `origem='ia_backfill'` e `data` herdada de `data_conclusao`/`data_inicio` da tarefa. Nova rota admin `/dashboard/admin/projetos-custos-tecnologia` (`CustosTecnologia.tsx`) com formulário de upsert (PK `mes+fornecedor`) para Lovable/OpenAI/Supabase/etc., totalizadores e tabela de lançamentos. Botão `BarChart3` adicionado na hero do `ProjetoHeader` para acesso rápido. Sem mudança de schema, sem mudança de SDK/OpenAPI. Invariante grep positivo: `grep -rn \"projetos/:id/produtividade\\|projetos-custos-tecnologia\" src/App.tsx | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.47", date: "2026-04-30", changes: [
                      "PROJETOS — CHAT COM RESUMO DIÁRIO AUTOMÁTICO + TRACKING DE HORAS/CUSTOS — Nova aba `Chat` em cada projeto (`ProjetoChatTab`, persistido em `projeto_chat_messages` com RLS por `user_can_access_projeto`, realtime habilitado) onde membros conversam livremente e o sistema posta automaticamente um resumo markdown diário às 22h UTC (19h BRT) via cron `pg_cron` `projeto-resumo-diario` chamando edge function homônima. O resumo agrega tarefas concluídas no dia (responsavel_id × COUNT), horas registradas (`projeto_horas_lancamentos.horas`) e custo de pessoas (horas × snapshot custo_hora) por colaborador, somado ao custo de tecnologia rateado do mês (`vw_projeto_rateio_tecnologia` divide o custo mensal de Lovable/OpenAI/Supabase entre projetos proporcional às horas). Botão `Resumir hoje` no header do chat permite forçar regeneração imediata. Tracking de horas: nova tabela `projeto_horas_lancamentos` (tarefa_id opcional, horas 0,25-24, descrição, origem manual/ia_backfill/importacao) com trigger `trg_set_custo_hora_snapshot` que congela o custo-hora vigente do usuário no momento do lançamento, lendo de `projeto_custo_hora_pessoa` (tabela com vigência histórica, admin-only). Custos de tecnologia em `projeto_custos_tecnologia_mensal` (UNIQUE(mes, fornecedor), admin-only via `has_role`). Edge function `projeto-estimar-horas-historico` usa Lovable AI (`google/gemini-2.5-flash` + tool calling estruturado `registrar_estimativas`) para estimar retroativamente horas das tarefas concluídas que ainda não têm lançamento, usado para backfill da produtividade desde o início do projeto. Componente `ProjetoHorasMiniPanel` reutilizável por tarefa ou projeto inteiro com botão `+ Registrar` e listagem inline. Compartilhamento por convite reaproveita 100% o `ProjetoMembrosDialog` + `projeto_convites` + `ConvidarMembroPanel` já existentes (sem código novo). Sem mudança de SDK/OpenAPI. Invariante grep positivo: `grep -n \"projeto_chat_messages\\|projeto_horas_lancamentos\" supabase/migrations | wc -l` ≥ 2.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.46", date: "2026-04-30", changes: [
                      "ESTOQUE UNIFICADO — MATERIALIZAÇÃO DO CACHE (CORREÇÃO DE TIMEOUT) — A `vw_estoque_unificado` levava ~7,9s para retornar 50 linhas (medido via EXPLAIN ANALYZE: Nested Loop Left Join contra `fabrica_produtos` com 88.296 linhas removidas pelo filtro + CTE recursiva `vw_bom_path` reavaliada 9.878 vezes para popular `fator_cx_para_un`/`fator_bx_para_un`). Combinado com `count: 'exact'` no PostgREST (que executa a query duas vezes), a requisição estourava o timeout do gateway HTTP e a tabela do `/dashboard/estoque/unificado` ficava presa em `Carregando…` sem mensagem de erro. Solução: nova tabela `estoque_unificado_cache` (PK composta `(empresa, produto_raiz)`, índices em `empresa`, `saldo_total_em_unidades DESC NULLS LAST` e `custo_total DESC NULLS LAST`, RLS SELECT para `authenticated`) materializa todos os agregados — saldo em CX/BX/UN, equivalente em UN, custo total, SKUs envolvidos, fatores de conversão e EAN raiz. Função `refresh_estoque_unificado_cache()` (SECURITY DEFINER, search_path=public) faz TRUNCATE + INSERT a partir da query original em uma única passada e foi encadeada no final de `recalcular_estoque_niveis()` — assim o botão `Recalcular níveis` da página e o cron de sincronia ERP já alimentam o cache automaticamente. View `vw_estoque_unificado` foi recriada como SELECT trivial sobre o cache (`security_invoker = on`), preservando o contrato com `useEstoqueUnificado` e `DriftErpKpi` sem precisar regenerar tipos. Hook `useEstoqueUnificado` trocou `count: 'exact'` por `count: 'estimated'` (cache é pequeno e a contagem exata não é crítica para paginação) e ganhou log de erro no console; `EstoqueUnificadoPage` agora dispara `toast.error()` quando a query falha em vez de ficar em loading infinito. Resultado pós-correção: leitura < 200ms, 3267 produtos-raiz cacheados na primeira execução. Sem mudança de schema dos dados-fonte (BOM, ERP, níveis), sem novas RPCs públicas, sem mudança de SDK/OpenAPI. Invariante grep positivo: `grep -rn \"estoque_unificado_cache\" supabase/migrations | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.45", date: "2026-04-30", changes: [
                      "ESTOQUE UNIFICADO — MODO DE EXIBIÇÃO POR UNIDADE — Novo ToggleGroup (Físico/CX/BX/UN) na rota `/dashboard/estoque/unificado` que reapresenta tabela e KPIs convertidos para a unidade escolhida. View `vw_estoque_unificado` recriada (security_invoker) com 3 colunas adicionais: `fator_cx_para_un` (max(fator_acumulado) entre raiz nivel 1 e folhas nivel 3 em `vw_bom_path`), `fator_bx_para_un` (idem mas restrito a caminhos que passam por algum nivel 2) e `ean_raiz` (LEFT JOIN em `fabrica_produtos.codigo_barras_ean` por `codigo = produto_raiz::text`). Frontend: novo helper `src/lib/estoque/modoExibicao.ts` (`converterParaModo` = saldo_total_em_unidades / fator), tabela com colunas dinâmicas (CX/BX/UN colapsam em `Total em CX|BX|UN` quando o modo é não-físico) + nova coluna `EAN raiz` com ícone Barcode, KPIs adaptativos por modo (somatório convertido + contador de produtos sem fator). Quando o produto não tem fator de conversão, exibe `—` em CX/BX e mantém o valor em UN. Modo padrão = Físico (3 colunas atuais preservadas). Conversão é apenas de exibição — não altera saldos no ERP nem cria movimentos. Sem mudança de SDK/OpenAPI. Invariante grep positivo: `grep -n \"fator_cx_para_un\" src/lib/estoque/modoExibicao.ts` ≥ 1 ocorrência.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.44", date: "2026-04-30", changes: [
                      "ESTOQUE UNIFICADO — CORREÇÃO TABELA VAZIA E DRIFT FALSO-POSITIVO — Duas views recriadas para resolver regressões na rota `/dashboard/estoque/unificado`. (a) `vw_estoque_unificado`: o `SUM(saldo_total * COALESCE(...))` que calcula a equivalência em unidades agora é envolvido em `COALESCE(..., 0)`, garantindo que `saldo_total_em_unidades` nunca seja NULL. Antes, produtos sem fator BOM acumulado retornavam NULL nessa coluna, e o filtro default da UI (`somenteComSaldo=true` → `.gt('saldo_total_em_unidades', 0)` no PostgREST) exclui NULLs, deixando a tabela `Nenhum produto encontrado` mesmo com saldo físico. Pós-correção: 2.264 produtos-raiz visíveis (de 3.267 totais). (b) `vw_drift_erp_unificado`: reescrita com CTEs `internos` (SUM de `estoque_lote_interno`) e `erp` (SUM de `erp_estoque_distribuidora`), agora usando `internos LEFT JOIN erp USING (empresa, cod_produto)` em vez do FULL OUTER JOIN original. Só reporta divergência para SKUs que já passaram por desmontagem/remontagem (têm linha em `estoque_lote_interno`). Antes, com a tabela de lotes internos vazia, o FULL OUTER expunha todos os 200 SKUs do ERP como drift -100%, alimentando o KPI `Drift vs ERP · pior: 100.0%` no header. Pós-correção: 0 linhas de drift até a primeira transformação real. `security_invoker = true` e `GRANT SELECT TO authenticated` preservados em ambas. Sem mudança de schema, sem novas RPCs, sem mudança de SDK/OpenAPI. Invariante grep positivo: `grep -n \"COALESCE(SUM(saldo_total \\* COALESCE\" supabase/migrations` ≥ 1 ocorrência.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.43", date: "2026-04-30", changes: [
                      "ESTOQUE UNIFICADO — AUDITORIA DE DRIFT — Novo componente `DriftErpKpi` (`src/components/estoque/unificado/DriftErpKpi.tsx`) adicionado ao header da rota `/dashboard/estoque/unificado` consumindo `useDriftErp` (consulta a view `vw_drift_erp_unificado` filtrando drift≠0, top 200 por drift_pct DESC) com dois estados visuais — sincronizado (ícone ShieldCheck) e atenção (AlertTriangle com badge do pior drift_pct) — e link rápido para a auditoria. Nova página `EstoqueAuditoriaDriftPage` (`/dashboard/estoque/auditoria-drift`) com filtros por empresa, busca por código/nome, KPIs (SKUs com drift, drift absoluto em unidades, sobras = interno > ERP, faltas = interno < ERP) e tabela detalhada com saldo interno × ERP, drift assinado (verde para sobra, âmbar para falta), drift_pct com 2 casas e badge de status. Rota registrada em App.tsx (lazyWithRetry sob `ModuleRoute moduleCode='estoque'`) e item `Auditoria Drift vs ERP` adicionado ao menu Estoque na `AppSidebar`. Sem mudança de schema, sem novas RPCs, sem mudança de SDK/OpenAPI. Invariante grep positivo: `grep -n \"vw_drift_erp_unificado\" src/hooks/estoque/useEstoqueMovimentos.ts` ≥ 1 ocorrência.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.42", date: "2026-04-30", changes: [
                      "ESTOQUE UNIFICADO — FASE 3 (RASTREABILIDADE E DRIFT) — Novas tabelas `estoque_lote_interno` (saldo lógico por empresa+produto+lote_origem com índice único expression-based em COALESCE(lote_origem,'') para tolerar nulos) e `estoque_movimento` (histórico append-only com tipo CHECK em desmontagem/remontagem/ajuste/sync_erp, fator_bom, lote_origem, raiz_cod, unidades_equivalentes, executado_por). Duas RPCs SECURITY DEFINER com REVOKE de public/anon e GRANT a authenticated: `executar_desmontagem(p_empresa,p_pai_cod,p_quantidade,p_motivo,p_lote_origem)` valida BOM ativa, faz seed do saldo a partir de `erp_estoque_distribuidora` quando o lote interno está vazio, decrementa o pai e itera filhos da `bom_edges` ativos incrementando pelo fator e gravando um movimento por filho; `executar_remontagem(p_empresa,p_pai_cod,p_quantidade,p_motivo)` pré-valida disponibilidade de TODOS os componentes (rejeita sem mexer em estado), consome FIFO por updated_at via subquery LIMIT 1 e cria saldo do pai. View `vw_drift_erp_unificado` (security_invoker) faz FULL OUTER JOIN entre estoque interno e ERP, expondo drift absoluto e drift_pct. Frontend: `TransformacaoWizard` (modal com radio Desmontar/Remontar, qtd numérica, lote opcional só em desmontagem, motivo) acionado por botão `Transformar` no `EstoqueUnificadoDrawer`, que agora também lista as últimas 30 movimentações do produto-raiz com pai→filho, qtd × fator = resultado e timestamp em America/Sao_Paulo. Hooks `useEstoqueMovimentos` (lista por empresa+pai), `useDriftErp` (somente drift≠0, top 200 ordenado por drift_pct DESC) e `useExecutarTransformacao` (chama RPC e invalida queries unificado/movimentos/drift/capacidade). Sem mudança de SDK/OpenAPI. Invariante grep positivo: `grep -rn \"executar_desmontagem\\|executar_remontagem\" supabase/migrations | wc -l` ≥ 1.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.37", date: "2026-04-28", changes: [
                      "INFLUENCIADORES — BUSCA REAL VIA APIFY (INSTAGRAM/TIKTOK) — Nova edge function `apify-influencer-search` integra a Apify Platform via `run-sync-get-dataset-items` para retornar perfis REAIS em vez de depender só de IA generativa. Actors usados: `apify/instagram-hashtag-scraper` (busca por hashtag retornando posts), `apify/instagram-profile-scraper` (enriquece perfis com followers/avatar/bio/ER) e `clockworks/tiktok-scraper` (perfis e hashtags TikTok). Lógica por tipo de query: `@usuario` chama profile-scraper direto com `usernames:[term]`; `#hashtag` chama hashtag-scraper, agrupa owners únicos, ranqueia por engajamento (likesCount) e enriquece os top N (default 12) via profile-scraper; termo livre é tratado como hashtag (espaços removidos). `discover-influencers` ganha Layer 0 (Apify primeiro) e Gemini 2.5 Pro grounded + GPT-5.2 viram fallback apenas quando Apify retorna vazio. `source` por item preservado (`apify_instagram`, `apify_tiktok`, `apify_hashtag`) para auditoria de origem. Engagement rate calculado server-side: `((avg_likes + avg_comments) / followers) * 100`. Dedupe por `${platform}:${username.toLowerCase()}`. Timeout sync de 60-90s por actor. Requer secret `APIFY_API_TOKEN`. Resolve casos de busca por criadores famosos (ex: #luluca) que a IA generativa não localizava. APP_VERSION 3.4.36 → 3.4.37 (minor — nova fonte de dados; SDK/OpenAPI inalterados). Invariante grep positivo: `grep -n \"apify-influencer-search\" supabase/functions/discover-influencers/index.ts` deve retornar ≥1 ocorrência.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.36", date: "2026-04-28", changes: [
                      "INFLUENCIADORES — AUTOPILOT/CONTEÚDO IA COMPARTILHADOS — Edge functions `influencer-autopilot` (actions `calculate_scores`, `analyze_opportunities`, `auto_monitor`, `discover_new`, `analyze_audience`, `refresh_all_data`) e `influencer-content-intelligence` (action `analyze_patterns`) ainda filtravam `.eq(\"user_id\", user.id)` em todas as leituras de `influencers` e `influencer_suggestions`, quebrando os botões `Atualizar Análise` (Oportunidades IA), `Recalcular Ranking`, `Atualizar Dados` e `Analisar Conteúdo dos Influenciadores` para qualquer membro da equipe Marketing que não fosse o owner original (HTTP 400 \"Nenhum influenciador cadastrado\"). 5 queries afetadas: load principal de `influencers`, lookup de `existingSuggestions` em `discover_new`, lookup de `inf` em `analyze_audience`, refetch para recálculo de score em `refresh_all_data`, load de `influencers` em `analyze_patterns`. `user_id` removido em todas — visibilidade depende exclusivamente das RLS `Marketing team can view all *` (PR-66). Filtros em `influencer_company_profile` (configuração pessoal) preservados intencionalmente. Escritas (INSERT/UPDATE) inalteradas. Sem mudança de schema. APP_VERSION 3.4.35 → 3.4.36 (patch — bugfix; SDK/OpenAPI/backend público inalterados). Invariante grep negativo: `grep -n \"\\.eq(\\\"user_id\\\", user\\.id)\" supabase/functions/influencer-autopilot/index.ts supabase/functions/influencer-content-intelligence/index.ts | grep -v company_profile` deve retornar 0 ocorrências.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.35", date: "2026-04-28", changes: [
                      "INFLUENCIADORES — RECOMENDAÇÃO POR IA REFATORADA — `analysis_type='recommendation'` na edge function `analyze-influencer` deixa de exigir `influencer_id` no body. Antes: o frontend (`InfluencerRecommendation.tsx`) precisava buscar 1 ID dummy de `influencers` e enviar como alvo, e a edge function fazia `.single()` em cima desse ID — qualquer falha (RLS, registro removido, race) virava 404 e quebrava o modal `Recomendar para minha marca`. Agora: o frontend só envia `analysis_type` + `brand_context`; a edge function detecta `isRecommendation`, pula o lookup do influencer alvo, pula o carregamento de posts/comments e pula o INSERT em `influencer_analyses` (que tem `influencer_id NOT NULL`). Comparação cross-influencer continua íntegra (lista TODOS os ativos via RLS de equipe Marketing) e o ranking é retornado direto ao cliente sem persistência. Erros do gateway propagados via `error.context.body` para toasts mais claros. Sem mudança de schema, sem alteração em outros analysis_types. APP_VERSION 3.4.34 → 3.4.35 (patch — bugfix; SDK/OpenAPI/backend público inalterados). Invariante grep negativo: `grep -n \"influencer_id: influencers\\[0\\]\\.id\" src/components/marketing/influencers/InfluencerRecommendation.tsx` deve retornar 0 ocorrências (workaround dummy removido).",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.34", date: "2026-04-28", changes: [
                      "INFLUENCIADORES — RECOMENDAÇÃO POR IA CORRIGIDA — Modal `Recomendar para minha marca` (`InfluencerRecommendation.tsx`) voltou a funcionar após v3.4.32 (compartilhamento de equipe). Edge function `analyze-influencer` ainda restringia leitura por `.eq(\"user_id\", user.id)` em duas queries: (a) lookup do influencer alvo (sempre 404 quando o registro pertencia a outro membro da equipe Marketing); (b) listagem para `analysis_type='recommendation'` (só comparava influencers do próprio usuário). Removido o filtro `user_id` em ambas as queries — visibilidade passa a ser controlada exclusivamente pelas RLS policies `Marketing team can view all *` introduzidas em PR-66. Lookup migrou de `.single()` para `.maybeSingle()` (degradação clara em vez de exception). Sem mudança de schema, sem alteração em escritas (que continuam sob owner-only). APP_VERSION 3.4.33 → 3.4.34 (patch — bugfix; SDK/OpenAPI/backend público inalterados). Invariante grep negativo: `grep -n \"\\.eq(\\\"user_id\\\", user\\.id)\" supabase/functions/analyze-influencer/index.ts` deve retornar 0 ocorrências.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.33", date: "2026-04-28", changes: [
                      "DESCOBRIR INFLUENCIADORES — GROUNDED SEARCH — Função `discover-influencers` reescrita para resolver buscas que retornavam vazio (ex.: `#luluca` não era encontrada). Camada 1: `google/gemini-2.5-pro` com `tools=[{type:'google_search'}]` para busca web REAL em tempo real (antes: `openai/gpt-5.2` sem grounding, que apenas alucinava perfis a partir do conhecimento de treinamento). Camada 2: fallback automático para `openai/gpt-5.2` quando o Gemini falha. Prompt do sistema reforça uso obrigatório de `google_search` e adiciona heurísticas específicas para queries iniciadas em `#` (busca site:instagram.com/explore/tags + tracker tipo Social Blade) e em `@` (lookup direto multi-plataforma). Tratamento de erros do gateway (HTTP 429/402) propagado ao cliente como `rate_limit`/`credits_exhausted`. Resposta agora inclui `meta.source` (`gemini_grounded` | `gpt5_fallback`) por resultado. Frontend (`InfluencerDiscovery.tsx`): tipo `DiscoveredInfluencer` ganha campo opcional `source`; cards exibem rodapé `Fonte: Busca web (Google)` para transparência; mensagem de loading mais explícita (10–20s); novos códigos de erro tratados em toasts; mensagem de vazio orienta usuário a tentar sem `#`/`@` ou trocar plataforma. APP_VERSION 3.4.32 → 3.4.33 (patch — qualidade de descoberta; SDK/OpenAPI/backend público inalterados). Invariante grep positivo: `grep -n \"google_search\" supabase/functions/discover-influencers/index.ts` ≥1 ocorrência. Invariante grep negativo: `grep -n \"phyllo_not_configured\" src/components/marketing/influencers/InfluencerDiscovery.tsx` deve retornar 0 ocorrências (código antigo removido).",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.32", date: "2026-04-28", changes: [
                      "INFLUENCIADORES MULTIUSUÁRIO — Módulo Marketing/Influenciadores deixa de ser pessoal e passa a ser compartilhado por equipe. Backend: nova função `public.has_marketing_social_access(uuid)` (SECURITY DEFINER, STABLE, search_path=public) faz semi-join em `usuario_permissoes_telas`/`telas_sistema` (codigo='marketing_social') e respeita admin via `has_role`. 9 novas RLS SELECT policies `Marketing team can view all *` adicionadas em `influencers`, `influencer_suggestions`, `influencer_opportunities`, `influencer_company_profile`, `influencer_analyses`, `influencer_posts`, `influencer_comments`, `influencer_campaigns` e `influencer_income`. Escritas (INSERT/UPDATE/DELETE) intactas — apenas leitura passa a ser de equipe. Frontend: `InfluencerDashboard.loadInfluencers()`, `AutopilotMiningPanel` e `InfluencerSuggestionsPanel` removem `.eq('user_id', user.id)` das queries de leitura, delegando visibilidade à RLS. `PainelDialog` muda default de `compartilhado` de false→true e copy passa a explicitar caráter colaborativo. APP_VERSION 3.4.31 → 3.4.32 (patch — habilitação de equipe; SDK/OpenAPI/backend público inalterados). Invariante grep positivo: `grep -rn \"has_marketing_social_access\" supabase/migrations` ≥1 ocorrência. Invariante grep negativo: `grep -n \"\\.eq(\\\"user_id\\\", user\\.id)\" src/components/marketing/influencers/InfluencerDashboard.tsx src/components/marketing/influencers/InfluencerSuggestionsPanel.tsx` deve retornar 0 ocorrências (RLS-only enforced).",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.31", date: "2026-04-28", changes: [
                      "PWA LOGIN AUTO-UPDATE — Apps instalados passam a atualizar automaticamente no login para evitar retorno a bundles antigos. Frontend: LoginForm executa verificação de atualização do PWA, limpa Cache Storage, desregistra Service Workers antigos e navega com cache-buster para `/dashboard` ou `/portal/precos` conforme o perfil. PWAContext aplica novo Service Worker automaticamente ao detectar versão disponível. Configuração PWA migra registerType de `prompt` para `autoUpdate` e desativa Service Worker em desenvolvimento para evitar cache stale no preview. APP_VERSION 3.4.30 → 3.4.31 (patch — controle de versão/PWA; SDK/OpenAPI/backend inalterados). Invariante grep positivo: `grep -n \"forceCleanNavigate\" src/components/auth/LoginForm.tsx src/lib/version.ts` ≥2 ocorrências.",
                    ] },
                    { version: "v4.4.4 / SDK v3.3.1 / APP v3.4.30", date: "2026-04-27", changes: [
                      "VENDAS SYNC PIPELINE — Novo módulo de sincronização Vendas/Faturamento (somente consulta), espelhando o padrão das engines de Contas a Pagar e Contas a Receber. Backend: 3 rotas adicionadas em supabase/functions/erp-sync-engine/index.ts — `sync-vendas-full` (orquestra por empresa, cutoff 2025-01-01), `sync-vendas-incremental` (janela deslizante de 2 dias) e `sync-vendas-por-empresa`. Tabela public.\"Union\" recebeu colunas `erp_id` (UNIQUE, formato `${id_empresa}-${nota}-${pedido}-${cod_produto}`) e `sincronizado_em` (timestamptz) com backfill de registros legados — upsert com ON CONFLICT (erp_id) garante idempotência. View `vendas_union` atualizada para expor as novas colunas. Frontend: novo hook `useVendasSync` (read-only, sem mutations no contas-a-receber/contas-a-pagar pattern), painel `VendasSyncPanel` (KPIs Total/Mês/Receita + controles full/incremental) e página `VendasSyncPage` (tabs Engine/Métricas/Monitor). Roteamento: `/dashboard/financeiro/vendas/sync` (admin only via ScreenRoute screenCode='admin') e item de menu adicionado em Governança Financeira na sidebar. Agendamento: pg_cron job `sync-vendas-incremental-diario` cadastrado para rodar diariamente às 06:15 disparando POST em /functions/v1/erp-sync-engine com path=sync-vendas-incremental. APP_VERSION 3.4.29 → 3.4.30 (minor — novo módulo de sincronização; SDK/OpenAPI inalterados, sem endpoints REST públicos novos). Invariante grep positivo: `grep -n \"sync-vendas-incremental\" supabase/functions/erp-sync-engine/index.ts` ≥1 ocorrência. Invariante grep negativo: `grep -rn \"useVendasMutations\\|insert.*Union.*venda\" src/hooks src/pages/financeiro/VendasSyncPage.tsx` deve retornar 0 ocorrências (read-only enforced).",
                    ] },
                    { version: "v4.4.3 / SDK v3.3.1 / APP v3.2.4", date: "2026-04-23", changes: [
                      "STATUS DERIVADO (UI) — Listagem e filtro de Contas a Pagar passam a usar `calculateFinancialStatus(data_vencimento, data_pagamento, status)` (já canônico nos KPIs e no Calendário). Antes: tabela em src/components/financeiro/ContasPagarTabContent.tsx:475 e filtro em src/pages/ContasAPagar.tsx:433-436 liam o status cru do banco — mas o backend só persiste 'pendente'/'pago'/'cancelado'; 'vencido' é derivado em runtime. Sintoma: títulos com data_vencimento no passado e sem data_pagamento apareciam como badge 'Pendente' (âmbar) em vez de 'Vencido' (vermelho), e selecionar 'Vencido' no filtro retornava lista vazia. Correção: badge da coluna Status, cor da coluna Vencimento (vermelho quando calc==='vencido') e filtro principal agora delegam ao helper. APP_VERSION 3.2.3 → 3.2.4 (patch — UI alignment; sem mudanças em SDK/OpenAPI/backend). Invariante grep positivo: `grep -n \"calculateFinancialStatus(c.data_vencimento\" src/components/financeiro/ContasPagarTabContent.tsx` ≥1 ocorrência. Invariante grep negativo: `grep -n \"(c.status || '').toLowerCase() === status\" src/pages/ContasAPagar.tsx` deve retornar 0 ocorrências.",
                    ] },
                    { version: "v4.4.3 / SDK v3.3.1 / APP v3.2.3", date: "2026-04-23", changes: [
                      "PAGINATION HOTFIX — handleQuery (supabase/functions/_shared/contas-pagar/crud-handlers.ts) tinha cursor por id UUID inconsistente com order_by=data_vencimento. Pior: nextCursor só era emitido quando a request já trazia cursor, então a 1ª página nunca devolvia cursor e o loop client-side encerrava após 1.000 linhas. Sintoma em produção: Calendário de Vencimentos mostrava títulos só em ~1 mês do ano (top da ordenação) — meses restantes em branco apesar de existirem 6.468 títulos em 2026. Correção: (1) Backend — branch `if (p.cursor) { gt('id', cursor).order('id') }` removido; agora paginação é sempre `range(offset, offset + limit - 1)` com `order(p.order_by, p.order_dir)` estável. `pagination.has_more = (count || 0) > (offset + limit)` — critério único e correto. Campo `pagination.cursor` mantido no payload mas sempre `null` (compat). (2) Frontend — `fetchAllViaApi` em src/pages/ContasAPagar.tsx migra para offset incremental (`offset += PAGE` enquanto `has_more === true || batch.length === PAGE`); leitura de cursor removida; safety limit de 200 páginas mantido (cobre 200k linhas). Console.debug do total acumulado para diagnóstico futuro. APP_VERSION 3.2.2 → 3.2.3 (patch — bugfix de paginação backend+consumer; runtime/SDK/OpenAPI inalterados, contrato de resposta preservado). Invariante grep negativo: `grep -n \"p.cursor\" supabase/functions/_shared/contas-pagar/crud-handlers.ts` deve retornar 0 ocorrências.",
                    ] },
                    { version: "v4.4.2 / SDK v3.3.1 / APP v3.2.2", date: "2026-04-23", changes: [
                      "PR-7 CONSUMER HOTFIX — Painel Central AP (src/pages/financeiro/PainelCentralAP.tsx) e Conciliação Manual AP (src/pages/financeiro/ConciliacaoManualAP.tsx) ainda chamavam 3 endpoints removidos no PR-7 (404 em runtime → tela exibia 'Erro ao carregar títulos'). Migrações: (1) /listar → /query: parâmetros pagina/registros_por_pagina trocados por limit/offset; filtrar_por_status → status; filtrar_por_data_de/_ate → vencimento_de/vencimento_ate; filtrar_por_emissao_de/_ate → emissao_de/emissao_ate; filtrar_cliente → fornecedor_codigo (ativado apenas quando o input é código exato — /query não tem busca textual); resposta lida via data/meta.total (rawList unwrap canônico, com fallback para conta_pagar_cadastro/total_de_registros). Filtros de categoria e departamento aplicados client-side (server-side ainda não exposto em /query). (2) /registrar-pagamento → /lancar-pagamento: body migrado para LancarPagamentoInput (codigo_lancamento, valor, data, forma_pagamento enum minúsculo via mapper toFormaPagamentoEnum, codigo_conta_corrente). Aplicado em PainelCentralAP.payMutation e em ConciliacaoManualAP.confirmMutation/vincularMutation. (3) /cancelar-pagamento → /estornar: cancelPaymentMutation no Sheet de Pagamentos agora chama /estornar com motivo padrão auditável e enfileira ERP com operacao='estorno'. RelatorioAPxERP.tsx: matriz documental enxuta — entries /listar, /alterar, /registrar-pagamento, /cancelar-pagamento removidas (alinhada com SDK 3.3.1 / OpenAPI 4.4.1). api-helpers.ts: /listar removido do METHOD_MAP — qualquer chamada residual a /listar agora cai no default POST e quebra explicitamente no code review. Invariante grep negativo: grep -rn '/registrar-pagamento\\|/cancelar-pagamento\\|path: \"/listar\"' src/ deve retornar 0 ocorrências fora deste changelog. APP_VERSION 3.2.1 → 3.2.2 (patch — bugfix de consumer interno; runtime/SDK/OpenAPI inalterados).",
                    ] },
                    { version: "v4.4.1 / SDK v3.3.1 / APP v3.2.1", date: "2026-04-20", changes: [
                      "PR-24 — PRODUCTION HARDENING. Auditoria pós-PR-23 identificou 9 gaps reais (segurança, performance, consistência) entre as 19 rotas CP. Correções: (1) SEGURANÇA CRÍTICA: contas-pagar-api/index.ts e contas-pagar-export-api/index.ts agora envoltos em secureHandler (WAF L7 wafCheck, IP blocklist via securityCheck, security headers withSecurityHeaders aplicados em todas as respostas — antes faltavam CSP/HSTS/X-Frame). RLS de pagamentos: política authenticated_select_pagamentos antes permitia using=true (qualquer usuário lia pagamentos de qualquer empresa); agora usa semi-join EXISTS contra contas_pagar.empresa_id ∈ user_empresas[auth.uid()] OR has_financial_role — fecha vazamento cross-tenant LGPD. (2) PERFORMANCE: handleUpsertLote refatorado de N+1 (até 2000 queries por chamada de 500 itens) para batch — 2 IN-queries de validação (fornecedor/categoria) + 1 .upsert PostgREST com onConflict='erp_id'. Latência esperada cai de ~10s para <2s em lote de 500. (3) CONSISTÊNCIA: idempotência DUPLA eliminada — checkIdempotency/saveIdempotency removidos dos handlers (incluir/upsert/lancar-pagamento); centralizada apenas no withIdempotency do router (CP_IDEMPOTENT_ROUTES). handleGetRoot delega para handleQuery (paginação + meta_relacionados consistentes — antes retornava 100 itens sem filtro de empresa). (4) WEBHOOKS: handleEstornar agora enfileira evento conta_pagar.estornado (paridade com cancelar). (5) DX: meta_relacionados (empresa/fornecedor/categoria/departamento) adicionado em GET /parcelas e GET /anexos — antes só IDs. 8 invariantes novos em audit/regression-greps.sh garantem que secureHandler e webhook estorno não regridam, idempotência permaneça centralizada, RLS continue restrita por empresa, batch upsert sobreviva, e meta_relacionados continue presente nos endpoints filhos. Bumps: SDK_VERSION 3.3.0→3.3.1 (patch — sem mudança de interface), OpenAPI 4.4.0→4.4.1, APP_VERSION 3.2.0→3.2.1.",
                    ] },
                    { version: "v4.4.0 / SDK v3.3.0 / APP v3.2.0", date: "2026-04-19", changes: [
                      "PR-23 — ENRIQUECIMENTO DE DADOS CP (auditoria cruzou 20 telas ERP × API). 4 bugs de gravação corrigidos (data_emissao, data_entrada, tipo_documento, codigo_tipo_documento, numero_pedido — antes silently dropped por validação Zod estrita) + 7 JOINs faltantes via novo bloco meta_relacionados (empresa, fornecedor, categoria, departamento, portador, projeto) em GET /consultar e GET /query. Pagamentos ganham forma_pagamento (enum: dinheiro|cheque|pix|boleto|cartao|transferencia|API) + codigo_pix; GET /pagamentos faz JOIN com contas_bancarias e profiles (usuario_nome). RPC process_payment_atomic atualizada com 13 parâmetros (defaults retro-compatíveis). 5 camadas alinhadas: Banco ↔ Edge Function ↔ OpenAPI 4.4.0 ↔ SDK 3.3.0 (TS/JS/PY) ↔ regression (33 invariantes novos).",
                    ] },
                    { version: "v4.3.2 / SDK v3.2.3 / APP v3.1.11", date: "2026-04-18", changes: [
                      "PR-19 — AUDITORIA DE SCHEMAS (3ª passada externa, 41 schemas cruzados com SDKs e TypedDicts). 6 itens resolvidos: (1) BUG REAL: campo events (EN) → eventos (PT) nas interfaces WebhookSubscribePayload/Response e métodos webhookIncluir dos 3 SDKs. Edge function só aceita 'eventos' — versões anteriores causavam 400 'Campos obrigatórios: ...eventos' em produção. (2) WebhookSubscribePayload ganha empresa_id, descricao, max_retries e headers_customizados (já aceitos pelo runtime, antes inacessíveis via SDK). (3) DEDUPLICAÇÃO operationId: GET+POST /anexos colidiam em cpAnexos (quebrava openapi-generator/orval). Generator agora pós-processa todos paths e aplica sufixo Listar/Incluir/Alterar/Excluir apenas em colisões — IDs únicos atuais permanecem intactos. (4) 30 operationIds em snake+camel normalizados para camelCase puro: moduleMap expandido (contas_pagar_export → cpExport, resumo_financeiro → resumoFinanceiro, erp_plano_contas → planoContas, erp_portadores → portadores, pesquisar_lancamentos → pesquisarLanc, movimentos_financeiros → movFin, tabela_de_titulos → tabelaTitulos, erp_webhook_callbacks → webhookCallbacks) + sanitização de underscores residuais + action 'root' substituída por verbo derivado do método (GET→Listar, POST→Criar). (5) ClienteInput trimmed (6 campos inalcançáveis via SDK removidos: endereco_numero, bairro, celular, observacao, pessoa_fisica, contribuinte). EmpresaInput expanded (codigo_erp, complemento, bairro, telefone1_ddd, telefone1_numero adicionados — SDK é fonte da verdade). 7 schemas órfãos removidos (FornecedorQuery, ContaCorrenteResponse, ClienteResumido, PaisResponse, CidadeResponse, BancoResponse, ExportPendingResponse, ExportConfirmInput — todos com 0 $refs). (6) Política 'required' em responses documentada no info.description. 6 invariantes novos em audit/regression-greps.sh.",
                    ] },
                    { version: "v4.3.1 / SDK v3.2.2 / APP v3.1.10", date: "2026-04-18", changes: [
                      "PR-18 — RESOLUÇÃO FINAL pré-produção (auditoria externa 2ª passada). 4 achados resolvidos: (1) ALIAS BACKEND /cancelar-lote: SDKs v3.2.1 chamam /contas-pagar-api/cancelar-lote mas o router só registrava /cancelar (404 em runtime — pior que o bug original do PR-17). Adicionado 'cancelar-lote:POST': handleCancelar como alias (handleCancelar já é batch-aware: aceita {ids,motivo}, devolve {success,cancelados,ids,bloqueados}). Também adicionado a CP_IDEMPOTENT_ROUTES. Zero mudança de SDK, zero risco. (2) OpenAPI documenta /cancelar-lote como alias batch-explícito de /cancelar. (3) OpenAPI documenta fornecedoresCheck (POST /erp-fornecedores-sync/check) e fornecedoresSync (POST /erp-fornecedores-sync/sync) — rotas reais que existiam em runtime mas faltavam na spec (changelog do PR-17 dizia '5 documentados', só 3 entraram). (4) TRAILING SLASH FIX: 7 raízes de módulo (/contas-correntes-api/, /erp-plano-contas-api/, etc.) geravam path com / final. Generator agora aplica ep.path === '/' ? api.basePath : ${'`'}${'$'}{api.basePath}${'$'}{ep.path}${'`'} — paths normalizados sem barra final. 4 invariantes novos em audit/regression-greps.sh.",
                    ] },
                    { version: "v4.3.0 / SDK v3.2.1 / APP v3.1.9", date: "2026-04-18", changes: [
                      "PR-17 — CORREÇÃO CRÍTICA + ALINHAMENTO OPENAPI. Auditoria externa identificou 1 bug de runtime no SDK TS, 3 endpoints CR órfãos (SDK chamava → 404) e 2 endpoints fornecedores não documentados. (1) BUG CRÍTICO TS: cpCancelarLote chamava /contas-pagar-api/cancelar (endpoint unitário) — corrigido para /cancelar-lote. JS e Python já estavam corretos. (2) PARIDADE PYTHON: cp_anexos_listar usava self._request direto — migrado para self._cp_dispatch (ganha ETag/304, retry opt-in, cache LRU como demais cp_*). (3) CR API ganha 3 handlers REAIS (antes retornavam 404): GET /query (cursor+offset, paridade com cpQuery), GET /parcelas (consulta parcelas_receber por conta_receber_id), GET /recebimentos (join parcelas_receber→recebimentos por parcela_receber_id). API_VERSION CR 1.3.0 → 1.4.0. (4) OpenAPI 4.2.0 → 4.3.0: 5 endpoints documentados (CR /query, /parcelas, /recebimentos + fornecedores-sync /check, /sync que já existiam no router mas faltavam na spec). 7 invariantes novos em audit/regression-greps.sh garantem que cpCancelarLote não regrida e que os 3 handlers CR continuem implementados. SDK_VERSION 3.2.1 (patch — bugfix + alinhamento documental).",
                    ] },
                    { version: "v4.2.0 / SDK v3.2.0 / APP v3.1.8", date: "2026-04-18", changes: [
                      "PR-16 — Padronização final pré-produção CP. SDK ganha 11 métodos novos (× 3 SDKs = 33 implementações): cpUpdate + 10 wrappers Export API (cpExportStatus/Pending/Paid/Cancelled/Batch/Confirm/History/Summary/Reconciliation/RetryFailed). Cobertura SDK do CP sobe de 19/19 para 30/30. Glossário SDK→banco no header. Quick Start passo 5 documenta fluxo Export. Smoke probes deixam de usar /listar (rota CP removida) — agora /cnae-api/listar.",
                    ] },
                    { version: "v4.0.1 / SDK v3.0.0 / APP v3.0.1", date: "2026-04-17", changes: [
                      "PR-7 DOCS PATCH — fechamento do ponto cego documental do PR-7. Auditoria pós-remoção identificou 6 pontos de informação descasada onde docs descritivos ainda apontavam para os 7 endpoints removidos (404 garantido para integrador novo). Corrigidos: (1) ApiDocumentation.tsx tabela 'Quando usar cada método' — removidas 3 linhas que recomendavam cpListar/crListar e cpRegistrarPagamento como métodos ATIVOS; substituídas por 'Listagem unificada (UI + ETL, com cursor)' apontando para cpQuery/crQuery, e 'Estorno auditável de baixa' apontando para cpEstornar/crEstornar. (2) ApiDocumentation.tsx tabela de autenticação — exemplo cURL passa de /contas-pagar-api/listar para /contas-pagar-api/query?limit=10. (3) docs/API_CONTAS_PAGAR.md reescrito v2.4.0 → v4.0.0: Quick Start aponta para /query, tabela 'Quando usar' enxuta (5 métodos canônicos), tabela Idempotência sem /registrar-pagamento, blocos PUT /alterar + POST /cancelar-pagamento + GET /listar + POST /registrar-pagamento DELETADOS, mapa de rotas atualizado. (4) docs/API_CONTAS_RECEBER.md reescrito sem header → v4.0.0: blocos PUT /alterar + POST /cancelar-recebimento + GET /listar DELETADOS, /query documentado como substituto unificado, mapa de rotas limpo. (5) docs/MANUAL_NOVAS_TELAS_AP.md linha 217 — instrução interna de salvar via /alterar trocada por /upsert (semântica equivalente, idempotente). (6) audit/regression-greps.sh — 6 invariantes negativos novos para arquivos MD garantem que /listar, /alterar e demais paths removidos não retornem por copy-paste de PR futuro. Total: 38/38 invariantes verdes. Runtime inalterado (patch documental — APP_VERSION 3.0.0 → 3.0.1, OpenAPI v4.0.0 → v4.0.1).",
                    ] },
                    { version: "v4.0.0 / SDK v3.0.0 / APP v3.0.0", date: "2026-04-17", changes: [
                      "PR-7 — BREAKING: PRE-PROD CLEANUP. Sunset antecipado dos 7 endpoints legados (gate de telemetria 30d zerado em audit/baseline-v3.8.4.md, zero consumer interno em src/). Removidos do backend: CP /alterar (PUT), CP /listar (GET), CP /registrar-pagamento (POST), CP /cancelar-pagamento (POST), CR /alterar (PUT), CR /listar (GET), CR /cancelar-recebimento (POST). Substitutos canônicos: /upsert (idempotente), /query (paginação REST cursor/offset), /lancar-pagamento, /lancar-recebimento, /estornar (estorno auditável com motivo). Fundamento: nenhum integrador externo conectado e janela 2026-09-30 protegia zero pessoas — lançar API magra antes do primeiro parceiro vale mais que cerimônia de sunset.",
                      "OPENAPI v4.0.0: 7 entries deprecated:true deletadas dos arrays de endpoints (não basta marcar — apaga objeto inteiro). 4 entries removidas de PATH_SCHEMA_MAP (alterar/cancelar-pagamento CP, alterar/cancelar-recebimento CR). info.version bump 3.9.1 → 4.0.0. Generator de Deprecation/Sunset/x-sunset/x-deprecation-replacement permanece como código defensivo (custo zero, futuro deprecation pode reusar). Header components.headers.{Deprecation, Sunset} mantido pelo mesmo motivo.",
                      "SDKs v3.0.0 (TS/JS/Python): 7 métodos × 3 = 21 implementações deletadas — cpAlterar, cpListar, cpRegistrarPagamento, cpCancelarPagamento, crAlterar, crListar, crCancelarRecebimento. Interfaces órfãs removidas: CpAlterarPayload, CpRegistrarPagamentoPayload, CpCancelarPagamentoPayload, CrAlterarPayload, CrCancelarRecebimentoPayload. Python: 7 warnings.warn(DeprecationWarning) eliminados (caem com os métodos). JSDoc @deprecated zerado. Comentários GUIA DE USO atualizados — apenas cpQuery (não há mais cpListar). SDK_VERSION 2.18.1 → 3.0.0.",
                      "REGRESSION SCRIPT: audit/regression-greps.sh expandido de 16 para 25 invariantes. Novo helper checkExact (assertção de igualdade — usado para impedir reintrodução). 4 invariantes invertidos (@deprecated, warnings.warn, deprecated:true, x-sunset → == 0). 6 positivos novos (canônicos sobreviventes /upsert, /query, /lancar-*, /estornar). 7 negativos novos (cpAlterar, cpListar etc → == 0). 3 versões alinhadas (4.0.0, SDK 3.0.0, APP 3.0.0). CI via .github/workflows/regression-greps.yml continua exigindo verde antes de qualquer merge.",
                      "CONSUMIDORES INTERNOS: ApiTester.tsx — 7 entries removidas do menu de exemplos. RelatorioAPModule.tsx linha 386 — 'contas-pagar-api/listar' substituído por 'contas-pagar-api/query'. api-support-ai/index.ts — exemplos curl/JS/Python migrados para /query e /upsert; tabelas de endpoints atualizadas para refletir API magra.",
                      "Verificáveis: grep -c '@deprecated' SdkDownloadButtons.tsx == 0; grep -c 'warnings.warn' == 0; grep -c 'deprecated: true' ApiDocumentation.tsx == 0; grep -c '/contas-pagar-api/alterar' SdkDownloadButtons.tsx == 0; grep -c '\"4.0.0\"' ApiDocumentation.tsx >= 1; bash audit/regression-greps.sh → 25/25 OK.",
                    ] },
                    { version: "v3.9.1 / SDK v2.18.1 / APP v2.33.1", date: "2026-04-17", changes: [
                      "PR-7B — DX CLOSURE FINAL: fecha o gap servidor↔SDK↔OpenAPI levantado pelo parecer 9.5/10. (1) SDKs (TS/JS/Python): _etagCache e _bodyCache agora são LRU bound (max 500) — TS/JS via classe LRUMap inline, Python via OrderedDict + helpers _lru_get/_lru_set. Previne memory leak em serviços long-running com queries dinâmicas. (2) SDKs: chave de cache canônica via _cacheKey (TS/JS) / _cache_key (Python) — querystring é parseada (URLSearchParams.entries em TS, parse_qsl em Python), sort por chave estável, reconstruída. ?a=1&b=2 e ?b=2&a=1 hitam a mesma entry. (3) SDKs: opção cacheBody / cache_body (default true). Quando false, 304 não devolve body cacheado — apenas {_not_modified, etag, status:304}. ETag (If-None-Match) continua ativo nos dois modos. Útil para integradores memory-sensitive. (4) SDKs: tipo público RateLimitMetadata exportado — TS interface, Python TypedDict, JS sentinel Object.freeze. lastRateLimit/last_rate_limit tipado. (5) OpenAPI v3.9.1: components.headers ganha ETag, RateLimit-{Limit,Remaining,Reset}, Deprecation, Sunset. components.responses.NotModified (304) com headers ETag + RateLimit-*. Generator de paths: TODA response 200/201 ganha headers X-Request-ID + RateLimit-*; GETs cacheáveis (/listar, /consultar, /status) ganham header ETag em 200 + response 304 NotModified; endpoints deprecated:true ganham headers Deprecation + Sunset em 2xx. ErrorRateLimited (429) também ganha os 3 RateLimit headers. (6) Smoke 7→8/8 nos SDKs TS/JS + 5→10 no Python (test_07 304 cache, test_08 429 rate_limit, test_09 normalization, test_10 cache_body=False). APP_VERSION 2.33.1. Verificações grep: grep -c 'LRUMap\\|OrderedDict' SdkDownloadButtons.tsx ≥ 2; grep -c 'cacheBody\\|cache_body' ≥ 6; grep -c 'RateLimitMetadata' ≥ 4; grep -c '\"3.9.1\"' ApiDocumentation.tsx ≥ 1; grep -c 'NotModified' ≥ 2; grep -c 'smoke#8\\|normalization' ≥ 3.",
                    ] },
                    { version: "v3.9.0 / SDK v2.18.0", date: "2026-04-17", changes: [
                      "PR-6 — RATE-LIMIT HEADERS UNIVERSAIS (draft-ietf-httpapi-ratelimit-headers): Nova RPC public.check_and_increment_rate_limit_v2(p_chave, p_limite) retorna jsonb {allowed, limit, remaining, reset_at}. checkRateLimit() em _shared/rate-limit.ts agora cacheia metadata por Request via WeakMap e expõe getRateLimitMetadata(req). Helper applyRateLimitHeaders(req, res) injeta RateLimit-Limit, RateLimit-Remaining e RateLimit-Reset (unix epoch) em todas as respostas. Aplicado nos roteadores CR/CP + secureHandler (cobertura universal nos 19 handlers). Erro 429 também passa a emitir os 3 headers + Retry-After. RPC v1 mantida intacta (compat com 50+ funções). APP_VERSION 2.33.0.",
                    ] },
                    { version: "v3.8.9 / SDK v2.17.2", date: "2026-04-17", changes: [
                      "PR-5 — ETag / If-None-Match (RFC 7232): jsonResponseWithETag() e applyETagByPath(req, res) em _shared/response.ts. Hash SHA-256 (16 hex chars) calculado sobre body com stripVolatileMeta() — remove meta.processed_at, meta.duration_ms, meta.request_id e timestamp/request_id de topo, garantindo ETag estável entre chamadas idênticas. If-None-Match casa → 304 Not Modified com headers ETag + X-Request-ID + Cache-Control private,must-revalidate. Aplicado em 6 GETs idempotentes: /contas-receber-api/{status,consultar,listar} e /contas-pagar-api/{status,consultar,listar}. Verificação: grep -c 'applyETagByPath' _shared/response.ts → 3; grep -rl 'applyETagByPath(' supabase/functions/ → 3 (response.ts + 2 roteadores).",
                    ] },
                    { version: "v3.8.8 / SDK v2.17.1", date: "2026-04-17", changes: [
                      "PR-4 — DEPRECATION/SUNSET HEADERS (RFC 8594 + draft-ietf-httpapi-deprecation): withDeprecation(res, {sunset, successor, link}) e applyDeprecationByPath(req, res) em _shared/response.ts. Inventário LEGACY_ENTRIES com 7 paths confirmados: CP /registrar-pagamento (POST), /alterar (PUT), /cancelar-pagamento (POST), /listar (GET); CR /alterar (PUT), /cancelar-recebimento (POST), /listar (GET). Sunset: Wed, 30 Sep 2026 23:59:59 GMT (alinhado com janela acordada no PR-1). Header Link com rel=successor-version (URL completa do endpoint substituto) + rel=deprecation (doc). Interceptor por path no roteador — zero acoplamento aos handlers individuais. Verificação: grep -c 'withDeprecation\\|applyDeprecationByPath' _shared/response.ts → 5; grep -rl 'applyDeprecationByPath(' supabase/functions/ → 3.",
                    ] },
                    { version: "v3.8.7 / SDK v2.17.0", date: "2026-04-17", changes: [
                      "OBSERVABILIDADE UNIVERSAL FECHADA (PR-1B): contas-receber-api migrado para usar _shared/response.ts via thin shim local — todas as 80+ chamadas a jsonResponse(...) preservam assinatura legada (data, status, corsHeaders) mas internamente delegam ao helper compartilhado, herdando X-Request-ID (header) + meta.request_id (body) automaticamente. Handler /estornar (introduzido em PR-3) deixa de ser exceção e passa a emitir request_id como vizinhos. Cobertura sobe para 19/19 handlers principais (CR + CP + parcelas + ERP + cadastros). Verificação: grep -c 'function jsonResponse' contas-receber-api/index.ts → 0; grep -c 'sharedJsonResponse' → ≥ 1; import withSecurityHeaders removido (shared já aplica).",
                      "FOLLOW-UP PR-2 (telemetria de degradação): _shared/idempotency.ts agora emite log estruturado JSON com marker 'idempotency_cache_degraded' quando lookup ou store falham (campos: endpoint, phase, reason, request_id, timestamp). Permite alertas/contadores via grep no log aggregator. Comportamento de resiliência inalterado (degrada gracioso, request prossegue sem cache).",
                      "CRON CLEANUP ATIVO: agendamento pg_cron 'cleanup-idempotency-cache' a cada 6h (00:00, 06:00, 12:00, 18:00 UTC) executando public.cleanup_expired_idempotency_cache(). Migration idempotente (unschedule prévio se existir). Garante que api_idempotency_cache não cresce indefinidamente — TTL de 24h respeitado via remoção física. APP_VERSION 2.32.3.",
                    ] },
                    { version: "v3.8.6 / SDK v2.17.0", date: "2026-04-17", changes: [
                      "IDEMPOTÊNCIA SERVER-SIDE (PR-2 / P2): Novo middleware _shared/idempotency.ts (auto-contido, ~210 linhas) cobre os 8 endpoints POST de escrita financeira para integradores: /contas-receber-api/{incluir,lancar-recebimento,cancelar,estornar}, /contas-pagar-api/{incluir,lancar-pagamento,cancelar,cancelar-pagamento,estornar}, /erp-export-payment, /parcelas-api/incluir. Tabela api_idempotency_cache (PK composta key+endpoint, TTL 24h, JSONB body+headers). Comportamento: mesma Idempotency-Key + mesmo body → resposta cacheada com header Idempotent-Replay: true; mesma key + body diferente → 409 IDEMPOTENCY_KEY_CONFLICT; sem key → passa direto (opt-in). Apenas 2xx são cacheadas (erros podem ser transitórios). RLS habilitada sem policies — acesso exclusivo via service_role.",
                      "FLAG TRANSITÓRIA REMOVIDA: X-Feature-Idempotency: not-yet-implemented eliminada de _shared/response.ts (constante IDEMPOTENCY_PENDING_PATHS, função isIdempotencyPending() e bloco condicional em jsonResponse — total ~28 linhas). Verificação: grep -c 'X-Feature-Idempotency' _shared/response.ts → 0. Pareamento forte cumprido: idempotência funciona, flag sai no mesmo PR. audit/pr-2-followup.md fechado.",
                      "VALIDAÇÃO DE KEY (RFC draft-ietf-httpapi-idempotency-key-header): Idempotency-Key deve ter 16-128 chars no padrão [a-zA-Z0-9-]. Fora do padrão → 400 INVALID_IDEMPOTENCY_KEY. Hash SHA-256 do body completo detecta reuso de key com payload diferente. TTL configurável via constante TTL_HOURS (atual: 24).",
                      "RESILIÊNCIA: Falhas na infra de idempotência (lookup ou store) NÃO bloqueiam a request — são logadas e o handler segue sem cache. Indisponibilidade da tabela degrada graciosamente para comportamento pré-PR-2.",
                      "BASELINE DE DUPLICAÇÃO PRÉ-FIX (audit/baseline-v3.8.4.md Seção 8): SELECT em contas_receber últimos 7 dias (2079 títulos) → 0 duplicações por codigo_lancamento_integracao detectadas. Fix é PREVENTIVO, não corretivo de duplicação ativa. Re-medição agendada 7d pós-merge para confirmar manutenção do zero. APP_VERSION 2.32.2. Greps: grep -c 'Idempotency-Key' _shared/idempotency.ts → ≥ 2; grep -lr 'from \"../_shared/idempotency.ts\"' supabase/functions/*/index.ts | wc -l → 4 (CR, CP, ERP, parcelas).",
                    ] },
                    { version: "v3.8.5 / SDK v2.17.0", date: "2026-04-17", changes: [
                      "OBSERVABILIDADE UNIVERSAL (PR-1 / P1+P7): _shared/response.ts agora gera/eco X-Request-ID em todas as respostas (header) e injeta request_id no body via meta.request_id + envelope de erro. Aceita upstream x-request-id ou x-correlation-id; gera UUID quando ausente. Cascata cobre 29 handlers que importam jsonResponse/errorResponse. Integradores ganham rastreabilidade ponta-a-ponta sem mudar SDK. Greps: grep -c 'X-Request-ID' _shared/response.ts → 4 (era 0); grep -c 'request_id' _shared/response.ts → 5 (era 0).",
                      "FLAG TRANSITÓRIA DE IDEMPOTÊNCIA (PR-1.flag): X-Feature-Idempotency: not-yet-implemented emitido em 9 endpoints de escrita financeira (contas-receber/pagar incluir/baixar/cancelar, erp-export-payment, parcelas/incluir, contas-pagar/trigger-n8n) sinalizando que header Idempotency-Key enviado pelo SDK ainda é IGNORADO server-side. Removido em PR-2 (idempotency middleware). Ticket pareado: audit/pr-2-followup.md.",
                      "NOVO ENDPOINT (PR-3 / P3): POST /contas-receber-api/estornar — fechamento de finding ALTA funcional (rota documentada respondia 404 de router). Aceita {nCodTitulo|codigo_lancamento_integracao, cMotivo}, valida status (bloqueia Liquidado/Cancelado/já Estornado), atualiza para Estornado + carimbo de auditoria em observacao, dispara webhook conta_receber.estornada. Greps: grep -c '/estornar' contas-receber-api/index.ts → ≥ 2; grep -c '/estornar' docs/API_CONTAS_RECEBER.md → ≥ 3.",
                      "BASELINE AUDITÁVEL: audit/baseline-v3.8.4.md commitado com 7/7 padrões em estado pré-fix (P1-P7) + telemetria 30d dos 4 endpoints REMOVER (0 hits — gate PR-7 satisfeito) + decisão Opção B documentada + Sunset v1-legacy = Wed, 30 Sep 2026 00:00:00 GMT (alinhado com /sync-chunk e /bulk-sync de v3.8.1).",
                      "DESCOBERTA DIAGNÓSTICA: contas-receber-api/index.ts usa jsonResponse LOCAL (linha 94), não _shared/response.ts — a cascata PR-1 NÃO atinge CR automaticamente. Cobertura real: 14 dos 29 handlers que fazem import (CR + 4 handlers irmãos optam por response local). Migração CR→shared registrada como PR-1B futuro. APP_VERSION 2.32.1.",
                    ] },
                    { version: "v3.8.4 / SDK v2.17.0", date: "2026-04-17", changes: [
                      "SDK TYPESCRIPT (smoke test ativo): Bloco runSmoke() em huggs-erp-sdk.ts SAIU dos comentários — agora é código executável real, não pseudo-código. Rodar: npx tsx huggs-erp-sdk.ts --smoke. Cobre 5 invariantes (idempotência estável, lastRequestId inicial null, cpUpsertLote([]) lança local, HuggsAPIError.requestId propagado, apiKey vazia rejeitada). Saída: '[smoke] 5/5 invariantes OK' + exit code 0/1.",
                      "SDK JAVASCRIPT (smoke test ativo): Mesma operação simétrica em huggs-erp-sdk.js — bloco descomentado, executável via node huggs-erp-sdk.js --smoke. Antes: 14 ocorrências de 'smoke' dentro de comentários (grep passava, código não rodava). Agora: ≥ 5 console.assert reais por arquivo.",
                      "SDK PYTHON (gate funcional): Trocado 'if False:' por 'if __name__ == \"__main__\" and \"--smoke\" in _sys.argv:'. O comando que o próprio comentário anuncia (python huggs_erp_sdk.py --smoke) agora funciona sem editar o arquivo. 6 cases unittest reais com @patch('requests.request').",
                      "OPENAPI v3.8.4: Bump cosmético de versão; nenhuma mudança estrutural além do header info.version. Response 200 do POST /erp-export-payment já era objeto JSON real desde v3.8.3 (campos exports[], registration, payment, meta) — confirmado neste release.",
                      "DISCIPLINA DE RELEASE: grep -c 'console.assert' huggs-erp-sdk.ts ≥ 5; grep -c 'console.assert' huggs-erp-sdk.js ≥ 5; grep 'if __name__ == \"__main__\" and \"--smoke\"' huggs_erp_sdk.py = 1; grep -c 'if False:' huggs_erp_sdk.py = 0 (removido). Fecha o único deslize de fidelidade do parecer 9.25/10. APP_VERSION 2.32.0.",
                    ] },
                    { version: "v3.8.3 / SDK v2.16.1", date: "2026-04-17", changes: [
                      "EDGE FUNCTION (fix comportamental ao vivo): erp-export-payment agora retorna 404 com error=\"payment_queue_not_found\" (mensagem incluindo o payment_queue_id recebido) quando o UUID é válido mas não existe em financial_payment_queue. Antes a mensagem era genérica (\"Item não encontrado\") e em alguns paths podia escalar para 500. Idem para action=retry → 404 export_queue_not_found. Erros reais de DB (PG) viram 500 DB_ERROR explícito com request_id, em vez de mascarar como 404.",
                      "OPENAPI v3.8.3: Endpoint /erp-export-payment documenta resposta 404 estruturada com exemplo {error:'payment_queue_not_found', message, meta} no campo response do action=export. Integrador agora vê o contrato exato sem precisar disparar requisição.",
                      "SDK v2.16.1: Smoke test Python ganhou test_06_404_payment_queue_not_found_propaga_request_id — mocka resposta 404 com X-Request-ID e valida que HuggsAPIError carrega status=404 e request_id, e que client.last_request_id é populado mesmo em erro. 6/6 invariantes embutidas no rodapé do SDK distribuído.",
                      "DISCIPLINA DE RELEASE: grep -c 'payment_queue_not_found' supabase/functions/erp-export-payment/index.ts ≥ 1 (presente em handleExport); grep -c 'export_queue_not_found' ≥ 1 (presente em handleRetry); grep -c 'maybeSingle' ≥ 2 (substituiu .single() para evitar erro 116 mascarado); validação ao vivo via supabase--curl_edge_functions confirmou status=404 (não 500) para UUID inexistente. APP_VERSION 2.31.1.",
                    ] },
                    { version: "v3.8.2 / SDK v2.16.0", date: "2026-04-17", changes: [
                      "OBSERVABILIDADE (last_request_id): Cliente HuggsERP nos 3 SDKs (TS/JS/Python) agora captura o header X-Request-ID de TODA resposta (sucesso ou erro) e expõe via client.lastRequestId / client.last_request_id. Permite logging cliente-side correlacionado com logs do servidor sem precisar inspecionar headers manualmente.",
                      "ERRORS (rastreabilidade ponta-a-ponta): HuggsAPIError (TS/JS) e HuggsAPIError (Python) ganham campo requestId / request_id propagado a partir do header da resposta de erro. Exceções carregam o ID rastreável já no construtor — fim do 'qual request_id era esse mesmo?' no debug de produção.",
                      "SMOKE TESTS DISTRIBUÍVEIS: Cada SDK gerado (TS/JS/Python) agora inclui no rodapé um bloco SMOKE TESTS executável com 5 invariantes sem rede — idempotência, lastRequestId inicial, validação local de input vazio, propagação de requestId em erro e validação de apiKey. Python: rodar com python -m huggs_erp_sdk.smoke. TS/JS: comentado por padrão, descomentar e rodar com flag --smoke.",
                      "OPENAPI v3.8.2: Descriptions de POST /contas-pagar-api/cancelar-pagamento e POST /contas-pagar-api/estornar agora documentam coexistência por design — cancelar = anula registro operacional sem motivo formal; estornar = estorno auditável com motivo obrigatório (compliance contábil). Integrador escolhe sem precisar adivinhar.",
                      "DISCIPLINA DE RELEASE (mantida): Todos os 4 itens deste bump são verificáveis por grep — grep -c 'lastRequestId\\|last_request_id' SdkDownloadButtons.tsx ≥ 6, grep 'x-request-id' ≥ 3, grep 'smoke' ≥ 3, grep 'estornar' ApiDocumentation.tsx presente. APP_VERSION 2.31.0 força refresh do portal.",
                    ] },
                    { version: "v3.8.1 / SDK v2.15.0", date: "2026-04-17", changes: [
                      "FIDELIDADE CHANGELOG↔CÓDIGO RESTAURADA (fecha 3 itens da v2.14.0 que ficaram em descompasso): (1) Python _request agora aceita timeout: Optional[int] propagado a requests.request — cp_upsert_lote(..., timeout=120) de fato envia 120s. 14 ocorrências de 'timeout=timeout'. (2) SDK TS/JS: 9 métodos legados marcados com @deprecated JSDoc (versão de remoção 4.0.0, sunset 2026-09-30, replacement). IDE risca chamada e CI com no-deprecated emite warning. (3) SDK Python: 9 ocorrências de warnings.warn(DeprecationWarning) em métodos legados — rodar com -W error::DeprecationWarning falha o CI.",
                      "OPENAPI v3.8.1: 7 paths legados marcados com deprecated:true + x-sunset:2026-09-30 + x-deprecation-replacement apontando para path moderno equivalente (alterar→upsert, listar→query, cancelar→estornar). Nota honesta: /contas-receber-api/registrar-recebimento nunca existiu na spec, apenas o moderno /lancar-recebimento — 7 paths em vez de 8 esperados.",
                      "DISCIPLINA DE RELEASE: Cada item entregue acompanhado do comando grep que prova a presença no código. Padrão a ser mantido nas próximas rodadas.",
                    ] },
                    { version: "v3.7.2 / SDK v2.13.0", date: "2026-04-17", changes: [
                      "OPENAPI (gap cosmético resolvido): Resposta 200 do POST /erp-export-payment/ na ação 'status' promovida a objeto JSON real — antes era string com placeholders ([...], { ... }) que falhavam no JSON.parse e caíam no fallback de string escapada. Agora exibe estrutura completa com exports[].id/status/external_id/attempts/last_error, registration{created,updated}, payment{settled} e meta{request_id,api_version,duration_ms}. Zero respostas string escapada no OpenAPI 3.7.2.",
                      "EDGE FUNCTION (revalidação ao vivo v2.13.0): erp-export-payment reconfirmada em produção via curl — payload vazio {} retorna 400 validation_error com path ['action'] e details estruturados; payment_queue_id UUID válido mas inexistente retorna 404 NOT_FOUND com meta.processed_at e duration_ms; payment_queue_id não-UUID retorna 400 validation_error com path ['payment_queue_id']. Zero ocorrências de 500 nos 3 cenários — comportamento consistente com OpenAPI declarado.",
                      "DX: APP_VERSION 2.28.0 força refresh de cache do portal para garantir que integradores vejam a documentação OpenAPI 3.7.2 sem stale cache do Service Worker.",
                    ] },
                    { version: "v3.7.1 / SDK v2.12.0", date: "2026-04-17", changes: [
                      "PARIDADE TOTAL RESTAURADA (60/60/60): SDK Python e JavaScript ganharam os 4 métodos CP auxiliares que estavam apenas no TS — cp_parcelas_sync/cpParcelasSync (sync de parcelas geradas pelo ERP, máx 5000), cp_anexos_listar/cpAnexosListar (consultar comprovantes), cp_anexos_incluir/cpAnexosIncluir (registrar comprovante de pagamento) e cp_cancelar_lote/cpCancelarLote (cancelamento batch com motivo auditável). Cobertura CP: 19/19 nos 3 SDKs.",
                      "OPENAPI: Resposta 200 do POST /erp-export-payment/ promovida a objeto JSON real com campos exports[], registration{created,updated} e payment{settled} — fim do exemplo string escapada residual.",
                      "EDGE FUNCTION (validação ao vivo): erp-export-payment confirmada em produção — payment_queue_id UUID válido mas inexistente retorna 404 NOT_FOUND estruturado (semanticamente correto), payment_queue_id não-UUID retorna 400 validation_error com path do erro. Zero ocorrências de 500 em payload inválido.",
                      "DX (Python): suporte a retry=True e idempotency_key=... nos 4 novos métodos de mutation, via _cp_dispatch. URL encoding via urlencode/quote. TypedDicts: CpParcelasSyncResponse, CpAnexoResponse, CpAnexosListResponse, CpCancelarLoteResponse.",
                      "DX (JS): JSDoc inline nos 4 novos métodos com indicação explícita de RECOMENDADO retry=true para lotes >100 e referência a { retry: true, timeout: 60000 } documentada.",
                    ] },
                    { version: "v3.6.0 / SDK v2.10.0", date: "2026-04-17", changes: [
                      "EDGE FUNCTION (validação ao vivo): erp-export-payment confirmada em produção retornando 400 estruturado (com request_id rastreável) para payload vazio, action ausente, payment_queue_id não-UUID e export_type fora do enum [registration|payment]. Zero ocorrências de 500 'Unknown error' nos cenários de input inválido.",
                      "SDK Python: cp_query agora valida chaves desconhecidas (paridade com TS/JS v2.9.0) — typo de filtro lança HuggsValidationError local antes do request HTTP, com lista das chaves aceitas na mensagem.",
                      "OPENAPI: Exemplo de body em POST /erp-export-payment promovido a objeto JSON real com schema formal — action declarada como enum [export|retry|status], payment_queue_id como string format uuid, channel string. Fim do exemplo string sem schema.",
                      "DX: SDK v2.10.0 com changelog inline detalhando garantia de 400 estruturado (não 500) na Edge Function — integradores sabem que erro de payload é tratável sem ler stacktrace.",
                    ] },
                    { version: "v3.5.0 / SDK v2.9.0", date: "2026-04-17", changes: [
                      "EDGE FUNCTION: erp-export-payment agora retorna 400 estruturado ({ error: 'validation_error', message, details, request_id }) em vez de 500 'Unknown error' — corpo JSON malformado, action ausente/inválida, UUID quebrado e método errado viram 400 com mensagem clara. 500 reservado apenas para falha real de infra (com request_id rastreável).",
                      "SDKs (TS): crConsultar agora retorna CrConsultarResponse tipado (paridade com CpConsultarResponse) — fim do Record<string, unknown>.",
                      "SDKs (TS/JS): cpQuery valida chaves desconhecidas (rejeita typo de filtro antes de bater no servidor); crExcluir exige codigo_lancamento_integracao não-vazio.",
                      "OPENAPI: Exemplos de body em /erp-export-payment formatados como JSON multiline legível com UUIDs reais.",
                      "DOCUMENTAÇÃO: Guia 'Primeiros 5 Minutos' e tabela 'Quando usar cada método (cpIncluir vs cpUpsert, cpLancarPagamento vs cpRegistrarPagamento)' adicionados ao topo do portal.",
                    ] },
                    { version: "v3.4.0 / SDK v2.8.0", date: "2026-04-17", changes: [
                      "SDKs (TS/JS/Python): Paridade TOTAL Contas a Receber × Contas a Pagar — crIncluir, crAlterar, crUpsert, crExcluir, crLancarRecebimento, crCancelarRecebimento e crUpsertLote agora aceitam { retry, idempotencyKey } (TS/JS) e *, retry, idempotency_key (Python). Fim da assimetria CP×CR apontada no parecer técnico.",
                      "SDKs: Família moderna CR adicionada — crConsultar, crQuery, crGetRecebimentos, crGetParcelas — espelhando a interface CP de leitura.",
                      "SDK Python: cr_listar, cr_consultar, cr_query, cr_excluir, cr_get_recebimentos, cr_get_parcelas agora usam urllib.parse.urlencode/quote — corrige bug de filtros com '/' ou '&' que quebrava o path (mesmo fix que já estava em cp_*).",
                      "SDKs: cpUpsertLote e crUpsertLote ganharam retry público — recomendado para lotes >100 registros (timeout em 30s é provável; retry cego sem chave duplicaria centenas de títulos).",
                      "SDK Python: TypedDict para respostas de mutation — CpMutationResponse, CpPagamentoResponse, CpLoteResponse, CrMutationResponse, CrRecebimentoResponse, CrLoteResponse — paridade com as interfaces TS. Métodos de escrita deixam de retornar Dict[str, Any].",
                      "OPENAPI: Nota explícita de 'strongly recommended X-Idempotency-Key' adicionada à descrição global cobrindo /lancar-pagamento, /lancar-recebimento, /upsert e /upsert-lote (CP e CR) — ajuda quem integra sem usar o SDK oficial.",
                    ] },
                    { version: "v3.3.0 / SDK v2.7.0", date: "2026-04-17", changes: [
                      "SDKs: Retry idempotente PROMOVIDO à API pública dos endpoints financeiros CP — cpIncluir, cpAlterar, cpUpsert, cpExcluir, cpLancarPagamento, cpRegistrarPagamento, cpCancelarPagamento e cpEstornar agora aceitam opts { retry, idempotencyKey } (TS/JS) e *, retry, idempotency_key (Python)",
                      "SDKs: Default mantido (retry=false) para back-compat. Em produção, recomenda-se cpLancarPagamento(payload, { retry: true, idempotencyKey: 'cp-pag-<codigo>-<valor>' }) — proteção total contra timeout/5xx onde o servidor já processou",
                      "SDK Python: TypedDict para CpConsultarResponse, CpQueryResponse, CpPagamentosResponse e CpParcelasResponse — paridade de tipagem com TS, ganho de IDE/mypy sem mudar runtime",
                      "SDKs: Guia inline atualizado documentando o novo padrão de retry público nos endpoints financeiros",
                    ] },
                    { version: "v3.3.0 / SDK v2.6.0", date: "2026-04-17", changes: [
                      "BLOCKER FIX (SDKs): X-Idempotency-Key gerada UMA vez por operação lógica e reutilizada em todas as tentativas de retry — preserva idempotência em timeouts/5xx onde o servidor já processou",
                      "SDKs: _requestWithRetry / _request_with_retry aceitam idempotency_key externa (ex: derivada de codigo_lancamento_integracao + valor) para idempotência cross-session",
                      "SDK Python: URL encoding com urllib.parse.quote/urlencode em cp_excluir, cp_consultar, cp_listar, cp_query, cp_get_pagamentos, cp_get_parcelas e fornecedores_consultar (corrige CNPJ formatado '12.345.678/0001-90' que quebrava o path)",
                      "SDK TS: cpQuery agora retorna CpQueryResponse (lista de TÍTULOS) em vez de CpPagamentosResponse — copy/paste corrigido",
                      "SDKs: Enums tipados em WebhookSubscribePayload.events (List[WebhookEvent]) e CategoriaPayload.tipo (TipoCategoria)",
                      "OPENAPI: Exemplos canônicos de data migrados para ISO 8601 (YYYY-MM-DD) em /incluir, /alterar, /upsert, /upsert-lote, /lancar-pagamento, /lancar-recebimento — coerência com a intro",
                      "OPENAPI: Removida ambiguidade do empresa_id em CP /upsert — deixou de ser declarado como query param required (é enviado apenas no body, conforme UpsertSchema)",
                      "OPENAPI: Schemas ContaPagarInput.data_vencimento e PagamentoInput.data atualizados para descrever ISO 8601 como padrão",
                    ] },
                    { version: "v3.2.0", date: "2026-04-17", changes: [
                      "OPENAPI: Operações de escrita (POST/PUT/DELETE não-leitura) agora declaram formalmente os headers X-Idempotency-Key e X-Request-ID via $ref para components.parameters",
                      "OPENAPI: Respostas 400/401/429 agora usam $ref para components.responses (ErrorBadRequest, ErrorUnauthorized, ErrorRateLimited) — eliminação de duplicação inline",
                      "OPENAPI: Geração mais limpa, validação openapi-generator passa sem warnings de schemas inline duplicados",
                    ] },
                    { version: "v3.1.0", date: "2026-04-17", changes: [
                      "OPENAPI: info.description expandida — Autenticação, Idempotência, Datas (ISO 8601 padrão), Rate Limits quantificados, Webhooks HMAC-SHA256 com exemplo Node, Status de Negócio, X-Request-ID",
                      "OPENAPI: components.parameters reutilizáveis (X-Idempotency-Key, X-Request-ID)",
                      "OPENAPI: components.responses tipados (ErrorBadRequest, ErrorUnauthorized, ErrorRateLimited, ErrorBusiness)",
                      "OPENAPI: security global ApiKeyAuth (BearerAuth removida — não era usada)",
                      "RATE LIMITS: Quantificados oficialmente — 120/min leitura, 60/min escrita, 20/min lote (máx 500 itens)",
                      "WEBHOOKS: Esquema HMAC documentado formalmente (sha256=hex do raw body, X-Webhook-Signature, janela 5min em X-Webhook-Timestamp)",
                      "IDEMPOTÊNCIA: X-Idempotency-Key documentado como padrão para escritas",
                    ] },
                    { version: "v3.0.0", date: "2026-04-17", changes: [
                      "SDKs: Paths corrigidos (erp-fornecedores-sync/check+sync, erp-plano-contas-api/, erp-portadores-api/+sync)",
                      "SDKs: HuggsBusinessError lançado quando HTTP 200 retorna codigo_status != '0'",
                      "SDKs: Removidos métodos com paths inexistentes",
                      "SDKs: Versão 2.5.0 com paridade entre TS/JS/Python",
                    ] },
                    { version: "v2.3.0", date: "2026-04-13", changes: [
                      "DOCUMENTAÇÃO: Política de versionamento unificada — AMBAS as seções agora idênticas (90 dias + 6 meses + campos aditivos)",
                      "DOCUMENTAÇÃO: Eventos webhook padronizados no FAQ (conta_pagar.criado, não cp.created)",
                      "DOCUMENTAÇÃO: Formato de data bidirecional — nota ATENÇÃO adicionada (entrada ≠ saída)",
                      "DOCUMENTAÇÃO: Novos glossários de campos — Clientes, Empresas, Categorias, Contas Correntes",
                      "DOCUMENTAÇÃO: Pré-condições documentadas — CP/CR lancar-pagamento, Boletos gerar",
                      "DOCUMENTAÇÃO: Nota sobre empresa_ids em Fornecedores (funcionalmente necessário)",
                      "SDKs: TypeScript — adicionado _requestWithRetry com backoff exponencial",
                      "SDKs: JavaScript — adicionado _requestWithRetry com backoff exponencial",
                      "SDKs: Python — adicionado clientes_alterar (paridade com TS/JS)",
                      "SDKs: CpPagamentoPayload e CrRecebimentoPayload — adicionado id_conta_corrente",
                      "SDKs: WebhookSubscribePayload.secret — warning de segurança HMAC-SHA256",
                      "SDKs: EmpresaIncluirPayload — warnings em cnpj, regime_apuracao, tipo_empresa",
                      "SDKs: ClientePayload.cnpj_cpf — warning sobre upsert",
                      "SDKs: FornecedorPayload.empresa_ids — warning funcional",
                      "SDKs: CategoriaPayload tipado (substituiu Record/Dict genérico)",
                      "SANDBOX: Mocks mais realistas com campos exatos da produção",
                      "INFRA: Estrutura de publicação npm (@bimaster/huggs-erp-sdk) e PyPI (huggs-erp-sdk)",
                      "INFRA: Botões de download com instrução npm/pip install",
                    ] },
                    { version: "v2.2.1", date: "2026-04-12", changes: ["SDK Python: adicionados fornecedores_alterar, categorias_incluir, portadores_consultar, cp_cancelar_pagamento", "SDK Python: dataclasses EmpresaIncluirPayload e EmpresaAlterarPayload substituem Dict genérico", "SDK JavaScript: JSDoc expandido em todos os métodos auxiliares (Categorias, Portadores, Departamentos, Projetos, Fornecedores)", "Paridade completa de métodos entre os 3 SDKs (TS, PY, JS)"] },
                    { version: "v2.2.0", date: "2026-04-12", changes: ["Política de versionamento unificada (90 dias de antecedência + 6 meses de suporte)", "Nomes de eventos webhook padronizados (conta_pagar.criado em vez de cp.created)", "Formato de data bidirecional documentado (entrada DD/MM/AAAA, saída ISO 8601)", "SDK TypeScript: classes de erro tipadas (HuggsAPIError, HuggsValidationError, etc.)", "SDK TypeScript: timeout 30s, paginação automática (fetchAllPages)", "SDK TypeScript: campos chave_nfe, numero_pedido, numero_contrato adicionados", "SDK TypeScript: respostas tipadas (eliminado Promise<any>)", "SDK Python: dataclasses completas para CR (alterar, upsert, recebimento, cancelar)", "SDK Python: retry com backoff exponencial (_request_with_retry)", "SDK Python: campo 'events' padronizado (era 'eventos')", "SDK JavaScript: tratamento de erro tipado, JSDoc completo, timeout 30s", "SDK JavaScript: módulo Empresas adicionado (ausente anteriormente)", "Todos os SDKs: endpoints de Fornecedores, Categorias, Portadores, Plano de Contas, Departamentos e Projetos", "Todos os SDKs: versão e metadata no cabeçalho"] },
                    { version: "v2.1.0", date: "2026-04-09", changes: ["Seção 'Ambientes' dedicada (Produção vs Sandbox) com cards visuais", "Seção 'Segurança & Criptografia' com 6 camadas documentadas (TLS 1.3, AES-256, HMAC, WAF)", "Mapa de dependências visual entre APIs", "Tempo estimado de integração por módulo (2h/4h/1h)", "Status Code 409 (Conflict) adicionado à tabela de erros", "Badge 'LEGADO' para endpoints deprecated", "SDK Python reescrito com dataclasses tipadas, exceções e paginação automática", "FAQ unificado com 10 perguntas técnicas"] },
                    { version: "v2.0.0", date: "2026-04-09", changes: ["Chatbot IA inline — resposta instantânea a dúvidas técnicas em cada endpoint", "Wizard de Onboarding interativo (4 passos para primeira integração)", "Validação de payload em tempo real no API Tester (campos obrigatórios, limites de lote)", "Dashboard de uso da API Key (gráfico diário, progresso por chave)", "SDKs prontos para download (JavaScript + Python)", "Suporte IA para admin com geração de respostas técnicas"] },
                    { version: "v1.9.0", date: "2026-03-24", changes: ["Adicionados 9 filtros faltantes no CR /listar (conta corrente, cliente, projeto, vendedor, CPF/CNPJ, ordenação)", "Preset desconciliar adicionado ao API Tester", "Mapa de erros expandido: Boletos /gerar, Contas Correntes /incluir, Lançamentos CC /incluir", "25 eventos webhook completos na documentação"] },
                    { version: "v1.8.0", date: "2026-03-24", changes: ["Ambiente Sandbox separado de produção (toggle no API Tester)", "Chamadas sandbox simulam respostas realistas sem gravar dados", "Histórico de chamadas sandbox registrado com auditoria", "Badge visual SANDBOX e botão Dry Run diferenciado"] },
                    { version: "v1.7.0", date: "2026-03-23", changes: ["Glossário de campos para CR /incluir e Fornecedores /incluir", "Exemplos de iteração completa de paginação (JS + Python)", "Mapa de erros específicos por endpoint (CP, CR, Fornecedores)", "Botão 'Exportar Postman Collection' (JSON v2.1 importável)", "Exemplo de payload completo de webhook", "Política de versionamento documentada", "Guia de rotação de API Key sem downtime", "Tabela consolidada de limites e quotas"] },
                    { version: "v1.6.0", date: "2026-03-23", changes: ["Exemplos Hello World em 4 linguagens (cURL, JavaScript, Python, PHP)", "Glossário de campos detalhado para CP /incluir", "Seção FAQ/Troubleshooting com 8 perguntas comuns", "Botão 'Testar' em cada endpoint (preenche ApiTester automaticamente)", "Badges de paginação (Huggs/Legado/REST) em cada API", "Badges de status live (online/offline) em cada API", "URL base dinâmica via variável de ambiente"] },
                    { version: "v1.5.0", date: "2026-03-23", changes: ["Corrigido body do /registrar-pagamento (id → conta_pagar_id)", "Corrigida resposta do /query com pagination e meta", "Corrigida resposta do /cancelar com success e ids", "Documentado empresa_id como obrigatório no /upsert CP", "Adicionados 7 filtros faltantes no /listar CP (emissão, conta corrente, CPF/CNPJ, vendedor, observações)", "Fornecedores migrados de 'Geral' para 'Cadastros Auxiliares'", "Seção de erros estruturados na documentação de autenticação"] },
                    { version: "v1.4.0", date: "2026-03-23", changes: ["Adicionado guia HMAC para verificação de webhooks", "Botão 'Copiar curl' em todos os endpoints", "Guia de retry/backoff e badges de ambiente"] },
                    { version: "v1.3.0", date: "2026-03-20", changes: ["Seção 'Início Rápido' com ordem de integração", "Catálogo de eventos webhook documentado", "Notas sobre convenção POST e padrões de paginação"] },
                    { version: "v1.2.0", date: "2026-03-15", changes: ["Adicionadas 6 APIs: Fornecedores, Plano de Contas, Portadores, Webhook Subscriptions, Webhook Dispatcher", "Separação de 'Tabelas de Referência (Opcional)'", "Remoção de duplicidade webhook-push"] },
                    { version: "v1.1.0", date: "2026-03-01", changes: ["Chat de suporte em cada endpoint", "Exportação Excel multi-sheet", "Fluxogramas visuais em todos os endpoints"] },
                    { version: "v1.0.0", date: "2026-02-15", changes: ["Lançamento inicial com 30+ APIs", "Módulos: Geral, Cadastros Auxiliares, Finanças, Complementar", "API Tester integrado"] },
                  ].map(entry => (
                    <div key={entry.version} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono text-[11px]">{entry.version}</Badge>
                        <span className="text-xs text-muted-foreground">{entry.date}</span>
                      </div>
                      <ul className="space-y-1">
                        {entry.changes.map((c, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">•</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
