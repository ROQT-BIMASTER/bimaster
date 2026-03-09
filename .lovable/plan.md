

# Plano: Membros de Projeto + Visibilidade por Seção

## Resumo

Criar sistema de membros por projeto com controle granular: definir quais membros podem visualizar cada seção (e suas tarefas). Um projeto só é visível para quem o criou ou é membro. Dentro do projeto, cada membro só vê as seções às quais foi vinculado.

## Arquitetura de Dados

```text
┌──────────────────────────────────┐
│ projeto_membros (NOVA)           │
│ ├── id (uuid, PK)               │
│ ├── projeto_id (FK → projetos)  │
│ ├── user_id (uuid, NOT NULL)    │
│ ├── papel ('coordenador'|'membro') │
│ ├── created_at                  │
│ └── UNIQUE(projeto_id, user_id) │
├──────────────────────────────────┤
│ projeto_membro_secoes (NOVA)    │
│ ├── id (uuid, PK)               │
│ ├── membro_id (FK → projeto_membros) │
│ ├── secao_id (FK → projeto_secoes)   │
│ └── UNIQUE(membro_id, secao_id)      │
└──────────────────────────────────┘
```

O criador do projeto tem papel 'coordenador' e vê todas as seções automaticamente.

## Migração SQL

1. Criar tabela `projeto_membros` com RLS
2. Criar tabela `projeto_membro_secoes` com RLS
3. Criar função `user_can_access_projeto(uuid, uuid)` — security definer, retorna true se criador ou membro
4. Criar função `user_can_access_secao(uuid, uuid)` — security definer, retorna true se coordenador do projeto OU tem registro em `projeto_membro_secoes`
5. Atualizar RLS de `projetos` (SELECT): `user_can_access_projeto(auth.uid(), id)`
6. Atualizar RLS de `projeto_secoes` (SELECT): `user_can_access_secao(auth.uid(), id)`
7. Atualizar RLS de `projeto_tarefas` (SELECT): herda acesso via seção
8. Inserir criador como membro 'coordenador' para projetos existentes
9. Manter INSERT/UPDATE/DELETE com políticas adequadas

## Implementação Frontend

### 1. Hook `useProjetoMembros`
- CRUD de membros do projeto (adicionar/remover)
- Listar membros com perfil (nome, avatar)
- Gerenciar seções visíveis por membro
- Apenas coordenador pode gerenciar

### 2. Dialog/Popover de Membros (`ProjetoMembrosDialog`)
- Botão "Membros" no `ProjetoHeader`
- Lista membros atuais com avatar, nome e papel
- Busca de usuários do sistema (tabela profiles) para adicionar
- Para cada membro: checkboxes das seções que ele pode visualizar
- Coordenador vê tudo por padrão (não editável)

### 3. Ajuste na Criação de Projeto (`useProjetos`)
- Após criar projeto, inserir automaticamente o criador como membro 'coordenador'

### 4. Ajuste na Listagem (`useProjetos`)
- A query `SELECT *` já será filtrada pelo RLS atualizado — nenhuma mudança no código necessária

### 5. Ajuste nas Seções (`ProjetoListView` / `useProjetoTarefas`)
- As seções e tarefas já serão filtradas pelo RLS — membros só verão seções permitidas

## Fluxo do Coordenador

```text
1. Abre projeto → clica "Membros"
2. Adiciona usuário → seleciona papel (membro)
3. Marca quais seções o membro pode ver
   ☑ Criação
   ☑ Regulatório
   ☐ Financeiro
   ☐ Embalagem
4. Salva → membro passa a ver apenas Criação e Regulatório
```

## Arquivos Impactados

- **Migração SQL**: 2 tabelas novas, 2 funções, RLS atualizado em 3 tabelas
- **Novo**: `src/hooks/useProjetoMembros.ts`
- **Novo**: `src/components/projetos/ProjetoMembrosDialog.tsx`
- **Editado**: `src/components/projetos/ProjetoHeader.tsx` (botão Membros)
- **Editado**: `src/hooks/useProjetos.ts` (inserir criador como membro ao criar)

