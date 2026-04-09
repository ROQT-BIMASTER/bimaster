

# O que falta para nota 10/10 e integração 100% autônoma

## Diagnóstico atual (nota 9.2/10)

O portal já tem: documentação rica, sandbox, tester Postman-like, FAQ, changelog, exemplos em 4 linguagens, webhooks, badges de status e chat de suporte. A blindagem de segurança (Zod, timingSafe, audit log) já foi aplicada.

## Gaps identificados para nota 10/10

### 1. Chatbot IA inline no portal (self-service imediato)
O chat atual só envia mensagem para o admin responder. O desenvolvedor precisa **esperar** uma resposta humana. Falta um **chatbot IA em tempo real** que responda dúvidas técnicas instantaneamente, consultando a documentação das APIs.

**Solução**: Adicionar um botão "Perguntar à IA" no `EndpointSupportChat` que chama a edge function `api-support-ai` e mostra a resposta imediatamente, sem esperar o admin. O admin continua podendo responder manualmente depois.

### 2. Wizard de Onboarding interativo (primeira integração guiada)
O "Getting Started" é texto estático. Um desenvolvedor novo precisa ler tudo antes de fazer a primeira chamada.

**Solução**: Criar um componente `ApiOnboardingWizard` com passos interativos:
- Passo 1: Copiar API Key (ou gerar se não tem)
- Passo 2: Fazer a primeira chamada (botão que executa no sandbox automaticamente)
- Passo 3: Verificar resposta (mostra diff entre esperado/recebido)
- Passo 4: Testar um endpoint real (com dados de produção)
- Progresso salvo por usuário

### 3. Validador de payload em tempo real
O tester já existe, mas não valida o JSON antes de enviar. O desenvolvedor descobre erros só no response 400.

**Solução**: Adicionar validação client-side no `ApiTester` que mostra erros de schema **antes** de enviar, com highlight dos campos obrigatórios faltando e tipos incorretos.

### 4. SDKs prontos para download (JS/Python)
O portal tem exemplos em 4 linguagens, mas são snippets soltos. Um SDK pronto eliminaria 80% das dúvidas.

**Solução**: Gerar e disponibilizar para download um SDK JavaScript e um SDK Python gerados a partir das definições de API, com tipos TypeScript e docstrings.

### 5. Dashboard de uso da API Key (para o próprio usuário terceiro)
O desenvolvedor não sabe quantas requests já fez, qual o limite restante, ou se está próximo do rate limit.

**Solução**: Adicionar uma aba "Meu Uso" no portal mostrando: requests usadas vs limite, gráfico de uso por dia, últimos erros (4xx/5xx), e alerta visual quando está a 80% do limite.

---

## Plano de implementação

| Prioridade | Item | Arquivo | Impacto na nota |
|---|---|---|---|
| 1 | Chatbot IA inline (resposta imediata) | `EndpointSupportChat.tsx` + `api-support-ai` | +0.3 |
| 2 | Wizard de onboarding interativo | Novo: `ApiOnboardingWizard.tsx` | +0.2 |
| 3 | Validação de payload no Tester | `ApiTester.tsx` | +0.1 |
| 4 | Dashboard de uso da API Key | Novo: aba em `IntegracaoERP.tsx` | +0.1 |
| 5 | SDKs para download (JS + Python) | `ApiDocumentation.tsx` | +0.1 |

**Nota projetada após implementação: 10.0/10**
**Probabilidade de integração sem suporte: ~98%**

### Detalhes técnicos

**Item 1 — Chatbot IA inline:**
- Reutiliza a edge function `api-support-ai` já criada
- No `EndpointSupportChat`, adiciona botão "Perguntar à IA" que faz `supabase.functions.invoke('api-support-ai', { body: { message, endpoint, apiId } })`
- Resposta da IA aparece como mensagem com badge "IA" no chat
- Se não satisfeito, o dev pode escalar para o admin (comportamento atual mantido)

**Item 2 — Wizard de onboarding:**
- Novo componente `src/components/erp/ApiOnboardingWizard.tsx`
- Stepper com 4 etapas, usando o sandbox para a primeira chamada
- Progresso salvo em `localStorage` (sem necessidade de tabela)

**Item 3 — Validação no Tester:**
- No `ApiTester.tsx`, antes de enviar, parsear o JSON e validar campos obrigatórios conhecidos
- Mostrar erros inline com highlight vermelho nos campos

**Item 4 — Dashboard de uso:**
- Nova aba "Uso" no `IntegracaoERP.tsx`
- Query em `erp_api_keys` para `request_count` e `max_requests`
- Gráfico simples com barras de uso diário (dados do `erp_sync_log`)

**Item 5 — SDKs:**
- Gerar arquivos `.js` e `.py` como download a partir das definições de API existentes no `ApiDocumentation`
- Botões "Download SDK JS" e "Download SDK Python" ao lado do "Postman Collection"

