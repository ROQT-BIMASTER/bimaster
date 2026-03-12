

## Plano: Painel de Performance Individual no estilo da tela principal

O painel lateral (Sheet) ao clicar no membro será redesenhado para replicar o layout da tela "Minha Equipe", mas focado na performance individual.

### Layout do novo painel

```text
┌─────────────────────────────────┐
│  ← Foto grande + Nome + Cargo  │  (header com gradiente)
│     Email                       │
├─────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │  KPI cards idênticos
│ │Proj. │ │Taref.│ │Concl.│ │Atras.│ │  ao topo da tela principal
│ │Ativos│ │Total │ │      │ │      │ │  (mesmos ícones/cores)
│ └──────┘ └──────┘ └──────┘ └──────┘ │
├─────────────────────────────────┤
│  Score de Produtividade         │  Card destaque amber
│  XX pts                         │
├─────────────────────────────────┤
│  Detalhes de Tarefas            │  Card com lista de métricas
│  ─ Concluídas: X de Y          │  estilo linhas com ícones
│  ─ Atrasadas: X                 │  e progress bar
│  ─ Taxa: XX%                    │
│  ─ Progresso geral [████░░]    │
├─────────────────────────────────┤
│  Ranking na Equipe              │  Posição no ranking + score
│  #X de Y membros                │  comparado com o top
└─────────────────────────────────┘
```

### Implementação

**Arquivo:** `src/pages/ProjetosMinhaEquipe.tsx`

Redesenhar o componente `MemberDetailSheet` (linhas 139-256):

1. **Header**: Manter foto grande centralizada + nome + badge + email (já existente, manter)
2. **KPI Cards (grid 2x2)**: Usar os mesmos ícones e cores da tela principal:
   - `FolderKanban` (indigo) = Projetos Ativos
   - `ClipboardList` (blue) = Total Tarefas
   - `CheckCircle2` (green) = Concluídas
   - `AlertTriangle` (destructive) = Atrasadas
3. **Score card**: Manter o destaque amber (já existente)
4. **Seção de progresso detalhado**: Progress bar com labels + breakdown textual
5. **Ranking na equipe**: Receber `allMembers` como prop, calcular posição do membro no ranking e exibir "Xº de Y membros"

Mudanças na prop: `MemberDetailSheet` receberá `allMembers: ProjetoTeamMember[]` para calcular a posição no ranking.

