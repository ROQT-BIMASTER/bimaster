

# API CNAE (Lookup) — Padronização Omie

## Resumo

Criar tabela de lookup `cnaes` e Edge Function `cnae-api` com 1 rota (ListarCNAE). API read-only — lista códigos CNAE (Classificação Nacional de Atividades Econômicas).

## 1. Migration

```sql
CREATE TABLE IF NOT EXISTS public.cnaes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(7) NOT NULL UNIQUE,
  descricao varchar(200) NOT NULL,
  estrutura varchar(10),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cnaes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_cnaes"
  ON public.cnaes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_cnaes"
  ON public.cnaes FOR INSERT TO authenticated WITH CHECK (true);
```

## 2. Edge Function: `cnae-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/listar` | ListarCNAE | Lista paginada com ordenação |
| GET `/status` | — | Health check |

## 3. Mapeamento

| Campo Omie | Coluna DB |
|---|---|
| `nCodigo` | `codigo` |
| `cDescricao` | `descricao` |
| `cEstrutura` | `estrutura` |

Paginação: `pagina` + `registros_por_pagina`. Ordenação: `ordenar_por` (codigo/descricao) + `ordem_decrescente`.

## 4. Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `cnaes` |
| `supabase/functions/cnae-api/index.ts` | Criar |
| `docs/API_CNAE.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Presets |
| `src/components/erp/ApiDocumentation.tsx` | Seção |

