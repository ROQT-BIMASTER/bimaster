import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

const BASE_URL_PLACEHOLDER = "https://api.bimaster.online/v1";
const SDK_VERSION = "2.4.0";

function sdkHeader(lang: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const comment = lang === "python" ? "#" : "//";
  return [
    `${comment} BiMaster ERP Integration SDK — ${lang === "python" ? "Python" : lang === "ts" ? "TypeScript" : "JavaScript"}`,
    `${comment} Versão do SDK: ${SDK_VERSION}`,
    `${comment} Gerado em: ${date}`,
    `${comment} Endpoints cobertos: 31 de 37 disponíveis (6 em desenvolvimento)`,
    `${comment} Documentação: https://bimaster.online/dashboard/integracao-erp`,
    "",
  ].join("\n");
}

function generateTsSDK(): string {
  return `${sdkHeader("ts")}
// ═══════════════════════════════════════
// EXCEÇÕES TIPADAS
// ═══════════════════════════════════════

export class HuggsAPIError extends Error {
  status: number;
  code: string;
  data: Record<string, unknown>;

  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(\`HTTP \${status}: \${message}\`);
    this.name = "HuggsAPIError";
    this.status = status;
    this.code = (data.error as string) || "unknown";
    this.data = data;
  }
}

export class HuggsValidationError extends HuggsAPIError {
  constructor(message: string, data: Record<string, unknown> = {}) {
    super(400, message, data);
    this.name = "HuggsValidationError";
  }
}

export class HuggsAuthError extends HuggsAPIError {
  constructor(message: string, data: Record<string, unknown> = {}) {
    super(401, message, data);
    this.name = "HuggsAuthError";
  }
}

export class HuggsConflictError extends HuggsAPIError {
  constructor(message: string, data: Record<string, unknown> = {}) {
    super(409, message, data);
    this.name = "HuggsConflictError";
  }
}

export class HuggsRateLimitError extends HuggsAPIError {
  retryAfter: number;
  constructor(retryAfter: number = 60) {
    super(429, \`Rate limit excedido. Retry após \${retryAfter}s\`);
    this.name = "HuggsRateLimitError";
    this.retryAfter = retryAfter;
  }
}

// ═══════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════

export enum RegimeApuracao {
  COMPETENCIA = "Competência",
  CAIXA = "Caixa",
}

export enum TipoEmpresa {
  MATRIZ = "Matriz",
  FILIAL = "Filial",
  COLIGADA = "Coligada",
}

export enum Porte {
  ME = "ME",
  EPP = "EPP",
  DEMAIS = "Demais",
}

export enum StatusTitulo {
  PENDENTE = "pendente",
  PAGO = "pago",
  VENCIDO = "vencido",
  CANCELADO = "cancelado",
}

export enum TipoCategoria {
  RECEITA = "receita",
  DESPESA = "despesa",
}

export enum WebhookEvent {
  CP_CRIADO = "conta_pagar.criado",
  CP_ALTERADO = "conta_pagar.alterado",
  CP_EXCLUIDO = "conta_pagar.excluido",
  CP_PAGO = "conta_pagar.pago",
  CR_CRIADO = "conta_receber.criado",
  CR_ALTERADO = "conta_receber.alterado",
  CR_RECEBIDO = "conta_receber.recebido",
  CLIENTE_CRIADO = "cliente.criado",
  CLIENTE_ALTERADO = "cliente.alterado",
  FORNECEDOR_CRIADO = "fornecedor.criado",
  FORNECEDOR_ALTERADO = "fornecedor.alterado",
}

// ═══════════════════════════════════════
// INTERFACES — Payloads de Entrada
// ═══════════════════════════════════════

export interface CpIncluirPayload {
  codigo_lancamento_integracao: string;
  codigo_cliente_fornecedor: string | number;
  data_vencimento: string; // Entrada: DD/MM/AAAA ou YYYY-MM-DD. Saída: ISO 8601
  valor_documento: number;
  codigo_categoria: string; // Ex: "2.04.01"
  data_previsao?: string;
  id_conta_corrente?: string | number;
  numero_documento?: string;
  numero_documento_fiscal?: string;
  chave_nfe?: string; // Chave de acesso NFe (44 caracteres)
  observacao?: string;
  codigo_projeto?: string | number;
  empresa_id?: string | number;
}

export interface CpAlterarPayload {
  codigo_lancamento_integracao: string;
  valor_documento?: number;
  data_vencimento?: string;
  codigo_categoria?: string;
  observacao?: string;
  data_previsao?: string;
}

export interface CpUpsertPayload extends CpIncluirPayload {
  empresa_id: string | number; // Obrigatório para resolver conflito
}

export interface CpUpsertLotePayload {
  lote: number;
  conta_pagar_cadastro: CpUpsertPayload[];
}

export interface CpLancarPagamentoPayload {
  codigo_lancamento_integracao: string;
  valor: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  data: string; // DD/MM/AAAA
  observacao?: string;
  /** Se omitido, debita da conta corrente padrão da empresa. */
  id_conta_corrente?: string | number;
}

export interface CpCancelarPagamentoPayload {
  codigo_baixa: string;
}

export interface CrIncluirPayload {
  codigo_lancamento_integracao: string;
  codigo_cliente_fornecedor: string | number;
  data_vencimento: string; // Entrada: DD/MM/AAAA ou YYYY-MM-DD. Saída: ISO 8601
  valor_documento: number;
  codigo_categoria: string;
  data_previsao?: string;
  id_conta_corrente?: string | number;
  numero_documento?: string;
  observacao?: string;
  numero_pedido?: string;
  numero_contrato?: string;
  numero_ordem_servico?: string;
  empresa_id?: string | number;
}

export interface CrAlterarPayload {
  codigo_lancamento_integracao: string;
  valor_documento?: number;
  data_vencimento?: string;
  codigo_categoria?: string;
  observacao?: string;
  data_previsao?: string;
}

export interface CrUpsertPayload extends CrIncluirPayload {
  empresa_id: string | number;
}

export interface CrUpsertLotePayload {
  lote: number;
  conta_receber_cadastro: CrUpsertPayload[];
}

export interface CrRecebimentoPayload {
  codigo_lancamento_integracao: string;
  valor: number;
  data: string; // DD/MM/AAAA
  desconto?: number;
  juros?: number;
  multa?: number;
  observacao?: string;
  /** Se omitido, credita na conta corrente padrão da empresa. */
  id_conta_corrente?: string | number;
}

export interface CrCancelarRecebimentoPayload {
  codigo_baixa: string;
}

export interface ClientePayload {
  razao_social: string;
  codigo_cliente_integracao?: string;
  nome_fantasia?: string;
  /**
   * RECOMENDADO para /upsert: Sem cnpj_cpf, o upsert não consegue identificar 
   * duplicidade e sempre criará novo registro (comportamento igual a /incluir).
   */
  cnpj_cpf?: string;
  email?: string;
  telefone1_numero?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  endereco?: string;
}

export interface ContaCorrentePayload {
  descricao: string;
  tipo?: string;
  saldo_inicial?: number;
  banco_codigo?: string;
  agencia?: string;
  conta?: string;
}

export interface EmpresaIncluirPayload {
  razao_social: string;
  /** 
   * RECOMENDADO: Sem CNPJ, a empresa não pode ser vinculada a operações fiscais,
   * fornecedores ou relatórios tributários. A empresa ficará em estado parcial.
   */
  cnpj?: string;
  nome_fantasia?: string;
  codigo_empresa_integracao?: string;
  codigo_erp?: string;
  /**
   * RECOMENDADO: Afeta cálculo do DRE e relatórios financeiros.
   * Se omitido, padrão: 'Competência'.
   */
  regime_apuracao?: 'Competência' | 'Caixa';
  /**
   * RECOMENDADO: Define hierarquia multi-empresa.
   */
  tipo_empresa?: 'Matriz' | 'Filial' | 'Coligada';
  natureza_juridica?: string;
  porte?: 'ME' | 'EPP' | 'Demais';
  capital_social?: number;
  data_abertura?: string;
  codigo_ibge_municipio?: number;
  responsavel_nome?: string;
  responsavel_cpf?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario?: string;
  endereco?: string;
  endereco_numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  email?: string;
  telefone1_ddd?: string;
  telefone1_numero?: string;
}

export interface EmpresaAlterarPayload {
  codigo_empresa: string | number;
  razao_social?: string;
  nome_fantasia?: string;
  regime_apuracao?: string;
  porte?: string;
  [key: string]: unknown;
}

export interface FornecedorPayload {
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia?: string;
  codigo_integracao?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string; // UF 2 chars
  cep?: string; // 8 chars sem pontuação
  inscricao_estadual?: string;
  /**
   * RECOMENDADO: Sem vinculação a pelo menos uma empresa, o fornecedor não aparece 
   * em listagens filtradas e não pode ser referenciado em títulos de CP.
   */
  empresa_ids?: (string | number)[];
}

export interface WebhookSubscribePayload {
  url: string;
  events: string[]; // Ex: ["conta_pagar.criado", "conta_pagar.alterado"]
  /** 
   * SEGURANÇA: Fortemente recomendado. Sem secret, qualquer POST para sua URL será 
   * aceito como legítimo. Com secret, o BiMaster assina cada payload com HMAC-SHA256 
   * (header x-hub-signature-256) permitindo validação de autenticidade.
   */
  secret?: string;
}

export interface CategoriaPayload {
  codigo_categoria: string; // Hierárquico: "2.04.01"
  descricao: string;
  tipo: 'receita' | 'despesa';
  categoria_pai?: string; // Código da categoria pai
}

// ═══════════════════════════════════════
// INTERFACES — Respostas Tipadas
// ═══════════════════════════════════════

export interface ApiStatusResponse {
  status: string;
  version?: string;
  timestamp?: string;
  service?: string;
  health?: {
    db_latency_ms: number;
    db_connected: boolean;
    active_sync_slots: number;
  };
  meta?: MetaEnvelope;
}

export interface MetaEnvelope {
  request_id: string;
  api_version: string;
  processed_at: string;
  duration_ms: number;
}

export interface CpMutationResponse {
  codigo_lancamento_huggs?: number | null;
  codigo_lancamento_integracao: string;
  codigo_status: string;
  descricao_status: string;
}

export interface CpLoteResponse {
  lote: number;
  codigo_status: string;
  descricao_status: string;
}

export interface CpPagamentoResponse {
  codigo_lancamento_integracao: string;
  codigo_baixa: string;
  liquidado: string;
  valor_baixado: number;
  codigo_status: string;
  descricao_status: string;
}

export interface PaginatedResponse<T> {
  pagina: number;
  total_de_paginas: number;
  registros: number;
  total_de_registros: number;
}

export interface PaginatedCpResponse<T> extends PaginatedResponse<T> {
  conta_pagar_cadastro: T[];
}

export interface PaginatedCrResponse<T> extends PaginatedResponse<T> {
  conta_receber_cadastro: T[];
}

export interface ClienteResponse {
  codigo_cliente: string | number;
  codigo_cliente_integracao?: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf?: string;
  codigo_status: string;
  descricao_status: string;
}

export interface ContaCorrenteResponse {
  id: string | number;
  descricao: string;
  tipo?: string;
  saldo?: number;
  banco_codigo?: string;
  agencia?: string;
  conta?: string;
}

export interface BoletoResponse {
  id: string;
  conta_receber_id: string;
  status: string;
  url_boleto?: string;
  linha_digitavel?: string;
  valor: number;
  vencimento: string;
}

export interface EmpresaResponse {
  codigo_empresa: string | number;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  codigo_status: string;
  descricao_status: string;
}

// ═══════════════════════════════════════
// INTERFACES — Respostas Tipadas v2.4.0
// ═══════════════════════════════════════

export interface CpConsultarResponse {
  conta_pagar_cadastro: {
    id: string;
    codigo_lancamento_integracao: string;
    codigo_lancamento_huggs?: number | null;
    valor_documento: number;
    valor_aberto: number;
    data_vencimento: string;
    data_emissao?: string;
    status: string;
    fornecedor_nome?: string;
    fornecedor_codigo?: string;
    categoria_nome?: string;
    observacao?: string;
  };
  meta?: MetaEnvelope;
}

export interface CpPagamentosResponse {
  data: Array<{
    id: string;
    conta_pagar_id: string;
    valor_pago: number;
    data_pagamento: string;
    metodo_pagamento?: string;
    observacao?: string;
    created_at: string;
  }>;
  pagination: { total: number; offset: number; limit: number };
  meta?: MetaEnvelope;
}

export interface CpParcelasResponse {
  data: Array<{
    id: string;
    conta_pagar_id: string;
    numero: number;
    valor: number;
    data_vencimento: string;
    status: string;
  }>;
  meta?: MetaEnvelope;
}

export interface WebhookSubscriptionResponse {
  id: string;
  url: string;
  events: string[];
  status: string;
  created_at: string;
}

export interface ListarParams {
  pagina?: number;
  registros_por_pagina?: number;
  apenas_importado_api?: string;
  filtrar_por_status?: string;
  filtrar_por_data_de?: string;
  filtrar_por_data_ate?: string;
  filtrar_por_emissao_de?: string;
  filtrar_por_emissao_ate?: string;
  filtrar_conta_corrente?: string;
  filtrar_cliente?: string;
  filtrar_por_cpf_cnpj?: string;
  filtrar_por_projeto?: string;
  filtrar_por_vendedor?: string;
  ordenar_por?: string;
  ordem_descrescente?: string;
  exibir_obs?: string;
}

export interface QueryParams {
  empresa_id?: string;
  fornecedor_codigo?: string;
  status?: string;
  vencimento_de?: string;
  vencimento_ate?: string;
  emissao_de?: string;
  emissao_ate?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
}

export interface CpEstornarPayload {
  id: string;
  motivo: string;
  valor_estorno?: number;
}

export interface CpRegistrarPagamentoPayload {
  conta_pagar_id: string;
  valor_pago: number;
  data_pagamento?: string;
  metodo_pagamento?: string;
  observacao?: string;
}

// ═══════════════════════════════════════
// SDK CLASS
// ═══════════════════════════════════════

export class HuggsERP {
  private apiKey: string;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, baseUrl: string = "${BASE_URL_PLACEHOLDER}") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };
  }

  private async _request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const reqHeaders: Record<string, string> = { ...this.headers };
    // Auto-generate idempotency key for mutating requests
    if (method === "POST" || method === "PUT") {
      reqHeaders["X-Idempotency-Key"] = crypto.randomUUID();
    }
    const opts: RequestInit = { method, headers: reqHeaders, signal: controller.signal };
    if (body && method !== "GET") opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      let data: any;
      try { data = await res.json(); } catch { data = { message: res.statusText }; }
      if (!res.ok) {
        const msg = data.message || data.error || res.statusText;
        switch (res.status) {
          case 400: throw new HuggsValidationError(msg, data);
          case 401: throw new HuggsAuthError(msg, data);
          case 409: throw new HuggsConflictError(msg, data);
          case 429:
            const retry = parseInt(res.headers.get("Retry-After") || "60");
            throw new HuggsRateLimitError(retry);
          default: throw new HuggsAPIError(res.status, msg, data);
        }
      }
      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Retry automático com backoff exponencial para 429 e 5xx. */
  private async _requestWithRetry<T = unknown>(
    method: string, path: string, body?: unknown, maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this._request<T>(method, path, body);
      } catch (error) {
        if (error instanceof HuggsRateLimitError) {
          if (attempt === maxRetries - 1) throw error;
          await new Promise(r => setTimeout(r, error.retryAfter * 1000));
        } else if (error instanceof HuggsAPIError && error.status >= 500) {
          if (attempt === maxRetries - 1) throw error;
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        } else {
          throw error;
        }
      }
    }
    throw new HuggsAPIError(0, "Max retries exceeded");
  }

  private _validate(rules: Array<{ condition: boolean; message: string }>): void {
    for (const rule of rules) {
      if (rule.condition) {
        throw new HuggsValidationError(rule.message);
      }
    }
  }

  // ===== Health Check Geral =====
  async healthCheck(): Promise<{ status: string; latency_ms: number }> {
    const start = Date.now();
    const result = await this._request<ApiStatusResponse>("GET", "/contas-pagar-api/status");
    return { status: result.status, latency_ms: Date.now() - start };
  }

  // ===== Contas a Pagar =====
  async cpStatus(): Promise<ApiStatusResponse> { return this._request("GET", "/contas-pagar-api/status"); }
  async cpListar(params?: ListarParams): Promise<PaginatedCpResponse<Record<string, unknown>>> {
    const p = params || {};
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    return this._request("GET", \`/contas-pagar-api/listar?\${qs.toString()}\`);
  }
  async cpIncluir(titulo: CpIncluirPayload): Promise<CpMutationResponse> {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
      { condition: !!(titulo.chave_nfe && titulo.chave_nfe.length !== 44), message: "chave_nfe deve ter exatamente 44 caracteres" },
    ]);
    return this._request("POST", "/contas-pagar-api/incluir", titulo);
  }
  async cpAlterar(titulo: CpAlterarPayload): Promise<CpMutationResponse> { return this._request("PUT", "/contas-pagar-api/alterar", titulo); }
  async cpExcluir(codigo: string): Promise<CpMutationResponse> {
    return this._request("DELETE", \`/contas-pagar-api/excluir?codigo_lancamento_integracao=\${encodeURIComponent(codigo)}\`);
  }
  async cpUpsert(titulo: CpUpsertPayload): Promise<CpMutationResponse> {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
      { condition: !!(titulo.chave_nfe && titulo.chave_nfe.length !== 44), message: "chave_nfe deve ter exatamente 44 caracteres" },
      { condition: !titulo.empresa_id, message: "empresa_id é obrigatório para upsert" },
    ]);
    return this._request("POST", "/contas-pagar-api/upsert", titulo);
  }
  async cpUpsertLote(lote: CpUpsertLotePayload): Promise<CpLoteResponse> { return this._request("POST", "/contas-pagar-api/upsert-lote", lote); }
  async cpLancarPagamento(pagamento: CpLancarPagamentoPayload): Promise<CpPagamentoResponse> {
    this._validate([
      { condition: !pagamento.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: pagamento.valor <= 0, message: "valor deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-pagar-api/lancar-pagamento", pagamento);
  }
  async cpCancelarPagamento(body: CpCancelarPagamentoPayload): Promise<CpMutationResponse> { return this._request("POST", "/contas-pagar-api/cancelar-pagamento", body); }

  // ===== Contas a Pagar — Métodos adicionais v2.4.0 =====
  //
  // GUIA DE USO — Quando usar cada método:
  // ┌──────────────────────┬─────────────────────────────────────────────────────────┐
  // │ cpListar              │ Paginação Huggs (pagina/registros). Use para UI/telas. │
  // │ cpQuery               │ Paginação REST (limit/offset/cursor). Use para ETL.    │
  // │ cpLancarPagamento     │ Baixa estilo Huggs (codigo_lancamento_integracao).     │
  // │ cpRegistrarPagamento  │ Registro direto por UUID (conta_pagar_id).             │
  // │ cpCancelarPagamento   │ Desfazer baixa (reverte status para pendente).         │
  // │ cpEstornar            │ Estorno parcial/total com motivo (auditável).          │
  // │ cpIncluir             │ Criar novo título (erro se já existe).                 │
  // │ cpUpsert              │ Criar ou atualizar (idempotente, empresa_id obrig.).   │
  // └──────────────────────┴─────────────────────────────────────────────────────────┘

  /** Consultar título por ID, código de integração ou código Huggs. */
  async cpConsultar(params: { id?: string; codigo_lancamento_integracao?: string; codigo_lancamento_huggs?: string }): Promise<CpConsultarResponse> {
    this._validate([
      { condition: !params.id && !params.codigo_lancamento_integracao && !params.codigo_lancamento_huggs, message: "Informe ao menos um parâmetro: id, codigo_lancamento_integracao ou codigo_lancamento_huggs" },
    ]);
    const qs = new URLSearchParams();
    if (params.id) qs.set("id", params.id);
    if (params.codigo_lancamento_integracao) qs.set("codigo_lancamento_integracao", params.codigo_lancamento_integracao);
    if (params.codigo_lancamento_huggs) qs.set("codigo_lancamento_huggs", params.codigo_lancamento_huggs);
    return this._request("GET", \`/contas-pagar-api/consultar?\${qs.toString()}\`);
  }

  /** Consulta avançada com filtros, paginação offset e cursor. Use para ETL/relatórios. */
  async cpQuery(params?: QueryParams): Promise<CpPagamentosResponse> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
    }
    return this._request("GET", \`/contas-pagar-api/query?\${qs.toString()}\`);
  }

  /** Estornar pagamento com recálculo de saldo. Suporta estorno parcial. */
  async cpEstornar(body: CpEstornarPayload): Promise<{ success: boolean; message: string; meta?: MetaEnvelope }> {
    this._validate([
      { condition: !body.id, message: "id é obrigatório" },
      { condition: !body.motivo, message: "motivo é obrigatório" },
      { condition: !!(body.valor_estorno && body.valor_estorno <= 0), message: "valor_estorno deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-pagar-api/estornar", body);
  }

  /** Registrar pagamento/baixa direto por UUID (alternativa a cpLancarPagamento). */
  async cpRegistrarPagamento(body: CpRegistrarPagamentoPayload): Promise<{ success: boolean; pagamento_id: string; novo_status: string; valor_aberto: number; meta?: MetaEnvelope }> {
    this._validate([
      { condition: !body.conta_pagar_id, message: "conta_pagar_id é obrigatório" },
      { condition: body.valor_pago <= 0, message: "valor_pago deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-pagar-api/registrar-pagamento", body);
  }

  /** Histórico de pagamentos de um título. Suporta cursor pagination. */
  async cpGetPagamentos(contaPagarId: string, params?: { limit?: number; offset?: number; cursor?: string }): Promise<CpPagamentosResponse> {
    this._validate([
      { condition: !contaPagarId, message: "contaPagarId é obrigatório" },
    ]);
    const qs = new URLSearchParams({ conta_pagar_id: contaPagarId });
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.cursor) qs.set("cursor", params.cursor);
    return this._request("GET", \`/contas-pagar-api/pagamentos?\${qs.toString()}\`);
  }

  /** Consultar parcelas de um título. */
  async cpGetParcelas(contaPagarId: string): Promise<CpParcelasResponse> {
    this._validate([
      { condition: !contaPagarId, message: "contaPagarId é obrigatório" },
    ]);
    return this._request("GET", \`/contas-pagar-api/parcelas?conta_pagar_id=\${contaPagarId}\`);
  }

  // ===== Contas a Receber =====
  async crListar(params?: ListarParams): Promise<PaginatedCrResponse<Record<string, unknown>>> {
    const p = params || {};
    const qs = new URLSearchParams();
    if (p.pagina) qs.set("pagina", String(p.pagina));
    if (p.registros_por_pagina) qs.set("registros_por_pagina", String(p.registros_por_pagina));
    return this._request("GET", \`/contas-receber-api/listar?\${qs.toString()}\`);
  }
  async crIncluir(titulo: CrIncluirPayload): Promise<CpMutationResponse> {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-receber-api/incluir", titulo);
  }
  async crAlterar(titulo: CrAlterarPayload): Promise<CpMutationResponse> { return this._request("PUT", "/contas-receber-api/alterar", titulo); }
  async crUpsert(titulo: CrUpsertPayload): Promise<CpMutationResponse> {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
      { condition: !titulo.empresa_id, message: "empresa_id é obrigatório para upsert" },
    ]);
    return this._request("POST", "/contas-receber-api/upsert", titulo);
  }
  async crUpsertLote(lote: CrUpsertLotePayload): Promise<CpLoteResponse> { return this._request("POST", "/contas-receber-api/upsert-lote", lote); }
  async crLancarRecebimento(recebimento: CrRecebimentoPayload): Promise<CpPagamentoResponse> {
    this._validate([
      { condition: !recebimento.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: recebimento.valor <= 0, message: "valor deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-receber-api/lancar-recebimento", recebimento);
  }
  async crCancelarRecebimento(body: CrCancelarRecebimentoPayload): Promise<CpMutationResponse> { return this._request("POST", "/contas-receber-api/cancelar-recebimento", body); }

  // ===== Clientes =====
  async clientesListar(body?: Record<string, unknown>): Promise<PaginatedResponse<ClienteResponse>> { return this._request("POST", "/clientes-api/listar", body); }
  async clientesIncluir(body: ClientePayload): Promise<ClienteResponse> {
    this._validate([
      { condition: !body.razao_social, message: "razao_social é obrigatório" },
    ]);
    return this._request("POST", "/clientes-api/incluir", body);
  }
  async clientesAlterar(body: Partial<ClientePayload> & { id: string }): Promise<ClienteResponse> { return this._request("POST", "/clientes-api/alterar", body); }
  async clientesUpsert(body: ClientePayload): Promise<ClienteResponse> { return this._request("POST", "/clientes-api/upsert", body); }

  // ===== Contas Correntes =====
  async ccListar(): Promise<ContaCorrenteResponse[]> { return this._request("GET", "/contas-correntes-api/"); }
  async ccIncluir(body: ContaCorrentePayload): Promise<ContaCorrenteResponse> { return this._request("POST", "/contas-correntes-api/incluir", body); }
  async ccUpsertLote(body: { lote: ContaCorrentePayload[] }): Promise<CpLoteResponse> { return this._request("POST", "/contas-correntes-api/upsert-lote", body); }

  // ===== Boletos =====
  async boletoGerar(body: { conta_receber_id: string }): Promise<BoletoResponse> { return this._request("POST", "/boletos-api/gerar", body); }
  async boletoListar(pagina?: number): Promise<PaginatedResponse<BoletoResponse>> { return this._request("GET", \`/boletos-api/listar?pagina=\${pagina || 1}\`); }

  // ===== Empresas (Convenção POST) =====
  // NOTA: A API de Empresas segue a convenção Huggs — todas as operações usam POST,
  // incluindo consultas e listagens. O body JSON substitui query params.
  async empresasIncluir(body: EmpresaIncluirPayload): Promise<EmpresaResponse> {
    this._validate([
      { condition: !body.razao_social, message: "razao_social é obrigatório" },
    ]);
    return this._request("POST", "/empresas-api/incluir", body);
  }
  async empresasAlterar(body: EmpresaAlterarPayload): Promise<EmpresaResponse> { return this._request("POST", "/empresas-api/alterar", body); }
  async empresasConsultar(codigoEmpresa: string | number): Promise<EmpresaResponse> { return this._request("POST", "/empresas-api/consultar", { codigo_empresa: codigoEmpresa }); }
  async empresasListar(pagina = 1, registros = 100): Promise<PaginatedResponse<EmpresaResponse>> { return this._request("POST", "/empresas-api/listar", { pagina, registros_por_pagina: registros }); }

  // ===== Fornecedores (Consulta) =====
  async fornecedoresConsultar(cnpj?: string): Promise<Record<string, unknown>> {
    const qs = cnpj ? \`?cnpj=\${encodeURIComponent(cnpj)}\` : "";
    return this._request("GET", \`/erp-fornecedores-query/\${qs}\`);
  }

  // ===== Fornecedores (Sync) =====
  async fornecedoresIncluir(body: FornecedorPayload): Promise<CpMutationResponse> {
    this._validate([
      { condition: !body.cnpj_cpf, message: "cnpj_cpf é obrigatório" },
      { condition: !body.razao_social, message: "razao_social é obrigatório" },
    ]);
    return this._request("POST", "/erp-fornecedores-sync/incluir", body);
  }
  async fornecedoresAlterar(body: Partial<FornecedorPayload> & { id: number }): Promise<CpMutationResponse> {
    return this._request("POST", "/erp-fornecedores-sync/alterar", body);
  }
  async fornecedoresUpsert(body: FornecedorPayload): Promise<CpMutationResponse> {
    return this._request("POST", "/erp-fornecedores-sync/upsert", body);
  }
  async fornecedoresListar(body?: Record<string, unknown>): Promise<PaginatedResponse<Record<string, unknown>>> {
    return this._request("POST", "/erp-fornecedores-sync/listar", body || {});
  }

  // ===== Categorias (Convenção POST) =====
  // NOTA: A API de Categorias segue a convenção Huggs — todas as operações usam POST.
  async categoriasListar(pagina = 1, registros = 50): Promise<PaginatedResponse<Record<string, unknown>>> {
    return this._request("POST", "/categorias-api/listar", { pagina, registros_por_pagina: registros });
  }
  async categoriasIncluir(body: CategoriaPayload): Promise<CpMutationResponse> {
    return this._request("POST", "/categorias-api/incluir", body);
  }
  async categoriasConsultar(codigo: string): Promise<Record<string, unknown>> {
    return this._request("POST", "/categorias-api/consultar", { codigo_categoria: codigo });
  }

  // ===== Plano de Contas =====
  async planoContasListar(): Promise<Record<string, unknown>[]> {
    return this._request("GET", "/plano-contas-api/listar");
  }

  // ===== Portadores =====
  async portadoresListar(): Promise<Record<string, unknown>[]> {
    return this._request("GET", "/portadores-api/listar");
  }
  async portadoresConsultar(id: number): Promise<Record<string, unknown>> {
    return this._request("GET", \`/portadores-api/consultar?id=\${id}\`);
  }

  // ===== Departamentos (Convenção POST) =====
  // NOTA: A API de Departamentos segue a convenção Huggs — todas as operações usam POST.
  async departamentosListar(pagina = 1, registros = 50): Promise<PaginatedResponse<Record<string, unknown>>> {
    return this._request("POST", "/departamentos-api/listar", { pagina, registros_por_pagina: registros });
  }

  // ===== Projetos (Convenção POST) =====
  // NOTA: A API de Projetos segue a convenção Huggs — todas as operações usam POST.
  async projetosListar(pagina = 1, registros = 50): Promise<PaginatedResponse<Record<string, unknown>>> {
    return this._request("POST", "/projetos-api/listar", { pagina, registros_por_pagina: registros });
  }

  // ===== Países =====
  async paisesListar(filtro?: { filtrar_por_codigo?: string; filtrar_por_descricao?: string }): Promise<{ lista_paises: Array<{ cCodigo: string; cDescricao: string; cCodigoISO: string }> }> {
    return this._request("POST", "/paises-api/listar", filtro || {});
  }

  // ===== Webhooks =====
  async webhookIncluir(body: WebhookSubscribePayload): Promise<WebhookSubscriptionResponse> {
    this._validate([
      { condition: !body.url, message: "url é obrigatório" },
      { condition: !body.events || body.events.length === 0, message: "events é obrigatório e deve ter pelo menos um evento" },
    ]);
    return this._request("POST", "/webhook-subscriptions-api/incluir", body);
  }
  async webhookListar(): Promise<WebhookSubscriptionResponse[]> { return this._request("GET", "/webhook-subscriptions-api/listar"); }

  // ===== Paginação Automática =====
  async fetchAllPages<T>(path: string, key: string = "conta_pagar_cadastro"): Promise<T[]> {
    let pagina = 1;
    const todos: T[] = [];
    while (true) {
      const data = await this._request<Record<string, unknown>>("GET", \`\${path}?pagina=\${pagina}&registros_por_pagina=500\`);
      todos.push(...((data[key] as T[]) || []));
      if (pagina >= ((data.total_de_paginas as number) || 1)) break;
      pagina++;
    }
    return todos;
  }
}

// Uso:
// import { HuggsERP, CpIncluirPayload, HuggsConflictError, WebhookEvent } from "./huggs-erp-sdk";
// const erp = new HuggsERP("huggs-erp-xxxxxxxx", "https://api.bimaster.online/v1");
// const latency = await erp.healthCheck();
// console.log(\`API ok, latência: \${latency.latency_ms}ms\`);
// try {
//   const result = await erp.cpIncluir({ ... });
// } catch (e) {
//   if (e instanceof HuggsConflictError) { /* usar upsert */ }
//   if (e instanceof HuggsRateLimitError) { await sleep(e.retryAfter * 1000); }
// }
// const paises = await erp.paisesListar({ filtrar_por_descricao: "BRASIL" });

export default HuggsERP;
`;
}

function generateJsSDK(): string {
  return `${sdkHeader("js")}
/**
 * SDK oficial para integração com o ERP BiMaster/Huggs.
 * @example
 * const erp = new HuggsERP("huggs-erp-xxxxxxxx", "https://api.bimaster.online/v1");
 * const status = await erp.cpStatus();
 */

// ═══════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════

const RegimeApuracao = Object.freeze({ COMPETENCIA: "Competência", CAIXA: "Caixa" });
const TipoEmpresa = Object.freeze({ MATRIZ: "Matriz", FILIAL: "Filial", COLIGADA: "Coligada" });
const Porte = Object.freeze({ ME: "ME", EPP: "EPP", DEMAIS: "Demais" });
const StatusTitulo = Object.freeze({ PENDENTE: "pendente", PAGO: "pago", VENCIDO: "vencido", CANCELADO: "cancelado" });
const TipoCategoria = Object.freeze({ RECEITA: "receita", DESPESA: "despesa" });
const WebhookEvent = Object.freeze({
  CP_CRIADO: "conta_pagar.criado", CP_ALTERADO: "conta_pagar.alterado",
  CP_EXCLUIDO: "conta_pagar.excluido", CP_PAGO: "conta_pagar.pago",
  CR_CRIADO: "conta_receber.criado", CR_ALTERADO: "conta_receber.alterado",
  CR_RECEBIDO: "conta_receber.recebido",
  CLIENTE_CRIADO: "cliente.criado", CLIENTE_ALTERADO: "cliente.alterado",
  FORNECEDOR_CRIADO: "fornecedor.criado", FORNECEDOR_ALTERADO: "fornecedor.alterado",
});

class HuggsERP {
  /**
   * @param {string} apiKey - Chave de API gerada no portal
   * @param {string} [baseUrl="${BASE_URL_PLACEHOLDER}"] - URL base da API
   */
  constructor(apiKey, baseUrl = "${BASE_URL_PLACEHOLDER}") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Executa uma requisição HTTP com timeout de 30s e tratamento de erros.
   * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
   * @param {string} path - Caminho do endpoint
   * @param {Object} [body=null] - Body JSON da requisição
   * @returns {Promise<Object>} Resposta parseada
   * @throws {Error} Erro com propriedades .status, .code, .data, .retryAfter
   */
  async _request(method, path, body = null) {
    const url = \`\${this.baseUrl}\${path}\`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const opts = { method, headers: this.headers, signal: controller.signal };
    if (body && method !== "GET") opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      let data;
      try { data = await res.json(); } catch { data = { message: res.statusText }; }
      if (!res.ok) {
        const msg = data.message || data.error || res.statusText;
        const err = new Error(\`HTTP \${res.status}: \${msg}\`);
        err.status = res.status;
        err.code = data.error || "unknown";
        err.data = data;
        if (res.status === 429) {
          err.retryAfter = parseInt(res.headers.get("Retry-After") || "60");
        }
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ===== Retry automático =====

  /**
   * Retry automático com backoff exponencial para 429 e 5xx.
   * @param {string} method @param {string} path @param {Object} [body]
   * @param {number} [maxRetries=3]
   * @returns {Promise<Object>}
   */
  async _requestWithRetry(method, path, body = null, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this._request(method, path, body);
      } catch (err) {
        if (err.status === 429) {
          if (attempt === maxRetries - 1) throw err;
          await new Promise(r => setTimeout(r, (err.retryAfter || 60) * 1000));
        } else if (err.status >= 500) {
          if (attempt === maxRetries - 1) throw err;
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        } else {
          throw err;
        }
      }
    }
    const err = new Error("Max retries exceeded");
    err.status = 0;
    throw err;
  }

  _validate(rules) {
    for (const { condition, message } of rules) {
      if (condition) {
        const err = new Error(\`Validação local: \${message}\`);
        err.status = 400;
        err.code = "local_validation";
        throw err;
      }
    }
  }

  // ===== Health Check Geral =====

  /**
   * Health check geral — testa conectividade e mede latência.
   * @returns {Promise<{status: string, latency_ms: number}>}
   */
  async healthCheck() {
    const start = Date.now();
    const result = await this._request("GET", "/contas-pagar-api/status");
    return { status: result.status, latency_ms: Date.now() - start };
  }

  // ===== Contas a Pagar =====

  /** Health check da API de Contas a Pagar. @returns {Promise<{status: string}>} */
  async cpStatus() { return this._request("GET", "/contas-pagar-api/status"); }

  /**
   * Listar contas a pagar com paginação.
   * @param {number} [pagina=1]
   * @param {number} [registros=50]
   * @returns {Promise<{pagina: number, total_de_paginas: number, conta_pagar_cadastro: Object[]}>}
   */
  async cpListar(pagina = 1, registros = 50) {
    return this._request("GET", \`/contas-pagar-api/listar?pagina=\${pagina}&registros_por_pagina=\${registros}\`);
  }

  /**
   * Incluir nova conta a pagar.
   * @param {Object} titulo
    * @param {string} titulo.codigo_lancamento_integracao - ID único do título no seu ERP
    * @param {string|number} titulo.codigo_cliente_fornecedor - Código do fornecedor cadastrado
    * @param {string} titulo.data_vencimento - Data de vencimento (DD/MM/AAAA)
    * @param {number} titulo.valor_documento - Valor em BRL
    * @param {string} titulo.codigo_categoria - Código da categoria (ex: "2.04.01")
    * @param {string|number} [titulo.empresa_id] - ID da empresa (obrigatório no upsert)
   * @param {string} [titulo.chave_nfe] - Chave NFe (44 chars)
   * @param {string} [titulo.numero_documento_fiscal] - Número da NF-e
   * @param {string} [titulo.observacao] - Observações (max 5000 chars)
   * @returns {Promise<{codigo_lancamento_integracao: string, codigo_status: string, descricao_status: string}>}
   */
  async cpIncluir(titulo) {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
      { condition: titulo.chave_nfe && titulo.chave_nfe.length !== 44, message: "chave_nfe deve ter exatamente 44 caracteres" },
    ]);
    return this._request("POST", "/contas-pagar-api/incluir", titulo);
  }

  /**
   * Alterar conta a pagar existente.
   * @param {Object} titulo - Campos a alterar (codigo_lancamento_integracao obrigatório)
   * @returns {Promise<{codigo_lancamento_integracao: string, codigo_status: string, descricao_status: string}>}
   */
  async cpAlterar(titulo) { return this._request("PUT", "/contas-pagar-api/alterar", titulo); }

  /**
   * Excluir conta a pagar por código de integração.
   * @param {string} codigo - codigo_lancamento_integracao
   * @returns {Promise<{codigo_status: string, descricao_status: string}>}
   */
  async cpExcluir(codigo) {
    return this._request("DELETE", \`/contas-pagar-api/excluir?codigo_lancamento_integracao=\${codigo}\`);
  }

  /**
   * Upsert unitário de conta a pagar (cria ou atualiza).
   * @param {Object} titulo - Payload completo (empresa_id obrigatório)
   * @returns {Promise<{codigo_lancamento_integracao: string, codigo_status: string, descricao_status: string}>}
   */
  async cpUpsert(titulo) {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
      { condition: titulo.chave_nfe && titulo.chave_nfe.length !== 44, message: "chave_nfe deve ter exatamente 44 caracteres" },
      { condition: !titulo.empresa_id, message: "empresa_id é obrigatório para upsert" },
    ]);
    return this._request("POST", "/contas-pagar-api/upsert", titulo);
  }

  /**
   * Upsert em lote de contas a pagar (máx 500 registros).
   * @param {Object} lote - { lote: number, conta_pagar_cadastro: Object[] }
   * @returns {Promise<{lote: number, codigo_status: string, descricao_status: string}>}
   */
  async cpUpsertLote(lote) { return this._request("POST", "/contas-pagar-api/upsert-lote", lote); }

  /**
   * Registrar pagamento/baixa.
   * PRÉ-CONDIÇÃO: Título deve existir e estar com status "pendente" ou "vencido".
   * @param {Object} pagamento
   * @param {string} pagamento.codigo_lancamento_integracao
   * @param {number} pagamento.valor
   * @param {string} pagamento.data - DD/MM/AAAA
    * @param {string|number} [pagamento.id_conta_corrente] - Se omitido, debita da conta padrão
    * @param {number} [pagamento.desconto]
   * @param {number} [pagamento.juros]
   * @param {number} [pagamento.multa]
   * @returns {Promise<{codigo_baixa: string, liquidado: string, valor_baixado: number}>}
   */
  async cpLancarPagamento(pagamento) {
    this._validate([
      { condition: !pagamento.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: pagamento.valor <= 0, message: "valor deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-pagar-api/lancar-pagamento", pagamento);
  }

  /**
   * Cancelar pagamento.
   * @param {Object} body - { codigo_baixa: string }
   * @returns {Promise<{codigo_status: string, descricao_status: string}>}
   */
  async cpCancelarPagamento(body) { return this._request("POST", "/contas-pagar-api/cancelar-pagamento", body); }

  // ===== Contas a Receber =====

  /**
   * Listar contas a receber com paginação.
   * @param {number} [pagina=1]
   * @param {number} [registros=50]
   * @returns {Promise<{pagina: number, total_de_paginas: number, conta_receber_cadastro: Object[]}>}
   */
  async crListar(pagina = 1, registros = 50) {
    return this._request("GET", \`/contas-receber-api/listar?pagina=\${pagina}&registros_por_pagina=\${registros}\`);
  }

  /**
   * Incluir nova conta a receber.
   * @param {Object} titulo
    * @param {string} titulo.codigo_lancamento_integracao
    * @param {string|number} titulo.codigo_cliente_fornecedor
   * @param {string} titulo.data_vencimento - DD/MM/AAAA
   * @param {number} titulo.valor_documento
   * @param {string} titulo.codigo_categoria
   * @param {string} [titulo.observacao]
   * @param {string} [titulo.numero_pedido]
   * @param {string} [titulo.numero_contrato]
   * @param {string} [titulo.numero_ordem_servico]
   * @returns {Promise<{codigo_lancamento_integracao: string, codigo_status: string, descricao_status: string}>}
   */
  async crIncluir(titulo) {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-receber-api/incluir", titulo);
  }

  /** @param {Object} titulo - Campos a alterar */
  async crAlterar(titulo) { return this._request("PUT", "/contas-receber-api/alterar", titulo); }

  /** @param {Object} titulo - Payload completo (empresa_id obrigatório) */
  async crUpsert(titulo) {
    this._validate([
      { condition: !titulo.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: titulo.valor_documento <= 0, message: "valor_documento deve ser maior que zero" },
      { condition: !titulo.empresa_id, message: "empresa_id é obrigatório para upsert" },
    ]);
    return this._request("POST", "/contas-receber-api/upsert", titulo);
  }

  /** @param {Object} lote - { lote: number, conta_receber_cadastro: Object[] } */
  async crUpsertLote(lote) { return this._request("POST", "/contas-receber-api/upsert-lote", lote); }

  /**
   * Registrar recebimento/baixa.
   * @param {Object} recebimento - { codigo_lancamento_integracao, valor, data }
   */
  async crLancarRecebimento(recebimento) {
    this._validate([
      { condition: !recebimento.codigo_lancamento_integracao, message: "codigo_lancamento_integracao é obrigatório" },
      { condition: recebimento.valor <= 0, message: "valor deve ser maior que zero" },
    ]);
    return this._request("POST", "/contas-receber-api/lancar-recebimento", recebimento);
  }

  /** @param {Object} body - { codigo_baixa: string } */
  async crCancelarRecebimento(body) { return this._request("POST", "/contas-receber-api/cancelar-recebimento", body); }

  // ===== Clientes =====

  /** @param {Object} [body] - Filtros de listagem */
  async clientesListar(body) { return this._request("POST", "/clientes-api/listar", body); }

  /** @param {Object} body - Dados do cliente (razao_social obrigatório) */
  async clientesIncluir(body) {
    this._validate([
      { condition: !body.razao_social, message: "razao_social é obrigatório" },
    ]);
    return this._request("POST", "/clientes-api/incluir", body);
  }

  /** @param {Object} body - Campos a alterar (id obrigatório) */
  async clientesAlterar(body) { return this._request("POST", "/clientes-api/alterar", body); }

  /** @param {Object} body - Payload completo para upsert */
  async clientesUpsert(body) { return this._request("POST", "/clientes-api/upsert", body); }

  // ===== Contas Correntes =====

  /** @returns {Promise<Object[]>} Lista de contas correntes */
  async ccListar() { return this._request("GET", "/contas-correntes-api/"); }

  /** @param {Object} body - { descricao, tipo?, saldo_inicial?, banco_codigo?, agencia?, conta? } */
  async ccIncluir(body) { return this._request("POST", "/contas-correntes-api/incluir", body); }

  /** @param {Object} body - { lote: Object[] } */
  async ccUpsertLote(body) { return this._request("POST", "/contas-correntes-api/upsert-lote", body); }

  // ===== Boletos =====

  /** @param {Object} body - { conta_receber_id: string } */
  async boletoGerar(body) { return this._request("POST", "/boletos-api/gerar", body); }

  /** @param {number} [pagina=1] */
  async boletoListar(pagina = 1) { return this._request("GET", \`/boletos-api/listar?pagina=\${pagina}\`); }

  // ===== Empresas (Convenção POST) =====
  // NOTA: A API de Empresas segue a convenção Huggs — todas as operações usam POST,
  // incluindo consultas e listagens. O body JSON substitui query params.

  /** @param {Object} body - Dados da empresa (razao_social obrigatório) */
  async empresasIncluir(body) {
    this._validate([
      { condition: !body.razao_social, message: "razao_social é obrigatório" },
    ]);
    return this._request("POST", "/empresas-api/incluir", body);
  }

  /** @param {Object} body - Campos a alterar (codigo_empresa obrigatório) */
  async empresasAlterar(body) { return this._request("POST", "/empresas-api/alterar", body); }

  /**
   * Consultar empresa por código.
    * @param {string|number} codigoEmpresa
    * @returns {Promise<{codigo_empresa: string|number, razao_social: string, cnpj?: string}>}
   */
  async empresasConsultar(codigoEmpresa) { return this._request("POST", "/empresas-api/consultar", { codigo_empresa: codigoEmpresa }); }

  /** @param {number} [pagina=1] @param {number} [registros=100] */
  async empresasListar(pagina = 1, registros = 100) { return this._request("POST", "/empresas-api/listar", { pagina, registros_por_pagina: registros }); }

  // ===== Fornecedores =====

  /**
   * Consultar fornecedores ativos. Subset do cadastro de Clientes.
   * @param {string} [cnpj] - Filtrar por CNPJ (sem pontuação)
   * @returns {Promise<Object>}
   */
  async fornecedoresConsultar(cnpj) {
    const qs = cnpj ? \`?cnpj=\${encodeURIComponent(cnpj)}\` : "";
    return this._request("GET", \`/erp-fornecedores-query/\${qs}\`);
  }

  /**
   * Incluir novo fornecedor via sync bidirecional com ERP.
   * @param {Object} body
   * @param {string} body.cnpj_cpf - CPF ou CNPJ (sem pontuação, obrigatório)
   * @param {string} body.razao_social - Razão social (obrigatório)
   * @param {string} [body.nome_fantasia]
   * @param {string} [body.codigo_integracao] - Código do fornecedor no ERP externo
   * @param {string} [body.email]
   * @param {string} [body.estado] - UF (2 chars, ex: "SP")
   * @param {string} [body.cep] - CEP (8 chars, sem pontuação)
   * @param {Array<string|number>} [body.empresa_ids] - IDs das empresas para vinculação
   * @returns {Promise<{codigo_status: string, descricao_status: string}>}
   */
  async fornecedoresIncluir(body) {
    this._validate([
      { condition: !body.cnpj_cpf, message: "cnpj_cpf é obrigatório" },
      { condition: !body.razao_social, message: "razao_social é obrigatório" },
    ]);
    return this._request("POST", "/erp-fornecedores-sync/incluir", body);
  }

  /**
   * Alterar fornecedor existente.
   * @param {Object} body - Campos a alterar (id obrigatório)
   * @returns {Promise<{codigo_status: string, descricao_status: string}>}
   */
  async fornecedoresAlterar(body) { return this._request("POST", "/erp-fornecedores-sync/alterar", body); }

  /**
   * Upsert de fornecedor (cria ou atualiza por cnpj_cpf).
   * @param {Object} body - Payload completo
   * @returns {Promise<{codigo_status: string, descricao_status: string}>}
   */
  async fornecedoresUpsert(body) { return this._request("POST", "/erp-fornecedores-sync/upsert", body); }

  /**
   * Listar fornecedores cadastrados.
   * @param {Object} [body={}] - Filtros de listagem
   * @returns {Promise<Object>}
   */
  async fornecedoresListar(body) { return this._request("POST", "/erp-fornecedores-sync/listar", body || {}); }

  // ===== Categorias (Convenção POST) =====
  // NOTA: A API de Categorias segue a convenção Huggs — todas as operações usam POST.

  /**
   * Listar categorias financeiras com paginação.
   * NOTA: Segue convenção Huggs — usa POST para listagem.
   * @param {number} [pagina=1] - Número da página
   * @param {number} [registros=50] - Registros por página
   * @returns {Promise<{pagina: number, total_de_paginas: number}>}
   */
  async categoriasListar(pagina = 1, registros = 50) {
    return this._request("POST", "/categorias-api/listar", { pagina, registros_por_pagina: registros });
  }

  /**
   * Incluir nova categoria financeira.
   * @param {Object} body - Dados da categoria
   * @param {string} body.codigo_categoria - Código hierárquico (ex: "2.04.01")
   * @param {string} body.descricao - Descrição da categoria
   * @returns {Promise<{codigo_status: string, descricao_status: string}>}
   */
  async categoriasIncluir(body) { return this._request("POST", "/categorias-api/incluir", body); }

  /**
   * Consultar categoria por código.
   * @param {string} codigo - Código da categoria (ex: "2.04.01")
   * @returns {Promise<Object>}
   */
  async categoriasConsultar(codigo) { return this._request("POST", "/categorias-api/consultar", { codigo_categoria: codigo }); }

  // ===== Plano de Contas =====

  /**
   * Listar plano de contas (estrutura contábil oficial).
   * NOTA: Diferente de Categorias — Plano de Contas é a classificação contábil,
   * Categorias são agrupamentos internos do BiMaster.
   * @returns {Promise<Object[]>}
   */
  async planoContasListar() { return this._request("GET", "/plano-contas-api/listar"); }

  // ===== Portadores =====

  /**
   * Listar portadores/contas bancárias disponíveis para pagamento.
   * @returns {Promise<Object[]>}
   */
  async portadoresListar() { return this._request("GET", "/portadores-api/listar"); }

  /**
   * Consultar portador por ID.
   * @param {number} id - ID do portador
   * @returns {Promise<Object>}
   */
  async portadoresConsultar(id) { return this._request("GET", \`/portadores-api/consultar?id=\${id}\`); }

  // ===== Departamentos (Convenção POST) =====

  /**
   * Listar departamentos/centros de custo com paginação.
   * NOTA: Segue convenção Huggs — usa POST para listagem.
   * @param {number} [pagina=1]
   * @param {number} [registros=50]
   * @returns {Promise<{pagina: number, total_de_paginas: number}>}
   */
  async departamentosListar(pagina = 1, registros = 50) {
    return this._request("POST", "/departamentos-api/listar", { pagina, registros_por_pagina: registros });
  }

  // ===== Projetos (Convenção POST) =====

  /**
   * Listar projetos com paginação.
   * NOTA: Segue convenção Huggs — usa POST para listagem.
   * @param {number} [pagina=1]
   * @param {number} [registros=50]
   * @returns {Promise<{pagina: number, total_de_paginas: number}>}
   */
  async projetosListar(pagina = 1, registros = 50) {
    return this._request("POST", "/projetos-api/listar", { pagina, registros_por_pagina: registros });
  }

  // ===== Países =====

  /**
   * Listar países cadastrados (lista estática).
   * @param {Object} [filtro] - Filtros opcionais
   * @param {string} [filtro.filtrar_por_codigo] - Filtrar por código do país
   * @param {string} [filtro.filtrar_por_descricao] - Filtrar por descrição
   * @returns {Promise<{lista_paises: Array<{cCodigo: string, cDescricao: string, cCodigoISO: string}>}>}
   */
  async paisesListar(filtro = {}) {
    return this._request("POST", "/paises-api/listar", filtro);
  }

  // ===== Webhooks =====

  /**
   * Criar assinatura de webhook.
   * @param {Object} body
   * @param {string} body.url - URL HTTPS do seu servidor
   * @param {string[]} body.events - Eventos (ex: ["conta_pagar.criado"])
   * @param {string} [body.secret] - Secret para HMAC
   * @returns {Promise<{id: string, url: string, events: string[], status: string}>}
   */
  async webhookIncluir(body) {
    this._validate([
      { condition: !body.url, message: "url é obrigatório" },
      { condition: !body.events || body.events.length === 0, message: "events é obrigatório e deve ter pelo menos um evento" },
    ]);
    return this._request("POST", "/webhook-subscriptions-api/incluir", body);
  }

  /** @returns {Promise<Object[]>} Lista de assinaturas */
  async webhookListar() { return this._request("GET", "/webhook-subscriptions-api/listar"); }

  // ===== Paginação Automática =====

  /**
   * Buscar todos os registros percorrendo todas as páginas automaticamente.
   * @param {string} path - Caminho do endpoint (ex: "/contas-pagar-api/listar")
   * @param {string} [key="conta_pagar_cadastro"] - Nome do array de resultados
   * @returns {Promise<Object[]>}
   */
  async fetchAllPages(path, key = "conta_pagar_cadastro") {
    let pagina = 1;
    const todos = [];
    while (true) {
      const data = await this._request("GET", \`\${path}?pagina=\${pagina}&registros_por_pagina=500\`);
      todos.push(...(data[key] || []));
      if (pagina >= (data.total_de_paginas || 1)) break;
      pagina++;
    }
    return todos;
  }
}

// Uso:
// const erp = new HuggsERP("huggs-erp-xxxxxxxx", "https://api.bimaster.online/v1");
// const hc = await erp.healthCheck();
// console.log(\`API ok, latência: \${hc.latency_ms}ms\`);
// const paises = await erp.paisesListar({ filtrar_por_descricao: "BRASIL" });
// try {
//   const result = await erp.cpIncluir({ ... });
// } catch (err) {
//   if (err.status === 429) await new Promise(r => setTimeout(r, err.retryAfter * 1000));
// }

export default HuggsERP;
`;
}

function generatePySDK(): string {
  return `${sdkHeader("python")}
# Requer: pip install requests

import requests
import time
from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass, asdict
from enum import Enum


# ═══════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════

class RegimeApuracao(str, Enum):
    COMPETENCIA = "Competência"
    CAIXA = "Caixa"

class TipoEmpresa(str, Enum):
    MATRIZ = "Matriz"
    FILIAL = "Filial"
    COLIGADA = "Coligada"

class Porte(str, Enum):
    ME = "ME"
    EPP = "EPP"
    DEMAIS = "Demais"

class StatusTitulo(str, Enum):
    PENDENTE = "pendente"
    PAGO = "pago"
    VENCIDO = "vencido"
    CANCELADO = "cancelado"

class TipoCategoria(str, Enum):
    RECEITA = "receita"
    DESPESA = "despesa"

class WebhookEvent(str, Enum):
    CP_CRIADO = "conta_pagar.criado"
    CP_ALTERADO = "conta_pagar.alterado"
    CP_EXCLUIDO = "conta_pagar.excluido"
    CP_PAGO = "conta_pagar.pago"
    CR_CRIADO = "conta_receber.criado"
    CR_ALTERADO = "conta_receber.alterado"
    CR_RECEBIDO = "conta_receber.recebido"
    CLIENTE_CRIADO = "cliente.criado"
    CLIENTE_ALTERADO = "cliente.alterado"
    FORNECEDOR_CRIADO = "fornecedor.criado"
    FORNECEDOR_ALTERADO = "fornecedor.alterado"


# ═══════════════════════════════════════
# DATACLASSES TIPADAS — Payloads
# ═══════════════════════════════════════

@dataclass
class CpIncluirPayload:
    """Payload para incluir Conta a Pagar."""
    codigo_lancamento_integracao: str
    codigo_cliente_fornecedor: Union[str, int]
    data_vencimento: str  # Entrada: DD/MM/AAAA ou YYYY-MM-DD. Saída: ISO 8601
    valor_documento: float
    codigo_categoria: str  # Ex: "2.04.01"
    data_previsao: Optional[str] = None
    id_conta_corrente: Optional[Union[str, int]] = None
    numero_documento: Optional[str] = None
    numero_documento_fiscal: Optional[str] = None
    chave_nfe: Optional[str] = None  # Chave de acesso NFe (44 caracteres)
    observacao: Optional[str] = None
    empresa_id: Optional[Union[str, int]] = None
    codigo_projeto: Optional[Union[str, int]] = None

@dataclass
class CpAlterarPayload:
    """Payload para alterar Conta a Pagar."""
    codigo_lancamento_integracao: str
    valor_documento: Optional[float] = None
    data_vencimento: Optional[str] = None
    codigo_categoria: Optional[str] = None
    observacao: Optional[str] = None
    data_previsao: Optional[str] = None

@dataclass
class CpUpsertPayload(CpIncluirPayload):
    """Payload para upsert — empresa_id é obrigatório."""
    empresa_id: Union[str, int] = ""  # Obrigatório para resolver conflito

@dataclass
class CpPagamentoPayload:
    """Payload para lançar pagamento/baixa."""
    codigo_lancamento_integracao: str
    valor: float
    data: str  # DD/MM/AAAA
    desconto: float = 0
    juros: float = 0
    multa: float = 0
    observacao: Optional[str] = None
    id_conta_corrente: Optional[Union[str, int]] = None  # Se omitido, usa conta padrão da empresa

@dataclass
class CrIncluirPayload:
    """Payload para incluir Conta a Receber."""
    codigo_lancamento_integracao: str
    codigo_cliente_fornecedor: Union[str, int]
    data_vencimento: str  # Entrada: DD/MM/AAAA ou YYYY-MM-DD. Saída: ISO 8601
    valor_documento: float
    codigo_categoria: str
    data_previsao: Optional[str] = None
    id_conta_corrente: Optional[Union[str, int]] = None
    numero_documento: Optional[str] = None
    observacao: Optional[str] = None
    numero_pedido: Optional[str] = None
    numero_contrato: Optional[str] = None
    numero_ordem_servico: Optional[str] = None
    empresa_id: Optional[Union[str, int]] = None

@dataclass
class CrAlterarPayload:
    """Payload para alterar Conta a Receber."""
    codigo_lancamento_integracao: str
    valor_documento: Optional[float] = None
    data_vencimento: Optional[str] = None
    codigo_categoria: Optional[str] = None
    observacao: Optional[str] = None
    data_previsao: Optional[str] = None

@dataclass
class CrUpsertPayload(CrIncluirPayload):
    """Payload para upsert — empresa_id obrigatório."""
    empresa_id: Union[str, int] = ""

@dataclass
class CrRecebimentoPayload:
    """Payload para lançar recebimento/baixa."""
    codigo_lancamento_integracao: str
    valor: float
    data: str  # DD/MM/AAAA
    desconto: float = 0
    juros: float = 0
    multa: float = 0
    observacao: Optional[str] = None
    id_conta_corrente: Optional[Union[str, int]] = None  # Se omitido, usa conta padrão da empresa

@dataclass
class CrCancelarRecebimentoPayload:
    """Payload para cancelar recebimento."""
    codigo_baixa: str

@dataclass
class ClientePayload:
    """Payload para incluir/alterar Cliente.
    
    ATENÇÃO: cnpj_cpf é recomendado para /upsert. Sem ele, o upsert não 
    identifica duplicidade e sempre cria novo registro.
    """
    razao_social: str
    codigo_cliente_integracao: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj_cpf: Optional[str] = None  # RECOMENDADO para upsert
    email: Optional[str] = None
    telefone1_numero: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None

@dataclass
class FornecedorPayload:
    """Payload para incluir/alterar Fornecedor.
    
    ATENÇÃO: empresa_ids é funcionalmente necessário. Sem vinculação a 
    pelo menos uma empresa, o fornecedor não aparece em listagens filtradas.
    """
    cnpj_cpf: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    codigo_integracao: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None  # UF 2 chars
    cep: Optional[str] = None  # 8 chars sem pontuação
    inscricao_estadual: Optional[str] = None
    empresa_ids: Optional[List[Union[str, int]]] = None  # RECOMENDADO: vincular a empresa(s)

@dataclass
class WebhookSubscribePayload:
    """Payload para criar assinatura de webhook.
    
    SEGURANÇA: Sempre informe 'secret' para habilitar verificação HMAC-SHA256.
    Sem secret, qualquer POST para sua URL será aceito como legítimo.
    """
    url: str
    events: List[str]  # Ex: ["conta_pagar.criado", "conta_pagar.alterado"]
    secret: Optional[str] = None  # RECOMENDADO: habilita HMAC-SHA256

@dataclass
class EmpresaIncluirPayload:
    """Payload para incluir Empresa.
    
    ATENÇÃO: cnpj e regime_apuracao são opcionais no schema mas funcionalmente 
    essenciais. Sem cnpj a empresa não vincula a fiscal. Sem regime_apuracao 
    o DRE fica incorreto (padrão: Competência).
    """
    razao_social: str
    nome_fantasia: Optional[str] = None
    cnpj: Optional[str] = None  # RECOMENDADO: sem CNPJ, estado parcial
    codigo_empresa_integracao: Optional[str] = None
    codigo_erp: Optional[str] = None
    regime_apuracao: Optional[str] = None  # RECOMENDADO: 'Competência' ou 'Caixa'
    tipo_empresa: Optional[str] = None  # RECOMENDADO: 'Matriz', 'Filial', 'Coligada'
    porte: Optional[str] = None  # 'ME', 'EPP', 'Demais'
    inscricao_estadual: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    endereco: Optional[str] = None
    endereco_numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    email: Optional[str] = None
    telefone1_ddd: Optional[str] = None
    telefone1_numero: Optional[str] = None

@dataclass
class CategoriaPayload:
    """Payload para incluir Categoria Financeira."""
    codigo_categoria: str  # Hierárquico: "2.04.01"
    descricao: str
    tipo: str  # 'receita' ou 'despesa'
    categoria_pai: Optional[str] = None

@dataclass
class EmpresaAlterarPayload:
    """Payload para alterar Empresa."""
    codigo_empresa: Union[str, int]
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    regime_apuracao: Optional[str] = None
    porte: Optional[str] = None


# ═══════════════════════════════════════
# EXCEÇÕES TIPADAS
# ═══════════════════════════════════════

class HuggsAPIError(Exception):
    """Erro genérico da API Huggs."""
    def __init__(self, status: int, message: str, data: Dict = None):
        self.status = status
        self.message = message
        self.data = data or {}
        super().__init__(f"HTTP {status}: {message}")

class HuggsValidationError(HuggsAPIError):
    """Erro 400 — validação de payload."""
    pass

class HuggsAuthError(HuggsAPIError):
    """Erro 401 — autenticação."""
    pass

class HuggsConflictError(HuggsAPIError):
    """Erro 409 — recurso duplicado."""
    pass

class HuggsRateLimitError(HuggsAPIError):
    """Erro 429 — rate limit excedido."""
    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(429, f"Rate limit excedido. Retry após {retry_after}s")


# ═══════════════════════════════════════
# SDK CLASS
# ═══════════════════════════════════════

class HuggsERP:
    """SDK oficial para integração com o ERP BiMaster/Huggs.
    
    Uso:
        erp = HuggsERP("huggs-erp-xxxxxxxx", "https://api.bimaster.online/v1")
        print(erp.health_check())
    """

    def __init__(self, api_key: str, base_url: str = "${BASE_URL_PLACEHOLDER}"):
        self.base_url = base_url
        self.headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, body: Optional[Dict] = None) -> Dict[str, Any]:
        """Executa request com tratamento de erros tipados."""
        url = f"{self.base_url}{path}"
        resp = requests.request(method, url, json=body, headers=self.headers, timeout=30)
        
        try:
            data = resp.json()
        except ValueError:
            data = {"message": resp.text}

        if resp.ok:
            return data

        msg = data.get("message", data.get("error", resp.text))
        if resp.status_code == 400:
            raise HuggsValidationError(400, msg, data)
        elif resp.status_code == 401:
            raise HuggsAuthError(401, msg, data)
        elif resp.status_code == 409:
            raise HuggsConflictError(409, msg, data)
        elif resp.status_code == 429:
            retry = int(resp.headers.get("Retry-After", "60"))
            raise HuggsRateLimitError(retry)
        else:
            raise HuggsAPIError(resp.status_code, msg, data)

    def _request_with_retry(self, method: str, path: str, body: Optional[Dict] = None, max_retries: int = 3) -> Dict[str, Any]:
        """Executa request com retry automático para 429 e 5xx."""
        for attempt in range(max_retries):
            try:
                return self._request(method, path, body)
            except HuggsRateLimitError as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(e.retry_after)
            except HuggsAPIError as e:
                if e.status >= 500 and attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise
        raise HuggsAPIError(0, "Max retries exceeded")

    def _to_dict(self, obj) -> Dict:
        """Converte dataclass para dict, removendo valores None."""
        if hasattr(obj, "__dataclass_fields__"):
            return {k: v for k, v in asdict(obj).items() if v is not None}
        return obj

    def _validate(self, rules: List[tuple]):
        """Validação local antes de enviar request."""
        for condition, message in rules:
            if condition:
                raise HuggsValidationError(400, f"Validação local: {message}")

    # ===== Health Check Geral =====
    def health_check(self) -> Dict:
        """Health check geral — testa conectividade e mede latência."""
        start = time.time()
        result = self._request("GET", "/contas-pagar-api/status")
        return {"status": result.get("status"), "latency_ms": round((time.time() - start) * 1000)}

    # ===== Contas a Pagar =====
    def cp_status(self) -> Dict:
        """Health check da API de Contas a Pagar."""
        return self._request("GET", "/contas-pagar-api/status")
    
    def cp_listar(self, pagina: int = 1, registros: int = 50, **filtros) -> Dict:
        """Listar contas a pagar com paginação e filtros."""
        qs = f"pagina={pagina}&registros_por_pagina={registros}"
        for k, v in filtros.items():
            qs += f"&{k}={v}"
        return self._request("GET", f"/contas-pagar-api/listar?{qs}")
    
    def cp_incluir(self, titulo: CpIncluirPayload) -> Dict:
        """Incluir nova conta a pagar."""
        d = self._to_dict(titulo)
        self._validate([
            (not d.get("codigo_lancamento_integracao"), "codigo_lancamento_integracao é obrigatório"),
            (d.get("valor_documento", 0) <= 0, "valor_documento deve ser maior que zero"),
            (d.get("chave_nfe") and len(d["chave_nfe"]) != 44, "chave_nfe deve ter exatamente 44 caracteres"),
        ])
        return self._request("POST", "/contas-pagar-api/incluir", d)
    
    def cp_alterar(self, titulo: CpAlterarPayload) -> Dict:
        """Alterar conta a pagar existente."""
        return self._request("PUT", "/contas-pagar-api/alterar", self._to_dict(titulo))
    
    def cp_excluir(self, codigo: str) -> Dict:
        """Excluir conta a pagar por código de integração."""
        return self._request("DELETE", f"/contas-pagar-api/excluir?codigo_lancamento_integracao={codigo}")
    
    def cp_upsert(self, titulo: CpUpsertPayload) -> Dict:
        """Upsert unitário de conta a pagar."""
        d = self._to_dict(titulo)
        self._validate([
            (not d.get("codigo_lancamento_integracao"), "codigo_lancamento_integracao é obrigatório"),
            (d.get("valor_documento", 0) <= 0, "valor_documento deve ser maior que zero"),
            (d.get("chave_nfe") and len(d["chave_nfe"]) != 44, "chave_nfe deve ter exatamente 44 caracteres"),
            (not d.get("empresa_id"), "empresa_id é obrigatório para upsert"),
        ])
        return self._request("POST", "/contas-pagar-api/upsert", d)
    
    def cp_upsert_lote(self, lote: int, titulos: List[Dict]) -> Dict:
        """Upsert em lote de contas a pagar (máx 500)."""
        return self._request("POST", "/contas-pagar-api/upsert-lote", {"lote": lote, "conta_pagar_cadastro": titulos})
    
    def cp_lancar_pagamento(self, pagamento: CpPagamentoPayload) -> Dict:
        """Registrar pagamento/baixa."""
        d = self._to_dict(pagamento)
        self._validate([
            (not d.get("codigo_lancamento_integracao"), "codigo_lancamento_integracao é obrigatório"),
            (d.get("valor", 0) <= 0, "valor deve ser maior que zero"),
        ])
        return self._request("POST", "/contas-pagar-api/lancar-pagamento", d)

    def cp_cancelar_pagamento(self, codigo_baixa: str) -> Dict:
        """Cancelar pagamento/baixa."""
        return self._request("POST", "/contas-pagar-api/cancelar-pagamento", {"codigo_baixa": codigo_baixa})

    # ===== Contas a Receber =====
    def cr_listar(self, pagina: int = 1, registros: int = 50, **filtros) -> Dict:
        """Listar contas a receber com paginação e filtros."""
        qs = f"pagina={pagina}&registros_por_pagina={registros}"
        for k, v in filtros.items():
            qs += f"&{k}={v}"
        return self._request("GET", f"/contas-receber-api/listar?{qs}")
    
    def cr_incluir(self, titulo: CrIncluirPayload) -> Dict:
        """Incluir nova conta a receber."""
        d = self._to_dict(titulo)
        self._validate([
            (not d.get("codigo_lancamento_integracao"), "codigo_lancamento_integracao é obrigatório"),
            (d.get("valor_documento", 0) <= 0, "valor_documento deve ser maior que zero"),
        ])
        return self._request("POST", "/contas-receber-api/incluir", d)
    
    def cr_alterar(self, titulo: CrAlterarPayload) -> Dict:
        """Alterar conta a receber."""
        return self._request("PUT", "/contas-receber-api/alterar", self._to_dict(titulo))
    
    def cr_upsert(self, titulo: CrUpsertPayload) -> Dict:
        """Upsert unitário de conta a receber."""
        d = self._to_dict(titulo)
        self._validate([
            (not d.get("codigo_lancamento_integracao"), "codigo_lancamento_integracao é obrigatório"),
            (d.get("valor_documento", 0) <= 0, "valor_documento deve ser maior que zero"),
            (not d.get("empresa_id"), "empresa_id é obrigatório para upsert"),
        ])
        return self._request("POST", "/contas-receber-api/upsert", d)
    
    def cr_upsert_lote(self, lote: int, titulos: List[Dict]) -> Dict:
        """Upsert em lote de contas a receber (máx 500)."""
        return self._request("POST", "/contas-receber-api/upsert-lote", {"lote": lote, "conta_receber_cadastro": titulos})
    
    def cr_lancar_recebimento(self, recebimento: CrRecebimentoPayload) -> Dict:
        """Registrar recebimento/baixa."""
        d = self._to_dict(recebimento)
        self._validate([
            (not d.get("codigo_lancamento_integracao"), "codigo_lancamento_integracao é obrigatório"),
            (d.get("valor", 0) <= 0, "valor deve ser maior que zero"),
        ])
        return self._request("POST", "/contas-receber-api/lancar-recebimento", d)
    
    def cr_cancelar_recebimento(self, body: CrCancelarRecebimentoPayload) -> Dict:
        """Cancelar recebimento."""
        return self._request("POST", "/contas-receber-api/cancelar-recebimento", self._to_dict(body))

    # ===== Clientes =====
    def clientes_listar(self, body: Dict = None) -> Dict:
        """Listar clientes."""
        return self._request("POST", "/clientes-api/listar", body or {})
    
    def clientes_incluir(self, body: ClientePayload) -> Dict:
        """Incluir novo cliente."""
        d = self._to_dict(body)
        self._validate([
            (not d.get("razao_social"), "razao_social é obrigatório"),
        ])
        return self._request("POST", "/clientes-api/incluir", d)

    def clientes_alterar(self, body: ClientePayload, id: str) -> Dict:
        """Alterar cliente existente."""
        payload = self._to_dict(body)
        payload["id"] = id
        return self._request("POST", "/clientes-api/alterar", payload)
    
    def clientes_upsert(self, body: ClientePayload) -> Dict:
        """Upsert de cliente."""
        return self._request("POST", "/clientes-api/upsert", self._to_dict(body))

    # ===== Contas Correntes =====
    def cc_listar(self) -> Dict:
        """Listar contas correntes."""
        return self._request("GET", "/contas-correntes-api/")
    
    def cc_incluir(self, body: Dict) -> Dict:
        """Incluir conta corrente."""
        return self._request("POST", "/contas-correntes-api/incluir", body)

    def cc_upsert_lote(self, lote: List[Dict]) -> Dict:
        """Upsert em lote de contas correntes."""
        return self._request("POST", "/contas-correntes-api/upsert-lote", {"lote": lote})

    # ===== Boletos =====
    def boleto_gerar(self, body: Dict) -> Dict:
        """Gerar boleto."""
        return self._request("POST", "/boletos-api/gerar", body)
    
    def boleto_listar(self, pagina: int = 1) -> Dict:
        """Listar boletos."""
        return self._request("GET", f"/boletos-api/listar?pagina={pagina}")

    # ===== Empresas (Convenção POST) =====
    # NOTA: A API de Empresas segue a convenção Huggs — todas as operações usam POST.
    def empresas_incluir(self, body: EmpresaIncluirPayload) -> Dict:
        """Incluir empresa."""
        d = self._to_dict(body)
        self._validate([
            (not d.get("razao_social"), "razao_social é obrigatório"),
        ])
        return self._request("POST", "/empresas-api/incluir", d)

    def empresas_alterar(self, body: EmpresaAlterarPayload) -> Dict:
        """Alterar empresa."""
        return self._request("POST", "/empresas-api/alterar", self._to_dict(body))

    def empresas_consultar(self, codigo_empresa: Union[str, int]) -> Dict:
        """Consultar empresa por código."""
        return self._request("POST", "/empresas-api/consultar", {"codigo_empresa": codigo_empresa})

    def empresas_listar(self, pagina: int = 1, registros: int = 100) -> Dict:
        """Listar empresas."""
        return self._request("POST", "/empresas-api/listar", {"pagina": pagina, "registros_por_pagina": registros})

    # ===== Fornecedores (Consulta) =====
    def fornecedores_consultar(self, cnpj: str = None) -> Dict:
        """Consultar fornecedores ativos por CNPJ."""
        qs = f"?cnpj={cnpj}" if cnpj else ""
        return self._request("GET", f"/erp-fornecedores-query/{qs}")

    # ===== Fornecedores (Sync) =====
    def fornecedores_incluir(self, body: FornecedorPayload) -> Dict:
        """Incluir fornecedor."""
        d = self._to_dict(body)
        self._validate([
            (not d.get("cnpj_cpf"), "cnpj_cpf é obrigatório"),
            (not d.get("razao_social"), "razao_social é obrigatório"),
        ])
        return self._request("POST", "/erp-fornecedores-sync/incluir", d)

    def fornecedores_alterar(self, body: FornecedorPayload, id: int) -> Dict:
        """Alterar fornecedor existente."""
        payload = self._to_dict(body)
        payload["id"] = id
        return self._request("POST", "/erp-fornecedores-sync/alterar", payload)

    def fornecedores_upsert(self, body: FornecedorPayload) -> Dict:
        """Upsert de fornecedor."""
        return self._request("POST", "/erp-fornecedores-sync/upsert", self._to_dict(body))

    def fornecedores_listar(self, body: Dict = None) -> Dict:
        """Listar fornecedores."""
        return self._request("POST", "/erp-fornecedores-sync/listar", body or {})

    # ===== Categorias (Convenção POST) =====
    def categorias_listar(self, pagina: int = 1, registros: int = 50) -> Dict:
        """Listar categorias financeiras."""
        return self._request("POST", "/categorias-api/listar", {"pagina": pagina, "registros_por_pagina": registros})

    def categorias_consultar(self, codigo: str) -> Dict:
        """Consultar categoria por código."""
        return self._request("POST", "/categorias-api/consultar", {"codigo_categoria": codigo})

    def categorias_incluir(self, body: CategoriaPayload) -> Dict:
        """Incluir nova categoria financeira."""
        return self._request("POST", "/categorias-api/incluir", self._to_dict(body))

    # ===== Plano de Contas =====
    def plano_contas_listar(self) -> Dict:
        """Listar plano de contas."""
        return self._request("GET", "/plano-contas-api/listar")

    # ===== Portadores =====
    def portadores_listar(self) -> Dict:
        """Listar portadores/contas bancárias para pagamento."""
        return self._request("GET", "/portadores-api/listar")

    def portadores_consultar(self, id: int) -> Dict:
        """Consultar portador por ID."""
        return self._request("GET", f"/portadores-api/consultar?id={id}")

    # ===== Departamentos (Convenção POST) =====
    def departamentos_listar(self, pagina: int = 1, registros: int = 50) -> Dict:
        """Listar departamentos/centros de custo."""
        return self._request("POST", "/departamentos-api/listar", {"pagina": pagina, "registros_por_pagina": registros})

    # ===== Projetos (Convenção POST) =====
    def projetos_listar(self, pagina: int = 1, registros: int = 50) -> Dict:
        """Listar projetos."""
        return self._request("POST", "/projetos-api/listar", {"pagina": pagina, "registros_por_pagina": registros})

    # ===== Países =====
    def paises_listar(self, filtrar_por_codigo: str = None, filtrar_por_descricao: str = None) -> Dict:
        """Listar países cadastrados (lista estática)."""
        body = {}
        if filtrar_por_codigo:
            body["filtrar_por_codigo"] = filtrar_por_codigo
        if filtrar_por_descricao:
            body["filtrar_por_descricao"] = filtrar_por_descricao
        return self._request("POST", "/paises-api/listar", body)

    # ===== Webhooks =====
    def webhook_incluir(self, body: WebhookSubscribePayload) -> Dict:
        """Criar assinatura de webhook."""
        d = self._to_dict(body)
        self._validate([
            (not d.get("url"), "url é obrigatório"),
            (not d.get("events") or len(d["events"]) == 0, "events é obrigatório e deve ter pelo menos um evento"),
        ])
        return self._request("POST", "/webhook-subscriptions-api/incluir", d)
    
    def webhook_listar(self) -> Dict:
        """Listar assinaturas de webhook."""
        return self._request("GET", "/webhook-subscriptions-api/listar")

    # ===== Paginação Automática =====
    def fetch_all_pages(self, path: str, key: str = "conta_pagar_cadastro") -> List[Dict]:
        """Buscar TODOS os registros percorrendo todas as páginas automaticamente.
        
        Args:
            path: Caminho do endpoint (ex: "/contas-pagar-api/listar")
            key: Nome do array de resultados na resposta
        
        Returns:
            Lista com todos os registros de todas as páginas.
        """
        pagina, todos = 1, []
        while True:
            data = self._request("GET", f"{path}?pagina={pagina}&registros_por_pagina=500")
            todos.extend(data.get(key, []))
            if pagina >= data.get("total_de_paginas", 1):
                break
            pagina += 1
        return todos


# ═══════════════════════════════════════
# EXEMPLO DE USO
# ═══════════════════════════════════════

if __name__ == "__main__":
    erp = HuggsERP("huggs-erp-xxxxxxxx", "https://api.bimaster.online/v1")
    
    # Health check geral com latência
    hc = erp.health_check()
    print(f"API ok, latência: {hc['latency_ms']}ms")
    
    # Listar países
    paises = erp.paises_listar(filtrar_por_descricao="BRASIL")
    print(f"Países: {paises}")
    
    # Incluir CP com dataclass tipada
    titulo = CpIncluirPayload(
        codigo_lancamento_integracao="INT-001",
        codigo_cliente_fornecedor="2d3d20ef-158d-4765-8d2c-3e6100aace64",
        data_vencimento="21/03/2026",
        valor_documento=100.00,
        codigo_categoria="2.04.01",
    )
    
    try:
        result = erp.cp_incluir(titulo)
        print(f"Título criado: {result}")
    except HuggsConflictError:
        print("Título já existe — use cp_upsert()")
    except HuggsValidationError as e:
        print(f"Erro de validação: {e.data}")
    except HuggsRateLimitError as e:
        print(f"Rate limit — retry em {e.retry_after}s")
    
    # Retry automático com backoff
    result = erp._request_with_retry("GET", "/contas-pagar-api/status")
    print(f"Status com retry: {result}")
`;
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} baixado com sucesso!`);
}

export default function SdkDownloadButtons() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => downloadFile(generateTsSDK(), "huggs-erp-sdk.ts")}
        >
          <Download className="h-3 w-3" />
          SDK TypeScript
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => downloadFile(generateJsSDK(), "huggs-erp-sdk.js")}
        >
          <Download className="h-3 w-3" />
          SDK JavaScript
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => downloadFile(generatePySDK(), "huggs_erp_sdk.py")}
        >
          <Download className="h-3 w-3" />
          SDK Python
        </Button>
      </div>
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p><code className="bg-muted px-1 rounded">npm install @bimaster/huggs-erp-sdk</code> ou baixar .ts/.js</p>
        <p><code className="bg-muted px-1 rounded">pip install huggs-erp-sdk</code> ou baixar .py</p>
      </div>
    </div>
  );
}
