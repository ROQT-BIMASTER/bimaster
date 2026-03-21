

# API Tipos de Atividade (Lookup) — Padronização Omie

## Resumo

Criar tabela de lookup `tipos_atividade_empresa` e Edge Function `tipos-atividade-api` com 1 rota (ListarTipoAtiv). API read-only de cadastro auxiliar — lista os tipos de atividade da empresa (código 1 char + descrição).

## 1. Migration

```sql
CREATE TABLE IF NOT EXISTS public.tipos_atividade_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(1) NOT NULL UNIQUE,
  descricao varchar(30) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tipos_atividade_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_tipos_atividade"
  ON public.tipos_atividade_empresa FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_tipos_atividade"
  ON public.tipos_atividade_empresa FOR INSERT TO authenticated WITH CHECK (true);
```

## 2. Edge Function: `tipos-atividade-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/listar` | ListarTipoAtiv | Lista com filtros opcionais |
| GET `/status` | — | Health check |

## 3. Mapeamento

| Campo Omie | Coluna DB |
|---|---|
| `cCodigo` | `codigo` |
| `cDescricao` | `descricao` |

Filtros: `filtrar_por_codigo` e `filtrar_por_descricao` (ILIKE).

## 4. Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela |
| `supabase/functions/tipos-atividade-api/index.ts` | Criar |
| `docs/API_TIPOS_ATIVIDADE.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Presets |
| `src/components/erp/ApiDocumentation.tsx` | Seção |

