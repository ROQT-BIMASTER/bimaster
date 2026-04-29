
## Escopo

Quatro entregas conectadas ao módulo Projetos:

1. Aba "Delegadas por mim" na Central de Trabalho.
2. Auditoria por evento de mudança de acesso a tarefas.
3. Tela de depuração de visibilidade (admin).
4. FAQ explicando as regras de visibilidade.

## 1. Aba "Delegadas por mim"

**Banco — nova RPC `get_minhas_delegadas_central()`** (SECURITY DEFINER, search_path=public, GRANT só para authenticated):
- Retorna tarefas onde `criador_id = auth.uid()` AND `responsavel_id <> auth.uid()` AND não consta em `projeto_tarefa_colaboradores` para o usuário.
- Filtros: `excluida_em IS NULL`. Mesmas colunas que `get_minhas_tarefas_central` + campo `responsavel_nome`.
- Ordenação: `data_prazo NULLS LAST, created_at`.

**Frontend:**
- `src/hooks/useMinhasDelegadas.ts` (mesmo padrão de `useMinhasTarefas`).
- Nova `TabsTrigger "delegadas"` em `CentralTrabalho.tsx`, ícone `Send`.
- Componente `DelegadasContent.tsx` reutilizando `ListRow`/`ListSection` e exibindo coluna extra "Responsável atual" com avatar.
- Atualizar `centralUrlParams.ts` (`normalizeTab` aceita `"delegadas"`) e KPI chip "Delegadas".
- Aba é opcional: visível sempre, mas com badge de contagem zerada quando vazia.

## 2. Auditoria de mudanças de acesso

**Banco — nova tabela `projeto_tarefa_acesso_audit`:**

```text
id uuid pk
tarefa_id uuid (fk projeto_tarefas, on delete cascade, indexed)
projeto_id uuid (denormalizado para queries rápidas, indexed)
user_afetado_id uuid (quem ganhou/perdeu acesso)
ator_id uuid (quem fez a mudança - auth.uid())
acao text check in ('ganhou_acesso','perdeu_acesso')
motivo text check in (
  'responsavel_alterado', 'colaborador_adicionado', 'colaborador_removido',
  'secao_liberada', 'secao_revogada', 'tarefa_movida_secao',
  'membro_projeto_adicionado', 'membro_projeto_removido', 'tarefa_excluida'
)
papel_anterior text  -- responsavel|colaborador|secao|membro|null
papel_novo text
metadata jsonb       -- {secao_id, secao_anterior_id, ...}
created_at timestamptz default now()
```

RLS: SELECT restrito a admin via `has_role`, ou ao próprio `user_afetado_id` ou `ator_id`. INSERT bloqueado para todos (apenas triggers SECURITY DEFINER inserem).

**Triggers:**
- `trg_audit_tarefa_responsavel` em `projeto_tarefas` AFTER UPDATE OF responsavel_id: registra `perdeu_acesso` para o antigo (se não for colaborador) e `ganhou_acesso` para o novo.
- `trg_audit_tarefa_colaborador` em `projeto_tarefa_colaboradores` AFTER INSERT/DELETE.
- `trg_audit_tarefa_excluida` em `projeto_tarefas` AFTER UPDATE OF excluida_em (perdeu_acesso para todos os envolvidos).
- `trg_audit_secao_membro` em `projeto_membro_secoes` AFTER INSERT/DELETE: emite `secao_liberada/revogada` para todas as tarefas filhas onde o usuário não é diretamente envolvido.
- `trg_audit_membro_projeto` em `projeto_membros` AFTER INSERT/DELETE: gera evento agregado a nível de projeto (sem expandir tarefa por tarefa para evitar volume).

Funções dos triggers usam `coalesce(auth.uid(), '00000000-...')` quando ato vem de service_role/job. Cada função `LANGUAGE plpgsql SECURITY DEFINER SET search_path=public`.

**Índices:** `(tarefa_id, created_at desc)`, `(user_afetado_id, created_at desc)`, `(projeto_id, created_at desc)`.

**Retenção:** registros mais velhos que 12 meses limpos por job (criado depois). Documentar.

**Frontend:**
- Hook `useTarefaAcessoAudit(tarefaId)` lista os últimos 50 eventos.
- Aba "Histórico de acesso" no `ProjetoTarefaDetalhe` (visível apenas para admin/coordenador/criador do projeto).

## 3. Tela de depuração de visibilidade (admin)

**Banco — RPC `debug_visibilidade_tarefa(p_tarefa_id, p_user_id) RETURNS jsonb`** (SECURITY DEFINER, somente admin via `has_role` no início; senão `RAISE EXCEPTION`):

Retorna:
```text
{
  tarefa: {id, titulo, projeto_id, secao_id, responsavel_id, criador_id, excluida_em},
  user: {id, nome, role_sistema},
  central: {
    visivel: boolean,
    motivos: ['responsavel_direto'|'colaborador_explicito'],
    bloqueios: ['nao_e_responsavel','nao_e_colaborador','tarefa_excluida']
  },
  projeto: {
    visivel: boolean,
    papel_no_projeto: 'admin'|'criador_projeto'|'coordenador'|'gestor_produto'|'membro'|'nenhum',
    motivos: [...],
    bloqueios: [...],
    secao_liberada: boolean,
    secoes_liberadas: [uuid],
  },
  regras_aplicadas: [
    {regra: 'is_admin', resultado: true|false},
    {regra: 'is_criador_projeto', resultado},
    {regra: 'is_coordenador', resultado},
    {regra: 'is_responsavel', resultado},
    {regra: 'is_colaborador', resultado},
    {regra: 'tem_secao_liberada', resultado}
  ]
}
```

**Frontend:**
- Botão "Por que vejo isto?" no `ProjetoTarefaDetalhe.tsx`, visível somente para admin (via `useUserRole`). Abre `VisibilidadeDebugDialog` com seletor de usuário (combobox de profiles) e o resultado formatado.
- Página standalone `src/pages/admin/VisibilidadeTarefas.tsx` em `/dashboard/projetos/admin/visibilidade`, registrada com `ScreenRoute screenCode="admin"`. Permite escolher tarefa (busca por código/título) + usuário, exporta CSV do resultado.
- Componente compartilhado `VisibilidadeDebugCard.tsx` reaproveitado nos dois locais.

## 4. FAQ de visibilidade

**Frontend:**
- Nova página `src/pages/ajuda/VisibilidadeProjetos.tsx` em `/dashboard/ajuda/projetos-visibilidade`.
- Estrutura: hero curto + 6 seções colapsáveis (Accordion):
  1. Quem é responsável, colaborador, criador, coordenador?
  2. O que aparece na minha Central de Trabalho?
  3. O que aparece dentro de um projeto?
  4. O que muda com liberação de seção?
  5. Aba Delegadas por mim
  6. Como pedir acesso a uma tarefa?
- Inclui matriz visual:

```text
                 | Central | Projeto (lista) | Histórico
Responsável      |   sim   |      sim        |    sim
Colaborador      |   sim   |      sim        |    sim
Criador (só)     |   não*  |      não        |    sim (aba Delegadas)
Coordenador      |   não** |      tudo       |    tudo
Membro projeto   |   não** |  só dele        |    só dele
Admin            |   não** |      tudo       |    tudo
* aparece em "Delegadas por mim"
** salvo se também for responsável/colaborador
```

- Link discreto a partir do `CentralHeader` ("Como funciona a visibilidade?") e do banner de visão parcial.

## Validação

1. Criar tarefa em projeto X, definir outro usuário como responsável → tarefa aparece em "Delegadas por mim" do criador, não em "Tarefas".
2. Trocar responsável de uma tarefa → aparecem 2 eventos no `projeto_tarefa_acesso_audit` (perdeu/ganhou) com motivo `responsavel_alterado`.
3. Adicionar/remover colaborador → 1 evento por ação.
4. Liberar/revogar seção para um membro → eventos para tarefas dessa seção em que o membro não estava direto.
5. Como admin, abrir tarefa Y, clicar "Por que vejo isto?", escolher Nathalia → veredito explica cada regra.
6. Página `/dashboard/ajuda/projetos-visibilidade` carrega para qualquer usuário autenticado.
7. Rodar linter Supabase: zero novos erros/warnings introduzidos pelos triggers.

## Riscos & mitigações

- **Volume de auditoria** ao revogar uma seção com muitas tarefas: trigger insere em batch via `INSERT ... SELECT`. Documentar que mudança em massa pode gerar centenas de linhas. Índice em `(projeto_id, created_at)` mantém leitura rápida.
- **Performance da RPC delegadas**: usa mesmo índice (`responsavel_id`, `criador_id`). Adicionar índice parcial `idx_tarefas_criador_nao_resp ON projeto_tarefas(criador_id) WHERE excluida_em IS NULL`.
- **Privacidade do debug**: RPC checa `has_role(auth.uid(),'admin')` no primeiro statement; falha hard se não for admin. Botão da UI também esconde, mas RLS é a defesa real.
- **Falsos eventos** durante backfill/migrations: triggers ignoram quando `auth.uid() IS NULL` AND a sessão tem flag `app.skip_audit = on` (settable via `set_config`).
