

## Plano: Evolução do Módulo Fiscal IVA Dual — Sem interferência em produção

### Contexto atual

O módulo IVA Dual já está implementado com:
- Tabela `fabrica_tax_rates_iva` (alíquotas CBS/IBS)
- Campos CBS/IBS em `fabrica_itens_nf` e `fabrica_dados_fiscais_produto`
- Trigger de cálculo automático nos itens de NF
- Service `fiscal-iva-service.ts` com funções puras de cálculo
- UI: Alíquotas, Apuração e Simulador
- Feature flag `iva_dual_habilitado` controlando tudo
- Edge function `fiscal-iva-api`

**Lacunas identificadas:**
1. Sem registro de operações de **saída** (vendas) — débitos IVA são zeros
2. Créditos CBS/IBS **não são gerados automaticamente** na importação de XML
3. Falta **dashboard consolidado** (ICMS + PIS + COFINS + CBS + IBS)

---

### Fase 1 — Geração automática de créditos CBS/IBS na importação de XML

**Objetivo:** Quando um XML de NF-e é importado e vinculado a um insumo, gerar automaticamente registros em `fabrica_creditos_tributarios` com `tipo_credito = 'CBS'` e `'IBS'`.

**Migration:**
- Nenhuma — a tabela `fabrica_creditos_tributarios` já suporta `tipo_credito` livre e possui todos os campos necessários (`base_calculo`, `aliquota`, `valor_credito`, `nota_id`, `produto_id`, `periodo_apuracao`)

**Código:**
- Editar `VincularXmlInsumoDialog.tsx` — na função `onVincular`, após salvar o item de NF com dados CBS/IBS, inserir 2 registros em `fabrica_creditos_tributarios` (um CBS, um IBS) quando `elegivel_credito_iva = true` e a feature flag estiver ativa
- Usar alíquotas do produto (`fabrica_dados_fiscais_produto.aliquota_cbs_padrao/ibs_padrao`) ou da tabela de taxas ativas (`fabrica_tax_rates_iva`)

**Proteção:** Só executa se `iva_dual_habilitado = true`. Nenhum fluxo existente é alterado.

---

### Fase 2 — Registro de operações de saída (débitos IVA)

**Objetivo:** Criar estrutura para registrar vendas/saídas e gerar débitos CBS/IBS automaticamente.

**Migration — nova tabela `fabrica_notas_fiscais_saida`:**
- `id`, `numero_nf`, `serie`, `data_emissao`, `cliente_nome`, `cliente_cnpj`, `valor_total`, `status`, `created_by`, `created_at`
- RLS para authenticated users

**Migration — nova tabela `fabrica_itens_nf_saida`:**
- `id`, `nota_saida_id` (FK), `produto_id` (FK → fabrica_produtos), `descricao`, `quantidade`, `valor_unitario`, `valor_total`
- Campos IVA: `base_cbs`, `base_ibs`, `aliquota_cbs`, `aliquota_ibs`, `valor_cbs`, `valor_ibs`
- Trigger de cálculo automático (reutilizar lógica do trigger de entrada)

**Código — novos componentes:**
- `NFSaidaCadastro.tsx` — formulário de registro de NF de saída com itens
- `NFSaidaListagem.tsx` — listagem de NFs de saída emitidas

**Integração na UI:**
- Adicionar sub-tab "Notas de Saída" dentro da aba IVA Dual (condicional à flag)

**Apuração atualizada:**
- Editar `IVAApuracaoResumo.tsx` para buscar débitos de `fabrica_itens_nf_saida` (soma `valor_cbs`/`valor_ibs`) em vez de depender só de `fabrica_apuracao_fiscal`

---

### Fase 3 — Dashboard consolidado de apuração fiscal

**Objetivo:** Tela única mostrando apuração mensal de todos os impostos.

**Novo componente: `ApuracaoFiscalConsolidada.tsx`**
- Cards por imposto: ICMS, PIS, COFINS, CBS, IBS
- Cada card: débitos, créditos, saldo a recolher
- Filtros: período, produto, fornecedor/cliente
- Tabela detalhada com exportação (Excel)
- Dados vêm de `fabrica_apuracao_fiscal` (ICMS/PIS/COFINS) + itens NF entrada/saída (CBS/IBS)

**Integração:**
- Nova sub-tab "Consolidado" na aba IVA Dual ou na tab principal Fiscal

---

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Migration | Tabelas `fabrica_notas_fiscais_saida` + `fabrica_itens_nf_saida` + trigger |
| Editar | `src/components/fabrica/VincularXmlInsumoDialog.tsx` — auto-gerar créditos CBS/IBS |
| Criar | `src/components/fabrica/NFSaidaCadastro.tsx` |
| Criar | `src/components/fabrica/NFSaidaListagem.tsx` |
| Criar | `src/components/fabrica/ApuracaoFiscalConsolidada.tsx` |
| Editar | `src/components/fabrica/IVADualTab.tsx` — adicionar sub-tabs Saídas e Consolidado |
| Editar | `src/components/fabrica/IVAApuracaoResumo.tsx` — buscar débitos reais das saídas |
| Editar | `supabase/functions/fiscal-iva-api/index.ts` — endpoints para saídas |

### Garantias de não-interferência
- Feature flag controla 100% — produção atual inalterada
- Tabelas novas (não altera existentes)
- Créditos automáticos só rodam com flag ativa
- Nenhum endpoint, trigger ou regra existente é modificado
- Todos os campos opcionais para retrocompatibilidade

