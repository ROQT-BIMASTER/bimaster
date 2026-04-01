

# Melhorar Caixa de Entrada — Visual Premium e UX Refinada

## Problemas Atuais

- KPI cards são simples e sem personalidade visual (todos iguais)
- Empty state genérico e pouco convidativo
- Sem indicação visual de "tudo em dia" quando inbox está vazia
- Tabs sem contadores nas abas secundárias
- Falta de onboarding/dicas contextuais para usuários novos
- Header sem contexto temporal (ex: "Bom dia")

## Melhorias

### 1. KPI Cards Evoluídos
- Usar o componente `KpiCard` existente no sistema (consistência com Home e Minhas Tarefas)
- Adicionar 4o KPI: "Favoritas" com ícone estrela
- Gradientes sutis nos ícones, hover com elevação

### 2. Empty States Premium por Tab
- **Atividade vazia**: Ilustração de inbox limpa com mensagem motivacional "Tudo em dia! Nenhuma notificação pendente" + ícone animado (checkmark)
- **Menções vazia**: Ícone de @mention com texto contextual
- **Favoritas vazia**: Estrela com dica "Marque notificações importantes"
- **Arquivadas vazia**: Caixa com dica "Arquive para organizar"
- Cada empty state com cor e ícone únicos, animação fade-in

### 3. Header com Saudação e Contexto
- Saudação temporal: "Bom dia, João" com emoji contextual
- Subtítulo: "Você tem X notificações não lidas" ou "Tudo em dia!"
- Mover botão "Marcar todas como lidas" para posição mais visível

### 4. Tabs com Contadores
- Badge com contagem em cada tab (Menções: 2, Favoritas: 5, Arquivadas: 12)
- Highlight visual na tab com itens não lidos

### 5. Filtro por Tipo de Atividade
- Adicionar filtro por tipo (Tarefas criadas, Completadas, Comentários, Movidas)
- Chips visuais com ícones coloridos

### 6. Micro-interações
- Skeleton shimmer durante loading (substituir spinner simples)
- Animação fade-in-up nos cards ao aparecer
- Transição suave ao trocar tabs

## Alterações Técnicas

| Arquivo | Ação |
|---------|------|
| `ProjetoInbox.tsx` | Header com saudação, KPIs melhorados, filtro por tipo, contadores nas tabs |
| `ProjetoInboxFeed.tsx` | Skeleton loading, animações nos cards |
| `ProjetoInboxCard.tsx` | Polish visual menor (já está bom) |
| `useProjetoAtividades.ts` | Expor contagem de favoritas |

Zero migrations. Apenas refinamento visual e UX.

