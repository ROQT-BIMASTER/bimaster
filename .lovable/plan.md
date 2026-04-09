

# Auditoria de Padrão de Mercado — Gaps em Dados e APIs

## Metodologia

Analisei as tabelas do banco e as APIs comparando com o padrão de mercado ERP (Omie, TOTVS Protheus, SAP Business One, Bling, Tiny).

---

## 1. EMPRESAS — Gaps Críticos

**Tabela `empresas`:** 34 colunas. Faltam campos essenciais para operação fiscal e ERP.

| Campo Ausente | Padrão de Mercado | Prioridade |
|---|---|---|
| `codigo_erp` | Código no ERP origem (ex: Omie nCodEmpresa) | ALTA |
| `regime_apuracao` | "Competência" ou "Caixa" — define como CP/CR gera DRE | ALTA |
| `tipo_empresa` | "Matriz", "Filial", "Coligada" | ALTA |
| `natureza_juridica` | "Ltda", "SA", "MEI", "EIRELI" | MEDIA |
| `porte` | "ME", "EPP", "Demais" | MEDIA |
| `capital_social` | Valor decimal | BAIXA |
| `data_abertura` | Data de constituição | MEDIA |
| `responsavel_nome` | Sócio/responsável legal | MEDIA |
| `responsavel_cpf` | CPF do responsável | MEDIA |
| `certificado_digital_validade` | Vencimento do e-CNPJ | MEDIA |
| `codigo_ibge_municipio` | Necessário para NF-e/NFS-e | ALTA |
| `aliquota_iss` | ISS padrão do município | MEDIA |
| `nire` | Registro na Junta Comercial | BAIXA |

**API `empresas-api`:** Apenas `consultar` e `listar`. Faltam:
- `POST /incluir` — cadastrar empresa via API
- `POST /alterar` — atualizar dados da empresa
- Validação Zod (não usa schemas)
- Audit log (não registra consultas)

---

## 2. CLIENTES — Gaps

**Tabela `clientes`:** 51 colunas. Já é robusta, mas faltam:

| Campo Ausente | Padrão de Mercado | Prioridade |
|---|---|---|
| `contribuinte` (enum) | "S"/"N"/"Isento" — obrigatório para NF-e | ALTA |
| `pessoa_fisica` (enum) | "S"/"N" — existe no Zod mas não na tabela | ALTA |
| `codigo_ibge_municipio` | Para NF-e | MEDIA |
| `endereco_numero` | Separado do endereço (API já mapeia vazio) | MEDIA |
| `complemento` | Idem | MEDIA |
| `data_nascimento` | Para PF | BAIXA |

**API `clientes-api`:** Completa (CRUD + tags + características + upsert-lote). Schemas Zod com `.passthrough()` em vez de `.strict()` — permite mass assignment.

---

## 3. FORNECEDORES — Gaps

**Tabela `fornecedores`:** 54 colunas. Bem completa, mas:

| Campo Ausente | Padrão de Mercado | Prioridade |
|---|---|---|
| `contribuinte` | "S"/"N"/"Isento" | ALTA |
| `codigo_ibge_municipio` | Para escrituração | MEDIA |
| `prazo_medio_pagamento` | Condição comercial padrão | MEDIA |
| `categoria_fornecedor` | Classificação (matéria-prima, serviço, etc.) | MEDIA |

---

## 4. CONTAS A PAGAR — Gaps

**Tabela `contas_pagar`:** 86 colunas (!). Extremamente completa. Gaps menores:

| Campo Ausente | Padrão de Mercado | Prioridade |
|---|---|---|
| `centro_custo_id` | Existe em CR mas não em CP | ALTA |
| `rateio_projetos` (jsonb) | Rateio por projeto (existe rateio por categoria/departamento) | MEDIA |

**API `contas-pagar-api`:** 2497 linhas, schemas `.strict()`, audit log, webhooks. Padrão de mercado atingido.

---

## 5. CONTAS A RECEBER — Gaps

**Tabela `contas_receber`:** ~85 colunas. Já contempla boleto, retenções, rateio.

**API `contas-receber-api`:** Schemas `.strict()`, WAF, webhooks. Mas falta `audit_log` nas operações de escrita (já identificado na auditoria anterior — verificar se foi aplicado).

---

## 6. CONTAS CORRENTES / BANCÁRIAS — Gaps

**Tabela `contas_bancarias`:** 62 colunas. Muito completa com dados de cobrança, boleto, CNAB.

| Campo Ausente | Padrão de Mercado | Prioridade |
|---|---|---|
| `codigo_erp` | Código no ERP origem | MEDIA |
| `convenio_cobranca` | Convênio bancário para boletos | MEDIA |
| `carteira` | Carteira de cobrança | MEDIA |
| `nosso_numero_seq` | Sequencial do nosso número | MEDIA |

---

## 7. CATEGORIAS / PLANO DE CONTAS — Gaps

**Tabela `plano_contas`:** 10 colunas. Muito simples para padrão de mercado.

| Campo Ausente | Padrão de Mercado | Prioridade |
|---|---|---|
| `tipo_categoria` | "Receita" / "Despesa" | ALTA |
| `conta_dre_id` | Vínculo com DRE | ALTA |
| `is_active` | Flag de inativação | MEDIA |
| `natureza` | Natureza contábil | MEDIA |
| `definida_pelo_usuario` | "S"/"N" | BAIXA |

---

## 8. DEPARTAMENTOS — Gaps

**Tabela `departamentos`:** 10 colunas. Faltam:

| Campo Ausente | Padrão de Mercado | Prioridade |
|---|---|---|
| `empresa_id` | Multi-empresa — departamento sem vínculo com empresa | ALTA |
| `codigo_integracao` | Para sync com ERP | ALTA |

---

## 9. APIs SEM Zod / SEM Audit Log

| API | Zod? | Audit? | `.strict()`? |
|---|---|---|---|
| `empresas-api` | Nenhum | Nenhum | N/A |
| `categorias-api` | `.passthrough()` | Nenhum | Não |
| `contas-correntes-api` | Nenhum (manual) | Sim | N/A |
| `bancos-api` | Verificar | Nenhum | Verificar |
| `departamentos-api` | Verificar | Nenhum | Verificar |
| `projetos-api` | Verificar | Nenhum | Verificar |

---

## Plano de Implementação

### Fase 1 — Migração SQL: Campos Faltantes (Prioridade ALTA)

Adicionar colunas às tabelas:

**`empresas`:** `codigo_erp`, `regime_apuracao`, `tipo_empresa`, `natureza_juridica`, `porte`, `capital_social`, `data_abertura`, `codigo_ibge_municipio`, `responsavel_nome`, `responsavel_cpf`

**`clientes`:** `contribuinte`, `pessoa_fisica`, `codigo_ibge_municipio`, `endereco_numero`, `complemento`

**`departamentos`:** `empresa_id` (integer), `codigo_integracao` (varchar)

**`plano_contas`:** `tipo_categoria`, `conta_dre_id`, `is_active` (default true), `natureza`

**`contas_pagar`:** `centro_custo_id` (uuid, FK plano_contas)

### Fase 2 — Empresas API: CRUD Completo + Zod

Expandir `empresas-api/index.ts`:
- Adicionar rotas `POST /incluir` e `POST /alterar`
- Schemas Zod `.strict()` para todos os inputs
- Audit log em todas as operações
- Mapear novos campos no `mapCadastro()`

### Fase 3 — Hardening de Schemas

- `categorias-api`: Trocar `.passthrough()` por `.strict()`
- `clientes-api`: Trocar `.passthrough()` por `.strict()` nos schemas `IncluirClienteSchema` e `AlterarClienteSchema`
- Adicionar audit log nas APIs auxiliares que não possuem

### Fase 4 — Documentação

Atualizar `docs/API_EMPRESAS.md` com os novos endpoints e campos.

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | ~20 colunas novas em 5 tabelas |
| `supabase/functions/empresas-api/index.ts` | CRUD completo + Zod + audit log |
| `supabase/functions/categorias-api/index.ts` | `.passthrough()` → `.strict()` |
| `supabase/functions/clientes-api/index.ts` | `.passthrough()` → `.strict()` |
| `docs/API_EMPRESAS.md` | Atualizar com novos endpoints/campos |

## Nota de Aderência ao Padrão de Mercado

| Módulo | Antes | Depois |
|---|---|---|
| Empresas | 6/10 | 9.5/10 |
| Clientes | 8.5/10 | 9.5/10 |
| Fornecedores | 8/10 | 9/10 |
| Contas a Pagar | 9.5/10 | 10/10 |
| Contas a Receber | 9/10 | 9.5/10 |
| Contas Correntes | 8.5/10 | 9/10 |
| Categorias/Plano de Contas | 7/10 | 9/10 |
| Departamentos | 6/10 | 9/10 |
| **Média Global** | **7.8/10** | **9.3/10** |

