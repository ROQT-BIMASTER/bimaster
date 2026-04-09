
# Tabela do Projeto — Ocupar Largura Total

## Problema
A div container na página de detalhe do projeto tem `max-w-7xl mx-auto` (linha 119 de `ProjetoDetalhe.tsx`), limitando o conteúdo a ~1280px e deixando espaço vazio nas laterais em telas maiores.

## Correção

### `src/pages/ProjetoDetalhe.tsx` — linha 119

Trocar:
```
<div className="p-6 max-w-7xl mx-auto space-y-5">
```
Por:
```
<div className="p-4 sm:p-6 space-y-5">
```

Remove o `max-w-7xl mx-auto` para que a tabela ocupe toda a largura disponível, e reduz o padding em mobile para aproveitar melhor o espaço.

Uma linha. Nenhuma outra alteração necessária.
