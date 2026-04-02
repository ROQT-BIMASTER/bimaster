

# Importar Atividades do Asana + Timeline Unificada

## O que falta hoje

O sync atual só importa stories do tipo `comment`. As atividades do Asana (mudanças de status, campo customizado, estágio, duplicação, etc.) são descartadas pelo filtro. Além disso, o sistema não tem uma view unificada "Comentários + Atividades" como a do Asana (screenshot).

## Plano

### 1. Importar stories de sistema do Asana como atividades

No `supabase/functions/asana-sync/index.ts`, após o loop de comentários, adicionar um segundo loop para stories que **não** são comentários (system activities):

- Filtrar stories onde `type === "system"` ou `resource_subtype` é um dos tipos conhecidos: `added_to_project`, `moved`, `enum_custom_field_changed`, `marked_duplicate`, `section_changed`, etc.
- Mapear para `projeto_tarefa_atividades` com:
  - `tipo`: derivado do `resource_subtype` (ex: `enum_custom_field_changed` → `estagio_change` ou `status_change`)
  - `descricao`: `story.text` (ex: "Luana modificou Estágio para Lançamento")
  - `campo`: extraído do subtype quando possível
  - `valor_novo`: extraído do texto quando possível
  - `user_id`: mapeado via `userMap`
  - `created_at`: `story.created_at`
  - `projeto_id`: do projeto local
- Deduplicar via `asana_sync_mappings` com `entity_type = "activity"`

### 2. Criar componente de Timeline Unificada (Comentários + Atividades)

Novo componente `ProjetoTarefaTimeline.tsx` que combina:
- Dados de `projeto_tarefa_comentarios` (comentários)
- Dados de `projeto_tarefa_atividades` (atividades/mudanças)
- Mesclados e ordenados por `created_at` desc
- UI com tabs "Comentários" | "Todas as atividades" como no screenshot do Asana
- Comentários: avatar + nome + texto + data
- Atividades de sistema: ícone contextual + "Fulano modificou X para Y" com badge colorido no valor novo
- Estilo visual similar ao screenshot: fundo escuro, linha do tempo vertical, badges de valor

### 3. Integrar no detalhe da tarefa

Substituir/complementar o `ProjetoAtividadesLog` existente com o novo componente unificado no drawer/modal de detalhe da tarefa.

## Detalhes Técnicos

```text
Asana story (type=system, resource_subtype=enum_custom_field_changed)
  → text: "Luana modificou Estágio para Lançamento"
  → INSERT projeto_tarefa_atividades (tipo=estagio_change, descricao=text, ...)
  → dedup via asana_sync_mappings (entity_type=activity, asana_gid=story.gid)

UI:
  Tab "Comentários" → query projeto_tarefa_comentarios
  Tab "Todas as atividades" → merge comentários + atividades, sort by created_at
```

### Mapeamento de subtypes Asana → tipos locais

| resource_subtype | tipo local |
|---|---|
| `enum_custom_field_changed` | campo customizado (detectar por texto) |
| `section_changed` / `added_to_project` | `secao_change` |
| `marked_duplicate` | `sistema` |
| `assigned` / `reassigned` | `responsavel_change` |
| `due_date_changed` | `prazo_change` |
| outros | `sistema` (genérico, com `descricao = story.text`) |

### Arquivos a alterar/criar

| Arquivo | Ação |
|---|---|
| `supabase/functions/asana-sync/index.ts` | Adicionar loop de importação de system stories |
| `src/components/projetos/ProjetoTarefaTimeline.tsx` | Novo componente com tabs Comentários / Todas as atividades |
| Componente de detalhe da tarefa | Integrar o novo timeline |

