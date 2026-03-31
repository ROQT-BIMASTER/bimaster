

# Correção dos Findings Restantes — 4 Errors + 2 Warnings

## Diagnóstico Atual (via queries diretas)

### 🔴 4 Errors

| # | Finding | Problema Real |
|---|---------|--------------|
| 1 | **trade-photos UPDATE/DELETE sem ownership** | 2 policies antigas permitem UPDATE/DELETE a qualquer autenticado sem verificar dono: `"Usuários podem atualizar suas próprias fotos"` e `"Usuários podem deletar suas próprias fotos"` têm `qual: bucket_id = 'trade-photos'` SEM check de `owner` |
| 2 | **vendor_availability acesso público** | Policy `"Todos podem ver disponibilidade"` com `qual: true` — permite SELECT até para anon |
| 3 | **realtime.messages** | Schema reservado do Supabase — **não pode ser corrigido** (limitação da plataforma) |
| 4 | **dynamic_form_attachments acesso anon** | Policy `"Anyone can read attachments"` dá SELECT a `anon, authenticated` com `USING(true)` |

### 🟡 2 Warnings

| # | Finding | Problema |
|---|---------|----------|
| 5 | **Storage INSERT sem path ownership** | 15+ buckets permitem upload em qualquer pasta sem verificar `auth.uid()` no path |
| 6 | **Dynamic forms anon** | Coberto pelo item 4 acima |

## Plano de Correção (1 migration)

### Fix 1: trade-photos — remover policies duplicadas sem ownership

```sql
DROP POLICY "Usuários podem atualizar suas próprias fotos" ON storage.objects;
DROP POLICY "Usuários podem deletar suas próprias fotos" ON storage.objects;
-- Policies corretas já existem:
-- "Criadores podem atualizar fotos trade" (owner check)
-- "Admins podem deletar fotos trade" (admin check)
-- "Users can delete own trade photos" (owner OR admin)
```

### Fix 2: vendor_availability — restringir SELECT

```sql
DROP POLICY "Todos podem ver disponibilidade" ON vendor_availability;
-- Policies existentes já cobrem:
-- "Admins e supervisores visualizam toda disponibilidade"
-- "Vendedores gerenciam sua disponibilidade" (ALL com vendedor_id = auth.uid())
```

### Fix 3: dynamic_form_attachments — remover anon, manter via RPC

```sql
DROP POLICY "Anyone can read attachments" ON dynamic_form_attachments;

CREATE POLICY "Authenticated can read attachments"
  ON dynamic_form_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anon read active form attachments"
  ON dynamic_form_attachments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM dynamic_forms f
    WHERE f.id = dynamic_form_attachments.form_id
    AND f.status = 'active'
  ));
```

### Fix 4: Storage path ownership — adicionar `uid()` check em INSERT

Para os 15 buckets sem path ownership, adicionar check `(storage.foldername(name))[1] = auth.uid()::text`. Buckets afetados:
- pasta-digital, china-pasta-digital, amostras, embalagem-analise, etiqueta-bula
- projeto-documentos, aprovacao-artes, documento-anexos, fabrica-nfe-xmls
- campaign-evidence, fabrica-custo-evidencias, fabrica-produto-fotos
- produto-brasil-imagens, projeto-anexos, process-attachments, fluxo-artes
- trade-assets, trade-expense-docs

**Nota:** Preciso verificar se o frontend já organiza uploads por `uid/` path — senão, o path ownership quebrará uploads existentes. Vou criar as policies com fallback para admin/supervisor.

### Fix 5: realtime.messages — marcar como ignorado

Schema reservado, não podemos criar policies. Será registrado como limitação aceita.

### Fix 6: Remover INSERT duplicadas conflitantes

- `department-expense-docs` tem 2 INSERT policies (uma com path ownership, outra sem) — remover a sem ownership
- `event-expense-docs` mesmo caso

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 4 errors + 2 warnings | 0 errors + 0 warnings (1 limitação aceita) |
| Score ~90 | Score ~98 |

## Recursos

| Recurso | Ação |
|---------|------|
| 1 Migration SQL | Todas as correções de policies |
| 0 alterações frontend | Apenas banco de dados |
| Ignorar realtime.messages | Limitação da plataforma |

