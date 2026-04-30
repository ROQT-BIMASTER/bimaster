# Central de Trabalho — notificações de papel, visão consolidada e comentário rápido

Três melhorias coordenadas, todas dentro da Central de Trabalho. Reaproveita infraestrutura existente (tabela `notifications`, tabela `projeto_tarefa_messages`, hook `useMinhasTarefas`, `usePushNotifications`). Nenhuma tela nova é criada.

---

## 1. Notificações quando meu papel muda

### Comportamento

Toda vez que minha relação com uma tarefa muda de **colaborador → responsável** ou **responsável → colaborador**, recebo uma notificação na sineta da Central (e push, se permitido):

- "Você agora é responsável pela tarefa **{título}** no projeto **{projeto}**."
- "Você passou a colaborar na tarefa **{título}** — o responsável agora é **{nome}**."
- (também) "Você foi adicionado como colaborador em **{título}**."
- (também) "Você foi removido como colaborador de **{título}**."

Cada notificação leva ao detalhe da tarefa via `action_url` (`/dashboard/projetos/central?tab=tarefas&task={id}`).

### Origem

Já existe a tabela `projeto_tarefa_acesso_audit` que registra `ganhou_acesso` / `perdeu_acesso` com `papel_anterior` e `papel_novo`. Vamos plugar um trigger AFTER INSERT nela que:

1. Identifica o `user_afetado_id`.
2. Detecta a transição real comparando com a linha mais recente anterior do mesmo `(tarefa_id, user_afetado_id)`. As quatro transições alvo:
   - `null → responsavel` (virou responsável)
   - `null → colaborador` (virou colaborador)
   - `colaborador → responsavel` (promovido)
   - `responsavel → colaborador` (rebaixado)
   - `* → null` (perdeu acesso)
3. Insere uma linha em `public.notifications` com `type = 'task_role_change'`, título e mensagem em PT-BR e `action_url` apontando para a tarefa.
4. Não notifica o próprio ator (`ator_id = user_afetado_id`) para não spammar quem fez a alteração de si mesmo.
5. Idempotência: marcado por `(tarefa_id, user_afetado_id, papel_novo, created_at::date)` para evitar duplicatas no mesmo segundo.

O hook `usePushNotifications` já está escutando `notifications` via realtime — push aparece automaticamente.

### Banner dentro da Central

Na própria Central, no topo da aba **Minhas tarefas**, exibir um aviso compacto quando houver notificações `task_role_change` não lidas das últimas 24h:

```
[↺] 2 mudanças de papel recentes — ver detalhes
```

Clicar abre um popover com a lista (título, projeto, transição "Colaborador → Responsável", tempo relativo) e botões "Ir para tarefa" e "Marcar como lido".

---

## 2. Visão consolidada "Minhas + Colaborando"

### Onde

Acima da lista atual, um card compacto **"Visão geral por papel"** que mostra a divisão de carga sem precisar trocar filtros.

```
┌─ Visão geral por papel ─────────────────────────────────────┐
│  ●  Sou responsável        12 ativas   3 atrasadas   [Ver]  │
│  ●  Estou colaborando       7 ativas   1 atrasada    [Ver]  │
│                                                              │
│  Total ativo: 19  ·  Concluídas hoje: 4                     │
└─────────────────────────────────────────────────────────────┘
```

- Cada linha é clicável e aplica o filtro `Meu papel` correspondente (já existente).
- "Ver" navega mantendo os outros filtros.
- O card é colapsável e a preferência de visibilidade é persistida em `user_central_preferences.show_role_overview` (default `true`).

### Quando o filtro "Meu papel = Todos" está ativo

A lista ganha **separadores visuais por papel** dentro de cada grupo de prazo:

```
ATRASADAS  (4)
  ▸ Como responsável (3)
      • tarefa A
      • tarefa B
      • tarefa C
  ▸ Como colaborador (1)
      • tarefa D
```

Cada sub-cabeçalho é colapsável independentemente. Quando o filtro de papel está em "responsável" ou "colaborador", a separação some (não faz sentido).

### Cálculo

Os dados já vêm em `useMinhasTarefas` com o campo `papel`. O agrupamento é puro `useMemo` sobre `filtered` — sem novas queries.

---

## 3. Comentário rápido inline

### Onde

Em cada `ListRow` (e equivalente no Board), aparece um botão discreto de balão à direita, ao lado do prazo. Ao clicar, expande um pequeno popover ancorado na linha com:

```
┌─────────────────────────────────────────┐
│ Comentário rápido                        │
│ ┌─────────────────────────────────────┐ │
│ │ Adicione contexto ou dúvida...      │ │
│ │                                      │ │
│ └─────────────────────────────────────┘ │
│ Ctrl+Enter para enviar       [Enviar]   │
└─────────────────────────────────────────┘
```

- Aceita até 1000 caracteres, multilinha, sem formatação rica nem menções (para manter "rápido").
- `Ctrl+Enter` envia. `Esc` fecha.
- Após enviar: toast "Comentário registrado" e o ícone na linha ganha uma bolinha indicando que há comentários (contador opcional do tipo `[💬 3]`).
- Salva em `projeto_tarefa_messages` (tabela já existente, RLS já cobre membros). Mesmo modelo do `useMinhasTarefaDetalhe.sendMessage`.

### Indicador de contexto

O ícone tem três estados:
- Vazio (sem comentários ainda) — ícone fantasma
- Com comentários — ícone preenchido + contador
- Com não-lidos do último responsável (futuro, fora deste escopo) — bolinha

Exibido em **todas** as tarefas da lista, não só naquelas onde sou colaborador. O usuário pediu para "registrar contexto quando estiver colaborando", mas restringir só a essas tarefas seria confuso — mantemos universal e o uso fica natural.

### Nada de re-renderização pesada

O popover é montado lazy (`Popover` do shadcn) e cada um carrega o contador de mensagens de forma agregada via uma única query batch ao montar a lista (`select tarefa_id, count(*) from projeto_tarefa_messages where tarefa_id = any($1) group by tarefa_id`).

---

## Onde mexer (técnico)

| Arquivo | Mudança |
|---|---|
| Migration (nova) | Adiciona coluna `show_role_overview boolean default true` em `user_central_preferences`. Cria função e trigger `notify_tarefa_papel_change` em `projeto_tarefa_acesso_audit` que insere em `notifications`. |
| `src/hooks/useCentralPreferences.ts` | Adicionar `show_role_overview` ao tipo, defaults e merger. |
| `src/components/projetos/central/MinhasTarefasContent.tsx` | (a) Renderizar `<RoleOverviewCard />` acima da lista. (b) No agrupamento, quando `filterRole === "all"`, sub-agrupar por papel dentro de cada `ListSection`. (c) Renderizar `<PapelChangeBanner />` no topo. (d) Passar `messageCounts` para `ListRow`. |
| `src/components/projetos/central/RoleOverviewCard.tsx` (novo) | Card colapsável de divisão por papel. Calcula contagens a partir das `tarefas` (props). |
| `src/components/projetos/central/PapelChangeBanner.tsx` (novo) | Lê `notifications` `type='task_role_change'` não lidas das últimas 24h via React Query; popover com lista e ações. |
| `src/components/projetos/central/QuickCommentPopover.tsx` (novo) | Popover compacto com `Textarea`, atalhos e mutation que insere em `projeto_tarefa_messages`. |
| `src/hooks/useTarefaMessageCounts.ts` (novo) | Hook que recebe lista de `tarefa_id`s e retorna `Record<id, count>` (uma query agregada). |
| `src/components/projetos/central/MinhasTarefasContent.tsx` (`ListRow`) | Slot do botão de balão + integração com `QuickCommentPopover`. |
| `src/lib/version.ts` + `src/components/erp/ApiDocumentation.tsx` | Bump `APP_VERSION` para `3.4.51` e changelog: "Central de Trabalho: notificações de mudança de papel, visão consolidada por papel e comentário rápido inline". |

## Banco — resumo das alterações

```sql
-- 1. Preferência de exibição do card de visão geral
ALTER TABLE public.user_central_preferences
  ADD COLUMN IF NOT EXISTS show_role_overview boolean NOT NULL DEFAULT true;

-- 2. Trigger que cria notificação ao mudar papel
CREATE OR REPLACE FUNCTION public.notify_tarefa_papel_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo text;
  v_projeto text;
  v_msg text;
  v_url text;
BEGIN
  -- Não notifica quem é o ator da própria mudança
  IF NEW.ator_id = NEW.user_afetado_id THEN RETURN NEW; END IF;

  SELECT t.titulo, p.nome
    INTO v_titulo, v_projeto
    FROM projeto_tarefas t
    JOIN projetos p ON p.id = t.projeto_id
   WHERE t.id = NEW.tarefa_id;

  v_url := '/dashboard/projetos/central?tab=tarefas&task=' || NEW.tarefa_id::text;

  v_msg := CASE
    WHEN NEW.papel_novo = 'responsavel' AND NEW.papel_anterior = 'colaborador'
      THEN 'Você passou de colaborador a responsável em "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo = 'colaborador' AND NEW.papel_anterior = 'responsavel'
      THEN 'Você passou de responsável a colaborador em "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo = 'responsavel'
      THEN 'Você é o novo responsável por "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo = 'colaborador'
      THEN 'Você foi adicionado como colaborador em "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo IS NULL
      THEN 'Seu acesso à tarefa "' || v_titulo || '" foi removido.'
  END;

  IF v_msg IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (NEW.user_afetado_id, 'task_role_change', 'Mudança de papel em tarefa', v_msg, v_url);
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_notify_tarefa_papel_change
  AFTER INSERT ON public.projeto_tarefa_acesso_audit
  FOR EACH ROW EXECUTE FUNCTION public.notify_tarefa_papel_change();
```

## Critério de aceite

1. Ao alterar o responsável de uma tarefa onde sou colaborador, recebo notificação na sineta com texto "passou de colaborador a responsável" e (se permitido) push do navegador.
2. Banner "X mudanças de papel recentes" aparece no topo da Central enquanto houver notificações `task_role_change` não lidas das últimas 24h e some ao marcar como lidas.
3. Card "Visão geral por papel" mostra contagem correta de ativas e atrasadas para cada papel; clicar em "Ver" aplica o filtro correspondente.
4. Com filtro "Meu papel = Todos", cada grupo de prazo é sub-dividido em "Como responsável" e "Como colaborador", colapsáveis.
5. Botão de balão em cada linha abre popover, salvo em `projeto_tarefa_messages` e o contador na linha incrementa após sucesso.
6. APP_VERSION bumpado para 3.4.51 com entrada no changelog grepable.

## Fora de escopo

- Não muda RLS nem visibilidade de tarefas.
- Não substitui o painel de comentários completo da tela de detalhe.
- Não cria nova aba nem nova rota.
- Não muda a lógica de "Delegadas".
