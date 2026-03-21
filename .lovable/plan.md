

# API Países (ListarPaises) — Padronização Omie

## Resumo

Criar tabela de lookup `paises` e Edge Function `paises-api` com 1 rota (ListarPaises). API read-only — lista países com código IBGE, descrição e código ISO.

## 1. Migration

```sql
CREATE TABLE IF NOT EXISTS public.paises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(4) NOT NULL UNIQUE,
  descricao varchar(30) NOT NULL,
  codigo_iso varchar(2),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.paises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_paises"
  ON public.paises FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_paises"
  ON public.paises FOR INSERT TO authenticated WITH CHECK (true);
```

## 2. Edge Function: `paises-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/listar` | ListarPaises | Lista com filtros opcionais |
| GET `/status` | — | Health check |

## 3. Mapeamento

| Campo Omie | Coluna DB |
|---|---|
| `cCodigo` | `codigo` |
| `cDescricao` | `descricao` |
| `cCodigoISO` | `codigo_iso` |

Filtros: `filtrar_por_codigo`, `filtrar_por_descricao`, `filtrar_por_codigo_iso` (todos ILIKE).

## 4. Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `paises` |
| `supabase/functions/paises-api/index.ts` | Criar |
| `docs/API_PAISES.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Presets |
| `src/components/erp/ApiDocumentation.tsx` | Seção |

