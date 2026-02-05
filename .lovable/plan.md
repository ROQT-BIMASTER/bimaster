
# Plano: Criar Hierarquia de Gerente e Configurar Milene

## Situacao Atual

A hierarquia atual do sistema possui 4 niveis (admin, supervisor, vendedor, promotor). O banco de dados ja possui o valor 'gerente' no enum `app_role` e a coluna `gerente_id` na tabela `profiles`, porem nenhum dos dois esta em uso.

### Hierarquia Atual (Banco de Dados)
```text
Leandro (Admin)
  |-- Jessika (Supervisor) -> Adm Sistema, Juliana G., Leandro R.
  |-- Michele (Supervisor) -> Douglas, Juliana M., Monique, Nathalia

Milene (Supervisor, sem vinculo) -> Larissa Araujo
```

### Hierarquia Desejada
```text
Leandro (Admin)
  |
  Milene (Gerente)
    |-- Jessika (Supervisor) -> Adm Sistema, Juliana G., Leandro R.
    |-- Michele (Supervisor) -> Douglas, Juliana M., Monique, Nathalia
    |-- Larissa Araujo (Vendedor - direto)
```

## O Que Sera Feito

### Passo 1 -- Migracoes no Banco de Dados

Uma unica migracao SQL que faz:

1. **Alterar role da Milene** de 'supervisor' para 'gerente' na tabela `user_roles`
2. **Vincular supervisoras a Milene** -- definir `supervisor_id` de Jessika e Michele para o ID da Milene, de modo que a funcao recursiva `get_subordinados` retorne toda a arvore abaixo
3. **Atualizar funcao `is_admin_or_supervisor`** para incluir 'gerente' -- isso corrige automaticamente todas as **43 politicas RLS** que usam esta funcao, sem precisar alterar cada uma individualmente
4. **Atualizar funcao `has_role_or_higher`** para incluir gerente na hierarquia (admin=1, gerente=2, supervisor=3, vendedor=4, promotor=5)

Apos esta migracao, a Milene tera acesso via RLS a todos os dados que seus supervisores e vendedores acessam, porque `get_subordinados(Milene)` retornara recursivamente: Jessika, Michele, e todos os vendedores de ambas.

### Passo 2 -- Atualizar Hook `useUserRole`

Adicionar no hook:
- Flag `isGerente` (role === 'gerente')
- Atualizar `isAdminOrSupervisor` para incluir gerente: `admin || supervisor || gerente`
- Manter retrocompatibilidade -- todos os componentes que ja usam `isAdminOrSupervisor` passam a funcionar com gerente automaticamente

### Passo 3 -- Atualizar Hook `useFilteredStores`

O calculo de `effectiveIsSupervisor` sera expandido para incluir gerente. Como a funcao `get_subordinados` ja e recursiva, o gerente vera automaticamente as lojas de toda a cadeia hierarquica abaixo.

### Passo 4 -- Atualizar `TeamHierarchyFilter`

Adicionar suporte ao role 'gerente':
- Icone e label para gerente
- Permitir que gerentes vejam a hierarquia (mesmo acesso que supervisores e admins)
- O gerente vera seus subordinados (supervisores + vendedores) na arvore

### Passo 5 -- Atualizar `GerenciamentoUsuarios`

- Adicionar 'Gerente' como opcao no dropdown de tipo de usuario
- Ajustar filtro de "Superior Hierarquico" para que supervisores possam ter gerentes como superior
- Exibir badge correta na tabela de usuarios

### Passo 6 -- Atualizar `useTradeSupervisorDashboard`

O dashboard "Minha Equipe" precisa reconhecer o role 'gerente'. O gerente deve usar o mesmo caminho de codigo que o supervisor (filtrado por hierarquia usando `supervisor_id`), e nao o caminho do admin (que ve tudo).

### Passo 7 -- Incrementar Versao

Atualizar `APP_VERSION` para `1.1.4` para forcar limpeza de cache em todos os dispositivos.

## Detalhes Tecnicos

### Migracao SQL

```text
-- 1. Alterar role da Milene para gerente
UPDATE user_roles SET role = 'gerente' WHERE user_id = '7eb17733-...';

-- 2. Vincular supervisoras a Milene via supervisor_id
UPDATE profiles SET supervisor_id = '7eb17733-...' WHERE id IN ('23d470c6-...', '9b55c37f-...');

-- 3. Atualizar is_admin_or_supervisor para incluir gerente
CREATE OR REPLACE FUNCTION is_admin_or_supervisor(_user_id uuid)
  ... WHERE role IN ('admin', 'supervisor', 'gerente') ...

-- 4. Atualizar has_role_or_higher com gerente no nivel 2
  WHEN 'gerente' THEN 2
  WHEN 'supervisor' THEN 3
  WHEN 'vendedor' THEN 4
  WHEN 'promotor' THEN 5
```

### useUserRole.ts -- Mudancas

```text
// Adicionar:
isGerente: userType === "gerente"

// Atualizar:
isAdminOrSupervisor: admin || supervisor || gerente
```

### useFilteredStores.ts -- Mudancas

```text
// effectiveIsSupervisor passa a incluir gerente:
const effectiveIsSupervisor = role === 'supervisor' || role === 'gerente'
```

### Arquivos Modificados

1. Nova migracao SQL (banco de dados)
2. `src/hooks/useUserRole.ts`
3. `src/hooks/useFilteredStores.ts`
4. `src/components/trade/TeamHierarchyFilter.tsx`
5. `src/components/configuracoes/GerenciamentoUsuarios.tsx`
6. `src/hooks/useTradeSupervisorDashboard.ts`
7. `src/lib/version.ts`

### Por que funciona sem alterar 43 politicas RLS

A funcao `is_admin_or_supervisor` e usada em 43 politicas RLS. Ao adicionar 'gerente' nesta funcao, TODAS as politicas passam a reconhecer o novo role automaticamente, sem necessidade de drop/recreate de cada policy individual.

### Fluxo recursivo do `get_subordinados`

A funcao ja e recursiva (usa WITH RECURSIVE). Ao definir `supervisor_id` das supervisoras para Milene:
- `get_subordinados(Milene)` retorna Jessika, Michele, Larissa
- Depois desce recursivamente: todos os vendedores de Jessika e Michele
- Resultado: toda a arvore fica acessivel para Milene
