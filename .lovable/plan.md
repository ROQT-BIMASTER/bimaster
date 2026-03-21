

# Plano: Reduzir tamanho dos KPI Cards do Trade

## O que será feito

Compactar os 4 cards de "Visão Geral" (PDVs Ativos, Visitas, Fotos, Sell Out) reduzindo padding, tamanho de ícones, fontes e espaçamento interno.

## Alterações em `src/pages/modules/TradeModule.tsx`

Para cada um dos 4 cards (linhas 148-210):

| Propriedade | Atual | Novo |
|---|---|---|
| CardContent padding | `p-4 sm:p-5` | `p-3 sm:p-4` |
| Ícone container | `p-2 sm:p-2.5` | `p-1.5 sm:p-2` |
| Ícone tamanho | `h-5 w-5 sm:h-6 sm:w-6` | `h-4 w-4 sm:h-5 sm:w-5` |
| Margem do texto | `mt-3` | `mt-2` |
| Valor fonte | `text-2xl sm:text-3xl` | `text-xl sm:text-2xl` |
| Label fonte | `text-xs sm:text-sm` | `text-[11px] sm:text-xs` |

Nenhum arquivo novo. Apenas ajustes de classes CSS nos 4 cards existentes.

