
# Documentos da submissão dentro da tarefa: análise, parecer e aprovação homologada

## Situação atual (verificada)

- O painel administrativo completo já existe e é compartilhado no módulo China: `ChecklistItemAdminPanel` (abas Pareceres e Comentários) é usado hoje em 4 telas do checklist. Ele só precisa de `documentoId`, `submissaoId`, `tipoDocumento`, `bucket` e o lado do usuário.
- As ações Aprovar / Rejeitar / Ciência / Substituir com parecer já gravam em um único lugar: `china_produto_documentos.status` (`aprovado`, `rejeitado`, `contestado`, `ciencia`, `pendente`) + histórico em `china_doc_revisoes` (quem revisou, data, parecer, rodada).
- Na tarefa do projeto existe hoje apenas `TarefaChinaDocsSection` → `ChinaDocumentoBlock`: baixar, substituir, devolver à China e ver um badge de status. **Não há pareceres, comentários, pré-visualização em foco nem aprovação.**
- No Kanban, o card mostra apenas contagem de anexos (`TarefaAnexosBadge`); não mostra situação do documento.
- Não existe hoje nenhuma exigência de senha na aprovação de documento. O padrão do projeto para reconfirmação é `verifyCurrentUserPassword()` (`src/lib/auth/verifyCurrentUserPassword.ts`) e há infraestrutura de token de step-up no backend (`mfa_step_up_tokens`, `mfa_step_up_validate`).

Como o status já é único (`china_produto_documentos`), a "propagação a todos os ambientes" é principalmente garantir que a tarefa/Kanban leiam e escrevam nessa mesma fonte e que todas as telas se atualizem em tempo real.

## O que será construído

### 1. Painel do documento dentro da tarefa

- Novo `TarefaDocumentoDrawer` (lado Brasil) aberto ao clicar no documento dentro da tarefa, com a mesma estrutura do módulo China:
  - Aba **Documento**: pré-visualização grande (reuso de `ChinaDocPreviewDialog`), botões Baixar / Abrir em tela cheia, versão e histórico.
  - Aba **Pareceres**: reuso direto de `ChecklistItemAdminPanel` (rodadas, aprovar, rejeitar, ciência, substituir com parecer).
  - Aba **Comentários**: já vem no mesmo painel.
- `ChinaDocumentoBlock` ganha o botão "Analisar documento" que abre esse drawer, mantendo as ações atuais.
- Também disponível no `VincularChinaSidePanel`, para o mesmo comportamento fora do Kanban.

### 2. Situação visível e ação rápida no Kanban

- Selo de situação no card e no topo da tarefa, com vocabulário único: **Pendente**, **Em análise**, **Pendente de aprovação**, **Aprovado**, **Não aprovado**.
- Quando a tarefa tem 1 documento pronto para decisão, aparece um botão rápido "Aprovar" no card/drawer; com mais de um documento, o botão abre a lista.
- Tarefas de checklist sem arquivo continuam com "Aguardando documentos".
- Agregação de situação por tarefa (pior status pendente prevalece) num único hook, reaproveitando `useTarefasAnexos`.

### 3. Aprovação homologada com usuário e senha

- Novo diálogo compartilhado `ConfirmarAprovacaoDialog`: mostra usuário logado, exige senha e parecer/justificativa.
- Verificação da senha **no servidor** (não apenas no navegador): nova função de backend que revalida a credencial e devolve um token de step-up de curta duração; a gravação da aprovação só é aceita com esse token válido.
- Nova rotina de backend `rpc_china_aprovar_documento` que, numa só transação: valida o token, atualiza o status do documento, grava a rodada em `china_doc_revisoes` e registra a trilha de auditoria (quem, quando, de onde, documento, submissão, projeto e tarefa) numa tabela dedicada, imutável.
- Esse gate passa a valer **em todos os pontos de aprovação** (Kanban, tarefa, Modo Foco China, Caixa de Entrada, Status do Checklist), porque as ações já passam por um único componente de parecer.
- Rejeição e ciência continuam sem senha (só aprovação exige), salvo indicação sua em contrário.

### 4. Propagação em tempo real

- Canal de tempo real em `china_produto_documentos` + invalidação cruzada das consultas de checklist, caixa de entrada, vincular China, documentos da tarefa e Kanban, para que a aprovação feita em qualquer tela apareça imediatamente nas demais.
- Ao aprovar o último documento obrigatório de um item, o item de checklist correspondente é marcado como concluído, mantendo o percentual do fluxo coerente.

## Detalhes técnicos

- Frontend: `src/components/projetos/tarefa-detalhe/TarefaDocumentoDrawer.tsx` (novo), ajustes em `ChinaDocumentoBlock.tsx`, `TarefaChinaDocsSection.tsx`, `TarefaAnexosBadge.tsx`, `ProjetoKanbanView.tsx`, `VincularChinaSidePanel.tsx`; novo hook `useTarefasDocStatus.ts`; mapeamento de rótulos centralizado em `src/lib/china/flowTones.ts` (evita duplicar `STATUS_LABEL`).
- Aprovação: `src/components/security/ConfirmarAprovacaoDialog.tsx` (novo, baseado em `PasswordConfirmDialog` mas usando `verifyCurrentUserPassword`), edge function `auth-step-up-password` com `secureHandler` e Zod `.strict()`, emissão de token em `mfa_step_up_tokens` (escopo `china:doc_approve`, validade 5 min, uso único).
- Backend: nova tabela `china_doc_aprovacoes_audit` (documento, submissão, projeto, tarefa, usuário, nome, decisão, parecer, método, IP/agente, data) com GRANTs, RLS de leitura para envolvidos/admin e bloqueio de update/delete; `rpc_china_aprovar_documento` como `SECURITY DEFINER` chamando `mfa_step_up_validate`; `DrawerParecerActions` passa a usar essa RPC no caminho "aprovar".
- Testes: regressão para o selo de situação no Kanban e para a recusa de aprovação sem token de step-up válido.
- `APP_VERSION` sobe para 3.8.3 com entrada no changelog.

## Fora de escopo

- Assinatura digital com certificado (ICP-Brasil) — a homologação aqui é usuário + senha + carimbo de data/hora.
- Alteração do fluxo de lotes de aprovação já existente (`TarefaAprovacoesSection`), que continua funcionando em paralelo.
