
# Plano de Correção e Profissionalização - Painel Supervisor Trade Marketing

## Diagnóstico do Problema

### Erro Identificado
O hook `useTradeSupervisorDashboard.ts` está usando o campo `ativo` que **não existe** na tabela `profiles`. O campo correto é `status = 'ativo'`.

### Problemas Adicionais Encontrados

| Problema | Impacto |
|----------|---------|
| Campo `ativo` inexistente | Query falha silenciosamente |
| Visitas usam `user_id`, não `atribuido_por` | Dados não aparecem |
| Equipe de Michele não tem dados de fotos/visitas ainda | Esperado (dados novos) |
| Falta tratamento de erros robusto | Dificulta debug |

### Estrutura Real das Tabelas

```text
+------------------+     +------------------+     +------------------+
|    profiles      |     |     visits       |     |     photos       |
+------------------+     +------------------+     +------------------+
| id               |     | id               |     | id               |
| nome             |     | user_id      ◄───|───► | vendedor_id  ◄───|
| email            |     | vendedor_id      |     | supervisor_id    |
| supervisor_id    |     | supervisor_id    |     | store_id         |
| status ('ativo') |     | atribuido_por    |     | upload_date      |
+------------------+     | scheduled_date   |     +------------------+
                         +------------------+
```

### Hierarquia Verificada (Michele)

```text
Leandro (Admin)
├── Michele Silva (Supervisor) ◄── USUÁRIO LOGADO
│   ├── Douglas Cruz (Vendedor)
│   ├── Juliana Moura (Vendedor)
│   ├── Monique Campos (Vendedor)
│   └── Nathalia Martini (Vendedor)
├── Jessika (Supervisor)
│   ├── Administrador Sistema
│   ├── Juliana Germinhasi
│   └── Leandro Ramos
└── ...
```

## Solução Proposta

### 1. Correção do Hook de Dados

**Arquivo:** `src/hooks/useTradeSupervisorDashboard.ts`

Correções necessárias:

1. **Campo de status**: Trocar `.eq("ativo", true)` por `.eq("status", "ativo")`
2. **Query de visitas**: Usar `user_id` ao invés de `atribuido_por` para buscar visitas realizadas
3. **Incluir o próprio supervisor**: Supervisor deve ver seus próprios dados também
4. **Melhorar tratamento de erros**: Adicionar logs e mensagens claras

### 2. Arquitetura Profissionalizada

```text
+-----------------------------------------------------------------------+
|                    ARQUITETURA PROFISSIONAL                           |
+-----------------------------------------------------------------------+
|                                                                       |
|  src/hooks/useTradeSupervisorDashboard.ts                            |
|  ├── fetchTeamMembers()     - Busca subordinados diretos             |
|  ├── buildFilterIds()       - Constrói array de IDs para filtrar     |
|  └── useQuery() paralelas   - Busca dados de forma otimizada         |
|                                                                       |
|  Queries Corrigidas:                                                  |
|  ├── profiles: .eq("status", "ativo")                                |
|  ├── visits: .in("user_id", filterIds)                               |
|  ├── photos: .in("vendedor_id", filterIds)                           |
|  ├── stores: .in("vendedor_id", filterIds)                           |
|  └── lancamentos: .in("created_by", filterIds)                       |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 3. Melhorias no Seletor de Equipe

**Arquivo:** `src/components/trade/supervisor/SupervisorTeamSelector.tsx`

- Mostrar nome do supervisor logado como cabeçalho
- Badge com contagem de membros ativos
- Indicador visual quando não há dados da equipe

### 4. Ajustes na Página Principal

**Arquivo:** `src/pages/TradeSupervisorDashboard.tsx`

- Adicionar indicador de "carregando equipe"
- Mostrar mensagem quando equipe não tem dados no período
- Melhorar feedback visual para estados vazios

## Detalhes Técnicos

### Correção Principal - Query de Equipe

```typescript
// ANTES (incorreto)
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nome, email, supervisor_id")
  .eq("supervisor_id", user.id)
  .eq("ativo", true);  // ❌ Campo não existe

// DEPOIS (correto)
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nome, email, supervisor_id")
  .eq("supervisor_id", user.id)
  .eq("status", "ativo");  // ✅ Campo correto
```

### Correção de Visitas

```typescript
// ANTES (incorreto para visitas realizadas)
.in("atribuido_por", filterIds)

// DEPOIS (correto - user_id é quem realizou)
.in("user_id", filterIds)
```

### Inclusão do Próprio Supervisor

```typescript
// O supervisor também deve aparecer nos dados
const filterIds = selectedMemberId 
  ? [selectedMemberId] 
  : [user.id, ...teamIds];  // ✅ Inclui o próprio supervisor
```

## Ordem de Implementação

| Passo | Ação | Arquivo |
|-------|------|---------|
| 1 | Corrigir campo `ativo` para `status` | useTradeSupervisorDashboard.ts |
| 2 | Corrigir query de visitas para `user_id` | useTradeSupervisorDashboard.ts |
| 3 | Incluir supervisor nos filterIds | useTradeSupervisorDashboard.ts |
| 4 | Adicionar tratamento de erros melhorado | useTradeSupervisorDashboard.ts |
| 5 | Melhorar UX do seletor de equipe | SupervisorTeamSelector.tsx |
| 6 | Adicionar estados vazios na página | TradeSupervisorDashboard.tsx |

## Testes a Realizar

1. **Teste como Michele**: Verificar se apenas Douglas, Juliana, Monique e Nathalia aparecem
2. **Teste como Jessika**: Verificar se apenas sua equipe aparece (Administrador Sistema, Juliana Germinhasi, Leandro Ramos)
3. **Teste como Admin (Leandro)**: Verificar se tem acesso via menu correto
4. **Teste filtro individual**: Selecionar um membro e verificar se dados filtram corretamente
5. **Teste período**: Alterar datas e verificar se KPIs atualizam

## Resultado Esperado

Após as correções:

1. Michele verá apenas seus 4 subordinados diretos
2. Dados de visitas, fotos e lançamentos serão filtrados corretamente
3. Seletor de equipe mostrará hierarquia limpa
4. Estados vazios serão tratados com mensagens amigáveis
5. Performance otimizada com queries paralelas
