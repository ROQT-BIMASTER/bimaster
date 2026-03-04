

## Plano: Melhorias Avançadas no Módulo de Projetos

Baseado na imagem do Asana e na apresentação "Hub Central - Gestão Huggs", identifico as seguintes funcionalidades que faltam no módulo atual:

---

### O que falta implementar

#### 1. Painel Lateral de Detalhe da Tarefa (prioridade máxima)
Ao clicar numa tarefa, abre um **Sheet** à direita com:
- Botão "Marcar como concluída" no topo
- Título editável inline + código da tarefa
- Campos: Responsável, Data prazo, Projeto, Status, Prioridade, Estágio
- Dependências entre tarefas
- Descrição rica (textarea)
- Subtarefas com checkboxes inline
- Seguidores/Colaboradores (avatar stack)
- Anexos com upload e preview (thumbnail por tipo)
- Feed de comentários/atividade no rodapé

#### 2. Tabelas novas no banco
- **`projeto_tarefa_comentarios`** — id, tarefa_id, user_id, conteudo, created_at
- **`projeto_tarefa_anexos`** — id, tarefa_id, user_id, nome, storage_path, tipo_arquivo, tamanho, created_at
- Coluna **`estagio`** em `projeto_tarefas`
- Storage bucket **`projeto-anexos`**

#### 3. Melhorias na Visão Lista
- Click no título abre o painel lateral (click no checkbox mantém toggle)
- Linha selecionada com destaque visual (borda azul à esquerda)
- Código da tarefa visível ao lado do título (ex: "HB-M413")
- Geração automática de código sequencial por projeto

#### 4. Campos personalizados por projeto
- Estágio com badges coloridos (Briefing, Em Criação, Revisão, Aprovado, Produção)
- Processo vinculado

---

### Arquivos a criar
- `src/components/projetos/ProjetoTarefaDetalhe.tsx` — Painel lateral completo (Sheet)
- `src/hooks/useProjetoTarefaDetalhe.ts` — CRUD comentários + anexos

### Arquivos a editar
- `src/components/projetos/ProjetoTarefaRow.tsx` — onClick título abre detalhe, exibir código, destaque seleção
- `src/components/projetos/ProjetoListView.tsx` — Estado tarefa selecionada + renderizar Sheet
- `src/components/projetos/ProjetoSecao.tsx` — Propagar callback de seleção
- `src/hooks/useProjetoTarefas.ts` — Interface com campo estagio

### Migration SQL
- Criar `projeto_tarefa_comentarios` e `projeto_tarefa_anexos` com RLS
- Adicionar `estagio text` em `projeto_tarefas`
- Criar bucket `projeto-anexos`
- Trigger para gerar código automático (prefixo do projeto + sequencial)

