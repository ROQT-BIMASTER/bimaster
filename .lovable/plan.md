## Objetivo

1. **Restringir o template "Desenvolvimento de Produto"** para que apareça apenas para usuários do **Departamento de Projetos** (e administradores). Demais usuários só veem "Projeto Genérico" e templates personalizados sem vínculo de produto.
2. **Permitir que usuários criem, salvem e reutilizem modelos personalizados de projeto** (com seções, tarefas e subtarefas pré-configuradas), pessoais ou compartilhados com sua equipe/departamento.

---

## Parte 1 — Restrição do template "Desenvolvimento de Produto"

### Diagnóstico
Em `NovoProjetoDialog.tsx` (linha 17 e 112) já existe a constante `DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130"` e a flag `isDevTeam`, porém o ID está hard-coded e pode estar desatualizado. A seleção do template (linha 231) já usa essa flag para filtrar.

### Ajustes
- **Identificar o departamento "Projetos" dinamicamente** por nome (case-insensitive: `Projetos` / `Projects` / `Desenvolvimento de Produto`) usando `useUserDepartments()` em vez de UUID hard-coded — mais resiliente.
- Manter o admin com acesso total.
- **Bloqueio servidor (defesa em profundidade)**: adicionar trigger SQL em `projetos` que valida, no INSERT, se `tipo = 'desenvolvimento_produto'` exige que o `criador_id` seja admin OU pertença ao departamento "Projetos" (verificando `user_departments` + `departments.nome`).
- Ao reverter para Genérico, limpar campos de marca/origem/categoria no submit.

---

## Parte 2 — Modelos personalizados de projeto

### Modelo de dados (nova tabela)

```sql
projeto_modelos (
  id uuid PK,
  nome text NOT NULL,
  descricao text,
  icone text,
  cor text,
  escopo text CHECK (escopo IN ('pessoal','departamento','organizacao')) DEFAULT 'pessoal',
  departamento_id uuid REFERENCES departments(id),  -- só quando escopo='departamento'
  vinculado_produto boolean DEFAULT false,          -- true só para usuários do Dpto Projetos
  estrutura jsonb NOT NULL,                          -- árvore: secoes -> tarefas -> subtarefas
  criado_por uuid NOT NULL,
  uso_count int DEFAULT 0,
  created_at, updated_at
)
```

`estrutura` (JSON):
```json
{
  "secoes": [
    { "nome": "Briefing", "cor": "#6366f1", "ordem": 0,
      "tarefas": [
        { "titulo": "Definir escopo", "prazo_dias": 3,
          "subtarefas": [{ "titulo": "Reunião kickoff" }] }
      ]
    }
  ]
}
```

### RLS
- SELECT: `criado_por = auth.uid()` OU (`escopo='departamento'` AND user pertence ao `departamento_id`) OU `escopo='organizacao'`.
- INSERT/UPDATE/DELETE: apenas o criador (admins podem tudo).
- Trigger valida que `vinculado_produto=true` exige criador do Dpto Projetos.

### UI

**1. Step 1 do `NovoProjetoDialog`** — substituir o `RadioGroup` atual por uma lista única que combina:
- Templates do sistema (`generico`, e `desenvolvimento_produto` se for do Dpto Projetos)
- Modelos pessoais do usuário
- Modelos compartilhados do departamento/organização visíveis a ele

Cada item mostra: ícone, nome, descrição curta, badge ("Sistema" / "Meu modelo" / "Equipe"), e quantidade de seções/tarefas. Filtro de busca no topo se houver mais de 6 modelos.

**2. Botão "Salvar como modelo"** dentro de um projeto existente (`ProjetoHeader.tsx`, menu de ações):
- Abre `SalvarComoModeloDialog`: nome, descrição, escopo (pessoal / departamento / organização — admin), incluir prazos? incluir subtarefas?
- Captura todas as `projeto_secoes` + `projeto_tarefas` + subtarefas e serializa em `estrutura`.

**3. Nova página `Configurações → Meus Modelos de Projeto`** (`/dashboard/projetos/modelos`):
- Lista cards de modelos do usuário e da equipe.
- Ações: editar nome/escopo, duplicar, excluir, pré-visualizar árvore.
- Botão "Criar modelo do zero" abre editor com tree builder (seções/tarefas/subtarefas).

**4. Integração no `createProjeto`**:
- Se o template selecionado for um `modelo_id` (UUID em vez de chave fixa), o hook lê `projeto_modelos.estrutura`, cria as seções/tarefas/subtarefas em cascata, calcula `data_prazo` das tarefas a partir de `data_inicio` + `prazo_dias` (usando `prazoCalculator` já existente) e incrementa `uso_count`.

### Arquivos a criar/editar

**Criar:**
- `supabase/migrations/<ts>_modelos_projeto.sql` — tabela, RLS, triggers de validação (Dpto Projetos para `vinculado_produto`).
- `src/hooks/useProjetoModelos.ts` — list/create/update/delete/duplicate.
- `src/components/projetos/SalvarComoModeloDialog.tsx`
- `src/components/projetos/ModeloEditor.tsx` (tree builder de seções/tarefas/subtarefas)
- `src/pages/projetos/MeusModelos.tsx`

**Editar:**
- `src/components/projetos/NovoProjetoDialog.tsx` — nova lista unificada de templates, lookup dinâmico do Dpto Projetos.
- `src/hooks/useProjetos.ts` — `createProjeto` aceita `modelo_id` e materializa a árvore com prazos.
- `src/components/projetos/ProjetoHeader.tsx` — item "Salvar como modelo" no menu de ações.
- `src/App.tsx` + `AppSidebar.tsx` — rota e link "Modelos de projeto" dentro do módulo Projetos.

---

## Notas

- O hard-coded `DEV_DEPARTMENT_ID` é mantido como fallback para o caso de o lookup por nome falhar.
- O bloqueio de "vínculo a produtos" (`vinculado_produto=true`) é aplicado tanto no front (campos marca/origem/categoria escondidos) quanto no banco via trigger.
- Modelos personalizados não criam vínculo com produtos, mesmo que o autor seja do Dpto Projetos, a menos que o usuário marque essa opção explicitamente.
- Migração não altera projetos existentes; apenas adiciona infraestrutura.

Aguardando aprovação para implementar.
