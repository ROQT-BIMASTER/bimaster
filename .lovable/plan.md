
# Plano: Separação das Telas de Campanhas e Lançamentos

## Entendimento da Solicitação

O usuário identificou corretamente que há uma mistura de conceitos na estrutura atual:
- A tela `TradeCampaigns` combina gestão de campanhas com visualização de lançamentos
- Quando clica em "Editar detalhes da campanha" (`TradeCampaignDetail`), o usuário acessa a tela de lançamentos rápidos
- Não faz sentido ter "marcar cliente" na listagem de campanhas, pois isso acontece no detalhe

## Proposta de Reorganização

### Estrutura Proposta

```text
TradeCampaigns (Gestão de Campanhas - Admin)
├── Lista de Campanhas (tabela com todas as campanhas)
├── Criar/Editar Campanhas
└── Enviar para Aprovação

TradeCampaignDetail (Execução de Lançamentos - Vendedores)
├── Lançamentos do Cliente (selecionar cliente, criar lançamento)
├── Produtos
├── Gastos
├── Validação (Admin)
└── Histórico
```

### Mudanças Propostas

#### 1. Simplificar `TradeCampaigns.tsx`

Remover as abas "Por Cliente" e "Resultados Gerais" desta tela, pois:
- "Por Cliente" mostra lançamentos, não campanhas
- "Resultados Gerais" é um painel de resultados de lançamentos

A tela ficará focada exclusivamente na **gestão administrativa de campanhas**:
- Listagem de todas as campanhas
- Criação de novas campanhas
- Métricas de campanhas (não de lançamentos)
- Ações: Ver detalhes, Enviar para aprovação

#### 2. Criar Nova Rota para Painel de Lançamentos

Criar uma nova página `/dashboard/trade/financeiro/lancamentos-campanhas` com:
- O componente `CampaignResultsPanel` como tela principal
- O componente `CampaignClientTable` para visão por cliente
- Filtros por período, campanha, vendedor, status
- Acesso rápido para criar novos lançamentos

Esta será a **tela principal para visualizar e gerenciar lançamentos** de todas as campanhas.

#### 3. Manter `TradeCampaignDetail.tsx` Intacto

A tela de detalhes da campanha continua sendo o **centro de execução**:
- Vendedor seleciona cliente
- Registra lançamento (valor, sell out, brinde)
- Adiciona produtos e gastos
- Upload de evidências

Nenhuma mudança estrutural nesta tela.

#### 4. Atualizar Navegação do Módulo Trade

Adicionar card de acesso direto ao Painel de Lançamentos na home do módulo Trade ou no menu lateral do Financeiro.

---

## Detalhes Técnicos

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/TradeCampaigns.tsx` | Remover tabs "por-cliente" e "resultados", deixar apenas listagem de campanhas |
| `src/pages/TradeLancamentosCampanhas.tsx` | Criar nova página para Painel de Lançamentos |
| `src/App.tsx` | Adicionar rota `/dashboard/trade/financeiro/lancamentos-campanhas` |
| `src/pages/TradeFinanceiro.tsx` | Adicionar card de navegação para Painel de Lançamentos |

### Nova Estrutura de Navegação do Financeiro

```text
Trade Financeiro
├── Campanhas (gestão administrativa)
├── Painel de Lançamentos (NOVA - execução e resultados)
├── Verbas Semestrais
├── Aprovações
├── Contas Correntes
└── Lançamentos Financeiros
```

### Componente `TradeLancamentosCampanhas.tsx`

Nova página que integra:

- **Seção KPIs**: Cards com métricas consolidadas (usa dados do `CampaignResultsPanel`)
- **Tabs**:
  - "Todos os Lançamentos" - Tabela completa com filtros
  - "Por Cliente" - Agrupamento por cliente (`CampaignClientTable`)
- **Ações**:
  - Botão "Novo Lançamento" que abre seletor de campanha
  - Exportar/Importar planilha
  - Filtros por período, campanha, status

### Fluxo do Usuário Atualizado

**Gestor/Admin:**
1. Acessa Trade Financeiro
2. Clica em "Campanhas" -> Cria/Gerencia campanhas
3. Clica em "Painel de Lançamentos" -> Visualiza todos os resultados

**Vendedor:**
1. Acessa Trade Financeiro
2. Clica em "Campanhas" -> Vê campanhas disponíveis
3. Clica em uma campanha -> Abre TradeCampaignDetail
4. Seleciona cliente -> Registra lançamento
5. Ou: Clica em "Painel de Lançamentos" -> Vê seus lançamentos

---

## Benefícios

1. **Clareza de propósito**: Cada tela tem uma função específica
2. **Separação de responsabilidades**: Gestão vs Execução
3. **Navegação intuitiva**: Usuário sabe exatamente onde está
4. **Manutenibilidade**: Componentes menores e focados
5. **Performance**: Carrega apenas os dados necessários por tela

---

## Resumo Visual

```text
                        ┌─────────────────────┐
                        │   Trade Financeiro  │
                        └──────────┬──────────┘
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
     ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
     │    Campanhas    │  │     Painel      │  │  Outras Areas   │
     │    (Gestão)     │  │  Lançamentos    │  │   (Verbas...)   │
     └────────┬────────┘  └─────────────────┘  └─────────────────┘
              │
              ▼ (clique em campanha)
     ┌─────────────────┐
     │ Detalhe/Execução│
     │  (Lançamentos)  │
     └─────────────────┘
```

