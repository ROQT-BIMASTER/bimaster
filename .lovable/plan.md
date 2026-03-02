

## Plano: Reforma Tributária IVA Dual (CBS/IBS)

### Diagnóstico do Schema Atual

O projeto **não possui** tabelas `vendas` nem `compras` como no SQL sugerido. A estrutura fiscal existente é:

- `fabrica_itens_nf` — itens de notas fiscais (entradas)
- `fabrica_dados_fiscais_produto` — dados fiscais por produto (já tem ICMS, PIS, COFINS, bases, alíquotas)
- `fabrica_apuracao_fiscal` — apuração mensal (periodo, tipo_imposto, creditos, debitos, saldo)
- `fabrica_creditos_tributarios` — créditos tributários por produto/nota
- `fabrica_empresa_config` — configuração da empresa (regime tributário)
- `fabrica_notas_fiscais` — notas fiscais de entrada

A implementação será adaptada a essa estrutura real.

---

### 1. Migration — Novos campos e tabela de alíquotas

**Tabela nova: `fabrica_tax_rates_iva`**
- `id`, `nome_regra`, `aliquota_cbs`, `aliquota_ibs`, `data_inicio`, `data_fim`, `ativo`, `created_at`, `created_by`

**Feature flag em `fabrica_empresa_config`:**
- `iva_dual_habilitado` (boolean, default false)

**Campos novos em `fabrica_itens_nf`** (documentos fiscais de entrada):
- `base_cbs`, `base_ibs`, `aliquota_cbs`, `aliquota_ibs`, `valor_cbs`, `valor_ibs`, `elegivel_credito_iva`

**Campos novos em `fabrica_dados_fiscais_produto`** (dados fiscais por produto):
- `aliquota_cbs_padrao`, `aliquota_ibs_padrao`, `elegivel_credito_iva`

**Campos novos em `fabrica_apuracao_fiscal`** (suporte a tipo_imposto = 'CBS' e 'IBS'):
- Nenhum campo novo necessário — a tabela já suporta múltiplos tipos de imposto via `tipo_imposto`

**Campos novos em `fabrica_creditos_tributarios`** (suporte a tipo_credito = 'CBS' e 'IBS'):
- Nenhum campo novo necessário — já suporta via `tipo_credito`

Todos os campos opcionais (nullable) para compatibilidade retroativa.

---

### 2. Serviço Fiscal IVA — `src/lib/fabrica/fiscal-iva-service.ts`

Novo módulo isolado com:

- `calcularDebitoIVA(baseCalculo, aliquotaCBS, aliquotaIBS)` → `{ valor_cbs, valor_ibs }`
- `calcularCreditoIVA(baseCalculo, aliquotaCBS, aliquotaIBS, elegivel)` → crédito ou zero
- `calcularApuracaoIVA(debitos[], creditos[])` → saldos CBS/IBS a recolher
- `arredondamentoFiscal(valor)` → 2 casas decimais
- Validações: bases não negativas, bloqueio de crédito quando `elegivel = false`

---

### 3. Feature Flag — Hook `useIVADualEnabled`

- Hook que lê `fabrica_empresa_config.iva_dual_habilitado`
- Quando `false`, toda a UI e cálculos IVA ficam ocultos
- Quando `true`, habilita aba IVA no fiscal e cálculos CBS/IBS

---

### 4. UI — Integração na Gestão Fiscal existente

**ConfiguracaoEmpresaDialog** — adicionar toggle "Habilitar IVA Dual (CBS/IBS)"

**FabricaFiscal** — adicionar aba "IVA Dual" (condicional à flag):
- Sub-tab "Alíquotas" — CRUD da tabela `fabrica_tax_rates_iva`
- Sub-tab "Apuração" — resumo mensal com débitos/créditos CBS e IBS, saldo a recolher
- Sub-tab "Simulação" — cálculo sob demanda com base, alíquotas e resultado

**DadosFiscaisProdutoDialog** — adicionar seção "IVA Dual" com campos `aliquota_cbs_padrao`, `aliquota_ibs_padrao`, `elegivel_credito_iva`

---

### 5. Edge Function — `fiscal-iva-api`

Endpoints via path routing:
- `GET /resumo?periodo=YYYY-MM` — apuração mensal consolidada
- `GET /debitos?periodo=YYYY-MM` — lista de débitos CBS/IBS
- `GET /creditos?periodo=YYYY-MM` — lista de créditos CBS/IBS
- `POST /simular` — simulação de cálculo

JWT obrigatório, sem alterar endpoints existentes.

---

### 6. Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Criar | `src/lib/fabrica/fiscal-iva-service.ts` |
| Criar | `src/hooks/fabrica/useIVADualEnabled.ts` |
| Criar | `src/components/fabrica/IVADualTab.tsx` |
| Criar | `src/components/fabrica/IVAAliquotasManager.tsx` |
| Criar | `src/components/fabrica/IVAApuracaoResumo.tsx` |
| Criar | `src/components/fabrica/IVASimulador.tsx` |
| Criar | `supabase/functions/fiscal-iva-api/index.ts` |
| Editar | `src/pages/FabricaFiscal.tsx` — adicionar aba IVA |
| Editar | `src/components/fabrica/ConfiguracaoEmpresaDialog.tsx` — toggle IVA |
| Editar | `src/components/fabrica/DadosFiscaisProdutoDialog.tsx` — campos IVA |
| Migration | Adicionar tabela e campos conforme item 1 |

### Princípios mantidos
- Zero alteração em regras ICMS/PIS/COFINS existentes
- Todos os campos opcionais — dados históricos intactos
- Feature flag controla 100% da ativação
- Código modular, tipado, isolado

