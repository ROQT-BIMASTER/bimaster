

# Correcao de Falhas de Seguranca

## Resumo dos Problemas Detectados

O scan de seguranca identificou **2 Errors**, **2 Warnings** e **4 Infos**. Apos analise detalhada, os problemas reais que precisam de correcao sao:

---

## Problema 1: Credenciais de Ads Expostas (Error)

**O que acontece:** A tabela `ads_accounts` tem duas policies SELECT conflitantes:
- `ads_accounts_no_direct_select` com `USING(false)` -- bloqueia tudo
- `ads_accounts_select_strict` com `can_access_ads_account()` -- permite acesso

No PostgreSQL, multiplas policies SELECT sao combinadas com logica **OR**, entao a policy de bloqueio e completamente anulada pela outra. Isso significa que quando o codigo faz `SELECT *` na tabela `ads_accounts`, o campo `credentials_encrypted` e retornado, expondo credenciais.

**Agravante:** O codigo em `AdsAccountsManager.tsx` e `AdsDashboard.tsx` faz `SELECT *` diretamente na tabela `ads_accounts` em vez de usar a view segura `ads_accounts_safe`.

**Correcao:**
1. Remover a policy `ads_accounts_select_strict` (que anula a de bloqueio)
2. Manter apenas `ads_accounts_no_direct_select` com `USING(false)` para forcar uso da view
3. Criar policy SELECT na view `ads_accounts_safe` com a mesma logica de `can_access_ads_account()`
4. Alterar o codigo frontend para usar `ads_accounts_safe` em vez de `ads_accounts` nas queries de leitura (INSERT/UPDATE/DELETE continuam na tabela base)

---

## Problema 2: Fila de Pagamento com Acesso Amplo (Warning)

**O que acontece:** A policy `fpq_select_policy` da tabela `financial_payment_queue` permite acesso a:
- `can_access_payment_queue()` -- Financeiro/Tesouraria/Controladoria (correto)
- `requested_by = auth.uid()` -- quem solicitou (correto)
- `is_admin_or_supervisor()` -- inclui **gerente** e **supervisor** (amplo demais)
- `user_has_empresa_access()` -- qualquer usuario vinculado a empresa (amplo demais)

O problema e que `is_admin_or_supervisor` da acesso a supervisores e gerentes que nao sao do financeiro, e `user_has_empresa_access` pode dar acesso a qualquer usuario vinculado a empresa.

**Correcao:**
1. Substituir a policy `fpq_select_policy` por uma versao mais restritiva:
   - Admins veem tudo
   - Financeiro/Tesouraria/Controladoria veem tudo (via `can_access_payment_queue`)
   - Usuarios veem apenas itens que **eles mesmos solicitaram** (`requested_by = auth.uid()`)
   - Remover `is_admin_or_supervisor` e `user_has_empresa_access` da policy

---

## Problema 3: Extensoes no Schema Public (Warning)

**O que acontece:** As extensoes `unaccent` e `pg_net` estao instaladas no schema `public` em vez de `extensions`.

**Correcao:**
1. Mover a extensao `unaccent` para o schema `extensions`
2. Atualizar as funcoes que dependem dela (`fn_calcular_cobertura_mercado`, `fn_normalizar_municipios_clientes`, `fn_normalizar_cliente_individual`, `fn_get_municipios_intelligence`, `fn_get_municipios_kpis`) para referenciar `extensions.unaccent()` em vez de `unaccent()`
3. A extensao `pg_net` e gerenciada pelo Supabase e nao pode ser movida (sera marcada como ignorada)

---

## Problema 4: Audit Logs devem ser Append-Only (Info)

**O que acontece:** A policy `audit_logs_insert` permite que qualquer usuario insira seus proprios logs (correto), mas nao ha protecao contra DELETE/UPDATE por usuarios nao-admin.

**Correcao:**
1. Adicionar policy explicita que bloqueia DELETE para nao-admins
2. Adicionar policy que bloqueia UPDATE para nao-admins
3. Aplicar a mesma logica para `sensitive_data_access_log`

---

## Itens ja Revisados (sem acao necessaria)

Os seguintes itens ja foram analisados e estao corretamente configurados:
- **SECURITY DEFINER functions** -- Todas com `SET search_path` (ignored)
- **Edge Functions sem JWT** -- Todas com autenticacao alternativa (ignored)
- **Marketing Assets Bucket** -- Intencionalmente publico (ignored)
- **Clientes Table** -- RLS correto com `can_access_cliente` (ignored)
- **Profiles Table** -- `can_view_profile` restringe corretamente (ignored)

---

## Secao Tecnica

### Migracoes SQL necessarias

**Migracao 1 - Ads Accounts:**
```text
-- Remover policy que conflita com a de bloqueio
DROP POLICY IF EXISTS ads_accounts_select_strict ON ads_accounts;

-- Garantir que a view ads_accounts_safe tem security_invoker
-- (ja tem, confirmado na analise)
```

**Migracao 2 - Financial Payment Queue:**
```text
-- Substituir a policy SELECT ampla por uma restritiva
DROP POLICY IF EXISTS fpq_select_policy ON financial_payment_queue;
CREATE POLICY fpq_select_policy ON financial_payment_queue
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    can_access_payment_queue(auth.uid()) OR
    requested_by = auth.uid()
  );
```

**Migracao 3 - Unaccent Extension:**
```text
-- Mover unaccent para schema extensions
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- Atualizar funcoes dependentes para usar extensions.unaccent()
```

**Migracao 4 - Audit Logs Append-Only:**
```text
-- Bloquear UPDATE em audit_logs para nao-admins
CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Bloquear DELETE em audit_logs para nao-admins
CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Mesmo para sensitive_data_access_log
CREATE POLICY sensitive_log_no_update ON sensitive_data_access_log
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY sensitive_log_no_delete ON sensitive_data_access_log
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
```

### Arquivos frontend a alterar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/marketing/ads/AdsAccountsManager.tsx` | SELECT de `ads_accounts` para `ads_accounts_safe` |
| `src/components/marketing/ads/AdsDashboard.tsx` | SELECT de `ads_accounts` para `ads_accounts_safe` |

As queries de INSERT, UPDATE e DELETE continuam operando na tabela `ads_accounts` diretamente, pois nao expoem credenciais e precisam da tabela base.

### Atualizacao dos findings de seguranca

Apos as correcoes, os findings resolvidos serao deletados e os que nao podem ser corrigidos (como `pg_net` no public schema) serao marcados como ignorados com justificativa.

