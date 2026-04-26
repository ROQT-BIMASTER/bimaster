
## Objetivo

Na Central de Trabalho / detalhe da tarefa, permitir **trocar Responsável**, **adicionar/remover Seguidores** e fazer com que **documentos enviados via Vincular China** apareçam anexados na tarefa com um **marco no timeline de atividades**, identificando quem enviou.

---

## 1. Detalhe da Tarefa — UI de Responsável e Seguidores editáveis

**Arquivo:** `src/components/projetos/ProjetoTarefaDetalhe.tsx` (linhas 549–584)

Hoje os blocos "Responsável" e "Seguidores" são apenas leitura. Vamos torná-los interativos:

- **Responsável**: trocar o `<span>` estático por um `Popover` com lista de membros do projeto (`useProjetoMembros`). Ao selecionar, faz `update` em `projeto_tarefas.responsavel_id` e registra atividade (`tipo: "responsavel_alterado"`).
- **Seguidores**: ao lado dos avatares, adicionar botão `+` que abre `Popover` com busca de membros do projeto. Selecionar adiciona em `projeto_tarefa_colaboradores`; clicar em um avatar existente permite remover. Cada ação registra atividade (`tipo: "seguidor_adicionado" / "seguidor_removido"`).

**Novos hooks de mutation** em `src/hooks/useProjetoTarefa.ts` (já existente):
- `updateResponsavel(tarefaId, userId)` 
- `addSeguidor(tarefaId, userId)`
- `removeSeguidor(tarefaId, userId)`

Cada um faz a alteração + insert em `projeto_tarefa_atividades` com a descrição apropriada (ex.: "Maria adicionou João como seguidor").

---

## 2. Documentos do Vincular China — anexar e registrar marco

**Fluxo atual:** ao vincular um documento China (`china_documento_tarefa_vinculos`), nada aparece visualmente dentro da tarefa nem fica registrado quem fez.

**Mudanças:**

### 2a. Trigger de atividade ao vincular documento China
**Migração SQL** — adicionar trigger em `china_documento_tarefa_vinculos`:
- `AFTER INSERT`: insere em `projeto_tarefa_atividades` com `tipo = "documento_china_vinculado"`, `user_id = NEW.created_by`, `descricao = "Anexou documento China: <título>"`.
- `AFTER DELETE`: insere atividade `tipo = "documento_china_desvinculado"`.

Função: `public.fn_log_china_doc_vinculo()` (SECURITY DEFINER).

### 2b. Exibir documentos China no detalhe da tarefa
**Arquivo:** `src/components/projetos/ProjetoTarefaDetalhe.tsx` (seção de Anexos)

Criar novo bloco/aba "**Documentos da China**" listando documentos via `china_documento_tarefa_vinculos` JOIN `china_produto_documentos`, com: nome, tipo, quem vinculou (`created_by` → profiles), data, e botão para abrir/baixar (usando `StoragePreviewDialog` conforme padrão do projeto).

**Hook novo:** `src/hooks/useChinaDocsDaTarefa.ts` — query que busca documentos vinculados à tarefa.

### 2c. Marco no timeline
A atividade gerada pelo trigger já será exibida automaticamente em `ProjetoTarefaTimeline` (que lê `projeto_tarefa_atividades`). Apenas garantir um ícone/label específico para os tipos `documento_china_vinculado` e `documento_china_desvinculado` no componente de timeline.

---

## 3. Acesso a partir da tela "Hoje"

A tela "Hoje" hoje navega para `/dashboard/projetos/:id` ao clicar numa tarefa. Para que o usuário chegue ao detalhe (com as novas funções), vamos:
- Manter a navegação atual, mas adicionar `?tarefa=<id>` no link, abrindo automaticamente o `ProjetoTarefaDetalhe` da tarefa clicada (padrão já usado em outras telas do módulo).

**Arquivo:** `src/components/projetos/central/HojeTab.tsx` linha 29 — ajustar `navigate`.

---

## 4. Resumo de arquivos

**Edição:**
- `src/components/projetos/ProjetoTarefaDetalhe.tsx` — UI editável de Responsável, Seguidores; novo bloco de Documentos China.
- `src/hooks/useProjetoTarefa.ts` — mutations de responsável/seguidores com log de atividade.
- `src/components/projetos/central/HojeTab.tsx` — navegação para abrir detalhe.
- `src/components/projetos/ProjetoTarefaTimeline.tsx` — ícones para os novos tipos de atividade.

**Criação:**
- `src/hooks/useChinaDocsDaTarefa.ts` — query de documentos China da tarefa.
- Migração SQL com função + triggers de log em `china_documento_tarefa_vinculos`.

---

## Observações de governança

- Seguir o padrão `StoragePreviewDialog` (memo Blob Download Protocol) para abrir documentos.
- Atividades registradas seguem o padrão já usado por `registrarMovimentacaoNaTarefa` (`projeto_tarefa_atividades`).
- RLS de `projeto_tarefa_colaboradores` já permite insert/delete a membros do projeto — sem mudança de policy necessária.
- Trigger usa `SECURITY DEFINER` com `set search_path = public` (padrão do projeto).
