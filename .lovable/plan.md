

# Plano: Seção "Lançamentos Recentes" na Home do Trade

## O que será feito

Adicionar uma seção horizontal abaixo dos botões de ação rápida, no estilo da imagem de referência (Méliuz "Lojas Visitadas"), mostrando as visitas recentes do usuário logado. Cada item exibe a foto principal da visita (ou ícone placeholder) e o primeiro nome da loja (store name).

## Design visual (referência Méliuz)

- Scroll horizontal com cards quadrados arredondados (ícones/fotos)
- Nome da loja truncado abaixo
- Data ou status como subtexto
- Título "Lançamentos Recentes" com `TradeSectionHeader`

## Dados

Query nas tabelas existentes, filtrada por `user_id = auth.uid()`:
1. `visits` — últimas 10 visitas do usuário, ordenadas por `created_at DESC`, com join em `stores(name)`
2. Para cada visita, buscar 1 foto da tabela `photos` onde `visit_id` = visita, pegar `photo_url` ou `thumbnail_url`

Alternativa mais eficiente: uma única query com subquery/join lateral. Na prática, buscar visitas com store name e depois fotos em batch.

## Alterações

### 1. `src/pages/modules/TradeModule.tsx`
- Adicionar a nova seção `<LancamentosRecentes />` entre os quick-actions (linha 115) e o `TradeHeroBanner` (linha 126)

### 2. `src/components/trade/LancamentosRecentes.tsx` (novo)
- Hook interno com `useQuery` que:
  - Busca últimas 10 visitas do usuário logado: `visits` com `select("id, scheduled_date, status, store:stores(name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(10)`
  - Busca fotos dessas visitas: `photos` com `select("visit_id, photo_url, thumbnail_url").in("visit_id", visitIds).limit(10)` (1 foto por visita)
- Renderiza scroll horizontal com cards arredondados:
  - Foto (thumbnail_url ou photo_url) em div quadrada com `rounded-2xl`, ou ícone `Store` como fallback
  - Primeiro nome da loja truncado
  - Data formatada
- Loading: skeleton cards horizontais
- Vazio: não renderiza a seção

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/trade/LancamentosRecentes.tsx` | Novo |
| `src/pages/modules/TradeModule.tsx` | Editar — importar e posicionar componente |

