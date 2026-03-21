

# API Bancos (ConsultarBanco + ListarBancos) — Padronização Omie

## Resumo

Criar nova Edge Function `bancos-api` com 2 rotas seguindo o padrão Omie: `ConsultarBanco` e `ListarBancos`. Consulta a tabela `bancos` existente (id, codigo_compe, ispb, nome, nome_curto, ativo). Os campos Omie extras (CNAB, Crawler, OpenBanking) que não existem na tabela serão retornados como `null` / `"N"` por padrão.

## 1. Nova Edge Function: `bancos-api`

Sem nova tabela — usa `bancos` existente.

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| GET | `/consultar` | ConsultarBanco | Consulta banco por código (`codigo`) |
| GET | `/listar` | ListarBancos | Lista paginada de bancos |
| GET | `/status` | — | Health check |

### GET /consultar

Query param: `codigo` (código COMPE, ex: "001").

Resposta (formato `fin_banco_cadastro`):
```json
{
  "codigo": "001",
  "nome": "Banco do Brasil S.A.",
  "tipo": "CB",
  "cod_compen": "001",
  "cod_ispb": "00000000",
  "cnab_cob": "N",
  "cnab_pag": "N",
  "obank_sn": "N"
}
```

### GET /listar

Query params: `pagina`, `registros_por_pagina`, `tipo`.

Resposta (`fin_bancos_list_response`):
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 50,
  "total_de_registros": 50,
  "fin_banco_cadastro": [...]
}
```

Mapeamento de campos:
- `codigo` → `codigo_compe`
- `nome` → `nome` (ou `nome_curto`)
- `cod_compen` → `codigo_compe`
- `cod_ispb` → `ispb`
- Campos CNAB/Crawler/OpenBanking → `"N"` (não temos na tabela)

## 2. Documentação

Novo `docs/API_BANCOS.md`.

## 3. API Tester & Portal

Presets no `ApiTester.tsx` e seção no `ApiDocumentation.tsx`.

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/bancos-api/index.ts` | Criar |
| `docs/API_BANCOS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

