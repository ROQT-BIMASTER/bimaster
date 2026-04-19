// Versão do app - incrementar a cada deploy significativo
// PR-23 (v3.2.0): SDK v3.3.0 / OpenAPI v4.4.0 — Enriquecimento de dados CP (5 camadas alinhadas).
// FASE 1 (BUG REAL): UpsertSchema/IncluirSchema agora aceitam data_emissao, numero_documento_fiscal,
//   chave_nfe, codigo_tipo_documento, numero_pedido (Upsert tinha .strict() bloqueando — bug real
//   em produção: 5 títulos null). handleIncluir grava data_emissao explicitamente.
//   handleUpdate allowlist expandida (data_emissao, data_entrada, codigo_projeto, etc).
// FASE 2 (JOINs): handleConsultar/handleQuery retornam meta_relacionados (empresa/fornecedor/
//   categoria/departamento/portador/projeto) via PostgREST embedded resources. handleGetPagamentos
//   faz JOIN com contas_bancarias e profiles → conta_corrente + usuario_nome.
// FASE 3 (campos novos): pagamentos ganha codigo_pix + created_by + CHECK enum forma_pagamento.
//   RPC process_payment_atomic +3 params (defaults retro-compatíveis).
// PR-21 (v3.1.13): OpenAPI v4.3.4 — auditoria cosmética final pré-produção (SDK mantém v3.2.4).
// - ContaCorrenteInput completo: 10 campos canônicos (codigo_agencia, numero_conta_corrente,
//   valor_limite, pix_sn enum S/N, bol_sn enum S/N). Campos legados agencia/conta removidos
//   (runtime ignora silenciosamente).
// - EmpresaInput +1 campo: endereco_numero (paridade com SDK TS).
// - ClienteInput -1 campo: telefone1_ddd removido (runtime clientes-api usa Zod .strict() —
//   enviar o campo causava 400). Bug documental — SDK nunca expôs.
// - MetaEnvelope wiring: schema referenciado via allOf nas responses 2xx de CP/CR (escopo
//   declarado). Deixa de ser órfão e habilita validação por geradores OpenAPI.
// - IdempotencyHeaders schema removido (orphan irrecuperável, já coberto por
//   parameters.IdempotencyKey/RequestId + headers.XRequestId).
// PR-20 (v3.1.12): SDK v3.2.4 / OpenAPI v4.3.3 — auditoria de schemas (4ª passada).
// - BUG REAL FIX (análogo events/eventos): ContaCorrentePayload (3 SDKs) usava
//   tipo, banco_codigo, agencia, conta — runtime contas-correntes-api IGNORAVA
//   silenciosamente. Nomes canônicos passam a ser tipo_conta_corrente, codigo_banco,
//   codigo_agencia, numero_conta_corrente + cCodCCInt (chave integração). Aliases
//   legados @deprecated mantidos por 1 versão.
// - ContaCorrenteResponse (TS): campos atualizados (nCodCC, cCodCCInt,
//   codigo_status, descricao_status) refletindo runtime real.
// - Python: ContaCorrentePayload typed @dataclass (era Dict cru sem guia).
//   EmpresaIncluirPayload (PY) +7 campos: responsavel_nome, responsavel_cpf,
//   capital_social, data_abertura, regime_tributario, codigo_ibge_municipio,
//   natureza_juridica.
// - OpenAPI v4.3.3: EmpresaInput +7 campos (paridade TS/PY/spec). ErrorAuth,
//   ErrorValidation, ErrorRateLimit deixam de ser órfãos — schemas inline em
//   components.responses substituídos por $ref. MetaEnvelope referenciado em
//   info.description. Changelog v4.3.3 inline.
// PR-19 (v3.1.11): SDK v3.2.3 / OpenAPI v4.3.2 — auditoria de schemas (3ª passada).
// - BUG REAL FIX: campo `events` → `eventos` (PT) nas interfaces e métodos webhookIncluir
//   dos 3 SDKs. Runtime (webhook-subscriptions-api) só aceita `eventos` — versões
//   anteriores causavam 400 'Campos obrigatórios: ...eventos' em produção.
// - WebhookSubscribePayload ganha campos opcionais: descricao, max_retries, empresa_id
//   e headers_customizados (já aceitos pelo runtime, antes inacessíveis via SDK).
// - OpenAPI generator method-aware: sufixo Listar/Incluir/Alterar/Excluir aplicado
//   apenas em colisões (resolve duplicata cpAnexos = GET+POST que quebrava openapi-generator).
// - 30 operationIds normalizados para camelCase puro: moduleMap expandido + sanitização
//   de underscores residuais + action 'root' substituída por verbo derivado do método.
// - ClienteInput trimmed (6 campos inatingíveis removidos), EmpresaInput expanded
//   (5 campos do SDK adicionados), 8 schemas órfãos removidos.
// - 6 invariantes novos em audit/regression-greps.sh.
// PR-18 (v3.1.10): SDK v3.2.2 / OpenAPI v4.3.1 — resolução final pré-produção.
// - ALIAS BACKEND /cancelar-lote em contas-pagar-api/index.ts (handleCancelar é batch-aware).
//   Resolve 404 em runtime que afetava os 3 SDKs após PR-17 (auditoria externa 2ª passada).
// - OpenAPI v4.3.1 documenta /cancelar-lote (CP), /check e /sync (fornecedores-sync) — eram
//   rotas reais que faltavam na spec (PR-17 prometia 5, entregou 3).
// - Generator OpenAPI: trailing slash removido em raízes de módulo (ep.path === "/" ? api.basePath).
// - 4 invariantes novos em audit/regression-greps.sh.
// PR-17 (v3.1.9): SDK v3.2.1 / OpenAPI v4.3.0 — correção crítica + alinhamento OpenAPI.
// - BUG CRÍTICO TS: cpCancelarLote chamava /contas-pagar-api/cancelar (unitário) — agora /cancelar-lote.
// - PARIDADE Python: cp_anexos_listar migrado para _cp_dispatch (ETag/304/retry como demais cp_*).
// - CR API ganha 3 handlers REAIS (antes 404): /query (cursor+offset), /parcelas, /recebimentos.
//   Paridade total com cpQuery/cpGetParcelas/cpGetPagamentos. CR API_VERSION 1.3.0 → 1.4.0.
// - OpenAPI 4.2.0 → 4.3.0: 5 endpoints documentados (CR /query, /parcelas, /recebimentos +
//   fornecedores-sync /check, /sync — já existiam como rotas, agora aparecem na spec).
// - SDKs (TS/JS/PY) ganham 11 métodos novos: cpUpdate + 10 wrappers da Export API
//   (cpExportStatus/Pending/Paid/Cancelled/Batch/Confirm/History/Summary/Reconciliation/RetryFailed).
//   Cobertura SDK do CP sobe de 19/19 para 30/30 (incluindo Export API 100%).
// - Comentários "USE QUANDO/PREFIRA" expandidos em cpIncluir vs cpUpsert (3 SDKs).
// - Glossário SDK→banco adicionado (codigo_categoria→categoria_codigo, valor_documento→valor_original etc).
// - Quick Start passo 5 documenta fluxo Export API completo.
// - Smoke tests trocam chave probe `/listar` por `/cnae-api/listar` (lookup real, evita falso-positivo grep).
// - 8 invariantes novos em regression-greps.sh (cobertura métodos × 3 linguagens, sem cpListar reaparecendo).
// PR-15 / Onda 4 (v3.1.7): Export API alinhada com `contas_pagar`.
// - handleGetItems(/pending /paid) e handleStatusDetail agora consultam `contas_pagar`
//   (financial_payment_queue era módulo legado vazio → arrays sempre vazios).
// - /cancelled e /reconciliation removidos refs a `conta_pagar_id` (coluna inexistente em
//   erp_export_queue → 500 PGRST204). Decisão arquitetural: payment_queue_id armazena
//   UUID de contas_pagar.id (zero migration; tabela estava vazia).
// - /export-batch agora pré-valida que cada id exista em contas_pagar; IDs ausentes vão
//   para errors[] em vez de virarem 23503 silencioso.
// PR-14 / Onda 3 (v3.1.6): endpoints avançados do Contas a Pagar.
// - Nova tabela cp_anexos (RLS admin-only) — handler de /anexos apontava para
//   payment_attachments inexistente (toda chamada → 500).
// - /parcelas/sync agora usa onConflict=(conta_pagar_id,numero_parcela) com UNIQUE
//   criado em migration; aceita alias `numero` (spec) → `numero_parcela` (coluna);
//   pré-valida FK conta_pagar_id e devolve errosDetalhe[] granular (paridade upsert-lote).
// - GET /parcelas e GET /anexos devolvem [] para títulos sem itens (não 404).
// PR-13 / Onda 2 (v3.1.5): ciclo completo (RPC fix, /update validate refs, /cancelar granular).
export const APP_VERSION = '3.2.0';

// Chave para armazenar versão no localStorage
const VERSION_KEY = 'app_version';
const LAST_CLEAR_KEY = 'app_last_cache_clear';

/**
 * Verifica se há uma nova versão do app e limpa caches se necessário
 */
export function checkAndUpdateVersion(): boolean {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  if (storedVersion !== APP_VERSION) {
    console.log(`[Version] Atualização detectada: ${storedVersion} → ${APP_VERSION}`);
    
    // Limpar TODOS os caches para garantir versão nova
    clearAllCaches();
    
    // Salvar nova versão
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    localStorage.setItem(LAST_CLEAR_KEY, new Date().toISOString());
    
    return true; // Nova versão detectada
  }
  
  return false; // Mesma versão
}

/**
 * Limpa TODOS os caches do navegador agressivamente
 */
export async function clearAllCaches(): Promise<void> {
  // Limpar Cache Storage (Service Worker caches)
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      console.log(`[Version] Limpando ${cacheNames.length} caches...`);
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`[Version] Cache limpo: ${cacheName}`);
      }
      
      console.log('[Version] Todos os caches foram limpos');
    } catch (error) {
      console.error('[Version] Erro ao limpar caches:', error);
    }
  }
  
  // Forçar desregistro de TODOS os Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('[Version] Service Worker desregistrado');
      }
    } catch (error) {
      console.error('[Version] Erro ao desregistrar SW:', error);
    }
  }

  // Limpar sessionStorage (dados de sessão)
  try {
    sessionStorage.clear();
    console.log('[Version] sessionStorage limpo');
  } catch (e) {
    console.error('[Version] Erro ao limpar sessionStorage:', e);
  }
}

/**
 * Força reload da página após atualização
 */
export function forceReload(): void {
  window.location.reload();
}

/**
 * Força limpeza e reload completo
 */
export async function forceCleanReload(): Promise<void> {
  await clearAllCaches();
  localStorage.setItem(VERSION_KEY, APP_VERSION);
  // Forçar reload sem cache do navegador
  window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
}
