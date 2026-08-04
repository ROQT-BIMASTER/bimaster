# Corrigir preços do TONICO FACIAL BASICS (HB 451)

As exceções de markup do produto já estão gravadas com a regra da linha Baunilha, mas os preços exibidos na Matriz Comparativa são de 31/07 — anteriores à mudança — e por isso Deep aparece igual à Primavera e B2B com 8%.

## O que será feito

Recalcular e regravar os preços do HB 451 seguindo exatamente a hierarquia Baunilha:

| Tabela | Regra | Base | Preço |
|---|---|---|---|
| Fábrica | custo | — | 2,6455 |
| Clear | +10% | Fábrica | 2,9100 |
| Mude | +42% | Clear | 4,1322 |
| Primavera | +8% | Mude | 4,4628 |
| Deep | +30% | Primavera | 5,8016 |
| E-commerce | +300% | Clear | 11,6400 |
| B2B | 1,7x | Deep | 9,8628 |

Também será atualizada a margem de cada linha para refletir a nova base de cálculo.

## Verificação

Após a atualização, conferir na Matriz Comparativa de Preços (busca "hb451") se Deep mostra R$ 5,8016 com 30%, E-commerce R$ 11,64 com 300% e B2B R$ 9,8628 com 1,7x.

## Detalhes técnicos

- Atualização de dados em `fabrica_precos_produtos` para o produto `1a389106…` nas tabelas Deep (04), E-commerce (05) e B2B (07), ajustando `custo_base`, `preco_calculado`, `preco_final` e `margem_lucro_percentual`.
- Nenhuma alteração de schema ou de código: o gerador (`pricing-calculator.ts`) e o gatilho de cascata já respeitam `tabela_base_id` e `tipo_markup` das exceções; o problema era apenas o valor persistido desatualizado.
