

# Agrupar Kit + Unidade na Aprovação de Fichas

## Contexto
Atualmente, cada produto tem sua ficha de custo submetida e revisada de forma independente. O usuário quer que, na tela da Diretoria (FichaRevisaoDiretoria), quando um Display/Kit e seu produto-filho (unidade) estiverem ambos pendentes, eles apareçam visualmente agrupados — da mesma forma que já aparece na listagem de Produtos Acabados.

## Solução

### 1. Buscar relacionamentos Kit → Filhos na tela da Diretoria
- Na `FichaRevisaoDiretoria.tsx`, adicionar uma query a `fabrica_produto_grade_itens` para construir o mapa `filho → pai` e `pai → filhos[]`.
- Usar esse mapa para reordenar `fichasFiltradas`, posicionando fichas de produtos-filhos imediatamente após a ficha do produto-pai (Display).

### 2. Renderizar fichas filhas com indentação visual
- Na tabela de fichas pendentes, detectar se a ficha pertence a um produto-filho.
- Se sim: aplicar indentação (`pl-8`), borda lateral azul (`border-l-2 border-l-blue-400`), fundo sutil (`bg-blue-50/30`), e ícone `Link2` com label "↳ Kit: [nome do pai]".
- Fichas de Display mantêm seu estilo atual.

### 3. Agrupar no FichaAnalisePanel
- No painel de análise, quando a ficha analisada for de um Display, buscar e exibir um resumo da ficha do produto-filho vinculado (se existir como pendente), com link para alternar entre elas.
- Adicionar uma seção "Produtos Vinculados" mostrando o custo total consolidado (Display + Unidade).

### 4. Mapa visual resultante (Diretoria)
```text
┌───────────────────────────────────────────────────────┐
│ HB 573 DISPLAY       | v2 | 01/03/2026 | R$ 45,00   │  ← normal
│   ↳ 🔗 HB 573       | v3 | 01/03/2026 | R$ 12,50   │  ← indentado, bg-blue
├───────────────────────────────────────────────────────┤
│ Outro Produto        | v1 | 28/02/2026 | R$ 8,00    │  ← normal
└───────────────────────────────────────────────────────┘
```

## Arquivos a Alterar
- **`src/pages/FichaRevisaoDiretoria.tsx`**: Query `fabrica_produto_grade_itens`, reordenar fichas, estilizar linhas filhas.
- **`src/components/fabrica/FichaAnalisePanel.tsx`**: Adicionar seção "Produtos Vinculados" mostrando ficha do filho/pai quando aplicável.

