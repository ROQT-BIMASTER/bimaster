
## Objetivo

Unificar a "linguagem de vinculação" do sistema usando UMA única regra prática:

> **"Toda tarefa/seção do módulo Projetos pode ser usada como tarefa de uma etapa do Processo. Quando ela é concluída no Projeto, é concluída no Processo. Para concluir, o usuário precisa anexar o(s) documento(s) oficial(is) exigido(s) pela etapa."**

Essa mesma regra valerá em 3 telas:
1. **Perfil de Processo** (`/dashboard/processos/perfis`) — define o template
2. **Detalhe do Projeto** — instancia as tarefas do processo
3. **Vincular China** (`/dashboard/.../vincular-china`) — vincula submissão China + tarefa do projeto + processo, num só fluxo

---

## Regra prática (única, simples)

| Conceito | Onde vive | Como funciona |
|---|---|---|
| **Tarefa de Etapa** | template no perfil | Pode ser (a) criada do zero (já existe) **ou (b) "espelhar" uma tarefa/seção de um Projeto existente** |
| **Documento Oficial** | já existe `processo_etapa_documentos_template` | Quando a tarefa espelhada é marcada como concluída no Projeto, o sistema verifica se TODOS os docs oficiais marcados como `obrigatorio_para_conclusao=true` foram anexados. Se não, bloqueia a conclusão. |
| **Sincronização** | trigger + RPC | Mudança de status no `projeto_tarefas` ⇒ atualiza `modulo_processo_link` (espelho). E vice-versa: concluir no processo conclui a tarefa no projeto. |

---

## Mudanças no Banco

### 1. Estender `processo_etapa_tarefas_template`
Adicionar 3 colunas para suportar "espelhamento":
```sql
ALTER TABLE processo_etapa_tarefas_template
  ADD COLUMN modo TEXT NOT NULL DEFAULT 'criar'
    CHECK (modo IN ('criar','espelhar_tarefa','espelhar_secao')),
  ADD COLUMN espelho_projeto_id UUID REFERENCES projetos(id) ON DELETE SET NULL,
  ADD COLUMN espelho_secao_id UUID REFERENCES projeto_secoes(id) ON DELETE SET NULL,
  ADD COLUMN espelho_tarefa_id UUID REFERENCES projeto_tarefas(id) ON DELETE SET NULL,
  ADD COLUMN exige_documentos BOOLEAN NOT NULL DEFAULT true;
```

### 2. Nova tabela `processo_tarefa_espelho`
Liga a tarefa instanciada do processo (em `processo_instancia_tarefa_gerada` ou nova) à tarefa real do `projeto_tarefas`:
```sql
CREATE TABLE processo_tarefa_espelho (
  id UUID PK DEFAULT gen_random_uuid(),
  instancia_id UUID REFERENCES processo_instancias(id) ON DELETE CASCADE,
  etapa_id UUID REFERENCES processo_perfil_etapas(id),
  template_id UUID REFERENCES processo_etapa_tarefas_template(id),
  projeto_tarefa_id UUID REFERENCES projeto_tarefas(id) ON DELETE CASCADE,
  projeto_secao_id UUID REFERENCES projeto_secoes(id),
  status TEXT DEFAULT 'pendente',
  concluida_em TIMESTAMPTZ,
  concluida_por UUID,
  UNIQUE (instancia_id, etapa_id, projeto_tarefa_id)
);
```

### 3. Trigger de sincronização bidirecional
```sql
CREATE FUNCTION sync_processo_tarefa_espelho() RETURNS trigger AS $$
BEGIN
  -- Quando projeto_tarefas.status muda para 'concluida':
  IF NEW.status = 'concluida' AND OLD.status <> 'concluida' THEN
    -- Para cada espelho desta tarefa: validar docs obrigatórios antes de concluir
    -- Se algum doc obrigatório não foi anexado, bloqueia (RAISE EXCEPTION)
    -- Caso ok, marca processo_tarefa_espelho.status = 'concluida'
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4. Atualizar `gerar_tarefas_etapa`
Quando o template tiver `modo='espelhar_tarefa'`: NÃO criar nova `projeto_tarefas`, em vez disso inserir em `processo_tarefa_espelho` apontando para a tarefa existente.

### 5. Atualizar `pode_avancar_etapa`
Adicionar verificação: para cada `processo_tarefa_espelho` da etapa, status deve ser `'concluida'`. Pendência retorna o título e link para a tarefa do projeto.

---

## Mudanças no Frontend

### A. `PerfisProcesso.tsx` — Aba Tarefas (refactor leve)

Cada item de tarefa-template ganha um seletor de modo:
- **○ Criar nova tarefa no projeto** (comportamento atual)
- **○ Espelhar uma tarefa/seção existente** → abre os 3 selects encadeados (Projeto → Seção → Tarefa) reutilizando `useProjetosParaVinculo` e `useSecoesETarefas` (já existem em `useChinaTarefaVinculos.ts`)
- Toggle **"Exige documentos oficiais para concluir"** (default ON)

### B. Novo componente `TarefaEspelhoSelect.tsx`
Reutilizável (mesma UX em PerfisProcesso e Vincular China):
```tsx
<TarefaEspelhoSelect
  value={{ projeto_id, secao_id, tarefa_id }}
  onChange={...}
  showBlockingToggle
  showDocsRequiredToggle
/>
```

### C. `ProjetoVincularChina.tsx` — adicionar bloco "Processo"
No `VincularChinaSidePanel.tsx`, abaixo da lista de tarefas vinculadas, novo bloco:

> **Vincular ao Processo aplicado**
> Se o projeto tem perfil de processo aplicado, mostrar etapas em accordion. Em cada etapa, listar tarefas-template com modo `espelhar_tarefa` ainda não preenchidas. Botão "Usar tarefa selecionada do projeto como espelho desta etapa do processo".

Isso resolve em 1 clique: a tarefa que o usuário acabou de criar/marcar no Vincular China vira automaticamente a tarefa-espelho do processo.

### D. Hook `useProcessoTarefaEspelho.ts`
- `useEspelhosDaInstancia(instancia_id)`
- `useCreateEspelho()` / `useDeleteEspelho()`
- `useConcluirTarefaEspelhoComDocs({ id, documentos: [{ doc_template_id, file }] })` — sobe os docs no Storage e marca como concluído

### E. UI de validação
- No `AvancarEtapaDialog.tsx`: novo tipo de pendência `'tarefa_espelho'` com ícone `LinkIcon` e link "Abrir tarefa no projeto"
- No card de tarefa no Detalhe do Projeto: badge **"Espelho do Processo: <perfil> › <etapa>"** indicando que sua conclusão dispara validações extras

---

## Fluxo do usuário (a "regra simples")

1. Admin cria perfil de processo → na etapa "Aprovação de Etiqueta" adiciona uma tarefa em modo **"Espelhar tarefa existente"** apontando para a tarefa "Validar etiqueta v2" do projeto X. Marca 1 documento oficial obrigatório: "Etiqueta aprovada PDF".
2. Sistema cria `processo_tarefa_espelho` ligando processo↔tarefa do projeto.
3. Usuário do projeto marca "Validar etiqueta v2" como concluída no módulo Projetos.
4. Trigger valida: o doc "Etiqueta aprovada PDF" foi anexado? Se sim → marca espelho como concluído + libera avanço da etapa do processo. Se não → bloqueia com mensagem clara: *"Anexe o documento 'Etiqueta aprovada PDF' antes de concluir."*
5. Em "Vincular China": ao vincular submissão à tarefa, um botão extra "Usar como espelho do processo" cria o vínculo `processo_tarefa_espelho` no mesmo gesto.

---

## Arquivos a criar/editar

**Migration:**
- `supabase/migrations/<ts>_processo_tarefa_espelho.sql`

**Backend (RPC/triggers nessa migration):**
- `sync_processo_tarefa_espelho()` (trigger)
- atualização de `gerar_tarefas_etapa()`, `pode_avancar_etapa()`, `aplicar_perfil_processo()`

**Frontend novo:**
- `src/hooks/useProcessoTarefaEspelho.ts`
- `src/components/processos/TarefaEspelhoSelect.tsx`
- `src/components/processos/ConcluirTarefaEspelhoDialog.tsx` (upload de docs obrigatórios)

**Frontend editado:**
- `src/pages/processos/PerfisProcesso.tsx` (aba Tarefas: modo criar/espelhar)
- `src/components/china/VincularChinaSidePanel.tsx` (novo bloco "Vincular ao Processo")
- `src/components/processos/AvancarEtapaDialog.tsx` (renderizar pendência tipo `tarefa_espelho`)
- `src/components/processos/ProcessoModulosResumoBanner.tsx` (mostrar tarefas-espelho)
- Componente de detalhe da tarefa no projeto: badge "Espelho do Processo"

---

## Princípio de design (anti-confusão)

- **1 só conceito novo na UI**: "tarefa-espelho". Sempre apresentada como *"Esta tarefa do projeto também conta para a etapa X do processo Y"*.
- **Documentos oficiais**: já existem no template — apenas tornamos o vínculo obrigatório por default.
- **Mesmo seletor reutilizado** em Perfil de Processo e em Vincular China — usuário aprende uma vez, usa em todo lugar.
