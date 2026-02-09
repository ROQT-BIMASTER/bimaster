
# Hierarquia em Lotes por Data e Estado na tela de Leads Minerados

## O Que Sera Feito

Adicionar um modo de visualizacao hierarquico na tela de Leads Minerados (tanto na pagina principal quanto no ResultsView do Modo Foco), agrupando os leads por **data de mineracao** e **estado (UF)**, usando componentes Accordion/Collapsible.

### Estrutura da Hierarquia

```text
07/02/2025 (32 leads)
  ES - Espirito Santo (25 leads)
    Distribuidora da Doda - (28) 99921-2131 - Rating 4.7  [Acoes]
    Atacado Mix Capixaba - (98) 4227-4443 - Rating 4.0    [Acoes]
    ...
  MG - Minas Gerais (5 leads)
    Cosmeticos do Vale - (31) 3846-7980 - Rating 4.6      [Acoes]
    ...
  AC - Acre (2 leads)
    ...
05/02/2025 (26 leads)
  RJ - Rio de Janeiro (26 leads)
    ...
```

### Funcionalidades

1. **Toggle de visualizacao**: Botao para alternar entre "Lista" (tabela flat atual) e "Lotes" (hierarquia agrupada por data/UF)
2. **Agrupamento por data**: Usa o campo `created_at` dos leads, formatando por dia (ex: "07/02/2025"). Cada grupo mostra a contagem de leads daquele lote
3. **Sub-agrupamento por UF**: Dentro de cada data, leads agrupados por estado com contagem
4. **Checkbox em todos os niveis**: Selecionar lote inteiro (data), estado inteiro, ou leads individuais
5. **Mesmas acoes**: Qualificar, Descartar, Converter em Prospect continuam disponiveis tanto individualmente quanto em lote
6. **Ordenacao**: Datas mais recentes primeiro, UFs em ordem alfabetica

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/comercial/municipios/ModoFocoDialog.tsx` | Adicionar toggle de view mode e logica de agrupamento no `ResultsView`, com Accordion por data e Collapsible por UF |

## Detalhes Tecnicos

- O agrupamento sera feito no frontend com `useMemo`, usando `date-fns/format` para agrupar `created_at` por dia
- Estrutura: `Record<string, Record<string, LeadMinerado[]>>` onde a chave externa e a data formatada e a interna e a UF
- Toggle entre modo "lista" (tabela atual) e modo "lotes" (hierarquia) usando um estado local `listMode: "table" | "batches"`
- Accordion do radix para niveis de data, Collapsible para niveis de UF
- Checkboxes em cada nivel propagam selecao para os filhos
- KPIs e barra de acoes em lote permanecem inalterados no topo
