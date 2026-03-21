

# API Tipos de Entrega — CRUD Completo (Padrão Omie)

## Resumo

Criar tabela `tipos_entrega` e Edge Function `tipos-entrega-api` com 5 rotas CRUD: Incluir, Alterar, Consultar, Excluir, Listar. Segue padrão Omie com paginação e vínculo a transportadora.

## 1. Migration

```sql
CREATE TABLE IF NOT EXISTS public.tipos_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  n_cod_entrega bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  n_cod_transp bigint,
  c_cod_int_entrega varchar(40) UNIQUE,
  c_descricao varchar(80) NOT NULL,
  c_inativo varchar(1) NOT NULL DEFAULT 'N',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tipos_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_tipos_entrega"
  ON public.tipos_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_tipos_entrega"
  ON public.tipos_entrega FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_tipos_entrega"
  ON public.tipos_entrega FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete_tipos_entrega"
  ON public.tipos_entrega FOR DELETE TO authenticated USING (true);
```

## 2. Edge Function: `tipos-entrega-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/incluir` | IncluirTipoEntrega | Criar tipo de entrega |
| POST `/alterar` | AlterarTipoEntrega | Alterar tipo de entrega |
| POST `/consultar` | ConsultarTipoEntrega | Consultar por código |
| POST `/excluir` | ExcluirTipoEntrega | Excluir tipo de entrega |
| POST `/listar` | ListarTipoEntrega | Listar com paginação |
| GET `/status` | — | Health check |

## 3. Mapeamento

| Campo Omie | Coluna DB |
|---|---|
| `nCodEntrega` | `n_cod_entrega` |
| `nCodTransp` | `n_cod_transp` |
| `cCodIntEntrega` | `c_cod_int_entrega` |
| `cDescricao` | `c_descricao` |
| `cInativo` | `c_inativo` |

### Listar — Paginação

Request: `nPagina`, `nRegistrosPorPagina` (default 50), `nCodTransp`, `dDtAltDe`, `dDtAltAte`
Response: `nPagina`, `nTotalPaginas`, `nRegistros`, `nTotalRegistros`, `CadTiposEntrega[]`

### Incluir/Alterar — Response

Retorna `nCodEntrega`, `cCodIntEntrega`, `cCodStatus`, `cDesStatus`.

## 4. Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `tipos_entrega` |
| `supabase/functions/tipos-entrega-api/index.ts` | Criar |
| `docs/API_TIPOS_ENTREGA.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Adicionar presets (6 rotas) |
| `src/components/erp/ApiDocumentation.tsx` | Adicionar seção |

