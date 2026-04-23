

# Plano — Botão "Voltar" e melhorias em Contas Bancárias

## Escopo

Página: `src/pages/ContasBancarias.tsx` (rota `/dashboard/bancos`).

Hoje a página não tem navegação de retorno e o cabeçalho é solto, sem hierarquia clara dentro do módulo Financeiro. Os filtros funcionam, mas faltam métricas resumidas e o estado vazio é genérico.

## Mudanças

### 1. Cabeçalho com voltar + breadcrumb (obrigatório)
Substituir o bloco manual `<Landmark/> + h1 + Button` (linhas 178–186) pelo componente padrão `PageHeader` (`src/components/ui/page-header.tsx`), que já oferece:
- Breadcrumbs (`Financeiro` → `Contas Bancárias`)
- Ícone `Landmark` em badge
- Slot de `actions` para o botão "Nova Conta"
- Animação `animate-fade-in` consistente com o resto do app

```tsx
<PageHeader
  title="Contas Bancárias"
  description="Cadastro e gestão das contas bancárias da empresa"
  icon={Landmark}
  breadcrumbs={[
    { label: "Financeiro", href: "/dashboard/financeiro" },
    { label: "Contas Bancárias" },
  ]}
  actions={<Button onClick={openCreate}><Plus/> Nova Conta</Button>}
/>
```

O breadcrumb já inclui link clicável de retorno (`Financeiro`), atendendo ao pedido de "voltar" sem botão duplicado.

### 2. KPIs no topo (quick wins)
4 cards compactos acima dos filtros, calculados a partir de `contas`:
- Total de contas
- Ativas (verde)
- Inativas (cinza)
- Empresas distintas vinculadas

Sem nova query — tudo derivado via `useMemo`.

### 3. Estado vazio mais útil
Quando `contas.length === 0` (sem dado nenhum, não filtrado), mostrar empty-state com ícone `Landmark` esmaecido + CTA "Cadastrar primeira conta" chamando `openCreate()`. Manter mensagem atual quando o filtro zera o resultado.

### 4. Pequenos ajustes de UX
- Badge de status: usar `variant="secondary"` em "Inativa" (atualmente `ghost` que some no fundo).
- Tornar a coluna "Chave PIX" copiável: clique copia para clipboard com toast.
- Ordenar contas inativas no fim (mantendo alfabética dentro de cada grupo).
- `Input` de busca com `aria-label="Buscar contas"` (a11y).

### 5. Memória
Não aplicável — já existe padrão `PageHeader`; nenhuma nova convenção introduzida.

## Detalhes técnicos

- Arquivo único alterado: `src/pages/ContasBancarias.tsx`.
- Import novo: `PageHeader` de `@/components/ui/page-header`.
- Sem mudança de schema, RLS, edge function ou rota.
- Sem alteração de `App.tsx` (a rota já existe).

## Risco

Baixo. Mudança puramente apresentacional, contida em um arquivo, usando componente já existente no design system.

