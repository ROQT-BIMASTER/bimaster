

## Plan: Audit Trail with Users and Responsibilities in the Product Launch Panel

### What will be built

A new **"Trilha de Auditoria"** (Audit Trail) card in the `ProductLaunchPanel` showing the task's team members and their roles/responsibilities. This will display:

1. **Responsável** (task owner) with avatar + name
2. **Criador** (task creator) with avatar + name  
3. **Colaboradores** (collaborators) with avatars + names
4. **Subtarefas** summary showing each subtask's title, status, and assigned responsible person

### Technical approach

**File: `src/components/projetos/ProductLaunchPanel.tsx`**
- Add new props: `tarefa` (with responsavel, criador, colaboradores, subtarefas data)
- Add a new `Card` section at the bottom of the panel titled "Trilha de Auditoria"
- Display team members with `Avatar` components and role badges (Responsável, Criador, Colaborador)
- List subtarefas with their responsible person and status indicator (checkmark or circle)

**File: `src/components/projetos/TarefaFocusMode.tsx`**
- Pass the `tarefa` object (which already contains `responsavel`, `criador`, `colaboradores`, `subtarefas`) to `ProductLaunchPanel`

### UI structure

```text
┌─────────────────────────┐
│ 👤 Trilha de Auditoria  │
├─────────────────────────┤
│ Responsável             │
│  [Avatar] Nome          │
│                         │
│ Criador                 │
│  [Avatar] Nome          │
│                         │
│ Colaboradores           │
│  [Av] [Av] [Av]        │
│                         │
│ ── Subtarefas ───────── │
│ ● Subtarefa 1  [Avatar] │
│ ✓ Subtarefa 2  [Avatar] │
└─────────────────────────┘
```

### Changes summary
- **Edit** `ProductLaunchPanel.tsx`: Add `tarefa` prop, new audit trail card with team + subtask listing
- **Edit** `TarefaFocusMode.tsx`: Pass `tarefa` to the panel

