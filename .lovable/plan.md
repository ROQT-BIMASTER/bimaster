

# API Boletos (Cobrança Bancária) — Padronização Omie

## Resumo

Criar a API de Boletos seguindo o padrão Omie, com operações de geração, obtenção, cancelamento e prorrogação de boletos vinculados a títulos do Contas a Receber. Inclui nova tabela para gerenciar boletos, Edge Function dedicada e documentação.

## 1. Nova tabela `boletos`

Tabela dedicada para gerenciar o ciclo de vida dos boletos, vinculada a `contas_receber`:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | ID interno |
| `empresa_id` | TEXT NOT NULL | Empresa (referência) |
| `conta_receber_id` | UUID FK | Vínculo com contas_receber |
| `n_cod_titulo` | BIGINT | Código do título no Omie |
| `c_cod_int_titulo` | VARCHAR(60) | Código de integração do título |
| `link_boleto` | VARCHAR(500) | Link para download do boleto |
| `data_emissao` | DATE | Data de emissão |
| `numero_boleto` | VARCHAR(30) | Número do boleto |
| `codigo_barras` | VARCHAR(70) | Código de barras |
| `numero_bancario` | VARCHAR(30) | Número bancário |
| `per_juros` | NUMERIC(5,2) | % juros |
| `per_multa` | NUMERIC(5,2) | % multa |
| `desconto_cond1_data` | DATE | Data desconto condicional 1 |
| `desconto_cond1_valor` | NUMERIC(15,2) | Valor desconto condicional 1 |
| `desconto_cond2_data` | DATE | Data desconto condicional 2 |
| `desconto_cond2_valor` | NUMERIC(15,2) | Valor desconto condicional 2 |
| `desconto_cond3_data` | DATE | Data desconto condicional 3 |
| `desconto_cond3_valor` | NUMERIC(15,2) | Valor desconto condicional 3 |
| `status` | VARCHAR(20) | Status: gerado, cancelado, prorrogado |
| `data_vencimento` | DATE | Vencimento atual (atualizado na prorrogação) |
| `importado_api` | BOOLEAN | Importado pela API |
| `created_at` | TIMESTAMPTZ | Criação |
| `updated_at` | TIMESTAMPTZ | Última alteração |

RLS: service_role e usuários autenticados da mesma empresa.

## 2. Nova Edge Function: `boletos-api`

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| POST | `/gerar` | Gera boleto para um título CR | GerarBoleto |
| GET | `/obter` | Obtém link e dados do boleto | ObterBoleto |
| POST | `/cancelar` | Cancela boleto gerado | CancelarBoleto |
| POST | `/prorrogar` | Prorroga vencimento do boleto | ProrrogarBoleto |
| GET | `/listar` | Lista boletos (paginado) | — |
| GET | `/status` | Health check | — |

Padrão de resposta Omie:
```json
{
  "cLinkBoleto": "https://...",
  "cCodStatus": "0",
  "cDesStatus": "Boleto gerado com sucesso!",
  "dDtEmBol": "21/03/2026",
  "cNumBoleto": "00001",
  "cCodBarras": "23793...",
  "nPerJuros": 2.0,
  "nPerMulta": 2.0,
  "cNumBancario": "109876",
  "dDescontoCond1": "25/03/2026",
  "vDescontoCond1": 5.00
}
```

Autenticação: `validateApiKey` / `validateJWT` (mesmo padrão das demais).

## 3. Documentação

Novo `docs/API_BOLETOS.md` com todos os endpoints, tipos, exemplos e aviso sobre tarifação bancária.

## 4. API Tester & Portal

- Adicionar presets no `ApiTester.tsx` (Gerar, Obter, Cancelar, Prorrogar)
- Adicionar seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — tabela `boletos` + RLS |
| `supabase/functions/boletos-api/index.ts` | Criar — nova Edge Function |
| `docs/API_BOLETOS.md` | Criar — documentação |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

