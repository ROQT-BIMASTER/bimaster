# 🏭 Fluxo Completo da Cadeia de Produtos

Este documento descreve o fluxo correto para cadastrar produtos e criar a cadeia de precificação completa.

## 📋 Visão Geral

A cadeia de produtos funciona na seguinte ordem:

```
1. Cadastro de Produto (fabrica_produtos)
   ↓
2. Configuração Fiscal (fabrica_dados_fiscais_produto)
   ↓
3. Criação de Fórmula (fabrica_formulas + fabrica_formula_itens)
   ↓
4. Vinculação da Fórmula ao Produto
   ↓
5. Ordem de Produção (fabrica_ordens_producao)
   ↓
6. Tabela de Preços (fabrica_tabelas_preco)
```

---

## 🔧 1. Cadastro de Produto

**Página:** `/dashboard/fabrica/produtos-acabados`  
**Componente:** `NovoProdutoAcabadoDialog.tsx`

### Campos Obrigatórios:
- ✅ Código (único)
- ✅ Nome do Produto
- ✅ Tipo (ACABADO, INTER, MP)

### Campos Opcionais:
- 📝 Descrição
- 🔗 Fórmula (pode ser vinculada depois)
- 📏 Unidade de Medida
- ⏱️ Tempo de Produção
- 📦 Rendimento
- 🖼️ Foto URL

### ⚠️ IMPORTANTE:
- **Produto pode ser salvo SEM fórmula inicialmente**
- A fórmula será vinculada na etapa 4, após sua criação
- Isso quebra a dependência circular anterior

### Exemplo:
```typescript
{
  codigo: "PROD-001",
  nome: "Biscoito Chocolate",
  tipo: "ACABADO",
  formula_id: null,  // ← Será preenchido depois
  unidade_medida_id: "uuid-da-unidade-kg",
  tempo_producao_minutos: 60,
  rendimento: 1000,
  ativo: true
}
```

---

## 📊 2. Configuração Fiscal

**Página:** `/dashboard/fabrica/fiscal`  
**Componente:** `DadosFiscaisProdutoDialog.tsx`

### O que é configurado:
- 🏷️ NCM (Nomenclatura Comum do Mercosul)
- 📋 CEST, Origem da Mercadoria, CFOP
- 💰 Alíquotas: ICMS, IPI, PIS, COFINS
- 📈 CST (Código de Situação Tributária)
- 💵 Preços: Custo, Venda, Máximo, Fábrica
- 📦 Estoque: Mínimo, Máximo
- ⚖️ Dimensões: Peso, Altura, Largura, Comprimento

### ⚠️ IMPORTANTE:
- **Esta etapa configura a tributação do produto**
- Necessária para cálculo correto de custos e preços
- `FabricaFiscal.tsx` agora mostra TANTO produtos quanto matérias-primas

### Tabela:
```sql
fabrica_dados_fiscais_produto (
  produto_id → fabrica_produtos.id OU fabrica_materias_primas.id
  ncm, cest, cfop_padrao, ...
)
```

---

## 🧪 3. Criação de Fórmula (BOM)

**Página:** `/dashboard/fabrica/formulas/nova`  
**Componente:** `FabricaFormulaEditor.tsx`

### Passos:
1. Selecionar o **Produto** criado na etapa 1
2. Adicionar **Matérias-Primas** (itens da fórmula)
3. Definir **Quantidade** e **Percentual** de cada MP
4. Configurar **Roteiro de Produção** (máquinas, etapas)
5. **Validar** a fórmula (soma de percentuais = 100%)
6. **Salvar** a fórmula

### Validações Automáticas:
```typescript
✅ Soma de percentuais = 100%
✅ Quantidades > 0
✅ Sem MPs duplicadas
⚠️ Aviso: ingredientes críticos
```

### Tabelas:
```sql
fabrica_formulas (
  produto_id → fabrica_produtos.id
  versao, ativa, custo_total_calculado
)

fabrica_formula_itens (
  formula_id → fabrica_formulas.id
  mp_id → fabrica_materias_primas.id
  quantidade, percentual, criticidade
)
```

---

## 🔗 4. Vinculação da Fórmula ao Produto

**Onde:** Editar o produto em `/dashboard/fabrica/produtos-acabados`

### Processo:
1. Clicar em **Editar** no produto
2. Selecionar a **Fórmula** criada na etapa 3
3. Salvar

### Resultado:
```typescript
fabrica_produtos {
  id: "produto-uuid",
  codigo: "PROD-001",
  nome: "Biscoito Chocolate",
  formula_id: "formula-uuid"  // ← Agora vinculado!
}
```

---

## 📋 5. Ordem de Produção

**Página:** `/dashboard/fabrica/ordens-producao`  
**Componente:** `NovaOrdemProducaoDialog.tsx`

### Campos:
- 📦 **Produto** (com fórmula vinculada)
- 🔢 **Quantidade Planejada**
- 📅 **Data de Entrega**
- 📝 **Observações**

### ⚠️ IMPORTANTE:
- **Produto DEVE ter fórmula vinculada**
- Sistema explode a BOM automaticamente
- Calcula necessidades de MPs via MRP

### Tabela:
```sql
fabrica_ordens_producao (
  produto_id → fabrica_produtos.id
  formula_id → fabrica_formulas.id  -- Obrigatório!
  quantidade_planejada,
  data_entrega,
  status
)
```

---

## 💰 6. Tabela de Preços

**Página:** `/dashboard/fabrica/tabelas-preco`  
**Componente:** `NovaTabelaPrecoDialog.tsx`

### Processo:
1. Criar tabela de preços (nome, vigência, etc.)
2. Sistema calcula preços baseado em:
   - 💵 Custo das MPs (da fórmula)
   - 🏭 Custo de produção
   - 💸 Impostos (dados fiscais)
   - 📈 Markup definido
3. Enviar para aprovação
4. Após aprovação → disponível no Portal do Cliente

### Tabelas:
```sql
fabrica_tabelas_preco (
  nome, data_vigencia_inicio,
  owner_cnpj, visivel_para_cnpjs,
  status_aprovacao
)

fabrica_tabelas_preco_itens (
  tabela_id, produto_id,
  preco_base, preco_final,
  margem_contribuicao
)
```

---

## 🔄 Fluxo Resumido (Ordem Correta)

### ✅ Fluxo CORRETO:
```
1. Cadastrar Produto (sem fórmula) ✅
   ↓
2. Configurar Dados Fiscais ✅
   ↓
3. Criar Fórmula (BOM) vinculando MPs ✅
   ↓
4. Editar Produto e vincular Fórmula ✅
   ↓
5. Criar Ordem de Produção ✅
   ↓
6. Gerar Tabela de Preços ✅
```

### ❌ Fluxo INCORRETO (Anterior):
```
❌ Tentar criar fórmula sem produto cadastrado
❌ Tentar criar produto exigindo fórmula (dependência circular)
❌ Tentar criar OP sem fórmula vinculada ao produto
```

---

## 🐛 Problemas Corrigidos

### 1. **Departamento Fiscal**
**Antes:** Buscava apenas de `fabrica_materias_primas`  
**Agora:** Busca de `fabrica_produtos` E `fabrica_materias_primas`

### 2. **Cadastro de Produto**
**Antes:** Exigia fórmula no cadastro (dependência circular)  
**Agora:** Produto pode ser salvo sem fórmula inicialmente

### 3. **Vinculação de Fórmula**
**Antes:** Sem interface para vincular fórmula depois  
**Agora:** Dialog de edição permite selecionar fórmula existente

### 4. **Ordem de Produção**
**Antes:** Quebrava se produto não tivesse fórmula  
**Agora:** Validação explícita + mensagem clara

---

## 📚 Tabelas Principais

```sql
-- Produtos (acabados, intermediários, MPs)
fabrica_produtos (id, codigo, nome, tipo, formula_id, ativo)

-- Matérias-Primas
fabrica_materias_primas (id, codigo, nome, status)

-- Dados Fiscais (para produtos E MPs)
fabrica_dados_fiscais_produto (
  produto_id,  -- pode ser de fabrica_produtos OU fabrica_materias_primas
  ncm, cfop, aliquotas, custos, ...
)

-- Fórmulas (BOM)
fabrica_formulas (id, produto_id, versao, ativa)
fabrica_formula_itens (formula_id, mp_id, quantidade, percentual)

-- Ordens de Produção
fabrica_ordens_producao (produto_id, formula_id, quantidade, status)

-- Tabelas de Preço
fabrica_tabelas_preco (nome, data_vigencia, owner_cnpj)
fabrica_tabelas_preco_itens (tabela_id, produto_id, preco_final)
```

---

## ✅ Checklist de Implementação

- [x] Permitir salvar produto SEM fórmula
- [x] FabricaFiscal mostra produtos + MPs
- [x] Dialog de edição permite vincular fórmula
- [x] Validações nas OPs verificam fórmula
- [x] Documentação do fluxo correto
- [x] Logs de debug no salvamento

---

## 🎯 Resultado Final

Agora você pode:

1. ✅ Cadastrar produtos rapidamente (sem depender de fórmula)
2. ✅ Configurar dados fiscais para produtos E MPs
3. ✅ Criar fórmulas complexas com múltiplas MPs
4. ✅ Vincular fórmula ao produto depois
5. ✅ Gerar ordens de produção com explosão de BOM
6. ✅ Criar tabelas de preços com custos corretos
7. ✅ Disponibilizar preços no Portal do Cliente (por CNPJ)

---

**Última atualização:** 2025-01-29  
**Status:** ✅ Implementado e Testado
