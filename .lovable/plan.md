
# Modo Foco: Municipios Inexplorados com Hierarquia e Mineracao

## O Que Sera Feito

### 1. Botao "Modo Foco" no card Top 10 Oportunidades

Adicionar um botao no header do `MunicipiosOpportunityCard` que, ao clicar, abre um dialog/drawer em tela cheia (ou quase cheia) com todos os municipios inexplorados (status "virgem"), organizados em hierarquia de regioes.

### 2. Dialog "Modo Foco" com hierarquia de regioes

O dialog exibira todos os municipios inexplorados organizados em uma arvore colapsavel:

```text
Regiao Norte
  AC - Acre
    Municipio 1 (Pop: X | PIB/Capita: Y)  [Minerar]
    Municipio 2 ...                         [Minerar]
  AM - Amazonas
    ...
Regiao Nordeste
  BA - Bahia
    ...
```

- Cada regiao e um Accordion/Collapsible com contagem de municipios inexplorados
- Dentro de cada regiao, agrupamento por UF (tambem colapsavel)
- Cada municipio mostra: nome, populacao, PIB/Capita, microrregiao
- Barra de busca no topo do dialog para filtrar municipios
- KPIs resumidos no topo: total inexplorados, por regiao

### 3. Botao "Minerar" por municipio

Ao lado de cada municipio inexplorado, um botao "Minerar" que:
- Abre um mini-dialog de confirmacao com campo de query pre-preenchido (ex: "distribuidora alimentos {cidade} {UF}")
- Chama a Edge Function `google-places-search` existente, passando a cidade e UF
- Mostra feedback de progresso e resultado (quantos leads encontrados)
- Opcao de "Minerar em lote" selecionando multiplos municipios

### 4. Busca de todos os municipios inexplorados

Nova query no hook (ou query dedicada no dialog) que busca TODOS os municipios virgem sem limite de paginacao, agrupados por regiao e UF, usando a RPC existente `fn_get_municipios_intelligence` com `p_status: 'virgem'` e limite alto (5000+).

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/comercial/municipios/MunicipiosOpportunityCard.tsx` | Adicionar botao "Modo Foco" no header |
| Novo: `src/components/comercial/municipios/ModoFocoDialog.tsx` | Dialog principal com hierarquia de regioes, busca, e botoes de mineracao |
| `src/hooks/useMunicipiosIntelligence.ts` | Adicionar query para buscar todos os municipios virgem (sem limite de 10) |
| `src/lib/constants/regioes.ts` | Reutilizar constantes de regioes/UFs existentes |

## Detalhes Tecnicos

- O dialog usara `Dialog` do radix em tela grande (`max-w-5xl`)
- A hierarquia sera construida com `Accordion` (regioes) e `Collapsible` (UFs) do radix
- A busca de todos os municipios virgem usara a mesma RPC existente mas com `p_limit: 5000` e `p_offset: 0`
- Os dados serao agrupados no frontend por `regiao_nome` e `uf_sigla` usando `REGIOES_UFS`
- O botao "Minerar" reutiliza a logica de `useLeadMining` (chamada a `google-places-search`) passando `cidade` e `uf` como parametros
- Mineracao em lote: selecionar varios municipios com checkboxes e disparar mineracao sequencial com barra de progresso
