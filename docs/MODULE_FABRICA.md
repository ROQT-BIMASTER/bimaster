# Módulo: Fábrica Brasil

> **Última atualização:** 2026-03-21 | **Versão:** 2.0.0

---

## 1. Visão Geral

O módulo Fábrica gerencia todo o ciclo produtivo: matérias-primas, fórmulas, ordens de produção, controle de qualidade, NF-e de entrada/saída, fiscal (IVA Dual) e produtos acabados.

- **Guard de Módulo**: `moduleCode="fabrica"`
- **Guard de Telas**: Cada sub-página tem `screenCode` específico
- **Rota Base**: `/dashboard/fabrica`
- **Prefixo de Tabelas**: `fabrica_*` (~90 tabelas)

---

## 2. Sub-Páginas e Rotas

| # | Rota | screenCode | Página | Descrição |
|---|------|-----------|--------|-----------|
| 1 | `/dashboard/fabrica` | — (module) | `FabricaModule` | Hub central |
| 2 | `/dashboard/fabrica/recebimentos` | `fabrica_recebimentos` | `FabricaRecebimentos` | NFs de entrada |
| 3 | `/dashboard/fabrica/materias-primas` | `fabrica_mps` | `FabricaMateriasPrimas` | Cadastro de insumos |
| 4 | `/dashboard/fabrica/formulas` | `fabrica_formulas` | `FabricaFormulas` | Lista de fórmulas |
| 5 | `/dashboard/fabrica/formulas/nova` | `fabrica_formulas` | `FabricaFormulaEditor` | Editor de fórmula |
| 6 | `/dashboard/fabrica/formulas/:id` | `fabrica_formulas` | `FabricaFormulaEditor` | Edição de fórmula |
| 7 | `/dashboard/fabrica/planejamento` | `fabrica_planejamento` | `FabricaPlanejamento` | Planejamento produção |
| 8 | `/dashboard/fabrica/ordens-producao` | `fabrica_ordens` | `FabricaOrdensProducao` | Ordens de produção |
| 9 | `/dashboard/fabrica/apontamentos` | `fabrica_apontamentos` | `FabricaApontamentos` | Apontamentos de produção |
| 10 | `/dashboard/fabrica/qualidade` | `fabrica_qualidade` | `FabricaQualidade` | Controle de qualidade |
| 11 | `/dashboard/fabrica/paradas` | `fabrica_paradas` | `FabricaParadas` | Paradas de máquina |
| 12 | `/dashboard/fabrica/maquinas` | `fabrica_maquinas` | `FabricaMaquinas` | Cadastro de máquinas |
| 13 | `/dashboard/fabrica/operadores` | `fabrica_operadores` | `FabricaOperadores` | Cadastro de operadores |
| 14 | `/dashboard/fabrica/produtos-acabados` | `fabrica_produtos` | `FabricaProdutosAcabados` | Produtos acabados |
| 15 | `/dashboard/fabrica/fiscal` | `fabrica_fiscal` | `FabricaFiscal` | NFs saída + apuração |
| 16 | `/dashboard/fabrica/tabela-impostos` | `fabrica_fiscal` | `FabricaTabelaImpostos` | Tabela de impostos |
| 17 | `/dashboard/fabrica/revisao-fichas` | `fabrica_revisao_fichas` | `FichaRevisaoDiretoria` | Revisão pela diretoria |
| 18 | `/dashboard/fabrica/comunicacao-revisoes` | `fabrica_produtos` | `FabricaComunicacaoRevisoes` | Chat de revisões |
| 19 | `/dashboard/fabrica/executivo` | `fabrica_dashboard` | `FabricaExecutiveDashboard` | Dashboard executivo |
| 20 | `/dashboard/fabrica/manual` | — (module) | `FabricaManualPage` | Manual operacional |
| 21 | `/dashboard/fabrica/produtos/:id/custos` | `fabrica_produtos` | `FichaCustoProduto` | Ficha de custo |
| 22 | `/dashboard/fabrica/produtos/importar` | `fabrica_produtos` | `ImportarProdutosAcabados` | Importação em massa |

---

## 3. Tabelas Principais

### 3.1 Matérias-Primas

| Tabela | Colunas-Chave |
|--------|--------------|
| `fabrica_materias_primas` | id, codigo, nome, unidade_medida, custo_unitario, estoque_atual, estoque_minimo, fornecedor_id, ativo |
| `fabrica_mp_movimentacoes` | id, materia_prima_id, tipo (entrada/saida), quantidade, data_movimentacao |
| `fabrica_mp_lotes` | id, materia_prima_id, numero_lote, data_validade, quantidade, fornecedor |

### 3.2 Fórmulas

| Tabela | Colunas-Chave |
|--------|--------------|
| `fabrica_formulas` | id, codigo, nome, versao, status (rascunho/ativa/inativa), produto_acabado_id |
| `fabrica_formula_itens` | id, formula_id, materia_prima_id, quantidade, unidade, percentual, ordem |
| `fabrica_formula_etapas` | id, formula_id, numero_etapa, descricao, tempo_minutos, temperatura |
| `fabrica_formula_versoes` | id, formula_id, versao, alteracoes, criado_por, created_at |

### 3.3 Ordens de Produção

| Tabela | Colunas-Chave |
|--------|--------------|
| `fabrica_ordens_producao` | id, numero_op, formula_id, produto_id, quantidade_planejada, quantidade_produzida, status, data_inicio, data_fim, maquina_id, operador_id |
| `fabrica_op_apontamentos` | id, ordem_id, operador_id, maquina_id, data_inicio, data_fim, quantidade_produzida, observacoes |
| `fabrica_op_consumo` | id, ordem_id, materia_prima_id, quantidade_consumida, lote_id |

**Status da OP**: `planejada` → `em_producao` → `finalizada` → `cancelada`

### 3.4 Controle de Qualidade

| Tabela | Colunas-Chave |
|--------|--------------|
| `fabrica_qualidade_analises` | id, ordem_id, produto_id, tipo_analise, resultado, aprovado, data_analise, analista_id |
| `fabrica_qualidade_parametros` | id, produto_id, parametro, valor_minimo, valor_maximo, unidade |
| `fabrica_qualidade_nao_conformidades` | id, analise_id, descricao, acao_corretiva, status |

### 3.5 Máquinas e Paradas

| Tabela | Colunas-Chave |
|--------|--------------|
| `fabrica_maquinas` | id, codigo, nome, tipo, capacidade_hora, status (ativa/manutencao/inativa) |
| `fabrica_paradas` | id, maquina_id, tipo_parada, motivo, data_inicio, data_fim, duracao_minutos |
| `fabrica_operadores` | id, nome, matricula, turno, maquinas_habilitadas, ativo |

### 3.6 Fiscal / NF-e

| Tabela | Colunas-Chave |
|--------|--------------|
| `fabrica_nf_entrada` | id, numero_nf, serie, chave_acesso, fornecedor_id, data_emissao, valor_total, status |
| `fabrica_itens_nf` | id, nf_entrada_id, produto_id, quantidade, valor_unitario, icms, pis, cofins, cbs_valor, ibs_valor |
| `fabrica_nf_saida` | id, numero_nf, serie, cliente_id, data_emissao, valor_total, status |
| `fabrica_itens_nf_saida` | id, nf_saida_id, produto_id, quantidade, valor_unitario, icms, pis, cofins, cbs_valor, ibs_valor |
| `fabrica_tax_rates` | id, uf_origem, uf_destino, ncm, icms_aliquota, pis_aliquota, cofins_aliquota |
| `fabrica_tax_rates_iva` | id, ncm, cbs_aliquota, ibs_aliquota, vigencia_inicio |

### 3.7 Produtos Acabados

| Tabela | Colunas-Chave |
|--------|--------------|
| `fabrica_produtos_acabados` | id, codigo, nome, marca, grupo, unidade, peso_liquido, peso_bruto, ncm, ean, custo_producao, preco_venda |
| `fabrica_produto_custos` | id, produto_id, tipo_custo, valor, data_referencia |
| `fabrica_produto_ficha_tecnica` | id, produto_id, descricao, composicao, modo_uso, validade_meses |

---

## 4. Reforma Tributária — IVA Dual

### Feature Flag

```sql
-- Verificar se IVA Dual está habilitado
SELECT valor FROM configuracoes WHERE chave = 'iva_dual_habilitado';
```

### Fluxo de Cálculo

```
NF Entrada/Saída
  └─ Trigger: fn_calcular_iva_dual()
       ├─ Busca alíquotas em fabrica_tax_rates_iva (por NCM)
       ├─ Calcula CBS (Contribuição sobre Bens e Serviços)
       ├─ Calcula IBS (Imposto sobre Bens e Serviços)
       └─ Grava em fabrica_itens_nf.cbs_valor / ibs_valor
```

### Apuração Consolidada

Dashboard de apuração unifica:
- **ICMS** (regime atual)
- **PIS** (regime atual)
- **COFINS** (regime atual)
- **CBS** (IVA federal — novo)
- **IBS** (IVA estadual/municipal — novo)

Exportação para Excel via `exceljs`.

---

## 5. Edge Functions

| Function | Descrição | Auth |
|----------|-----------|------|
| `extrair-materia-prima-ia` | Extrai matérias-primas de documentos via IA | JWT |
| `extrair-insumos-imagem` | Extrai insumos de imagens de rótulos | JWT |
| `process-nfe-xml` | Processa XML de NF-e (entrada) | JWT |
| `fiscal-iva-api` | Consulta/simulação de alíquotas IVA | JWT |
| `extrair-produto-ia` | Extrai dados de produto via IA | JWT |

---

## 6. Fluxo de Revisão de Fichas

```
Produto Acabado criado/atualizado
  └─ Solicitação de revisão (fabrica_revisao_fichas)
       └─ Diretoria analisa (FichaRevisaoDiretoria)
            ├─ Aprovado → produto ativado
            └─ Rejeitado → retorna para ajustes
                 └─ Comunicação via chat (FabricaComunicacaoRevisoes)
```

---

## 7. Dashboard Executivo da Fábrica

**Rota**: `/dashboard/fabrica/executivo`

Métricas:
- OPs em andamento vs finalizadas
- Eficiência produtiva (% quantidade produzida / planejada)
- Paradas por tipo/máquina
- Qualidade: taxa de aprovação
- Consumo de matérias-primas vs planejado

---

## Referências

- [Mapa de Módulos](./MODULES_OVERVIEW.md)
- [China + Projetos](./MODULE_CHINA_PROJETOS.md)
- [Infraestrutura](./INFRASTRUCTURE.md)
