// Versão do app - incrementar a cada deploy significativo
// PR-37 (v3.4.1): Bimaster Studio — Recuperação de designs vazios do Stitch.
//   Edge function `stitch-proxy` ganha action `refresh_design` que recebe um designId,
//   valida ownership (user_id), busca o screen no Stitch via `get_screen` (projectId+screenId
//   armazenados na geração inicial), reaplica `extractScreenData`, resolve URLs de htmlCode
//   com retry exponencial (3 tentativas, backoff 1.5s/3s) e atualiza apenas os campos
//   ausentes (html_code se vazio/<50 chars, preview_url se nulo). Retorna 200 com
//   {success:false, error} quando ainda não há conteúdo no Stitch — não derruba o card.
//   StitchDesignStudio: cards sem html_code nem preview_url agora exibem ícone de aviso
//   + texto "Conteúdo não disponível" + botão "Atualizar" (chama refresh_design) quando
//   há screen_id; o DesignPreview também recebe `onRegenerate` apontando para o mesmo
//   handler. Resolve casos onde a extração assíncrona do Stitch falhou na primeira tentativa
//   e o design ficou salvo sem conteúdo visível.
//   Novo componente `NarracaoTimeline` (src/components/marketing/studio/NarracaoTimeline.tsx)
//   que segmenta o texto da narração em sentenças (split por .!?… e subdivisão por ,;: para
//   frases >140 chars) e calcula timestamps proporcionais à contagem de palavras de cada
//   segmento sobre a duração real do áudio MP3 (lida via HTMLAudioElement.loadedmetadata).
//   Exibe player próprio (play/pause/restart), barra de progresso clicável com marcadores
//   visuais entre segmentos, tempo atual/total formatado MM:SS.d, e lista de segmentos
//   clicáveis (cada um com badge de timestamp tabular-nums) que fazem seek no áudio para
//   aquele instante. O segmento ativo durante a reprodução é destacado em tempo real.
//   CenaCard ganha botão "Clock" (timeline) entre Tocar e Download que expande/recolhe o
//   painel — ao abrir, para o player simples para evitar áudio duplicado. Útil para revisar
//   em qual ponto do áudio cada trecho foi falado, sem precisar gerar de novo.
// PR-35 (v3.3.9): Roteirista IA — Controles per-scene de tom da locução (TTS).
//   `useNarracao.gerarNarracao` aceita `voiceSettings` (stability/similarity_boost/style/speed)
//   e inclui esses valores no `texto_hash`, garantindo invalidação correta do cache ao alterar.
//   `gerarLote` aceita `settingsByKey` (override por cenaKey) que respeita skip-if-cached e abort.
//   Edge function `elevenlabs-narracao` já aplicava merge { ...defaultsPorIdioma, ...override },
//   sem alterações no backend. RoteiristaIA persiste overrides em localStorage por roteiroId
//   (`roteirista:voice-settings:<roteiroId>`). CenaCard ganha Popover com 4 sliders (Velocidade
//   0.7-1.2 / Estabilidade / Similaridade / Estilo 0-1), botão "Resetar" para voltar ao padrão
//   do idioma e badge visual quando há override ativo.
// PR-34 (v3.3.8): Roteirista IA — Fila de geração com cancelar e continuar para "Gerar Todas".
//   Hook `useNarracao.gerarLote` aceita `{ signal: AbortSignal }` e verifica abort entre cenas;
//   pula automaticamente itens já cacheados/salvos (skip-if-cached) para retomar sem reprocessar
//   nem perder progresso. Retorna `{ completed, total, cancelled, pendingFromIndex }` indicando
//   próxima cena pendente. RoteiristaIA ganha botão "Cancelar" durante a geração e botões
//   "Continuar (cena N)" / "Descartar fila" quando pausada, além de barra de Progress visual e
//   aviso âmbar com a próxima cena pendente. AbortController gerenciado por ref por sessão de fila.
// PR-33 (v3.3.7): Roteirista IA — Seletor de idioma PT/EN para narração TTS.
//   Edge function `elevenlabs-narracao` aceita campo `language` ("pt" | "en" | "auto"),
//   detecta automaticamente PT vs EN por heurística (acentos, palavras-função) quando "auto",
//   envia `language_code` no payload ElevenLabs e aplica voice_settings tunados por idioma
//   (PT: stability 0.6, similarity 0.8, speed 0.98; EN: stability 0.5, similarity 0.78, speed 1.0)
//   para maximizar fluidez e prosódia natural. Hook `useNarracao` propaga `language` em
//   `gerarNarracao`/`gerarLote` e inclui o idioma no `texto_hash` (regenera ao alternar idioma).
//   RoteiristaIA ganha Select PT/EN/Auto ao lado do seletor de voz, repassado a cada CenaCard
//   e ao "Gerar Todas". Toast informa o idioma usado (auto-detectado ou explícito).
// PR-32 (v3.3.6): Roteirista IA — Persistência de narrações geradas (MP3) no histórico.
//   Nova tabela `roteirista_narracoes` (RLS por user_id, UNIQUE roteiro_id+cena_index+texto_hash)
//   e bucket privado `narracoes-roteirista` (RLS path-based: pasta = user_id). Edge function
//   `elevenlabs-narracao` ganha persistência opcional: ao receber {save, roteiro_id, cena_index},
//   faz upload do MP3 no Storage (signed URL 7d) e upsert na tabela. Hook `useNarracao`
//   ganha `carregarSalvas(roteiroId)` (popula cache via audio_url), `excluirSalva(key)` (remove
//   storage + linha), `savedCount` e suporte a tocar/baixar a partir de URL salva (não só base64).
//   `gerarNarracao` aceita parâmetro `persist` para enviar ao backend; `gerarLote` aceita
//   `roteiroId` final. RoteiristaIA carrega narrações salvas automaticamente ao trocar/abrir
//   roteiro (useEffect em roteiroId), passa `roteiroId` ao CenaCard, exibe badge "Salva" e
//   botão Trash para narrações persistidas. Permite revisar narrações sem regerar.
// PR-31 (v3.3.5): Roteirista IA — Modo de Revisão Colaborativa.
//   Novas tabelas `roteirista_comentarios` (RLS owner-select, author-update/delete) e
//   `roteirista_historico` (RLS owner-only). Novo hook `useRoteiristaRevisao` (load + Realtime
//   por roteiro_id, adicionar/resolver/excluir comentários, registrar evento de histórico).
//   Novo componente `RevisaoPanel` com 2 abas: Comentários (composer com seletor de cena/geral,
//   filtro abertos/resolvidos/todos, ações resolver/reabrir/excluir, badges aberto/resolvido,
//   atalho Cmd+Enter) e Histórico (timeline vertical com diff antes/depois para edições).
//   RoteiristaIA registra eventos automaticamente: roteiro_criado, aprovado, enviado_para_video,
//   cena_editada (com diff de descricao_visual/narracao). CenaCard exibe badge de comentários
//   abertos/total. Botão Aprovar agora chama `aprovarRoteiro` (registra evento + atualiza status).
// PR-30 (v3.3.4): Roteirista IA — Exportação de roteiro em PDF e JSON.
//   Novo utilitário `src/lib/roteirista-export.ts` com `exportarRoteiroPDF` (jsPDF, capa com
//   título, metadados, sinopse, conceito visual, briefing, storyboard cena-a-cena com
//   descrição de câmera/narração/áudio ambiente, CTA, hashtags e paginação) e
//   `exportarRoteiroJSON` (payload versionado com briefing + roteiro estruturado para
//   reuso em outros projetos). Header do roteiro ganha 2 botões (PDF / JSON) ao lado de
//   Aprovar/Enviar p/ Vídeo.
//   Nova tabela `roteirista_briefing_templates` (RLS por user_id) com colunas: nome, tema,
//   objetivo, publico_alvo, tom, duracao_total, numero_cenas, formato, paleta_cores. Novo
//   hook `useBriefingTemplates` (carregar/salvar/excluir). Card Briefing ganha bloco de
//   templates: select para aplicar template (preenche todos os campos do briefing), Dialog
//   "Salvar como template" com preview do briefing atual, e lista compacta dos últimos 5
//   templates com hover-to-delete. Acelera criação repetida de roteiros para campanhas
//   recorrentes.
// PR-28 (v3.3.2): Roteirista IA — Player de Storyboard interativo.
//   Novo componente `StoryboardPlayer` (src/components/marketing/studio/StoryboardPlayer.tsx)
//   com: stage proporcional ao formato (9:16/16:9/1:1), transport controls (play/pause/reset/
//   prev/next), progress bar por cena + tempo acumulado vs total, autoplay sequencial entre
//   cenas, mute toggle para narração, timeline em chips clicáveis (saltar para qualquer cena),
//   tabs Câmera/Narração/Ambiente para alternar visualização do contexto da cena ativa, e
//   indicador visual quando a narração TTS já foi gerada (badge na aba). Sincroniza com
//   `useNarracao.tocar()` durante reprodução. Integrado ao RoteiristaIA acima do storyboard.
// PR-27 (v3.3.1): Roteirista IA — narração TTS via ElevenLabs por cena.
//   Nova edge function `elevenlabs-narracao` (eleven_multilingual_v2, mp3_44100_128) que recebe
//   { texto, voice_id, voice_settings, previous_text, next_text } e devolve audio_base64. Novo
//   hook `useNarracao` com cache em memória por sessão (chave hash voice+texto), play/stop/download
//   MP3, e geração em lote sequencial. RoteiristaIA ganha seletor de voz (8 vozes ElevenLabs PT/EN
//   multilingue), botão "Gerar Todas" com progresso N/total, e por cena: Gerar/Regerar/Tocar/Parar/
//   Baixar. Request stitching ativo (previous_text/next_text passados entre cenas adjacentes para
//   prosódia natural). Fallback de erro tratado (429/credits) com toast.
//   Nova edge function `roteirista-cinematografico` (Gemini 2.5 Pro + tool calling) que converte
//   fontes (PDF/URL/texto) em roteiro estruturado JSON (cenas, planos, movimento de câmera, prompts EN
//   prontos para vídeo IA). Nova tabela `roteiros_cinematograficos` (RLS por user_id, status:
//   rascunho/aprovado/enviado_para_video). Nova aba "Roteirista IA" no Bimaster Studio
//   (StitchDesignStudio: 8→9 abas). Integração com NanoBananaVideoEngine via sessionStorage —
//   roteiro aprovado pré-preenche multi-scene generator. PDF parsing client-side via pdfjs-dist
//   (até 30 páginas), URL extraction via r.jina.ai proxy. Histórico persistente com edição inline
//   por cena (descricao_visual + narracao).
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
// PR-24 (Production Hardening, v3.2.1): contas-pagar-api/export-api envoltos em
// secureHandler (WAF L7 + IP blocklist + security headers). RLS pagamentos restrito
// por empresa (semi-join contas_pagar→user_empresas). handleUpsertLote: N+1 → batch
// validate refs + .upsert PostgREST (até 500 itens em ~1s). Idempotência centralizada
// no router (CP_IDEMPOTENT_ROUTES) — checkIdempotency removido dos handlers.
// handleEstornar enfileira webhook conta_pagar.estornado. handleGetRoot delega para
// handleQuery (paginação + meta_relacionados consistentes). meta_relacionados em
// /parcelas e /anexos.
// PR-25 (v3.2.2): NULL-elimination em meta_relacionados — backfill cache na escrita
// (handleIncluir/handleUpsert/handleUpsertLote chamam enrichCachedNames antes do INSERT/UPSERT)
// + fallback ao vivo na leitura (handleQuery/handleConsultar fazem 0-3 queries paralelas para
// preencher empresa_nome/categoria_nome/fornecedor_nome quando o cache denormalized está NULL).
// Backfill histórico aplicado: ~105 linhas (55 empresa_nome + 50 categoria_nome) atualizadas
// via UPDATE…FROM idempotente. Não-quebrante (resposta apenas deixa de retornar NULL onde dado existe).
export const APP_VERSION = '3.4.0';

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
