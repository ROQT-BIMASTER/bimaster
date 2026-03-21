

# API Finalidades de Transferência (ConsultarFinalTransf + ListarFinalTransf) — Padronização Omie

## Resumo

Criar nova Edge Function `finalidades-transferencia-api` com 2 rotas Omie. Usa tabela `finalidades_transferencia` existente (id, codigo, descricao, ativo). A tabela não possui coluna `banco` — o campo será retornado como string vazia por padrão (a finalidade se aplica a todos os bancos).

## 1. Nova Edge Function: `finalidades-transferencia-api`

Sem nova tabela.

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| GET | `/consultar?codigo=01&banco=` | ConsultarFinalTransf | Consulta finalidade por código |
| GET | `/listar?pagina=1&registros_por_pagina=50` | ListarFinalTransf | Lista paginada |
| GET | `/status` | — | Health check |

### GET /consultar

Query params: `codigo` (obrigatório), `banco` (opcional, ignorado — sem coluna banco na tabela).

Resposta (`cadastros`):
```json
{
  "banco": "",
  "codigo": "01",
  "descricao": "Crédito em Conta"
}
```

### GET /listar

Query params: `pagina`, `registros_por_pagina`, `filtrar_por_banco` (aceito mas ignorado).

Resposta (`final_transf_list_response`):
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 8,
  "total_de_registros": 8,
  "cadastros": [
    { "banco": "", "codigo": "01", "descricao": "Crédito em Conta" }
  ]
}
```

Mapeamento: `codigo` → `codigo`, `descricao` → `descricao`, `banco` → `""` (não disponível).

Autenticação: `validateApiKey`.

## 2. Documentação

Novo `docs/API_FINALIDADES_TRANSFERENCIA.md`.

## 3. API Tester & Portal

- Presets no `ApiTester.tsx` (Consultar Finalidade, Listar Finalidades)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/finalidades-transferencia-api/index.ts` | Criar |
| `docs/API_FINALIDADES_TRANSFERENCIA.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

