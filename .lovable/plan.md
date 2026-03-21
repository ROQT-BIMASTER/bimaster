

# Plano: Carrinhos de Materiais abaixo do Catálogo de Displays

## O que será feito

Adicionar uma seção horizontal de scroll (mesmo estilo visual do "Lançamentos Recentes") logo abaixo do banner do Catálogo de Displays, mostrando os materiais ativos do trade para solicitação rápida. Cada card exibe a foto do material (ou ícone placeholder) e o nome truncado.

## Componente novo

### `src/components/trade/MateriaisCarousel.tsx`
- Usa `useActiveTradeMateriais()` para buscar materiais ativos
- Scroll horizontal com cards quadrados arredondados (mesmo padrão do `LancamentosRecentes`)
- Cada card: foto do material (`foto_url`) em div `w-14 h-14 sm:w-16 sm:h-16 rounded-2xl`, nome truncado abaixo
- Click no card abre link para solicitação ou página de materiais
- Loading: skeleton horizontal
- Vazio: não renderiza

## Integração

### `src/pages/modules/TradeModule.tsx`
- Importar `MateriaisCarousel`
- Inserir `<MateriaisCarousel />` logo após o `<DisplayHeroBanner />` (linha 139), dentro do mesmo bloco do catálogo de displays

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/trade/MateriaisCarousel.tsx` | Novo |
| `src/pages/modules/TradeModule.tsx` | Editar (adicionar componente) |

