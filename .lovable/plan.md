

# Melhorias Visuais no Módulo de Projetos

## Diagnóstico atual

Após análise do código e da tela, identifiquei estas oportunidades:

| Area | Problema | Impacto |
|------|----------|---------|
| Header do projeto | Ícone quadrado simples com letra, sem hierarquia visual | Aspecto genérico |
| Barra de progresso (HealthPanel) | Fina (2.5px), cores hardcoded (`bg-emerald-500`, `bg-blue-500`...) | Pouco destaque, fora do design system |
| Tabs | 9 abas em linha, ocupam muito espaço, sem destaque visual | Poluição visual, difícil scan |
| Área de conteúdo (Lista) | Sem card container, flutua no fundo | Falta de delimitação |
| Listagem de projetos | Tabela funcional mas sem hierarquia visual clara | Monótona |
| Botões de ação (Membros, IA, Lixeira) | Botões ghost pequenos, sem agrupamento | Se perdem no layout |

## Alterações propostas

### 1. Hero Header do Projeto
- Substituir o ícone quadrado+letra por um **hero banner** compacto (80px altura) com gradiente baseado na cor do projeto
- Nome do projeto em fonte maior (text-2xl) sobre o gradiente
- Descrição como subtitle translúcido
- Avatares dos membros empilhados à direita do header
- Botões de ação (Membros, Resumo IA, Lixeira) como icon-buttons agrupados em um container pill

### 2. Health Panel Premium
- Aumentar altura da barra para 4px com border-radius
- Substituir cores hardcoded por tokens semânticos (`bg-success`, `bg-warning`, `bg-destructive`)
- Adicionar KPI chips acima da barra: "12 tarefas · 8 concluídas · 2 atrasadas" em badges compactos
- Animação de entrada suave (fade-in)

### 3. Tabs Redesenhadas
- Agrupar as 9 abas em **2 grupos visuais** com separador sutil:
  - Trabalho: Lista, Quadro, Cronograma, Calendário
  - Gestão: Painel, Briefings, Equipe, Arquivos, Aprovações
- Usar ícones menores (h-3.5) sem label em telas menores
- Tab ativa com underline accent + background sutil em vez de pill

### 4. Container de Conteúdo
- Envolver o conteúdo de cada tab em um card com `bg-card rounded-xl border shadow-sm`
- Padding interno consistente
- Transição suave entre tabs (fade)

### 5. Listagem de Projetos (página `/projetos`)
- Adicionar **hover card** com preview: mini progress bar, 3 últimas tarefas, membros
- Linha do projeto com indicador lateral colorido (borda esquerda com cor do projeto)
- Status badge com dot animado para "Em andamento"

### 6. Kanban Visual Polish
- Cards com borda-esquerda colorida por estágio (já tem `ESTAGIO_ACCENT`)
- Sombra suave nos cards ao arrastar
- Counter badge no header de cada coluna

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `ProjetoHeader.tsx` | Hero banner + reorganizar botões + tabs agrupadas |
| `ProjetoHealthPanel.tsx` | Tokens semânticos + KPI chips + barra maior |
| `ProjetoDetalhe.tsx` | Card container para conteúdo + animação |
| `Projetos.tsx` | Borda colorida lateral + hover polish |
| `ProjetoKanbanView.tsx` | Card borders coloridas + counters |

## Resultado esperado

Visual premium, hierarquia clara, identidade por projeto (cor), consistência com o design system. Zero mudança funcional — apenas refinamento visual.

