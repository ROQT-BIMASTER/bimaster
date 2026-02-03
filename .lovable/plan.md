

# Plano de Segurança - Hardening Completo

## Resumo Executivo

Este plano corrige **8 vulnerabilidades de segurança** identificadas no sistema, focando em:
- Políticas RLS permissivas que usam `USING(true)` ou `WITH CHECK(true)`
- Políticas duplicadas/conflitantes em tabelas sensíveis
- Tabela de rate limiting sem RLS habilitado
- Consolidação de acesso ao módulo fábrica

## Problemas Identificados

### 1. Tabelas de Custos de Fábrica - CRÍTICO
As tabelas `fabrica_produto_custos` e `fabrica_produto_custos_config` possuem políticas permissivas que permitem qualquer usuário autenticado:
- Inserir dados de custos
- Atualizar custos
- Excluir custos

**Risco:** Usuários sem acesso ao módulo fábrica podem manipular dados de custos de produção.

### 2. Políticas Duplicadas em Trade Budgets - MÉDIO
A tabela `trade_budgets` possui políticas conflitantes:
- 3 políticas SELECT diferentes
- 3 políticas UPDATE diferentes
- 2 políticas INSERT diferentes
- 2 políticas DELETE diferentes

**Risco:** Lógica de acesso confusa e potencialmente inconsistente.

### 3. Políticas Duplicadas em Bank Accounts - MÉDIO
A tabela `trade_bank_accounts` possui 2 políticas SELECT duplicadas.

### 4. Tabela sync_rate_limiter sem RLS - BAIXO
A tabela `sync_rate_limiter` não tem RLS habilitado.

**Risco:** Embora seja uma tabela de controle interno, deve ter proteção de service_role.

## Ações Planejadas

### Fase 1: Criar Função de Acesso à Fábrica

```text
┌─────────────────────────────────────────────────────┐
│            can_access_fabrica(_user_id)             │
├─────────────────────────────────────────────────────┤
│  ✓ Admins e Supervisores têm acesso total           │
│  ✓ Usuários com módulo 'fabrica' têm acesso         │
│  ✓ SET search_path = public (segurança)             │
└─────────────────────────────────────────────────────┘
```

### Fase 2: Hardening das Tabelas de Custos

Substituir políticas permissivas por:

| Operação | Política Atual | Nova Política |
|----------|----------------|---------------|
| SELECT | `auth.uid() IS NOT NULL` | `can_access_fabrica(auth.uid())` |
| INSERT | `WITH CHECK(true)` | `can_access_fabrica(auth.uid())` |
| UPDATE | `USING(true)` | `can_access_fabrica(auth.uid())` |
| DELETE | `USING(true)` | `is_admin_or_supervisor(auth.uid())` |

### Fase 3: Consolidar Políticas de Trade Budgets

Remover políticas duplicadas e manter apenas:

| Operação | Política Consolidada |
|----------|---------------------|
| SELECT | Criador, solicitante, admin, supervisor, ou módulos marketing/financeiro/trade |
| INSERT | Criador, solicitante, ou admin/supervisor |
| UPDATE | Admin ou supervisor |
| DELETE | Apenas admin |

### Fase 4: Consolidar Políticas de Bank Accounts

Remover política duplicada de SELECT e manter apenas `can_access_bank_accounts()`.

### Fase 5: Proteger sync_rate_limiter

Habilitar RLS e restringir acesso a service_role.

## Detalhes Técnicos

### Migração SQL

A migração criará:

1. **Função `can_access_fabrica`** - Verifica acesso ao módulo fábrica
2. **Remoção de políticas permissivas** em `fabrica_produto_custos` e `fabrica_produto_custos_config`
3. **Novas políticas restritivas** baseadas em módulo/role
4. **Consolidação de políticas** em `trade_budgets` e `trade_bank_accounts`
5. **Habilitação de RLS** em `sync_rate_limiter` com bloqueio de acesso público

### Hierarquia de Acesso Final

```text
┌────────────────────────────────────────────────────────────┐
│                  Tabelas de Custos de Fábrica              │
├────────────────────────────────────────────────────────────┤
│  ADMIN/SUPERVISOR                                          │
│  ├── SELECT ✓  INSERT ✓  UPDATE ✓  DELETE ✓                │
│                                                            │
│  USUÁRIO COM MÓDULO FÁBRICA                                │
│  ├── SELECT ✓  INSERT ✓  UPDATE ✓  DELETE ✗                │
│                                                            │
│  OUTROS USUÁRIOS                                           │
│  └── SELECT ✗  INSERT ✗  UPDATE ✗  DELETE ✗                │
└────────────────────────────────────────────────────────────┘
```

### Impacto no Sistema

- Usuários do módulo fábrica continuam operando normalmente
- Admins e supervisores mantêm acesso total
- Usuários sem permissão ao módulo não conseguirão mais visualizar/modificar custos
- Operações de trade budget ficam mais consistentes

### Rollback

Se necessário reverter, as políticas originais podem ser restauradas via nova migração.

