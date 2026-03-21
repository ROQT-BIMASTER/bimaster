

# API Tags de Clientes — Padronização Omie

## Resumo

Criar nova tabela `cliente_tags` e adicionar 4 rotas à Edge Function `clientes-api` existente para gerenciar tags de clientes/fornecedores.

## 1. Nova Tabela: `cliente_tags`

```sql
CREATE TABLE public.cliente_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cliente_id, tag)
);
ALTER TABLE public.cliente_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON public.cliente_tags
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

## 2. Novas Rotas em `clientes-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/tags/incluir` | IncluirTags | Associa tags ao cliente |
| POST `/tags/listar` | ListarTags | Lista tags do cliente |
| POST `/tags/excluir` | ExcluirTags | Remove tags específicas |
| POST `/tags/excluir-todas` | ExcluirTodas | Remove todas as tags |

Todas aceitam `nCodCliente` (UUID) ou `cCodIntCliente` (codigo) para localizar o cliente.

### Lógica

- **Incluir**: Recebe array `tags: [{ tag }]`, faz insert com `ON CONFLICT DO NOTHING` para cada tag
- **Listar**: Retorna `tagsLista: [{ tag, nCodTag }]` onde `nCodTag` é um índice sequencial (sem coluna real de código numérico)
- **Excluir**: Recebe array `tags: [{ tag }]`, deleta por `(cliente_id, tag)`
- **Excluir Todas**: Deleta todas por `cliente_id`

Resposta padrão: `nCodCliente`, `cCodIntCliente`, `cCodStatus`, `cDesStatus`.

## 3. Documentação & UI

- Atualizar `docs/API_CLIENTES.md` com seção Tags
- Presets no `ApiTester.tsx` (Incluir Tags, Listar Tags, Excluir Tags)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `cliente_tags` |
| `supabase/functions/clientes-api/index.ts` | Editar — 4 rotas `/tags/*` |
| `docs/API_CLIENTES.md` | Editar — seção Tags |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

