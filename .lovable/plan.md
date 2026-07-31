# Linha Baunilha — novos percentuais de precificação

## Objetivo

Ajustar o cálculo de preços apenas para a linha **BAUNILHA** (8 produtos MELU), sem alterar as demais linhas.

## Regra nova (só Baunilha)

```text
Custo Fábrica
   └─ Clear      : 10%  (hoje 25%)
        └─ Mude      : 42%  (hoje 20%)
             └─ Primavera : 8%   (hoje 15%)
```

Demais tabelas (Deep, B2B, E-commerce) seguem a regra padrão.

## Como será feito

O sistema já suporta exceções por linha na precificação (prioridade: exceção por produto > exceção por linha > percentual padrão da tabela). Serão criadas 3 exceções ativas para a linha `BAUNILHA`:

- Tabela Clear → percentual 10
- Tabela Mude → percentual 42
- Tabela Primavera → percentual 8

Nenhuma alteração de código é necessária: o cálculo, a tela de gestão de exceções e o gerador de preços já leem essas regras.

## Detalhes técnicos

- Inserção de 3 registros em `fabrica_markup_overrides` (`linha = 'BAUNILHA'`, `tipo_markup = 'percentual'`, `ativo = true`), respeitando a restrição única `(tabela_id, linha, produto_id)`.
- Preços já gerados anteriormente não mudam sozinhos: será preciso rodar o gerador de preços para a linha Baunilha nas tabelas Clear, Mude e Primavera para materializar os novos valores.

## Verificação

- Conferir na tela de exceções de markup as 3 regras da linha Baunilha.
- Simular a cascata em um produto Baunilha e conferir 10% / 42% / 8%.
