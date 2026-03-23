

# Auditoria Frontend vs Backend — Módulo Financeiro

## Metodologia

Comparei os campos das tabelas no banco (`types.ts`), os campos expostos nas APIs (edge functions + docs), e os campos renderizados/editáveis nas telas do frontend.

---

## 1. Bandeiras de Cartão (`bandeiras_cartao`)

| Campo DB | API (bandeiras-api) | Frontend | Gap |
|---|---|---|---|
| `codigo` | `cCodigo` ✅ | Apenas via portal docs | — |
| `descricao` | `cDescricao` ✅ | Apenas via portal docs | — |
| `tipo` (credito/debito/ambos) | **NÃO EXPOSTO** | **NÃO EXIBIDO** | **GAP** |
| `ativo` | Filtrado (`.eq("ativo", true)`) | Não editável | — |

**Gap encontrado**: O campo `tipo` existe na tabela mas a API `mapBandeira()` não o retorna (`cTipo` ausente) e nenhuma tela frontend o exibe. O ERP não sabe se a bandeira é crédito, débito ou ambos.

---

## 2. Contas a Pagar (`contas_pagar`) — 90+ colunas no DB

### Campos **no DB mas ausentes no formulário de criação** (ContasPagarGestao):

O form de criação tem apenas 13 campos. Campos relevantes ausentes:

| Campo DB | Na tela de Detalhe? | No form de criação/edição? |
|---|---|---|
| `chave_nfe` | Não | Não |
| `numero_documento_fiscal` | Não | Não |
| `codigo_projeto` | Não | Não |
| `departamento_id` / `departamento_nome` | Sim (detalhe) | **Não** |
| `plano_contas_codigo` / `plano_contas_nome` | Sim (detalhe) | **Não** |
| `data_previsao` | Não | Não |
| `data_entrada` | Não | Não |
| `operacao` | Não | Não |
| `numero_pedido` | Não | Não |
| `id_conta_corrente` | Não | Não |
| Campos tributários (6x `retem_*`, 6x `valor_*`) | Não | Não |
| `rateio_categorias` / `rateio_departamentos` | Não | Não |
| `cnab_dados` | Não | Não |
| `codigo_barras_ficha_compensacao` | Não | Não |
| `bloqueado` / `bloquear_exclusao` | Não | Não |
| `servico_tomado` | Não | Não |

### Campos exibidos na tela de Detalhe (`ContaPagarDetalhe`):
- Fornecedor, empresa, tipo/nº documento, emissão, vencimento ✅
- Valores (original, desconto, juros, ajustes, pago, aberto) ✅
- Categoria, departamento, portador, plano de contas ✅
- Origem baixa, status ERP ✅
- **Faltam**: tributários, NF-e, projeto, rateios, CNAB, boleto

---

## 3. Contas a Receber (`contas_receber`) — 110+ colunas no DB

### Interface (`ContasAReceber.tsx`) expõe apenas 17 campos:

| Categoria de campos ausentes | Exemplos |
|---|---|
| **Boleto** (6 campos) | `boleto_gerado`, `boleto_numero`, `boleto_numero_bancario`, `boleto_per_juros`, `boleto_per_multa`, `boleto_data_emissao` |
| **Tributários** (12 campos) | `retem_pis/cofins/csll/ir/iss/inss` + `valor_*` |
| **Rateios** (2 campos) | `rateio_categorias`, `rateio_departamentos` |
| **Controle** | `bloqueado`, `bloquear_baixa`, `bloquear_exclusao`, `inativo` |
| **Comercial** | `n_cod_os`, `n_cod_pedido`, `c_numero_contrato`, `c_pedido_cliente`, `tabela_preco` |
| **Classificação** | `centro_custo_id`, `plano_conta_id`, `codigo_projeto`, `tags` |
| **Operacional** | `nsu`, `codigo_cmc7_cheque`, `observacoes`, `descricao` |
| **Auditoria** | `data_inc`, `hora_inc`, `user_inc`, `data_alt`, `hora_alt`, `user_alt` |

---

## 4. Financial Payment Queue (`financial_payment_queue`)

A fila de pagamentos é consumida em componentes de trade/departamento. Verificação rápida: os campos essenciais estão cobertos pelo `useFinancialSubmission.ts`.

---

## Resumo de Gaps Críticos

| Prioridade | Gap | Impacto |
|---|---|---|
| **Alta** | API Bandeiras não expõe `tipo` | ERP não diferencia crédito/débito |
| **Alta** | CP: Form criação sem departamento, plano de contas, NF-e | Títulos manuais incompletos |
| **Alta** | CP: Detalhe sem impostos retidos (12 campos) | Informação fiscal invisível |
| **Média** | CR: Sem dados de boleto (6 campos) | Gestão de cobrança limitada |
| **Média** | CR: Sem impostos retidos | Mesma lacuna que CP |
| **Média** | CP/CR: Sem rateios (categorias/departamentos) | Contabilidade gerencial cega |
| **Baixa** | CP: Sem CNAB, código de barras, bloqueio | Funcionalidades avançadas |
| **Baixa** | CR: Sem auditoria (user_inc/alt, data/hora) | Rastreabilidade limitada |

---

## Plano de Correção Proposto

### Fase 1 — Quick Wins (impacto imediato)
1. **Bandeiras API**: Adicionar `cTipo` ao `mapBandeira()` e documentação
2. **CP Form**: Adicionar campos departamento, plano de contas, NF-e ao drawer de criação/edição
3. **CP Detalhe**: Adicionar seção "Impostos Retidos" colapsável com os 12 campos tributários

### Fase 2 — Completude
4. **CR Detalhe**: Criar página de detalhe (hoje não existe, é só tabela) com boleto + impostos
5. **CP/CR**: Adicionar visualização de rateios (categorias e departamentos) como tabela expandível
6. **CP Form**: Adicionar campos projeto, data previsão, conta corrente

### Fase 3 — Avançado
7. **CP/CR**: Campos de controle (bloqueio, exclusão)
8. **CR**: Dados comerciais (contrato, pedido, OS)
9. **CP**: CNAB e código de barras

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/bandeiras-api/index.ts` | Adicionar `cTipo` ao mapper |
| `src/components/erp/ApiDocumentation.tsx` | Atualizar response example bandeiras |
| `src/pages/ContasPagarGestao.tsx` | Expandir form de criação/edição |
| `src/pages/ContaPagarDetalhe.tsx` | Seção impostos + rateios |
| `src/pages/ContasAReceber.tsx` | Seção boleto + impostos na interface |

