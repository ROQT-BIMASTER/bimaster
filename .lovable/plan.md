

## Análise Detalhada de Cada Clique — Falhas, Correções e Melhorias com IA

Após inspeção profunda de todos os arquivos do módulo de Desenvolvimento de Produtos, segue a análise botão por botão, fluxo por fluxo.

---

### SEÇÃO 1 — FALHAS POR COMPONENTE (Cada Clique)

#### `TarefaFocusMode.tsx` (881 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Upload** (botão "Upload", linha 531) | `handleFileUpload` não mostra progresso visual. Múltiplos arquivos simultâneos não têm feedback individual. O `input` aceita `multiple` mas não há barra de progresso | Baixo |
| **Download** (botão Download, linha 555) | `getAnexoUrl` gera URL assinada de 1h, mas não audita download de documentos de trabalho (só audita no `CofreOficialTab`) | Baixo |
| **Excluir anexo** (Trash2, linha 560) | Usa `confirm()` nativo do browser — inconsistente com o design. Deveria usar `AlertDialog` do Radix | Baixo |
| **Enviar ao Cofre** (linha 669-696) | Funcional, mas se o `sendToCofre` falhar parcialmente (ex: 3 de 5 arquivos), não há rollback — arquivos já copiados ficam órfãos no storage | Médio |
| **Seletor de Categoria** (linha 651-663) | Não tem sugestão automática de categoria. O usuário precisa classificar manualmente cada arquivo | Melhoria |
| **Chat** (MentionInput, linha 834-841) | Mensagens não são paginadas — se tiver 500+ mensagens, carrega todas de uma vez. Sem lazy loading | Médio |
| **Comentários** (linha 755-761) | Não há opção de editar ou excluir um comentário após envio | Baixo |
| **Marcar concluída** (linha 220-228) | Não verifica se há aprovações pendentes antes de marcar como concluída. Uma tarefa com etapas rejeitadas pode ser "concluída" | Médio |
| **Subtarefas** (linha 467-479) | `onToggle(st)` chama toggle na subtarefa, mas não verifica se a subtarefa tem dependências. Subtarefas não têm responsável atribuível inline | Baixo |
| **Briefing Import** (linha 430-438) | Funcional. Sem problemas detectados | OK |
| **ProductDevStatusBar** (linha 498-506) | Funcional com validações de sequência e papel | OK |
| **DocVersionHistory** (aba Cofre, linha 608-611) | Funcional, mas o botão "Marcar como oficial" (Check icon) é muito pequeno (h-6 w-6) e sem label — fácil de ignorar | Baixo |

#### `ProjetoAprovacaoWorkflow.tsx` (314 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Adicionar etapa** (linha 302-309) | Qualquer membro pode adicionar etapas de aprovação, sem restrição de papel | Médio |
| **Remover etapa** (Trash2, linha 221) | Qualquer membro pode remover etapa pendente — deveria ser restrito a coordenador/gestor | Médio |
| **Aprovar** (botão verde, linha 254-258) | Validação de papel funciona corretamente via `canApproveEtapa` | OK |
| **Rejeitar** (botão vermelho, linha 261-267) | Obriga observação — funcional e correto | OK |
| **Observação** (Textarea, linha 247-250) | Placeholder diz "obrigatória para rejeição" mas a variável verifica `aprov.etapa === "rejeitado"` que nunca é true (o etapa é "regulatorio", "qualidade" etc., não "rejeitado"). Bug no placeholder condicionado | Baixo |

#### `ValidacaoFinalDialog.tsx` (334 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Enviar para Validação** (handleSubmit, linha 70-99) | Não verifica se todas as etapas de aprovação (`projeto_tarefa_aprovacoes`) estão aprovadas antes de enviar. Um usuário pode enviar para validação final mesmo com etapas regulatórias pendentes | Crítico |
| **Checkbox de categoria** (linha 133-139) | Funcional — confirma cada categoria antes de enviar | OK |
| **Aprovar** (AprovacaoPanel, linha 205-258) | Validação de papel via `can_publish_to_cofre` — funcional | OK |
| **Rejeitar** (linha 260-288) | Não exige motivo obrigatório — o `rejectObs` pode estar vazio e o botão "Confirmar" está sempre habilitado. Deveria exigir justificativa | Médio |

#### `ProjetoAprovacaoCadastro.tsx` (1021 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Aprovar Cadastro** (handleAprovar, linha 126-161) | Validação de papel funcional | OK |
| **Solicitar Correção** (handleRejeitar, linha 164-187) | Funcional — exige observação | OK |
| **Aprovar Todos docs** (botão, linha 481-489) | Marca TODOS os documentos como aprovados sem checagem individual — pode aprovar docs que o revisor não leu | Médio |
| **Checkbox doc individual** (linha 783-789) | Funcional | OK |
| **Solicitar Revisão doc** (botão RotateCcw, linha 809-814) | Funcional mas não notifica o responsável da tarefa | Baixo |
| **Vincular Produto** (handleAddProduto, linha 205-251) | Já tem auditoria IA para China — funcional e bem implementado | OK |
| **Desvincular Produto** (handleRemoveProduto, linha 253-258) | Sem confirmação antes de desvincular. Sem auditoria | Médio |
| **Chat/Parecer** (AprovacaoChatPanel, linha 873-1021) | Não tem realtime — comentários só aparecem após refresh. Diferente do chat na TarefaFocusMode que tem subscription | Médio |

#### `ProductDevStatusBar.tsx` (141 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Transição de status** (linha 111-119) | Usa `confirm()` nativo — inconsistente com design | Baixo |
| **Popover abre apenas no badge atual** (linha 89) | UX correta mas poderia mostrar tooltip explicativo nos outros badges | Baixo |
| **Sem campo de justificativa na transição** | Ao mudar status, não registra motivo (apenas de/para no audit log). Para `ajuste_solicitado`, deveria exigir motivo | Médio |

#### `CofreOficialTab.tsx` (130 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Download** (handleDownload, linha 59-75) | Funcional com auditoria | OK |
| **Badge OFICIAL vs VISÍVEL** (linha 111-119) | Funcional | OK |
| **Sem botão "Revogar do Cofre"** | Documentos publicados por engano não podem ser removidos | Médio |

#### `DocVersionHistory.tsx` (102 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Marcar como oficial** (markOfficial, linha 36-60) | Funcional, mas só aparece para versões com status "aprovado". Versões com status "rascunho" (que é o default no sendToCofre) nunca poderão ser marcadas como oficiais sem um passo intermediário de aprovação que não existe na UI | Crítico |
| **Sem botão "Aprovar versão"** | O status de versão fica em "rascunho" eternamente porque nenhum componente permite mudar para "aprovado" | Crítico |

#### `ProjetoMembrosDialog.tsx` (274 linhas)

| Clique / Ação | Problema | Severidade |
|---|---|---|
| **Adicionar membro** (linha 142-150) | Sempre adiciona como "membro" — deveria perguntar o papel ao adicionar | Baixo |
| **Alterar papel** (Select, linha 193-211) | Funcional para `desenvolvimento_produto` | OK |
| **Remover membro** (Trash2, linha 218-226) | Sem confirmação antes de remover. Sem auditoria | Médio |
| **Seções visíveis** (Checkboxes, linha 243-254) | Funcional | OK |

---

### SEÇÃO 2 — CORREÇÕES NECESSÁRIAS

#### Prioridade Crítica
1. **DocVersionHistory — Adicionar botão "Aprovar versão"**: Sem isso, nenhuma versão pode ser marcada como oficial. Adicionar botão para `controle_arte`, `admin_cofre` e `coordenador` mudarem status de "rascunho" para "aprovado".
2. **ValidacaoFinalDialog — Verificar aprovações pendentes**: Antes de enviar para validação final, verificar se todas as etapas de `projeto_tarefa_aprovacoes` estão aprovadas.

#### Prioridade Média
3. **AprovacaoWorkflow — Restringir adição/remoção de etapas**: Apenas `coordenador` e `gestor_produto` podem adicionar/remover etapas.
4. **TarefaFocusMode — Verificar aprovações antes de concluir tarefa**: Se houver etapas pendentes/rejeitadas, avisar o usuário.
5. **ProductDevStatusBar — Exigir justificativa para "ajuste_solicitado"**: Campo obrigatório ao retornar status.
6. **ProjetoAprovacaoCadastro — Chat sem realtime**: Adicionar subscription como na TarefaFocusMode.
7. **CofreOficialTab — Botão "Revogar do Cofre"**: Disponível apenas para `admin_cofre`.
8. **ValidacaoFinalDialog — Exigir motivo para rejeição**: Desabilitar botão "Confirmar" se `rejectObs` está vazio.

#### Prioridade Baixa
9. **Substituir `confirm()` por `AlertDialog`** em ProductDevStatusBar e TarefaFocusMode.
10. **Paginação de mensagens no chat** (limite de 50 com "Carregar mais").
11. **Confirmação ao desvincular produto e remover membro**.

---

### SEÇÃO 3 — MELHORIAS COM IA

#### 1. Classificação automática de categoria no upload ao Cofre
Quando o usuário seleciona documentos para enviar ao Cofre, a IA analisa o nome do arquivo e o tipo para sugerir automaticamente a categoria (Briefing, Arte Final, Rótulo, etc.).

- **Implementação**: Chamar a edge function `projeto-ia-assistant` com action `classify_document` (já existe no `useProjetoIA`) ao selecionar cada arquivo na aba "Fora do Cofre"
- **UI**: Auto-preencher o Select de categoria com a sugestão da IA, mostrando badge "🤖 IA" ao lado
- **Arquivo**: `TarefaFocusMode.tsx`, seção "Fora do Cofre"

#### 2. Resumo de Aprovação com IA
Ao abrir uma tarefa para aprovação no `ProjetoAprovacaoCadastro`, gerar automaticamente um resumo executivo: quantos documentos, status geral, alertas de incompatibilidade, checklist de pré-requisitos.

- **Implementação**: Nova action `approval_analysis` na edge function `projeto-ia-assistant`
- **UI**: Card colapsável no topo do `AprovacaoAnalisePanel` com resumo e recomendação
- **Arquivo**: `ProjetoAprovacaoCadastro.tsx` (novo componente `AIApprovalSummary`)

#### 3. Sugestão de justificativa para rejeição
Quando o revisor clica em "Rejeitar" ou "Solicitar Correção", a IA analisa os documentos e o histórico de comentários para sugerir um texto de justificativa padronizado.

- **Implementação**: Botão "Sugerir com IA" no Textarea de rejeição que chama edge function com contexto dos documentos
- **UI**: Textarea preenchido com sugestão editável
- **Arquivos**: `ProjetoAprovacaoWorkflow.tsx`, `ValidacaoFinalDialog.tsx`, `ProjetoAprovacaoCadastro.tsx`

#### 4. Auditoria Timeline com resumo IA
Componente `AuditTimeline` que exibe o histórico do `produto_doc_audit_log` de forma visual, com um resumo IA no topo explicando o progresso do produto em linguagem natural.

- **Implementação**: Novo componente que consulta `produto_doc_audit_log` e renderiza timeline. Botão "Resumir com IA" gera parágrafo contextualizado
- **UI**: Integrado na `ProductLaunchPanel` e no `TarefaFocusMode`
- **Arquivos**: Novo `src/components/projetos/AuditTimeline.tsx`

#### 5. Detecção de documentos faltantes com IA
Na checklist de pré-lançamento (`ProductLaunchPanel`), a IA analisa o tipo de produto, regulamentações e documentos já presentes para sugerir quais documentos ainda faltam.

- **Implementação**: Action `missing_docs_analysis` na edge function, recebendo produto, tipo e documentos existentes
- **UI**: Lista de sugestões com ícone ⚠️ e badge "Sugerido por IA" abaixo da checklist
- **Arquivo**: `ProductLaunchPanel.tsx`

---

### SEÇÃO 4 — PLANO DE IMPLEMENTAÇÃO

| # | Tarefa | Arquivos | Tipo |
|---|--------|----------|------|
| 1 | Botão "Aprovar versão" no DocVersionHistory | `DocVersionHistory.tsx` | Correção crítica |
| 2 | Verificar aprovações antes de validação final | `ValidacaoFinalDialog.tsx` | Correção crítica |
| 3 | Restringir adição/remoção de etapas por papel | `ProjetoAprovacaoWorkflow.tsx` | Correção média |
| 4 | Verificar aprovações antes de concluir tarefa | `TarefaFocusMode.tsx` | Correção média |
| 5 | Justificativa obrigatória em ajuste_solicitado | `ProductDevStatusBar.tsx` | Correção média |
| 6 | Realtime no chat de aprovação | `ProjetoAprovacaoCadastro.tsx` | Correção média |
| 7 | Botão "Revogar do Cofre" | `CofreOficialTab.tsx`, `useProjetoTarefaDetalhe.ts` | Correção média |
| 8 | Exigir motivo obrigatório na rejeição | `ValidacaoFinalDialog.tsx` | Correção média |
| 9 | Classificação automática IA de categoria | `TarefaFocusMode.tsx`, edge function existente | IA |
| 10 | AuditTimeline visual | **Novo** `AuditTimeline.tsx`, `ProductLaunchPanel.tsx` | Melhoria + IA |
| 11 | AlertDialog no lugar de confirm() | `ProductDevStatusBar.tsx`, `TarefaFocusMode.tsx` | UX |
| 12 | Confirmações em desvincular/remover | `ProjetoAprovacaoCadastro.tsx`, `ProjetoMembrosDialog.tsx` | UX |

