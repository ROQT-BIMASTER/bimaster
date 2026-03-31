

# Elevar Score de Segurança — 4 Errors + 3 Warnings

## Scan Atual: 7 Findings

### 🔴 4 Errors

| # | Finding | Problema |
|---|---------|----------|
| 1 | **Realtime channel authorization** | Qualquer autenticado pode assinar qualquer canal Realtime e ver dados de prospects, notifications, visits, etc. |
| 2 | **process-attachments** bucket | SELECT sem ownership — qualquer autenticado lê todos os documentos de processos |
| 3 | **documento-anexos** bucket | SELECT e INSERT sem ownership — qualquer autenticado lê/grava documentos de empresas |
| 4 | **projeto-anexos** bucket | SELECT e INSERT sem ownership — qualquer autenticado lê anexos de projetos sem ser membro |

### 🟡 3 Warnings

| # | Finding | Problema |
|---|---------|----------|
| 5 | **Extensions in public** | Extensões instaladas no schema `public` (limitação da plataforma) |
| 6 | **RLS always true** | Policies com `USING(true)` ou `WITH CHECK(true)` em operações de escrita |
| 7 | **Storage INSERT sem path ownership** | 5 buckets (`fabrica-revisao-docs`, `marketing-assets`, `campaign-evidence`, `comprovantes`, `trade-budget-docs`) permitem upload em qualquer pasta |

## Plano de Correção

### Fix 1: Realtime — remover tabelas sensíveis da publicação

Remover `prospects`, `notifications`, `lead_activity_logs`, `visits` e `fabrica_revisao_documentos` do `supabase_realtime`. Substituir realtime dessas tabelas por polling ou RPCs no frontend (se necessário).

```sql
ALTER PUBLICATION supabase_realtime DROP TABLE prospects;
ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
ALTER PUBLICATION supabase_realtime DROP TABLE lead_activity_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE visits;
ALTER PUBLICATION supabase_realtime DROP TABLE fabrica_revisao_documentos;
```

Depois marcar o finding `REALTIME_NO_CHANNEL_AUTHORIZATION` como mitigado (schema reservado).

### Fix 2: process-attachments — restringir SELECT

Remover policy permissiva e criar nova com path ownership ou join ao processo.

```sql
DROP POLICY [policy permissiva] ON storage.objects;
CREATE POLICY "Users read own process attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'process-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_or_supervisor(auth.uid())
    )
  );
```

### Fix 3: documento-anexos — restringir SELECT e INSERT

```sql
-- Remover policies permissivas e recriar com ownership
-- SELECT: path ownership ou empresa access
-- INSERT: (storage.foldername(name))[1] = auth.uid()::text
```

### Fix 4: projeto-anexos — usar `user_can_access_projeto()`

Seguir o padrão já existente em `projeto-documentos` que valida membership.

### Fix 5: Extensions in public — ignorar

Limitação da plataforma Lovable Cloud. Marcar como aceito.

### Fix 6: RLS always true — auditar e corrigir

Verificar quais tabelas têm `WITH CHECK(true)` em INSERT/UPDATE/DELETE e restringir onde necessário.

### Fix 7: Storage INSERT path ownership — 5 buckets

Adicionar `(storage.foldername(name))[1] = auth.uid()::text` com fallback para admin/supervisor nos 5 buckets listados.

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 4 errors, 3 warnings | 0 errors, 1 warning (extensions — aceito) |
| Score ~90 | Score ~98 |

## Execução

1 migration SQL cobrindo todos os fixes. Verificação prévia das policies existentes em cada bucket antes de dropar. Zero alterações no frontend (exceto se realtime quebrar funcionalidade visível).

