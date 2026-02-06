

# Painel Operacional: Do Indicador ao Contato

## Problema Atual
O painel mostra KPIs e graficos, mas quando o gestor clica e ve a tabela, falta a "ponte para a acao": quem ligar, como contatar, qual o historico desse cliente. O time precisa copiar nomes e ir buscar dados em outro sistema.

## Solucao: Drill-Down Operacional Completo

Transformar o painel de "apenas visualizacao" em uma ferramenta de trabalho diario, onde cada indicador leva diretamente a lista de clientes com todas as informacoes necessarias para agir.

---

## O que sera construido

### 1. Ficha do Cliente (Sheet lateral)

Ao clicar em qualquer linha da tabela, abre um painel lateral (Sheet) com todas as informacoes do cliente organizadas para acao imediata:

**Cabecalho:**
- Nome completo + Codigo + CNPJ
- Badge de nivel de risco (colorido)
- Status de bloqueio (ativo/bloqueado)

**Secao "Contato Rapido":**
- Telefone e celular com botoes clicaveis (tel:)
- Email com botao clicavel (mailto:)
- Nome do comprador (quando disponivel)
- Botao "Copiar WhatsApp" para o celular

**Secao "Dados Comerciais":**
- Dias sem compra + data da ultima compra
- Valor da ultima compra vs valor da maior compra (mostra a evolucao)
- Limite de credito disponivel
- Conceito do cliente

**Secao "Localizacao":**
- Endereco completo (rua, bairro, cidade, UF, CEP)
- Endereco de cobranca (quando diferente)

**Secao "Observacoes":**
- Campo de observacoes do cadastro

### 2. Graficos Clicaveis (Drill-Down)

Tornar todos os graficos interativos:

- **KPI Cards**: Ja filtra a tabela (existente). Adicionar scroll automatico ate a tabela ao clicar.
- **Funil de Risco**: Clicar em uma barra filtra a tabela por aquele nivel de risco.
- **Risco por UF**: Clicar em um estado filtra a tabela por aquela UF.
- **Distribuicao de Inatividade**: Clicar em uma faixa do grafico de area filtra a tabela por aquele range de dias.

### 3. Acoes em Lote na Tabela

Adicionar funcionalidades operacionais na tabela:

- **Selecao multipla**: Checkboxes para selecionar varios clientes
- **Exportar selecionados para Excel**: Gera planilha com dados de contato para distribuir ao time de vendas (nome, telefone, celular, email, cidade, UF, dias sem compra, valor)
- **Copiar lista de emails**: Copia emails dos selecionados para a area de transferencia (para envio de campanha)
- **Copiar lista de telefones**: Idem para telefones

### 4. Tabela Enriquecida

Adicionar colunas uteis a tabela principal:

- **Telefone/Celular**: Exibido com icone clicavel
- **Valor Maior Compra**: Para comparar com a ultima (mostra tendencia)
- **Status**: Badge indicando se esta bloqueado ou ativo

### 5. Resumo Executivo para Acao

Card no topo da tabela com um resumo orientado a acao:
- "X clientes selecionados" (quando houver selecao)
- "Total em risco nos selecionados: R$ Y"
- Botoes de acao em lote (Exportar, Copiar Emails, Copiar Telefones)

---

## Detalhes Tecnicos

### Alteracao no Hook `useClienteReativacao.ts`
- Adicionar campos ao SELECT: `telefone, celular, email, cnpj, comprador, endereco, bairro, cep, endereco_cobranca, bairro_cobranca, cidade_cobranca, uf_cobranca, cep_cobranca, valor_maior_compra, data_maior_compra, status_bloqueio, conceito, observacoes`
- Atualizar interface `ClienteReativacao` com os novos campos
- Adicionar `valor_maior_compra` e `data_maior_compra` ao mapeamento

### Novo componente: `ClienteDetailSheet.tsx`
- Usa o componente Sheet (ja existe em `src/components/ui/sheet.tsx`)
- Recebe um `ClienteReativacao` e exibe a ficha completa
- Links clicaveis para telefone (`tel:`), email (`mailto:`) e WhatsApp (`https://wa.me/55...`)
- Comparativo visual entre valor_ultima_compra e valor_maior_compra usando barra de progresso

### Alteracao em `ReactivationTable.tsx`
- Adicionar estado de `clienteSelecionado` para abrir o Sheet
- Adicionar checkboxes de selecao multipla com estado `selecionados: Set<string>`
- Adicionar colunas de Telefone/Celular e Status
- Barra de acoes no topo quando houver selecao (exportar, copiar)
- Integrar o `ClienteDetailSheet`

### Novo componente: `BulkActionsBar.tsx`
- Barra flutuante que aparece quando clientes estao selecionados
- Mostra contagem e valor total dos selecionados
- Botoes: Exportar Excel, Copiar Emails, Copiar Telefones
- Usa a biblioteca `exceljs` (ja instalada) + `file-saver` (ja instalado) para exportacao

### Alteracao em `ClientReactivation.tsx`
- Adicionar estado de filtro por UF (vindo dos graficos)
- Adicionar estado de filtro por range de dias (vindo do grafico de distribuicao)
- Adicionar ref para a tabela e scroll automatico ao clicar nos KPIs
- Passar callbacks de drill-down para os graficos

### Alteracao em `RiskFunnelChart.tsx`
- Adicionar prop `onBarClick(nivel: RiskLevel)` para drill-down
- Tornar barras clicaveis com cursor pointer

### Alteracao em `RiskByStateCard.tsx`
- Adicionar prop `onUFClick(uf: string)` para drill-down
- Tornar itens clicaveis com hover visual

### Alteracao em `InactivityDistributionChart.tsx`
- Adicionar prop `onRangeClick(minDias: number, maxDias: number)` para drill-down
- Tornar areas clicaveis

### Funcao de exportacao Excel
- Usar `exceljs` para gerar planilha formatada
- Colunas: Nome, Codigo, CNPJ, Telefone, Celular, Email, Comprador, Cidade, UF, Dias sem Compra, Ultima Compra (data), Valor Ultima, Valor Maior, Limite Credito, Status
- Nome do arquivo: `reativacao_clientes_YYYY-MM-DD.xlsx`
- Formatacao: cabecalho colorido por nivel de risco, valores monetarios formatados

### Sem migracoes de banco de dados
Todos os dados necessarios ja existem na tabela `clientes`. Apenas ampliamos os campos no SELECT.

---

## Layout Atualizado

```text
+----------------------------------------------------------+
| <- Voltar  Painel de Reativacao              [Filial] [R] |
+----------------------------------------------------------+
| [Atencao:43] [Alerta:57] [Critico:59] [Inativo:301]      |
|  (clique filtra + scroll para tabela)                     |
+----------------------------------------------------------+
| Funil de Risco (clicavel) | Risco por UF (clicavel)      |
+----------------------------------------------------------+
| Distribuicao de Inatividade (clicavel por faixa)          |
+----------------------------------------------------------+
| [Barra de Acoes: 5 selecionados | R$ 12k | Excel | Copy] |
+----------------------------------------------------------+
| [x] Nome  | Cidade | UF | Dias | Tel | Valor | Status    |
| [x] Cli A | SP     | SP | 95d  | ... | 5.2k  | Ativo    |  <- clique abre Sheet
| [ ] Cli B | BH     | MG | 120d | ... | 3.1k  | Ativo    |
+----------------------------------------------------------+

Sheet Lateral (ao clicar na linha):
+---------------------------+
| FICHA: Cliente ABC        |
| CNPJ: 12.345.678/0001-90 |
| Status: Ativo             |
|---------------------------|
| CONTATO RAPIDO            |
| Tel: (11) 9999-9999  [L]  |
| Cel: (11) 8888-8888  [W]  |
| Email: abc@xyz.com   [E]  |
| Comprador: Joao Silva     |
|---------------------------|
| DADOS COMERCIAIS          |
| 95 dias sem compra        |
| Ultima: R$ 5.200          |
| Maior:  R$ 12.800  [-59%] |
| Limite: R$ 150.000        |
|---------------------------|
| LOCALIZACAO               |
| Rua ABC, 123 - Centro     |
| Sao Paulo - SP 01000-000  |
+---------------------------+
```

