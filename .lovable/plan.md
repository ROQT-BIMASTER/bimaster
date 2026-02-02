

# Plano: Adicionar Campo "Número de Lojas/Filiais" 

## Objetivo
Permitir que os usuários informem quantas lojas físicas estão associadas a um único CNPJ (matriz). Isso é importante porque muitos clientes possuem um CNPJ matriz que representa várias filiais ou pontos de venda.

---

## Alterações Propostas

### 1. Banco de Dados

Adicionar uma nova coluna em **duas tabelas**:

**Tabela `stores`:**
- `branch_count` (INTEGER, padrão 1) - Quantidade de lojas/filiais que este CNPJ representa

**Tabela `store_chains`:**
- `branch_count` (INTEGER, padrão 1) - Quantidade de lojas da rede

---

### 2. Formulário "Nova Loja" (NovaLojaDialog)

Adicionar campo **"Nº de Lojas/Filiais"** abaixo do campo CNPJ:
- Input numérico com valor mínimo de 1
- Texto de ajuda: *"Informe quantas lojas este CNPJ representa (ex: matriz com 5 filiais)"*
- Valor padrão: 1

---

### 3. Formulário "Editar Loja" (EditarLojaDialog)

Adicionar o mesmo campo para que lojas existentes possam ter essa informação atualizada.

---

### 4. Formulário "Nova Rede de Lojas" (NovaRedeDialog)

Adicionar campo **"Nº de Lojas da Rede"** para informar quantas lojas a rede possui no total:
- Input numérico 
- Texto de ajuda: *"Total de lojas que fazem parte desta rede"*

---

### 5. Tela de Detalhes da Loja (StoreDetailDialog)

Exibir a informação do número de filiais na seção de dados cadastrais, com ícone visual para destacar quando houver múltiplas lojas.

---

### 6. Listagem de Lojas (TradeStores)

Mostrar uma indicação visual (badge ou ícone) quando uma loja representa múltiplas filiais.

---

## Benefícios

- Visibilidade clara de quantas lojas estão por trás de um CNPJ único
- Melhor planejamento de visitas e campanhas
- Relatórios mais precisos sobre cobertura de mercado

---

## Detalhes Técnicos

### Migração SQL

```sql
ALTER TABLE stores 
ADD COLUMN branch_count INTEGER DEFAULT 1;

ALTER TABLE store_chains 
ADD COLUMN branch_count INTEGER DEFAULT 1;

COMMENT ON COLUMN stores.branch_count IS 'Número de lojas/filiais que este registro representa';
COMMENT ON COLUMN store_chains.branch_count IS 'Total de lojas da rede';
```

### Arquivos a Modificar

1. `src/components/trade/NovaLojaDialog.tsx` - Adicionar campo branch_count
2. `src/components/trade/EditarLojaDialog.tsx` - Adicionar campo branch_count
3. `src/components/trade/NovaRedeDialog.tsx` - Adicionar campo branch_count
4. `src/components/trade/StoreDetailDialog.tsx` - Exibir branch_count
5. `src/pages/TradeStores.tsx` - Mostrar indicador de múltiplas lojas
6. `src/lib/validations/store.ts` - Adicionar validação do campo

