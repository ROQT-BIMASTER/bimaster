

# API Parcelas (Condições de Pagamento) — Padronização Omie

## Resumo

Criar tabela de lookup `parcelas_condicoes` e Edge Function `parcelas-api` com 2 rotas (IncluirParcela + ListarParcelas). Esta tabela é um **cadastro de condições de parcelamento** (ex: "À Vista", "30/60/90 dias") — não confundir com a tabela `parcelas` que armazena parcelas individuais de títulos.

## 1. Migration — Criar tabela `parcelas_condicoes`

```sql
CREATE TABLE IF NOT EXISTS public.parcelas_condicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(3) NOT NULL UNIQUE,
  descricao varchar(30) NOT NULL,
  numero_parcelas integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  importado_api boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.parcelas_condicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_parcelas_condicoes"
  ON public.parcelas_condicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_parcelas_condicoes"
  ON public.parcelas_condicoes FOR INSERT TO authenticated WITH CHECK (true);
```

## 2. Edge Function: `parcelas-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/incluir` | IncluirParcela | Cria condição de parcelamento |
| POST `/listar` | ListarParcelas | Lista paginada |
| GET `/status` | — | Health check |

## 3. Mapeamento

| Campo Omie | Coluna DB |
|---|---|
| `nCodigo` | `codigo` |
| `cDescricao` | `descricao` |
| `nParcelas` | `numero_parcelas` |

## 4. Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `parcelas_condicoes` |
| `supabase/functions/parcelas-api/index.ts` | Criar |
| `docs/API_PARCELAS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Presets |
| `src/components/erp/ApiDocumentation.tsx` | Seção |

