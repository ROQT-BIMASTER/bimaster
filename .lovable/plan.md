

# Plano: Definir "White Clean" como tema padrão do menu

## O que será feito

Alterar o tema padrão do sidebar de `"navy-blue"` para `"white-clean"`, de modo que novos usuários (ou quem nunca escolheu tema) vejam o menu branco limpo por padrão.

## Alteração

| Arquivo | O que muda |
|---|---|
| `src/contexts/ThemeContext.tsx` | Trocar o fallback de `"navy-blue"` para `"white-clean"` na inicialização do estado (linha 252) |

Usuários que já escolheram um tema continuarão com a preferência salva no `localStorage`.

