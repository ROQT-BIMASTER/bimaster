# Baunilha: preços manuais na tabela B2B (conferência antes de aplicar)

Leitura das anotações à caneta na coluna "Sugestão Preço - B2B" (07). Confirme os valores antes da aplicação.

| Produto | Código | B2B atual no sistema | B2B anotado (novo) |
|---|---|---|---|
| BODY SPLASH BAUNILHA | RR-B5306 | R$ 34,4905 | **R$ 39,99** |
| COLÔNIA BAUNILHA | RR-P8006 | R$ 61,8268 | **R$ 69,90** |
| CREME DE MÃOS BAUNILHA | RR-PA | R$ 12,8775 | **R$ 14,90** |
| HIDRATANTE LABIAL BAUNILHA | RR-L6534 | R$ 14,4826 | **R$ 14,90** |
| LOÇÃO CORPORAL BAUNILHA | RR-B5014 | R$ 22,5789 | **R$ 24,90** |
| SABONETE CORPORAL BAUNILHA | RR-B5109 | R$ 16,9213 | **R$ 14,99** |

Ponto de atenção: no sabonete a caneta parece indicar 14,99 (e não 14,90). Confirme.

## O que será feito após sua confirmação

1. Gravar os seis valores como **preço manual** na tabela B2B (07), apenas para os produtos da linha Baunilha.
2. Recalcular a margem exibida de cada linha em relação ao preço Deep (base da B2B).
3. Nenhuma outra tabela é alterada: Fábrica, Clear (+10%), Mude (+42%), Primavera (+8%), Deep (Primavera +30%) e E-commerce permanecem como estão.
4. Conferência final: reler a matriz e confirmar os seis preços gravados.

## Detalhes técnicos

- `UPDATE` em `fabrica_precos_produtos` para `tabela_id = 2339bcd5-058c-4a8b-8a2a-bd312d97256f` (B2B), setando `preco_manual` e `preco_final` com os valores acima e recalculando `margem_lucro_percentual` sobre `custo_base`.
- Como o preço passa a ser manual, o recálculo automático em cadeia preserva esses valores (o gatilho usa `COALESCE(preco_manual, preco_calculado)`).
