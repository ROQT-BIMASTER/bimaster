

# Classificar Plano de Contas em Ordem Numérica pelo Código

## Problema

A ordenação atual usa sort textual do PostgreSQL (`ORDER BY code ASC`), que ordena lexicograficamente:
- `3.1.1` → `3.1.10` → `3.1.11` → `3.1.2` → `3.1.3` (errado)
- Correto: `3.1.1` → `3.1.2` → `3.1.3` → ... → `3.1.10` → `3.1.11`

## Solução

Adicionar uma função de ordenação numérica no frontend que separa cada segmento do código por `.` e compara numericamente.

### Arquivo: `src/pages/PlanoContas.tsx`

1. Criar função `naturalSortCode(a, b)` que divide o código por `.`, converte cada parte em número e compara segmento a segmento
2. Aplicar essa ordenação após buscar os dados e dentro de `buildHierarchy` para ordenar os filhos de cada nó
3. Aplicar também na aba de contas inativas

```text
Exemplo da função:
  "3.1.2"  → [3, 1, 2]
  "3.1.10" → [3, 1, 10]
  Comparação: 2 < 10 → "3.1.2" vem antes
```

| Arquivo | Mudança |
|---|---|
| `src/pages/PlanoContas.tsx` | Adicionar `naturalSortCode` e aplicar nos arrays de contas |

