# Baunilha: Deep passa a derivar da Primavera (+30%)

## Situação atual (verificada no banco)

- Hierarquia padrão das tabelas: Fábrica → Clear → Mude → (Primavera, Deep x1,7) → B2B (Deep x1,7); E-commerce deriva da Clear.
- As exceções por linha ficam em `fabrica_markup_overrides`, que hoje só permite trocar **tipo e valor de markup** — não permite trocar a **tabela base**. Baunilha tem 6 exceções ativas (Clear 10%, Mude 42%, Primavera 8%, Deep x1,7, B2B x1,7, E-commerce 300%).

Ou seja: para "Deep = Primavera +30%" apenas na linha Baunilha, é preciso permitir base alternativa por linha.

## O que será feito

1. **Base alternativa por exceção**: adicionar o campo de tabela base nas exceções de markup, opcional. Quando preenchido, o cálculo usa essa base no lugar da base padrão da tabela.
2. **Cálculo em cascata**: atualizar a rotina de recálculo para respeitar a base alternativa, mantendo a ordem correta (a base precisa estar calculada antes da dependente). Linhas sem exceção continuam exatamente como hoje.
3. **Exceção da Baunilha**: Deep passa a ser **Primavera + 30%** (substitui o multiplicador 1,7 sobre a Mude).
4. **Materialização**: recalcular e gravar os preços da Deep para os produtos da linha Baunilha, na ordem Fábrica → Clear (+10%) → Mude (+42%) → Primavera (+8%) → Deep (+30%).
5. **B2B**: os preços atuais da B2B para Baunilha **não serão recalculados** nesta etapa — ficam congelados aguardando a tabela de preços que você vai enviar por foto.
6. **Conferência**: comparar antes/depois dos 8 produtos Baunilha e reportar a matriz final por tabela.

## Detalhes técnicos

- Migração: nova coluna `tabela_base_id` (nullable, FK para `fabrica_tabelas_preco`) em `fabrica_markup_overrides`; ajuste na função `recalcular_precos_cascata()` para resolver base efetiva = override.tabela_base_id ?? tabela.tabela_base_id.
- Dados: `UPDATE` na exceção Baunilha/Deep para `tipo_markup='percentual'`, `valor_markup=30`, base = Tabela Primavera; seguido de `UPDATE` dos registros de `fabrica_precos_produtos` da Deep para os produtos da linha.
- Nenhuma alteração de UI é necessária; a matriz comparativa lê os preços materializados.
