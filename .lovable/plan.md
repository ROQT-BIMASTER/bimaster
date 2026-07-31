# Linha Baunilha — percentuais de precificação em toda a hierarquia

## Objetivo

Registrar exceções de markup para a linha **BAUNILHA** em toda a cadeia de tabelas, sem alterar as demais linhas.

## Regra para a linha Baunilha

```text
Custo Fábrica
   └─ Clear        : 10%            (padrão hoje: 25%)
        ├─ Mude        : 42%        (padrão hoje: 20%)
        |     ├─ Primavera : 8%     (padrão hoje: 15%)
        |     └─ Deep      : x1,7   (igual ao padrão)
        |           └─ B2B     : x1,7 (igual ao padrão)
        └─ E-commerce : 300%        (igual ao padrão)
```

Observação de estrutura confirmada no sistema: Deep deriva de Mude, B2B deriva de Deep e E-commerce deriva de Clear. Assim, mesmo mantendo os fatores atuais em Deep, B2B e E-commerce, os preços finais mudam porque a base (Clear/Mude) muda.

## Como será feito

O cálculo já suporta exceções por linha (prioridade: exceção por produto > exceção por linha > percentual padrão da tabela). Serão criadas exceções ativas para `BAUNILHA`:

- Clear → percentual 10
- Mude → percentual 42
- Primavera → percentual 8
- Deep → multiplicador 1,7
- E-commerce → percentual 300
- B2B → multiplicador 1,7

Nenhuma alteração de código: cálculo, tela de exceções e gerador de preços já leem essas regras.

## Detalhes técnicos

- Inserção de 6 registros em `fabrica_markup_overrides` com `linha = 'BAUNILHA'`, `ativo = true`, respeitando a restrição única `(tabela_id, linha, produto_id)`.
- `tipo_markup`: `percentual` para Clear, Mude, Primavera e E-commerce; `multiplicador` para Deep e B2B.
- Preços já gerados não mudam sozinhos: é preciso rodar o gerador de preços para a linha Baunilha nas 6 tabelas, na ordem da hierarquia, para materializar os novos valores.

## Verificação

- Conferir as 6 exceções da linha Baunilha na tela de exceções de markup.
- Simular a cascata em um produto Baunilha e validar 10% → 42% → 8%, além de Deep x1,7, B2B x1,7 e E-commerce 300%.
