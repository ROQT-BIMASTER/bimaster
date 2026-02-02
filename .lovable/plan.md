
# Plano: Ficha Técnica de Custos de Produção

## Contexto

Atualmente você recebe custos de fábrica em planilhas Excel manuais (como o PDF do Pistache) com uma estrutura muito detalhada:

| Aspecto | Planilha Atual (PDF) | Sistema Atual |
|---------|---------------------|---------------|
| **Colunas de custo** | NF, Serviço, Condição, NF Venda | Apenas custo unitário |
| **Mão de obra** | Linha separada (M.o) | Não rastreado |
| **Fornecedor** | Por item | Cadastrado, mas não exibido |
| **NF referência** | Por item | Não rastreado |
| **Markup operacional** | "10% sobre o custo" | Não existe |
| **Totais por coluna** | Sim | Apenas total geral |

## Solução Proposta

Criar uma estrutura profissional de **Ficha Técnica de Custos** que captura toda a complexidade da planilha Excel atual, mas de forma integrada e automatizada.

---

## 1. Nova Estrutura de Dados

### Tabela: `fabrica_ficha_custo_itens`

Campos adicionais para cada item da fórmula:

| Campo | Descrição |
|-------|-----------|
| `custo_nf` | Custo conforme Nota Fiscal |
| `custo_servico` | Custo de serviço/terceirização |
| `custo_condicao` | Custo de condição adicional |
| `nf_referencia` | Número da NF de referência |
| `tipo_insumo` | Bulk, Frasco, Tampa, Display, etc. |

### Tabela: `fabrica_ficha_custo_config`

Configuração por produto:

| Campo | Descrição |
|-------|-----------|
| `custo_mao_obra` | Valor fixo de M.O. por unidade |
| `percentual_markup` | Ex: 10% sobre o custo |
| `fornecedor_servico` | Fornecedor de terceirização (ex: Rodrigues) |

---

## 2. Interface da Ficha de Custos

### Componente: `FichaCustoProducao`

Visualização profissional estilo planilha com:

**Cabeçalho:**
- Nome do produto (ex: "LIP OIL PISTACHE RR-L6517")
- Código PA
- Fornecedor de serviço

**Tabela de Custos:**
```text
+--------+--------------------+-------------+----------+----------+----------+-----------+
| Código | Insumo             | Fornecedor  | NF       | Serviço  | Condição | NF Ref    |
+--------+--------------------+-------------+----------+----------+----------+-----------+
|        | M.o                | Rodrigues   | R$ 0,05  | R$ 0,85  |          |           |
| 22904  | Bulk               | Rodrigues   | R$ 0,19  | R$ 0,19  |          |           |
| 22983  | Frasco             | Kilimplast  | R$ 0,09  |          | R$ 0,27  | NF34956   |
| ...    | ...                | ...         | ...      | ...      | ...      | ...       |
+--------+--------------------+-------------+----------+----------+----------+-----------+
|        | 10% sobre o custo  |             | R$ 0,00  | R$ 0,19  |          |           |
+--------+--------------------+-------------+----------+----------+----------+-----------+
| TOTAIS                      |             | R$ 0,76  | R$ 1,31  | R$ 1,70  | R$ 3,77   |
+--------+--------------------+-------------+----------+----------+----------+-----------+
```

**Totalizadores:**
- Custo NF Total
- Custo Serviço Total  
- Custo Condição Total
- **Custo Total Final** (soma de todas as colunas)

---

## 3. Categorização de Insumos

Classificação automática por tipo:

| Tipo | Exemplos |
|------|----------|
| **Bulk/Granel** | Formulação base |
| **Embalagem Primária** | Frasco, Pote, Bisnaga |
| **Embalagem Secundária** | Tampa, Batoque, Válvula |
| **Rótulos/Impressos** | Rótulo, Cartucho |
| **Embalagem Terciária** | Display, Berço, Caixa Master |
| **Consumíveis** | Filme, Tabuleiro |
| **Acessórios** | Provador |

---

## 4. Exportação PDF Profissional

Gerar documento idêntico ao formato Excel atual:

- Cabeçalho com logo e nome do produto
- Tabela formatada com todas as colunas
- Totais por coluna e geral
- Rodapé com data de geração

---

## 5. Integração com Fórmulas Existentes

Adicionar aba "Ficha de Custos" no editor de fórmulas (`FabricaFormulaEditor`) com:

- Edição inline de custos NF/Serviço/Condição por item
- Configuração de M.O. e markup
- Cálculo automático de totais
- Botão de exportar PDF

---

## Detalhes Técnicos

### Migração SQL

```sql
-- Adicionar campos à tabela de itens
ALTER TABLE fabrica_formula_itens
ADD COLUMN custo_nf DECIMAL(12,6) DEFAULT 0,
ADD COLUMN custo_servico DECIMAL(12,6) DEFAULT 0,
ADD COLUMN custo_condicao DECIMAL(12,6) DEFAULT 0,
ADD COLUMN nf_referencia VARCHAR(50),
ADD COLUMN tipo_insumo VARCHAR(50);

-- Tabela de configuração de custos
CREATE TABLE fabrica_ficha_custo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES fabrica_formulas(id) ON DELETE CASCADE,
  custo_mao_obra DECIMAL(12,6) DEFAULT 0,
  fornecedor_mao_obra VARCHAR(100),
  percentual_markup DECIMAL(5,2) DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(formula_id)
);
```

### Novos Componentes React

| Componente | Função |
|------------|--------|
| `FichaCustoProducao.tsx` | Visualização completa da ficha |
| `FichaCustoEditor.tsx` | Edição inline dos custos |
| `ExportarFichaCustoPDF.tsx` | Geração de PDF profissional |

### Cálculos Automáticos

```typescript
interface CustosProduto {
  custoNfTotal: number;      // Soma de todos os custo_nf
  custoServicoTotal: number; // Soma de todos os custo_servico + M.O.
  custoCondicaoTotal: number;// Soma de todos os custo_condicao
  markup: number;            // percentual_markup aplicado
  custoFinalTotal: number;   // Soma de todas as colunas
}
```

---

## Resultado Esperado

Substituição completa das planilhas Excel por uma interface integrada que:

1. Mantém o mesmo formato visual familiar
2. Calcula automaticamente os totais
3. Vincula custos às NFs de entrada (recebimento XML)
4. Gera PDFs profissionais para compartilhamento
5. Integra com o sistema de precificação existente
