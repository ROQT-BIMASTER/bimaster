

# Atualizar Versao, Corrigir Despacho e Adicionar Manual

## Problemas Identificados

### 1. Bug critico no Despacho: `nome_completo` nao existe na tabela `profiles`

O hook `useChinaFichaVisibilidade.ts` consulta `profiles.nome_completo` (linhas 34 e 112), mas a coluna real chama-se `nome`. Resultado: todos os nomes aparecem como "—", impossibilitando identificar usuarios no seletor de destino e no historico de despachos. Este e o motivo pelo qual o despacho "nao funciona" — o usuario nao consegue ver quem selecionar.

### 2. Versao desatualizada

Atualizar de `2.14.0` para `2.15.0`.

### 3. Manual inexistente no topo da tela

A tela de Ficha Produto China ja usa `ManualFabricaDrawer`, mas outras telas de despacho e projetos nao tem manual. O pedido e para colocar um manual com passo a passo no topo.

---

## Plano

### Fase 1 — Corrigir despacho (bug critico)

**Arquivo:** `src/hooks/useChinaFichaVisibilidade.ts`
- Linha 34: trocar `nome_completo` por `nome`
- Linha 43: trocar `nome_completo` por `nome`
- Linha 112: trocar `nome_completo` por `nome`
- Linha 115: trocar `nome_completo` por `nome`

Isso corrige imediatamente: lista de usuarios no seletor de destino, historico de despachos com nomes reais.

### Fase 2 — Atualizar versao

**Arquivo:** `src/lib/version.ts`
- Alterar `APP_VERSION` para `2.15.0`

### Fase 3 — Adicionar Manual no topo

**Arquivo:** `src/pages/ChinaFichaProduto.tsx`
- O manual ja existe via `ManualFabricaDrawer` na screen `china-ficha-produto`. Verificar se o conteudo do manual cobre o passo a passo de despacho.

**Arquivo:** `src/components/fabrica/ManualFabricaDrawer.tsx`
- Atualizar o conteudo da screen `china-ficha-produto` para incluir passo a passo completo de:
  1. Como despachar uma ficha para um modulo
  2. Como selecionar usuario destino
  3. Como adicionar observacoes/instrucoes
  4. Como verificar historico de despachos
  5. Como conceder visibilidade a outros usuarios

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/hooks/useChinaFichaVisibilidade.ts` | Fix `nome_completo` → `nome` (4 ocorrencias) |
| `src/lib/version.ts` | Bump para 2.15.0 |
| `src/components/fabrica/ManualFabricaDrawer.tsx` | Expandir manual com passo a passo de despacho |

