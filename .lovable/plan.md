

# API Tipos de Anexo (ListarTiposAnexos) — Padronização Omie

## Resumo

Criar tabela lookup `tipos_anexo` e Edge Function `tipos-anexo-api` com rota POST `/listar`. Segue o mesmo padrão de `tipos-atividade-api`.

## 1. Migration

```sql
CREATE TABLE IF NOT EXISTS public.tipos_anexo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(10) NOT NULL UNIQUE,
  descricao varchar(100) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tipos_anexo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_tipos_anexo"
  ON public.tipos_anexo FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_tipos_anexo"
  ON public.tipos_anexo FOR INSERT TO authenticated WITH CHECK (true);
```

## 2. Edge Function: `tipos-anexo-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/listar` | ListarTiposAnexos | Lista tipos com filtro por código |
| GET `/status` | — | Health check |

### Mapeamento

| Campo Omie | Coluna DB |
|---|---|
| `codigo` | `codigo` |
| `descricao` | `descricao` |

Filtro: campo `codigo` (ILIKE). Body `{ "codigo": "" }`.

Response: `{ "listaTipoAnexo": [{ "codigo": "...", "descricao": "..." }] }`

## 3. Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `tipos_anexo` |
| `supabase/functions/tipos-anexo-api/index.ts` | Criar (clone de tipos-atividade-api) |
| `docs/API_TIPOS_ANEXO.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Adicionar seção |

