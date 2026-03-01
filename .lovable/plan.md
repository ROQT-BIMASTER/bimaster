

## Plano: Análise de Segurança Completa e Correções

### Resultados da Auditoria

Scan realizado em 307 tabelas, 1900+ políticas RLS, 390+ funções SECURITY DEFINER, 85+ edge functions.

| # | Vulnerabilidade | Severidade | Status |
|---|----------------|-----------|--------|
| 1 | View `fabrica_fornecedores_safe` com `security_invoker=off` (DEFINER) | CRITICO | Aberta |
| 2 | `configuracoes_cobranca` expõe `api_key` e `whatsapp_verify_token` ao frontend | CRITICO | Aberta |
| 3 | `team_member_details`: supervisores veem CPF/RG via `supervisor_team_read_access` | ALTO | Aberta |
| 4 | `stores`: dados bancários acessíveis via tabela direta (sem bloqueio de SELECT) | ALTO | Aberta |
| 5 | `clientes_safe` é INVOKER mas `clientes` tabela base não bloqueia SELECT direto | MEDIO | Aberta |
| 6 | search_path injection em SECURITY DEFINER | -- | ✅ Corrigido |
| 7 | Storage buckets públicos | -- | ✅ Corrigido |
| 8 | Extensions em public (pg_net) | -- | ✅ Ignorado (limitação plataforma) |

### Correções Propostas

**1. Corrigir `fabrica_fornecedores_safe` -- security_invoker=on** (Migração SQL)

Recriar a view com `security_invoker=on` para que RLS do usuário seja respeitado. Isso resolve o alerta ERROR do linter.

**2. Criar `configuracoes_cobranca_safe` e bloquear SELECT direto** (Migração SQL)

- Criar view que retorna `'***'` para `api_key` e `whatsapp_verify_token`
- Adicionar política RLS `USING(false)` para SELECT na tabela base
- Atualizar o componente `ConfiguracoesCobrancaAutomatica.tsx` para usar a view safe
- Admin vê os tokens mascarados na UI; edge functions continuam lendo via service_role

**3. Remover `supervisor_team_read_access` de `team_member_details`** (Migração SQL)

Supervisores não precisam ver CPF/RG. A política `team_details_select_strict` já cobre admin + dono do registro. Remover a política que vaza PII.

**4. Bloquear SELECT direto na tabela `stores` e forçar uso de `stores_safe`** (Migração SQL)

- Substituir a política `stores_select` por `USING(false)` na tabela base
- A view `stores_safe` já mascara dados bancários e já é `security_invoker=on`
- Verificar que o frontend usa `stores_safe` (ou `stores` via view -- a tipagem Supabase já referencia `stores_safe`)

**5. Atualizar findings de segurança** (Security registry)

Marcar issues resolvidas e criar novos findings para itens pendentes.

### Arquivos Impactados

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Views + RLS para 4 correções |
| `src/components/configuracoes/ConfiguracoesCobrancaAutomatica.tsx` | Usar view safe, mascarar tokens na UI |
| Security findings registry | Atualizar status |

### Detalhes Técnicos

```text
ANTES (vulnerável)                    DEPOIS (blindado)
┌─────────────────────┐              ┌─────────────────────┐
│ Frontend SELECT     │              │ Frontend SELECT     │
│ configuracoes_      │──→ api_key   │ configuracoes_      │──→ '***'
│ cobranca            │              │ cobranca_safe       │
└─────────────────────┘              └─────────────────────┘
                                     │ tabela base: USING(false)
                                     │ edge functions: service_role ✅

┌─────────────────────┐              ┌─────────────────────┐
│ Supervisor SELECT   │              │ Supervisor SELECT   │
│ team_member_details │──→ CPF, RG   │ team_member_details │──→ BLOQUEADO
└─────────────────────┘              └─────────────────────┘
                                     │ Apenas admin + próprio usuário
```

A migração será uma única transação SQL atômica -- se qualquer parte falhar, nada é aplicado.

