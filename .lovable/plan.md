

## Análise Completa do Módulo de Desenvolvimento de Produtos

Após inspeção detalhada de todos os componentes, hooks, fluxos e tabelas, identifiquei os seguintes problemas e melhorias necessárias para produção.

---

### PROBLEMAS ENCONTRADOS (Bugs / Gaps)

#### 1. `sendToCofre` sem validação de papel (CRÍTICO)
O `useProjetoTarefaDetalhe.ts` (linha 156) envia documentos ao cofre sem verificar se o usuário tem papel `admin_cofre`. A função `can_publish_to_cofre` existe no banco mas **nunca é chamada** no frontend. Qualquer membro pode enviar ao cofre.

**Correção:** Antes de executar `sendToCofre`, chamar `supabase.rpc('can_publish_to_cofre')` e bloquear se retornar false, exibindo toast de erro.

#### 2. Controle de versão desconectado (MÉDIO)
`DocVersionHistory.tsx` existe mas **nunca é renderizado** em nenhum componente. A tabela `produto_documento_versoes` existe no banco mas o upload de anexos (`uploadAnexo`) não cria registros de versão nela.

**Correção:** Integrar `DocVersionHistory` na aba "No Cofre" do `TarefaFocusMode`. Ao fazer upload de arquivo com mesmo nome, criar nova versão em `produto_documento_versoes`.

#### 3. `ValidacaoFinalDialog` e `ProjetoAprovacaoCadastro` marcam `visivel_fabrica=true` sem checar papel (MÉDIO)
Linhas 229-232 do `ValidacaoFinalDialog` e 142-145 do `ProjetoAprovacaoCadastro` liberam documentos para a fábrica sem validação de papel `admin_cofre`.

**Correção:** Adicionar chamada a `can_publish_to_cofre` antes de liberar visibilidade.

#### 4. Aprovações sem restrição de papel (MÉDIO)
`ProjetoAprovacaoWorkflow.tsx` permite que **qualquer** membro aprove/rejeite etapas. Não valida se o usuário tem o papel correspondente à etapa (ex: etapa "regulatório" deveria exigir papel `regulatorio`).

**Correção:** Mapear etapas a papéis e validar antes de permitir ação de aprovar/rejeitar.

#### 5. `ProductDevStatusBar` sem validação frontend de transições (BAIXO)
O componente permite transições por papel no popover, mas não valida se a transição é sequencial. Ex: um `admin_cofre` poderia pular de "submissão_criada" direto para "publicado_cofre".

**Correção:** Filtrar transições permitidas para mostrar apenas o próximo status lógico na sequência.

#### 6. Upload de arquivos sem validação de tipo/tamanho (BAIXO)
`handleFileUpload` aceita qualquer arquivo sem limite de tamanho ou validação de tipo. Pode causar uploads de gigabytes.

**Correção:** Adicionar validação de tamanho máximo (20MB) e tipos permitidos (PDF, imagens, Excel, Word).

---

### FUNCIONALIDADES QUE FUNCIONAM

- Cadastro/edição/exclusão de membros do projeto com papéis
- Atribuição de papéis de desenvolvimento (gestor, regulatório, design, etc.)
- Upload de anexos às tarefas
- Envio de documentos ao cofre com categorização
- Chat em tempo real por tarefa
- Comentários com @mentions
- Marcos (metas) de tarefa
- Subtarefas com toggle de conclusão
- Importação de briefing via Excel
- Workflow de aprovação multi-etapa (adicionar, aprovar, rejeitar, remover)
- Barra de status de desenvolvimento do produto (9 estágios)
- Cofre Oficial somente-leitura
- Auditoria de ações em `produto_doc_audit_log`
- Vinculação de produto à tarefa
- Checklist de pré-lançamento com auditoria IA

---

### PLANO DE CORREÇÕES

#### Migration SQL
- Nenhuma alteração de schema necessária (tabelas e funções já existem)

#### Arquivo: `src/hooks/useProjetoTarefaDetalhe.ts`
- Adicionar validação de papel `admin_cofre` no `sendToCofre` via RPC `can_publish_to_cofre`
- Ao fazer upload, verificar se já existe documento com mesmo nome no cofre e criar versão em `produto_documento_versoes`
- Adicionar validação de tamanho (max 20MB) e tipo de arquivo no `uploadAnexo`

#### Arquivo: `src/components/projetos/TarefaFocusMode.tsx`
- Integrar `DocVersionHistory` na aba "No Cofre" (expandível por documento)
- Desabilitar botão "Enviar ao Cofre" se o usuário não tiver papel `admin_cofre` (mostrar tooltip explicativo)
- Adicionar feedback visual de progresso no upload

#### Arquivo: `src/components/projetos/ProjetoAprovacaoWorkflow.tsx`
- Mapear etapa de aprovação ao papel correspondente (regulatorio→regulatorio, arte→design/controle_arte)
- Esconder botões Aprovar/Rejeitar para usuários sem o papel da etapa
- Exigir observação obrigatória em rejeições (justificativa)

#### Arquivo: `src/components/projetos/ProductDevStatusBar.tsx`
- Filtrar transições para mostrar apenas o próximo status sequencial (não permitir pular etapas)
- Adicionar confirmação antes de transição

#### Arquivo: `src/components/projetos/ValidacaoFinalDialog.tsx`
- Validar papel `admin_cofre` antes de marcar `visivel_fabrica=true`

---

### SUGESTÕES DE MELHORIAS PARA PRODUÇÃO

1. **Notificações por papel** -- Quando um documento precisa de ação (ex: arte pronta para revisão), notificar automaticamente o membro com papel `controle_arte`
2. **Dashboard de governança** -- Painel visual mostrando em qual etapa cada produto está, com contadores por status e alertas de SLA
3. **Prazo por etapa** -- Definir SLA por estágio (ex: Regulatório tem 3 dias para validar) com alertas automáticos
4. **Histórico/Timeline unificado** -- Na ficha do produto, exibir timeline completa com todas as ações do `produto_doc_audit_log`
5. **Assinatura digital** -- Ao aprovar documentos críticos, registrar assinatura eletrônica (nome + data + IP)
6. **Exportação de relatório** -- Gerar PDF do fluxo completo de um produto (quem fez o quê, quando, com que justificativa)

