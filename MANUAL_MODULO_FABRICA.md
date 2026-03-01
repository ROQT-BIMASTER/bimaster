# 📘 Manual de Uso — Módulo Fábrica

## Versão 1.0 | Atualizado em: 2026-03-01

---

## 📑 Índice

1. [Visão Geral](#1-visão-geral)
2. [Matérias-Primas](#2-matérias-primas)
3. [Produtos Acabados](#3-produtos-acabados)
4. [Fórmulas BOM](#4-fórmulas-bom)
5. [Ordens de Produção](#5-ordens-de-produção)
6. [Recebimento de XML (NF-e)](#6-recebimento-de-xml-nf-e)
7. [Configuração Fiscal](#7-configuração-fiscal)
8. [Tabelas de Preço](#8-tabelas-de-preço)
9. [Ficha de Custos](#9-ficha-de-custos)
10. [Fluxo Completo (Exemplo Prático)](#10-fluxo-completo-exemplo-prático)

---

## 1. Visão Geral

**Acesso:** Menu lateral → Fábrica ou `/dashboard/fabrica`

O Módulo Fábrica centraliza toda a gestão de produção industrial:

| Card | Descrição |
|------|-----------|
| 📦 Matérias-Primas | Total de insumos cadastrados |
| 📦 Produtos Acabados | Total de produtos finalizados |
| 🏭 OPs Ativas | Ordens de produção em andamento |
| 📋 Fórmulas BOM | Estruturas de produto (Bill of Materials) |

**Ações Rápidas:**
- ⚡ **Visão Executiva** — Dashboard consolidado com KPIs de produção
- ➕ **Nova OP** — Criar ordem de produção rapidamente
- 📦 **Matérias-Primas** — Acesso direto ao cadastro de insumos
- 📋 **Fórmulas BOM** — Gerenciar estruturas de produto

**Seções Expandíveis:**
- Cadastros Básicos (Máquinas, Operadores, Unidades)
- Produção e Planejamento (Apontamentos, Paradas, MRP)
- Qualidade e Recebimento (Inspeções, XML de NF-e)
- Precificação (Tabelas de Preço, Aprovação)

---

## 2. Matérias-Primas

**Acesso:** Fábrica → Matérias-Primas ou `/dashboard/fabrica/materias-primas`

### 2.1 Cadastrar Nova Matéria-Prima

1. Clique em **"+ Nova Matéria-Prima"**
2. Preencha os campos:

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Código | `MP-001` | ✅ Sim |
| Nome | `Farinha de Trigo` | ✅ Sim |
| Categoria | `Ingredientes` | Não |
| Unidade de Medida | `kg` | ✅ Sim |
| Custo Unitário | `R$ 2,50` | Não |
| Estoque Mínimo | `100` | Não |
| Fornecedor | `Moinho ABC` | Não |

3. Clique em **"Cadastrar"**
4. Toast de sucesso aparecerá

### 2.2 Editar Matéria-Prima

1. Na lista, clique no botão **"Editar"** ao lado da matéria-prima
2. Altere os campos desejados
3. Clique em **"Salvar"**

### 2.3 Configurar Dados Fiscais

1. Clique no botão **"Fiscal"** (ícone 📋) na linha da matéria-prima
2. Preencha: NCM, CEST, Origem, CFOP, CST ICMS, Alíquota ICMS
3. Salve as configurações

### 2.4 Inativar / Excluir

- **Inativar:** Desativa a matéria-prima sem excluir (pode reativar depois)
- **Excluir:** Remove permanentemente (com confirmação). Não permite excluir se estiver vinculada a uma fórmula

### 2.5 Filtros

- Busca por código ou nome
- Filtro por categoria e status
- Botão "Filtros" para opções avançadas

---

## 3. Produtos Acabados

**Acesso:** Fábrica → Produtos Acabados ou `/dashboard/fabrica/produtos-acabados`

### 3.1 Visões Disponíveis

| Visão | Descrição |
|-------|-----------|
| 📊 Tabela | Lista densa com todas as colunas (padrão) |
| 🃏 Cards | Grade visual com thumbnails |
| 📋 Kanban | Organização por status da ficha de custos |

### 3.2 KPIs (Indicadores)

- **Acabados** — Produtos tipo "Acabado"
- **Intermediários** — Produtos tipo "Intermediário"
- **Nacionais** — Produtos de origem nacional
- **Importados** — Produtos de origem importada

### 3.3 Cadastrar Novo Produto

1. Clique em **"+ Novo Produto"**
2. Preencha:

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Código | `PROD-001` | ✅ Sim |
| Nome | `Sérum Facial Coco 35ml` | ✅ Sim |
| Tipo | `ACABADO` | ✅ Sim |
| Origem | `Nacional` | Não |
| Marca | `Rose Ruby` | Não |
| Linha | `Facial` | Não |
| Descrição | `Sérum hidratante` | Não |
| Fórmula | (selecionar se existir) | Não |

3. Clique em **"Cadastrar"**

### 3.4 Ações por Produto

| Ícone | Ação | Descrição |
|-------|------|-----------|
| 💲 | Ficha de Custos | Abre a ficha detalhada de custos do produto |
| ✏️ | Editar | Altera dados cadastrais |
| 🗑️ | Excluir | Remove o produto (com confirmação) |

### 3.5 Agrupamento Hierárquico

1. Ative o toggle **"Agrupar"**
2. Produtos serão organizados por Marca → Linha
3. Útil para catálogos grandes

### 3.6 Filtros

- Busca por código ou nome
- Filtro por Marca e Linha
- Filtro por Status (Ativo/Inativo)

### 3.7 Revisão de Fichas (Painel Administrativo)

- Botão **"Painel Administrativo"** → acessa fichas pendentes de revisão
- **"Comunicação de Revisões"** → hub de mensagens com a Diretoria

---

## 4. Fórmulas BOM

**Acesso:** Fábrica → Fórmulas BOM ou `/dashboard/fabrica/formulas`

### 4.1 O que é uma Fórmula BOM?

Uma **Fórmula BOM** (Bill of Materials) define a **receita** de um produto: quais matérias-primas são necessárias, em quais quantidades e proporções.

### 4.2 Criar Nova Fórmula

1. Clique em **"+ Nova Fórmula"**
2. Será redirecionado ao Editor de Fórmulas

**Campos principais:**

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Produto | `PROD-001 - Sérum Facial` | ✅ Sim |
| Rendimento | `1000 unidades` | ✅ Sim |
| Tempo de Produção | `60 minutos` | Não |
| Perda Estimada | `5%` | Não |
| Temperatura | `25°C` | Não |
| pH | `5.5` | Não |

### 4.3 Adicionar Ingredientes

1. Na aba **"Ingredientes"**, clique em **"Adicionar Item"**
2. Preencha:

| Campo | Exemplo |
|-------|---------|
| Matéria-Prima | `Farinha de Trigo` |
| Quantidade | `500 kg` |
| Percentual | `50%` |
| Criticidade | `Crítico` |

3. Repita para cada ingrediente
4. **Validação automática:** soma dos percentuais deve = 100%

**Exemplo completo de fórmula:**

```
Produto: Biscoito Chocolate (PROD-001)
Rendimento: 1.000 unidades
Tempo: 60 minutos

Ingredientes:
├── Farinha de Trigo .... 500 kg (50%) - Crítico
├── Açúcar ............. 300 kg (30%) - Normal
└── Chocolate .......... 200 kg (20%) - Crítico

Total: 1.000 kg → 1.000 unidades
```

### 4.4 Roteiro de Produção

Na aba **"Roteiro"**, defina o passo a passo:

| Etapa | Máquina | Tempo | Instrução |
|-------|---------|-------|-----------|
| 1. Mistura | Misturador M-01 | 15 min | Adicionar farinha e açúcar |
| 2. Homogeneização | Misturador M-01 | 10 min | Adicionar chocolate |
| 3. Moldagem | Moldadora MD-02 | 20 min | Temperatura 180°C |
| 4. Forno | Forno F-01 | 15 min | 180°C por 15 min |

### 4.5 Ficha de Custos

Na aba **"Custos"**, o sistema calcula automaticamente:
- Custo de cada ingrediente (qtd × custo unitário)
- Custo total da fórmula
- Custo unitário por unidade produzida

### 4.6 Simular Produção

1. Clique em **"Simular Produção"**
2. Informe a quantidade desejada (ex: 5.000 unidades)
3. O sistema calcula:
   - Necessidade total de cada MP
   - Custo total estimado
   - Verificação de estoque disponível

---

## 5. Ordens de Produção

**Acesso:** Fábrica → Ordens de Produção ou `/dashboard/fabrica/ordens-producao`

### 5.1 KPIs

| KPI | Descrição |
|-----|-----------|
| Pendentes | OPs aguardando início |
| Em Produção | OPs em execução |
| Concluídas | OPs finalizadas |
| Taxa Conclusão | % de OPs concluídas |

### 5.2 Criar Nova Ordem de Produção

1. Clique em **"+ Nova Ordem"**
2. Preencha:

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Produto | `PROD-001 - Biscoito Chocolate` | ✅ Sim |
| Fórmula | `v1 - Fórmula Principal` | ✅ Sim |
| Quantidade | `5.000 unidades` | ✅ Sim |
| Data Prevista | `15/03/2026` | ✅ Sim |
| Lote | `LOTE-2026-001` | Não |
| Prioridade | `Alta` | Não |

3. Clique em **"Salvar"**
4. O sistema calcula automaticamente (MRP):
   - Necessidade de cada matéria-prima
   - Custo total estimado
   - Disponibilidade de estoque

**Exemplo de explosão MRP:**

```
OP: 5.000 unidades de Biscoito Chocolate
Fórmula base: 1.000 un → 1.000 kg de MP

Necessidades (×5):
├── Farinha de Trigo: 2.500 kg (estoque: 500 kg) ⚠️ FALTA 2.000 kg
├── Açúcar: 1.500 kg (estoque: 300 kg) ⚠️ FALTA 1.200 kg
└── Chocolate: 1.000 kg (estoque: 150 kg) ⚠️ FALTA 850 kg

Custo Total Estimado: R$ 23.950,00
```

### 5.3 Fluxo de Status

```
Pendente → Em Produção → Pausada → Em Produção → Concluída
                                                      ↓
                                                  Cancelada
```

### 5.4 Apontamentos

- Registre início/fim de cada etapa
- Registre paradas e ocorrências
- Acompanhe a barra de progresso em tempo real

---

## 6. Recebimento de XML (NF-e)

**Acesso:** Fábrica → Recebimentos ou `/dashboard/fabrica/recebimentos`

### 6.1 Importar Nota Fiscal

1. Clique em **"Selecionar Arquivo"** ou arraste o XML
2. O sistema extrai automaticamente:
   - Número da NF-e e série
   - Dados do fornecedor (CNPJ, razão social)
   - Lista de produtos com quantidades e valores
   - Data de emissão

### 6.2 Mapear Produtos

1. Clique em **"Mapear Produtos"** na nota importada
2. Para cada item da nota:
   - O sistema sugere vinculação automática (por código ou descrição)
   - Confirme ou selecione manualmente a matéria-prima correspondente
3. Salve o mapeamento

### 6.3 Ver Detalhes

Clique em **"Ver Detalhes"** para visualizar:
- Todos os itens da nota
- Valores unitários e totais
- Impostos (ICMS, IPI, PIS, COFINS)
- Status de mapeamento de cada item

**Exemplo de nota importada:**

```
NF-e 4166252 | Série 1
Fornecedor: Destro Brasil Distribuição Ltda
Data: 04/07/2025 17:39
Valor Total: R$ 7.230,82

Itens:
├── Farinha de Trigo Especial 25kg ... R$ 45,00/un × 50 = R$ 2.250,00
├── Açúcar Cristal 50kg ............. R$ 90,00/un × 20 = R$ 1.800,00
└── Chocolate em Pó 5kg ............ R$ 63,56/un × 50 = R$ 3.180,82
```

---

## 7. Configuração Fiscal

**Acesso:** Fábrica → Fiscal ou `/dashboard/fabrica/fiscal`

### 7.1 Configurar Produto

1. Localize o produto ou matéria-prima na lista
2. Clique em **"Configurar"**
3. Preencha as abas:

**Aba Fiscal:**

| Campo | Exemplo |
|-------|---------|
| NCM | `1905.90.90` |
| CEST | `17.046.00` |
| Origem | `0 - Nacional` |
| CFOP | `5102` |
| CST ICMS | `00` |
| Alíquota ICMS | `18%` |

**Aba Preços:**

| Campo | Exemplo |
|-------|---------|
| Preço de Custo | `R$ 10,00` |
| Preço de Venda | `R$ 15,00` |

**Aba Estoque:**

| Campo | Exemplo |
|-------|---------|
| Estoque Mínimo | `100` |
| Estoque Máximo | `500` |

4. Clique em **"Salvar"**
5. Badge muda de "Pendente" → "Configurado"

---

## 8. Tabelas de Preço

**Acesso:** Fábrica → Precificação → Tabelas de Preço ou `/dashboard/fabrica/tabelas-preco`

### 8.1 Criar Nova Tabela

1. Clique em **"Nova Tabela"**
2. Preencha:

| Campo | Exemplo |
|-------|---------|
| Nome | `Tabela 2026 - Março` |
| Data Vigência | `01/03/2026` |
| Markup | `30%` |

3. Adicione produtos com preços calculados
4. O sistema aplica automaticamente: Custo + Impostos + Markup

### 8.2 Fluxo de Aprovação

```
Rascunho → Enviada para Aprovação → Aprovada ✅
                                  → Rejeitada (com comentários) → Revisão
```

### 8.3 Cadeia de Precificação

```
Custo Fábrica → + Margem → Preço Distribuidor → + Margem → Preço Varejo
   R$ 4,79        30%         R$ 6,23              25%        R$ 7,79
```

---

## 9. Ficha de Custos

**Acesso:** Produtos Acabados → ícone 💲 no produto

### 9.1 Estrutura da Ficha

A ficha de custos detalha todos os componentes de custo de um produto:

| Seção | Descrição |
|-------|-----------|
| Custos de NF | Custo dos insumos conforme notas fiscais |
| Custos de Serviço | Mão de obra, energia, etc. |
| Custos de Condição | Embalagem, frete, etc. |
| Mão de Obra | Custo direto de operadores |
| Markup | Margem de lucro desejada |

### 9.2 Vincular XML à Ficha

1. Na ficha de custos, clique em **"Vincular XML"**
2. Selecione a nota fiscal importada
3. O sistema puxa automaticamente os custos reais dos insumos

### 9.3 Fluxo de Aprovação da Ficha

```
1️⃣ Monte a ficha → 2️⃣ Submeta para aprovação → 3️⃣ Diretoria analisa
     ↓                                                    ↓
  Rascunho                                      Aprovada ✅ ou Revisão 🔄
```

### 9.4 Chat com Diretoria

- Mensagens em tempo real dentro da ficha
- Apontamentos por insumo
- Requisitos obrigatórios (orçamentos, evidências)
- Histórico preservado entre versões

---

## 10. Fluxo Completo (Exemplo Prático)

### Cenário: Produzir 5.000 unidades de "Sérum Facial Coco 35ml"

#### Passo 1: Cadastrar Matérias-Primas
```
→ Fábrica > Matérias-Primas > + Nova Matéria-Prima
  MP-001: Óleo de Coco Virgem | kg | R$ 25,00/kg
  MP-002: Ácido Hialurônico | ml | R$ 180,00/L
  MP-003: Vitamina E | ml | R$ 45,00/L
  MP-004: Fragrância Natural | ml | R$ 120,00/L
```

#### Passo 2: Cadastrar Produto Acabado
```
→ Fábrica > Produtos Acabados > + Novo Produto
  Código: RR-4001
  Nome: Sérum Facial Coco 35ml
  Tipo: ACABADO
  Origem: Nacional
```

#### Passo 3: Criar Fórmula BOM
```
→ Fábrica > Fórmulas > + Nova Fórmula
  Produto: RR-4001 - Sérum Facial Coco
  Rendimento: 1.000 unidades (35ml cada)
  
  Ingredientes:
  ├── Óleo de Coco: 20L (57%)
  ├── Ácido Hialurônico: 5L (14%)
  ├── Vitamina E: 7L (20%)
  └── Fragrância: 3L (9%)
  Total: 35L → 1.000 frascos de 35ml
```

#### Passo 4: Configurar Dados Fiscais
```
→ Fábrica > Fiscal > Configurar RR-4001
  NCM: 3304.99.90
  CFOP: 5102
  ICMS: 18%
```

#### Passo 5: Criar Ordem de Produção
```
→ Fábrica > Ordens de Produção > + Nova Ordem
  Produto: RR-4001
  Fórmula: v1
  Quantidade: 5.000 unidades
  Data Prevista: 15/03/2026
  Lote: LOTE-2026-SERUM-001

  MRP calcula automaticamente:
  ├── Óleo de Coco: 100L (custo: R$ 2.500,00)
  ├── Ácido Hialurônico: 25L (custo: R$ 4.500,00)
  ├── Vitamina E: 35L (custo: R$ 1.575,00)
  └── Fragrância: 15L (custo: R$ 1.800,00)
  Total: R$ 10.375,00
  Custo unitário: R$ 2,08/unidade
```

#### Passo 6: Importar NF-e de Compra
```
→ Fábrica > Recebimentos > Importar XML
  Upload do XML da NF-e de compra dos insumos
  → Sistema extrai automaticamente fornecedor, itens e valores
  → Mapear cada item para a MP correspondente
```

#### Passo 7: Montar Ficha de Custos
```
→ Produtos Acabados > RR-4001 > 💲 Ficha de Custos
  Custo MP: R$ 2,08/un
  Custo Serviço: R$ 0,50/un
  Custo Embalagem: R$ 0,80/un
  Mão de Obra: R$ 0,30/un
  Subtotal: R$ 3,68/un
  Markup (60%): R$ 2,21/un
  Preço Final: R$ 5,89/un
```

#### Passo 8: Criar Tabela de Preço
```
→ Fábrica > Precificação > Nova Tabela
  Nome: Tabela Março 2026
  Adicionar RR-4001: R$ 5,89/un
  → Submeter para aprovação
  → Diretoria aprova ✅
```

---

## 📌 Dicas Importantes

1. **Sempre cadastre MPs antes de criar fórmulas** — a fórmula precisa referenciar MPs existentes
2. **Configure dados fiscais antes de criar tabelas de preço** — o cálculo depende das alíquotas
3. **Use o tour guiado (ícone ❓)** em cada tela para aprender as funcionalidades
4. **A fórmula é opcional no produto** — você pode vincular depois
5. **O MRP calcula automaticamente** ao criar uma OP — não precisa fazer cálculos manuais
6. **Importe XMLs de NF-e** para ter custos reais atualizados na ficha de custos
7. **O chat na ficha de custos** permite comunicação direta com a Diretoria para aprovações

---

## 🔐 Permissões

| Departamento | Acesso |
|-------------|--------|
| Fábrica | Acesso total ao módulo |
| Compras e Faturamento | Acesso a Matérias-Primas e Recebimentos |
| Diretoria | Aprovação de fichas de custos e tabelas de preço |
| Comercial | Visualização de tabelas de preço aprovadas |

---

## 🆘 Suporte

- Use o botão **❓** (canto inferior direito) para tour guiado em cada tela
- Contate o administrador para ajustes de permissões
- Consulte a equipe de TI para problemas técnicos

---

*Manual gerado automaticamente pelo Sistema Huggs — Módulo Fábrica v2.6.4*
