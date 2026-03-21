

# Plano: Ajuste Mobile Profissional — Trade Marketing

## Problema identificado

O layout principal do DashboardLayout usa `p-6` fixo no container (`div.p-6` linha 126), que é excessivo em telas mobile. Além disso, vários componentes do Trade têm espaçamentos e tamanhos que não se adaptam bem a telas pequenas (< 400px).

## Ajustes (sem alterar funcionalidade ou design existente)

### 1. `src/components/dashboard/DashboardLayout.tsx`
- Reduzir padding do container principal em mobile: `p-4 sm:p-6` (linha 126)

### 2. `src/pages/modules/TradeModule.tsx`
- Header: reduzir padding mobile de `p-5` para `p-4` → `p-4 sm:p-6`
- Quick Actions: ajustar grid para `grid-cols-1` em mobile (já está, ok)
- KPI Cards: manter `grid-cols-2` mas ajustar gap → `gap-2 sm:gap-3`

### 3. `src/components/trade/banners/TradeHeroBanner.tsx`
- Ajustar altura do banner mobile: `h-36 sm:h-48` (era `h-40 sm:h-48`)

### 4. `src/components/trade/displays/DisplayHeroBanner.tsx`
- Ajustar altura mobile: `h-36 sm:h-52` (era `h-44 sm:h-52`)
- Reduzir padding do texto overlay: `bottom-2 left-3 right-3` em mobile

### 5. `src/components/trade/incentivos/IncentivosWeekSection.tsx`
- Banners: aspect ratio ajustado para mobile com `aspect-[2.5/1] sm:aspect-[3/1]`
- Cards grid: `gap-2 sm:gap-3`

### 6. `src/components/trade/incentivos/IncentivoCard.tsx`
- Reduzir padding mobile: `p-3 sm:p-4`
- Ícone menor em mobile: `text-xl sm:text-2xl`

### 7. `src/components/trade/LancamentosRecentes.tsx`
- Ajustar tamanho dos cards mobile: `min-w-[64px] max-w-[64px]` (era 72px)
- Imagem: `w-14 h-14 sm:w-16 sm:h-16`

## Arquivos alterados

| Arquivo | Tipo |
|---|---|
| `src/components/dashboard/DashboardLayout.tsx` | Editar (padding) |
| `src/pages/modules/TradeModule.tsx` | Editar (spacing) |
| `src/components/trade/banners/TradeHeroBanner.tsx` | Editar (altura) |
| `src/components/trade/displays/DisplayHeroBanner.tsx` | Editar (altura/padding) |
| `src/components/trade/incentivos/IncentivosWeekSection.tsx` | Editar (aspect/gap) |
| `src/components/trade/incentivos/IncentivoCard.tsx` | Editar (padding) |
| `src/components/trade/LancamentosRecentes.tsx` | Editar (tamanhos) |

