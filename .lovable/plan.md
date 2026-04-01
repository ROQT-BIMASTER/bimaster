

# Melhorar Caixa de Entrada — De Simples para Profissional

## Diagnóstico

A Inbox atual tem: lista flat de notificações, tabs vazias (Menções/Arquivadas), cards com texto simples sem contexto visual, sem filtros, sem preview de conteúdo, sem agrupamento por projeto.

## Melhorias Propostas

### 1. Header Premium com Estatísticas
- KPI strip: "12 não lidas", "3 menções", "5 hoje" com ícones coloridos
- Filtro rápido por projeto (dropdown multi-select) e por tipo de atividade
- Busca inline por texto nas notificações

### 2. Cards Ricos com Contexto Visual
- Barra lateral colorida com a cor do projeto (como Asana)
- Preview do conteúdo: se comentou, mostrar trecho do comentário; se completou tarefa, mostrar nome da tarefa em destaque
- Ícone de tipo mais proeminente com background circular colorido
- Badge de prioridade quando a tarefa associada for urgente/alta
- Timestamp relativo + nome do projeto com cor, tudo mais legível

### 3. Painel de Detalhe (Split View)
- Ao clicar numa notificação, abrir painel lateral direito com detalhes completos em vez de navegar para o projeto
- Mostrar: tarefa completa, comentários recentes, timeline de ações, botão "Ir para o projeto"
- Permite consumir notificações sem sair da Inbox

### 4. Agrupamento Inteligente
- Além do agrupamento temporal (Hoje/Ontem/7 dias), opção de agrupar por **Projeto**
- Toggle entre "Por tempo" e "Por projeto" no header
- Cada grupo de projeto mostra ícone colorido e contagem

### 5. Tabs Funcionais
- **@Menções**: Filtrar atividades onde `tipo = 'comentou'` e o texto contenha o nome do user ou `@mention`
- **Arquivadas**: Adicionar campo `arquivada` na tabela `projeto_atividades` e permitir arquivar/desarquivar com swipe ou botão
- **Favoritas**: Nova tab para notificações marcadas com estrela (campo `favorita`)

### 6. Ações em Lote
- Checkbox em cada card para seleção múltipla
- Barra de ações flutuante: "Marcar como lidas", "Arquivar", "Favoritar" em batch
- Select all / deselect all

### 7. Empty States Premium
- Ilustrações SVG customizadas para cada tab vazia
- Sugestões contextuais ("Crie uma tarefa para começar a receber notificações")

## Alterações Técnicas

| Recurso | Ação |
|---------|------|
| 1 Migration SQL | Adicionar `arquivada`, `favorita` em `projeto_atividades` |
| `ProjetoInbox.tsx` | Refatorar com header premium, filtros, split view |
| `ProjetoInboxCard.tsx` | Cards ricos com barra de cor, preview, badges |
| `ProjetoInboxFeed.tsx` | Agrupamento dual (tempo/projeto), seleção múltipla |
| Novo: `ProjetoInboxDetail.tsx` | Painel lateral de detalhe |
| `useProjetoAtividades.ts` | Suporte a filtros, arquivadas, favoritas |

