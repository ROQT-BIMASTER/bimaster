

# Segurança de Tokens e Exclusão de Chaves Antigas

## Problemas Identificados

1. **Sem botão de excluir** — A tabela `erp_api_keys` só tem toggle ativar/desativar, sem opção de deletar chaves expiradas ou inativas
2. **`token_plain` armazenado em texto claro** — A tabela `team_form_tokens` guarda o token original na coluna `token_plain`, violando boas práticas (deveria guardar apenas o hash)
3. **Sem limpeza automática** — Chaves expiradas e tokens vencidos permanecem indefinidamente no banco
4. **Sem confirmação de exclusão** — Precisa de AlertDialog para evitar exclusões acidentais

## Implementação

### 1. Botão Excluir na tabela de API Keys

**Arquivo: `src/pages/IntegracaoERP.tsx`**
- Adicionar coluna "Ações" com botão de exclusão (ícone Trash2)
- AlertDialog de confirmação antes de deletar
- Função `handleDelete` que remove a chave do banco
- Permitir exclusão apenas de chaves **inativas ou expiradas** (segurança)

### 2. Limpeza de `token_plain` dos team_form_tokens

**Migração SQL:**
- Limpar todos os `token_plain` existentes (SET token_plain = NULL)
- O hook `useTeamFormTokens.ts` já retorna o token ao gerar — ele é exibido uma vez e depois não precisa estar no banco

### 3. Exclusão em massa de chaves expiradas

**Arquivo: `src/pages/IntegracaoERP.tsx`**
- Botão "Limpar Expiradas" no header da tabela
- Remove todas as chaves onde `expires_at < now()` e `active = false`
- AlertDialog com contagem de quantas serão removidas

### 4. Audit log de exclusões

**Migração SQL:**
- Registrar exclusões de API keys na tabela de auditoria existente via trigger

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/pages/IntegracaoERP.tsx` | Botão excluir individual + limpeza em massa |
| Migração SQL | Limpar token_plain, trigger de auditoria |

