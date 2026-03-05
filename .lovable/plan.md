

## Melhorar Legibilidade da Tabela de Tarefas

### Problema

A tabela de tarefas usa extensivamente `text-muted-foreground` e opacidades baixas (`opacity-60`, `/40`, `/50`), resultando em texto apagado — especialmente quando há cor de fundo customizada. Os badges de status também usam cores com baixa opacidade (`bg-pink-500/20 text-pink-400`).

### Mudanças Propostas

#### 1. `ProjetoTarefaRow.tsx`

- **Status badges**: Aumentar contraste — de `bg-X-500/20 text-X-400` para `bg-X-500/15 text-X-600` (light mode friendly)
- **Estágio badges**: Mesmo tratamento
- **Texto de data**: De `text-muted-foreground` para `text-foreground/70`
- **Texto do criador**: De `text-muted-foreground` para `text-foreground/70`  
- **Data de modificação**: De `text-muted-foreground` para `text-foreground/60`
- **Tarefas concluídas**: De `opacity-60` para `opacity-70`
- **Código da tarefa**: De `text-muted-foreground` para `text-foreground/60`
- **Bordas das linhas**: De `border-border/40` para `border-border/60`

#### 2. `ProjetoListView.tsx`

- **Cabeçalhos da tabela**: De `text-muted-foreground` para `text-foreground/60` com `font-semibold`
- **Fundo do header**: De `bg-muted/30` para `bg-muted/50`

#### 3. `ProjetoSecao.tsx`

- **Contador de tarefas**: De `text-muted-foreground` para `text-foreground/60`
- **Ghosts**: De `opacity-40` para `opacity-50`

#### 4. Suporte a cor de fundo customizada

Propagar `customBg` para `ProjetoListView` e aplicar `text-black` nos cabeçalhos e textos secundários quando ativo, garantindo contraste com fundos coloridos.

#### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/projetos/ProjetoTarefaRow.tsx` |
| Editar | `src/components/projetos/ProjetoListView.tsx` |
| Editar | `src/components/projetos/ProjetoSecao.tsx` |
| Editar | `src/pages/ProjetoDetalhe.tsx` (passar customBg) |

