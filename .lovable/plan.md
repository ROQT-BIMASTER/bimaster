

# API Características de Clientes — Padronização Omie

## Resumo

Criar nova tabela `cliente_caracteristicas` e adicionar 5 rotas à Edge Function `clientes-api` existente para CRUD de características de clientes/fornecedores.

## 1. Nova Tabela: `cliente_caracteristicas`

```sql
CREATE TABLE public.cliente_caracteristicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  campo varchar(30) NOT NULL,
  conteudo varchar(60) NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cliente_id, campo)
);
ALTER TABLE public.cliente_caracteristicas ENABLE ROW LEVEL SECURITY;
```

RLS: service-role only (API key auth, sem acesso direto do browser).

## 2. Novas Rotas em `clientes-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/caract/incluir` | IncluirCaractCliente | Inclui característica |
| POST `/caract/alterar` | AlterarCaractCliente | Altera conteúdo |
| POST `/caract/consultar` | ConsultarCaractCliente | Lista todas do cliente |
| POST `/caract/excluir` | ExcluirCaractCliente | Exclui uma característica |
| POST `/caract/excluir-todas` | ExcluirTodasCaractCliente | Exclui todas |

Todas as rotas aceitam `codigo_cliente_omie` (UUID) ou `codigo_cliente_integracao` (codigo) para localizar o cliente.

### Lógica

- **Incluir/Alterar**: upsert na `cliente_caracteristicas` por `(cliente_id, campo)`
- **Consultar**: retorna array `caracteristicas: [{ campo, conteudo }]`
- **Excluir**: deleta por `(cliente_id, campo)`
- **Excluir Todas**: deleta por `cliente_id`

Resposta padrão `clientes_status`: `codigo_cliente_omie`, `codigo_cliente_integracao`, `codigo_status`, `descricao_status`.

## 3. Documentação & UI

- Atualizar `docs/API_CLIENTES.md` com seção Características
- Presets no `ApiTester.tsx` (Incluir/Consultar/Excluir Característica)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `cliente_caracteristicas` |
| `supabase/functions/clientes-api/index.ts` | Editar — 5 rotas `/caract/*` |
| `docs/API_CLIENTES.md` | Editar — seção Características |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

