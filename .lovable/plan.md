
# Remover KPI "Receita Total" do Painel de Municipios

## Contexto

O KPI "Receita Total" exibido no painel de Inteligencia Municipal nao representa receita real -- ele soma apenas o valor da ultima compra de cada cliente. Isso pode gerar interpretacoes erradas e nao agrega valor analitico ao dashboard.

## O Que Sera Feito

Remover o card "Receita Total" (R$ 5.2M) da barra de KPIs do modulo Comercial > Municipios. Os 5 KPIs restantes serao redistribuidos no grid.

## Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/comercial/municipios/MunicipiosKPICards.tsx` | Remover o objeto do card com `key: 'receita_total_municipios'` do array `cards`. Ajustar o grid de `xl:grid-cols-6` para `xl:grid-cols-5` para acomodar 5 cards. |

## Resultado

A barra de KPIs exibira apenas:
1. Total de Municipios
2. Municipios Atendidos
3. Taxa de Penetracao
4. Densidade Comercial Media
5. PIB Total Filtrado

Nenhuma alteracao no banco de dados ou nos hooks -- os dados continuam disponiveis caso sejam necessarios futuramente.
