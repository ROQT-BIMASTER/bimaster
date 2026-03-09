

# Análise de Brechas — Módulo de Projetos (Equipe de Desenvolvimento)

## Brechas Identificadas

### 1. Botões "Filtrar" e "Ordenar" sem funcionalidade
**Severidade: Alta**
Os botões no `ProjetoHeader.tsx` (linhas 107-112) são puramente visuais — não executam nenhuma ação. A coordenadora não consegue filtrar tarefas por status, responsável, prioridade, prazo ou retrabalho, nem ordenar por data/prioridade.

**Solução:** Implementar popover de filtros (status, responsável, prioridade, tipo retrabalho, estágio) e ordenação (prazo, prioridade, data de criação) que filtre as tarefas na `ProjetoListView`.

---

### 2. Botão "Adicionar tarefa" no header sem funcionalidade
**Severidade: Alta**
O botão `+ Adicionar tarefa` no header (linha 113-115) não possui `onClick`. A criação de tarefas funciona apenas dentro de cada seção.

**Solução:** Conectar ao fluxo de criação existente ou abrir um dialog rápido de criação com seleção de seção.

---

### 3. Aba "Arquivos" não implementada
**Severidade: Média**
A aba mostra apenas "Arquivos — Em breve" (ProjetoDetalhe.tsx:123). A coordenadora não tem visão centralizada dos documentos do projeto.

**Solução:** Criar componente que lista todos os anexos e documentos do cofre do projeto, agrupados por categoria, com busca e download.

---

### 4. Ausência de log de atividades/histórico nas tarefas
**Severidade: Média**
Não existe trilha de auditoria mostrando quem alterou status, prazo, responsável, etc. A coordenadora não tem visibilidade de mudanças feitas pela equipe.

**Solução:** Criar tabela `projeto_tarefa_atividades` e registrar automaticamente mudanças em status, responsável e prazo via trigger ou código.

---

### 5. RLS das aprovações muito permissiva para INSERT/UPDATE/DELETE
**Severidade: Alta (Segurança)**
As policies de `projeto_tarefa_aprovacoes` usam `WITH CHECK (true)` e `USING (true)` para INSERT, UPDATE e DELETE — qualquer usuário autenticado pode inserir/modificar/deletar aprovações de qualquer projeto, mesmo sem ser membro.

**Solução:** Restringir INSERT/UPDATE/DELETE para membros do projeto (via join com `projeto_membros` ou verificação de `criador_id`).

---

### 6. Sem dependências entre tarefas
**Severidade: Média**
O status "bloqueada" existe, mas não há como vincular tarefas entre si (ex: "tarefa B depende de tarefa A"). No Gantt, não há linhas de dependência.

**Solução:** Criar tabela de dependências e visualizar setas no cronograma.

---

### 7. Sem exportação de relatórios do projeto
**Severidade: Média**
Apenas o briefing individual tem export Excel. Não há exportação geral do projeto (lista de tarefas, status, atrasos) para PDF/Excel.

**Solução:** Adicionar botão de exportação no header ou dashboard de equipe.

---

### 8. Sem notificações/alertas de prazo
**Severidade: Média**
Não há mecanismo de notificação quando uma tarefa está próxima do prazo ou atrasou. O campo `dias_alerta_antes` existe mas é usado apenas para cor visual.

**Solução:** Implementar edge function agendada (cron) que envia notificações no app ou por email.

---

### 9. Dashboard de equipe não mostra "tarefas pendentes" (sem atribuição de membro)
**Severidade: Baixa**
O `ProjetoEquipeDashboard` mostra `semResponsavel` como aviso no rodapé, mas tarefas sem responsável não aparecem no gráfico nem nos cards — são invisíveis na análise de carga.

**Solução:** Adicionar card "Sem responsável" no dashboard com listagem dessas tarefas.

---

## Prioridade de Implementação Sugerida

| # | Brecha | Impacto |
|---|--------|---------|
| 1 | Filtrar + Ordenar funcional | Alto — usabilidade diária |
| 2 | RLS aprovações restritiva | Alto — segurança |
| 3 | Botão Adicionar tarefa funcional | Alto — usabilidade |
| 4 | Aba Arquivos centralizada | Médio — gestão documental |
| 5 | Log de atividades nas tarefas | Médio — rastreabilidade |
| 6 | Exportação de relatórios | Médio — reportes |
| 7 | Notificações de prazo | Médio — proatividade |
| 8 | Dependências entre tarefas | Médio — planejamento |
| 9 | Dashboard tarefas sem responsável | Baixo — visibilidade |

Posso implementar todas essas correções em sequência, começando pelas de maior impacto. Deseja que eu prossiga?

