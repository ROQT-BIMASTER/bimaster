

# API ListarCadastroDRE — Padronização Omie

## Resumo

Criar nova Edge Function `dre-cadastro-api` com 1 rota seguindo o padrão Omie `ListarCadastroDRE`. Consulta a tabela `trade_chart_of_accounts` existente, filtrando contas que possuem `categoria_dre` definida e mapeando para a estrutura `dreLista` do Omie. Sem nova tabela.

## 1. Nova Edge Function: `dre-cadastro-api`

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/listar` | ListarCadastroDRE | Lista contas do DRE |
| GET | `/status` | — | Health check |

### POST /listar

**Body (`dreCadastroListRequest`):**
```json
{ "apenasContasAtivas": "N" }
```

**Lógica:**
1. Consultar `trade_chart_of_accounts` onde `categoria_dre IS NOT NULL`
2. Se `apenasContasAtivas = "S"`, filtrar `is_active = true`
3. Ordenar por `codigo_dre_gerencial` ou `code`

**Mapeamento:**

| Campo Omie (`dreLista`) | Coluna DB | Observação |
|---|---|---|
| `codigoDRE` | `codigo_dre_gerencial` ou `code` | Código da conta |
| `descricaoDRE` | `name` | Descrição |
| `naoExibirDRE` | `!is_active` → `"S"/"N"` | Visibilidade |
| `nivelDRE` | Calculado do `code` (contagem de pontos + 1) | Ex: "3.2.1" → nível 3 |
| `sinalDRE` | `categoria_dre`: receita → `"+"`, despesas/custos → `"-"` | Sinal |
| `totalizaDRE` | `"N"` (default, sem campo equivalente) | Totalizadora |

**Resposta (`dreCadastroListResponse`):**
```json
{
  "totalRegistros": 25,
  "dreLista": [
    {
      "codigoDRE": "4.1",
      "descricaoDRE": "Receita Bruta",
      "naoExibirDRE": "N",
      "nivelDRE": 2,
      "sinalDRE": "+",
      "totalizaDRE": "N"
    }
  ]
}
```

Autenticação: `validateApiKey`.

## 2. Documentação

Novo `docs/API_DRE_CADASTRO.md`.

## 3. API Tester & Portal

- Preset no `ApiTester.tsx` (Listar DRE Ativas, Listar DRE Todas)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/dre-cadastro-api/index.ts` | Criar |
| `docs/API_DRE_CADASTRO.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

