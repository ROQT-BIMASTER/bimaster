

# Auditoria de Hierarquia — Falhas e Melhorias

## Problemas Encontrados

### 1. `usuario_tem_acesso_loja` ignora o role "gerente"

A funcao (migration `20251030184321`) verifica apenas `admin` e `supervisor` por role explícito. Um gerente NAO tem bypass — ele so acessa lojas se for supervisor direto via `is_supervisor_of()`. Porem, `is_admin_or_supervisor()` ja inclui gerente. A funcao `usuario_tem_acesso_loja` deveria usar `is_admin_or_supervisor()` em vez de `has_role(_, 'admin')` e `has_role(_, 'supervisor')` separados.

**Impacto**: Gerentes podem nao ver lojas de seus subordinados indiretos.

### 2. `get_subordinados` nao filtra por status

A RPC retorna TODOS os subordinados, incluindo usuarios com `status != 'ativo'`. Isso significa que dados de usuarios inativos/desligados aparecem em dashboards de equipe, mapa, e rankings.

**Impacto**: Supervisores veem dados de usuarios desligados.

### 3. HierarquiaUsuarios.tsx — role "gerente" nao aparece nas estatísticas

O card de estatísticas (linha 514) mostra Admin, Supervisor, Vendedor, Promotor — mas NAO mostra Gerente. O campo `stats.gerentes` e calculado mas nunca renderizado. Gerentes aparecem como "supervisores" na arvore (linha 121: `u.role === 'supervisor' || u.role === 'gerente'`), misturando os dois.

### 4. HierarquiaUsuarios.tsx — "Sem Supervisor" exclui gerentes indevidamente

Linha 691/712: o filtro `u.role !== 'supervisor'` exclui supervisores sem superior, mas NAO exclui gerentes. Um gerente sem `supervisor_id` nao deveria aparecer como "sem supervisor" (gerentes sao nivel 2 na hierarquia).

### 5. Coluna `gerente_id` na tabela profiles e redundante

`profiles` tem AMBOS `supervisor_id` e `gerente_id`. Apenas `supervisor_id` e usado pela hierarquia recursiva (`get_subordinados`, `is_supervisor_of`). `gerente_id` e usado apenas em 1 lugar (`ProjetoTarefaDetalhe.tsx` linha 208: `profile?.supervisor_id || profile?.gerente_id`). Isso cria ambiguidade — qual campo e o "verdadeiro" superior?

### 6. `isAdminOrSupervisor` no frontend inclui gerente, mas nome e enganoso

`useUserRole.ts` define `isAdminOrSupervisor = admin || gerente || supervisor`. O nome sugere apenas 2 roles, mas inclui 3. Todos os 37 componentes que usam esse flag assumem comportamento de "gestao", o que esta correto, mas o nome causa confusao.

### 7. Drag-and-drop ausente na hierarquia

A interface de hierarquia usa Select dropdowns para vincular supervisores. Com muitos usuarios, reorganizar a arvore e lento e propenso a erros. Nao ha visualizacao de organograma.

### 8. Sem auditoria de mudancas hierarquicas

Trocar o `supervisor_id` de um usuario nao gera log. Nao ha historico de quem alterou a hierarquia, quando, ou qual era o estado anterior.

### 9. Role "cliente" existe no frontend mas nao no banco

`useUserRole.ts` reconhece o tipo "cliente", mas o enum `app_role` no banco NAO inclui "cliente". Se um usuario tiver esse role atribuído manualmente, a RPC falharia.

## Plano de Melhorias

### Fase 1 — Correcoes criticas de dados

1. **Recriar `usuario_tem_acesso_loja`**: Usar `is_admin_or_supervisor()` para o bypass inicial, cobrindo admin+gerente+supervisor
2. **Filtrar inativos em `get_subordinados`**: Adicionar `AND status = 'ativo'` na CTE recursiva (ou join com profiles para verificar)
3. **HierarquiaUsuarios.tsx**: Adicionar card de Gerentes; excluir gerentes do bloco "Sem Supervisor"; separar visualmente gerentes de supervisores na arvore

### Fase 2 — Limpeza estrutural

4. **Deprecar `gerente_id`**: Migrar o unico uso em `ProjetoTarefaDetalhe.tsx` para usar apenas `supervisor_id`. Marcar a coluna como deprecated (comment SQL)
5. **Renomear `isAdminOrSupervisor`**: Alias para `isManager` (manter retrocompatibilidade com export do nome antigo)
6. **Adicionar auditoria**: Trigger SQL que insere em `audit_logs` ao alterar `supervisor_id` em profiles

### Fase 3 — UX

7. **Organograma visual**: Renderizar a hierarquia como arvore com linhas de conexao (CSS tree) em vez de lista indentada
8. **Busca e filtro**: Adicionar campo de busca por nome/email na tela de hierarquia

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Recriar `usuario_tem_acesso_loja` com `is_admin_or_supervisor`; filtrar inativos em `get_subordinados`; trigger de auditoria |
| `src/components/configuracoes/HierarquiaUsuarios.tsx` | Card gerente; filtro corrigido; organograma visual |
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Remover uso de `gerente_id` |
| `src/hooks/useUserRole.ts` | Adicionar alias `isManager` |

