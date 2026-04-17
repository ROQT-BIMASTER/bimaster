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
  { method: "GET", path: "/status", description: "Health check da API de Contas a Receber", flow: FLOW.status, response: `{ "status": "ok", "version": "2.4.0", "timestamp": "2026-04-14T00:00:00Z" }` },
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
    IdempotencyHeaders: {
      type: "object",
      description: "Headers de idempotência para endpoints mutantes",
      properties: {
        "X-Idempotency-Key": { type: "string", format: "uuid", description: "Chave única para evitar duplicatas" },
        "X-Idempotency-Replayed": { type: "boolean", description: "true se a resposta é um replay de cache" },
      },
    },
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
      properties: {
        codigo_cliente_integracao: { type: "string", description: "ID único no ERP externo" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        cnpj_cpf: { type: "string", description: "RECOMENDADO para upsert" },
        email: { type: "string", format: "email" },
        telefone1_ddd: { type: "string" },
        telefone1_numero: { type: "string" },
        celular: { type: "string" },
        endereco: { type: "string" },
        endereco_numero: { type: "string" },
        bairro: { type: "string" },
        cidade: { type: "string" },
        estado: { type: "string", maxLength: 2 },
        cep: { type: "string" },
        pessoa_fisica: { type: "string", enum: ["S", "N"] },
        contribuinte: { type: "string" },
        observacao: { type: "string" },
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
    ClienteResumido: {
      type: "object",
      properties: {
        codigo_cliente: { type: "string", format: "uuid" },
        codigo_cliente_integracao: { type: "string" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        cnpj_cpf: { type: "string" },
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
        id_conta_corrente: { oneOf: [{ type: "string" }, { type: "integer" }], description: "ID da conta corrente" },
        numero_documento: { type: "string" },
        numero_documento_fiscal: { type: "string" },
        chave_nfe: { type: "string", minLength: 44, maxLength: 44, description: "Chave de acesso NFe" },
        observacao: { type: "string", maxLength: 5000 },
        codigo_projeto: { oneOf: [{ type: "string" }, { type: "integer" }], description: "ID do projeto" },
        empresa_id: { oneOf: [{ type: "string" }, { type: "integer" }], description: "Obrigatório para upsert" },
      },
    },
    ContaPagarResponse: {
      type: "object",
      properties: {
        codigo_lancamento_huggs: { type: "integer", nullable: true },
        codigo_lancamento_integracao: { type: "string" },
        codigo_status: { type: "string" },
        descricao_status: { type: "string" },
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
      properties: {
        razao_social: { type: "string" },
        cnpj: { type: "string", description: "RECOMENDADO: sem CNPJ a empresa fica em estado parcial" },
        nome_fantasia: { type: "string" },
        codigo_empresa_integracao: { type: "string" },
        regime_apuracao: { type: "string", enum: ["Competência", "Caixa"], description: "RECOMENDADO: afeta DRE" },
        tipo_empresa: { type: "string", enum: ["Matriz", "Filial", "Coligada"] },
        porte: { type: "string", enum: ["ME", "EPP", "Demais"] },
        inscricao_estadual: { type: "string" },
        inscricao_municipal: { type: "string" },
        endereco: { type: "string" },
        cidade: { type: "string" },
        estado: { type: "string", maxLength: 2 },
        cep: { type: "string" },
        email: { type: "string", format: "email" },
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
    // Fornecedores
    FornecedorQuery: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        cnpj: { type: "string" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        erp_code: { type: "string", nullable: true },
        erp_synced_at: { type: "string", format: "date-time", nullable: true },
        email: { type: "string", nullable: true },
        telefone: { type: "string", nullable: true },
        status: { type: "string", enum: ["ativo", "inativo"] },
        ativo: { type: "boolean" },
      },
    },
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
      properties: {
        cCodCCInt: { type: "string", description: "Código de integração" },
        descricao: { type: "string" },
        tipo_conta_corrente: { type: "string" },
        codigo_banco: { type: "string" },
        saldo_inicial: { type: "number", default: 0 },
        agencia: { type: "string" },
        conta: { type: "string" },
      },
    },
    ContaCorrenteResponse: {
      type: "object",
      properties: {
        id: { type: "integer" },
        descricao: { type: "string" },
        tipo: { type: "string" },
        saldo: { type: "number" },
        banco_codigo: { type: "string" },
        agencia: { type: "string" },
        conta: { type: "string" },
      },
    },
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
    // Tabelas de Referência
    PaisResponse: {
      type: "object",
      properties: {
        cCodigo: { type: "string", example: "1058" },
        cDescricao: { type: "string", example: "BRASIL" },
        cCodigoISO: { type: "string", example: "BR" },
      },
    },
    CidadeResponse: {
      type: "object",
      properties: {
        cCod: { type: "string" },
        cNome: { type: "string" },
        cUF: { type: "string" },
      },
    },
    BancoResponse: {
      type: "object",
      properties: {
        codigo: { type: "string", example: "001" },
        nome: { type: "string", example: "Banco do Brasil S.A." },
      },
    },
    // Exportação ERP
    ExportPendingResponse: {
      type: "object",
      properties: {
        pendentes: { type: "array", items: { type: "object" } },
        total: { type: "integer" },
      },
    },
    ExportConfirmInput: {
      type: "object",
      required: ["ids"],
      properties: {
        ids: { type: "array", items: { type: "string" } },
        erp_reference: { type: "string" },
      },
    },
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
    // CR (v4.0.0: /alterar e /cancelar-recebimento removidos)
    "POST:/contas-receber-api/incluir": { req: "ContaReceberInput", res: "ContaPagarResponse", is201: true },
    "DELETE:/contas-receber-api/excluir": { res: "MutationResponse" },
    "POST:/contas-receber-api/upsert": { req: "ContaReceberInput", res: "MutationResponse", is201: true },
    "POST:/contas-receber-api/lancar-recebimento": { req: "RecebimentoInput", res: "PagamentoResponse" },
    // Empresas
    "POST:/empresas-api/incluir": { req: "EmpresaInput", res: "EmpresaResponse", is201: true },
    "POST:/empresas-api/alterar": { req: "EmpresaInput", res: "EmpresaResponse" },
    "POST:/empresas-api/consultar": { res: "EmpresaResponse" },
    "POST:/empresas-api/listar": { req: "PaginatedRequest" },
    // Fornecedores
    "POST:/erp-fornecedores-sync/incluir": { req: "FornecedorSyncInput", res: "MutationResponse", is201: true },
    "POST:/erp-fornecedores-sync/cadastrar": { req: "FornecedorSyncInput", res: "MutationResponse", is201: true },
    "POST:/erp-fornecedores-sync/alterar": { req: "FornecedorSyncInput", res: "MutationResponse" },
    "POST:/erp-fornecedores-sync/upsert": { req: "FornecedorSyncInput", res: "MutationResponse", is201: true },
    "POST:/erp-fornecedores-sync/listar": { req: "PaginatedRequest" },
    "POST:/erp-fornecedores-sync/consultar": { },
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

  // ── operationId generator ──
  function toOperationId(fullPath: string, method: string): string {
    const cleanPath = fullPath.replace(DOC_BASE_URL, "").replace(/^\//, "");
    const parts = cleanPath.split("/").filter(Boolean);
    const apiName = (parts[0] || "").replace(/-api$/, "").replace(/-/g, "_");
    const action = parts.slice(1).join("_").replace(/-/g, "_") || "root";
    const moduleMap: Record<string, string> = {
      contas_pagar: "cp", contas_receber: "cr", contas_correntes: "cc",
      erp_fornecedores_sync: "fornecedoresSync", erp_fornecedores_query: "fornecedoresQuery",
      webhook_subscriptions: "webhookSub", webhook_dispatcher: "webhookDispatch",
      lancamentos_cc: "lancCC", tipos_entrega: "tiposEntrega", tipos_documento: "tiposDoc",
      tipos_atividade: "tiposAtiv", tipos_anexo: "tiposAnexo",
      finalidades_transferencia: "finalidadesTransf", plano_contas: "planoContas",
      bandeiras_cartao: "bandeirasCartao",
    };
    const prefix = moduleMap[apiName] || apiName;
    const camel = action.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return `${prefix}${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
  }

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
      if (path.includes("portadores")) return "ContaCorrenteResponse";
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
          const fullPath = `${api.basePath}${ep.path}`;
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
            successContent.schema = { $ref: `#/components/schemas/${resSchemaName}` };
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

  return {
    openapi: "3.0.3",
    info: {
      title: "Huggs ERP Integration API",
      version: "4.0.0",
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
        "## Cache HTTP (ETag — RFC 7232) e Rate Limit (draft-ietf-httpapi-ratelimit-headers)",
        "v3.9.1: documenta os headers `ETag`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Deprecation` e `Sunset` que já eram emitidos pelo runtime desde v3.8.8 (Deprecation/Sunset), v3.8.9 (ETag) e v3.9.0 (RateLimit-*). GETs cacheáveis (`/listar`, `/consultar`, `/status`) aceitam `If-None-Match` e podem responder `304 Not Modified`. SDKs oficiais ≥ v2.18.1 fazem isso automaticamente.",
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
          description: "Payload inválido",
          content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" }, message: { type: "string" }, details: { type: "array", items: { type: "object" } } } } } },
        },
        ErrorUnauthorized: {
          description: "API key ausente ou inválida",
          content: { "application/json": { schema: { type: "object", properties: { error: { type: "string", example: "UNAUTHORIZED" }, message: { type: "string" } } } } },
        },
        ErrorRateLimited: {
          description: "Rate limit excedido",
          headers: {
            "Retry-After": { $ref: "#/components/headers/RetryAfter" },
            "RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
            "RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
            "RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
          },
          content: { "application/json": { schema: { type: "object", properties: { error: { type: "string", example: "RATE_LIMIT" }, message: { type: "string" } } } } },
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
console.log("Status:", health.ok ? "Online" : "Offline");

// 2. Listar fornecedores
const fornecedores = await fetch(\`\${BASE}/erp-fornecedores-query/\`, {
  headers: { "x-api-key": API_KEY }
});
const { fornecedores: lista } = await fornecedores.json();
console.log(\`\${lista.length} fornecedores encontrados\`);

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
  console.error(\`Erro \${res.status}: \${err.message}\`);
} else {
  console.log("Título criado:", await res.json());
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
