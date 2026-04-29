# Visão Inteligente de Estoque — Distribuidoras

## Contexto

A tabela `erp_estoque_distribuidora` foi sincronizada e contém **9.878 registros** (3.745 SKUs × 6 empresas/filiais). O ERP atual não oferece visualização de estoque, então esta tela será a **primeira interface de consulta de estoque** da operação.

**Dados disponíveis (100% populados):** saldo, custo unitário, custo total, curva física (ABC), curva monetária (ABC), nome do produto, linha/marca, código fabricante, unidade de medida, empresa, pedido pendente, data da última compra.

**Dados ausentes hoje (NULL):** validade, lote, valor de venda — a view do ERP não fornece. Os campos seguirão visíveis na UI como "—" e prontos para enriquecimento futuro.

## Escopo desta entrega (Fase 1 — Tabela + Filtros)

Construir uma página `/estoque/visao-geral` com **tabela rica + painel de filtros + KPIs do recorte** atual. Sem dashboards/gráficos nesta fase (próximo lote).

### 1. KPIs do recorte (cards no topo)

Calculados sobre a query filtrada (não o total bruto):

- **Valor total em estoque** (Σ custo_total)
- **Unidades em estoque** (Σ saldo)
- **SKUs ativos** (saldo > 0) / **SKUs sem saldo** / **% cobertura**
- **Pedidos pendentes** (Σ pedido_pendente, com SKUs envolvidos)
- **Última sincronização** (max sincronizado_em + botão "Ressincronizar")

### 2. Filtros (painel lateral colapsável + barra de busca no topo)

**Identificação**
- Busca livre: nome do produto, código ERP, código fabricante (debounced)
- Empresa/Filial — multi-select (RUBY ROSE PR, GLASS, PE, NEW COSMIC, MIDDAY, A GENTE) usando padrão `EmpresaSelector`
- Linha/Marca (`nome_linha`) — multi-select dinâmico
- Unidade de medida — multi-select

**Classificação ABC**
- Curva Física: A, B, C, D, E (multi)
- Curva Monetária: A, B, C, D, E (multi)
- Atalhos: "Estrelas (AA)", "Caudas longas (EE)", "Distorcidas (curvas divergentes ≥2 níveis)"

**Saldo / situação de estoque**
- Faixas: **Sem estoque** (=0) · **Estoque baixo** · **Estoque médio** · **Estoque alto** · **Negativo**
  - Critério dinâmico baseado em quartis por linha+empresa (calculado em RPC), com possibilidade de o usuário sobrescrever os limites manualmente
- Toggle "Apenas com saldo > 0"
- Toggle "Com pedido pendente"
- Faixa numérica de saldo (de–até)
- Faixa de valor em estoque (custo_total de–até)

**Vencimento e movimentação**
- Próximos do vencimento: 30 / 60 / 90 dias (oculta automaticamente se 0% dos itens tiver validade — caso atual; mantém-se preparado)
- Última compra: últimos 30/60/90/180 dias / sem compra há mais de 6 meses / nunca comprado
- "Estoque parado" (com saldo > 0 e sem compra há > X dias)

**Botões rápidos (chips no topo)**
- Crítico (saldo baixo + curva A) · Excesso (saldo alto + curva D/E) · Sem giro · Pendentes · Recém comprados

### 3. Tabela (virtualizada — `VirtualizedTable`)

**Colunas padrão (visíveis):**
1. Empresa (badge curta)
2. Cód. ERP
3. Produto (nome + cód. fabricante em segunda linha)
4. Linha/Marca
5. UM
6. Saldo (com badge de faixa: vermelho/amarelo/verde)
7. Pedido pendente
8. Custo unit.
9. Custo total
10. Curva F / Curva M (badges)
11. Última compra (relativa: "há 12 dias")

**Colunas opcionais (toggle "Configurar colunas"):**
- Validade · Lote · Localização · Estoque endereço · Bloqueado (produto/endereço) · Valor de venda · Sincronizado em

**Recursos da tabela:**
- Ordenação por qualquer coluna (server-side)
- Densidade compacta/normal
- Linha clicável → drawer lateral com detalhes do SKU (raw JSON, histórico de sincronizações, breakdown por empresa para o mesmo cód_produto)
- Seleção múltipla → ações em lote: exportar CSV/XLSX, copiar códigos
- Indicador visual quando o SKU existe em múltiplas empresas

### 4. Exportação

- CSV / XLSX do recorte atual (todas as colunas, respeitando filtros e ordenação)
- Limite até 50k linhas; acima disso, processamento em background com download posterior

### 5. Arquivos a criar/editar

```text
src/pages/estoque/EstoqueVisaoGeral.tsx                    (nova rota)
src/components/estoque/visao-geral/
  ├── EstoqueKpiBar.tsx                                    (KPIs do recorte)
  ├── EstoqueFilterPanel.tsx                               (painel de filtros)
  ├── EstoqueQuickChips.tsx                                (atalhos rápidos)
  ├── EstoqueTable.tsx                                     (tabela virtualizada)
  ├── EstoqueColumnConfig.tsx                              (config de colunas)
  ├── EstoqueDetailDrawer.tsx                              (drawer de detalhe)
  └── EstoqueExportButton.tsx                              (CSV/XLSX)
src/hooks/estoque/
  ├── useEstoqueQuery.ts                                   (query principal paginada/server-side)
  ├── useEstoqueFiltrosOptions.ts                          (opções dinâmicas: linhas, UMs)
  ├── useEstoqueKpis.ts                                    (KPIs do recorte via RPC)
  └── useEstoqueFaixasSaldo.ts                             (cálculo dinâmico de faixas)
src/lib/estoque/
  ├── estoqueFilters.ts                                    (tipos + builders de query)
  └── estoqueExport.ts                                     (xlsx via lib existente)
```

Adicionar rota no `App.tsx` e item no menu "Estoque" do sidebar (ao lado da página de Sync já existente).

### 6. Backend (RPCs + RLS)

Para evitar custo no front, criar **2 RPCs `SECURITY DEFINER`** no padrão da casa:

- `estoque_kpis_recorte(filtros jsonb)` → retorna KPIs agregados respeitando filtros + RLS por empresa do usuário
- `estoque_faixas_saldo(empresa_ids int[], linhas text[])` → devolve quartis (q1, mediana, q3) para classificar baixo/médio/alto

RLS: garantir que a query da tabela só retorne registros das empresas vinculadas ao usuário (`user_empresas`), com bypass para admin via `has_role`. Usar **semi-join `IN (SELECT …)`**, sem function calls dentro da policy (padrão de high-volume RLS do projeto).

### 7. Performance

- Paginação server-side (50/100/200 por página) com `usePaginatedQuery`
- Índices a adicionar: `(empresa_par, saldo)`, `(curva_fisica, curva_monetaria)`, `(nome_linha)`, GIN trigram em `nome_prod` e `cod_fabricante` para busca livre
- KPIs só recalculam quando filtros mudam (debounce 300ms)

## Roadmap futuro (fora desta entrega)

**Fase 2 — Dashboards:** heatmap empresa × curva, treemap de valor por linha, top 50 SKUs em valor, gráfico de cauda longa, evolução de pedido pendente, ranking de giro (quando tivermos vendas).

**Fase 3 — Inteligência:** sugestão de transferência entre filiais (mesmo SKU com excesso em A e falta em B), alerta de ruptura iminente, projeção de cobertura em dias (saldo ÷ venda média), detecção de SKU obsoleto.

**Fase 4 — Enriquecimento de dados ausentes:** integrar valor de venda (lista de preços ERP), validade e lote (view ERP a definir).

## Pontos a confirmar

1. **Faixas de estoque** — usar quartis dinâmicos por linha+empresa (recomendado, adapta-se a qualquer categoria) ou faixas fixas (ex.: <10 baixo, 10–100 médio, >100 alto)?
2. **Visão consolidada multi-empresa** — quando o mesmo SKU aparece em N empresas, queremos uma linha por empresa (atual) ou opção de "agrupar SKU" somando saldos das filiais visíveis?
3. **Permissão** — qualquer usuário com módulo Estoque vê a tela, ou restrita a perfis específicos (admin, supervisor, fábrica)?
