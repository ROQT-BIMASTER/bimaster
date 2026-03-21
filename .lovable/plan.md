

# Plano: Carrossel de Displays na Visão Geral do Trade

## O que será feito

Criar um novo componente `DisplayHeroBanner` que funciona como carrossel das imagens dos displays ativos (da tabela `trade_displays`), com auto-slide de **7 segundos** e **pausa ao tocar/segurar** (touch hold e mouse down). Inserir logo abaixo do banner de banners existente no `TradeModule.tsx`.

## Novo componente

**`src/components/trade/displays/DisplayHeroBanner.tsx`**

- Busca displays ativos via `useActiveTradeDisplays()`
- Carrossel horizontal com transição slide, auto-avança a cada 7s
- **Pausa no toque**: `onTouchStart` / `onMouseDown` pausa o timer, `onTouchEnd` / `onMouseUp` retoma
- Setas de navegação no hover
- Dots indicadores
- Clique no display pode redirecionar para `/dashboard/trade/admin/displays`
- Cada slide mostra: foto do display com nome e categoria em overlay

## Alteração existente

**`src/pages/modules/TradeModule.tsx`**
- Importar `DisplayHeroBanner`
- Inserir logo após o `<TradeHeroBanner />` (linha 148), com um `TradeSectionHeader` "Catálogo de Displays"

## Nenhuma mudança no banco de dados

Reutiliza a tabela e hook `useActiveTradeDisplays` já existentes.

