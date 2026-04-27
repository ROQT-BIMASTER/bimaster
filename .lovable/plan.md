## Auditoria do Módulo de Projetos — Plano de Estabilização para Produção

### 1. Escopo levantado

O módulo é grande e já está em uso real:

- 30+ rotas (`/dashboard/projetos/*`)
- 50+ componentes React, 25+ hooks, 7 visões (Lista, Kanban, Cronograma, Calendário, Inbox, Equipe, Central de Trabalho)
- 42 tabelas no banco (`projetos`, `projeto_tarefas`, `projeto_secoes`, `projeto_membros`, `projeto_tarefa_*`, etc.)
- 25 projetos reais, 1.630 tarefas, 156 seções, 62 membros, 473 anexos, 20 comentários

### 2. Diagnóstico atual

**Saúde técnica (positivo)**
- TypeScript compila limpo no módulo (zero erros nos arquivos de Projetos)
- Todas as tabelas têm RLS habilitada e policies definidas
- Stack moderna (React Query, Zod, hooks reutilizáveis)
- White-label, hierarquia por `supervisor_id`, governança de processos já implementadas

**Riscos operacionais (críticos para uso real)**
1. **51% das tarefas sem prazo** (838/1.630) — quebra alertas de risco, projeções e produtividade
2. **47% das tarefas sem responsável** (771/1.630) — ninguém é cobrado, ninguém recebe notificação
3. **Tabela `projeto_atividades` zerada** (0 registros) apesar de existirem 1.060 conclusões — log de auditoria não está sendo gravado
4. **Apenas 20 comentários para 1.630 tarefas** — colaboração está fluindo por fora do sistema (provável WhatsApp)
5. **Zero dependências entre tarefas** (`projeto_tarefa_dependencias` = 0) — sequenciamento não é usado

**Riscos de UX para o time**
- Não há onboarding/tour guiado para novos funcionários
- Não há "estado vazio" educativo nas telas principais
- Atalhos de teclado e produtividade não estão documentados in-app
- Notificações de tarefa atribuída/comentário/menção não estão verificadas ponta-a-ponta

**Risco de segurança**
- O linter global do banco aponta vários `SECURITY DEFINER` callables por anônimos. Precisa filtrar quais pertencem ao módulo de Projetos antes de mexer (não é seguro tocar tudo de uma vez).

### 3. Estratégia recomendada — 4 ondas

Em vez de "consertar tudo", proponho 4 ondas pequenas, cada uma entregável e testável.

#### Onda 1 — Higiene de dados e auditoria (essencial antes de operar)
- Backfill: para tarefas sem prazo, derivar prazo do projeto-pai ou marcar como "sem prazo definido" com badge visível
- Backfill: tarefas sem responsável recebem o criador como responsável padrão (com aviso para revisão)
- Reativar gravação em `projeto_atividades` em todos os pontos (criar/concluir/atribuir/mover/excluir tarefa) via trigger único no banco — fonte única de verdade
- Painel admin "Saúde do Módulo" mostrando: % com prazo, % com responsável, % com responsável ativo, projetos parados há >14 dias

#### Onda 2 — Notificações e cobrança automática
- Verificar e corrigir notificações in-app + e-mail para: tarefa atribuída a você, mencionado em comentário, prazo em 48h, prazo vencido
- Resumo diário às 8h (Brasília) por e-mail: "Suas tarefas para hoje"
- Lembrete semanal de tarefas paradas há >7 dias para o responsável

#### Onda 3 — Onboarding e usabilidade para o time
- Tour guiado (primeira visita) na Central de Trabalho explicando: Hoje, Semana, Atrasadas, Inbox
- Estados vazios educativos com CTA ("Crie sua primeira tarefa", "Atribua um responsável")
- Cheatsheet de atalhos (cmd+K, atalhos de status) acessível no header
- Documento curto "Como trabalhar no Projetos" gerado em `/mnt/documents/` para entregar ao time

#### Onda 4 — QA automatizado e gates de produção
- Suíte Vitest cobrindo os fluxos críticos: criar projeto → seção → tarefa → atribuir → concluir → validar
- Smoke test do hook `useProjetoTarefas` (a query do meio do módulo)
- Teste de RLS: usuário A não vê projetos do usuário B
- Checklist de release no `ApiDocumentation.tsx` (padrão já adotado no projeto)

### 4. Próximo passo proposto

Começar pela **Onda 1** (mais alto impacto, menor risco). Ela entrega:
- Dados saneados (todas as tarefas operáveis)
- Auditoria viva (qualquer ação ficará registrada)
- Painel para o gestor enxergar a qualidade dos dados em tempo real

Aprovo iniciar pela Onda 1, ou prefere outra prioridade (ex.: começar por notificações da Onda 2, ou rodar primeiro os testes da Onda 4)?
