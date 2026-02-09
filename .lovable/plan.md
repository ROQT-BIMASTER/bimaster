

# Padronizar Lancamentos Trade com o Modelo de Eventos

## Objetivo
Alinhar o formulario de "Novo Lancamento" do Trade Marketing com o padrao ja estabelecido na tela de despesas de Eventos, trazendo consistencia visual e funcional para o usuario.

## Diferencas Atuais

| Aspecto | Eventos (padrao) | Trade (atual) |
|---------|-------------------|---------------|
| Anexos | Componente `ExpenseAttachments` com upload estruturado, preview, download e remocao individual | Upload manual de fotos com grid de imagens e URLs armazenadas em texto nas notas |
| Campos de valor | Valor Previsto + Valor Realizado | Apenas um campo "Valor" |
| Categorias | Sistema de categorias padronizadas (`EXPENSE_CATEGORIES`) | Tipos de lancamento (budget_allocation, investment, expense, etc.) |
| Separadores visuais | Separadores entre secoes do formulario | Sem separadores |

## O que sera feito

### 1. Substituir o sistema de upload de fotos pelo componente `ExpenseAttachments`
- Remover o bloco de upload manual de fotos (linhas 648-692 do dialog Trade)
- Adicionar o componente `ExpenseAttachments` ja existente, usando o bucket `trade-photos` (ou um bucket dedicado `trade-expense-docs`)
- Armazenar os anexos como JSON estruturado na coluna `attachments` da tabela `trade_financial_entries` (nova coluna, tipo `jsonb`)
- Mover os arquivos para o caminho definitivo apos o insert, igual ao padrao de Eventos

### 2. Adicionar campo de "Valor Previsto"
- Incluir um campo `valor_previsto` (opcional) ao lado do campo `Valor` existente (que passara a ser "Valor Realizado")
- Adicionar coluna `valor_previsto` na tabela `trade_financial_entries`

### 3. Adicionar categorias padronizadas
- Criar uma lista de categorias especificas para Trade (ex: Material POS, Degustacao, Promocao, Bonificacao, Logistica, etc.)
- Adicionar campo `category` na tabela `trade_financial_entries`
- Manter o campo `entry_type` existente para compatibilidade

### 4. Melhorias visuais de padronizacao
- Adicionar separadores (`Separator`) entre as secoes do formulario
- Organizar campos de forma consistente com o dialog de Eventos

## Detalhes tecnicos

### Migracao SQL
Nova migracao para adicionar colunas na tabela `trade_financial_entries`:
- `attachments` (jsonb, default '[]')
- `valor_previsto` (numeric, nullable)
- `category` (text, nullable)

Criar o storage bucket `trade-expense-docs` se nao existir.

### Arquivo `src/components/trade/NovoLancamentoDialog.tsx`
- Importar `ExpenseAttachments` de `@/components/events/ExpenseAttachments`
- Importar `Separator` de `@/components/ui/separator`
- Remover estados `uploadedPhotos`, `uploading` e funcoes `handlePhotoUpload`, `removePhoto`
- Adicionar estados `attachments`, `tempEntryId`, `valorPrevisto`, `category`
- Criar constante `TRADE_EXPENSE_CATEGORIES` com categorias especificas de Trade
- Substituir bloco de fotos pelo componente `ExpenseAttachments`
- Adicionar campo "Valor Previsto" ao lado do "Valor Realizado"
- Adicionar seletor de Categoria
- Ajustar `handleSubmit` para salvar anexos, valor_previsto e category
- Adicionar logica de mover arquivos de storage apos insert (mesmo padrao do Evento)
- Adicionar `Separator` entre secoes

### Arquivo `src/components/trade/EditarLancamentoDialog.tsx`
- Aplicar as mesmas mudancas de anexos e campos para manter consistencia na edicao

