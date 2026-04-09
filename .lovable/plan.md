

# Remover Todos os Rastros de Lovable/Supabase do Sistema

## Objetivo
Eliminar qualquer referência visível que permita identificar que o sistema foi construído com Lovable ou que usa Supabase como backend. URLs, textos de UI e documentação interna devem refletir apenas o domínio `bimaster.online`.

## Escopo das Mudanças

### 1. Frontend — Textos visíveis ao usuário (5 arquivos)

**`src/pages/RelatorioSeguranca.tsx`**
- Trocar `https://bimaster.lovable.app` → `https://bimaster.online`
- Trocar referências a `*.supabase.co` no CSP example → `*.bimaster.online`

**`src/components/configuracoes/GerenciamentoIntegracoes.tsx`**
- Renomear "Lovable AI" → "Bimaster AI" (nome, descrição, steps)

**`src/components/configuracoes/DocumentacaoIntegracaoERP.tsx`**
- Trocar `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1` → `https://api.bimaster.online/v1`

**`src/components/huggs/HuggsChat.tsx`**
- Trocar "Powered by Lovable AI • Gemini 2.5 Flash" → "Powered by Bimaster AI"

**`src/components/huggs/HuggsAgentConfig.tsx`**
- Trocar "Lovable AI" → "Bimaster AI" e "Lovable MCP" → "Bimaster MCP" nos labels

**`src/components/whatsapp/WhatsAppAgentFlow.tsx`**
- Trocar "Chamar Lovable AI" → "Chamar Bimaster AI" no diagrama e textos

### 2. Frontend — Código funcional (3 arquivos)

**`src/pages/ChinaNovaSubmissao.tsx`**
- As chamadas `${projectId}.supabase.co` são funcionais (não visíveis ao ERP), mas se quiser ocultar, trocar para usar `supabase.functions.invoke()` do SDK

**`src/components/financeiro/SyncMonitorPanel.tsx`**
- Mesmo caso — trocar fetch direto para `supabase.functions.invoke()`

**`src/pages/CofreSharePage.tsx`**
- Mesmo caso — trocar fetch direto para `supabase.functions.invoke()`

### 3. Edge Functions — CORS origins (4 arquivos)

**`supabase/functions/_shared/cors.ts`**
- Adicionar `https://bimaster.online` à lista de origins permitidos (manter os existentes para funcionar)

**`supabase/functions/elevenlabs-tts/index.ts`**, **`elevenlabs-sfx/index.ts`**, **`qa-agent/index.ts`**, **`sofia-voice-token/index.ts`**
- Adicionar `https://bimaster.online` como origin permitido

### 4. Tour/UI internos (não visível externamente, mas limpar)

**`src/components/tour/TourProvider.tsx`**
- Renomear `lovable_tours_completed` → `bimaster_tours_completed` e CSS class `lovable-tour-popover` → `bimaster-tour-popover`

## O que NÃO mudar
- **Edge functions internals** (gateway URLs `ai.gateway.lovable.dev`, `LOVABLE_API_KEY`) — são backend, nunca visíveis ao cliente ERP
- **`src/integrations/supabase/client.ts`** — arquivo auto-gerado, não editar
- **`.env`** — auto-gerado

## Resumo

| Camada | Arquivos | Tipo de mudança |
|--------|----------|----------------|
| UI/Textos visíveis | 6 | Renomear Lovable → Bimaster |
| Documentação ERP | 1 | URL supabase.co → api.bimaster.online |
| Fetch direto (código) | 3 | Migrar para SDK invoke (oculta URL) |
| CORS edge functions | 5 | Adicionar bimaster.online como origin |
| Tour CSS | 1 | Renomear classes/keys |

Total: ~16 arquivos, substituições de string + 3 refactors de fetch → SDK.

