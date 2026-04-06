

# Correção de Vulnerabilidades de Segurança — 9 Findings

## Resumo

O scan detectou **2 erros críticos** e **7 avisos** de segurança. Todos serão corrigidos via migração SQL.

## Correções

### 1. ERRO CRÍTICO — Stores: dados bancários expostos

**Problema**: Campos `pix_chave`, `banco`, `agencia`, `conta`, `tipo_conta`, `favorecido`, `linha_digitavel` acessíveis a qualquer usuário com acesso trade/comercial. Policy `stores_select_blocked` é PERMISSIVE (inútil).

**Solução**:
- Criar view `stores_safe` (sem campos bancários) para uso geral da aplicação
- Criar view `stores_with_banking` acessível apenas a admin/supervisor/financeiro
- Dropar policy `stores_select_blocked` (falsa segurança)
- Atualizar código frontend para usar a view `stores_safe` nos selects gerais

### 2. ERRO CRÍTICO — planos_reducao: acesso anônimo total

**Problema**: Policy `Acesso público planos_reducao` dá ALL para role `public` (anônimo).

**Solução**: Dropar a policy. As 4 policies autenticadas já cobrem CRUD corretamente.

### 3. AVISO — department_budgets: SELECT aberto

**Problema**: SELECT com `USING(true)` para todos autenticados.

**Solução**: Restringir SELECT a admin, supervisor ou usuários com módulo financeiro.

### 4. AVISO — trade_campaign_expenses: SELECT aberto

**Problema**: SELECT `USING(true)`.

**Solução**: Restringir a dono (`created_by`), admin/supervisor ou módulo trade.

### 5. AVISO — ap_data_source_config: SELECT/INSERT/UPDATE abertos

**Problema**: Config ERP legível/editável por todos.

**Solução**: Restringir todas as operações a admin/supervisor.

### 6. AVISO — fabrica_custo_evidencias: SELECT aberto

**Problema**: SELECT `true` contradiz INSERT/DELETE que exigem `can_access_fabrica`.

**Solução**: Alinhar SELECT com `can_access_fabrica(auth.uid())`.

### 7. AVISO — fabrica_insumo_custo_historico: SELECT aberto

**Problema**: Mesmo caso anterior.

**Solução**: Restringir SELECT a `can_access_fabrica(auth.uid())`.

### 8. AVISO — financial_correction_rules: SELECT + ALL abertos

**Problema**: SELECT e ALL com `USING(true)` / `auth.uid() IS NOT NULL`.

**Solução**: Dropar policy ALL redundante, restringir SELECT a admin/supervisor/financeiro.

### 9. AVISO — Extensions no schema public

**Problema**: Extensões instaladas no schema `public`.

**Solução**: Não corrigível via migração (gerenciado pelo Supabase). Marcar como ignorado.

## Implementação Técnica

Uma única migração SQL com:

```text
1. DROP policy "stores_select_blocked" (PERMISSIVE inútil)
2. CREATE VIEW stores_safe (exclui campos bancários)
3. DROP policy "Acesso público planos_reducao"
4. REPLACE policy department_budgets SELECT → admin/supervisor/financeiro
5. REPLACE policy trade_campaign_expenses SELECT → owner/admin/trade
6. REPLACE policies ap_data_source_config → admin/supervisor only
7. REPLACE policy fabrica_custo_evidencias SELECT → can_access_fabrica
8. REPLACE policy fabrica_insumo_custo_historico SELECT → can_access_fabrica  
9. REPLACE policies financial_correction_rules → admin/supervisor/financeiro
```

Atualização no frontend: substituir queries diretas a `stores` por `stores_safe` nos módulos que não precisam de dados bancários (Trade, Comercial, CRM).

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | 9 correções de policies + criação de view `stores_safe` |
| Componentes que usam tabela `stores` | Avaliar e migrar para `stores_safe` onde não precisa de dados bancários |

