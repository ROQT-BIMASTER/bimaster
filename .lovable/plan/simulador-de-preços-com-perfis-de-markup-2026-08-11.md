# Simulador de Preços com Perfis de Markup

## Problema

Hoje existem duas regras de cálculo convivendo:

- Regra A: Clear 10% sobre o custo de fábrica, Mude 42%, Primavera 8%, Deep 1,7x
- Regra B: Primavera 30% (equivalente a markup 1,405 na cadeia)

Para testar 3 produtos novos não há um lugar seguro: cadastrar "produtos teste" no catálogo
polui a base, gera SKUs falsos e risco de virarem preço real. A solução ideal é um simulador
com produtos hipotéticos (nada é gravado no catálogo) e perfis de cálculo salvos e reutilizáveis.

## O que será construído

### 1. Perfis de markup salvos

Um cadastro simples de "perfis de cálculo". Cada perfil tem nome, descrição e uma lista de
linhas/tabelas com o tipo de markup (percentual, multiplicador, margem, valor fixo) e o valor.

Perfis iniciais já cadastrados:

```text
Perfil A — Padrão
  Clear      +10%   sobre custo fábrica
  Mude       +42%
  Primavera   +8%
  Deep       1,7x

Perfil B — Primavera 30%
  Primavera  +30%   (markup efetivo 1,405 na cadeia)
```

Perfis podem ser criados, duplicados e editados pelo próprio usuário — sem precisar de
alteração de sistema quando surgir uma terceira regra.

### 2. Produtos hipotéticos no simulador

Uma grade onde se digita direto: descrição do produto, valor e **em qual nível esse valor está**
(custo de fábrica, Clear, Mude, Primavera...). Quando o valor informado não é o custo de fábrica,
o simulador faz o cálculo reverso até a base e depois projeta os demais níveis — assim os preços
Clear já praticados podem ser usados como ponto de partida.

Pré-carregado para esta simulação (valores já em preço Clear):

```text
Corretivo   5,25
Pó          5,50
Blush       4,75
Base        9,00
```

Nada é gravado no catálogo de produtos; a simulação fica só na tela, com opção de salvá-la
como registro próprio, separado do catálogo. Também é possível importar o custo de um
produto existente como ponto de partida, sem criar vínculo.



### 3. Comparativo na tela

Tabela lado a lado: para cada produto hipotético, os preços resultantes em cada linha
(Clear, Mude, Primavera, Deep, ...) sob o Perfil A e sob o Perfil B, com a diferença em
R$ e em % entre os perfis, mais a margem sobre o custo. Destaque visual para a maior e a
menor diferença. Valores em `formatCurrency`, 4 casas onde houver alíquota/markup.

## Detalhes técnicos

- Migration: `fabrica_perfis_markup` (id, nome, descricao, ativo, created_by, timestamps) e
  `fabrica_perfis_markup_itens` (perfil_id, tabela_id ou nome_linha, tipo_markup, valor_markup,
  ordem). GRANTs para `authenticated`/`service_role` + RLS (leitura para autenticados,
  escrita para o criador e administradores). Seed dos dois perfis acima.
- Cálculo reaproveita `aplicarMarkup`/`simularCascata` de `src/lib/fabrica/cascataPricing.ts`,
  já testado — sem duplicar fórmula.
- Nova aba "Perfis e Produtos Hipotéticos" em `src/pages/SimuladorCenariosPrecos.tsx`,
  com componentes novos em `src/components/simulador/`: `PerfilMarkupSelector`,
  `ProdutosHipoteticosGrid`, `ComparativoPerfisTable`.
- Hook `usePerfisMarkup` para CRUD dos perfis; o cálculo é feito no cliente (sem RPC),
  já que nenhum dado do catálogo é alterado.
- Sem qualquer escrita em `fabrica_produtos`, `fabrica_precos` ou `fabrica_markup_overrides`.
- Bump de `APP_VERSION`.

## Fora de escopo nesta entrega

Promover a simulação a preço oficial e exportação Excel/PDF — podem ser adicionados depois
reutilizando o fluxo de aprovação de tabelas já existente.
