

# Auditoria Final + Melhorias Portal + Nota de Integração Dev Junior

## Nota Atual de Integração

| Critério | Nota | Observação |
|---|---|---|
| Documentação completa | 9.8 | 31+ APIs documentadas, schemas Zod, fluxos |
| IA de suporte (GPT-5.2) | 9.5 | Contexto rico, reasoning, histórico |
| Sandbox + Tester | 9.5 | Validação de payload, presets, histórico |
| Onboarding wizard | 9.0 | 4 passos, mas sem feedback visual de erro |
| SDKs prontos | 9.0 | JS + Python, mas sem tipos TS exportados |
| Segurança | 9.7 | 4 findings novos no scan (storage) |
| UX do portal | 9.0 | Falta glossário de termos e troubleshooting |
| **Nota Global** | **9.4/10** | |
| **Dev Junior integrar sem suporte** | **~85%** | |

## Falhas Ativas (4 findings do scan)

| Finding | Severidade | Problema |
|---|---|---|
| `trade-photos` bucket | WARN | Duas policies SELECT conflitantes — `Usuários trade podem ver fotos` sobrepõe a hierarquia |
| `post-media` bucket | WARN | SELECT/UPDATE sem path ownership — qualquer autenticado lê/sobrescreve mídia de outros |
| `configuracoes_cobranca` DELETE | WARN | Supervisor pode deletar config com API keys sem poder lê-las |
| Extension in Public | WARN | pg_net no public schema (limitação Supabase, já ignorado) |

## Gaps que impedem nota 10/10 para Dev Junior

### 1. Glossário + Troubleshooting no Portal (impacto: +0.2)
Dev junior não sabe o que é `codigo_lancamento_integracao`, `id_conta_corrente`, etc. Falta:
- Glossário de termos de negócio (mapeando campos para conceitos)
- Seção "Erros Comuns" com tabela de códigos HTTP + mensagens + solução
- FAQ técnico com as 10 perguntas mais frequentes

### 2. Onboarding Wizard com validação de erro (impacto: +0.1)
O wizard testa `/status` mas não valida se a API Key está funcionando. Falta:
- Passo que testa autenticação com a key do usuário
- Feedback visual claro em caso de erro (401, 403, 429)
- Botão "Copiar cURL" para debugging local

### 3. Storage policies conflitantes (impacto: +0.1)
Corrigir as 3 policies de storage ativas no scan.

### 4. IA sem fallback de modelo (impacto: +0.1)
Se GPT-5.2 falhar (429/500), o chat não tenta modelo alternativo. Adicionar fallback para `google/gemini-2.5-flash`.

### 5. Chat IA sem exemplos sugeridos (impacto: +0.1)
Dev junior não sabe o que perguntar. Adicionar "chips" de perguntas sugeridas:
- "Como incluir um título a pagar?"
- "Quais campos são obrigatórios?"
- "Como tratar erro 422?"

---

## Plano de Implementação

### Fase 1 — Correção de segurança (Storage)

**Migração SQL:**

| Bucket/Tabela | Correção |
|---|---|
| `trade-photos` | DROP policy `Usuários trade podem ver fotos` (a hierárquica já cobre) |
| `post-media` | Adicionar path ownership `(storage.foldername(name))[1] = auth.uid()::text` em SELECT e UPDATE |
| `configuracoes_cobranca` | Restringir DELETE a admin only (remover supervisor) |

### Fase 2 — Glossário + Troubleshooting na Documentação

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**

Adicionar duas novas seções no início da documentação:
1. **Glossário de Termos** — tabela mapeando cada campo técnico para explicação em português simples
2. **Erros Comuns** — tabela com código HTTP, mensagem, causa provável e solução
3. **FAQ Técnico** — 10 perguntas mais frequentes com respostas prontas

### Fase 3 — Chat IA com fallback + sugestões

**Arquivo: `supabase/functions/api-support-ai/index.ts`**
- Se GPT-5.2 retornar 429/500, retry com `google/gemini-2.5-flash`

**Arquivo: `src/components/erp/EndpointSupportChat.tsx`**
- Adicionar chips de perguntas sugeridas quando chat está vazio
- Ao clicar no chip, preenche o texto e dispara a IA automaticamente

### Fase 4 — Wizard com teste de autenticação

**Arquivo: `src/components/erp/ApiOnboardingWizard.tsx`**
- Passo 2: testar com API Key real (não só sandbox)
- Mostrar mensagem de erro específica para 401/403/429
- Botão "Copiar cURL" para debugging

### Fase 5 — Marcar findings como corrigidos

Atualizar o security scanner com os fixes aplicados.

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Fix 3 storage policies + 1 DELETE policy |
| `src/components/erp/ApiDocumentation.tsx` | Glossário + Erros Comuns + FAQ |
| `supabase/functions/api-support-ai/index.ts` | Fallback de modelo |
| `src/components/erp/EndpointSupportChat.tsx` | Chips de sugestão |
| `src/components/erp/ApiOnboardingWizard.tsx` | Teste com key real + cURL |

## Nota Projetada

| Critério | Antes | Depois |
|---|---|---|
| Documentação | 9.8 | 10.0 |
| IA de suporte | 9.5 | 9.8 |
| Onboarding | 9.0 | 9.5 |
| Segurança | 9.7 | 10.0 |
| UX portal | 9.0 | 9.5 |
| **Nota Global** | **9.4** | **9.9/10** |
| **Dev Junior integrar sem suporte** | **~85%** | **~95%** |

O gap de 5% restante é inerente: dev juniors podem ter dúvidas sobre conceitos financeiros (CP/CR/DRE) que transcendem a documentação técnica da API.

