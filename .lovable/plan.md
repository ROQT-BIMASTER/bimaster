

## Plano: Cards de Projeto com Progresso (estilo dashboard de produção)

Redesenhar os cards da tela de Projetos inspirados na imagem de referência, com métricas de progresso em tempo real e status visual.

### Layout do Card

```text
┌─ cor do projeto (barra superior 4px) ─────────────────┐
│                                                        │
│  [Ícone]  Nome do Projeto            ⊙ On Track / ⚠  │
│                                                        │
│  Tarefas                    Conclusão                  │
│  24 /42 tarefas             57%                        │
│  [████████████░░░░░░░░] ← barra progresso              │
│                                                        │
│  👤👤👤 +2    Criado em 12/03/2026                     │
│                                                        │
│  [⋮ menu]                                              │
└────────────────────────────────────────────────────────┘
```

### Dados

Query agregada para cada projeto via `projeto_tarefas`:
- Total de tarefas (excluindo deletadas: `excluida_em IS NULL`)
- Tarefas concluídas (`status = 'concluida'`)
- Tarefas atrasadas (`data_prazo < now() AND status != 'concluida'`)
- Membros do projeto via `projeto_membros` com join em `profiles` para avatares

Status calculado automaticamente:
- **Concluído** (verde): `status = 'finalizado'` no projeto ou 100% tarefas concluídas
- **Atrasado** (vermelho): tem tarefas atrasadas
- **No Prazo** (verde): sem atrasos
- **Em Andamento** (azul): padrão

### Finalização de Projeto

Adicionar opção "Finalizar Projeto" no dropdown menu do card. Atualiza `projetos.status` para `'finalizado'`. Cards finalizados exibem badge verde "Concluído" e barra de progresso 100%.

### Implementação

**Arquivo:** `src/pages/Projetos.tsx`
1. Nova query para buscar contagens de tarefas por projeto (uma query agregada)
2. Query para membros por projeto com avatares
3. Redesenhar cards com: barra de progresso, contadores, avatar stack, status badge
4. Adicionar "Finalizar Projeto" ao dropdown menu (chama `supabase.update` no status)

**Arquivo:** `src/hooks/useProjetos.ts`
5. Adicionar mutation `finalizarProjeto` para atualizar status para `'finalizado'`

