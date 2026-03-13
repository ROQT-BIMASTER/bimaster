

# Ajustes na Lista de Projetos — Estilo Monday.com

## O que a imagem mostra vs o que vocês têm

A imagem é do **Monday.com** e destaca 3 elementos visuais que o sistema atual não tem:

| Elemento Monday.com | Sistema atual | Ação |
|---|---|---|
| **Timeline** (barra de progresso horizontal colorida) | Não existe — só data de prazo | Adicionar coluna Timeline |
| **Prioridade** (estrelas 1-5) | Campo `prioridade` existe no BD (texto) mas não aparece na lista | Adicionar coluna com estrelas clicáveis |
| **Status com cores sólidas vibrantes** (verde "Feito", laranja "Em andamento", vermelho "Parado") | Badges com fundo translúcido (ex: `bg-emerald-500/15`) | Tornar badges mais sólidos e vibrantes |
| **Seções com borda lateral colorida** | Seções com chevron + progress bar mini | Adicionar borda lateral colorida por seção |

## Plano de Implementação

### 1. Coluna "Timeline" — barra de progresso visual
- Adicionar campo `data_inicio` na tabela `projeto_tarefas` (migração BD)
- Nova coluna na grid entre "Prazo" e "Prioridade"
- Renderiza uma **barra horizontal colorida** proporcional ao progresso temporal:
  - Cinza = período total (data_inicio → data_prazo)
  - Azul/roxo = tempo decorrido até hoje
  - Se atrasada: barra vermelha ultrapassando o fim
- Se não tem data_inicio, mostra barra cinza vazia (editável com click)

### 2. Coluna "Prioridade" — estrelas clicáveis
- O campo `prioridade` já existe no BD (string). Mapear: `baixa`=1★, `media`=2★, `normal`=3★, `alta`=4★, `urgente`=5★
- Renderizar **5 estrelas clicáveis** (amarelas preenchidas + cinzas vazias)
- Click em qualquer estrela atualiza imediatamente

### 3. Status badges mais vibrantes
- Trocar de fundo translúcido (`bg-emerald-500/15`) para **cores sólidas** com texto branco:
  - Concluída → `bg-emerald-500 text-white` (verde sólido "Feito")
  - Em andamento → `bg-amber-500 text-white` (laranja sólido)
  - Parado/Bloqueada → `bg-red-500 text-white` (vermelho sólido)
  - Não iniciado → `bg-gray-400 text-white`
- Mesma lógica para os badges de Estágio

### 4. Seções com borda lateral colorida
- Adicionar uma **borda esquerda de 3px colorida** em cada seção (azul, roxo, verde — alternando ou configurável)
- Título da seção em cor correspondente (como o Monday.com faz com "Este mês" em azul e "Próximo mês" em roxo)

### 5. Ajuste no grid
- Grid atual: 14 colunas (expand, check, nome, produto, sep, resp, data, colab, sep, criador, data_mod, sep, status, estágio)
- **Novo grid**: expand, check, nome, produto, sep, resp, status, **timeline**, prazo, **prioridade**
- Remover da vista principal: criador, data_mod, colaboradores (acessíveis no detalhe lateral)
- Resultado: **layout mais limpo** com 10 colunas, focado no essencial

### Arquivos afetados
- **Migração BD**: adicionar `data_inicio` em `projeto_tarefas`
- **ProjetoListView.tsx**: novo `GRID_COLS` com 10 colunas
- **ProjetoTarefaRow.tsx**: remover colunas pouco usadas, adicionar Timeline + Prioridade (estrelas), badges sólidos
- **ProjetoSecao.tsx**: borda lateral colorida + título colorido

### O que NÃO muda
- Todas as features existentes (briefing, cofre, ghost trails, kanban, cronograma, etc.)
- Colunas removidas da lista continuam acessíveis no painel lateral de detalhe
- Funcionalidade de inline editing, drag-and-drop, subtarefas

