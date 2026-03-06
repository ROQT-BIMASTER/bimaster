

## Análise das Falhas de Segurança

Baseado no scan e na imagem, aqui está o diagnóstico de cada item:

---

### ERROS (4)

| # | Finding | Status Real | Ação Necessária |
|---|---------|------------|-----------------|
| 1 | **Expense storage buckets públicos** | ✅ Já corrigido (ignored) | Nenhuma — buckets já são privados, migration posterior corrigiu |
| 2 | **Billing API keys no banco** | ✅ Já mitigado (ignored) | Nenhuma — frontend usa view `_safe` com mascaramento; base restrita a admin |
| 3 | **AI Extraction sem autenticação** | 🔴 **Aberto** | Adicionar validação JWT nas funções `extrair-materia-prima-ia` e `extrair-produto-ia`. Qualquer pessoa pode chamar e gastar créditos de IA |
| 4 | **datawarehouse-api aceita qualquer tabela** | 🔴 **Aberto** | Adicionar allowlist de tabelas permitidas. Hoje aceita nomes arbitrários e usa `service_role`, bypassando todo RLS |

### WARNINGS (6)

| # | Finding | Status Real | Ação Necessária |
|---|---------|------------|-----------------|
| 1 | **High severity vulnerabilities in dependencies** | ⚠️ Verificar | Atualizar pacotes npm com vulnerabilidades conhecidas |
| 2 | **Ads credentials sem criptografia** | ⚠️ Aberto | Coluna `credentials_encrypted` provavelmente armazena texto plano. Mitigado por view `_safe` e RLS, mas não criptografado de fato |
| 3 | **SECURITY DEFINER search_path = public** | ✅ Já corrigido | Todas as 100+ funções atualizadas para `search_path = ''` |
| 4 | **Status/Config endpoints sem auth** | ⚠️ Aberto | Endpoints `/health`, `/configs`, `/status` expõem detalhes internos sem autenticação |
| 5 | **Extension in Public** | ✅ Ignorado | `pg_net` é gerenciado pelo Cloud, não pode ser movido |
| 6 | **RLS Policy Always True** | ⚠️ Aberto | Políticas permissivas `USING(true)` em operações INSERT/UPDATE/DELETE |

### INFO (1)

| # | Finding | Status |
|---|---------|--------|
| 1 | **Comprehensive Security Review** | ✅ Score STRONG — 307 tabelas, 1900+ policies, 85+ edge functions |

---

### Priorização de Correções

**Prioridade CRÍTICA (fazer agora):**

1. **datawarehouse-api — allowlist de tabelas**
   - Arquivo: `supabase/functions/datawarehouse-api/index.ts`
   - Criar `Set` de tabelas permitidas para dimensions, facts e custom queries
   - Rejeitar qualquer tabela fora da lista com status 400
   - Impacto: Impede acesso a `auth.users`, `user_roles`, `contas_pagar`, etc.

2. **AI Extraction — adicionar autenticação**
   - Arquivos: `supabase/functions/extrair-materia-prima-ia/index.ts` e `extrair-produto-ia/index.ts`
   - Adicionar validação JWT via `getClaims()` no início do handler
   - Impacto: Impede abuso externo dos créditos de IA

**Prioridade ALTA:**

3. **Status/Config endpoints — adicionar auth**
   - Endpoints `integration-router /health+/configs`, `contas-pagar-api /status`, `contas-receber-api /sync-status`
   - Adicionar `validateApiKey()` ou JWT check nesses handlers específicos
   - Impacto: Elimina vazamento de informações internas

4. **RLS Policy Always True**
   - Identificar quais tabelas têm `USING(true)` em INSERT/UPDATE/DELETE
   - Substituir por políticas baseadas em `auth.uid()` ou role

**Prioridade MÉDIA:**

5. **Dependências npm com vulnerabilidades**
   - Rodar auditoria e atualizar pacotes afetados

6. **Ads credentials — criptografia real**
   - Implementar pgcrypto ou criptografia na edge function antes de gravar

---

### Resumo

- **2 itens já corrigidos/ignorados** (buckets, billing keys) — sem ação
- **1 item já corrigido** (search_path) — sem ação  
- **1 item de infraestrutura** (pg_net extension) — sem ação
- **4 itens precisam de correção** (datawarehouse-api, AI extraction, status endpoints, RLS always true)
- **2 itens de melhoria** (dependências, criptografia ads)

Posso implementar as correções na ordem de prioridade acima. Deseja prosseguir?

