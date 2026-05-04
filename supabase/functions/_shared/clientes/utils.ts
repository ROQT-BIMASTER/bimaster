// _shared/clientes/utils.ts — Shared utilities for clientes sync
// Mirrors _shared/contas-pagar/utils.ts but adapted for the `clientes` table.

import { logger } from "../logger.ts";

// =====================================================
// CONSTANTS
// =====================================================
export const MAX_PAYLOAD_SIZE = 200000;
export const MINI_BATCH_SIZE = 500;
export const INTER_BATCH_DELAY_MS = 120;
export const MAX_RETRIES = 5;
export const RETRY_DELAY_MS = 500;
export const API_VERSION = "clientes-sync-1.0.0";

// =====================================================
// RETRY (mesma lógica de contas-pagar)
// =====================================================
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; delayMs?: number; operationName?: string } = {},
): Promise<T> {
  const { maxRetries = MAX_RETRIES, delayMs = RETRY_DELAY_MS, operationName = "operation" } = options;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(errorStr);
      const msg = lastError.message.toLowerCase();
      const retryable =
        msg.includes("deadlock") || msg.includes("timeout") || msg.includes("connection") ||
        msg.includes("network") || msg.includes("too many connections") || msg.includes("pool") ||
        msg.includes("busy") || msg.includes("temporarily") || msg.includes("unavailable") ||
        msg.includes("socket") || msg.includes("econnreset") || msg.includes("epipe") ||
        msg.includes("abort") || msg.includes("closed");
      if (attempt === maxRetries) throw lastError;
      if (!retryable) throw lastError;
      const jitter = Math.random() * 200;
      const backoffDelay = Math.min(delayMs * Math.pow(2, attempt - 1) + jitter, 10000);
      logger.warn(`⚠️ [${operationName}] Tentativa ${attempt}/${maxRetries} falhou: ${lastError.message}. Retry em ${Math.round(backoffDelay)}ms...`);
      await new Promise((r) => setTimeout(r, backoffDelay));
    }
  }
  throw lastError;
}

// =====================================================
// HELPERS
// =====================================================
export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  try {
    const d = new Date(v as string);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export function sanitizeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Remove control chars, mantém o resto
  return s.replace(/[\x00-\x1F\x7F]/g, "").slice(0, 1000);
}

export function normalizeCnpj(v: unknown): string | null {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, "");
  return digits || null;
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

export function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? Math.trunc(v) : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

// =====================================================
// MAPEAMENTO ERP → tabela `clientes` (whitelist)
// =====================================================
export function transformErpData(r: Record<string, unknown>) {
  const codigo = sanitizeString(r.codigo ?? r["Código"] ?? r.cod_cliente);
  const empresaId = toIntOrNull(r.empresa_id ?? r["ID Empresa"]) ?? 1;
  return {
    codigo,
    empresa_id: empresaId,
    nome: sanitizeString(r.nome ?? r.razao_social ?? r["Cliente"]),
    nome_abreviado: sanitizeString(r.nome_abreviado ?? r.nome_fantasia),
    cnpj: normalizeCnpj(r.cnpj ?? r.cnpj_cpf),
    inscricao_estadual: sanitizeString(r.inscricao_estadual),
    tipo_cliente: toIntOrNull(r.tipo_cliente),
    email: sanitizeString(r.email),
    telefone: sanitizeString(r.telefone ?? r.telefone1_numero),
    celular: sanitizeString(r.celular),
    fax: sanitizeString(r.fax ?? r.fax_numero),
    comprador: sanitizeString(r.comprador ?? r.contato),
    endereco: sanitizeString(r.endereco),
    bairro: sanitizeString(r.bairro),
    cidade: sanitizeString(r.cidade),
    uf: sanitizeString(r.uf ?? r.estado),
    cep: sanitizeString(r.cep),
    endereco_cobranca: sanitizeString(r.endereco_cobranca),
    bairro_cobranca: sanitizeString(r.bairro_cobranca),
    cidade_cobranca: sanitizeString(r.cidade_cobranca),
    uf_cobranca: sanitizeString(r.uf_cobranca),
    cep_cobranca: sanitizeString(r.cep_cobranca),
    limite_credito: toNumberOrNull(r.limite_credito ?? r.valor_limite_credito),
    classificacao: toIntOrNull(r.classificacao),
    conceito: sanitizeString(r.conceito),
    status_bloqueio: sanitizeString(r.status_bloqueio) ?? "ativo",
    rota: sanitizeString(r.rota),
    portador: sanitizeString(r.portador),
    ramo_atividade: toIntOrNull(r.ramo_atividade ?? r.id_ramo),
    convenio: toIntOrNull(r.convenio),
    data_cadastro: parseDate(r.data_cadastro),
    data_ultima_compra: parseDate(r.data_ultima_compra),
    valor_ultima_compra: toNumberOrNull(r.valor_ultima_compra),
    data_maior_compra: parseDate(r.data_maior_compra),
    valor_maior_compra: toNumberOrNull(r.valor_maior_compra),
    observacoes: sanitizeString(r.observacoes ?? r.observacao),
    contrato: toIntOrNull(r.contrato),
    responsavel: sanitizeString(r.responsavel),
    cod_vend: toIntOrNull(r.cod_vend),
    sincronizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =====================================================
// PROCESSAMENTO EM LOTE
// =====================================================
export interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

export async function processRecordsWithRetry(
  supabase: any,
  records: Record<string, unknown>[],
  operationName: string,
): Promise<SyncResult> {
  const prepared = records
    .map((r) => transformErpData(r))
    .filter((r) => r.codigo && r.nome); // codigo+nome obrigatórios

  const skipped = records.length - prepared.length;
  if (prepared.length === 0) {
    return { inserted: 0, updated: 0, skipped, total: records.length };
  }

  const { data, error } = await withRetry(
    async () => {
      return await supabase
        .from("clientes")
        .upsert(prepared, { onConflict: "codigo,empresa_id", ignoreDuplicates: false })
        .select("id");
    },
    { operationName, maxRetries: MAX_RETRIES },
  );

  if (error) throw error;

  // Não dá para distinguir insert vs update via PostgREST em upsert,
  // então contabilizamos tudo como "updated" (registros afetados) — mesmo padrão do contas-receber/sync.
  const affected = data?.length ?? prepared.length;
  return {
    inserted: 0,
    updated: affected,
    skipped,
    total: records.length,
  };
}

// =====================================================
// LOG HELPERS
// =====================================================
export function logRequest(method: string, path: string, meta: Record<string, unknown> = {}) {
  logger.log(`📥 [clientes-sync] ${method} ${path}`, meta);
}
export function logSuccess(operation: string, meta: Record<string, unknown> = {}) {
  logger.log(`✅ [clientes-sync] ${operation}`, meta);
}
export function logError(operation: string, error: unknown, meta: Record<string, unknown> = {}) {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error(`❌ [clientes-sync] ${operation}: ${msg}`, meta);
}
