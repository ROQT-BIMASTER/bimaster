

# Implementar Filtro de Visibilidade por Seções Marcadas

## Problema

As seções visíveis configuradas no dialog de membros (`projeto_membro_secoes`) **não são aplicadas em nenhum lugar**. Todos os membros veem todas as tarefas e seções, independentemente do que foi marcado.

Três pontos de falha:

1. **Área Pessoal (Minhas Tarefas / Home)**: `useMinhasTarefas` busca todas as tarefas onde `responsavel_id = user.id`, sem verificar se a seção da tarefa está entre as permitidas
2. **Detalhe do Projeto**: `useProjetoTarefas` carrega todas as seções e tarefas do projeto sem filtrar pelas seções permitidas ao membro atual
3. **Sem enforcement no backend**: Nenhuma RLS ou filtro server-side existe para restringir por seção

## Solução

### 1. `src/hooks/useMinhasTarefas.ts` — Filtrar tarefas pessoais por seções permitidas

- Após buscar as tarefas, consultar `projeto_membro_secoes` para o usuário atual
- Construir um mapa `projeto_id → Set<secao_id>` das seções permitidas
- Filtrar: se o membro tem seções configuradas (array não vazio) para um projeto, mostrar apenas tarefas cuja `secao_id` esteja na lista; se não tem configuração (0 seções marcadas = sem restrição), mostrar todas
- **Regra**: 0 seções marcadas = acesso total (coordenador/sem restrição); 1+ seções = acesso restrito

### 2. `src/hooks/useProjetoTarefas.ts` — Filtrar seções e tarefas no detalhe do projeto

- Buscar o membro atual (`projeto_membros` + `projeto_membro_secoes`) para o projeto em questão
- Se o membro tem seções configuradas (1+), filtrar:
  - `secoes` → apenas as seções permitidas
  - `tarefas` → apenas tarefas cujo `secao_id` está nas seções permitidas
- Coordenadores e admins veem tudo (0 seções = sem restrição)

### 3. `src/pages/ProjetoDetalhe.tsx` — Passar dados filtrados às views

- Nenhuma mudança estrutural necessária, pois as views já consomem `secoes` e `tarefas` do hook. A filtragem no hook resolve automaticamente.

### Lógica de negócio

```text
Se membro tem secoes_ids.length === 0 → vê TUDO (coordenador/sem restrição)
Se membro tem secoes_ids.length >= 1  → vê APENAS tarefas dessas seções
Se não é membro do projeto           → não vê nada (RLS existente já bloqueia)
```

## Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `src/hooks/useMinhasTarefas.ts` | Consultar seções permitidas e filtrar tarefas |
| `src/hooks/useProjetoTarefas.ts` | Filtrar seções e tarefas pelo membro atual |

## Resultado esperado

- Claudia Tiemi Nakano (0/6 seções marcadas) vê todas as tarefas do projeto
- Um membro com 2/6 seções marcadas vê apenas tarefas dessas 2 seções
- A área pessoal (Home + Minhas Tarefas) respeita o mesmo filtro
- Coordenadores e admins mantêm visão completa

