
# Manual de Lancamento com Tour Guiado Interativo

## Visao Geral

Implementar um sistema de onboarding interativo (Product Tour) para o modulo de Campanhas de Trade Marketing, similar aos tours utilizados por bancos e aplicativos modernos. O sistema guiara o usuario passo a passo por cada tela, destacando elementos importantes e ensinando onde clicar.

## Arquitetura da Solucao

### Biblioteca Selecionada: Driver.js
- Leve (~5KB gzipped)
- Zero dependencias
- Suporte nativo a React
- Animacoes suaves e profissionais
- Altamente customizavel
- Funciona com elementos dinamicos

### Estrutura de Componentes

```text
src/
  components/
    tour/
      TourProvider.tsx          # Contexto global do tour
      useTour.ts                # Hook para controlar tours
      TourButton.tsx            # Botao "?" para iniciar tour
      tours/
        tradeCampaignsTour.ts   # Tour: Lista de Campanhas
        tradeCampaignDetailTour.ts  # Tour: Detalhes da Campanha
        tradeLancamentosTour.ts     # Tour: Aba Lancamentos
        tradeProductsTour.ts        # Tour: Aba Produtos
        tradeExpensesTour.ts        # Tour: Aba Gastos
        tradeValidationTour.ts      # Tour: Aba Validacao
```

## Fluxo do Tour

### 1. Lista de Campanhas (TradeCampaigns.tsx)
| Passo | Elemento | Mensagem |
|-------|----------|----------|
| 1 | Header | Bem-vindo ao modulo de Campanhas de Trade Marketing! |
| 2 | KPIs | Estes cards mostram metricas gerais das campanhas |
| 3 | Botao Nova Campanha | Clique aqui para criar uma nova campanha |
| 4 | Tabela | Lista completa de campanhas. Clique no olho para ver detalhes |

### 2. Detalhes da Campanha (TradeCampaignDetail.tsx)
| Passo | Elemento | Mensagem |
|-------|----------|----------|
| 1 | Header | Voce esta na pagina de detalhes da campanha |
| 2 | Badge Status | Este badge mostra o status atual da campanha |
| 3 | Tabs | Navegue entre as abas para gerenciar lancamentos |
| 4 | Tab Lancamento | PRIMEIRO: Selecione ou crie um lancamento aqui |
| 5 | Tab Produtos | SEGUNDO: Registre os produtos da acao |
| 6 | Tab Gastos | TERCEIRO: Declare os gastos realizados |
| 7 | Tab Validacao | QUARTO: Supervisores aprovam aqui |

### 3. Aba Lancamentos (CampaignLancamentosList.tsx)
| Passo | Elemento | Mensagem |
|-------|----------|----------|
| 1 | Card Resumo | Resumo de todos os lancamentos da campanha |
| 2 | Botao Novo Lancamento | Clique para registrar uma acao em um cliente |
| 3 | Botoes Import/Export | Importe ou exporte lancamentos via planilha |
| 4 | Tabela | Clique em uma linha para selecionar o cliente |
| 5 | Botao Seta | Use a seta para continuar para produtos |

### 4. Aba Produtos (CampaignProducts.tsx)
| Passo | Elemento | Mensagem |
|-------|----------|----------|
| 1 | Cards KPI | Resumo de produtos e investimentos |
| 2 | Botao Adicionar | Adicione produtos utilizados na acao |
| 3 | Tabela | Lista de produtos com quantidades e custos |

### 5. Aba Gastos (CampaignExpenses.tsx)
| Passo | Elemento | Mensagem |
|-------|----------|----------|
| 1 | Cards Verba | Controle de verba orcada vs realizada |
| 2 | Barra Progresso | Visualize quanto do orcamento foi utilizado |
| 3 | Botao Declarar | Registre novos gastos aqui |
| 4 | Tabela Gastos | Supervisores aprovam gastos nesta tabela |

## Recursos Principais

### Persistencia de Estado
- Armazenar no localStorage se usuario ja viu o tour
- Opcao "Nao mostrar novamente"
- Permitir reiniciar tours a qualquer momento

### Trigger Automatico
- Mostrar tour automaticamente na primeira visita
- Botao "?" flutuante para iniciar manualmente

### Navegacao do Tour
- Botoes "Proximo" e "Anterior"
- Botao "Pular Tour"
- Indicador de progresso (1 de 5)

### Estilos Profissionais
- Overlay escuro destacando elemento ativo
- Popover com cores da marca
- Animacao suave entre passos
- Responsivo para mobile

## Implementacao Tecnica

### 1. Instalacao da Dependencia
```bash
npm install driver.js
```

### 2. Provider Global (TourProvider.tsx)
```typescript
// Contexto para gerenciar estado dos tours
// - Tracking de tours completados por usuario
// - Funcoes para iniciar/parar tours
// - Persistencia no localStorage
```

### 3. Hook Customizado (useTour.ts)
```typescript
// Hook para componentes iniciarem tours
// - startTour(tourId)
// - resetTour(tourId)
// - hasSeenTour(tourId)
```

### 4. Configuracao de Tours
Cada tour sera definido em arquivo separado com:
- ID unico do tour
- Array de steps com target, title, description
- Callbacks para eventos (onComplete, onSkip)

### 5. Integracao nos Componentes
Adicionar atributos `data-tour` nos elementos:
```typescript
<Button data-tour="new-campaign">Nova Campanha</Button>
```

### 6. Botao de Ajuda
Botao flutuante "?" no canto da tela para iniciar tour manualmente

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| package.json | Modificar | Adicionar driver.js |
| src/components/tour/TourProvider.tsx | Criar | Provider global |
| src/components/tour/useTour.ts | Criar | Hook de controle |
| src/components/tour/TourButton.tsx | Criar | Botao "?" flutuante |
| src/components/tour/tours/*.ts | Criar | Definicoes dos tours |
| src/pages/TradeCampaigns.tsx | Modificar | Adicionar data-tour |
| src/pages/TradeCampaignDetail.tsx | Modificar | Adicionar data-tour |
| src/components/trade/campaigns/*.tsx | Modificar | Adicionar data-tour |
| src/App.tsx | Modificar | Wrapper TourProvider |

## Fluxo Completo do Usuario

1. Usuario acessa "Campanhas" pela primeira vez
2. Tour automatico inicia destacando elementos principais
3. Ao criar campanha e acessar detalhes, novo tour inicia
4. Sistema guia: Lancamento -> Produtos -> Gastos
5. Apos completar, tour nao aparece novamente
6. Botao "?" permite reiniciar a qualquer momento

## Estimativa de Complexidade

| Tarefa | Complexidade |
|--------|--------------|
| Setup Driver.js + Provider | Media |
| Definicao dos 6 tours | Media |
| Adicionar data-tour nos componentes | Baixa |
| Estilizacao customizada | Baixa |
| Persistencia localStorage | Baixa |
| Testes e ajustes | Media |

## Beneficios

- Reducao de erros de usuarios
- Onboarding autonomo
- Experiencia profissional similar a bancos
- Menor carga de suporte/treinamento
- Acessivel a qualquer momento via botao "?"
