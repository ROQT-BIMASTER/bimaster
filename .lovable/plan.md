## Objetivo

Hoje a aba **Tarefas** da Etapa só permite criar *templates* (que geram tarefas novas no projeto vinculado quando a etapa começa). O usuário precisa também poder **apontar uma etapa do perfil para um Projeto, Seção e/ou Tarefa que JÁ EXISTEM** no módulo Projetos — para que a execução da etapa "puxe" o trabalho real (por exemplo, "Etapa 2 = Seção `Aprovação de Arte` do projeto `Lançamentos 2026`").

Isso completa o ciclo de relacionamento (China ↔ Brasil ↔ Fábrica ↔ Projetos ↔ Tarefas) na própria definição do perfil — não só na instância.

---

## 1. Banco de dados

### Nova tabela `processo_etapa_projeto_refs`
Referências de Projeto/Seção/Tarefa **declaradas no template do perfil** (não no registro instanciado).

```sql
CREATE TABLE processo_etapa_projeto_refs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id      uuid NOT NULL REFERENCES processo_perfil_etapas(id) ON DELETE CASCADE,
  projeto_id    uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  secao_id      uuid REFERENCES projeto_secoes(id) ON DELETE SET NULL,
  tarefa_id     uuid REFERENCES projeto_tarefas(id) ON DELETE SET NULL,
  modo          text NOT NULL DEFAULT 'vincular',
                -- 'vincular'  = só aponta (cria modulo_projeto_vinculos ao aplicar)
                -- 'espelhar'  = adiciona referência bidirecional + status
                -- 'bloqueia'  = etapa só avança quando a tarefa estiver concluída
  bloqueia_avanco boolean NOT NULL DEFAULT false,
  observacoes   text,
  ordem         int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS: idêntica a processo_etapa_modulos (admin/gerente gerenciam, autenticado lê)
```

### Atualização de `aplicar_perfil_processo` (RPC)
Após instanciar a etapa, varrer `processo_etapa_projeto_refs` e inserir registros em `modulo_projeto_vinculos` apontando para o projeto/seção/tarefa configurados — usando a entidade do registro como `registro_id`.

### Atualização de `pode_avancar_etapa` (RPC)
Quando `bloqueia_avanco=true` numa ref:
- Se `tarefa_id` definido: verificar `projeto_tarefas.status = 'concluida'`.
- Se só `secao_id`: verificar que TODAS as tarefas da seção estão concluídas.
- Se só `projeto_id`: verificar `projetos.status = 'concluido'`.
Acumular pendências no array de retorno (`tipo: 'projeto_ref'`).

---

## 2. Hook `useProcessoEtapaVinculos.ts`

Adicionar:
- `projetoRefs` (lista atual)
- `addProjetoRef`, `removeProjetoRef`, `updateProjetoRef` (mutations)

Reaproveitar `useProjetosParaVinculo` e `useSecoesETarefas` do `useChinaTarefaVinculos` (já existem).

---

## 3. UI — `PerfisProcesso.tsx`

Na aba **Tarefas** da `EtapaVinculos`, adicionar uma **nova subseção** "Vínculos com Projetos existentes" (acima do gerador de templates), contendo:

```
┌─ Vínculos com Projetos existentes ───────────────────┐
│  [Lista de refs] ─ chip Projeto › Seção › Tarefa     │
│                    [bloqueia ▢] [remover]           │
│                                                       │
│  Adicionar:                                           │
│  ┌ Projeto ▼ ┐ ┌ Seção ▼ ┐ ┌ Tarefa ▼ ┐ [+]         │
│  ☐ Bloqueia avanço se não concluída                  │
└──────────────────────────────────────────────────────┘
```

- Selects encadeados (mesma UX do `VincularProjetoDialog`).
- Seção e Tarefa são opcionais → permite vincular a granularidades diferentes.
- Ao salvar, chama `addProjetoRef`.

Alternativa de organização: criar uma **4ª aba** "Projetos" dentro da etapa (ícone `FolderOpen`) — mais limpa visualmente. **Recomendo essa opção** para não misturar com os templates de tarefas auto-geradas.

---

## 4. Aplicação na instância

Quando o perfil é aplicado a um produto/projeto via `ProcessoAplicadoCard`:
- Para cada `processo_etapa_projeto_refs` com `modo='vincular'` → cria entrada em `modulo_projeto_vinculos` (modulo = `produto_brasil` ou tipo correspondente, registro_id = id da entidade).
- Esses vínculos aparecem automaticamente nos banners existentes (`ProcessoModulosResumoBanner`) e na seção de Projetos do produto.

---

## 5. Feedback no `AvancarEtapaDialog`

Já mostra pendências; só precisa exibir o novo `tipo: 'projeto_ref'` com label "Tarefa pendente: {titulo}" / "Seção pendente: {nome}" / "Projeto não concluído: {nome}".

---

## Arquivos a criar / editar

**Criar:**
- `supabase/migrations/<ts>_etapa_projeto_refs.sql` (tabela + RLS + atualização das 2 RPCs)

**Editar:**
- `src/hooks/useProcessoPerfis.ts` — adicionar interface `ProcessoEtapaProjetoRef` e mutations no `useProcessoEtapaVinculos`
- `src/pages/processos/PerfisProcesso.tsx` — nova aba "Projetos" em `EtapaVinculos`
- `src/components/processos/AvancarEtapaDialog.tsx` — labels para `projeto_ref`
- `src/integrations/supabase/types.ts` — auto-regenerado

---

## Resultado para o usuário

Na tela atual (`/dashboard/processos/perfis`), ao selecionar uma etapa, terá uma nova aba **"Projetos"** onde poderá:
1. Escolher um **Projeto existente** do módulo Projetos.
2. Opcionalmente escolher **Seção** e **Tarefa** específicas.
3. Marcar se o avanço da etapa deve esperar pela conclusão dessa tarefa/seção/projeto.
4. Ver tudo aplicado automaticamente quando o perfil for atribuído a um produto.
