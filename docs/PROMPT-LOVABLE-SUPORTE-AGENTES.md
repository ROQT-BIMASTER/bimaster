# Prompt Lovable — Suporte: vincular agentes às filas

> Rode no **SQL editor** do Lovable/Supabase. Não é migration — é **dado de configuração** (quem atende cada departamento). Depende das Fases 0 e 1 aplicadas. Tudo idempotente (`ON CONFLICT`).
>
> `suporte_fila_agentes(fila_id, user_id, papel['agente'|'lider'], ativo)` — PK `(fila_id, user_id)`. As filas têm `slug`: `ti`, `transporte`, `fiscal`, `logistica`, `adm-cso`, `compras`, `rh`.

---

## Passo 1 — Descobrir as pessoas (rode e me mande, ou use para preencher o Passo 3)

```sql
SELECT id, nome, email, departamento, status
FROM public.profiles
WHERE status = 'ativo'
ORDER BY departamento NULLS LAST, nome;
```

---

## Passo 2 — (Opcional) Atalho para pilotar HOJE: te tornar líder de todas as filas

Substitua `<SEU_USER_ID>` pelo seu `id` (a linha do seu e-mail no Passo 1). Isso te dá acesso ao desk de todas as filas para testar o fluxo ponta a ponta sozinho.

```sql
INSERT INTO public.suporte_fila_agentes (fila_id, user_id, papel, ativo)
SELECT f.id, '<SEU_USER_ID>', 'lider', true
FROM public.suporte_filas f
WHERE f.ativo
ON CONFLICT (fila_id, user_id) DO UPDATE SET papel = 'lider', ativo = true;
```

---

## Passo 3 — Vínculo real (1 líder + N agentes por departamento)

Preencha com os `id` reais do Passo 1. Exemplo para Fiscal e RH — replique o padrão para os demais:

```sql
INSERT INTO public.suporte_fila_agentes (fila_id, user_id, papel, ativo)
VALUES
  -- Fiscal
  ((SELECT id FROM public.suporte_filas WHERE slug = 'fiscal'), '<USER_ID_LIDER_FISCAL>', 'lider',  true),
  ((SELECT id FROM public.suporte_filas WHERE slug = 'fiscal'), '<USER_ID_AGENTE_FISCAL_1>', 'agente', true),
  -- RH
  ((SELECT id FROM public.suporte_filas WHERE slug = 'rh'),     '<USER_ID_LIDER_RH>',     'lider',  true),
  ((SELECT id FROM public.suporte_filas WHERE slug = 'rh'),     '<USER_ID_AGENTE_RH_1>',  'agente', true)
ON CONFLICT (fila_id, user_id) DO UPDATE SET papel = EXCLUDED.papel, ativo = true;
```

Slugs disponíveis: `ti`, `transporte`, `fiscal`, `logistica`, `adm-cso`, `compras`, `rh`.

---

## Passo 4 — Conferir o resultado

```sql
SELECT f.nome AS fila, p.nome AS agente, fa.papel
FROM public.suporte_fila_agentes fa
JOIN public.suporte_filas f ON f.id = fa.fila_id
JOIN public.profiles p ON p.id = fa.user_id
WHERE fa.ativo
ORDER BY f.ordem, fa.papel DESC, p.nome;
```

> **Alternativa mais simples:** se preferir, me mande no chat quem é agente/líder de cada departamento (por nome), que eu gero o INSERT exato do Passo 3 já preenchido — você só cola.
