

# Ajustar Contraste de Elementos no Painel (Dark Mode)

## Problema
No Painel do projeto (aba "Painel"), os badges de porcentagem nos cards de membros e os badges de status nas tarefas sem responsável estão com texto quase invisível contra o fundo escuro. O `Badge variant="outline"` usa cores que não contrastam com o background dark.

## Correção

### `src/components/projetos/ProjetoEquipeDashboard.tsx`

1. **Badge de porcentagem** (linha 218) — Adicionar classes de contraste quando `darkBg`:
   - De: `<Badge variant="outline" className="text-xs">`
   - Para: `<Badge variant="outline" className={cn("text-xs", darkBg && "border-white/30 text-white")}>`

2. **Badge de status nas tarefas sem responsável** (linha 280) — Mesmo ajuste:
   - De: `<Badge variant="outline" className="text-[9px] h-4 px-1">`
   - Para: `<Badge variant="outline" className={cn("text-[9px] h-4 px-1", darkBg && "border-white/30 text-white")}>`

Duas linhas. Nenhuma outra alteração necessária.

| Arquivo | Alteração |
|---------|-----------|
| `src/components/projetos/ProjetoEquipeDashboard.tsx` | Ajustar contraste dos Badges para dark mode |

