

# Correcao — Exclusao de Insumos Bloqueada por RLS

## Problema

A policy `fabrica_custos_delete_admin_only` na tabela `fabrica_produto_custos` exige `is_admin_or_supervisor(auth.uid())`. Usuarios com role "faturamento e compras" passam no SELECT/INSERT/UPDATE (que usam `can_access_fabrica`) mas sao bloqueados no DELETE. O mesmo ocorre em `fabrica_produto_custos_config`.

O frontend chama `supabase.from("fabrica_produto_custos").delete().eq("id", id)` — o Supabase retorna 0 rows affected (sem erro explicito), o `setInsumos` remove do state local, mas ao recarregar a pagina o insumo volta.

## Solucao

### 1. Migration — Relaxar DELETE para `can_access_fabrica`

Substituir as 2 policies de DELETE:

```sql
DROP POLICY IF EXISTS "fabrica_custos_delete_admin_only" ON public.fabrica_produto_custos;
CREATE POLICY "fabrica_custos_delete_restricted"
  ON public.fabrica_produto_custos FOR DELETE
  TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

DROP POLICY IF EXISTS "fabrica_config_delete_admin_only" ON public.fabrica_produto_custos_config;
CREATE POLICY "fabrica_config_delete_restricted"
  ON public.fabrica_produto_custos_config FOR DELETE
  TO authenticated
  USING (public.can_access_fabrica(auth.uid()));
```

### 2. Frontend — Verificar resultado do DELETE

Em `src/hooks/useFichaCustoProduto.ts`, na funcao `removerInsumo`, adicionar verificacao do `count` retornado para detectar deletes silenciosamente bloqueados por RLS:

```typescript
const { error, count } = await supabase
  .from("fabrica_produto_custos")
  .delete()
  .eq("id", id)
  .select("id", { count: "exact", head: true });

if (error) { toast.error(...); return; }
if (count === 0) { toast.error("Sem permissao para excluir"); return; }
```

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Relaxar DELETE de `is_admin_or_supervisor` para `can_access_fabrica` |
| `src/hooks/useFichaCustoProduto.ts` | Verificar count no delete para feedback correto |

## Impacto

- Usuarios com acesso ao modulo fabrica passam a poder excluir insumos (mesmo nivel de permissao que inserir/editar)
- Nenhuma mudanca para admin/supervisor — continuam podendo excluir normalmente

